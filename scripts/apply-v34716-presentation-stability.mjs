#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.16';
const OLD_VERSION='34.7.15';
const GUARD_ID='v34716-presentation-stability-guard';
const PLACEMENT_ID='v34715-ui-placement-search';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

const GUARD=`<script id="${GUARD_ID}">
(function installV34716PresentationStability(root){
  'use strict';
  const VERSION='34.7.16';
  const TITLE='니케 성장 계산기 V34.7.16 · 로스터·탭 화면 안정화';
  const FOOTER='Nikke Damage Growth Calculator · V34.7.16 · 2026-08-29';
  const isApk=!!root.AndroidNative?.httpPostJson;
  const STATUS=isApk
    ?'<b>실행 상태:</b> 정상 · V34.7.16 APK · BlaBla 네이티브 공식 동기화 · 큐브·정밀·내 로스터·시뮬레이션·5덱 공통 저장'
    :'<b>실행 상태:</b> 정상 · V34.7.16 Web · BlaBla 동일 출처 브리지 · 큐브·정밀·내 로스터·시뮬레이션·5덱 공통 저장';
  function descriptorFor(node,property){
    let current=node;
    while(current){const descriptor=Object.getOwnPropertyDescriptor(current,property);if(descriptor?.get&&descriptor?.set)return descriptor;current=Object.getPrototypeOf(current);}
    return null;
  }
  function lockProperty(node,property,value){
    if(!node)return false;
    const descriptor=descriptorFor(node,property);if(!descriptor)return false;
    descriptor.set.call(node,value);
    try{
      Object.defineProperty(node,property,{configurable:false,enumerable:true,get(){return descriptor.get.call(node);},set(){if(descriptor.get.call(node)!==value)descriptor.set.call(node,value);}});
      return true;
    }catch(_){return false;}
  }
  const state={titleLocked:lockProperty(root.document,'title',TITLE),runtimeLocked:false,footerLocked:0,rosterApiGuard:false,rosterRenderAllowed:0,rosterRenderSkipped:0};
  const lockedFooters=new WeakSet();
  function publish(){
    root.NIKKEV34716PresentationStability=Object.freeze({version:VERSION,title:TITLE,titleLocked:state.titleLocked,runtimeLocked:state.runtimeLocked,footerLocked:state.footerLocked,rosterApiGuard:state.rosterApiGuard,rosterRenderAllowed:state.rosterRenderAllowed,rosterRenderSkipped:state.rosterRenderSkipped,localStorageOnly:true});
  }
  let lastRosterFingerprint='';
  function hashText(value){let hash=2166136261;for(let index=0;index<value.length;index++){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
  function rosterFingerprint(api){
    let stored='',catalog='';
    try{stored=String(root.localStorage?.getItem(String(api?.storageKey||''))||'');}catch(_){}
    try{catalog=(api?.catalog?.()||[]).map(row=>String(row?.id||'')).join('|');}catch(_){}
    const search=String(root.document.getElementById('v26RosterSearch')?.value||''),filter=String(root.document.getElementById('v26RosterFilter')?.value||'all');
    return hashText(stored+'\u0000'+catalog+'\u0000'+search+'\u0000'+filter);
  }
  function stabilizeRosterApi(api){
    if(!api||typeof api!=='object'||api.__v34716StableRender===true||typeof api.render!=='function')return api;
    const original=api.render.bind(api);
    const wrapper=Object.assign({},api,{__v34716StableRender:true,render(...args){
      const list=root.document.getElementById('v26RosterList'),fingerprint=rosterFingerprint(api);
      if(list?.childElementCount>0&&fingerprint===lastRosterFingerprint){state.rosterRenderSkipped++;publish();return false;}
      const result=original(...args);lastRosterFingerprint=rosterFingerprint(api);state.rosterRenderAllowed++;publish();return result;
    }});
    try{return Object.freeze(wrapper);}catch(_){return wrapper;}
  }
  let rosterApiValue=root.NIKKE_V26_ROSTER_API;
  try{
    Object.defineProperty(root,'NIKKE_V26_ROSTER_API',{configurable:false,enumerable:true,get(){return rosterApiValue;},set(value){rosterApiValue=stabilizeRosterApi(value);}});
    if(rosterApiValue)rosterApiValue=stabilizeRosterApi(rosterApiValue);
    state.rosterApiGuard=true;
  }catch(_){}
  function lockPresentationNodes(){
    if(!state.runtimeLocked)state.runtimeLocked=lockProperty(root.document.getElementById('runtimeStatus'),'innerHTML',STATUS);
    for(const node of root.document.querySelectorAll('.footer,.footer-version')){
      if(lockedFooters.has(node))continue;
      if(lockProperty(node,'textContent',FOOTER)){lockedFooters.add(node);state.footerLocked++;}
    }
    publish();
    return state.runtimeLocked&&state.footerLocked>0;
  }
  let parserObserver=null;
  if(!lockPresentationNodes()&&root.MutationObserver&&root.document.documentElement){
    parserObserver=new root.MutationObserver(()=>{if(lockPresentationNodes())parserObserver.disconnect();});
    parserObserver.observe(root.document.documentElement,{childList:true,subtree:true});
  }
  root.document.addEventListener('DOMContentLoaded',()=>{lockPresentationNodes();parserObserver?.disconnect();},{once:true});
  publish();
})(window);
</script>`;

