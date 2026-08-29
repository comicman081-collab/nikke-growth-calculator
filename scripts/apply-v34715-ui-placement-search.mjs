#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.15';
const OLD_VERSION='34.7.14';
const STYLE_ID='v34715-ui-placement-search-style';
const SCRIPT_ID='v34715-ui-placement-search';
const TIMELINE_ID='v34712-unified-damage-timeline';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

const STYLE=`<style id="${STYLE_ID}">
/* V34.7.15 · 기존 카드 체계를 보존하면서 감사 결과·검색창의 대비와 위계를 통일한다. */
#precision .notice.v26-audit-ok,#precision .notice.v26-audit-warn{background:#edf3fb!important;color:#263b55!important;border:1px solid rgba(49,89,201,.20)!important;border-left:4px solid #55c8ef!important;box-shadow:none!important;font-size:11px!important;font-weight:650!important;line-height:1.5!important}
#precision .notice.v26-audit-warn{background:#f8f1e5!important;border-left-color:#d8a13a!important}
#precision .notice.v26-audit-ok b,#precision .notice.v26-audit-warn b{color:#18324f!important;font-weight:850!important}
input[type="search"]{color:#687386!important;font-weight:650!important}
input[type="search"]::placeholder{color:#8a94a6!important;opacity:1!important;font-weight:650!important}
.v34712-character-search::after{color:#7f8999!important}
</style>`;

const RUNTIME=`<script id="${SCRIPT_ID}">
(function installV34715UiPlacementSearch(root){
  'use strict';
  const NOTICE_SELECTOR='[data-v34714-calculation-notice]';
  let queued=false;
  function normalizeSearchFields(){
    let count=0;
    for(const input of root.document.querySelectorAll('input[type="search"]')){
      if(input.placeholder!=='검색'){input.placeholder='검색';count++;}
      input.dataset.v34715Search='1';
    }
    return count;
  }
  function moveCalculationNoticesToBottom(){
    let count=0;
    for(const notice of root.document.querySelectorAll(NOTICE_SELECTOR)){
      const parent=notice.parentElement;
      if(parent&&parent.lastElementChild!==notice){parent.appendChild(notice);count++;}
    }
    return count;
  }
  function moveLegalToBottom(){
    const legal=root.document.getElementById('legalDisclaimer');
    if(!legal)return false;
    const parent=legal.parentElement;
    if(parent&&parent.lastElementChild!==legal){parent.appendChild(legal);return true;}
    return false;
  }
  function mount(){
    normalizeSearchFields();
    moveCalculationNoticesToBottom();
    moveLegalToBottom();
  }
  function schedule(){
    if(queued)return;
    queued=true;
    root.queueMicrotask(()=>{queued=false;mount();});
  }
  function observe(){
    mount();
    const observer=new root.MutationObserver(schedule);
    observer.observe(root.document.documentElement,{childList:true,subtree:true});
  }
  function releaseBrand(){
    root.document.title='니케 성장 계산기 V34.7.15 · 하단 고지·검색 UI 정리';
    for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent='Nikke Damage Growth Calculator · V34.7.15 · 2026-08-29';
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  releaseBrand();root.setTimeout(releaseBrand,120);root.setTimeout(releaseBrand,900);
  root.NIKKEV34715UiPlacementSearch=Object.freeze({version:'34.7.15',mount,normalizeSearchFields,moveCalculationNoticesToBottom,moveLegalToBottom});
})(window);
</script>`;

function replaceOrAppend(html,tag,id,block){
  const re=new RegExp(`<${tag} id=["']${id}["'][^>]*>[\\s\\S]*?<\\/${tag}>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id}`);
  return matches.length?html.replace(re,block):html.replace(/<\/body>/i,`${block}\n</body>`);
}

let html=read('index.html').replaceAll(OLD_VERSION,VERSION);
let timeline=read('scripts/v34712-timeline-runtime.js').replaceAll(OLD_VERSION,VERSION);
write('scripts/v34712-timeline-runtime.js',timeline);
const timelineBlock=`<script id="${TIMELINE_ID}">\n${timeline}\n</script>`;
html=replaceOrAppend(html,'script',TIMELINE_ID,timelineBlock);
html=replaceOrAppend(html,'style',STYLE_ID,STYLE);
html=replaceOrAppend(html,'script',SCRIPT_ID,RUNTIME);
html=html.replace(/니케 성장 계산기 V34\.7\.15[^<]*/,'니케 성장 계산기 V34.7.15 · 하단 고지·검색 UI 정리');
write('index.html',html);
write('public/index.html',html);

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts['apply:v34715']='node scripts/apply-v34715-ui-placement-search.mjs';
const gate='node tests/verify-v34715-ui-placement-search.mjs';
if(!String(pkg.scripts.check||'').includes(gate))pkg.scripts.check=`${pkg.scripts.check} && ${gate}`;
write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));
lock.version=VERSION;
if(lock.packages?.[''])lock.packages[''].version=VERSION;
write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

let worker=read('functions/api/blabla/sync.js');
worker=worker.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
write('functions/api/blabla/sync.js',worker);
for(const relative of ['scripts/v34710-owned-roster-repair.js','scripts/v34711-linked-roster-refresh.js','scripts/v34713-optimality-runtime.js']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll(OLD_VERSION,VERSION));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll(OLD_VERSION,VERSION).replaceAll('34\\.7\\.14','34\\.7\\.15'));
}
for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(!fs.existsSync(path.join(ROOT,relative)))continue;
  let text=read(relative).replaceAll('V34.7.14 Simulation Notice & Surface Theme','V34.7.15 Bottom Notices & Search Clarity');
  text=text.replaceAll(OLD_VERSION,VERSION);
  write(relative,text);
}

assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.15';/,'bridge version');
console.log('V34.7.15 bottom notices, audit surface, and search clarity: PASS');
