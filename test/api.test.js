const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server');
test('Protects workspace and validates writes before querying',async()=>{
 const priorPassword=process.env.ADMIN_PASSWORD,priorUser=process.env.ADMIN_USERNAME;
 process.env.ADMIN_USERNAME='admin';process.env.ADMIN_PASSWORD='test-password-123456';
 let queries=0;
 const db={query:async(sql)=>{queries++;if(sql==='SELECT 1')return{rows:[{value:1}]};return {rows:[],rowCount:0}}};
 const server=createApp(db).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const authorization='Basic '+Buffer.from('admin:test-password-123456').toString('base64');
 try{
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/api/candidates')).status,401);
  assert.equal((await fetch(base+'/api/candidates',{headers:{authorization}})).status,200);
  const before=queries;
  assert.equal((await fetch(base+'/api/candidates',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify({name:'A',email:'invalid',experience:0})})).status,400);
  assert.equal((await fetch(base+'/api/candidates/1/status',{method:'PATCH',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify({status:'Anything'})})).status,400);
  assert.equal((await fetch(base+'/api/candidates/abc',{method:'PATCH',headers:{authorization,'Content-Type':'application/json'},body:'{}'})).status,400);
  assert.equal(queries,before);
  assert.equal((await fetch(base+'/api/candidates',{method:'POST',headers:{authorization,'Content-Type':'text/plain'},body:'{}'})).status,415);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  if(priorPassword===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=priorPassword;
  if(priorUser===undefined)delete process.env.ADMIN_USERNAME;else process.env.ADMIN_USERNAME=priorUser;
 }
});
