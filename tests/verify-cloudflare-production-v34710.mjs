import assert from 'node:assert/strict';
import fs from 'node:fs';

const VERSION='34.7.10';
const BASE=String(process.env.CLOUDFLARE_PRODUCTION_URL||'https://nikke-growth-calculator.breezy-mum.workers.dev').replace(/\/+$/,'');
const PROFILE=process.env.BLABLA_PUBLIC_PROFILE||'https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=';
const REPORT=process.env.CLOUDFLARE_LIVE_REPORT||'V34710_CLOUDFLARE_RESULTS.json';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(url,options={},timeout=45000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{redirect:'follow',cache:'no-store',...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function textResponse(url,options){const response=await request(url,options);return{response,text:await response.text()};}
async function jsonResponse(url,options){const {response,text}=await textResponse(url,options);let json;try{json=JSON.parse(text);}catch{throw new Error(`${url} returned non-JSON HTTP ${response.status}: ${text.slice(0,300)}`);}return{response,json};}

let html='',status=0,headers={},last='';
for(let attempt=1;attempt<=90;attempt+=1){
  try{
    const result=await textResponse(`${BASE}/?_v34710=${encodeURIComponent(process.env.GITHUB_SHA||'manual')}-${attempt}`,{headers:{'cache-control':'no-cache','user-agent':'nikke-v34710-live-verifier/1.0'}});
    status=result.response.status;headers=Object.fromEntries(result.response.headers.entries());html=result.text;
    if(result.response.ok&&html.includes('V34.7.10')&&html.includes('id="v34710-owned-roster-repair"'))break;
    last=`attempt ${attempt}: HTTP ${result.response.status}; version=${html.includes('V34.7.10')}; marker=${html.includes('id="v34710-owned-roster-repair"')}`;
  }catch(error){last=`attempt ${attempt}: ${error.message}`;}
  if(attempt<90)await delay(8000);
}
assert.ok(html.includes('V34.7.10'),`Cloudflare production did not expose V34.7.10: ${last}`);
assert.ok(html.includes('id="v34710-owned-roster-repair"'),`owned-roster repair marker missing: ${last}`);
assert.ok(html.includes('id="v3478-blabla-propagation"'),'four-surface propagation marker missing');
assert.ok(html.includes('연동 186명')||html.includes('보유 저장'),'truthful linked-roster status text missing');
assert.ok(/cloudflare/i.test(headers.server||'')||headers['cf-ray'],'Cloudflare response headers missing');

const common={Origin:BASE,Referer:`${BASE}/`,'cache-control':'no-cache','user-agent':'nikke-v34710-live-verifier/1.0'};
const probe=await jsonResponse(`${BASE}/api/blabla/sync?_v34710=${Date.now()}`,{headers:common});
assert.equal(probe.response.status,200,`bridge probe HTTP ${probe.response.status}`);
assert.equal(probe.json.ok,true,'bridge probe ok');
assert.equal(probe.json.version,VERSION,'bridge version');
assert.equal(probe.json.configured,true,'bridge secrets configured');
assert.ok(Array.isArray(probe.json.games)&&probe.json.games.includes('29080'),'global game configured');

const live=await jsonResponse(`${BASE}/api/blabla/sync`,{method:'POST',headers:{...common,'content-type':'application/json'},body:JSON.stringify({profileUrl:PROFILE,serverHint:'GLOBAL'})});
assert.equal(live.response.status,200,`live bridge HTTP ${live.response.status}: ${JSON.stringify(live.json).slice(0,500)}`);
assert.equal(live.json.ok,true,`live bridge failed: ${JSON.stringify(live.json).slice(0,500)}`);
assert.equal(live.json.version,VERSION,'live response version');
const areas=Array.isArray(live.json.areas)?live.json.areas:[];
const characterCount=areas.reduce((sum,area)=>sum+(Array.isArray(area.characters)?area.characters.length:0),0);
const detailCount=areas.reduce((sum,area)=>sum+(Array.isArray(area.details)?area.details.length:0),0);
const effectCount=areas.reduce((sum,area)=>sum+(Array.isArray(area.stateEffects)?area.stateEffects.length:0),0);
const returnedAreas=areas.map(area=>Number(area.area)).filter(Number.isFinite),supported=new Set([81,82,83,84,85,91]);
assert.ok(characterCount>=25,'live roster must contain at least 25 characters');
assert.ok(detailCount>=25,'live roster details must contain at least 25 characters');
assert.ok(returnedAreas.length&&returnedAreas.every(area=>supported.has(area)),`unsupported area: ${returnedAreas.join(',')}`);

const report={version:VERSION,verifiedAtUtc:new Date().toISOString(),githubSha:process.env.GITHUB_SHA||null,productionUrl:BASE,html:{status,bytes:Buffer.byteLength(html),server:headers.server||null,cfRay:headers['cf-ray']||null,versionMarker:true,repairMarker:true,propagationMarker:true},bridgeProbe:{status:probe.response.status,configured:probe.json.configured,games:probe.json.games},liveSync:{status:live.response.status,maskedOpenId:live.json.profile?.maskedOpenId||null,areas:areas.map(area=>({area:area.area,characters:area.characters?.length||0,details:area.details?.length||0,stateEffects:area.stateEffects?.length||0})),characterCount,detailCount,effectCount},pass:true};
fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log('V34.7.10 Cloudflare production + live BlaBla bridge verification: PASS');
