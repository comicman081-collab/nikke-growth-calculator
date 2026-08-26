import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert.equal(html,publicHtml,'root/public index mismatch');
assert.match(html,/id="v3477-favorite-phase-skill-resolver"/);
assert.doesNotMatch(html,/favoriteItemPhase=Math\.max\([^;]+,3\)/,'migration must not force phase 3');
assert.match(html,/preferredPhase=b\.owned===true/,'migration must prefer the owned row phase');
assert.match(html,/const skillValue=key=>/,'migration must preserve source skill levels');
assert.match(html,/favoriteItemPhase:profile\?\.growth\?\.favoriteItemPhase/,'optimizer context must consume growth phase');

const match=html.match(/<script id="v3477-favorite-phase-skill-resolver">([\s\S]*?)<\/script>/);
assert.ok(match,'V34.7.7 runtime script missing');
const runtime=match[1];
const levels={skill1:2,skill2:7,burst:9};
const baseCycle=(id,_prof,ctx={})=>{
  if(id!=='sugarTreasure')return {};
  const cover=Number.isFinite(Number(ctx.sustainedUptime))?Number(ctx.sustainedUptime):Number(ctx.cond)||0;
  const fb=Number(ctx.fb)||0,duration=Number(ctx.duration)||0,uses=Number(ctx.ownUsesCount);
  const own15=duration>0&&Number.isFinite(uses)?Math.min(1,Math.max(0,uses*15/duration)):Math.min(1,Math.max(0,(Number(ctx.own)||0)*1.5));
  return {reload:12.12*cover,ammoPct:83.8*fb,attackSpeed:66*own15};
};
const baseDamage=(id,_p,_prof,_sim,ctx={})=>{
  if(id!=='sugarTreasure')return {skill:0,burst:0,trueUnits:0};
  const cover=Number.isFinite(Number(ctx.sustainedUptime))?Number(ctx.sustainedUptime):Number(ctx.cond)||0;
  const fb=Number(ctx.fb)||0,duration=Number(ctx.duration)||0,uses=Number(ctx.ownUsesCount);
  const own15=duration>0&&Number.isFinite(uses)?Math.min(1,Math.max(0,uses*15/duration)):Math.min(1,Math.max(0,(Number(ctx.own)||0)*1.5));
  return {atk:25.01*fb+20*own15,dmg:19.98*cover,critRate:13.02*fb,critDmg:16.39*cover,strongElementDmg:ctx.hasElement?40.02*fb+60.01*own15:0,skill:0,burst:0,trueUnits:0};
};
const window={
  __baseCycle:baseCycle,
  __baseDamage:baseDamage,
  document:{readyState:'complete',addEventListener(){},querySelectorAll(){return [];},getElementById(){return null;}},
  setTimeout(){return 0;},
  NIKKE_V26_SKILL_DATA_API:{levelsFor(){return {...levels};},factorFor(){return 1;}},
  NIKKE_V26_ROSTER_API:{load(){return {characters:{}};}}
};
const context=vm.createContext({window,console,Object,Array,Number,String,Math,JSON,Set,Map});
vm.runInContext('var v21SkillCycle=window.__baseCycle;var v21DamageModel=window.__baseDamage;'+runtime,context,{filename:'v3477-favorite-phase-runtime.js'});
const api=window.NIKKE_V3477_FAVORITE_PHASE_API;
assert.ok(api,'favorite phase API missing');
assert.equal(api.version,'34.7.7');

const favorites={'200401':{rare:'SSR'},'200501':{rare:'SSR'},'201001':{rare:'SSR'},'100402':{rare:'SR'}};
for(const [lv,phase] of [[0,1],[1,2],[2,3],[9,3]]){
  const imported=api.fromEnikk({favoriteItemTid:200501,favoriteItemLv:lv,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},favorites);
  assert.equal(imported.phase,phase,`ENIKK favoriteItemLv ${lv}`);
  assert.deepEqual({...imported.skills},levels,'skill levels must be independent of favorite phase');
}
assert.equal(api.fromEnikk({favoriteItemTid:100402,favoriteItemLv:2,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},favorites).phase,0,'non-SSR collection is not a favorite phase');
assert.equal(api.fromEnikk({favoriteItemTid:0,favoriteItemLv:2,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},favorites).phase,0,'missing TID is phase 0');

