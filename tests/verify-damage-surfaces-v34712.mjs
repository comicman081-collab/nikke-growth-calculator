import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootHtml=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../scripts/v34712-timeline-runtime.js',import.meta.url),'utf8');

assert.equal(rootHtml,publicHtml,'root/public HTML mirror');
assert.equal((rootHtml.match(/id=["']v34712-unified-damage-timeline["']/g)||[]).length,1,'one integrated timeline runtime');
assert.match(runtime,/v34712PrecisionTimeline/,'Precision timeline surface');
assert.match(runtime,/v34712SoloTimeline/,'Solo Raid timeline surface');
assert.match(runtime,/v34712BattleTimeline/,'battle simulation timeline surface');
assert.match(runtime,/v34712-five-deck-timeline/,'per-deck timeline surface');
assert.match(runtime,/CACHE_LIMIT=2/,'bounded five-deck simulation cache');
assert.match(runtime,/minmax\(760px,1fr\) 180px/,'desktop graph dominates damage totals');
assert.match(runtime,/minmax\(690px,1fr\) 165px/,'mobile graph dominates damage totals');
assert.match(runtime,/v34712-damage-row\{[^}]*display:flex;justify-content:space-between;align-items:center/s,'five vertical rows align name left and damage right');
assert.match(runtime,/details\.open=false|d\.open=false/,'timeline panels default collapsed');
assert.match(runtime,/NIKKESinglePartyTimelineSimulator/,'five-deck timeline reuses authoritative battle simulator');
assert.match(runtime,/\.nikke-kit-team,\.v26-optimizer-team/,'current and fallback five-deck result cards supported');
assert.match(runtime,/NIKKESoloRaidLastResult/,'Solo Raid timeline reads the exposed authoritative result');
assert.match(runtime,/CHARACTER_SEARCH_TARGETS/,'character-search target registry');
assert.match(runtime,/precisionChar','정밀 캐릭터/,'Precision character search');
assert.match(runtime,/soloTeamB3A','솔로레이드 첫 B3/,'Solo Raid B3 search');
assert.match(runtime,/v26CalibrationCharacter','실전 기록 B3/,'calibration character search');
assert.match(runtime,/decorateCharacterSearches/,'dynamic character search decoration');
assert.doesNotMatch(rootHtml,/Object\.assign\(cubes,NEW_CUBES\)/,'new cube metadata must not erase native reload/ammo/refund fields');
assert.doesNotMatch(rootHtml,/Object\.assign\(values,NEW_CUBES\)/,'shared cube metadata must not erase native numeric fields');
assert.match(rootHtml,/cubes\[id\]=\{\.\.\.\(cubes\[id\]\|\|\{\}\),\.\.\.patch\}/,'precision cube metadata merges into complete definitions');
assert.match(rootHtml,/values\[id\]=\{\.\.\.\(values\[id\]\|\|\{\}\),\.\.\.patch\}/,'shared cube metadata merges into complete definitions');
assert.doesNotMatch(rootHtml,/normal:Number\(wp\.normal\|\|0\)/,'template-based characters must not lose normal-attack damage');
assert.match(rootHtml,/normal:Number\(wp\.normal\|\|templateEntry\(def\.template\)\?\.skillProfile\?\.normal\|\|0\)/,'template skill profile supplies normal-attack fallback');
assert.match(rootHtml,/function storeSnapshot\(roster,source,optionOverride\)\{[^}]*characters:clone\(arr\(roster\?\.characters\)\)/s,'all BlaBla/ENIKK rows are retained in the raw snapshot');
assert.match(rootHtml,/function filteredRoster\(roster\)\{const kept=\[\],excluded=\[\];/,'central roster import is gated by the current built-in app registry');
assert.match(rootHtml,/const id=mappedId\(row\);if\(id\)kept\.push\(row\);else excluded\.push\(row\)/,'external-only rows stay snapshot-only while every app-registered row can populate My Roster');
assert.match(rootHtml,/const ids=calculationEligibleIds\(\),owned=arr\(out\.owned\)\.filter/,'Precision and five-deck candidates use the same calculation intersection');
assert.match(rootHtml,/const seed=catalog\.map\(row=>\(\{\.\.\.row,owned:true,level:400/,'eligibility is audited against the complete current app catalog');
assert.doesNotMatch(rootHtml,/const registered=appRegisteredIds\(\),owned=\[\]/,'eligibility must not depend on whichever linked rows were already imported');
assert.match(rootHtml,/\[11,19\]/,'Thursday 11:00/19:00 KST refresh slots remain configured');
assert.match(rootHtml,/id='v34711RefreshNow'/,'manual linked-data refresh UI remains available');
assert.match(rootHtml,/nikke:blabla-refresh-request/,'APK native refresh event is consumed');
assert.match(rootHtml,/__NIKKE_ANDROID_BLABLA_REFRESH_QUEUE__/,'pre-install APK refresh requests are drained');
assert.match(rootHtml,/acknowledgeBlaBlaRefresh/,'APK refresh completion is acknowledged');

const document={
  readyState:'loading',documentElement:{},
  addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];}
};
class MutationObserver{observe(){} disconnect(){}}
const window={document,MutationObserver,setTimeout(){return 0;},addEventListener(){},devicePixelRatio:1};
const context=vm.createContext({window,document,MutationObserver,console,Map,Set,Math,Number,String,Array,Object,JSON,Date,RegExp});
vm.runInContext(runtime,context,{filename:'v34712-timeline-runtime.js'});

const api=window.NIKKEV34712UnifiedTimeline;
assert.ok(api,'timeline runtime API');
assert.equal(api.version,'34.7.18');
assert.equal(api.compactName('신데렐라'),'신데렐...','three-glyph compact name');
assert.equal(api.compactDamage(2e8),'2억');
assert.equal(api.compactDamage(12e8),'12억');
assert.equal(api.compactDamage(60e8),'60억');

const assertFiniteTree=(value,label,path=label)=>{
  if(typeof value==='number')assert.equal(Number.isFinite(value),true,`${path} must be finite`);
  else if(Array.isArray(value))value.forEach((entry,index)=>assertFiniteTree(entry,label,`${path}[${index}]`));
  else if(value&&typeof value==='object')for(const [key,entry] of Object.entries(value))assertFiniteTree(entry,label,`${path}.${key}`);
};
for(const total of [238_765_432,1_987_654_321,6_012_345_678]){
  const snapshot={
    id:'sugarTreasure',name:'Sugar · 애장품',duration:180,
    totals:{combo:total},
    breakdown:{normal:total*.62,skill:total*.23,burst:total*.15},
    burstTimeline:{starts:[3,23,43,63,83,103,123,143,163],ownStarts:[3,43,83,123,163]},
    weaponCycle:{shots:900,reloads:40}
  };
  const sim=api.syntheticFromSnapshot(snapshot);
  const trace=api.normalizeTrace(sim);
  const audit=api.traceAudit(sim,trace);
  assert.equal(sim.totalDamage,total,'synthetic trace preserves authoritative total');
  assert.ok(sim.totalDamage>0,'synthetic total is nonzero');
  assert.equal(audit.pass,true,JSON.stringify(audit));
  assert.ok(trace.length>=181,'complete 180-second trace');
  assert.equal(trace.at(-1).members[0].cumulativeDamage,total,'trace endpoint preserves total');
  assertFiniteTree(sim,'simulation');
  assertFiniteTree(trace,'trace');
}

console.log('V34.7.18 Precision / Solo Raid / five-deck / battle timeline arithmetic and integration contract: PASS');
