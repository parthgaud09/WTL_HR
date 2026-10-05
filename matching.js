const clean=(v,max=3000)=>typeof v==='string'?v.trim().slice(0,max):'';
const tokens=s=>new Set(clean(s,10000).toLowerCase().split(/[^a-z0-9+#.]+/).filter(x=>x.length>1));
function rank(job,candidate){
 const required=[...tokens(job.skills)],found=tokens(candidate.skills+' '+candidate.resume_text);
 const matched=required.filter(s=>found.has(s)),missing=required.filter(s=>!found.has(s));
 const skills=required.length?matched.length/required.length:0;
 const experience=job.min_experience?Math.min(candidate.experience/job.min_experience,1):1;
 const terms=[...tokens(job.description)].filter(t=>t.length>3);
 const description=terms.length?terms.filter(t=>found.has(t)).length/terms.length:0;
 return {score:Math.round(70*skills+20*experience+10*description),matched,missing};
}
module.exports={clean,rank};