const expected={
  poliTreasure:{tid:'201001',slots:['skill1','burst','skill2']},
  sugarTreasure:{tid:'200501',slots:['skill1','skill2','burst']},
  laplaceTreasure:{tid:'200401',slots:['skill2','burst','skill1']}
};
for(const [id,spec] of Object.entries(expected)){
  for(let phase=0;phase<=3;phase++){
    const resolved=api.resolve(id,phase,levels);
    assert.equal(resolved.tid,spec.tid,`${id} TID`);
    assert.deepEqual([...resolved.phaseSlots],spec.slots,`${id} phase order`);
    assert.deepEqual([...resolved.activeSlots],spec.slots.slice(0,phase),`${id} active slots at phase ${phase}`);
    assert.deepEqual({...resolved.skillLevels},levels,`${id} skill levels preserved at phase ${phase}`);
  }
  assert.notEqual(api.resolve(id,0,levels).signature,api.resolve(id,3,levels).signature,`${id} normal/favorite signature must differ`);
}

const callCycle=(id,phase,extra={})=>context.v21SkillCycle(id,{}, {favoriteItemPhase:phase,fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9,...extra});
const callDamage=(id,phase,sim={},extra={})=>context.v21DamageModel(id,{}, {},sim,{favoriteItemPhase:phase,fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9,hasElement:true,...extra});

const sugarNormalCycle=callCycle('sugarTreasure',0),sugarFavoriteCycle=callCycle('sugarTreasure',3);
assert.ok(sugarFavoriteCycle.reload>sugarNormalCycle.reload,'Sugar P1 changes reload calculation');
assert.ok(sugarFavoriteCycle.ammoPct>sugarNormalCycle.ammoPct,'Sugar P2 changes ammo calculation');
assert.equal(sugarFavoriteCycle.attackSpeed,sugarNormalCycle.attackSpeed,'Sugar base burst attack speed remains in normal state');
const sugarNormal=callDamage('sugarTreasure',0),sugarFavorite=callDamage('sugarTreasure',3);
assert.ok(sugarFavorite.atk>sugarNormal.atk,'Sugar favorite ATK calculation differs');
assert.ok(sugarFavorite.dmg>sugarNormal.dmg,'Sugar favorite attack-damage calculation differs');
assert.ok(sugarFavorite.strongElementDmg>sugarNormal.strongElementDmg,'Sugar favorite elemental calculation differs');
assert.deepEqual({...sugarFavorite.favoriteItemSkillResolution.skillLevels},levels,'Sugar levels preserved in calculation');

const laplaceNormal=callDamage('laplaceTreasure',0,{chargedShots:100,reloads:10}),laplaceFavorite=callDamage('laplaceTreasure',3,{chargedShots:100,reloads:10});
assert.equal(laplaceNormal.v3477FavoriteItem.skill2Trigger,'last-bullet-hit');
assert.equal(laplaceFavorite.v3477FavoriteItem.skill2Trigger,'full-charge-hit');
assert.ok(laplaceFavorite.skill>laplaceNormal.skill,'Laplace P1 changes actual skill units');
assert.ok(laplaceFavorite.burst>laplaceNormal.burst,'Laplace P2 changes actual burst units');
assert.equal(laplaceNormal.v3477FavoriteItem.burstSeconds,5);
assert.equal(laplaceFavorite.v3477FavoriteItem.burstSeconds,10);
assert.equal(laplaceFavorite.v3477FavoriteItem.heroVisionSeconds,15);
assert.deepEqual({...laplaceFavorite.favoriteItemSkillResolution.skillLevels},levels,'Laplace levels preserved in calculation');

const poliNormal=callCycle('poliTreasure',0),poliFavorite=callCycle('poliTreasure',3);
assert.equal(poliNormal.poliSelfBadgeShieldPct,0);
assert.equal(poliFavorite.poliSelfBadgeShieldPct,100);
assert.equal(poliNormal.poliTeamShieldPct,22.27);
assert.equal(poliFavorite.poliTeamShieldPct,40);
assert.equal(poliNormal.poliSkill2Mode,'active-20s-cooldown');
assert.equal(poliFavorite.poliSkill2Mode,'passive-every-20s');
assert.equal(poliFavorite.poliBadgeHealPct,25);
assert.deepEqual({...poliFavorite.favoriteItemSkillResolution.skillLevels},levels,'Poli levels preserved in calculation');

assert.equal(window.NIKKE_V3477_FAVORITE_VERIFY.pass,true,'runtime self-verification');
console.log('V34.7.7 ENIKK favorite TID -> phase -> skill variant -> skill-level preservation verification: PASS');
