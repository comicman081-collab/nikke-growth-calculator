import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist-cloudflare');
const HTML=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
const VERSION='34.7.19';
const PROFILE='https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=';

function parseJsonLiteral(regex,label){const match=HTML.match(regex);assert.ok(match,`${label} missing`);return JSON.parse(match[1]);}
const nameCodeMap=parseJsonLiteral(/const V3476_NAMECODE_TO_APP_ID=Object\.freeze\((\{[^\n]+\})\);/,'nameCode map');
const favoriteRecords=parseJsonLiteral(/<script id="v3477-favorite-registry">[\s\S]*?const records=(\[[\s\S]*?\]);\r?\nconst freezeDeep=/,'favorite registry');
const tidById=Object.fromEntries(favoriteRecords.map(row=>[row.id,String(row.tid)]));
const favoriteTable=Object.fromEntries(favoriteRecords.map(row=>[String(row.tid),{rare:'SSR',type:'Favorite',name:row.favoriteItemName||row.name}]));
const masterRows=Object.entries(nameCodeMap).map(([code,id],index)=>({
  name_code:Number(code),name_localkey:id,resource_id:1000+index,original_rare:'SSR',class:id==='sugarTreasure'?'Attacker':'Supporter',element_id:'Fire',use_burst_skill:1,corporation:'TETRA'
}));

const effectDefs=[
  [9101,'StatAtk',3120],[9102,'IncElementDmg',4560],[9103,'StatAmmoLoad',8880],
  [9104,'StatCritical',440],[9105,'StatCriticalDamage',990],[9106,'StatAccuracyCircle',330],
  [9107,'StatDef',120],[9108,'StatAtk',100],[9109,'IncElementDmg',100],
  [9110,'StatAmmoLoad',100],[9111,'StatCritical',100],[9112,'StatCriticalDamage',100]
];
const stateEffects=effectDefs.map(([id,function_type,function_value])=>({id,function_details:[{function_type,function_value}]}));
const codes=Object.keys(nameCodeMap).sort((a,b)=>Number(a)-Number(b));
const summaries=[];
const details=[];
for(const [index,code] of codes.entries()){
  const id=nameCodeMap[code],isSugar=id==='sugarTreasure',tid=tidById[id]||'0';
  summaries.push({name_code:Number(code),lv:isSugar?450:420+(index%31),combat:700000+index*111,arena_combat:600000+index*99,grade:3,core:isSugar?5:index%6});
  const detail={name_code:Number(code),skill1_lv:isSugar?2:10,skill2_lv:isSugar?7:10,ulti_skill_lv:isSugar?9:10,attractive_lv:isSugar?40:30,favorite_item_tid:Number(tid),favorite_item_lv:tid!=='0'?2:0,harmony_cube_tid:isSugar?1000317:0,harmony_cube_lv:isSugar?15:0};
  for(const slot of ['head','torso','arm','leg']){
    detail[`${slot}_equip_tid`]=0;detail[`${slot}_equip_tier`]=0;detail[`${slot}_equip_lv`]=0;detail[`${slot}_equip_corporation_type`]=0;
    for(let n=1;n<=3;n++)detail[`${slot}_equip_option${n}_id`]=0;
  }
  if(isSugar){
    const slots=['head','torso','arm','leg'];
    let option=9101;
    for(const slot of slots){detail[`${slot}_equip_tid`]=900000+option;detail[`${slot}_equip_tier`]=9;detail[`${slot}_equip_lv`]=5;for(let n=1;n<=3;n++)detail[`${slot}_equip_option${n}_id`]=option++;}
  }
  details.push(detail);
}
// Reproduce the user's 193-character linked roster. The extra rows are current-master
// supplementals: they must be retained in My Roster even when no audited damage model exists.
for(let index=codes.length;index<193;index++){
  const code=6000+index;
  masterRows.push({name_code:code,name_localkey:`Linked Supplemental ${index+1}`,resource_id:9000+index,original_rare:'SSR',class:index%3===0?'Attacker':index%3===1?'Supporter':'Defender',element_id:['Fire','Water','Wind','Electronic','Iron'][index%5],use_burst_skill:(index%3)+1,corporation:['ELYSION','MISSILIS','TETRA'][index%3]});
  summaries.push({name_code:code,lv:400+(index%51),combat:500000+index*73,arena_combat:450000+index*61,grade:3,core:index%4});
  const detail={name_code:code,skill1_lv:7+(index%4),skill2_lv:7+(index%4),ulti_skill_lv:7+(index%4),attractive_lv:30,favorite_item_tid:0,favorite_item_lv:0,harmony_cube_tid:0,harmony_cube_lv:0};
  for(const slot of ['head','torso','arm','leg']){detail[`${slot}_equip_tid`]=0;detail[`${slot}_equip_tier`]=0;detail[`${slot}_equip_lv`]=0;detail[`${slot}_equip_corporation_type`]=0;for(let n=1;n<=3;n++)detail[`${slot}_equip_option${n}_id`]=0;}
  details.push(detail);
}
const bridgePayload={ok:true,version:VERSION,observedAt:'2026-08-27T00:00:00.000Z',profile:{intlGameId:'29080',maskedOpenId:'1738…6007'},areas:[{area:84,characters:summaries,details,stateEffects}],diagnostics:{attempts:[{area:84,code:0,count:summaries.length,message:''}]}};

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.m4a':'audio/mp4','.txt':'text/plain; charset=utf-8'};
function readBody(req){return new Promise((resolve,reject)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject);});}
async function startServer(){
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/',`http://${req.headers.host}`);
      if(url.pathname==='/__v3478_shell'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html><head></head><body></body></html>');return;}
      if(url.pathname==='/api/blabla/sync'){
        res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');
        if(req.method==='GET'){res.end(JSON.stringify({ok:true,version:VERSION,configured:true,games:['29080'],worker:'nikke-growth-calculator'}));return;}
        if(req.method==='POST'){const body=JSON.parse(await readBody(req)||'{}');assert.ok(body.profileUrl,'bridge profileUrl');res.end(JSON.stringify(bridgePayload));return;}
        res.statusCode=405;res.end(JSON.stringify({ok:false,error:'method'}));return;
      }
      const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      const file=path.resolve(DIST,requested);
      if(!file.startsWith(DIST+path.sep)&&file!==path.join(DIST,'index.html')){res.statusCode=403;res.end('forbidden');return;}
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end('not found');return;}
      res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
    }catch(error){res.statusCode=500;res.end(String(error.stack||error));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return{server,port:server.address().port};
}
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
function chromeBinary(){
  const local=process.env.LOCALAPPDATA||'';
  for(const candidate of [process.env.CHROME_BIN,process.env.GOOGLE_CHROME_BIN,local&&path.join(local,'Google','Chrome','Application','chrome.exe'),local&&path.join(local,'Microsoft','Edge','Application','msedge.exe'),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'])if(candidate&&fs.existsSync(candidate))return candidate;
  throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN.');
}
async function waitForJson(url,timeout=30000){const started=Date.now();let last;while(Date.now()-started<timeout){try{const r=await fetch(url);if(r.ok)return await r.json();last=`HTTP ${r.status}`;}catch(error){last=error;}await new Promise(r=>setTimeout(r,100));}throw new Error(`timeout waiting for ${url}: ${last}`);}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map();}
  async connect(){this.ws=new WebSocket(this.url);await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});this.ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const pending=this.pending.get(message.id);if(pending){this.pending.delete(message.id);message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);}}else if(message.method){for(const listener of this.listeners.get(message.method)||[])listener(message.params);}});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  on(method,listener){const list=this.listeners.get(method)||[];list.push(listener);this.listeners.set(method,list);}
  close(){try{this.ws.close();}catch(_){}}
}
async function evaluate(cdp,expression,timeout=180000){
  let timer;
  try{
    const result=await Promise.race([cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`evaluation timeout after ${timeout}ms`)),timeout);})]);
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'browser evaluation failed');
    return result.result?.value;
  }finally{if(timer)clearTimeout(timer);}
}
async function waitFor(cdp,expression,timeout=60000){const started=Date.now();let last;while(Date.now()-started<timeout){last=await evaluate(cdp,`Boolean(${expression})`,10000);if(last)return;await new Promise(r=>setTimeout(r,100));}throw new Error(`browser condition timeout: ${expression}; last=${last}`);}