const PLACEMENT_RUNTIME=`<script id="${PLACEMENT_ID}">
(function installV34716UiPlacementSearch(root){
  'use strict';
  const NOTICE_SELECTOR='[data-v34714-calculation-notice]';
  const watchedParents=new WeakSet();
  let queued=false;
  function normalizeSearchFields(){
    let count=0;
    for(const input of root.document.querySelectorAll('input[type="search"]')){
      if(input.placeholder!=='검색'){input.placeholder='검색';count++;}
      if(input.dataset.v34715Search!=='1')input.dataset.v34715Search='1';
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
  function schedule(){
    if(queued)return;
    queued=true;
    root.queueMicrotask(()=>{queued=false;mount();});
  }
  function watchNoticeParents(){
    for(const notice of root.document.querySelectorAll(NOTICE_SELECTOR)){
      const parent=notice.parentElement;
      if(!parent||watchedParents.has(parent))continue;
      watchedParents.add(parent);
      new root.MutationObserver(schedule).observe(parent,{childList:true});
    }
  }
  function mount(){
    normalizeSearchFields();
    moveCalculationNoticesToBottom();
    moveLegalToBottom();
    watchNoticeParents();
  }
  function observe(){
    mount();
    if(root.document.body)new root.MutationObserver(schedule).observe(root.document.body,{childList:true});
    [80,240,700,1600,3600,7000].forEach(ms=>root.setTimeout(mount,ms));
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  root.NIKKEV34715UiPlacementSearch=Object.freeze({version:'34.7.16',mount,normalizeSearchFields,moveCalculationNoticesToBottom,moveLegalToBottom,scopedObservers:true});
})(window);
</script>`;

function replaceScript(html,id,block){
  const re=new RegExp(`<script id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id}`);
  if(matches.length)return html.replace(re,block);
  return html.replace(/<\/body>/i,`${block}\n</body>`);
}

let html=read('index.html').replaceAll(OLD_VERSION,VERSION);
html=replaceScript(html,PLACEMENT_ID,PLACEMENT_RUNTIME);
html=html.replace(new RegExp(`<script id=["']${GUARD_ID}["'][^>]*>[\\s\\S]*?<\\/script>\\s*`,'g'),'');
const legacyRegistryHeartbeat="verify();brand();for(const ms of [0,150,350,700,1200,2200,4000,7000,12000,18000,26000,36000])setTimeout(()=>{verify();brand();},ms);const brandTimer=setInterval(()=>{verify();brand();},750);setTimeout(()=>clearInterval(brandTimer),45000);";
if(html.includes(legacyRegistryHeartbeat))html=html.replace(legacyRegistryHeartbeat,"verify();brand();root.__NIKKE_V34716_LEGACY_REGISTRY_HEARTBEAT_DISABLED__=true;");
assert.match(html,/__NIKKE_V34716_LEGACY_REGISTRY_HEARTBEAT_DISABLED__=true/,'legacy registry heartbeat disabled');
const title='<title>니케 성장 계산기 V34.7.16 · 로스터·탭 화면 안정화</title>';
assert.match(html,/<title>[\s\S]*?<\/title>/i,'document title anchor');
html=html.replace(/<title>[\s\S]*?<\/title>/i,`${title}\n${GUARD}`);
write('index.html',html);
write('public/index.html',html);

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts['apply:v34716']='node scripts/apply-v34716-presentation-stability.mjs';
const gate='node tests/verify-v34716-presentation-stability.mjs';
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
  write(relative,read(relative).replaceAll(OLD_VERSION,VERSION).replaceAll('34\\.7\\.15','34\\.7\\.16'));
}
for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(!fs.existsSync(path.join(ROOT,relative)))continue;
  let text=read(relative).replaceAll('V34.7.15 Bottom Notices & Search Clarity','V34.7.16 Presentation Stability');
  text=text.replaceAll(OLD_VERSION,VERSION);
  write(relative,text);
}

assert.equal(read('index.html'),read('public/index.html'),'root/public mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.16';/,'bridge version');
console.log('V34.7.16 presentation stability and scoped UI observers: PASS');
