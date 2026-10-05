const test=require('node:test');
const assert=require('node:assert/strict');
const {rank}=require('../matching');
test('Ranks relevant skills and experience above unrelated profiles',()=>{
 const job={skills:'React, JavaScript',description:'Develop applications',min_experience:2};
 const strong=rank(job,{skills:'React, JavaScript',resume_text:'Develop applications',experience:2});
 const weak=rank(job,{skills:'Excel',resume_text:'Office work',experience:0});
 assert.equal(strong.score,100);assert.equal(weak.score,0);assert.deepEqual(weak.missing,['react','javascript']);
});
test('Deduplicates skills and treats case consistently',()=>{
 const result=rank({skills:'React, react',description:'',min_experience:0},{skills:'REACT',resume_text:'',experience:0});
 assert.equal(result.score,90);assert.deepEqual(result.matched,['react']);
});
