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
const VERSION='34.7.12';
const PROFILE='https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=';

function parseJsonLiteral(regex,label){const match=HTML.match(regex);assert.ok(match,`${label} missing`);return JSON.parse(match[1]);}
const nameCodeMap=parseJsonLiteral(/const V3476_NAMECODE_TO_APP_ID=Object\.freeze\((\{[^\n]+\})\);/,'nameCode map');
const favoriteRecords=parseJsonLiteral(/<script id="v3477-favorite-registry">[\s\S]*?const records=(\[[\s\S]*?\]);\nconst freezeDeep=/,'favorite registry');
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
  for(const candidate of [process.env.CHROME_BIN,process.env.GOOGLE_CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'])if(candidate&&fs.existsSync(candidate))return candidate;
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
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--enable-precise-memory-info','--js-flags=--max-old-space-size=96',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${path.join(ROOT,'.tmp-chrome-v34710')}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
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
  await waitFor(cdp,'window.NIKKEV3472BlaPublicSync&&window.NIKKEV34610External&&window.NIKKE_V26_ROSTER_API&&window.NIKKESinglePartyTimelineSimulator&&window.NIKKE_V26_OPTIMIZER_API&&window.NIKKEV3478BlaPropagation&&window.NIKKEV34710OwnedRosterRepair&&window.NIKKEV34711LinkedRosterRefresh',90000);

  console.error('[stage] app-ready');
  const syncResult=await evaluate(cdp,`(async()=>{document.getElementById('v34610BlaUrl').value=${JSON.stringify(PROFILE)};document.getElementById('v34610BlaServer').value='GLOBAL';const result=await NIKKEV3472BlaPublicSync.sync();await new Promise(r=>setTimeout(r,100));NIKKEV3475SyncPropagation.refreshPrecision();const policy=NIKKEV34711LinkedRosterRefresh.verify();const snap=NIKKEV34711LinkedRosterRefresh.getSnapshot();return{imported:result.out.imported,unmatched:result.out.unmatched,received:result.out.received,area:result.area.area,status:document.getElementById('v34610BlaStatus')?.textContent,policy,snapshotRows:snap?.characters?.length||0};})()`);
  console.error('[stage] sync-done',syncResult);
  assert.equal(syncResult.area,84);assert.equal(syncResult.received,193);assert.equal(syncResult.snapshotRows,193,'all linked rows must remain in raw snapshot');assert.ok(syncResult.imported>=25&&syncResult.imported<=syncResult.policy.registered,`imported ${syncResult.imported} / registered ${syncResult.policy.registered}`);assert.equal(syncResult.unmatched.length,193-syncResult.imported,'non-app rows stay snapshot-only');assert.equal(syncResult.policy.hardcoded100,false);assert.equal(syncResult.policy.dynamicRegistration,true);

  console.error('[stage] refresh-policy-start');
  const refreshPolicy=await evaluate(cdp,`(async()=>{await new Promise(r=>setTimeout(r,1800));const api=NIKKEV34711LinkedRosterRefresh;const thursdayNoon=Date.UTC(2026,7,27,3,0,0);const thursdayNight=Date.UTC(2026,7,27,11,0,0);const slotNoon=api.latestDueSlot(thursdayNoon),nextNoon=api.nextSlot(thursdayNoon),slotNight=api.latestDueSlot(thursdayNight),nextNight=api.nextSlot(thursdayNight);const manual=await api.manualRefresh();await new Promise(r=>setTimeout(r,50));const snap=api.getSnapshot(),state=api.getRefreshState();return{button:!!document.getElementById('v34711RefreshNow'),panel:!!document.getElementById('v34711RefreshPanel'),slotNoon:{hour:slotNoon.hour,next:nextNoon.hour},slotNight:{hour:slotNight.hour,next:nextNight.hour},manualReceived:manual?.out?.received??manual?.received??0,snapshotRows:snap?.characters?.length||0,lastSuccess:state?.lastSuccess||'',verification:api.verify()};})()`);
  console.error('[stage] refresh-policy-done',refreshPolicy);
  assert.equal(refreshPolicy.button,true);assert.equal(refreshPolicy.panel,true);assert.deepEqual(refreshPolicy.slotNoon,{hour:11,next:19});assert.deepEqual(refreshPolicy.slotNight,{hour:19,next:11});assert.equal(refreshPolicy.snapshotRows,193);assert.ok(refreshPolicy.lastSuccess);assert.equal(refreshPolicy.verification.dynamicRegistration,true);assert.equal(refreshPolicy.verification.hardcoded100,false);

  console.error('[stage] roster-start');
  const rosterState=await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.render();const button=document.querySelector('[data-roster-action="select"][data-character-id="sugarTreasure"]');button?.click();const central=NIKKE_V26_ROSTER_API.load().characters.sugarTreasure;const editor=document.getElementById('v26RosterEditor');const read=selector=>editor?.querySelector(selector)?.value;return{central,rowOwned:button?.closest('.v26-roster-row')?.classList.contains('is-owned'),countText:document.getElementById('v26RosterCount')?.textContent||'',renderedRows:document.querySelectorAll('#v26RosterList .v26-roster-row').length,renderedOwned:document.querySelectorAll('#v26RosterList .v26-roster-row.is-owned').length,editor:{owned:editor?.querySelector('[data-roster-field="owned"]')?.checked,level:read('[data-roster-field="level"]'),limitBreak:read('[data-roster-field="limitBreak"]'),coreLevel:read('[data-roster-field="coreLevel"]'),skill1:read('[data-roster-field="skills.skill1"]'),skill2:read('[data-roster-field="skills.skill2"]'),burst:read('[data-roster-field="skills.burst"]'),phase:read('[data-roster-field="favoriteItemPhase"]'),cube:read('[data-roster-field="cubeId"]')}};})()`);
  console.error('[stage] roster-done');
  const central=rosterState.central;assert.equal(rosterState.rowOwned,true);assert.equal(rosterState.renderedRows,syncResult.policy.registered);assert.equal(rosterState.renderedOwned,syncResult.imported);assert.ok(rosterState.countText.includes(`보유 ${syncResult.imported}/${syncResult.policy.registered}명`));assert.equal(rosterState.editor.owned,true);assert.equal(Number(rosterState.editor.level),450);assert.equal(Number(rosterState.editor.limitBreak),3);assert.equal(Number(rosterState.editor.coreLevel),5);assert.deepEqual([Number(rosterState.editor.skill1),Number(rosterState.editor.skill2),Number(rosterState.editor.burst)],[2,7,9]);assert.equal(Number(rosterState.editor.phase),3);assert.equal(rosterState.editor.cube,'diffusion');
  assert.equal(central.level,450);assert.equal(central.limitBreak,3);assert.equal(central.coreLevel,5);assert.equal(central.bond,40);assert.equal(central.favoriteItemPhase,3);assert.deepEqual(central.skills,{skill1:2,skill2:7,burst:9});assert.equal(central.equipmentObservedSlots,4);assert.ok(central.equipmentAttack>0);assert.ok(central.equipmentHp>0);assert.ok(central.equipmentDefense>0);assert.equal(central.overloadTotals.atk,32.2);assert.equal(central.overloadTotals.element,46.6);assert.equal(central.overloadTotals.maxAmmo,89.8);

  console.error('[stage] precision-start');
  const precision=await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.apply('sugarTreasure');precisionCalc();const s=window.__precisionSnapshot||{};return{selected:document.getElementById('precisionChar').value,skills:[Number(document.getElementById('precisionSkill1').value),Number(document.getElementById('precisionSkill2').value),Number(document.getElementById('precisionBurstSkill').value)],cube:document.getElementById('precisionCube').value,overload:{atk:Number(document.getElementById('precisionAtk').value),element:Number(document.getElementById('precisionElement').value),ammo:Number(document.getElementById('maxAmmo').value)},context:window.__v26TeamGrowthContext.byId.sugarTreasure,total:s.totals?.combo||s.totals?.base||0,diagnostic:NIKKEV3478BlaPropagation.verify('sugarTreasure')};})()`);
  console.error('[stage] precision-done',precision.total);
  assert.equal(precision.selected,'sugarTreasure');assert.deepEqual(precision.skills,[2,7,9]);assert.equal(precision.cube,'diffusion');assert.equal(precision.overload.atk,32.2);assert.equal(precision.context.favoriteItemPhase,3);assert.equal(precision.context.equipmentAttack,central.equipmentAttack);assert.equal(precision.context.equipmentHp,central.equipmentHp);assert.equal(precision.context.equipmentDefense,central.equipmentDefense);assert.ok(precision.total>0);assert.equal(precision.diagnostic.pass,true,JSON.stringify(precision.diagnostic.checks));

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
    assert.equal(row.status,'ok',`${label} status`);assert.equal(row.teams,5,`${label} teams`);assert.equal(row.ids.length,25,`${label} slots`);assert.equal(row.unique,25,`${label} unique`);assert.equal(row.validation?.pass,true,`${label} validation ${JSON.stringify(row.validation)}`);assert.equal(row.error,null,`${label} error`);assert.equal(row.diagnostics?.ownedCount,syncResult.imported,`${label} diagnostic owned count`);assert.ok(row.diagnostics?.profileCount>=25&&row.diagnostics?.profileCount<=syncResult.policy.registered,`${label} dynamically supported calculation profiles`);assert.match(row.uiStatus,/연동 193명/);assert.match(row.uiStatus,/5팀 25명/);assert.match(row.uiStatus,/중복 0/);
  }
  assert.ok(first.elapsed<25000,`first run ${first.elapsed}ms`);assert.ok(second.elapsed<1200,`cached second run ${second.elapsed}ms`);assert.equal(first.totalScore,second.totalScore,'repeat deterministic total');assert.deepEqual(first.ids,second.ids,'repeat deterministic teams');assert.ok(fiveDeck.firstHeartbeats>=20,`UI heartbeat ${fiveDeck.firstHeartbeats}`);assert.ok(runtimeHeap.usedSize<140000000,`post-GC renderer heap ${runtimeHeap.usedSize}`);

  await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.apply('sugarTreasure');precisionCalc();const s=window.__precisionSnapshot;return{total:s?.totals?.combo||s?.totals?.base||0};})()`);
  const verification={version:VERSION,verifiedAtUtc:new Date().toISOString(),environment:{viewport:'412x915',deviceMemoryGb:4,v8OldSpaceMb:96},bridge:{received:193,imported:syncResult.imported,snapshotRows:syncResult.snapshotRows,area:syncResult.area},roster:{registered:fiveDeck.registered,owned:fiveDeck.owned,id:'sugarTreasure',level:central.level,skills:central.skills,phase:central.favoriteItemPhase,cube:central.cubeId,equipmentAttack:central.equipmentAttack,equipmentHp:central.equipmentHp,equipmentDefense:central.equipmentDefense,slots:central.equipmentObservedSlots},precision:{total:precision.total,pass:precision.diagnostic.pass},simulation:{phase0:simulation.p0.member.damage,phase3:simulation.p3.member.damage,gearAttack:simulation.p3.member.damageBasis.gearAttack},fiveDeck:{first,second,heartbeats:fiveDeck.firstHeartbeats,postGcHeap:runtimeHeap},pass:true};
  fs.writeFileSync(path.join(ROOT,'V34711_LINKED_ROSTER_193_BROWSER_RESULTS.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify(verification,null,2));
  console.log('V34.7.12 BlaBla 193 raw rows -> dynamic app registry -> Precision -> Simulation -> 5-deck browser verification: PASS');
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
