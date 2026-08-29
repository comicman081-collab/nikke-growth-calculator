import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repair=fs.readFileSync(path.join(ROOT,'scripts','v34710-owned-roster-repair.js'),'utf8');
const baseHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HTML=baseHtml.replace(/<script id="v34710-owned-roster-repair">[\s\S]*?<\/script>/,()=>repair);
assert.notEqual(HTML,baseHtml,'current repair source was not injected');
assert.match(repair,/enumerateExchangeContenders\(rows,winnerPicks,fullRequired,limit=24\)/);
assert.match(repair,/fineOptimalWithinContenders:true,fineGlobalProven:false/);
assert.doesNotMatch(repair,/add\('fire-brid-specialist-b2'/,'Christmas Brid must not become a hard predicate');

const formerCover=[
 ['anisStar','prika','rapiRedHood','dieselWinterSweets','mint'],
 ['littleMermaid','nayuta','miharaBondingChain','alice','neonVisionEye'],
 ['toveTreasure','crown','dorothySerendipity','drakeTreasure','solineFrostTicket'],
 ['liter','grave','reiAyanami','cinderellaCrystalWave','modernia'],
 ['volume','bridSilentTrack','makotoNiijimaQueen','yukikoAmagi','naga']
].map(ids=>ids.slice().sort().join('|')).sort();

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
function chromeBinary(){const local=process.env.LOCALAPPDATA||'';for(const value of [process.env.CHROME_BIN,process.env.EDGE_BIN,local&&path.join(local,'Google','Chrome','Application','chrome.exe'),local&&path.join(local,'Microsoft','Edge','Application','msedge.exe'),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'])if(value&&fs.existsSync(value))return value;throw new Error('Chrome/Edge not found');}
async function waitJson(url,timeout=30000){const started=Date.now();let last;while(Date.now()-started<timeout){try{const response=await fetch(url);if(response.ok)return response.json();last=response.status;}catch(error){last=error;}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`CDP timeout: ${last}`);}
class Cdp{
 constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map();}
 async connect(){this.ws=new WebSocket(this.url);await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});this.ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);return message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);}for(const listener of this.listeners.get(message.method)||[])listener(message.params);});}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 on(method,listener){this.listeners.set(method,[...(this.listeners.get(method)||[]),listener]);}
 close(){try{this.ws?.close();}catch(_){}}
}
async function evaluate(cdp,expression,timeout=600000){let timer;try{const result=await Promise.race([cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`evaluate timeout ${timeout}ms`)),timeout);})]);if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;}finally{clearTimeout(timer);}}
async function waitFor(cdp,expression,timeout=240000){const started=Date.now();while(Date.now()-started<timeout){if(await evaluate(cdp,`Boolean(${expression})`,10000))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`condition timeout: ${expression}`);}
function fatal(entry){const level=String(entry?.level||entry?.type||'').toLowerCase(),text=String(entry?.text||entry?.args?.map(arg=>arg?.value||arg?.description||'').join(' ')||'');return['error','assert'].includes(level)&&!/autoplay|media|favicon|ERR_(?:BLOCKED_BY_CLIENT|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED)/i.test(text);}

