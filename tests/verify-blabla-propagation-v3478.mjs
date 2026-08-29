import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseProfileInput, areaCandidates, syncPublicRoster } from '../functions/api/blabla/sync.js';

const rootHtml=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert.equal(rootHtml,publicHtml,'root/public index mismatch');
assert.match(rootHtml,/V34\.7\.14/,'V34.7.14 branding');
assert.match(rootHtml,/id="v3478-blabla-propagation"/,'propagation diagnostics');
assert.match(rootHtml,/source: 'v3478-optimizer-central-roster'/,'5-deck context source');
assert.match(rootHtml,/favoriteItemPhase: finite\(growth\.favoriteItemPhase, 0\)/,'5-deck favorite phase');
assert.match(rootHtml,/equipmentAttack: growth\.equipmentAttack != null/,'5-deck equipment ATK');
assert.match(rootHtml,/equipmentHp: growth\.equipmentHp != null/,'5-deck equipment HP');
assert.match(rootHtml,/equipmentDefense: growth\.equipmentDefense != null/,'5-deck equipment DEF');
assert.match(rootHtml,/equipmentObservedSlots: finite\(growth\.equipmentObservedSlots, 0\)/,'5-deck observed equipment slots');
assert.match(rootHtml,/overload,\r?\n\s*cubeId:/,'5-deck overload object');
assert.match(rootHtml,/equipmentHp:g\.equipmentHp!=null\?finite\(g\.equipmentHp\):null/,'shared context HP');
assert.match(rootHtml,/equipmentDefense:g\.equipmentDefense!=null\?finite\(g\.equipmentDefense\):null/,'shared context DEF');
assert.match(rootHtml,/정밀\/내 로스터\/시뮬레이션\/5덱 자동/,'four-surface sync status');
assert.match(rootHtml,/정밀·내 로스터·시뮬레이션·5덱 자동/,'four-surface sync result');

const parsed=parseProfileInput('https://www.blablalink.com/shiftyspad/nikke-list?openid=MjkwODAtMTczODk5ODEwMzMzMTgwOTYwMDc=');
assert.deepEqual(parsed,{intlGameId:'29080',intlOpenId:'17389981033318096007',encodedValue:'29080-17389981033318096007'});
assert.deepEqual(areaCandidates('29080','GLOBAL'),[84,81,82,83,85]);

const env={BLABLA_29080_GAME_TOKEN:'token',BLABLA_29080_GAME_OPENID:'service-openid'};
const summaries=[
  {name_code:5002,lv:450,combat:999999,arena_combat:888888,grade:3,core:5},
  {name_code:5065,lv:447,combat:777777,arena_combat:666666,grade:3,core:4},
];
const details=[
  {name_code:5002,skill1_lv:2,skill2_lv:7,ulti_skill_lv:9,attractive_lv:40,favorite_item_tid:202101,favorite_item_lv:2,harmony_cube_tid:1000317,harmony_cube_lv:15,head_equip_tid:1,head_equip_tier:9,head_equip_lv:5,head_equip_option1_id:9101},
  {name_code:5065,skill1_lv:10,skill2_lv:10,ulti_skill_lv:10,attractive_lv:30,favorite_item_tid:0,favorite_item_lv:0,harmony_cube_tid:0,harmony_cube_lv:0},
];
const stateEffects=[{id:9101,function_details:[{function_type:'StatAtk',function_value:3120}]}];
const calls=[];
const fakeFetch=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body});
  if(url.endsWith('/GetUserCharacters'))return new Response(JSON.stringify({code:0,data:{characters:body.nikke_area_id===84?summaries:[]}}),{status:200,headers:{'content-type':'application/json'}});
  if(url.endsWith('/GetUserCharacterDetails'))return new Response(JSON.stringify({code:0,data:{character_details:details,state_effects:stateEffects}}),{status:200,headers:{'content-type':'application/json'}});
  throw new Error(`unexpected URL ${url}`);
};
const synced=await syncPublicRoster({profileInput:'29080-17389981033318096007',serverHint:'GLOBAL',env,fetchImpl:fakeFetch});
assert.equal(synced.ok,true);
assert.equal(synced.version,'34.7.14');
assert.equal(synced.areas.length,1);
assert.equal(synced.areas[0].area,84);
assert.deepEqual(synced.areas[0].characters,summaries);
assert.deepEqual(synced.areas[0].details,details);
assert.deepEqual(synced.areas[0].stateEffects,stateEffects);
assert.equal(calls.filter(call=>call.url.endsWith('/GetUserCharacters')).length,5,'all official areas audited');
assert.equal(calls.filter(call=>call.url.endsWith('/GetUserCharacterDetails')).length,1,'one detail batch for populated area');
console.log('V34.7.14 BlaBla bridge + four-surface propagation static verification: PASS');
