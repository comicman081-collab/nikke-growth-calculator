import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
function chromeBinary(){const l=process.env.LOCALAPPDATA||'';for(const p of [process.env.CHROME_BIN,process.env.EDGE_BIN,l&&path.join(l,'Google','Chrome','Application','chrome.exe'),l&&path.join(l,'Microsoft','Edge','Application','msedge.exe'),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'])if(p&&fs.existsSync(p))return p;throw new Error('Chrome/Edge not found');}
async function waitJson(url,timeout=30000){const started=Date.now();let last;while(Date.now()-started<timeout){try{const r=await fetch(url);if(r.ok)return r.json();last=r.status;}catch(e){last=e;}await new Promise(r=>setTimeout(r,100));}throw new Error(`CDP timeout: ${last}`);}
class Cdp{
 constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map();}
 async connect(){this.ws=new WebSocket(this.url);await new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',j,{once:true});});this.ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);return m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}for(const f of this.listeners.get(m.method)||[])f(m.params);});}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 on(method,fn){this.listeners.set(method,[...(this.listeners.get(method)||[]),fn]);}
 close(){try{this.ws?.close();}catch(_){}}
}
async function evaluate(cdp,expression,timeout=300000){let timer;try{const out=await Promise.race([cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`evaluate timeout ${timeout}`)),timeout);})]);if(out.exceptionDetails)throw new Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);return out.result?.value;}finally{clearTimeout(timer);}}
async function waitFor(cdp,expression,timeout=240000){const started=Date.now();while(Date.now()-started<timeout){if(await evaluate(cdp,`Boolean(${expression})`,10000))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`condition timeout: ${expression}`);}
function fatal(entry){const level=String(entry?.level||entry?.type||'').toLowerCase(),text=String(entry?.text||entry?.args?.map(a=>a?.value||a?.description||'').join(' ')||'');return ['error','assert'].includes(level)&&!/autoplay|media|favicon|ERR_(?:BLOCKED_BY_CLIENT|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED)/i.test(text);}

