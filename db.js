const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
function createDatabase(){
 if(!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env or your hosting environment.');
 return new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
}
async function initialize(db){await db.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));}
module.exports={createDatabase,initialize};
