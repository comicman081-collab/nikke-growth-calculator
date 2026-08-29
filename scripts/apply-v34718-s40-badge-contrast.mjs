#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.18';
const OLD_VERSION='34.7.17';
const STYLE_ID='v34718-s40-badge-contrast-style';
const SCRIPT_ID='v34718-ui-alignment-runtime';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');
const STYLE=`<style id="${STYLE_ID}">
/* V34.7.18 · S40 가독성, 정밀 출력 폭, 폼 글꼴을 한 규칙으로 정리한다. */
button,input,select,textarea{font-family:inherit}
textarea{
  width:100%;
  border:1px solid var(--line);
  background:rgba(255,255,255,.96);
  color:var(--ink);
  padding:10px 9px;
  border-radius:11px;
  font-weight:700;
  line-height:1.45;
}
textarea::placeholder{color:#8a93a3;opacity:1}
textarea:focus{outline:2px solid rgba(98,215,255,.7);border-color:var(--aqua)}
#precisionCycleOutput{grid-column:1/-1!important}
.v34718-five-deck-wait-note{
  margin:0 0 10px;
  padding:8px 10px;
  border:1px solid rgba(255,184,77,.58);
  border-radius:10px;
  background:rgba(255,184,77,.16);
  color:#4c3a1d;
  font-size:12px;
  font-weight:780;
  line-height:1.45;
}
#v3474DeployAutoPanel.v34718-deploy-auto-layout{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) max-content;
  gap:8px 16px;
  align-items:center;
}
#v3474DeployAutoPanel .v34718-deploy-auto-copy{min-width:0;line-height:1.55}
#v3474DeployAutoPanel.v34718-deploy-auto-layout>label{
  display:inline-flex!important;
  align-items:center;
  gap:7px;
  width:max-content;
  margin:0!important;
  white-space:nowrap;
}
#v3474DeployAutoPanel.v34718-deploy-auto-layout>label input{flex:0 0 auto;width:17px;height:17px;margin:0}
#v3474DeployAutoPanel.v34718-deploy-auto-layout>#v3474DeploySyncStatus{grid-column:1/-1;margin-top:0!important}
@media(max-width:720px){
  #v3474DeployAutoPanel.v34718-deploy-auto-layout{grid-template-columns:1fr}
  #v3474DeployAutoPanel.v34718-deploy-auto-layout>label,
  #v3474DeployAutoPanel.v34718-deploy-auto-layout>#v3474DeploySyncStatus{grid-column:1}
}
#v26RosterList .v26-roster-pick>.v3466-s40-fit{
  color:#f4fbff!important;
  background:#0b3a50!important;
  border-color:#62d7ff!important;
  font-size:10.5px!important;
  font-weight:850!important;
  line-height:1.35!important;
  text-shadow:0 1px 1px rgba(0,0,0,.28);
}
</style>`;
const SCRIPT=`<script id="${SCRIPT_ID}">
(function v34718UiAlignment(root){
  'use strict';
  const VERSION='34.7.18';
  function alignDeployAutoPanel(){
    const panel=root.document.getElementById('v3474DeployAutoPanel');
    if(!panel)return false;
    const label=panel.querySelector(':scope>label'),status=panel.querySelector(':scope>#v3474DeploySyncStatus');
    if(!label||!status)return false;
    if(!panel.querySelector(':scope>.v34718-deploy-auto-copy')){
      const copy=root.document.createElement('div');copy.className='v34718-deploy-auto-copy';
      while(panel.firstChild&&panel.firstChild!==label)copy.appendChild(panel.firstChild);
      panel.insertBefore(copy,label);
    }
    panel.classList.add('v34718-deploy-auto-layout');
    return true;
  }
  function ensureFiveDeckWaitNotice(){
    const panel=root.document.getElementById('nikke-kit-aware-optimizer-panel');
    if(!panel)return false;
    let note=panel.querySelector(':scope>.v34718-five-deck-wait-note');
    if(!note){
      note=root.document.createElement('aside');note.className='v34718-five-deck-wait-note';note.dataset.v34718FiveDeckWait='1';note.setAttribute('role','note');note.setAttribute('aria-label','5덱 자동 구성 계산 시간 안내');
      note.innerHTML='<b>※ 계산 시간 안내</b> · 5덱 자동 구성은 시스템 성능과 로스터 규모에 따라 약 30초에서 수분까지 걸릴 수 있습니다.';
      panel.insertBefore(note,panel.firstChild);
    }
    return true;
  }
  function verify(){
    const panel=root.document.getElementById('v3474DeployAutoPanel');
    const fiveDeckPanel=root.document.getElementById('nikke-kit-aware-optimizer-panel');
    const result={version:VERSION,precisionOutput:!!root.document.getElementById('precisionCycleOutput'),textareaFontInheritance:true,deployPanel:!panel||panel.classList.contains('v34718-deploy-auto-layout'),fiveDeckWaitNotice:!fiveDeckPanel||!!fiveDeckPanel.querySelector(':scope>.v34718-five-deck-wait-note')};
    result.pass=result.precisionOutput&&result.textareaFontInheritance&&result.deployPanel&&result.fiveDeckWaitNotice;
    root.NIKKEV34718UiAlignmentVerification=Object.freeze(result);return result;
  }
  function install(){alignDeployAutoPanel();ensureFiveDeckWaitNotice();verify();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  [80,250,600,1200,2500,5000,9000,14000].forEach(ms=>root.setTimeout(install,ms));
  root.NIKKEV34718UiAlignment=Object.freeze({version:VERSION,alignDeployAutoPanel,ensureFiveDeckWaitNotice,verify});
})(window);
</script>`;

