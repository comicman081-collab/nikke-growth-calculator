import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseProfileInput, areaCandidates, syncPublicRoster } from '../functions/api/blabla/sync.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const rootHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(rootHtml, html, 'root/public index mismatch');
assert.match(html, /id="v3474-deploy-autosync"/);
assert.match(html, /location\.origin}\/api\/blabla/);
assert.match(html, /nikke_v3474_deploy_blablalink_profile/);
assert.match(html, /접속 시 자동 동기화/);
assert.match(html, /dataset\.v3474Deploy/);
assert.match(html, /sessionStorage/);
assert.match(html, /NIKKEV3474DeployAutoSyncVerification/);
// BlaBla/ENIKK nameCode is the character identity authority. Display names may collide.
assert.match(html, /NIKKEV3476NameCodeMapping/);
assert.match(html, /favoriteAppId\|\|idForNameCode\(row\.nameCode\)\|\|supplementalId\(row\.nameCode\)/);
assert.match(html, /"5118":"asukaShikinamiLangley"/);
assert.match(html, /"5119":"reiAyanami"/);
assert.match(html, /"5132":"reiAyanamiTentative"/);
assert.match(html, /"5133":"asukaWille"/);
assert.match(html, /"5016":"poliTreasure"/);
assert.match(html, /"5045":"rosannaTreasure"/);
assert.match(html, /"5120":"mariMakinami"/);
assert.match(html, /"5122":"phantomTreasure"/);
assert.match(html, /"5153":"jillValentine"/);
assert.doesNotMatch(html, /"5069":"reiAyanami"/);

const parsed = parseProfileInput('https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=');
assert.equal(parsed.intlGameId, '29080');
assert.equal(parsed.intlOpenId, '17389981033318096007');
assert.deepEqual(areaCandidates('29080','GLOBAL'), [84,81,82,83,85]);

const env={BLABLA_29080_GAME_TOKEN:'tok',BLABLA_29080_GAME_OPENID:'goid'};
const summaries=[{name_code:5011,lv:450,combat:100,grade:3,core:5}];
const detail={name_code:5011,skill1_lv:10,skill2_lv:9,ulti_skill_lv:10,harmony_cube_tid:101,harmony_cube_lv:15};
const fakeFetch=async (url,init)=>{
  const body=JSON.parse(init.body);
  if(url.endsWith('/GetUserCharacters')){
    return new Response(JSON.stringify({code:0,data:{characters: body.nikke_area_id===84?summaries:[]}}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.endsWith('/GetUserCharacterDetails')){
    return new Response(JSON.stringify({code:0,data:{character_details:[detail],state_effects:[]}}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`unexpected ${url}`);
};
const synced=await syncPublicRoster({profileInput:'29080-17389981033318096007',serverHint:'GLOBAL',env,fetchImpl:fakeFetch});
assert.equal(synced.ok,true);
assert.equal(synced.areas.length,1);
assert.equal(synced.areas[0].area,84);
assert.equal(synced.areas[0].details[0].skill1_lv,10);
console.log('V34.7.9 deploy autosync + TID/nameCode authority verification: PASS');