console.error('[stage] server-start');
const {server,port}=await startServer();
console.error('[stage] server-ready',port);
const debugPort=await freePort();
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--enable-precise-memory-info','--renderer-process-limit=1','--js-flags=--max-old-space-size=192',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${path.join(ROOT,'.tmp-chrome-v34710')}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
let stderr='';chrome.stderr.on('data',chunk=>{stderr+=chunk.toString();});
let cdp;
try{
  console.error('[stage] chrome-wait');
  const pages=await waitForJson(`http://127.0.0.1:${debugPort}/json`,30000);const page=pages.find(item=>item.type==='page')||pages[0];assert.ok(page?.webSocketDebuggerUrl,'CDP page target');
  cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.connect();await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('HeapProfiler.enable');await cdp.send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true});
  const init=`(()=>{const memoryStorage=()=>{const values=new Map();return{getItem:key=>values.has(String(key))?values.get(String(key)):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),key:index=>[...values.keys()][index]??null,get length(){return values.size;}}};try{localStorage.clear();sessionStorage.clear();}catch(_){try{Object.defineProperty(window,'localStorage',{value:memoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:memoryStorage(),configurable:true});}catch(__){}}localStorage.setItem('nikke_v3474_deploy_blablalink_autosync','0');Object.defineProperty(navigator,'deviceMemory',{value:4,configurable:true});window.NIKKE_BLABLA_PROXY='https://v3479.test/api/blabla';window.__NIKKE_V34610_ENIKK_TABLES__=${JSON.stringify({options:{},cubes:{},favorites:favoriteTable})};const original=window.fetch.bind(window);window.fetch=async function(input,requestInit={}){const url=String(typeof input==='string'?input:input?.url||input);if(url.endsWith('/api/blabla/sync')){const method=String(requestInit?.method||'GET').toUpperCase();return new Response(method==='POST'?${JSON.stringify(JSON.stringify(bridgePayload))}:${JSON.stringify(JSON.stringify({ok:true,version:VERSION,configured:true,games:['29080'],worker:'nikke-growth-calculator'}))},{status:200,headers:{'content-type':'application/json'}});}if(url==='https://enikk.app/api/graphql'){return new Response(${JSON.stringify(JSON.stringify({data:{characters:masterRows}}))},{status:200,headers:{'content-type':'application/json'}});}return original(input,requestInit);};})();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:init});
  await cdp.send('Page.navigate',{url:'data:text/html,<html><head></head><body></body></html>'});
  await waitFor(cdp,"document.readyState==='complete'",30000);
  const frameTree=await cdp.send('Page.getFrameTree');
  const frameId=frameTree.frameTree?.frame?.id;
  assert.ok(frameId,'CDP main frame');
  await cdp.send('Page.setDocumentContent',{frameId,html:HTML});
  console.error('[stage] page-content-set');
  await waitFor(cdp,'window.NIKKEV3472BlaPublicSync&&window.NIKKEV34610External&&window.NIKKE_V26_ROSTER_API&&window.NIKKESinglePartyTimelineSimulator&&window.NIKKE_V26_OPTIMIZER_API&&window.NIKKEV3478BlaPropagation&&window.NIKKEV34710OwnedRosterRepair&&window.NIKKEV34711LinkedRosterRefresh&&window.NIKKEV34712UnifiedTimeline',90000);

  console.error('[stage] app-ready');
  const searchAudit=await evaluate(cdp,`(()=>{const wrap=document.querySelector('.v34712-character-search[data-search-for="precisionChar"]'),input=wrap?.querySelector('.v34712-character-search-input'),select=document.getElementById('precisionChar');if(!input||!select)return{present:false};input.focus();input.value='Sugar';input.dispatchEvent(new Event('input',{bubbles:true}));const button=wrap.querySelector('.v34712-character-search-option[data-value="sugarTreasure"]'),resultCount=wrap.querySelectorAll('.v34712-character-search-option').length;button?.click();return{present:true,resultCount,selected:select.value,label:input.value,placeholder:input.placeholder,closed:wrap.querySelector('.v34712-character-search-menu')?.hidden===true,totalSearches:document.querySelectorAll('.v34712-character-search').length};})()`);
  assert.equal(searchAudit.present,true,'Precision character search exists');assert.ok(searchAudit.resultCount>=1,'Precision character search returns a result');assert.equal(searchAudit.selected,'sugarTreasure','search result selects Sugar favorite-item profile');assert.equal(searchAudit.label,'','search field clears redundant selected label');assert.equal(searchAudit.placeholder,'검색','search field uses one neutral placeholder');assert.equal(searchAudit.closed,true,'search menu closes after selection');assert.ok(searchAudit.totalSearches>=8,`character search coverage ${searchAudit.totalSearches}`);
  const syncResult=await evaluate(cdp,`(async()=>{document.getElementById('v34610BlaUrl').value=${JSON.stringify(PROFILE)};document.getElementById('v34610BlaServer').value='GLOBAL';const result=await NIKKEV3472BlaPublicSync.sync();await new Promise(r=>setTimeout(r,100));NIKKEV3475SyncPropagation.refreshPrecision();const linked=NIKKEV34711LinkedRosterRefresh,policy=linked.verify(),snap=linked.getSnapshot(),appCatalog=linked.appCatalog(),eligible=[...linked.calculationEligibleIds()],ids=value=>[...new Set(value.map(String).filter(Boolean))].sort(),legacyIds=ids((typeof characters!=='undefined'&&Array.isArray(characters)?characters:[]).map(row=>row?.[0])),optimizerCatalog=Array.from(NIKKE_V26_7_CHARACTER_CATALOG||[]),optimizerCatalogIds=ids(optimizerCatalog.map(row=>row?.id)),precisionIds=ids(Object.keys(typeof weaponPresets==='undefined'?{}:weaponPresets).filter(id=>typeof skillProfilesV21!=='undefined'&&skillProfilesV21[id])),dataIds=ids(['burst1','burst2','burst3'].flatMap(group=>(NIKKE_V26_DATA?.[group]?.characters||[]).map(row=>row?.id))),rosterIds=ids(appCatalog.map(row=>row.id)),optimizerCatalogMeta=optimizerCatalog.map(row=>({id:row.id,name:row.name||'',origin:row.origin||'',modelVersion:row.modelVersion||'',sourceConfidence:row.sourceConfidence||row.optimizer?.sourceConfidence||'',normal:Number(row.skillProfile?.normal),hasPreset:!!row.weaponPreset,hasSkillProfile:!!row.skillProfile,calculationSupported:row.calculationSupported!==false}));return{imported:result.out.imported,unmatched:result.out.unmatched,received:result.out.received,area:result.area.area,status:document.getElementById('v34610BlaStatus')?.textContent,policy,snapshotRows:snap?.characters?.length||0,appCatalog:appCatalog.map(row=>({id:row.id,source:row.source||'',calculationSupported:row.calculationSupported!==false})),eligible,registryAudit:{legacyIds,optimizerCatalogIds,precisionIds,dataIds,rosterIds,optimizerCatalogMeta}};})()`);
  console.error('[stage] sync-done',syncResult);
  assert.equal(syncResult.area,84);assert.equal(syncResult.received,193);assert.equal(syncResult.snapshotRows,193,'all linked rows must remain in raw snapshot');assert.ok(syncResult.imported>=25&&syncResult.imported<=syncResult.policy.registered,`imported ${syncResult.imported} / registered ${syncResult.policy.registered}`);assert.equal(syncResult.unmatched.length,193-syncResult.imported,'non-app rows stay snapshot-only');assert.equal(syncResult.policy.hardcoded100,false);assert.equal(syncResult.policy.dynamicRegistration,true);

  console.error('[stage] refresh-policy-start');
  const refreshPolicy=await evaluate(cdp,`(async()=>{await new Promise(r=>setTimeout(r,1800));const api=NIKKEV34711LinkedRosterRefresh;const thursdayNoon=Date.UTC(2026,7,27,3,0,0);const thursdayNight=Date.UTC(2026,7,27,11,0,0);const slotNoon=api.latestDueSlot(thursdayNoon),nextNoon=api.nextSlot(thursdayNoon),slotNight=api.latestDueSlot(thursdayNight),nextNight=api.nextSlot(thursdayNight);const manual=await api.manualRefresh();await new Promise(r=>setTimeout(r,50));const snap=api.getSnapshot(),state=api.getRefreshState();return{button:!!document.getElementById('v34711RefreshNow'),panel:!!document.getElementById('v34711RefreshPanel'),slotNoon:{hour:slotNoon.hour,next:nextNoon.hour},slotNight:{hour:slotNight.hour,next:nextNight.hour},manualReceived:manual?.out?.received??manual?.received??0,snapshotRows:snap?.characters?.length||0,lastSuccess:state?.lastSuccess||'',verification:api.verify()};})()`);
  console.error('[stage] refresh-policy-done',refreshPolicy);
  assert.equal(refreshPolicy.button,true);assert.equal(refreshPolicy.panel,true);assert.deepEqual(refreshPolicy.slotNoon,{hour:11,next:19});assert.deepEqual(refreshPolicy.slotNight,{hour:19,next:11});assert.equal(refreshPolicy.snapshotRows,193);assert.ok(refreshPolicy.lastSuccess);assert.equal(refreshPolicy.verification.dynamicRegistration,true);assert.equal(refreshPolicy.verification.hardcoded100,false);

  console.error('[stage] roster-start');
  const rosterState=await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.apply('sugarTreasure',{navigate:false,recalculate:false});NIKKE_V26_ROSTER_API.render();const pick=document.querySelector('#v26RosterList .v26-roster-pick[data-character-id="sugarTreasure"]'),central=NIKKE_V26_ROSTER_API.load().characters.sugarTreasure;return{central,rowOwned:pick?.closest('.v26-roster-row')?.classList.contains('is-owned'),rowText:pick?.textContent||'',rowAction:pick?.dataset.rosterAction||'',rowTag:pick?.tagName,countText:document.getElementById('v26RosterCount')?.textContent||'',renderedRows:document.querySelectorAll('#v26RosterList .v26-roster-row').length,renderedOwned:document.querySelectorAll('#v26RosterList .v26-roster-row.is-owned').length};})()`);
  console.error('[stage] roster-done');
  const central=rosterState.central;assert.equal(rosterState.rowOwned,true);assert.equal(rosterState.renderedRows,syncResult.policy.registered);assert.equal(rosterState.renderedOwned,syncResult.imported);assert.ok(rosterState.countText.includes(`보유 ${syncResult.imported}/${syncResult.policy.registered}명`));assert.equal(rosterState.rowTag,'DIV');assert.equal(rosterState.rowAction,'');assert.match(rosterState.rowText,/슈가/);assert.match(rosterState.rowText,/ATK 32\.2%/);
  assert.equal(central.level,450);assert.equal(central.limitBreak,3);assert.equal(central.coreLevel,5);assert.equal(central.bond,40);assert.equal(central.favoriteItemPhase,3);assert.deepEqual(central.skills,{skill1:2,skill2:7,burst:9});assert.equal(central.equipmentObservedSlots,4);assert.ok(central.equipmentAttack>0);assert.ok(central.equipmentHp>0);assert.ok(central.equipmentDefense>0);assert.equal(central.overloadTotals.atk,32.2);assert.equal(central.overloadTotals.element,46.6);assert.equal(central.overloadTotals.maxAmmo,89.8);

  console.error('[stage] precision-start');
  const precision=await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.apply('sugarTreasure');precisionCalc();const s=window.__precisionSnapshot||{};return{selected:document.getElementById('precisionChar').value,skills:[Number(document.getElementById('precisionSkill1').value),Number(document.getElementById('precisionSkill2').value),Number(document.getElementById('precisionBurstSkill').value)],cube:document.getElementById('precisionCube').value,overload:{atk:Number(document.getElementById('precisionAtk').value),element:Number(document.getElementById('precisionElement').value),ammo:Number(document.getElementById('maxAmmo').value)},context:window.__v26TeamGrowthContext.byId.sugarTreasure,total:s.totals?.combo||s.totals?.base||0,diagnostic:NIKKEV3478BlaPropagation.verify('sugarTreasure')};})()`);
  console.error('[stage] precision-done',precision.total);
  assert.equal(precision.selected,'sugarTreasure');assert.deepEqual(precision.skills,[2,7,9]);assert.equal(precision.cube,'diffusion');assert.equal(precision.overload.atk,32.2);assert.equal(precision.context.favoriteItemPhase,3);assert.equal(precision.context.equipmentAttack,central.equipmentAttack);assert.equal(precision.context.equipmentHp,central.equipmentHp);assert.equal(precision.context.equipmentDefense,central.equipmentDefense);assert.ok(precision.total>0);assert.equal(precision.diagnostic.pass,true,JSON.stringify(precision.diagnostic.checks));

  console.error('[stage] damage-surfaces-inputs-start');
  const damageInputs=await evaluate(cdp,`(async()=>{
    const timeline=NIKKEV34712UnifiedTimeline,rosterApi=NIKKE_V26_ROSTER_API,phaseApi=NIKKE_V3477_FAVORITE_PHASE_API;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const finitePositive=value=>Number.isFinite(Number(value))&&Number(value)>0;
    const openAndRead=async details=>{const defaultClosed=!details.open;details.open=true;details.dispatchEvent(new Event('toggle'));await wait(30);const error=details.querySelector('.v34712-error');if(error)throw new Error(error.textContent);const out={defaultClosed,audit:details.dataset.auditPass==='true',total:Number(details.dataset.total||0),rows:details.querySelectorAll('.v34712-damage-row').length};details.open=false;details.dispatchEvent(new Event('toggle'));return out;};
    const originalRoster=rosterApi.load(),favoriteFixture=JSON.parse(JSON.stringify(originalRoster));
    const favoriteIds=Object.keys(NIKKE_V3477_FAVORITE_REGISTRY||{}).sort((a,b)=>a==='sugarTreasure'?-1:b==='sugarTreasure'?1:a.localeCompare(b));
    for(const id of favoriteIds){
      const row=favoriteFixture.characters[id];if(!row)throw new Error('favorite roster row missing: '+id);
      row.owned=true;row.level=Math.max(400,Number(row.level)||0);row.limitBreak=3;row.coreLevel=3;row.bond=40;row.skills={skill1:10,skill2:10,burst:10};row.favoriteItemPhase=3;row.measuredCoeff=Math.max(1,Number(row.measuredCoeff)||0);
    }
    const favoriteImport=rosterApi.import(favoriteFixture,'replace');if(!favoriteImport?.ok)throw new Error('favorite fixture import failed: '+(favoriteImport?.errors||[]).join('; '));
    const favoriteRows=[];
    for(const id of favoriteIds){
      rosterApi.apply(id);NIKKEV3475SyncPropagation.refreshPrecision();precisionCalc();
      const snapshot=window.__precisionSnapshot,central=rosterApi.load().characters[id],context=window.__v26TeamGrowthContext?.byId?.[id],resolution=phaseApi.resolve(id,central?.favoriteItemPhase,central?.skills);
      soloRaidRefresh(true);const raid=window.NIKKESoloRaidLastResult||null;
      const inputIds=['maxAmmo','chargeSpeed','chargeDamage','precisionAtk','precisionElement','precisionCritRate','precisionCritDamage','duration','coreRatio','skillShare','burstRatio','ownBurstUsage','conditionUptime','targetCount','rangeRatio','manualRatio','otherAtkBuff','otherDamageBuff','hpAtkEquivalent','measuredCoeff'];const inputs=Object.fromEntries(inputIds.map(key=>[key,document.getElementById(key)?.value]));
      favoriteRows.push({id,selected:snapshot?.id,phase:Number(central?.favoriteItemPhase),contextPhase:Number(context?.favoriteItemPhase),resolutionPhase:Number(resolution?.phase),precisionTotal:Number(snapshot?.totals?.combo),totals:snapshot?.totals||null,breakdown:snapshot?.breakdown||null,burstTimeline:snapshot?.burstTimeline||null,components:snapshot?.components||null,weaponCycle:snapshot?.weaponCycle||null,raidTotal:Number(raid?.combo?.total),raidSnapshotId:raid?.snapshot?.id||'',precisionFinite:finitePositive(snapshot?.totals?.combo),raidFinite:finitePositive(raid?.combo?.total),inputs,preset:weaponPresets[id]||null,profile:skillProfilesV21[id]||null});
    }
    const rosterRestore=rosterApi.import(originalRoster,'replace');if(!rosterRestore?.ok)throw new Error('linked roster restore failed: '+(rosterRestore?.errors||[]).join('; '));await wait(60);
    rosterApi.apply('sugarTreasure');NIKKEV3475SyncPropagation.refreshPrecision();precisionCalc();
    const comboSelect=document.getElementById('precisionBufferCombo'),originalCombo=comboSelect.value,comboRows=[];
    for(const option of [...comboSelect.options]){
      comboSelect.value=option.value;precisionCalc();const snapshot=window.__precisionSnapshot,total=Number(snapshot?.totals?.combo);let simTotal=NaN,traceTotal=NaN,audit=false,syntheticError='';try{const sim=timeline.syntheticFromSnapshot(snapshot),trace=timeline.normalizeTrace(sim),checked=timeline.traceAudit(sim,trace);simTotal=Number(sim.totalDamage);traceTotal=Number(checked.traceSum);audit=checked.pass;}catch(error){syntheticError=String(error?.message||error);}
      comboRows.push({id:option.value,label:option.textContent,selectedId:snapshot?.id||'',selectedBufferId:snapshot?.selections?.bufferId||'',total,finite:Number.isFinite(total),positive:total>0,audit,simTotal,traceTotal,syntheticError,phase:Number(window.__v26TeamGrowthContext?.byId?.sugarTreasure?.favoriteItemPhase)});
    }
    comboSelect.value=originalCombo;precisionCalc();
    const precisionSnapshot=window.__precisionSnapshot;let precisionSim={totalDamage:NaN},precisionAudit={pass:false},precisionError='';try{precisionSim=timeline.syntheticFromSnapshot(precisionSnapshot);precisionAudit=timeline.traceAudit(precisionSim,timeline.normalizeTrace(precisionSim));}catch(error){precisionError=String(error?.message||error);}
    const precisionPanel=precisionError?{defaultClosed:!document.getElementById('v34712PrecisionTimeline').open,audit:false,total:0,rows:0,error:precisionError}:await openAndRead(document.getElementById('v34712PrecisionTimeline'));
    soloRaidRefresh(true);const raid=window.NIKKESoloRaidLastResult||null;let raidSim={totalDamage:NaN},raidAudit={pass:false},raidError='';try{raidSim=timeline.syntheticFromSnapshot(raid?.snapshot,raid?.combo?.total,raid?.boss?.duration);raidAudit=timeline.traceAudit(raidSim,timeline.normalizeTrace(raidSim));}catch(error){raidError=String(error?.message||error);}
    const soloPanel=raidError?{defaultClosed:!document.getElementById('v34712SoloTimeline').open,audit:false,total:0,rows:0,error:raidError}:await openAndRead(document.getElementById('v34712SoloTimeline'));
    return{favoriteRows,comboRows,comboOptionCount:comboSelect.options.length,originalCombo,precision:{snapshotId:precisionSnapshot?.id||'',bufferId:precisionSnapshot?.selections?.bufferId||'',expected:Number(precisionSnapshot?.totals?.combo),simTotal:Number(precisionSim.totalDamage),audit:precisionAudit.pass,error:precisionError,panel:precisionPanel},solo:{exposed:!!window.NIKKESoloRaidLastResult,expected:Number(raid?.combo?.total),simTotal:Number(raidSim.totalDamage),audit:raidAudit.pass,error:raidError,panel:soloPanel}};
  })()`,240000);
  console.error('[stage] damage-surfaces-inputs-done',damageInputs.favoriteRows.length,damageInputs.comboRows.length,JSON.stringify({originalCombo:damageInputs.originalCombo,precision:damageInputs.precision,failedFavorites:damageInputs.favoriteRows.filter(row=>!row.precisionFinite||!row.raidFinite||row.selected!==row.id),failedCombos:damageInputs.comboRows.filter(row=>!row.positive||row.syntheticError).map(row=>({id:row.id,total:row.total,error:row.syntheticError}))},null,2));
  assert.equal(damageInputs.favoriteRows.length,21,'all favorite characters must reach Precision and Solo Raid');
  for(const row of damageInputs.favoriteRows){assert.equal(row.selected,row.id,`${row.id} Precision selection`);assert.equal(row.raidSnapshotId,row.id,`${row.id} Solo Raid snapshot`);assert.equal(row.phase,3,`${row.id} central favorite phase`);assert.equal(row.contextPhase,3,`${row.id} Precision context favorite phase`);assert.equal(row.resolutionPhase,3,`${row.id} favorite resolver phase`);assert.equal(row.precisionFinite,true,`${row.id} Precision nonzero finite total`);assert.equal(row.raidFinite,true,`${row.id} Solo Raid nonzero finite total`);}
  assert.equal(damageInputs.comboRows.length,damageInputs.comboOptionCount,'every special-buffer option audited');assert.ok(damageInputs.comboRows.length>=30,`special-buffer option coverage ${damageInputs.comboRows.length}`);
  for(const row of damageInputs.comboRows){assert.equal(row.selectedId,'sugarTreasure',`${row.id} selected Precision character`);assert.equal(row.selectedBufferId,row.id,`${row.id} selected special-buffer ID`);assert.equal(row.finite,true,`${row.id} finite Precision total`);assert.equal(row.positive,true,`${row.id} nonzero Precision total`);assert.equal(row.audit,true,`${row.id} timeline total audit`);assert.equal(row.simTotal,row.total,`${row.id} timeline preserves Precision total`);assert.equal(row.traceTotal,row.total,`${row.id} trace endpoint preserves Precision total`);assert.equal(row.phase,3,`${row.id} Sugar favorite phase`);}
  for(const [label,row] of [['Precision',damageInputs.precision],['Solo Raid',damageInputs.solo]]){assert.ok(Number.isFinite(row.expected)&&row.expected>0,`${label} nonzero finite authoritative total`);assert.equal(row.simTotal,row.expected,`${label} synthetic timeline total`);assert.equal(row.audit,true,`${label} timeline arithmetic audit`);assert.equal(row.panel.defaultClosed,true,`${label} panel default collapsed`);assert.equal(row.panel.audit,true,`${label} rendered total audit`);assert.equal(row.panel.total,row.expected,`${label} rendered exact total`);assert.equal(row.panel.rows,1,`${label} character damage row`);}
  assert.equal(damageInputs.solo.exposed,true,'Solo Raid authoritative result exposed for timeline runtime');

  console.error('[stage] simulation-start');
  const simulation=await evaluate(cdp,`(()=>{const run=phase=>{const doc=NIKKE_V26_ROSTER_API.load();doc.characters.sugarTreasure.favoriteItemPhase=phase;NIKKE_V26_ROSTER_API.import(doc,'replace');NIKKEV3475SyncPropagation.refreshPrecision();const result=NIKKESinglePartyTimelineSimulator.simulate({boss:'annihilio',duration:180,party:{b1:'toveTreasure',b2:'crown',b3:['sugarTreasure','drakeTreasure'],flex:'solineFrostTicket'},compact:true});const member=result.members.find(row=>row.id==='sugarTreasure');const profile=NIKKESinglePartyTimelineSimulator.normalizedProfiles().find(row=>row.id==='sugarTreasure');return{total:result.totalDamage,fullBurstCount:result.fullBurstCount,member,profile};};const p0=run(0),p3=run(3);return{p0,p3};})()`,120000);
  console.error('[stage] simulation-done',simulation.p3.total);
  assert.ok(simulation.p3.total>0);assert.ok(simulation.p3.fullBurstCount>0);assert.equal(simulation.p3.profile.growth.favoriteItemPhase,3);assert.deepEqual(simulation.p3.profile.growth.skills,{skill1:2,skill2:7,burst:9});assert.equal(simulation.p3.profile.growth.equipmentAttack,central.equipmentAttack);assert.equal(simulation.p3.profile.growth.equipmentHp,central.equipmentHp);assert.equal(simulation.p3.profile.growth.equipmentDefense,central.equipmentDefense);assert.equal(simulation.p3.member.damageBasis.gearAttack,central.equipmentAttack);assert.notEqual(simulation.p0.member.damage,simulation.p3.member.damage,'favorite phase must change simulation damage');

  console.error('[stage] five-deck-start');
  const fiveDeck=await evaluate(cdp,`(async()=>{
    let heartbeats=0;const timer=setInterval(()=>heartbeats++,50);
    const run=async()=>{const started=performance.now();const result=await NIKKEV3420Run();const elapsed=performance.now()-started;const ids=(result?.teams||[]).flatMap(team=>team.memberIds||team.members.map(member=>member.id));return{elapsed,status:result?.status,teams:result?.teams?.length||0,totalScore:result?.totalScore||0,ids,unique:new Set(ids.map(id=>NIKKE_FAVORITE_ITEM_IDENTITY?.canonicalId?.(id)||id)).size,validation:result?.v34710Validation,diagnostics:result?.v34710Diagnostics,uiStatus:document.getElementById('nikke-kit-status')?.textContent,error:window.NIKKEV3420LastError};};
    const first=await run();const firstHeartbeats=heartbeats;const second=await run();clearInterval(timer);
    const roster=NIKKE_V26_ROSTER_API.load();const propagation=NIKKEV34710OwnedRosterRepair.verifyPropagation('sugarTreasure');
    return{first,second,heartbeats,firstHeartbeats,registered:Object.keys(roster.characters||{}).length,owned:NIKKE_V26_ROSTER_API.getOwned().length,rosterCounts:NIKKE_V26_ROSTER_API.getRosterCounts?.(),unsupportedSelected:first.ids.filter(id=>String(id).startsWith('enikk_')),propagation};
  })()`,300000);
  await cdp.send('HeapProfiler.collectGarbage');
  const runtimeHeap=await cdp.send('Runtime.getHeapUsage');
  const first=fiveDeck.first,second=fiveDeck.second;
  console.error('[stage] five-deck-done',first.teams,first.elapsed.toFixed(1),second.elapsed.toFixed(1));
  assert.equal(fiveDeck.owned,syncResult.imported,'only current app-registered linked rows participate');
  assert.equal(fiveDeck.rosterCounts?.owned,syncResult.imported,'dynamic owned count');assert.equal(fiveDeck.rosterCounts?.registered,syncResult.policy.registered,'dynamic app registry count');assert.equal(fiveDeck.rosterCounts?.rosterOnly,0,'external supplemental catalog must not expand My Roster');assert.deepEqual(fiveDeck.unsupportedSelected,[],'roster-only supplementals must not receive invented calculation scores');
  assert.equal(fiveDeck.registered,syncResult.policy.registered,`registered ${fiveDeck.registered}`);
  assert.equal(fiveDeck.propagation.pass,true,JSON.stringify(fiveDeck.propagation));
  for(const [label,row] of [['first',first],['second',second]]){
    assert.equal(row.status,'ok',`${label} status`);assert.equal(row.teams,5,`${label} teams`);assert.equal(row.ids.length,25,`${label} slots`);assert.equal(row.unique,25,`${label} unique`);assert.equal(row.validation?.pass,true,`${label} validation ${JSON.stringify(row.validation)}`);assert.equal(row.error,null,`${label} error`);assert.equal(row.diagnostics?.ownedCount,syncResult.policy.calculationEligible,`${label} calculation-eligible owned count`);assert.ok(row.diagnostics?.profileCount>=25&&row.diagnostics?.profileCount<=syncResult.policy.calculationEligible,`${label} dynamically supported calculation profiles`);assert.match(row.uiStatus,/연동 193명/);assert.match(row.uiStatus,/5팀 25명/);assert.match(row.uiStatus,/중복 0/);
  }
  assert.ok(first.elapsed<45000,`first run ${first.elapsed}ms`);assert.ok(second.elapsed<1200,`cached second run ${second.elapsed}ms`);assert.equal(first.totalScore,second.totalScore,'repeat deterministic total');assert.deepEqual(first.ids,second.ids,'repeat deterministic teams');assert.ok(fiveDeck.firstHeartbeats>=20,`UI heartbeat ${fiveDeck.firstHeartbeats}`);assert.ok(runtimeHeap.usedSize<140000000,`post-GC renderer heap ${runtimeHeap.usedSize}`);

  console.error('[stage] five-deck-timeline-surfaces-start');
  const timelineSurfaces=await evaluate(cdp,`(async()=>{
    const api=NIKKEV34712UnifiedTimeline,result=NIKKEV34710LastResult,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const waitPanel=async(details,timeout=60000)=>{const started=performance.now();while(performance.now()-started<timeout){const error=details.querySelector('.v34712-error');if(error)throw new Error(details.id+': '+error.textContent);if(details.dataset.auditPass==='true'&&details.querySelector('canvas'))return;await wait(25);}throw new Error('timeline panel timeout '+details.id);};
    const dimensions=details=>{const chart=details.querySelector('.v34712-timeline-chart')?.getBoundingClientRect(),damage=details.querySelector('.v34712-damage-panel')?.getBoundingClientRect();return{chartW:chart?.width||0,chartH:chart?.height||0,damageW:damage?.width||0,damageH:damage?.height||0};};
    document.querySelector('.tab[data-page="v26Optimizer"]')?.click();await wait(80);api.clearCache();api.decorateFiveDeck();await wait(80);
    const panels=[...document.querySelectorAll('.v34712-five-deck-timeline')],teams=[],sims=[];
    for(let index=0;index<result.teams.length;index++){
      const team=result.teams[index],details=panels[index],defaultOpen=details.open===true,summaryBeforeWait=details.querySelector('.v34712-summary-total')?.textContent?.trim()||'',sim=api.simulateTeam(team,result,index),trace=api.normalizeTrace(sim),audit=api.traceAudit(sim,trace),memberSum=sim.members.reduce((sum,member)=>sum+Number(member.damage||0),0);
      sims.push(sim);await waitPanel(details);const rows=[...details.querySelectorAll('.v34712-damage-row')].map(row=>({name:row.querySelector('.v34712-damage-name')?.textContent?.trim()||'',damage:row.querySelector('.v34712-damage-value')?.textContent?.trim()||''}));
      teams.push({index:index+1,score:Number(team.score),simTotal:Number(sim.totalDamage),memberSum,traceTotal:Number(audit.traceSum),audit:audit.pass,members:sim.members.map(member=>({id:member.id,damage:Number(member.damage)})),rows,defaultOpen,summaryBeforeWait,renderAudit:details.dataset.auditPass==='true',renderTotal:Number(details.dataset.total||0),dimensions:dimensions(details)});
      details.open=false;details.dispatchEvent(new Event('toggle'));await wait(10);
    }
    const central=NIKKE_V26_ROSTER_API.load().characters,profiles=new Map(NIKKESinglePartyTimelineSimulator.normalizedProfiles().map(profile=>[profile.id,profile])),favoriteIds=new Set(Object.keys(NIKKE_V3477_FAVORITE_REGISTRY||{})),selectedFavoriteIds=[...new Set(result.teams.flatMap(team=>team.memberIds||team.members.map(member=>member.id)).filter(id=>favoriteIds.has(id)))],selectedFavorites=selectedFavoriteIds.map(id=>({id,centralPhase:Number(central[id]?.favoriteItemPhase),simulationPhase:Number(profiles.get(id)?.growth?.favoriteItemPhase)}));
    window.NIKKESinglePartyTimelineLastResult=sims[0];document.querySelector('.tab[data-page="battleTimelineSim"]')?.click();await wait(60);const battle=document.getElementById('v34712BattleTimeline'),battleDefaultClosed=!battle.open;battle.open=true;battle.dispatchEvent(new Event('toggle'));await waitPanel(battle);const battleResult={defaultClosed:battleDefaultClosed,audit:battle.dataset.auditPass==='true',total:Number(battle.dataset.total||0),rows:battle.querySelectorAll('.v34712-damage-row').length,dimensions:dimensions(battle)};battle.open=false;battle.dispatchEvent(new Event('toggle'));
    return{panelCount:panels.length,resultTotal:Number(result.totalScore),scoreSum:result.teams.reduce((sum,team)=>sum+Number(team.score||0),0),teams,selectedFavorites,battle:battleResult,battleExpected:Number(sims[0]?.totalDamage),cacheSize:api.cacheSize()};
  })()`,300000);
  console.error('[stage] five-deck-timeline-surfaces-done',timelineSurfaces.panelCount,timelineSurfaces.teams.length);
  assert.equal(timelineSurfaces.panelCount,5,'one instant timeline per automatic deck');assert.equal(timelineSurfaces.teams.length,5,'five deck simulations');assert.ok(Number.isFinite(timelineSurfaces.resultTotal)&&timelineSurfaces.resultTotal>0,'five-deck authoritative total nonzero finite');assert.equal(timelineSurfaces.scoreSum,timelineSurfaces.resultTotal,'five-deck total equals team score sum');
  for(const team of timelineSurfaces.teams){assert.ok(Number.isFinite(team.score)&&team.score>0,`deck ${team.index} score nonzero finite`);assert.ok(Number.isFinite(team.simTotal)&&team.simTotal>0,`deck ${team.index} 180-second total nonzero finite`);assert.equal(team.members.length,5,`deck ${team.index} member totals`);for(const member of team.members)assert.ok(Number.isFinite(member.damage)&&member.damage>0,`deck ${team.index} ${member.id} nonzero finite damage`);assert.ok(Math.abs(team.memberSum-team.simTotal)<=Math.max(1,team.simTotal*1e-6),`deck ${team.index} member sum`);assert.equal(team.audit,true,`deck ${team.index} trace total audit`);assert.ok(Math.abs(team.traceTotal-team.simTotal)<=Math.max(1,team.simTotal*1e-6),`deck ${team.index} trace endpoint`);assert.equal(team.defaultOpen,true,`deck ${team.index} automatically open`);assert.notEqual(team.summaryBeforeWait,'계산 전',`deck ${team.index} summary is not click-gated`);assert.equal(team.renderAudit,true,`deck ${team.index} rendered audit`);assert.equal(team.renderTotal,team.simTotal,`deck ${team.index} rendered exact total`);assert.equal(team.rows.length,5,`deck ${team.index} right-side character totals`);assert.equal(team.rows.every(row=>row.name&&/^[0-9][0-9,.]*(?:만|억|조)?$/.test(row.damage)),true,`deck ${team.index} compact character damage labels`);assert.ok(team.dimensions.chartW>=team.dimensions.damageW*4,`deck ${team.index} graph width dominates totals`);assert.ok(Math.abs(team.dimensions.chartH-team.dimensions.damageH)<=1,`deck ${team.index} graph/totals equal height`);}
  assert.ok(timelineSurfaces.selectedFavorites.length>0,'five-deck selection includes audited favorite characters');for(const row of timelineSurfaces.selectedFavorites){assert.equal(row.centralPhase,3,`${row.id} central favorite phase in five-deck`);assert.equal(row.simulationPhase,3,`${row.id} simulation favorite phase in five-deck`);}
  assert.equal(timelineSurfaces.battle.defaultClosed,true,'battle timeline default collapsed');assert.equal(timelineSurfaces.battle.audit,true,'battle rendered total audit');assert.equal(timelineSurfaces.battle.total,timelineSurfaces.battleExpected,'battle and selected five-deck simulation share exact total');assert.equal(timelineSurfaces.battle.rows,5,'battle character damage rows');assert.ok(timelineSurfaces.battle.dimensions.chartW>=timelineSurfaces.battle.dimensions.damageW*4,'battle graph width dominates totals');assert.ok(Math.abs(timelineSurfaces.battle.dimensions.chartH-timelineSurfaces.battle.dimensions.damageH)<=1,'battle graph/totals equal height');assert.ok(timelineSurfaces.cacheSize<=2,`bounded five-deck trace cache ${timelineSurfaces.cacheSize}`);

  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const visualRect=await evaluate(cdp,`(async()=>{const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));document.getElementById('v26AccountStart')?.click();await wait(180);document.querySelector('.tab[data-page="v26Optimizer"]')?.click();await wait(100);const details=document.querySelector('.v34712-five-deck-timeline');details.open=true;details.dispatchEvent(new Event('toggle'));const started=performance.now();while(performance.now()-started<60000&&!(details.dataset.auditPass==='true'&&details.querySelector('canvas')))await wait(25);if(details.dataset.auditPass!=='true')throw new Error('desktop visual timeline did not finish rendering');details.scrollIntoView({block:'center'});await wait(100);const rect=details.getBoundingClientRect();return{x:Math.max(0,window.scrollX+rect.left-12),y:Math.max(0,window.scrollY+rect.top-12),width:Math.min(document.documentElement.scrollWidth,rect.width+24),height:rect.height+24};})()`);
  const visualShot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{...visualRect,scale:1}});
  const visualPath=path.join(ROOT,'V34712_TIMELINE_DESKTOP_QA.png');fs.writeFileSync(visualPath,Buffer.from(visualShot.data,'base64'));

  const verification={version:VERSION,verifiedAtUtc:new Date().toISOString(),environment:{viewport:'412x915 + 1440x900 visual QA',deviceMemoryGb:4,v8OldSpaceMb:192},visualScreenshot:path.basename(visualPath),bridge:{received:193,imported:syncResult.imported,snapshotRows:syncResult.snapshotRows,area:syncResult.area,registryAudit:syncResult.registryAudit},roster:{registered:fiveDeck.registered,owned:fiveDeck.owned,id:'sugarTreasure',level:central.level,skills:central.skills,phase:central.favoriteItemPhase,cube:central.cubeId,equipmentAttack:central.equipmentAttack,equipmentHp:central.equipmentHp,equipmentDefense:central.equipmentDefense,slots:central.equipmentObservedSlots},damageInputs,timelineSurfaces,precision:{total:precision.total,pass:precision.diagnostic.pass},simulation:{phase0:simulation.p0.member.damage,phase3:simulation.p3.member.damage,gearAttack:simulation.p3.member.damageBasis.gearAttack},fiveDeck:{first,second,heartbeats:fiveDeck.firstHeartbeats,postGcHeap:runtimeHeap},pass:true};
  const linkedEvidence={version:VERSION,verifiedAtUtc:verification.verifiedAtUtc,rawLinkedRows:verification.bridge.received,storedRegisteredRows:verification.bridge.imported,calculationEligibleRows:verification.roster.owned,externalOnlyRows:verification.bridge.received-verification.bridge.imported,refreshPolicy,characterSearch:searchAudit,propagatedCharacter:{id:verification.roster.id,level:verification.roster.level,skills:verification.roster.skills,favoriteItemPhase:verification.roster.phase,cube:verification.roster.cube,equipmentAttack:verification.roster.equipmentAttack},fiveDeck:{teams:first.teams,unique:first.unique,validationPass:first.validation?.pass===true},pass:true};
  fs.writeFileSync(path.join(ROOT,'V34712_DAMAGE_SURFACES_BROWSER_RESULTS.json'),JSON.stringify(verification,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'V34712_LINKED_ROSTER_193_BROWSER_RESULTS.json'),JSON.stringify(linkedEvidence,null,2)+'\n');
  console.log(JSON.stringify(verification,null,2));
  console.log('V34.7.19 BlaBla 193 raw rows -> all favorite phases / special combos -> Precision -> Solo Raid -> Simulation -> 5-deck timelines browser verification: PASS');
}finally{
  cdp?.close();
  if(chrome.exitCode===null){
    chrome.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,750))]);
  }
  if(chrome.exitCode===null){
    chrome.kill('SIGKILL');
    await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,750))]);
  }
  chrome.stdout?.destroy();chrome.stderr?.destroy();
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
  const profileDir=path.join(ROOT,'.tmp-chrome-v34710');
  for(let attempt=0;attempt<8;attempt+=1){try{fs.rmSync(profileDir,{recursive:true,force:true,maxRetries:3,retryDelay:100});break;}catch(error){if(attempt===7)console.warn(`Chrome profile cleanup warning: ${error.message}`);else await new Promise(resolve=>setTimeout(resolve,150));}}
}
