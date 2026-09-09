import fs from "node:fs";
import path from "node:path";
const required=["package.json"];
const recommended=[".env.example","README.md","supabase"];
const root=process.cwd();
const missing=required.filter(x=>!fs.existsSync(path.join(root,x)));
const recommendations=recommended.filter(x=>!fs.existsSync(path.join(root,x)));
console.log(JSON.stringify({ok:missing.length===0,missing,recommendations},null,2));
if(missing.length)process.exitCode=1;
