const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const app = express();
const db = new Database(path.join(__dirname, 'elevatehr.db'));
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
app.use(express.json({limit:'256kb'}));
app.use(express.static(path.join(__dirname, 'public')));
const clean = (v, max=3000) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const tokens = s => new Set(clean(s,10000).toLowerCase().split(/[^a-z0-9+#.]+/).filter(x=>x.length>1));
function rank(job, candidate) {
  const required = [...tokens(job.skills)];
  const found = tokens(candidate.skills+' '+candidate.resume_text);
  const matched = required.filter(s=>found.has(s));
  const missing = required.filter(s=>!found.has(s));
  const skillScore = required.length ? matched.length/required.length : 0;
  const expScore = job.min_experience ? Math.min(candidate.experience/job.min_experience,1) : 1;
  const terms = [...tokens(job.description)].filter(t=>t.length>3);
  const descriptionScore = terms.length ? terms.filter(t=>found.has(t)).length/terms.length : 0;
  return {score:Math.round(70*skillScore+20*expScore+10*descriptionScore),matched,missing};
}
app.get('/api/jobs',(_req,res)=>res.json(db.prepare('SELECT * FROM jobs ORDER BY id DESC').all()));
app.post('/api/jobs',(req,res)=>{
  const title=clean(req.body.title,150), description=clean(req.body.description), skills=clean(req.body.skills,1000);
  const min_experience=Number(req.body.min_experience);
  if(!title||!description||!Number.isFinite(min_experience)||min_experience<0||min_experience>60) return res.status(400).json({error:'Enter a title, description, and valid experience.'});
  const id=db.prepare('INSERT INTO jobs(title,description,skills,min_experience) VALUES (?,?,?,?)').run(title,description,skills,min_experience).lastInsertRowid;
  res.status(201).json(db.prepare('SELECT * FROM jobs WHERE id=?').get(id));
});
app.get('/api/candidates',(_req,res)=>res.json(db.prepare('SELECT * FROM candidates ORDER BY id DESC').all()));
app.post('/api/candidates',(req,res)=>{
  const name=clean(req.body.name,150), email=clean(req.body.email,254), skills=clean(req.body.skills,1000), resume_text=clean(req.body.resume_text,10000);
  const experience=Number(req.body.experience);
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||!Number.isFinite(experience)||experience<0||experience>60) return res.status(400).json({error:'Enter a name, valid email, and valid experience.'});
  const id=db.prepare('INSERT INTO candidates(name,email,skills,experience,resume_text) VALUES (?,?,?,?,?)').run(name,email,skills,experience,resume_text).lastInsertRowid;
  res.status(201).json(db.prepare('SELECT * FROM candidates WHERE id=?').get(id));
});
app.patch('/api/candidates/:id/status',(req,res)=>{
  const allowed=['New','Review','Interview','Rejected','Hired'];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:'Invalid status.'});
  const result=db.prepare('UPDATE candidates SET status=? WHERE id=?').run(req.body.status,req.params.id);
  if(!result.changes) return res.status(404).json({error:'Candidate not found.'});
  res.json(db.prepare('SELECT * FROM candidates WHERE id=?').get(req.params.id));
});
app.get('/api/jobs/:id/rank',(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Job not found.'});
  const ranking=db.prepare('SELECT * FROM candidates').all().map(c=>({...c,...rank(job,c)})).sort((a,b)=>b.score-a.score||a.id-b.id);
  res.json({job,ranking});
});
app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
app.listen(process.env.PORT||3000,()=>console.log(`Elevate HR running at http://localhost:${process.env.PORT||3000}`));
