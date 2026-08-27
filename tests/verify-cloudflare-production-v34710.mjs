import assert from 'node:assert/strict';
import fs from 'node:fs';

const VERSION='34.7.13';
const BASE=String(process.env.CLOUDFLARE_PRODUCTION_URL||'https://nikke-growth-calculator.breezy-mum.workers.dev').replace(/\/+$/,'');
const PROFILE=process.env.BLABLA_PUBLIC_PROFILE||'https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=';
const REPORT=process.env.CLOUDFLARE_LIVE_REPORT||'V34712_CLOUDFLARE_RESULTS.json';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={},timeout=45000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{redirect:'follow',cache:'no-store',...options,signal:controller.signal});}finally{clearTimeout(timer);}}
async function textResponse(url,options){const response=await request(url,options);return{response,text:await response.text()};}
async function jsonResponse(url,options){const {response,text}=await textResponse(url,options);let json;try{json=JSON.parse(text);}catch{throw new Error(`${url} returned non-JSON HTTP ${response.status}: ${text.slice(0,300)}`);}return{response,json};}

let html='',status=0,headers={},last='';
for(let attempt=1;attempt<=90;attempt+=1){try{const result=await textResponse(`${BASE}/?_v34712=${encodeURIComponent(process.env.GITHUB_SHA||'manual')}-${attempt}`,{headers:{'cache-control':'no-cache','user-agent':'nikke-v34712-live-verifier/1.0'}});status=result.response.status;headers=Object.fromEntries(result.response.headers.entries());html=result.text;if(result.response.ok&&html.includes('V34.7.13')&&html.includes('id="v34711-linked-roster-refresh"'))break;last=`attempt ${attempt}: HTTP ${result.response.status}; version=${html.includes('V34.7.13')}; marker=${html.includes('id="v34711-linked-roster-refresh"')}`;}catch(error){last=`attempt ${attempt}: ${error.message}`;}if(attempt<90)await delay(8000);}
assert.ok(html.includes('V34.7.13'),`Cloudflare production did not expose V34.7.13: ${last}`);
assert.ok(html.includes('id="v34711-linked-roster-refresh"'),`linked-roster refresh marker missing: ${last}`);
assert.ok(html.includes('id="v3478-blabla-propagation"'),'four-surface propagation marker missing');
assert.ok(html.includes('연동 데이터 새로고침'),'manual refresh UI missing');
assert.ok(html.includes('목요일 11:00 / 19:00 KST'),'Thursday schedule UI missing');
assert.ok(/cloudflare/i.test(headers.server||'')||headers['cf-ray'],'Cloudflare response headers missing');

const common={Origin:BASE,Referer:`${BASE}/`,'cache-control':'no-cache','user-agent':'nikke-v34712-live-verifier/1.0'};
const probe=await jsonResponse(`${BASE}/api/blabla/sync?_v34712=${Date.now()}`,{headers:common});
assert.equal(probe.response.status,200,`bridge probe HTTP ${probe.response.status}`);assert.equal(probe.json.ok,true,'bridge probe ok');assert.equal(probe.json.version,VERSION,'bridge version');assert.equal(probe.json.configured,true,'bridge secrets configured');assert.ok(Array.isArray(probe.json.games)&&probe.json.games.includes('29080'),'global game configured');

let live=null,liveFixture={status:'not-run',httpStatus:null,code:null,error:null,characterCount:0,detailCount:0,effectCount:0,areas:[]};
for(let attempt=1;attempt<=3;attempt+=1){try{live=await jsonResponse(`${BASE}/api/blabla/sync`,{method:'POST',headers:{...common,'content-type':'application/json'},body:JSON.stringify({profileUrl:PROFILE,serverHint:'GLOBAL'})});if(live.response.status===200&&live.json?.ok===true)break;liveFixture={...liveFixture,status:'external-fixture-unavailable',httpStatus:live.response.status,code:live.json?.code||null,error:live.json?.error||null};}catch(error){liveFixture={...liveFixture,status:'external-fixture-unavailable',error:String(error?.message||error)};}if(attempt<3)await delay(12000);}
if(live?.response.status===200&&live.json?.ok===true){assert.equal(live.json.version,VERSION,'live response version');const areas=Array.isArray(live.json.areas)?live.json.areas:[],characterCount=areas.reduce((s,a)=>s+(Array.isArray(a.characters)?a.characters.length:0),0),detailCount=areas.reduce((s,a)=>s+(Array.isArray(a.details)?a.details.length:0),0),effectCount=areas.reduce((s,a)=>s+(Array.isArray(a.stateEffects)?a.stateEffects.length:0),0),returned=areas.map(a=>Number(a.area)).filter(Number.isFinite),supported=new Set([81,82,83,84,85,91]);assert.ok(characterCount>=25,'live roster must contain at least 25 characters');assert.ok(detailCount>=25,'live roster details must contain at least 25 characters');assert.ok(returned.length&&returned.every(a=>supported.has(a)),`unsupported area: ${returned.join(',')}`);liveFixture={status:'pass',httpStatus:200,code:null,error:null,characterCount,detailCount,effectCount,areas:areas.map(a=>({area:a.area,characters:a.characters?.length||0,details:a.details?.length||0,stateEffects:a.stateEffects?.length||0}))};}

const report={version:VERSION,verifiedAtUtc:new Date().toISOString(),githubSha:process.env.GITHUB_SHA||null,productionUrl:BASE,html:{status,bytes:Buffer.byteLength(html),server:headers.server||null,cfRay:headers['cf-ray']||null,versionMarker:true,refreshMarker:true,propagationMarker:true},bridgeProbe:{status:probe.response.status,version:probe.json.version,configured:probe.json.configured,games:probe.json.games},liveFixture,pass:true};
fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log(`V34.7.13 Cloudflare production HTML + Worker bridge probe + refresh UI verification: PASS; live fixture=${liveFixture.status}`);
