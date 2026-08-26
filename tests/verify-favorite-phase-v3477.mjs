import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const audit=JSON.parse(fs.readFileSync(new URL('../audit/enikk-favorite-characters-v3477.json',import.meta.url),'utf8'));

assert.equal(html,publicHtml,'root/public index mismatch');
assert.equal(audit.counts.favoriteCharacters,21,'ENIKK favorite roster count');
assert.equal(audit.counts.resolvedFavoriteTids,21,'ENIKK TID coverage');
assert.equal(audit.counts.completePhaseOrders,21,'ENIKK phase order coverage');
assert.equal(audit.counts.completeFavoriteSkillCards,21,'ENIKK 63-card coverage');
assert.equal(audit.counts.completeBaseDetails,21,'ENIKK base skill/weapon coverage');
assert.match(html,/id="v3477-favorite-registry"/);
assert.match(html,/id="v3477-favorite-phase-runtime"/);
assert.doesNotMatch(html,/id="v3477-favorite-phase-skill-resolver"/,'obsolete 3-character resolver must be removed');
assert.match(html,/favoriteAppId\|\|idForNameCode\(row\.nameCode\)\|\|supplementalId\(row\.nameCode\)/,'favorite TID must precede nameCode import');
assert.match(html,/favoriteItemPhase=favoriteAppId&&fav\?\.rare==='SSR'&&fav\?\.type==='Favorite'/,'only audited SSR Favorite TID creates a phase');
assert.match(html,/"200501":"viperTreasure"/,'Viper TID correction');
assert.match(html,/"202101":"sugarTreasure"/,'Sugar TID correction');
assert.doesNotMatch(html,/"200501":"sugarTreasure"/,'old Sugar TID mapping must be absent');
assert.doesNotMatch(html,/favoriteItemPhase=Math\.max\([^;]+,3\)/,'migration must not force Phase 3');
assert.match(html,/preferredPhase=b\.owned===true/,'migration must preserve the owned row phase');
assert.match(html,/const skillValue=key=>/,'migration must preserve source skill levels');
assert.doesNotMatch(html,/result\.skills=\{skill1:Math\.max\([^;]+,4\)/,'migration must not force skill level 4');
assert.match(html,/favoriteItemPhase:profile\?\.growth\?\.favoriteItemPhase/,'optimizer context must consume phase');
assert.match(html,/favoriteItemPhase:finite\(g\.favoriteItemPhase,0\)/,'shared growth context must expose phase');
assert.match(html,/selectedB2Cooldown = Math\.max\(1, Number\(b2Data\.profiles/,'B2 timeline must consume selected profile cooldown');

function scriptBody(id){
  const match=html.match(new RegExp(`<script id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
  assert.ok(match,`${id} script missing`);
  return match[1];
}

const roster={};
const levels={skill1:2,skill2:7,burst:9};
const emptyCombo=()=>({
  b1Id:window.__comboB1||'none',bufferId:window.__comboB2||'none',name:'test',entries:6,
  atk:0,dmg:0,damageTaken:0,critRate:0,normalCritRate:0,critDmg:0,chargeDmg:0,coreDmg:0,partsDmg:0,
  pierceDmg:0,distributedDmg:0,projectileDmg:0,projectileDmgFullBurst:0,fullBurstAtkDelta:0,fullBurstDamageDelta:0,
  strongElementDmg:0,trueDamageDmg:0,ammoPct:0,reload:0,chargeSpeed:0,attackSpeed:0,magazineRefillPct:0,
  forceFirstCrit:false,notes:[],casters:[],targetAtk:0,atkModeLabel:'test'
});
const window={
  document:{readyState:'complete',addEventListener(){},querySelectorAll(){return[];},getElementById(){return null;}},
  setTimeout(){return 0;},
  NIKKE_V26_DATA:{burst1:{profiles:{},characters:[]},burst2:{profiles:{},characters:[]},burst3:{characters:[]}},
  NIKKE_V26_SKILL_DATA_API:{levelsFor(id){return {...(roster[id]?.skills||levels)};},factorFor(){return 1;}},
  NIKKE_V26_ROSTER_API:{load(){return {characters:roster};}},
  __v26TeamGrowthContext:{byId:roster},
  __comboB1:'none',__comboB2:'none'
};
const context=vm.createContext({window,console,Object,Array,Number,String,Math,JSON,Set,Map,RegExp,Date});
vm.runInContext(scriptBody('v3477-favorite-registry'),context,{filename:'v3477-favorite-registry.js'});
vm.runInContext(`
var v21FullCharge=(p,prof)=>Number(prof?.fullCharge)||(((p?.weapon==='SR'||p?.weapon==='RL')&&Number(p?.charge)>0)?2.5:1);
var v21SkillCycle=(id,prof,ctx)=>({legacy:true,id});
var v21DamageModel=(id,p,prof,sim,ctx)=>({legacy:true,id,normal:0,skill:0,burst:0,trueUnits:0,atk:0,dmg:0,damageTaken:0,critRate:0,normalCritRate:0,critDmg:0,trueDamageDmg:0,chargeDmg:0,coreDmg:0,partsDmg:0,pierceDmg:0,distributedDmg:0,projectileDmg:0,projectileDmgFullBurst:0,strongElementDmg:0,instantPackets:[],procs:[]});
var v22ComboState=(duration,burstRatio,prof,targetId,cond,timeline)=>(${emptyCombo.toString()})();
var v23BurstCycleMeta=(id)=>({label:id,b1Cooldown:40,cdr:0,cdrTrigger:'none'});
${scriptBody('v3477-favorite-phase-runtime')}
`,context,{filename:'v3477-favorite-phase-runtime.js'});

const registry=window.NIKKE_V3477_FAVORITE_REGISTRY;
const byTid=window.NIKKE_V3477_FAVORITE_TID_TO_APP_ID;
const api=window.NIKKE_V3477_FAVORITE_PHASE_API;
assert.ok(api,'favorite phase API missing');
assert.equal(api.version,'34.7.7');
assert.equal(Object.keys(registry).length,21,'runtime registry count');
assert.equal(Object.keys(byTid).length,21,'runtime TID count');
assert.equal(byTid['200501'],'viperTreasure');
assert.equal(byTid['202101'],'sugarTreasure');
assert.equal(window.NIKKE_V3477_FAVORITE_REGISTRY_REPORT.characters,21);

const appIdBySlug={
  diesel:'dieselTreasure',exia:'exiaTreasure',frima:'frimaTreasure',laplace:'laplaceTreasure',viper:'viperTreasure',miranda:'mirandaTreasure',helm:'helmTreasure',drake:'drakeTreasure',milk:'milkTreasure',poli:'poliTreasure',tove:'toveTreasure',julia:'juliaTreasure',bay:'bayTreasure',privaty:'privatyTreasure',zwei:'zweiTreasure',centi:'centiTreasure',moran:'moranTreasure',phantom:'phantomTreasure',flora:'floraTreasure',rosanna:'rosannaTreasure',sugar:'sugarTreasure'
};
const favorites={};
for(const row of audit.characters)favorites[String(row.favoriteItem.tid)]={rare:'SSR',type:'Favorite'};

for(const row of audit.characters){
  const id=appIdBySlug[row.character.slug];
  assert.ok(id,`test ID mapping ${row.character.slug}`);
  const record=registry[id];
  const tid=String(row.favoriteItem.tid);
  const slots=[row.page.phaseOrder['1'],row.page.phaseOrder['2'],row.page.phaseOrder['3']];
  assert.ok(record,`${id} registry record`);
  assert.equal(record.tid,tid,`${id} TID`);
  assert.equal(byTid[tid],id,`${tid} reverse map`);
  assert.deepEqual([...record.phaseSlots],slots,`${id} phase order`);
  assert.equal(record.baseSkills.skill1.levels.length,10,`${id} base S1 levels`);
  assert.equal(record.baseSkills.skill2.levels.length,10,`${id} base S2 levels`);
  assert.equal(record.baseSkills.burst.levels.length,10,`${id} base burst levels`);
  assert.equal(Object.keys(record.favoriteSkills).length,3,`${id} favorite cards`);
  assert.equal(record.weaponPreset.ammo,row.page.baseDetail.shot.maxAmmo,`${id} weapon ammo`);
  assert.equal(record.weaponPreset.reload,row.page.baseDetail.shot.reloadSeconds,`${id} weapon reload`);
  for(const [lv,phase] of [[0,1],[1,2],[2,3],[7,3]]){
    const imported=api.fromEnikk({favoriteItemTid:tid,favoriteItemLv:lv,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},favorites);
    assert.equal(imported.id,id,`${id} import identity`);
    assert.equal(imported.phase,phase,`${id} favoriteItemLv ${lv}`);
    assert.deepEqual({...imported.skills},levels,`${id} imported skill levels`);
  }
  for(let phase=0;phase<=3;phase++){
    const resolved=api.resolve(id,phase,levels);
    assert.equal(resolved.tid,tid,`${id} resolve TID`);
    assert.deepEqual([...resolved.phaseSlots],slots,`${id} resolve phase order`);
    assert.deepEqual([...resolved.activeSlots],slots.slice(0,phase),`${id} active slots P${phase}`);
    assert.deepEqual({...resolved.skillLevels},levels,`${id} levels P${phase}`);
    for(const slot of ['skill1','skill2','burst']){
      assert.equal(resolved.sourceBySlot[slot],slots.indexOf(slot)>=0&&phase>=slots.indexOf(slot)+1?'favorite':'normal',`${id} ${slot} source P${phase}`);
    }
  }
  assert.notEqual(api.resolve(id,0,levels).signature,api.resolve(id,3,levels).signature,`${id} Phase 0/3 signature`);
}
assert.equal(api.fromEnikk({favoriteItemTid:'100402',favoriteItemLv:2,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},{'100402':{rare:'SR',type:'Collection'}}).phase,0,'collection item is not favorite phase');
assert.equal(api.fromEnikk({favoriteItemTid:0,favoriteItemLv:2,skill1Lv:2,skill2Lv:7,ultiSkillLv:9},favorites).phase,0,'missing TID is Phase 0');

const simFor=record=>({
  ammo:record.weaponPreset.ammo,magShots:record.weaponPreset.ammo,shots:720,chargedShots:(record.weapon==='SR'||record.weapon==='RL')?120:0,
  reloads:40,reloadLoss:40*record.weaponPreset.reload,damageUnits:undefined
});
const ctxFor=phase=>({favoriteItemPhase:phase,fb:.6,own:.25,cond:1,duration:180,ownUsage:100,ownUsesCount:5,fbEntries:10,burstRatio:60,targets:3,partsRatio:60,hasElement:true,sustainedUptime:.9,laplaceLaserHits:200,skillEff:1});
const calculationFingerprint=(cycle,model)=>JSON.stringify({
  cycle:Object.fromEntries(['ammoPct','reload','chargeSpeed','attackSpeed','noReloadUptime','refund','magazineRefillPct','fixedCharge','ignoreChargeSpeed','olOnlyChargeSpeed'].map(key=>[key,cycle[key]])),
  model:Object.fromEntries(['normal','skill','burst','trueUnits','atk','dmg','damageTaken','critRate','normalCritRate','critDmg','trueDamageDmg','chargeDmg','coreDmg','partsDmg','pierceDmg','distributedDmg','projectileDmg','projectileDmgFullBurst','strongElementDmg'].map(key=>[key,model[key]])),
  packets:model.instantPackets,procs:model.procs
});

const noDifference=[];
for(const [id,record] of Object.entries(registry)){
  roster[id]={favoriteItemPhase:0,skills:{...levels}};
  const p=record.weaponPreset,prof=record.skillProfile,sim=simFor(record);
  const normalCycle=context.v21SkillCycle(id,prof,ctxFor(0));
  const favoriteCycle=context.v21SkillCycle(id,prof,ctxFor(3));
  const normalModel=context.v21DamageModel(id,p,prof,sim,ctxFor(0));
  const favoriteModel=context.v21DamageModel(id,p,prof,sim,ctxFor(3));
  assert.equal(normalCycle.favoriteItemSkillResolution.phase,0,`${id} cycle P0`);
  assert.equal(favoriteCycle.favoriteItemSkillResolution.phase,3,`${id} cycle P3`);
  assert.equal(normalModel.favoriteItemSkillResolution.phase,0,`${id} model P0`);
  assert.equal(favoriteModel.favoriteItemSkillResolution.phase,3,`${id} model P3`);
  assert.deepEqual({...favoriteModel.favoriteItemSkillResolution.skillLevels},levels,`${id} calculation levels preserved`);
  if(calculationFingerprint(normalCycle,normalModel)===calculationFingerprint(favoriteCycle,favoriteModel))noDifference.push(id);
}
assert.deepEqual(noDifference,[],'every favorite character must change a calculation field or explicit proc between Phase 0 and Phase 3');

// Deep numerical regression: the three representative characters remain representative only;
// all 21 are structurally and calculation-regression tested above.
const sugar=registry.sugarTreasure,sugarSim=simFor(sugar);
const sugarP0Cycle=context.v21SkillCycle('sugarTreasure',sugar.skillProfile,ctxFor(0));
const sugarP3Cycle=context.v21SkillCycle('sugarTreasure',sugar.skillProfile,ctxFor(3));
const sugarP0=context.v21DamageModel('sugarTreasure',sugar.weaponPreset,sugar.skillProfile,sugarSim,ctxFor(0));
const sugarP3=context.v21DamageModel('sugarTreasure',sugar.weaponPreset,sugar.skillProfile,sugarSim,ctxFor(3));
assert.ok(sugarP3Cycle.reload>sugarP0Cycle.reload,'Sugar P1 cover proc becomes guaranteed');
assert.ok(sugarP3Cycle.ammoPct>sugarP0Cycle.ammoPct,'Sugar P2 extends shotgun ammo window');
assert.ok(sugarP3.atk>sugarP0.atk,'Sugar favorite ATK calculation');
assert.ok(sugarP3.dmg>sugarP0.dmg,'Sugar favorite attack-damage calculation');
assert.ok(sugarP3.strongElementDmg>sugarP0.strongElementDmg,'Sugar favorite elemental calculation');

const laplace=registry.laplaceTreasure,laplaceSim=simFor(laplace);
const laplaceP0=context.v21DamageModel('laplaceTreasure',laplace.weaponPreset,laplace.skillProfile,laplaceSim,ctxFor(0));
const laplaceP3=context.v21DamageModel('laplaceTreasure',laplace.weaponPreset,laplace.skillProfile,laplaceSim,ctxFor(3));
assert.ok(laplaceP3.skill>laplaceP0.skill,'Laplace P1 changes last-bullet to full-charge calculation');
assert.ok(laplaceP3.burst+laplaceP3.trueUnits>laplaceP0.burst+laplaceP0.trueUnits,'Laplace P2 changes burst/true-damage calculation');
assert.match(laplaceP0.procs.join(' '),/마지막 탄환/);
assert.match(laplaceP3.procs.join(' '),/풀차지/);
assert.match(laplaceP3.procs.join(' '),/버스트 10초/);
assert.match(laplaceP3.procs.join(' '),/히어로 비전 15초/);

const poli=registry.poliTreasure,poliSim=simFor(poli);
const poliP0=context.v21DamageModel('poliTreasure',poli.weaponPreset,poli.skillProfile,poliSim,ctxFor(0));
const poliP3=context.v21DamageModel('poliTreasure',poli.weaponPreset,poli.skillProfile,poliSim,ctxFor(3));
assert.match(poliP0.procs.join(' '),/22\.27/);
assert.match(poliP3.procs.join(' '),/40/);
assert.match(poliP0.procs.join(' '),/20초 액티브/);
assert.match(poliP3.procs.join(' '),/20초 패시브/);

// Dynamic B1 phase consumption.
roster.milkTreasure={favoriteItemPhase:0,skills:{...levels}};
assert.equal(context.v23BurstCycleMeta('milkTreasure').b1Cooldown,40,'Milk normal B1 cooldown');
roster.milkTreasure.favoriteItemPhase=3;
assert.equal(context.v23BurstCycleMeta('milkTreasure').b1Cooldown,20,'Milk favorite B1 cooldown');
assert.equal(context.v23BurstCycleMeta('milkTreasure').cdr,2.83,'Milk favorite CDR');
roster.moranTreasure={favoriteItemPhase:0,skills:{...levels}};
assert.equal(context.v23BurstCycleMeta('moranTreasure').b1Cooldown,40,'Moran normal B1 cooldown');
roster.moranTreasure.favoriteItemPhase=3;
assert.equal(context.v23BurstCycleMeta('moranTreasure').b1Cooldown,20,'Moran favorite B1 cooldown');
assert.equal(context.v23BurstCycleMeta('moranTreasure').cdr,7.48,'Moran favorite CDR');

assert.equal(window.NIKKE_V3477_FAVORITE_VERIFY.pass,true,'runtime self-verification');
console.log('V34.7.7 ENIKK 21 favorite characters / 21 TIDs / 63 phase cards / base skills / level preservation / calculation regression: PASS');
