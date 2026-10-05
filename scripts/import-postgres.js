const {createDatabase,initialize}=require('../db');
async function main(){
 let input='';for await(const chunk of process.stdin)input+=chunk;
 const data=JSON.parse(input);for(const key of ['jobs','candidates','interviews'])if(!Array.isArray(data[key]))throw new Error('Invalid export.');
 const db=createDatabase();let client;
 try{
  await initialize(db);client=await db.connect();await client.query('BEGIN');
  await client.query('LOCK TABLE jobs,candidates,interviews IN ACCESS EXCLUSIVE MODE');
  const existing=await client.query('SELECT (SELECT COUNT(*) FROM jobs)+(SELECT COUNT(*) FROM candidates)+(SELECT COUNT(*) FROM interviews) AS count');
  if(Number(existing.rows[0].count))throw new Error('Import requires an empty PostgreSQL database; no records were overwritten.');
  const columns={jobs:['id','title','description','skills','min_experience','created_at'],candidates:['id','name','email','skills','experience','resume_text','phone','notes','status','created_at'],interviews:['id','candidate_id','job_id','scheduled_at','format','notes','outcome','created_at']};
  for(const table of ['jobs','candidates','interviews']){
   const keys=columns[table];for(const row of data[table]){
    const values=keys.map(k=>row[k]??({phone:'',notes:'',skills:'',resume_text:'',status:'New',outcome:'Scheduled',format:'Video',experience:0,min_experience:0,created_at:new Date().toISOString()}[k]));
    await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,values);
   }
   await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT MAX(id) FROM ${table}),1),(SELECT COUNT(*)>0 FROM ${table}))`);
  }
  await client.query('COMMIT');console.log('Imported jobs, candidates and interviews. Original SQLite file was not changed.');
 }catch(e){if(client)await client.query('ROLLBACK');throw e;}finally{if(client)client.release();await db.end();}
}
main().catch(e=>{console.error('Import failed:',e.message.startsWith('Import requires')?e.message:e.code||e.name);process.exitCode=1;});