const port=await freePort(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nikke-v34713-fine-rerank-'));
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-allow-origins=*','--js-flags=--max-old-space-size=128',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
let cdp;const exceptions=[],consoleErrors=[],crashes=[];
try{
 const pages=await waitJson(`http://127.0.0.1:${port}/json`),page=pages.find(row=>row.type==='page')||pages[0];cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.connect();
 cdp.on('Runtime.exceptionThrown',({exceptionDetails})=>exceptions.push(exceptionDetails?.exception?.description||exceptionDetails?.text));
 cdp.on('Runtime.consoleAPICalled',entry=>{if(fatal(entry))consoleErrors.push(entry.args?.map(arg=>arg.value||arg.description).join(' ')||entry.type);});
 cdp.on('Log.entryAdded',({entry})=>{if(fatal(entry))consoleErrors.push(entry.text||entry.level);});cdp.on('Inspector.targetCrashed',()=>crashes.push('Inspector.targetCrashed'));cdp.on('Page.crash',()=>crashes.push('Page.crash'));
 await Promise.all([cdp.send('Page.enable'),cdp.send('Runtime.enable'),cdp.send('Log.enable')]);await cdp.send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true});
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`const memoryStorage=()=>{const values=new Map();return{getItem:key=>values.has(String(key))?values.get(String(key)):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),key:index=>[...values.keys()][index]??null,get length(){return values.size;}}};try{localStorage.clear();sessionStorage.clear();}catch(_){try{Object.defineProperty(window,'localStorage',{value:memoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:memoryStorage(),configurable:true});}catch(__){}}try{Object.defineProperty(navigator,'deviceMemory',{value:4,configurable:true});}catch(_){}try{HTMLMediaElement.prototype.play=()=>Promise.resolve();}catch(_){}`});
 await cdp.send('Page.navigate',{url:'data:text/html,<html><body></body></html>'});await waitFor(cdp,`document.readyState==='complete'`,30000);const tree=await cdp.send('Page.getFrameTree');await cdp.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:HTML});
 await waitFor(cdp,`window.NIKKEV3420Run&&window.NIKKEV34713OwnedRosterRepair?.clearCache&&window.NIKKE_V26_ROSTER_API?.load`,240000);exceptions.length=consoleErrors.length=0;
 const setup=await evaluate(cdp,`(()=>{const catalog=[...new Map((NIKKE_V26_7_CHARACTER_CATALOG||[]).filter(row=>row?.id&&row.calculationSupported!==false).map(row=>[String(row.id),row])).values()],roster=NIKKE_V26_ROSTER_API.load();roster.characters||={};for(const row of catalog)roster.characters[row.id]={...(roster.characters[row.id]||{}),id:row.id,owned:true,level:400,limitBreak:0,coreLevel:0,bond:30,skills:{skill1:10,skill2:10,burst:10},favoriteItemPhase:roster.characters[row.id]?.favoriteItemPhase||0,cubeId:'none',manualRatio:0,measuredCoeff:1,overloadTotals:{atk:35,element:80,maxAmmo:130,critRate:10,critDamage:30,chargeSpeed:12,chargeDamage:0,hit:0,accuracy:0,defense:0},overload:{}};NIKKE_V26_ROSTER_API.save(roster);dispatchEvent(new Event('nikke:v26-roster-updated'));for(const id of ['soloBossSelect','v26OptimizerBoss']){const select=document.getElementById(id);if(select){select.value='luxuriousSpiderS40';select.dispatchEvent(new Event('change',{bubbles:true}));}}const mode=document.getElementById('v3413RosterMode');if(mode){mode.value='auto';mode.dispatchEvent(new Event('change',{bubbles:true}));}return{catalog:catalog.length,owned:NIKKE_V26_ROSTER_API.getOwned?.().length||0};})()`);
 assert.ok(setup.catalog>=100&&setup.owned>=100,JSON.stringify(setup));
 const report=await evaluate(cdp,`(async()=>{NIKKEV34713OwnedRosterRepair.clearCache();const started=performance.now(),result=await NIKKEV3420Run(),elapsedMs=performance.now()-started,diagnostics=result?.v34713Diagnostics||result?.diagnostics||{},summaries=diagnostics.fineContenderSummaries||[],selectedFingerprints=(result?.teams||[]).map(team=>(team.memberIds||team.members?.map(row=>row.id)||[]).map(String).sort().join('|')).sort();return{status:result?.status||null,elapsedMs,totalDamage:result?.totalDamage,selectedFingerprints,validation:result?.v34713Validation,coarseProven:diagnostics.constrainedFallback?.proven,coarseWinnerTotal:diagnostics.coarseWinnerTotal,contenderCoverCount:diagnostics.contenderCoverCount,fineValidContenderCount:diagnostics.fineValidContenderCount,fineUniqueTeamCount:diagnostics.fineUniqueTeamCount,fineWinnerTotal:diagnostics.fineWinnerTotal,rerankChanged:diagnostics.rerankChanged,rerankMs:diagnostics.rerankMs,fineOptimalWithinContenders:diagnostics.fineOptimalWithinContenders,fineGlobalProven:diagnostics.fineGlobalProven,exchangeNeighborhoodExhaustive:diagnostics.constrainedFallback?.exchangeNeighborhoodExhaustive,fineContenderSummaries:summaries.map(row=>({fineTotal:row.fineTotal,coarseTotal:row.coarseTotal,exchangeCount:row.exchangeCount,teamFingerprints:row.teamFingerprints}))};})()`,600000);
 const former=report.fineContenderSummaries.find(row=>JSON.stringify(row.teamFingerprints)===JSON.stringify(formerCover));
 assert.equal(report.status,'ok',JSON.stringify(report));assert.equal(report.validation?.pass,true,JSON.stringify(report.validation));assert.equal(report.coarseProven,true,'coarse global optimum must remain proven');
 assert.equal(report.exchangeNeighborhoodExhaustive,true);assert.ok(report.contenderCoverCount>=2&&report.contenderCoverCount<=24,`contenders ${report.contenderCoverCount}`);assert.equal(report.fineValidContenderCount,report.contenderCoverCount);assert.ok(report.fineUniqueTeamCount>=5&&report.fineUniqueTeamCount<=51,`unique fine teams ${report.fineUniqueTeamCount}`);
 assert.equal(report.fineOptimalWithinContenders,true);assert.equal(report.fineGlobalProven,false);assert.ok(Number.isFinite(report.coarseWinnerTotal)&&report.coarseWinnerTotal>0);assert.ok(Number.isFinite(report.fineWinnerTotal)&&report.fineWinnerTotal>0);assert.ok(Number.isFinite(report.rerankMs)&&report.rerankMs>0);
 assert.ok(former,`former valid fine cover missing from 1/2-team contender neighborhood: ${JSON.stringify(report.fineContenderSummaries)}`);assert.ok(report.fineWinnerTotal+1e-7>=former.fineTotal,`fine winner ${report.fineWinnerTotal} < former valid cover ${former.fineTotal}`);assert.ok(report.elapsedMs<35000,`fine rerank runtime ${report.elapsedMs.toFixed(0)}ms >= 35000ms`);
 assert.deepEqual(crashes,[]);assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
 console.log(JSON.stringify({version:'34.7.19',boss:'luxuriousSpiderS40',formerFineTotal:former.fineTotal,...report,pass:true},null,2));console.log('V34.7.19 coarse-to-fine 1/2-team contender rerank: PASS');
}finally{cdp?.close();if(chrome.exitCode===null)chrome.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,500));if(chrome.exitCode===null)chrome.kill('SIGKILL');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}}
