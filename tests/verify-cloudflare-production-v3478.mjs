import assert from 'node:assert/strict';
import fs from 'node:fs';

const VERSION='34.7.8';
const BASE=String(process.env.CLOUDFLARE_PRODUCTION_URL||'https://nikke-growth-calculator.breezy-mum.workers.dev').replace(/\/+$/,'');
const PROFILE=process.env.BLABLA_PUBLIC_PROFILE||'https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTExMTIyMjIzMzMzNDQ0NDU1NTU=';
const REPORT=process.env.CLOUDFLARE_LIVE_REPORT||'V3478_CLOUDFLARE_LIVE_RESULTS.json';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(url,options={},timeout=30000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{redirect:'follow',cache:'no-store',...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function textResponse(url,options){
  const response=await request(url,options);
  const text=await response.text();
  return{response,text};
}
async function jsonResponse(url,options){
  const {response,text}=await textResponse(url,options);
  let json;
  try{json=JSON.parse(text);}catch{throw new Error(`${url} returned non-JSON HTTP ${response.status}: ${text.slice(0,300)}`);}
  return{response,json};
}

let deployedHtml='';
let htmlStatus=0;
let htmlHeaders={};
let lastError='';
for(let attempt=1;attempt<=90;attempt+=1){
  try{
    const result=await textResponse(`${BASE}/?_v3478=${encodeURIComponent(process.env.GITHUB_SHA||'manual')}-${attempt}`,{headers:{'cache-control':'no-cache','user-agent':'nikke-v3478-live-verifier/1.0'}});
    htmlStatus=result.response.status;
    htmlHeaders=Object.fromEntries(result.response.headers.entries());
    deployedHtml=result.text;
    if(result.response.ok&&deployedHtml.includes('V34.7.8')&&deployedHtml.includes('id="v3478-blabla-propagation"'))break;
    lastError=`attempt ${attempt}: HTTP ${result.response.status}; v3478=${deployedHtml.includes('V34.7.8')}; marker=${deployedHtml.includes('id="v3478-blabla-propagation"')}`;
  }catch(error){lastError=`attempt ${attempt}: ${error.message}`;}
  if(attempt<90)await delay(8000);
}
assert.ok(deployedHtml.includes('V34.7.8'),`Cloudflare production did not expose V34.7.8: ${lastError}`);
assert.ok(deployedHtml.includes('id="v3478-blabla-propagation"'),`Cloudflare production propagation marker missing: ${lastError}`);
assert.ok(deployedHtml.includes('정밀/내 로스터/시뮬레이션/5덱 자동')||deployedHtml.includes('정밀·내 로스터·시뮬레이션·5덱 자동'),'four-surface production message missing');

const commonHeaders={Origin:BASE,'cache-control':'no-cache','user-agent':'nikke-v3478-live-verifier/1.0'};
const probe=await jsonResponse(`${BASE}/api/blabla/sync?_v3478=${Date.now()}`,{headers:commonHeaders});
assert.equal(probe.response.status,200,`bridge probe HTTP ${probe.response.status}`);
assert.equal(probe.json.ok,true,'bridge probe ok');
assert.equal(probe.json.version,VERSION,'bridge deployed version');
assert.equal(probe.json.configured,true,'BlaBla Cloudflare secrets configured');
assert.ok(Array.isArray(probe.json.games)&&probe.json.games.includes('29080'),'global BlaBla game configured');

const live=await jsonResponse(`${BASE}/api/blabla/sync`,{
  method:'POST',
  headers:{...commonHeaders,'content-type':'application/json'},
  body:JSON.stringify({profileUrl:PROFILE,serverHint:'GLOBAL'})
});
assert.equal(live.response.status,200,`live bridge HTTP ${live.response.status}: ${JSON.stringify(live.json).slice(0,500)}`);
assert.equal(live.json.ok,true,`live bridge failed: ${JSON.stringify(live.json).slice(0,500)}`);
assert.equal(live.json.version,VERSION,'live bridge result version');
assert.ok(Array.isArray(live.json.areas)&&live.json.areas.length>0,'live bridge area');
const characterCount=live.json.areas.reduce((sum,area)=>sum+(Array.isArray(area.characters)?area.characters.length:0),0);
const detailCount=live.json.areas.reduce((sum,area)=>sum+(Array.isArray(area.details)?area.details.length:0),0);
const effectCount=live.json.areas.reduce((sum,area)=>sum+(Array.isArray(area.stateEffects)?area.stateEffects.length:0),0);
const returnedAreas=live.json.areas.map(area=>Number(area.area)).filter(Number.isFinite);
const supportedGlobalAreas=new Set([81,82,83,84,85]);
assert.ok(characterCount>0,'live character summaries');
assert.ok(detailCount>0,'live character details');
assert.ok(returnedAreas.length>0&&returnedAreas.every(area=>supportedGlobalAreas.has(area)),`unsupported 29080 area: ${returnedAreas.join(',')}`);

const report={
  version:VERSION,
  verifiedAtUtc:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA||null,
  productionUrl:BASE,
  html:{status:htmlStatus,bytes:Buffer.byteLength(deployedHtml),versionMarker:true,propagationMarker:true,cfRay:htmlHeaders['cf-ray']||null,server:htmlHeaders.server||null},
  bridgeProbe:{status:probe.response.status,configured:probe.json.configured,games:probe.json.games},
  liveSync:{status:live.response.status,maskedOpenId:live.json.profile?.maskedOpenId||null,areas:live.json.areas.map(area=>({area:area.area,characters:area.characters?.length||0,details:area.details?.length||0,stateEffects:area.stateEffects?.length||0})),returnedAreas,characterCount,detailCount,effectCount,attempts:live.json.diagnostics?.attempts||[]}
};
fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log('V34.7.8 Cloudflare production HTML + configured bridge + live BlaBla roster verification: PASS');