const port=await freePort(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nikke-moran-favorite-'));
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-allow-origins=*',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
let cdp;const runtimeExceptions=[],fatalConsole=[],pageCrashes=[];
try{
 const pages=await waitJson(`http://127.0.0.1:${port}/json`),page=pages.find(x=>x.type==='page')||pages[0];cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.connect();
 cdp.on('Runtime.exceptionThrown',({exceptionDetails})=>runtimeExceptions.push(exceptionDetails?.exception?.description||exceptionDetails?.text));
 cdp.on('Runtime.consoleAPICalled',e=>{if(fatal(e))fatalConsole.push(e.args?.map(a=>a.value||a.description).join(' ')||e.type);});
 cdp.on('Log.entryAdded',({entry})=>{if(fatal(entry))fatalConsole.push(entry.text||entry.level);});
 cdp.on('Inspector.targetCrashed',()=>pageCrashes.push('Inspector.targetCrashed'));cdp.on('Page.crash',()=>pageCrashes.push('Page.crash'));
 await Promise.all([cdp.send('Page.enable'),cdp.send('Runtime.enable'),cdp.send('Log.enable')]);
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  const memoryStorage=()=>{const m=new Map();return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size;}}};
  try{localStorage.clear();sessionStorage.clear();}catch(_){try{Object.defineProperty(window,'localStorage',{value:memoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:memoryStorage(),configurable:true});}catch(__){}}
  try{HTMLMediaElement.prototype.play=()=>Promise.resolve();}catch(_){}
 `});
 await cdp.send('Page.navigate',{url:'data:text/html,<html><body></body></html>'});await waitFor(cdp,`document.readyState==='complete'`,30000);const tree=await cdp.send('Page.getFrameTree');await cdp.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:HTML});
 await waitFor(cdp,`typeof NIKKEV34713EffectiveBurstCooldown==='function'&&NIKKEV340FinalOptimizer?.profilesFor&&NIKKEV340FinalOptimizer?.simulateCandidate&&NIKKEKitAwareOptimizer?.evaluateTeamRoles&&NIKKE_V3477_FAVORITE_REGISTRY`,240000);
 runtimeExceptions.length=fatalConsole.length=0;
 const result=await evaluate(cdp,`(()=>{
  const final=NIKKEV340FinalOptimizer,kit=NIKKEKitAwareOptimizer;
  final.ensureV3413RosterModeControl();const mode=document.getElementById('v3413RosterMode');if(mode){mode.value='allEqual';mode.dispatchEvent(new Event('change',{bubbles:true}));}
  for(const id of ['soloBossSelect','v26OptimizerBoss']){const s=document.getElementById(id);if(s){s.value='annihilio';s.dispatchEvent(new Event('change',{bubbles:true}));}}
  const equal=final.resolveV3413RunRosterInput(),favoriteIds=Object.keys(NIKKE_V3477_FAVORITE_REGISTRY||{}),equalById=new Map(equal.owned.map(x=>[String(x.id),x]));
  const favoriteRows=favoriteIds.map(id=>({id,row:equalById.get(id)||null}));
  const phase3=final.profilesFor(window,equal.owned),m3=phase3.map.get('moranTreasure');
  const phase0Owned=equal.owned.map(row=>String(row.id)==='moranTreasure'?{...row,favoriteItemPhase:0}:row),phase0=final.profilesFor(window,phase0Owned),m0=phase0.map.get('moranTreasure');
  const cooldown0=NIKKEV34713EffectiveBurstCooldown(m0,1),cooldown3=NIKKEV34713EffectiveBurstCooldown(m3,1);
  const boss=kit.normalizeBoss(kit.readBossFromPage(window));
  const generated=kit.generateCandidates({profiles:phase3.profiles,boss}),moranCandidates=(generated.candidates||[]).filter(c=>String(c?.roles?.b1?.id||'')==='moranTreasure');
  const sim0=moranCandidates.length?final.simulateCandidate(moranCandidates[0],boss,phase0.map,.5):{ok:false,reason:'candidate unavailable'};
  let sim3={ok:false,reason:'no valid Moran timeline'};const sim3Reasons={};for(const candidate of moranCandidates){const attempt=final.simulateCandidate(candidate,boss,phase3.map,.5);if(attempt?.ok){sim3=attempt;break;}const reason=String(attempt?.reason||'unknown');sim3Reasons[reason]=(sim3Reasons[reason]||0)+1;}
  return{resolver:{requested:equal.requested,mode:equal.mode,count:equal.owned.length},favoriteCount:favoriteIds.length,
   favoriteRowsAllPhase3:favoriteRows.every(x=>x.row?.favoriteItemPhase===3),favoriteRowsMissing:favoriteRows.filter(x=>!x.row).map(x=>x.id),
   favoriteRowsWrongPhase:favoriteRows.filter(x=>x.row&&x.row.favoriteItemPhase!==3).map(x=>({id:x.id,phase:x.row.favoriteItemPhase})),
   profileFavoritesAllPhase3:favoriteIds.every(id=>phase3.map.get(id)?.growth?.favoriteItemPhase===3),
   profileFavoritesWrong:favoriteIds.filter(id=>phase3.map.get(id)?.growth?.favoriteItemPhase!==3).map(id=>({id,phase:phase3.map.get(id)?.growth?.favoriteItemPhase})),
   moran:{phase0:m0?.growth?.favoriteItemPhase,phase3:m3?.growth?.favoriteItemPhase,cooldown0,cooldown3},
   generatedMoranCandidates:moranCandidates.length,
   simulation:{phase0:{ok:sim0?.ok,reason:sim0?.reason||null,fullBurstCount:sim0?.simulation?.fullBurstCount||0},phase3:{ok:sim3?.ok,reason:sim3?.reason||null,fullBurstCount:sim3?.simulation?.fullBurstCount||0,totalDamage:sim3?.simulation?.totalDamage||0,rejectedReasons:sim3Reasons}}};
 })()`,300000);
 assert.equal(result.resolver.requested,'allEqual');assert.equal(result.resolver.mode,'allEqual');assert.ok(result.resolver.count>=100);
 assert.ok(result.favoriteCount>=1);assert.equal(result.favoriteRowsAllPhase3,true,JSON.stringify(result));assert.deepEqual(result.favoriteRowsMissing,[]);assert.deepEqual(result.favoriteRowsWrongPhase,[]);
 assert.equal(result.profileFavoritesAllPhase3,true,JSON.stringify(result.profileFavoritesWrong));assert.deepEqual(result.profileFavoritesWrong,[]);
 assert.equal(result.moran.phase0,0);assert.equal(result.moran.phase3,3);assert.equal(result.moran.cooldown0,40);assert.equal(result.moran.cooldown3,20);
 assert.ok(result.generatedMoranCandidates>0,JSON.stringify(result));assert.equal(result.simulation.phase0.ok,false,JSON.stringify(result.simulation.phase0));assert.match(result.simulation.phase0.reason,/unsustained-b1:moranTreasure:40/);
 assert.equal(Object.keys(result.simulation.phase3.rejectedReasons).some(reason=>/unsustained-b1:moranTreasure:40/.test(reason)),false,JSON.stringify(result.simulation.phase3));
 assert.equal(result.simulation.phase3.ok,true,JSON.stringify(result.simulation.phase3));assert.ok(result.simulation.phase3.fullBurstCount>=14,JSON.stringify(result.simulation.phase3));assert.ok(result.simulation.phase3.totalDamage>0);
 assert.equal(pageCrashes.length,0);assert.equal(runtimeExceptions.length,0,runtimeExceptions.join('\n'));assert.equal(fatalConsole.length,0,fatalConsole.join('\n'));
 console.log(JSON.stringify({...result,runtimeExceptions,fatalConsole,pageCrashes,pass:true},null,2));console.log('Moran favorite cooldown/equal-growth propagation verification: PASS');
}finally{cdp?.close();if(chrome.exitCode===null)chrome.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));if(chrome.exitCode===null)chrome.kill('SIGKILL');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}}
