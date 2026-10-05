const express=require('express');
const path=require('node:path');
const crypto=require('node:crypto');
const {createDatabase,initialize}=require('./db');
const {clean,rank}=require('./matching');
const statuses=['New','Review','Interview','Rejected','Hired'];
const outcomes=['Scheduled','Completed','Cancelled'];
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const equal=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(),crypto.createHash('sha256').update(b).digest());
function createApp(db){
 const app=express();
 app.disable('x-powered-by');
 app.get('/health',wrap(async(_req,res)=>{await db.query('SELECT 1');res.json({status:'ok'});}));
 app.use((req,res,next)=>{
  if(!process.env.ADMIN_PASSWORD)return next();
  const header=req.headers.authorization||'';
  const decoded=header.startsWith('Basic ')?Buffer.from(header.slice(6),'base64').toString():'';
  const i=decoded.indexOf(':');
  if(i>=0&&equal(decoded.slice(0,i),process.env.ADMIN_USERNAME||'admin')&&equal(decoded.slice(i+1),process.env.ADMIN_PASSWORD))return next();
  res.set('WWW-Authenticate','Basic realm="Elevate HR", charset="UTF-8"');res.status(401).send('Sign in to access Elevate HR.');
 });
 app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(['POST','PATCH','PUT'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'Send JSON data.'});
  next();
 });
 app.use(express.json({limit:'256kb'}));
 app.use(express.static(path.join(__dirname,'public')));
 app.param('id',(req,res,next,value)=>{if(!/^\d+$/.test(value)||Number(value)>2147483647)return res.status(400).json({error:'Invalid record ID.'});next();});
 app.get('/api/jobs',wrap(async(_req,res)=>res.json((await db.query('SELECT * FROM jobs ORDER BY id DESC')).rows)));
 app.post('/api/jobs',wrap(async(req,res)=>{
  const {title,description,skills,min_experience}=req.body||{};
  const years=Number(min_experience);
  if(!clean(title,150)||!clean(description)||!Number.isFinite(years)||years<0||years>60)return res.status(400).json({error:'Enter a title, description and valid experience.'});
  const result=await db.query('INSERT INTO jobs(title,description,skills,min_experience) VALUES ($1,$2,$3,$4) RETURNING *',[clean(title,150),clean(description),clean(skills,1000),years]);
  res.status(201).json(result.rows[0]);
 }));
 app.get('/api/candidates',wrap(async(_req,res)=>res.json((await db.query('SELECT * FROM candidates ORDER BY id DESC')).rows)));
 function candidateFields(body={}){
  const name=clean(body.name,150),email=clean(body.email,254),experience=Number(body.experience);
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||!Number.isFinite(experience)||experience<0||experience>60)return null;
  return [name,email,clean(body.skills,1000),experience,clean(body.resume_text,10000),clean(body.phone,40),clean(body.notes)];
 }
 app.post('/api/candidates',wrap(async(req,res)=>{
  const fields=candidateFields(req.body);if(!fields)return res.status(400).json({error:'Enter a name, valid email and valid experience.'});
  res.status(201).json((await db.query('INSERT INTO candidates(name,email,skills,experience,resume_text,phone,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',fields)).rows[0]);
 }));
 app.patch('/api/candidates/:id',wrap(async(req,res)=>{
  const fields=candidateFields(req.body);if(!fields)return res.status(400).json({error:'Enter valid candidate details.'});
  const result=await db.query('UPDATE candidates SET name=$1,email=$2,skills=$3,experience=$4,resume_text=$5,phone=$6,notes=$7 WHERE id=$8 RETURNING *',[...fields,req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'Candidate not found.'});res.json(result.rows[0]);
 }));
 app.patch('/api/candidates/:id/status',wrap(async(req,res)=>{
  if(!statuses.includes(req.body?.status))return res.status(400).json({error:'Invalid status.'});
  const result=await db.query('UPDATE candidates SET status=$1 WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'Candidate not found.'});res.json(result.rows[0]);
 }));
 app.get('/api/interviews',wrap(async(_req,res)=>res.json((await db.query('SELECT i.*,c.name AS candidate_name,j.title AS job_title FROM interviews i JOIN candidates c ON c.id=i.candidate_id JOIN jobs j ON j.id=i.job_id ORDER BY i.scheduled_at ASC')).rows)));
 app.post('/api/interviews',wrap(async(req,res)=>{
  const body=req.body||{},candidate_id=Number(body.candidate_id),job_id=Number(body.job_id),scheduled_at=clean(body.scheduled_at,40),format=clean(body.format,30),notes=clean(body.notes);
  if(!Number.isInteger(candidate_id)||candidate_id<=0||candidate_id>2147483647||!Number.isInteger(job_id)||job_id<=0||job_id>2147483647||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(scheduled_at)||Number.isNaN(Date.parse(scheduled_at))||!['Video','Phone','In person'].includes(format))return res.status(400).json({error:'Select a candidate, role, valid date and format.'});
  const result=await db.query('INSERT INTO interviews(candidate_id,job_id,scheduled_at,format,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',[candidate_id,job_id,scheduled_at,format,notes]);
  res.status(201).json(result.rows[0]);
 }));
 app.patch('/api/interviews/:id',wrap(async(req,res)=>{
  if(!outcomes.includes(req.body?.outcome))return res.status(400).json({error:'Invalid outcome.'});
  const result=await db.query('UPDATE interviews SET outcome=$1 WHERE id=$2 RETURNING *',[req.body.outcome,req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'Interview not found.'});res.json(result.rows[0]);
 }));
 app.get('/api/jobs/:id/rank',wrap(async(req,res)=>{
  const job=(await db.query('SELECT * FROM jobs WHERE id=$1',[req.params.id])).rows[0];
  if(!job)return res.status(404).json({error:'Job not found.'});
  const ranking=(await db.query('SELECT * FROM candidates')).rows.map(c=>({...c,...rank(job,c)})).sort((a,b)=>b.score-a.score||a.id-b.id);
  res.json({job,ranking});
 }));
 app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
 app.use((err,_req,res,_next)=>{
  if(err.code==='23503')return res.status(400).json({error:'Candidate or role does not exist.'});
  if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON.'});
  if(err.type==='entity.too.large')return res.status(413).json({error:'Request is too large.'});
  console.error('Request failed:',err.code||err.name);res.status(500).json({error:'Request failed. Check the server logs.'});
 });
 return app;
}
async function start(){
 if(process.env.NODE_ENV==='production'&&(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16))throw new Error('Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 16 characters.');
 const db=createDatabase();db.on('error',()=>console.error('Idle database connection error.'));
 await initialize(db);
 const server=createApp(db).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Elevate HR server started.'));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>db.end().then(()=>process.exit(0))));
}
if(require.main===module)start().catch(err=>{console.error('Startup failed:',err.message.startsWith('Set ')?err.message:(err.code||err.name));process.exit(1);});
module.exports={createApp};