function replaceStyle(html,id,block){
  const re=new RegExp(`<style id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id}`);
  return matches.length?html.replace(re,block):html.replace(/<\/head>/i,`${block}\n</head>`);
}

function replaceScript(html,id,block){
  const re=new RegExp(`<script id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id}`);
  return matches.length?html.replace(re,block):html.replace(/<\/body>/i,`${block}\n</body>`);
}

let html=read('index.html').replaceAll(OLD_VERSION,VERSION).replaceAll('V34.7.17','V34.7.18');
html=replaceStyle(html,STYLE_ID,STYLE);
html=html.replace('<div class="card half"><h2 class="panel-title">사이클·화력 출력</h2>','<div class="card" id="precisionCycleOutput"><h2 class="panel-title">사이클·화력 출력</h2>');
html=replaceScript(html,SCRIPT_ID,SCRIPT);
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>니케 성장 계산기 V34.7.18 · S40·정밀 출력 UI 보정</title>');
assert.equal((html.match(/id="precisionCycleOutput"/g)||[]).length,1,'one full-width precision cycle output');
write('index.html',html);
write('public/index.html',html);

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts['apply:v34718']='node scripts/apply-v34718-s40-badge-contrast.mjs';
const gate='node tests/verify-v34718-s40-badge-contrast.mjs';
if(!String(pkg.scripts.check||'').includes(gate))pkg.scripts.check=`${pkg.scripts.check} && ${gate}`;
write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));
lock.version=VERSION;if(lock.packages?.[''])lock.packages[''].version=VERSION;
write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

let worker=read('functions/api/blabla/sync.js');
worker=worker.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
write('functions/api/blabla/sync.js',worker);
for(const relative of ['scripts/v34710-owned-roster-repair.js','scripts/v34711-linked-roster-refresh.js','scripts/v34712-timeline-runtime.js','scripts/v34713-optimality-runtime.js']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll(OLD_VERSION,VERSION));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll(OLD_VERSION,VERSION).replaceAll('34\\.7\\.17','34\\.7\\.18'));
}
for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll(OLD_VERSION,VERSION));
}

assert.equal(read('index.html'),read('public/index.html'),'root/public mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.18';/,'bridge version');
console.log('V34.7.18 S40 contrast + precision/form/auto-sync layout repair: PASS');
