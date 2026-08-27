import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let executable=0;
for(let index=0;index<scripts.length;index+=1){
  const attrs=scripts[index][1]||'',body=scripts[index][2]||'';
  if(/\bsrc\s*=/.test(attrs)||!body.trim())continue;
  const type=attrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase()||'';
  if(type&&!['module','text/javascript','application/javascript'].includes(type))continue;
  const file=path.join(os.tmpdir(),`nikke-v34710-inline-${process.pid}-${index}.${type==='module'?'mjs':'js'}`);
  fs.writeFileSync(file,body);
  try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'});}catch(error){throw new Error(`inline script ${index} syntax failure: ${String(error.stderr||error.message)}`);}finally{fs.rmSync(file,{force:true});}
  executable+=1;
}
assert.ok(scripts.length>=100,`script tags ${scripts.length}`);
assert.ok(executable>=99,`executable scripts ${executable}`);
console.log(`V34.7.12 inline scripts: tags=${scripts.length}, executable=${executable}, failures=0`);
