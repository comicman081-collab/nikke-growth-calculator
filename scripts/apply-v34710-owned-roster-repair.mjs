#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const VERSION='34.7.10';
const rootPath='index.html';
const publicPath='public/index.html';
const runtimePath='scripts/v34710-owned-roster-repair.js';
const expectedIndexSha='ee56f0976565b2e6661431c7a51a1817a0d075e82c477d7cdbc66b97289a8a3a';
const must=(condition,label)=>{if(!condition)throw new Error(`V34.7.10 patch invariant failed: ${label}`);};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const replaceOnce=(text,from,to,label)=>{const count=text.split(from).length-1;must(count===1,`${label}: expected 1 anchor, found ${count}`);return text.replace(from,to);};

let html=fs.readFileSync(rootPath,'utf8');
const runtime=fs.readFileSync(runtimePath,'utf8').trim();
must(runtime.startsWith('<script id="v34710-owned-roster-repair">'),'runtime marker');
html=html.replace(/\n?<script id="v34710-owned-roster-repair">[\s\S]*?<\/script>\n?/g,'\n');
html=html.replaceAll('34.7.9',VERSION);
html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>니케 성장 계산기 V34.7.10 · 실연동 보유 로스터 5덱 복구</title>');
html=replaceOnce(html,'</body>',`${runtime}\n\n</body>`,'runtime insertion');
must((html.match(/id="v34710-owned-roster-repair"/g)||[]).length===1,'one V34.7.10 runtime');
must(html.includes('function dynamicCatalogRows(api)'),'dynamic catalog fix');
must(html.includes('__v34710DynamicOwned:true'),'dynamic getOwned fix');
must(html.includes('allowCubeDuplicates:true'),'linked cube assignment preservation');
must(html.includes('async function fillMissing('),'missing-team repair');
must(!html.includes('optimizer status insufficientRoster / team count 0 / slot count 0 / duplicate members'),'misleading zero-team text absent');
const digest=sha(html);
must(digest===expectedIndexSha,`canonical index SHA ${digest}`);
fs.writeFileSync(rootPath,html);
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync(publicPath,html);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version=VERSION;
pkg.scripts.check='node --check functions/api/blabla/sync.js && node tests/verify-deploy-autosync.mjs && node tests/verify-favorite-phase-v3477.mjs && node tests/verify-blabla-propagation-v3478.mjs && node tests/verify-five-deck-stability-v3479.mjs && node tests/verify-owned-roster-v34710.mjs && node tests/verify-inline-v34710.mjs';
pkg.scripts['check:browser']='node tests/verify-blabla-propagation-browser-v3478.mjs && node tests/verify-five-deck-stability-browser-v3479.mjs && node tests/verify-owned-roster-186-browser-v34710.mjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
lock.version=VERSION;
if(lock.packages?.[''])lock.packages[''].version=VERSION;
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');

let worker=fs.readFileSync('functions/api/blabla/sync.js','utf8');
worker=worker.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
fs.writeFileSync('functions/api/blabla/sync.js',worker);

const versionedTests=[
  'tests/verify-deploy-autosync.mjs',
  'tests/verify-favorite-phase-v3477.mjs',
  'tests/verify-blabla-propagation-v3478.mjs',
  'tests/verify-blabla-propagation-browser-v3478.mjs',
  'tests/verify-five-deck-stability-v3479.mjs',
  'tests/verify-five-deck-stability-browser-v3479.mjs',
];
for(const path of versionedTests){
  if(!fs.existsSync(path))continue;
  let text=fs.readFileSync(path,'utf8');
  text=text.replaceAll('34.7.9',VERSION).replaceAll('34\\.7\\.9','34\\.7\\.10');
  fs.writeFileSync(path,text);
}

const propagationBrowser='tests/verify-blabla-propagation-browser-v3478.mjs';
if(fs.existsSync(propagationBrowser)){
  let text=fs.readFileSync(propagationBrowser,'utf8');
  const old="const stable=NIKKEV3479StableFiveDeck.getLastResult();return{buildStatus:optimized?.status,candidates:stable?.diagnostics?.candidateCount||0,optStatus:optimized?.status,teams:optimized?.teams?.length||0,totalScore:optimized?.totalScore,unique:new Set(ids).size,ids,capture:captures.find(row=>row.growth?.favoriteItemPhase===3&&row.growth?.equipmentAttack>0)||captures[0]||null,elapsedMs,heartbeat,diagnostics:stable?.diagnostics,validation:stable?.validation,button:document.getElementById('nikke-kit-run')?.textContent,status:document.getElementById('nikke-kit-status')?.textContent,marker:document.getElementById('v3479-five-deck-stability')!==null};";
  const next="const repaired=NIKKEV34710OwnedRosterRepair.getLastResult();return{buildStatus:optimized?.status,candidates:repaired?.diagnostics?.candidateCount||0,optStatus:optimized?.status,teams:optimized?.teams?.length||0,totalScore:optimized?.totalScore,unique:new Set(ids).size,ids,capture:captures.find(row=>row.growth?.favoriteItemPhase===3&&row.growth?.equipmentAttack>0)||captures[0]||null,elapsedMs,heartbeat,diagnostics:repaired?.diagnostics,validation:repaired?.validation,button:document.getElementById('nikke-kit-run')?.textContent,status:document.getElementById('nikke-kit-status')?.textContent,marker:document.getElementById('v34710-owned-roster-repair')!==null};";
  must(text.includes(old),'propagation browser optimizer capture anchor');
  text=text.replace(old,next);
  const oldAssert="assert.match(fiveDeck.button,/V34\\.7\\.10 안정형/);assert.match(fiveDeck.status,/안정형 자체검증 PASS/);";
  const newAssert="assert.match(fiveDeck.button,/V34\\.7\\.10 5팀/);assert.match(fiveDeck.status,/5팀 25명/);assert.match(fiveDeck.status,/자체검증 PASS/);";
  must(text.includes(oldAssert),'propagation browser status assertion anchor');
  text=text.replace(oldAssert,newAssert);
  fs.writeFileSync(propagationBrowser,text);
}

for(const path of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(!fs.existsSync(path))continue;
  let text=fs.readFileSync(path,'utf8').replaceAll('34.7.9',VERSION);
  if(path==='GITHUB_DEPLOY_STATUS.md'&&!text.includes('186-character linked roster')){
    text += `\n## V34.7.10 linked-roster repair\n\n- Dynamic My Roster ownership keeps all 186 linked rows, including roster-only supplementals.\n- Precision and Simulation consume the same linked skills, favorite phase, cube, overload and observed equipment.\n- Five-deck auto composition uses only supported calculation profiles, preserves imported cube assignments, repairs a missing fifth team, and renders only 5 teams / 25 unique members.\n`;
  }
  fs.writeFileSync(path,text);
}

console.log(JSON.stringify({version:VERSION,indexBytes:Buffer.byteLength(html),indexSha256:digest,runtimeSha256:sha(runtime)},null,2));
