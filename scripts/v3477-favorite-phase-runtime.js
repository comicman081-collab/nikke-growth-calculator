<script id="v3477-favorite-phase-skill-resolver">
(function installV3477FavoritePhaseSkillResolver(root){
'use strict';
const VERSION='34.7.7';
const TARGETS=Object.freeze({
  poliTreasure:Object.freeze({id:'poliTreasure',baseId:'poli',tid:'201001',characterNameCode:'5016',phaseSlots:Object.freeze(['skill1','burst','skill2'])}),
  sugarTreasure:Object.freeze({id:'sugarTreasure',baseId:'sugar',tid:'200501',characterNameCode:'5002',phaseSlots:Object.freeze(['skill1','skill2','burst'])}),
  laplaceTreasure:Object.freeze({id:'laplaceTreasure',baseId:'laplace',tid:'200401',characterNameCode:'1010',phaseSlots:Object.freeze(['skill2','burst','skill1'])})
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value,min)));
const clamp01=value=>clamp(value,0,1);
const clampPhase=value=>Math.round(clamp(value,0,3));
const clampLevel=value=>Math.round(clamp(value,1,10));
function copyLevels(raw){const x=raw&&typeof raw==='object'?raw:{};return Object.freeze({skill1:clampLevel(x.skill1),skill2:clampLevel(x.skill2),burst:clampLevel(x.burst)});}
function explicitPhase(ctx){
  const values=[ctx?.favoriteItemPhase,ctx?.favoriteItemStage,ctx?.growth?.favoriteItemPhase,ctx?.profile?.growth?.favoriteItemPhase,ctx?.prof?.growth?.favoriteItemPhase];
  for(const value of values)if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))return clampPhase(value);
  return null;
}
function rosterPhase(id){
  try{const row=root.NIKKE_V26_ROSTER_API?.load?.()?.characters?.[id];if(row&&Number.isFinite(Number(row.favoriteItemPhase)))return clampPhase(row.favoriteItemPhase);}catch(_){}
  try{const row=root.__v26TeamGrowthContext?.byId?.[id];if(row&&Number.isFinite(Number(row.favoriteItemPhase)))return clampPhase(row.favoriteItemPhase);}catch(_){}
  return 0;
}
function phaseFor(id,ctx){const direct=explicitPhase(ctx);return direct===null?rosterPhase(id):direct;}
function levelsFor(id,explicitLevels){
  if(explicitLevels&&typeof explicitLevels==='object')return copyLevels(explicitLevels);
  try{return copyLevels(root.NIKKE_V26_SKILL_DATA_API?.levelsFor?.(id)||{});}catch(_){return copyLevels({});}
}
function slotUnlocked(id,slot,phaseOrCtx){
  const target=TARGETS[id];if(!target)return false;
  const phase=typeof phaseOrCtx==='object'?phaseFor(id,phaseOrCtx):clampPhase(phaseOrCtx);
  const unlock=target.phaseSlots.indexOf(slot)+1;return unlock>0&&phase>=unlock;
}
function resolve(id,phaseOrCtx,explicitLevels){
  const target=TARGETS[id]||null,phase=typeof phaseOrCtx==='object'?phaseFor(id,phaseOrCtx):clampPhase(phaseOrCtx),skillLevels=levelsFor(id,explicitLevels);
  if(!target)return Object.freeze({id,tid:null,phase:0,activeSlots:Object.freeze([]),sourceBySlot:Object.freeze({skill1:'normal',skill2:'normal',burst:'normal'}),skillLevels,signature:`${id}|normal|${skillLevels.skill1}-${skillLevels.skill2}-${skillLevels.burst}`});
  const activeSlots=Object.freeze(target.phaseSlots.slice(0,phase));
  const sourceBySlot=Object.freeze(Object.fromEntries(['skill1','skill2','burst'].map(slot=>[slot,activeSlots.includes(slot)?'favorite':'normal'])));
  return Object.freeze({id,targetId:id,baseId:target.baseId,tid:target.tid,characterNameCode:target.characterNameCode,phase,phaseSlots:target.phaseSlots,activeSlots,sourceBySlot,skillLevels,signature:`${id}|${target.tid}|P${phase}|S1:${sourceBySlot.skill1}|S2:${sourceBySlot.skill2}|B:${sourceBySlot.burst}|L:${skillLevels.skill1}-${skillLevels.skill2}-${skillLevels.burst}`});
}
function fromEnikk(row,favorites){
  const source=row&&typeof row==='object'?row:{},tid=String(source.favoriteItemTid??''),favorite=favorites?.[tid],isSsr=favorite?.rare==='SSR';
  const phase=isSsr?clamp(Math.floor(finite(source.favoriteItemLv,0))+1,1,3):0;
  return Object.freeze({tid:isSsr?tid:null,phase,skills:copyLevels({skill1:source.skill1Lv,skill2:source.skill2Lv,burst:source.ultiSkillLv})});
}
function scale(id,slot,hint,levels){try{return finite(root.NIKKE_V26_SKILL_DATA_API?.factorFor?.(id,slot,hint,levels),1);}catch(_){return 1;}}
function coverUptime(ctx){return Number.isFinite(Number(ctx?.sustainedUptime))?clamp01(ctx.sustainedUptime):clamp01(ctx?.cond);}
function burst15Uptime(ctx){const duration=finite(ctx?.duration,0),uses=finite(ctx?.ownUsesCount,-1);return duration>0&&uses>=0?clamp01(uses*15/duration):clamp01(finite(ctx?.own,0)*1.5);}
function annotate(target,resolution,details){target.favoriteItemSkillResolution=resolution;target.favoriteItemSkillSignature=resolution.signature;target.v3477FavoriteItem=Object.freeze({...details,phase:resolution.phase,tid:resolution.tid,skillLevels:resolution.skillLevels,sourceBySlot:resolution.sourceBySlot});return target;}
function patchSugarCycle(cycle,ctx,resolution){
  const phase=resolution.phase,levels=resolution.skillLevels,cover=coverUptime(ctx),fb=clamp01(ctx?.fb);
  if(phase<1)cycle.reload=finite(cycle.reload)-12.12*scale('sugarTreasure','skill1','reload',levels)*cover*.8;
  if(phase<2)cycle.ammoPct=finite(cycle.ammoPct)-.72*scale('sugarTreasure','skill2','ammoPct',levels)*fb;
  return annotate(cycle,resolution,{kind:'cycle',normalSkill1ProcChance:phase<1?.2:1,coverUptime:cover,fullBurstUptime:fb,burst15Uptime:burst15Uptime(ctx)});
}
function patchSugarDamage(model,ctx,resolution){
  const phase=resolution.phase,levels=resolution.skillLevels,cover=coverUptime(ctx),fb=clamp01(ctx?.fb),own15=burst15Uptime(ctx),weak=!!ctx?.hasElement;
  if(phase<1){model.dmg=finite(model.dmg)-19.98*scale('sugarTreasure','skill1','attackDamage',levels)*cover;model.critDmg=finite(model.critDmg)-16.39*scale('sugarTreasure','skill1','critDmg',levels)*cover*.8;}
  if(phase<2){model.atk=finite(model.atk)-25.01*scale('sugarTreasure','skill2','atk',levels)*fb;if(weak)model.strongElementDmg=finite(model.strongElementDmg)-40.02*scale('sugarTreasure','skill2','strongElement',levels)*fb;}
  if(phase<3){model.atk=finite(model.atk)-20*scale('sugarTreasure','burst','atk',levels)*own15;if(weak)model.strongElementDmg=finite(model.strongElementDmg)-60.01*scale('sugarTreasure','burst','strongElement',levels)*own15;}
  for(const key of ['atk','dmg','critDmg','strongElementDmg'])if(Math.abs(finite(model[key]))<1e-9)model[key]=0;
  return annotate(model,resolution,{kind:'damage',normalSkill1ProcChance:phase<1?.2:1,coverUptime:cover,fullBurstUptime:fb,burst15Uptime:own15,strongElementApplied:weak});
}
function patchLaplaceCycle(cycle,ctx,resolution){
  const phase=resolution.phase;
  cycle.laplaceSkill2Trigger=phase>=1?'full-charge-hit':'last-bullet-hit';
  cycle.laplaceSkill2Coefficient=phase>=1?132.45:81.66;
  cycle.laplaceBurstInitial=phase>=2?1455.72:897.6;
  cycle.laplaceBurstDot=phase>=2?22.2:14.52;
  cycle.laplaceBurstSeconds=phase>=2?10:5;
  cycle.laplaceHeroVisionSeconds=phase>=3?15:5;
  cycle.laplaceBurstNormalToTrue=phase>=2;
  return annotate(cycle,resolution,{kind:'cycle',skill2Trigger:cycle.laplaceSkill2Trigger,skill2Coefficient:cycle.laplaceSkill2Coefficient,burstInitial:cycle.laplaceBurstInitial,burstDot:cycle.laplaceBurstDot,burstSeconds:cycle.laplaceBurstSeconds,heroVisionSeconds:cycle.laplaceHeroVisionSeconds});
}
function patchLaplaceDamage(model,sim,ctx,resolution){
  const phase=resolution.phase,levels=resolution.skillLevels,charged=Math.max(0,finite(sim?.chargedShots)),reloads=Math.max(0,finite(sim?.reloads)),uses=Math.max(0,finite(ctx?.ownUsesCount)),skill2Scale=scale('laplaceTreasure','skill2','damage',levels),burstScale=scale('laplaceTreasure','burst','damage',levels);
  const skill2Units=(phase>=1?charged*132.45:reloads*81.66)*skill2Scale;
  const burstInitial=(phase>=2?1455.72:897.6)*uses*burstScale;
  model.skill=finite(model.skill)+skill2Units;model.burst=finite(model.burst)+burstInitial;
  const explicitLaserHits=Math.max(0,finite(ctx?.laplaceLaserHits,0));if(explicitLaserHits>0)model.trueUnits=finite(model.trueUnits)+explicitLaserHits*11.9*scale('laplaceTreasure','burst','trueDamage',levels);
  return annotate(model,resolution,{kind:'damage',skill2Trigger:phase>=1?'full-charge-hit':'last-bullet-hit',skill2Coefficient:phase>=1?132.45:81.66,skill2TriggerCount:phase>=1?charged:reloads,skill2Units,burstInitialCoefficient:phase>=2?1455.72:897.6,burstInitialUnits:burstInitial,burstDotCoefficient:phase>=2?22.2:14.52,burstSeconds:phase>=2?10:5,heroVisionSeconds:phase>=3?15:5,normalDamageToTrue:phase>=2,explicitLaserHits});
}
function patchPoli(target,resolution,kind){
  const phase=resolution.phase;
  target.poliSkill2Mode=phase>=3?'passive-every-20s':'active-20s-cooldown';
  target.poliSelfBadgeShieldPct=phase>=1?100:0;
  target.poliTeamShieldPct=phase>=2?40:22.27;
  target.poliIndomitabilitySeconds=phase>=2?5:0;
  target.poliBadgeHealPct=phase>=3?25:0;
  target.poliBadgeHealPerSecondPct=phase>=3?5:0;
  target.poliBadgeHealSeconds=phase>=3?5:0;
  return annotate(target,resolution,{kind,skill2Mode:target.poliSkill2Mode,selfBadgeShieldPct:target.poliSelfBadgeShieldPct,teamShieldPct:target.poliTeamShieldPct,indomitabilitySeconds:target.poliIndomitabilitySeconds,badgeHealPct:target.poliBadgeHealPct});
}
function installRuntime(){
  if(root.__V3477_FAVORITE_PHASE_RUNTIME_PATCHED)return true;
  if(typeof v21SkillCycle!=='function'||typeof v21DamageModel!=='function')return false;
  const previousCycle=v21SkillCycle,previousDamage=v21DamageModel;
  v21SkillCycle=function v21SkillCycleV3477FavoritePhase(id,prof,ctx){
    const cycle=previousCycle(id,prof,ctx)||{},target=TARGETS[id];if(!target)return cycle;
    const resolution=resolve(id,ctx,levelsFor(id));
    if(id==='sugarTreasure')return patchSugarCycle(cycle,ctx,resolution);
    if(id==='laplaceTreasure')return patchLaplaceCycle(cycle,ctx,resolution);
    if(id==='poliTreasure')return patchPoli(cycle,resolution,'cycle');
    return cycle;
  };
  v21DamageModel=function v21DamageModelV3477FavoritePhase(id,p,prof,sim,ctx){
    const model=previousDamage(id,p,prof,sim,ctx);if(!model||!TARGETS[id])return model;
    const resolution=resolve(id,ctx,levelsFor(id));
    if(id==='sugarTreasure')return patchSugarDamage(model,ctx,resolution);
    if(id==='laplaceTreasure')return patchLaplaceDamage(model,sim,ctx,resolution);
    if(id==='poliTreasure')return patchPoli(model,resolution,'damage');
    return model;
  };
  root.__V3477_FAVORITE_PHASE_RUNTIME_PATCHED=true;return true;
}
function verify(){
  const levels={skill1:2,skill2:7,burst:9},poli=resolve('poliTreasure',3,levels),sugar=resolve('sugarTreasure',3,levels),laplace=resolve('laplaceTreasure',3,levels);
  const result={version:VERSION,installed:installRuntime(),tids:{poli:poli.tid,sugar:sugar.tid,laplace:laplace.tid},orders:{poli:poli.phaseSlots,sugar:sugar.phaseSlots,laplace:laplace.phaseSlots},levelsPreserved:[poli,sugar,laplace].every(x=>x.skillLevels.skill1===2&&x.skillLevels.skill2===7&&x.skillLevels.burst===9)};
  result.pass=result.installed&&result.tids.poli==='201001'&&result.tids.sugar==='200501'&&result.tids.laplace==='200401'&&result.levelsPreserved;root.NIKKE_V3477_FAVORITE_VERIFY=Object.freeze(result);return result;
}
const api=Object.freeze({version:VERSION,targets:TARGETS,clampPhase,phaseFor,slotUnlocked,resolve,fromEnikk,levelsFor,installRuntime,verify});
root.NIKKE_V3477_FAVORITE_PHASE_API=api;
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',verify,{once:true});else verify();
[80,350,900,1800].forEach(ms=>root.setTimeout(()=>{installRuntime();verify();},ms));
})(window);
</script>
