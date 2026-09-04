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
const VERSION='34.7.20';
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
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--renderer-process-limit=1','--js-flags=--max-old-space-size=192',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${path.join(ROOT,'.tmp-chrome-v3478')}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
let stderr='';chrome.stderr.on('data',chunk=>{stderr+=chunk.toString();});
let cdp;
try{
  console.error('[stage] chrome-wait');
  const pages=await waitForJson(`http://127.0.0.1:${debugPort}/json`,30000);const page=pages.find(item=>item.type==='page')||pages[0];assert.ok(page?.webSocketDebuggerUrl,'CDP page target');
  cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.connect();await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  const init=`(()=>{const memoryStorage=()=>{const values=new Map();return{getItem:key=>values.has(String(key))?values.get(String(key)):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),key:index=>[...values.keys()][index]??null,get length(){return values.size;}}};try{localStorage.clear();sessionStorage.clear();}catch(_){try{Object.defineProperty(window,'localStorage',{value:memoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:memoryStorage(),configurable:true});}catch(__){}}localStorage.setItem('nikke_v3474_deploy_blablalink_autosync','0');window.NIKKE_BLABLA_PROXY='https://v3478.test/api/blabla';window.__NIKKE_V34610_ENIKK_TABLES__=${JSON.stringify({options:{},cubes:{},favorites:favoriteTable})};const original=window.fetch.bind(window);window.fetch=async function(input,requestInit={}){const url=String(typeof input==='string'?input:input?.url||input);if(url.endsWith('/api/blabla/sync')){const method=String(requestInit?.method||'GET').toUpperCase();return new Response(method==='POST'?${JSON.stringify(JSON.stringify(bridgePayload))}:${JSON.stringify(JSON.stringify({ok:true,version:VERSION,configured:true,games:['29080'],worker:'nikke-growth-calculator'}))},{status:200,headers:{'content-type':'application/json'}});}if(url==='https://enikk.app/api/graphql'){return new Response(${JSON.stringify(JSON.stringify({data:{characters:masterRows}}))},{status:200,headers:{'content-type':'application/json'}});}return original(input,requestInit);};})();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:init});
  await cdp.send('Page.navigate',{url:'data:text/html,<html><head></head><body></body></html>'});
  await waitFor(cdp,"document.readyState==='complete'",30000);
  const frameTree=await cdp.send('Page.getFrameTree');
  const frameId=frameTree.frameTree?.frame?.id;
  assert.ok(frameId,'CDP main frame');
  await cdp.send('Page.setDocumentContent',{frameId,html:HTML});
  console.error('[stage] page-content-set');
  await waitFor(cdp,'window.NIKKEV3472BlaPublicSync&&window.NIKKEV34610External&&window.NIKKE_V26_ROSTER_API&&window.NIKKESinglePartyTimelineSimulator&&window.NIKKE_V26_OPTIMIZER_API&&window.NIKKEV3478BlaPropagation',90000);

  console.error('[stage] app-ready');
  const syncResult=await evaluate(cdp,`(async()=>{document.getElementById('v34610BlaUrl').value=${JSON.stringify(PROFILE)};document.getElementById('v34610BlaServer').value='GLOBAL';const result=await NIKKEV3472BlaPublicSync.sync();await new Promise(r=>setTimeout(r,50));NIKKEV3475SyncPropagation.refreshPrecision();return{imported:result.out.imported,unmatched:result.out.unmatched,area:result.area.area,status:document.getElementById('v34610BlaStatus')?.textContent};})()`);
  console.error('[stage] sync-done',syncResult);
  assert.equal(syncResult.area,84);assert.ok(syncResult.imported>=60,`imported only ${syncResult.imported}`);assert.match(syncResult.status,/시뮬레이션/);

  console.error('[stage] roster-start');
  const rosterState=await evaluate(cdp,`(()=>{NIKKE_V26_ROSTER_API.apply('sugarTreasure',{navigate:false,recalculate:false});NIKKE_V26_ROSTER_API.render();const pick=document.querySelector('#v26RosterList .v26-roster-pick[data-character-id="sugarTreasure"]'),central=NIKKE_V26_ROSTER_API.load().characters.sugarTreasure;return{central,rowOwned:pick?.closest('.v26-roster-row')?.classList.contains('is-owned'),rowText:pick?.textContent||'',rowAction:pick?.dataset.rosterAction||'',rowTag:pick?.tagName};})()`);
  console.error('[stage] roster-done');
  const central=rosterState.central;assert.equal(rosterState.rowOwned,true);assert.equal(rosterState.rowTag,'DIV');assert.equal(rosterState.rowAction,'');assert.match(rosterState.rowText,/슈가/);assert.match(rosterState.rowText,/ATK 32\.2%/);
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
  const fiveDeck=await evaluate(cdp,`(async()=>{const captures=[];const original=window.v21DamageModel;window.v21DamageModel=function(...args){const out=original.apply(this,args);if(args[0]==='sugarTreasure'&&captures.length<80)captures.push({growth:JSON.parse(JSON.stringify(window.__v26TeamGrowthContext?.byId?.sugarTreasure||null)),ctx:JSON.parse(JSON.stringify(args[4]||{})),resolution:JSON.parse(JSON.stringify(out?.favoriteItemSkillResolution||null)),model:{atk:out?.atk,dmg:out?.dmg,strongElementDmg:out?.strongElementDmg}});return out;};let heartbeat=0;const timer=setInterval(()=>heartbeat++,25);try{document.getElementById('soloBossSelect').value='annihilio';const mode=document.getElementById('v3413RosterMode');if(mode){mode.value='owned';mode.dispatchEvent(new Event('change',{bubbles:true}));}const started=performance.now();const optimized=await NIKKEV3420Run();const elapsedMs=performance.now()-started;const ids=(optimized?.teams||[]).flatMap(team=>team.memberIds||team.members?.map(row=>row.id)||[]);const repaired=NIKKEV34710OwnedRosterRepair.getLastResult();const diagnostics=repaired?.diagnostics||{},optimizedDiagnostics=optimized?.diagnostics||{},candidateValues=[diagnostics.boundedCandidates,diagnostics.legalCandidates,diagnostics.authoritativeCandidates,diagnostics.candidateCount,optimizedDiagnostics.boundedCandidates,optimizedDiagnostics.legalCandidates,optimizedDiagnostics.authoritativeCandidates,optimizedDiagnostics.candidateCount].map(Number).filter(value=>Number.isFinite(value)&&value>0);return{buildStatus:optimized?.status,candidates:candidateValues[0]||0,optStatus:optimized?.status,teams:optimized?.teams?.length||0,totalScore:optimized?.totalScore,unique:new Set(ids).size,ids,capture:captures.find(row=>row.growth?.favoriteItemPhase===3&&row.growth?.equipmentAttack>0)||captures[0]||null,elapsedMs,heartbeat,diagnostics:{repair:diagnostics,optimized:optimizedDiagnostics},validation:repaired?.validation,button:document.getElementById('nikke-kit-run')?.textContent,status:document.getElementById('nikke-kit-status')?.textContent,marker:document.getElementById('v34710-owned-roster-repair')!==null};}finally{clearInterval(timer);window.v21DamageModel=original;NIKKEV3475SyncPropagation.refreshPrecision();}})()`,240000);
  console.error('[stage] five-deck-done',fiveDeck.candidates,fiveDeck.teams,Math.round(fiveDeck.elapsedMs),fiveDeck.heartbeat);
  assert.equal(fiveDeck.marker,true);assert.equal(fiveDeck.buildStatus,'ok');assert.ok(fiveDeck.candidates>0,JSON.stringify(fiveDeck.diagnostics));assert.equal(fiveDeck.optStatus,'ok');assert.equal(fiveDeck.teams,5);assert.equal(fiveDeck.unique,25);assert.ok(fiveDeck.totalScore>0);assert.ok(fiveDeck.elapsedMs<90000,`stable five-deck took ${fiveDeck.elapsedMs}ms`);assert.ok(fiveDeck.heartbeat>=2,`UI heartbeat did not advance: ${fiveDeck.heartbeat}`);assert.equal(fiveDeck.validation.pass,true,JSON.stringify(fiveDeck.validation));assert.match(fiveDeck.button,/V34\.7\.20 5팀/);assert.match(fiveDeck.status,/5팀 25명/);assert.match(fiveDeck.status,/자체검증 PASS/);assert.ok(fiveDeck.capture,'Sugar optimizer capture');assert.equal(fiveDeck.capture.growth.favoriteItemPhase,3);assert.deepEqual(fiveDeck.capture.growth.skills,{skill1:2,skill2:7,burst:9});assert.equal(fiveDeck.capture.growth.equipmentAttack,central.equipmentAttack);assert.equal(fiveDeck.capture.growth.equipmentHp,central.equipmentHp);assert.equal(fiveDeck.capture.growth.equipmentDefense,central.equipmentDefense);assert.equal(fiveDeck.capture.growth.equipmentObservedSlots,4);assert.equal(fiveDeck.capture.resolution.phase,3);assert.deepEqual(fiveDeck.capture.resolution.skillLevels,{skill1:2,skill2:7,burst:9});

  console.error('[stage] manual-cross-tab-start');
  const manual=await evaluate(cdp,`(async()=>{const set=(id,value,type='input')=>{const node=document.getElementById(id);if(!node)throw new Error('missing manual control '+id);node.value=String(value);node.dispatchEvent(new Event(type,{bubbles:true}));};NIKKE_V26_ROSTER_API.apply('sugarTreasure',{navigate:false,recalculate:false});set('precisionSkill1',6);set('precisionSkill2',8);set('precisionBurstSkill',10);set('precisionCube','resilience','change');set('precisionAtk',40.4);set('precisionElement',55.5);set('maxAmmo',111.1);set('manualRatio',12.34);set('measuredCoeff',1.15);await new Promise(r=>setTimeout(r,120));NIKKEV3475SyncPropagation.refreshPrecision();precisionCalc();soloRaidRefresh();const stored=NIKKE_V26_ROSTER_API.load().characters.sugarTreasure,propagation=NIKKEV34710OwnedRosterRepair.verifyPropagation('sugarTreasure'),profile=NIKKESinglePartyTimelineSimulator.normalizedProfiles().find(row=>row.id==='sugarTreasure'),simulation=NIKKESinglePartyTimelineSimulator.simulate({boss:'annihilio',duration:180,party:{b1:'toveTreasure',b2:'crown',b3:['sugarTreasure','drakeTreasure'],flex:'solineFrostTicket'},compact:true}),member=simulation.members.find(row=>row.id==='sugarTreasure'),precision=window.__precisionSnapshot,solo=window.NIKKESoloRaidLastResult;NIKKE_V26_ROSTER_API.render();const rowText=document.querySelector('#v26RosterList .v26-roster-pick[data-character-id="sugarTreasure"]')?.textContent||'';return{stored,propagation,profile:{cubeId:profile?.cubeId,growth:profile?.growth},precision:{id:precision?.id,skills:precision?.inputs?.skillLevels,atk:precision?.inputs?.atk,element:precision?.inputs?.element,manualRatio:precision?.inputs?.manualRatio,measured:precision?.inputs?.measured},solo:{id:solo?.snapshot?.id,skills:solo?.snapshot?.inputs?.skillLevels,atk:solo?.snapshot?.inputs?.atk,manualRatio:solo?.snapshot?.inputs?.manualRatio,measured:solo?.snapshot?.inputs?.measured},simulation:{total:simulation.totalDamage,skills:profile?.growth?.skills,cubeId:profile?.cubeId,memberDamage:member?.damage},rowText};})()`,120000);
  console.error('[stage] manual-cross-tab-done',manual.simulation.total);
  assert.deepEqual(manual.stored.skills,{skill1:6,skill2:8,burst:10});assert.equal(manual.stored.cubeId,'resilience');assert.equal(manual.stored.overloadTotals.atk,40.4);assert.equal(manual.stored.overloadTotals.element,55.5);assert.equal(manual.stored.overloadTotals.maxAmmo,111.1);assert.equal(manual.stored.manualRatio,12.34);assert.equal(manual.stored.measuredCoeff,1.15);assert.equal(manual.propagation.pass,true,JSON.stringify(manual.propagation.checks));assert.deepEqual(manual.profile.growth.skills,{skill1:6,skill2:8,burst:10});assert.equal(manual.profile.cubeId,'resilience');assert.equal(manual.precision.id,'sugarTreasure');assert.deepEqual(manual.precision.skills,{skill1:6,skill2:8,burst:10});assert.equal(manual.precision.atk,40.4);assert.equal(manual.precision.manualRatio,12.34);assert.equal(manual.precision.measured,1.15);assert.equal(manual.solo.id,'sugarTreasure');assert.deepEqual(manual.solo.skills,{skill1:6,skill2:8,burst:10});assert.equal(manual.solo.atk,40.4);assert.equal(manual.solo.manualRatio,12.34);assert.equal(manual.solo.measured,1.15);assert.ok(manual.simulation.total>0);assert.deepEqual(manual.simulation.skills,{skill1:6,skill2:8,burst:10});assert.equal(manual.simulation.cubeId,'resilience');assert.ok(manual.simulation.memberDamage>0);assert.match(manual.rowText,/ATK 40\.4%/);

  console.log(JSON.stringify({version:VERSION,bridge:{imported:syncResult.imported,area:syncResult.area},roster:{id:'sugarTreasure',level:central.level,skills:central.skills,phase:central.favoriteItemPhase,cube:central.cubeId,equipmentAttack:central.equipmentAttack,equipmentHp:central.equipmentHp,equipmentDefense:central.equipmentDefense,slots:central.equipmentObservedSlots},precision:{total:precision.total,pass:precision.diagnostic.pass},simulation:{phase0:simulation.p0.member.damage,phase3:simulation.p3.member.damage,gearAttack:simulation.p3.member.damageBasis.gearAttack},fiveDeck:{candidates:fiveDeck.candidates,teams:fiveDeck.teams,unique:fiveDeck.unique,totalScore:fiveDeck.totalScore,capturedPhase:fiveDeck.capture.resolution.phase,elapsedMs:fiveDeck.elapsedMs,heartbeat:fiveDeck.heartbeat,diagnostics:fiveDeck.diagnostics},manual},null,2));
  console.log('V34.7.20 BlaBla + manual input -> My Roster -> Precision -> Solo Raid -> Simulation -> 5-deck input browser verification: PASS');
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
  const profileDir=path.join(ROOT,'.tmp-chrome-v3478');
  for(let attempt=0;attempt<8;attempt+=1){try{fs.rmSync(profileDir,{recursive:true,force:true,maxRetries:3,retryDelay:100});break;}catch(error){if(attempt===7)console.warn(`Chrome profile cleanup warning: ${error.message}`);else await new Promise(resolve=>setTimeout(resolve,150));}}
}
