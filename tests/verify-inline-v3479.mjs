import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let checked=0;const failures=[];
for(let i=0;i<scripts.length;i++){
  const attrs=scripts[i][1]||'',body=scripts[i][2]||'';
  if(/\bsrc\s*=/.test(attrs)||!body.trim())continue;
  const type=attrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase()||'';
  if(type&&!['module','text/javascript','application/javascript'].includes(type))continue;
  const file=path.join(os.tmpdir(),`v3479-inline-${i}.${type==='module'?'mjs':'js'}`);fs.writeFileSync(file,body);
  try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'});checked++;}catch(error){failures.push({index:i,error:String(error.stderr||error.message)});}
}
const result={version:'34.7.9',scriptTags:scripts.length,checked,failures,pass:failures.length===0};
fs.writeFileSync('V3479_INLINE_RESULTS.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);
