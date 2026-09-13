const fs=require("node:fs/promises");
async function uploadRender(s,b,p,f,m){const x=await fs.readFile(f);const {error}=await s.storage.from(b).upload(p,x,{contentType:m,upsert:true});if(error)throw error;return p}
module.exports={uploadRender};
