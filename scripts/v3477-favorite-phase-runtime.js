<script id="v3477-favorite-phase-runtime">
(function installV3477FavoritePhaseRuntime(root){
'use strict';
const VERSION='34.7.7';
const registry=root.NIKKE_V3477_FAVORITE_REGISTRY||{};
const targetIds=new Set(Object.keys(registry));
const fallbackCurve=Object.freeze([13,14,15,16,17,18,19,20,21,22].map(value=>value/22));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value,min)));
const clamp01=value=>clamp(value,0,1);
const clampPhase=value=>Math.round(clamp(value,0,3));
const clampLevel=value=>Math.round(clamp(value,1,10));
const round=(value,digits=6)=>Number(finite(value).toFixed(digits));
const copyLevels=raw=>{const value=raw&&typeof raw==='object'?raw:{};return Object.freeze({skill1:clampLevel(value.skill1),skill2:clampLevel(value.skill2),burst:clampLevel(value.burst)});};
const recordFor=id=>registry[id]||null;

function explicitPhase(ctx){
  const values=[ctx?.favoriteItemPhase,ctx?.favoriteItemStage,ctx?.growth?.favoriteItemPhase,ctx?.profile?.growth?.favoriteItemPhase,ctx?.prof?.growth?.favoriteItemPhase,ctx?.roster?.favoriteItemPhase];
  for(const value of values)if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))return clampPhase(value);
  return null;
}
function rosterRow(id){
  const candidates=[root.__v26TeamGrowthContext?.byId?.[id],root.__v26SkillLevelsById?.[id]];
  for(const candidate of candidates)if(candidate&&typeof candidate==='object')return candidate;
  try{return root.NIKKE_V26_ROSTER_API?.load?.()?.characters?.[id]||null;}catch(_){return null;}
}
function phaseFor(id,ctx){const direct=explicitPhase(ctx);if(direct!==null)return direct;const row=rosterRow(id);return clampPhase(row?.favoriteItemPhase);}
function levelsFor(id,explicit){
  if(explicit&&typeof explicit==='object')return copyLevels(explicit);
  try{const levels=root.NIKKE_V26_SKILL_DATA_API?.levelsFor?.(id);if(levels)return copyLevels(levels);}catch(_){}
  const row=rosterRow(id);return copyLevels(row?.skills||row);
}
function sourceBySlot(record,phase){return Object.freeze(Object.fromEntries(['skill1','skill2','burst'].map(slot=>[slot,phase>=finite(record?.phaseBySlot?.[slot],99)?'favorite':'normal'])));}
function resolve(id,phaseOrCtx,explicitLevels){
  const record=recordFor(id),phase=typeof phaseOrCtx==='object'?phaseFor(id,phaseOrCtx):clampPhase(phaseOrCtx),skillLevels=levelsFor(id,explicitLevels);
  if(!record)return Object.freeze({id,phase:0,tid:null,activeSlots:Object.freeze([]),sourceBySlot:Object.freeze({skill1:'normal',skill2:'normal',burst:'normal'}),skillLevels,signature:`${id}|normal|L${skillLevels.skill1}-${skillLevels.skill2}-${skillLevels.burst}`});
  const sources=sourceBySlot(record,phase),activeSlots=Object.freeze(record.phaseSlots.slice(0,phase));
  return Object.freeze({id,record,tid:record.tid,nameCode:record.nameCode,phase,phaseSlots:record.phaseSlots,activeSlots,sourceBySlot:sources,skillLevels,signature:`${id}|${record.tid}|P${phase}|S1:${sources.skill1}|S2:${sources.skill2}|B:${sources.burst}|L${skillLevels.skill1}-${skillLevels.skill2}-${skillLevels.burst}`});
}
function slotFavorite(resolution,slot){return resolution?.sourceBySlot?.[slot]==='favorite';}
function nearestCurve(record,slot,lv10){
  const curves=record?.baseSkills?.[slot]?.curves||[];
  const changing=curves.filter(curve=>curve.changing&&Math.abs(finite(curve.lv10)-finite(lv10))<1e-4);
  return changing[0]||null;
}
function scaledValue(record,slot,lv10,levels,variant='base'){
  const level=clampLevel(levels?.[slot]);
  const curve=nearestCurve(record,slot,lv10);
  if(curve&&Number.isFinite(Number(curve.values?.[level-1])))return finite(curve.values[level-1],lv10);
  if(variant==='favorite')return finite(lv10)*fallbackCurve[level-1];
  return finite(lv10);
}
function valueFor(resolution,slot,lv10){return scaledValue(resolution.record,slot,lv10,resolution.skillLevels,slotFavorite(resolution,slot)?'favorite':'base');}
function baseValue(resolution,slot,lv10){return scaledValue(resolution.record,slot,lv10,resolution.skillLevels,'base');}
function favoriteValue(resolution,slot,lv10){return scaledValue(resolution.record,slot,lv10,resolution.skillLevels,'favorite');}
function slotValue(resolution,slot,normalValue,favoriteValueAt10=normalValue){return slotFavorite(resolution,slot)?favoriteValue(resolution,slot,favoriteValueAt10):baseValue(resolution,slot,normalValue);}

function fromEnikk(row,favorites){
  const source=row&&typeof row==='object'?row:{},tid=String(source.favoriteItemTid??''),id=root.NIKKE_V3477_FAVORITE_TID_TO_APP_ID?.[tid]||null,favorite=favorites?.[tid],isSsr=Boolean(id&&favorite?.rare==='SSR');
  return Object.freeze({id:isSsr?id:null,tid:isSsr?tid:null,phase:isSsr?clamp(Math.floor(finite(source.favoriteItemLv,0))+1,1,3):0,skills:copyLevels({skill1:source.skill1Lv,skill2:source.skill2Lv,burst:source.ultiSkillLv})});
}
function ownUses(ctx,prof){
  if(Number.isFinite(Number(ctx?.ownUsesCount)))return Math.max(0,Number(ctx.ownUsesCount));
  const duration=Math.max(.001,finite(ctx?.duration,180)),usage=clamp01(finite(ctx?.ownUsage,100)/100),cooldown=Math.max(1,finite(prof?.cooldown,40));
  return Math.max(0,Math.floor(duration/cooldown+1e-9)*usage);
}
function fbEntries(ctx){if(Number.isFinite(Number(ctx?.fbEntries)))return Math.max(0,Number(ctx.fbEntries));const duration=Math.max(.001,finite(ctx?.duration,180));return Math.max(0,finite(ctx?.fb,0)*duration/10);}
function timedUptime(count,seconds,duration){return clamp01(Math.max(0,finite(count))*Math.max(0,finite(seconds))/Math.max(.001,finite(duration,180)));}
function ownWindow(ctx,prof,seconds=10){return timedUptime(ownUses(ctx,prof),seconds,ctx?.duration);}
function fullBurstWindow(ctx,seconds=10){return timedUptime(fbEntries(ctx),seconds,ctx?.duration);}
function periodicUptime(count,seconds,duration){return timedUptime(count,seconds,duration);}
function maxTargets(ctx,cap=1){return Math.min(cap,Math.max(1,finite(ctx?.targets,1)));}
function partShare(ctx){return clamp01(finite(ctx?.partsRatio,0)/100);}
function estimatedShots(record,ctx){
  const p=record?.weaponPreset||{},duration=Math.max(0,finite(ctx?.duration,180)),ammo=Math.max(1,finite(p.ammo,1)),reload=Math.max(0,finite(p.reload,0));
  let shotTime;
  if(p.weapon==='MG')shotTime=1/60;else if(p.weapon==='SR'||p.weapon==='RL')shotTime=Math.max(.05,finite(p.charge,1)+.08);else shotTime=Math.max(.01,finite(p.interval,.05));
  const magazine=ammo*shotTime+reload;return magazine>0?duration/magazine*ammo:duration/shotTime;
}
function blankCycle(){return{ammoPct:0,reload:0,chargeSpeed:0,attackSpeed:0,noReloadUptime:0,refund:0,magazineRefillPct:0,fixedCharge:0,ignoreChargeSpeed:false,olOnlyChargeSpeed:false};}
function blankModel(record,prof,sim,ctx){
  const fc=typeof v21FullCharge==='function'?v21FullCharge(record?.weaponPreset||{},prof):finite(prof?.fullCharge,1);
  const normal=sim?.damageUnits!==undefined?finite(sim.damageUnits):finite(sim?.shots)*finite(prof?.normal,record?.skillProfile?.normal)*fc;
  return{normal,skill:0,burst:0,trueUnits:0,atk:0,dmg:0,damageTaken:0,critRate:0,normalCritRate:0,critDmg:0,trueDamageDmg:0,chargeDmg:0,coreDmg:0,partsDmg:0,pierceDmg:0,distributedDmg:0,projectileDmg:0,projectileDmgFullBurst:0,strongElementDmg:0,instantPackets:[],procs:[],ownUses:ownUses(ctx,prof),mirandaCritUnits:0};
}
function addPacket(model,name,kind,units,count=0,extra={}){if(finite(units)>0)model.instantPackets.push({name,kind,units:finite(units),count:finite(count),...extra});}
function magCycles(sim){return Math.max(0,finite(sim?.reloads)+(finite(sim?.shots)>0?1:0));}
function critBase(model){return clamp01((15+finite(model?.critRate)+finite(model?.normalCritRate))/100);}
function annotate(target,resolution,details={}){
  target.favoriteItemSkillResolution=resolution;
  target.favoriteItemSkillSignature=resolution.signature;
  target.v3477FavoriteItem=Object.freeze({phase:resolution.phase,tid:resolution.tid,activeSlots:resolution.activeSlots,sourceBySlot:resolution.sourceBySlot,skillLevels:resolution.skillLevels,...details});
  return target;
}

function cycleFor(id,prof,ctx,resolution){
  const cycle=blankCycle(),record=resolution.record,fb=clamp01(ctx?.fb),own10=ownWindow(ctx,prof,10),own15=ownWindow(ctx,prof,15),cond=clamp01(ctx?.cond),shots=estimatedShots(record,ctx),fav=slot=>slotFavorite(resolution,slot),v=(slot,normal,favorite=normal)=>slotValue(resolution,slot,normal,favorite);
  switch(record.slug){
    case'diesel':{
      const threshold=fav('skill2')?70:100,extra=fav('skill1')?shots*own10/150:0,stacks=Math.min(10,(shots/threshold+extra)*cond);cycle.ammoPct+=v('skill2',56.7)*stacks;cycle.magazineRefillPct=v('skill2',86.62);break;}
    case'exia':if(fav('skill1'))cycle.reload+=95*fullBurstWindow(ctx,10);break;
    case'drake':cycle.ammoPct+=(fav('skill1')?v('skill1',0,50.14)*clamp01(ctx?.fb):0)+v('burst',72.18)*own10;break;
    case'tove':{const procEvery=fav('skill1')?10:20,stacks=Math.min(3,shots/procEvery)*cond;cycle.ammoPct+=record.weaponPreset.ammo?stacks*2/record.weaponPreset.ammo*100:0;cycle.magazineRefillPct=v('skill1',5.31);break;}
    case'privaty':cycle.reload+=v('skill1',51.16)*clamp01(ctx?.fb);cycle.ammoPct-=v('skill1',50.66)*clamp01(ctx?.fb);break;
    case'moran':cycle.noReloadUptime=Math.max(cycle.noReloadUptime,own10);break;
    case'phantom':if(fav('burst'))cycle.ammoPct+=favoriteValue(resolution,'burst',50)*own10;break;
    case'sugar':{
      const cover=Number.isFinite(Number(ctx?.sustainedUptime))?clamp01(ctx.sustainedUptime):cond,proc=fav('skill1')?1:.2;
      cycle.reload+=v('skill1',12.12)*cover*proc;
      cycle.ammoPct+=v('skill2',83.8)*fullBurstWindow(ctx,fav('skill2')?15:10);
      cycle.attackSpeed+=v('burst',66)*own15;
      break;}
    case'zwei':if(fav('burst')){cycle.fixedCharge=1.2;cycle.ignoreChargeSpeed=true;}break;
  }
  return annotate(cycle,resolution,{kind:'cycle'});
}

function damageFor(id,p,prof,sim,ctx,resolution){
  const record=resolution.record,model=blankModel(record,prof,sim,ctx),fb=clamp01(ctx?.fb),cond=clamp01(ctx?.cond),own10=ownWindow(ctx,prof,10),own15=ownWindow(ctx,prof,15),uses=model.ownUses,entries=fbEntries(ctx),shots=Math.max(0,finite(sim?.shots)),charged=Math.max(0,finite(sim?.chargedShots)),mags=magCycles(sim),targets=Math.max(1,finite(ctx?.targets,1)),parts=partShare(ctx),fav=slot=>slotFavorite(resolution,slot),v=(slot,normal,favorite=normal)=>slotValue(resolution,slot,normal,favorite),b=(slot,value)=>baseValue(resolution,slot,value),f=(slot,value)=>favoriteValue(resolution,slot,value);
  switch(record.slug){
    case'diesel':{
      const threshold=fav('skill2')?70:100,extra=fav('skill1')?shots*own10/150:0,stacks=Math.min(10,(shots/threshold+extra)*cond);
      if(fav('skill2'))model.pierceDmg+=f('skill2',30)*Math.min(1,Math.max(0,(shots-threshold*10))/Math.max(1,shots)+cond*.5);
      model.burst+=uses*v('burst',299.66)*maxTargets(ctx,5);model.procs.push(`딸기 캔디 평균 ${round(stacks,2)}스택`,`Phase ${resolution.phase} · ${resolution.activeSlots.join('→')||'일반 스킬'}`);break;}
    case'exia':{
      const stackValue=fav('skill2')?f('skill2',28):b('skill2',16.8),stackTrigger=fav('skill2')?Math.max(0,charged):mags,stacks=Math.min(5,stackTrigger)*cond;model.atk+=stackValue*stacks;if(fav('skill2'))model.atk+=f('skill2',5.8)*5*cond;
      model.burst+=uses*b('burst',122.32)*maxTargets(ctx,10)*(1+cond);if(fav('burst'))model.damageTaken+=f('burst',18.04)*own10;model.procs.push(`해킹 코드 ${round(stacks,2)}스택`,fav('skill1')?'풀 버스트 재장전 +95%':'일반 재장전');break;}
    case'frima':{
      let wakeUptime=0;if(fav('skill1')){const cycles=Math.floor(charged/11);wakeUptime=timedUptime(cycles,10,ctx?.duration);const converted=model.normal*wakeUptime;model.normal-=converted;model.trueUnits+=converted;model.damageTaken+=f('skill1',4)*Math.min(5,charged)*cond;}
      else model.damageTaken+=b('skill1',15.84)*periodicUptime(Math.floor(shots/4),10,ctx?.duration)*.35;
      model.burst+=uses*b('burst',101.66)*maxTargets(ctx,10);if(fav('burst'))model.trueDamageDmg+=f('burst',49.97)*Math.min(wakeUptime,own10||wakeUptime);if(fav('skill2'))model.trueDamageDmg+=f('skill2',28.16)*wakeUptime;model.procs.push(`Wake Up 유지 ${round(wakeUptime*100,2)}%`);break;}
    case'laplace':{
      const triggerCount=fav('skill2')?charged:mags,skill2=fav('skill2')?f('skill2',132.45):b('skill2',81.66);model.skill+=triggerCount*skill2;model.skill+=charged*parts*b('skill2',14.78);
      const first=fav('burst')?f('burst',1455.72):b('burst',897.6);model.burst+=uses*first;const laserHits=Math.max(0,finite(ctx?.laplaceLaserHits,0));if(laserHits){const dot=fav('burst')?f('burst',22.2):b('burst',14.52);if(fav('burst')&&cond){model.trueUnits+=laserHits*dot;model.trueUnits+=laserHits*b('burst',11.9);}else model.burst+=laserHits*dot;}
      model.procs.push(`${fav('skill2')?'풀차지':'마지막 탄환'} 추가타 ${round(triggerCount,2)}회`,`버스트 ${fav('burst')?'10':'5'}초 · 히어로 비전 ${fav('skill1')?'15':'5'}초`);break;}
    case'viper':{
      model.atk+=b('skill1',25.98)*Math.min(1,10/Math.max(1,finite(ctx?.duration,180)));const dotBonus=fav('skill1')?f('skill1',4.4)*10*fb*cond:0;const nuke=fav('burst')?f('burst',1029.6):b('burst',462.85);model.burst+=uses*nuke;if(fav('burst'))model.skill+=uses*10*f('burst',105.3)*(1+dotBonus/100);model.procs.push(`Vamp 지속 피해 보정 +${round(dotBonus,2)}%`,fav('skill2')?'버스트 II 재진입 활성':'일반 B2 체인');break;}
    case'miranda':{
      model.critDmg+=b('skill2',32.99)*fb;const targetEligible=cond;model.atk+=b('burst',40.4)*own10*targetEligible;model.critDmg+=b('burst',56.23)*own10*targetEligible;if(fav('skill2')){model.critRate+=f('skill2',30.1)*fb;model.dmg+=f('skill2',23.7)*fb;model.mirandaCritUnits=entries*finite(prof?.normal)*finite(prof?.fullCharge,1);}if(fav('skill1'))model.atk+=f('skill1',50.06)*periodicUptime(Math.floor(shots/30),5,ctx?.duration);model.procs.push(fav('burst')?'최종 ATK 상위 2인 버프':'최종 ATK 상위 1인 버프');break;}
    case'helm':{
      const cycleSeconds=Math.max(.01,finite(ctx?.duration,180)/Math.max(1,mags)),critU=clamp01(5/cycleSeconds);model.normalCritRate+=b('skill1',14.64)*critU;model.partsDmg+=b('skill2',3.08);model.dmg+=(fav('skill2')?f('skill2',27.87):b('skill2',11.85))*fb;if(fav('skill2'))model.skill+=charged*f('skill2',178.98);model.burst+=uses*(fav('burst')?f('burst',8236.8):b('burst',1237.5));if(fav('burst'))model.chargeDmg+=f('burst',158.4)*clamp01(uses*10/Math.max(1,charged));model.procs.push(`마지막 탄환 크리 유지 ${round(critU*100,2)}%`,`풀차지 추가타 ${fav('skill2')?round(charged,2):0}회`);break;}
    case'drake':{
      model.atk+=b('skill1',11.85)*fb;if(fav('skill1'))model.atk+=f('skill1',63.88)*fb;model.skill+=Math.floor(shots/10)*b('skill2',98.55)*maxTargets(ctx,3);if(fav('skill2'))model.skill+=Math.floor(shots/5)*f('skill2',201.6);model.burst+=uses*(fav('burst')?f('burst',3009.6):b('burst',1254))*targets;if(fav('burst'))model.dmg+=f('burst',31.68)*own10;model.procs.push(`썬더볼트 10타 ${Math.floor(shots/10)}회`,fav('skill2')?`애장품 5타 ${Math.floor(shots/5)}회`:'일반 스킬 2');break;}
    case'milk':{
      model.atk+=b('skill1',31.83)*.5*cond;model.critDmg+=b('skill2',11.13)*cond;model.burst+=uses*b('burst',367.34);model.procs.push(fav('skill1')?'상위 ATK 3인 · B1 쿨타임 20초':'상위 ATK 2인 · B1 쿨타임 40초',fav('skill2')?'풀차지 10회마다 B1 CDR 2.83초':'일반 스킬 2');break;}
    case'poli':{
      model.atk+=b('skill1',5.46)*cond+b('burst',44.55)*own10;model.procs.push(`공용 보호막 ${fav('burst')?'40':'22.27'}%`,fav('skill2')?'20초 패시브·배지 종료 회복':'일반 20초 액티브');break;}
    case'tove':{
      const procEvery=fav('skill1')?10:20,procCount=Math.floor(shots/procEvery),stackU=clamp01(procCount*5/Math.max(1,finite(ctx?.duration,180)));model.critDmg+=b('skill1',5.24)*stackU;model.critRate+=(fav('skill2')?f('skill2',10.08):b('skill2',3.32))*cond;const duration=fav('burst')?15:10;model.atk+=b('burst',2.32)*3*timedUptime(uses,duration,ctx?.duration);model.procs.push(`임시 개조 ${round(stackU*100,2)}%`,fav('burst')?'버스트 버프 15초':'버스트 버프 10초');break;}
    case'julia':{
      const baseCrit=b('skill1',26.04),extraNormal=fav('skill1')?f('skill1',36.16):0;model.critRate+=baseCrit*cond;model.normalCritRate+=extraNormal*cond;if(fav('skill1'))model.atk+=f('skill1',20)*cond;const critChance=clamp01((15+baseCrit+extraNormal)/100),critHits=shots*critChance,stacks=Math.min(5,Math.floor(critHits/6))*cond;model.critDmg+=b('skill2',24.79)*stacks;if(fav('skill2')){const marcato=Math.floor(critHits/8);model.skill+=marcato*(f('skill2',88)+f('skill2',100)*critChance);model.procs.push(`마르카토 기대 ${marcato}회`);}const burstHits=fav('burst')?5:maxTargets(ctx,5);model.burst+=uses*b('burst',544.5)*burstHits*(1+cond);model.procs.push(`크레센도 ${round(stacks,2)}스택`,fav('burst')?'5회 순차 버스트':'최종 DEF 상위 대상');break;}
    case'bay':model.procs.push(fav('skill1')?'풀차지 아군 회복 활성':'일반 피해 공유',fav('burst')?'엄폐 재건 1회':'일반 엄폐 보호');break;
    case'privaty':{
      model.atk+=b('skill1',23.61)*fb;if(fav('skill1'))model.dmg+=f('skill1',20.16)*fb;const last=mags;model.skill+=last*(fav('skill2')?f('skill2',256.17):b('skill2',85.79));if(fav('skill2')){model.damageTaken+=f('skill2',10.01)*periodicUptime(last,10,ctx?.duration);model.skill+=last*f('skill2',1687)*own10*cond;}else model.skill+=last*b('skill2',1089)*cond;model.burst+=uses*(fav('burst')?f('burst',1407.64):b('burst',457.87))*targets;if(fav('burst'))model.strongElementDmg+=f('burst',130)*own10;model.procs.push(`마지막 탄환 ${round(last,2)}회`,fav('burst')?'지정 표적 버스트':'일반 스턴 버스트');break;}
    case'zwei':{
      model.pierceDmg+=b('skill1',10.06)*fb;if(fav('skill1'))model.pierceDmg+=f('skill1',24.99)*3*fb;const critBaseValue=b('skill2',18.63),critDuration=fav('skill2')?10:5;model.critRate+=critBaseValue*timedUptime(entries,critDuration,ctx?.duration);if(fav('skill2'))model.critRate+=f('skill2',15)*3*own10;const charge=fav('burst')?1.2:1.5,burstShots=uses*Math.floor(10/charge),replaced=model.normal*own10;model.normal-=replaced;model.burst+=burstShots*b('burst',50.69)*3;if(fav('burst'))model.pierceDmg+=f('burst',25.03)*own10;model.procs.push(`변환 SR ${burstShots}발 · ${charge.toFixed(1)}초 차지`,fav('skill2')?'크리 3중첩':'기본 크리 버프');break;}
    case'centi':{
      model.burst+=uses*b('burst',145.46)*maxTargets(ctx,5);if(fav('skill2'))model.atk+=f('skill2',4.6)*10*cond;if(fav('skill1')&&ctx?.hasElement)model.strongElementDmg+=f('skill1',5.69)*10*cond;model.procs.push(fav('skill2')?'공격력 시전자 계수 10중첩':'일반 보호막',fav('skill1')?'철갑 우월 10중첩':'일반 스킬 1');break;}
    case'moran':{
      const changedShots=shots*own10;model.skill+=Math.floor(changedShots/5)*b('skill1',47.18);if(fav('burst'))model.atk+=f('burst',42.57)*own10;model.procs.push(fav('skill1')?'Fervor · B1 쿨타임 20초':'B1 쿨타임 40초',fav('skill2')?'풀 버스트 CDR 7.48초':'일반 인내');break;}
    case'phantom':{
      model.dmg+=b('skill1',75.17)*.5;const ten=Math.floor(shots/10);model.atk+=b('skill2',85.12)*periodicUptime(ten,5,ctx?.duration);model.distributedDmg+=b('skill2',31.92)*periodicUptime(ten,10,ctx?.duration)+b('skill2',12.86)*3*cond;const daggerCycles=Math.floor(shots/6);model.skill+=daggerCycles*b('skill2',84.33);if(fav('skill2'))model.skill+=daggerCycles*f('skill2',250)*targets;model.burst+=uses*b('burst',1457.28)*targets;if(fav('burst'))model.damageTaken+=f('burst',18)*timedUptime(uses,30,ctx?.duration)*cond;model.procs.push(`도적의 단검 사이클 ${daggerCycles}회`,fav('burst')?'작열 단계 대상 30초 디버프':'일반 분배 버스트');break;}
    case'flora':{
      const trueU=fav('skill2')?periodicUptime(Math.max(1,entries),10,ctx?.duration):periodicUptime(Math.max(1,entries),5,ctx?.duration);model.trueDamageDmg+=b('skill2',30.97)*trueU+b('burst',42.39)*own10;if(fav('skill2'))model.atk+=f('skill2',45.12)*cond;if(fav('burst'))model.atk+=f('burst',85.86)*own10;model.procs.push(`진 대미지 버프 ${round(model.trueDamageDmg,2)}%`,fav('burst')?'시전자 ATK 85.86% 버스트':'일반 회복 버스트');break;}
    case'rosanna':{
      const concealProcs=Math.floor(shots/120),critU=periodicUptime(concealProcs,3,ctx?.duration);model.critRate+=b('skill1',19.34)*critU;let frenzy=0;if(fav('skill2'))frenzy=Math.min(10,Math.floor(shots/500))*cond;model.atk+=b('skill2',22.61)*frenzy;model.burst+=uses*(b('burst',1310.4)*maxTargets(ctx,2)+b('burst',561.6)*maxTargets(ctx,2)*cond);if(fav('burst'))model.damageTaken+=f('burst',29)*timedUptime(uses,30,ctx?.duration)*cond;if(fav('skill1')&&ctx?.hasElement)model.strongElementDmg+=f('skill1',20)*cond;model.procs.push(`Frenzy ${round(frenzy,2)}스택`,`은신 크리 유지 ${round(critU*100,2)}%`);break;}
    case'sugar':{
      const cover=Number.isFinite(Number(ctx?.sustainedUptime))?clamp01(ctx.sustainedUptime):cond,proc=fav('skill1')?1:.2;model.critDmg+=b('skill1',16.39)*cover*proc;if(fav('skill1'))model.dmg+=f('skill1',19.98)*cover;model.critRate+=b('skill2',13.02)*fb;if(fav('skill2')){model.atk+=f('skill2',25.01)*fb;if(ctx?.hasElement)model.strongElementDmg+=f('skill2',40.02)*fullBurstWindow(ctx,15);}if(fav('burst')){model.atk+=f('burst',20)*own15;if(ctx?.hasElement)model.strongElementDmg+=f('burst',60.01)*own15;}model.procs.push(`엄폐 스킬 1 발동률 ${(proc*100).toFixed(0)}%`,`자가 버스트 15초 유지 ${round(own15*100,2)}%`);break;}
  }
  model.mirandaCritUnits=model.mirandaCritUnits||entries*finite(prof?.normal)*finite(prof?.fullCharge,1);
  return annotate(model,resolution,{kind:'damage'});
}

function sourceUses(sourceId,sourceRecord,timeline,duration){
  const events=Array.isArray(timeline?.events)?timeline.events:[];
  if(sourceRecord.burst===1){const count=events.filter(event=>event.activeB1Id===sourceId||event.extraB1Id===sourceId).length;return count||Math.min(events.length,Math.floor(duration/Math.max(1,sourceRecord.cooldown))+1);}
  if(sourceRecord.burst===2)return Math.min(events.length||Infinity,Math.floor(duration/Math.max(1,sourceRecord.cooldown))+1);
  return 0;
}
function addComboFromSource(combo,sourceId,targetId,prof,cond,timeline,duration){
  const source=recordFor(sourceId);if(!source||sourceId===targetId)return;
  const resolution=resolve(sourceId,phaseFor(sourceId,{})),target=recordFor(targetId),targetWeapon=String(target?.weapon||prof?.weapon||''),targetElement=String(target?.element||prof?.element||''),uses=sourceUses(sourceId,source,timeline,duration),u5=timedUptime(uses,5,duration),u10=timedUptime(uses,10,duration),u15=timedUptime(uses,15,duration),u30=timedUptime(uses,30,duration),fav=slot=>slotFavorite(resolution,slot),v=(slot,normal,favorite=normal)=>slotValue(resolution,slot,normal,favorite),note=value=>combo.notes.push(`${source.displayName}: ${value}`);
  switch(source.slug){
    case'diesel':if(fav('skill2')){combo.pierceDmg+=favoriteValue(resolution,'skill2',30)*cond;note('딸기 캔디 최대 중첩 관통 대미지');}break;
    case'exia':if(fav('skill2')&&/전격|Electronic/i.test(targetElement))combo.atk+=favoriteValue(resolution,'skill2',5.8)*5*cond;if(fav('burst'))combo.damageTaken+=favoriteValue(resolution,'burst',18.04)*u10;break;
    case'frima':if(fav('skill2'))combo.trueDamageDmg+=favoriteValue(resolution,'skill2',28.16)*cond;if(fav('burst'))combo.trueDamageDmg+=favoriteValue(resolution,'burst',49.97)*u10*cond;break;
    case'viper':combo.atk+=baseValue(resolution,'skill1',25.98)*Math.min(1,10/duration);if(fav('burst'))combo.damageTaken+=baseValue(resolution,'burst',19.83)*u10*.35;break;
    case'miranda':combo.critDmg+=baseValue(resolution,'skill2',32.99)*u10;combo.atk+=baseValue(resolution,'burst',40.4)*u10*cond;combo.critDmg+=baseValue(resolution,'burst',56.23)*u10*cond;if(fav('skill2')){combo.forceFirstCrit=true;combo.critRate+=favoriteValue(resolution,'skill2',85.42)*Math.min(1,uses/Math.max(1,finite(timeline?.entries,uses)));}break;
    case'milk':combo.atk+=baseValue(resolution,'skill1',31.83)*.5*cond;combo.critDmg+=baseValue(resolution,'skill2',11.13)*cond;break;
    case'poli':combo.atk+=baseValue(resolution,'skill1',5.46)*cond+baseValue(resolution,'burst',44.55)*u10;break;
    case'tove':combo.critRate+=(fav('skill2')?favoriteValue(resolution,'skill2',10.08):baseValue(resolution,'skill2',3.32))*cond;if(targetWeapon==='SG'){combo.attackSpeed+=baseValue(resolution,'skill2',42.24)*cond;combo.atk+=(baseValue(resolution,'burst',2.32)+baseValue(resolution,'burst',24.21))*3*(fav('burst')?u15:u10);}else combo.atk+=baseValue(resolution,'burst',2.32)*3*(fav('burst')?u15:u10);break;
    case'zwei':combo.pierceDmg+=baseValue(resolution,'skill1',10.06)*u10+(fav('burst')?favoriteValue(resolution,'burst',25.03)*u10:baseValue(resolution,'burst',15.48)*u10);combo.critRate+=baseValue(resolution,'skill2',18.63)*(fav('skill2')?u10:u5);if(fav('skill2'))combo.critRate+=favoriteValue(resolution,'skill2',15)*3*u5;if(fav('skill1'))combo.pierceDmg+=favoriteValue(resolution,'skill1',24.99)*3*u10;break;
    case'centi':if(fav('skill2'))combo.atk+=favoriteValue(resolution,'skill2',4.6)*10*cond;if(fav('skill1')&&/철갑|Iron/i.test(targetElement))combo.strongElementDmg+=favoriteValue(resolution,'skill1',5.69)*10*cond;break;
    case'moran':if(fav('burst'))combo.atk+=favoriteValue(resolution,'burst',42.57)*u10;break;
    case'flora':combo.trueDamageDmg+=baseValue(resolution,'skill2',30.97)*(fav('skill2')?u10:u5)+baseValue(resolution,'burst',42.39)*u10;if(fav('skill2'))combo.atk+=favoriteValue(resolution,'skill2',45.12)*cond;if(fav('burst'))combo.atk+=favoriteValue(resolution,'burst',85.86)*u10;break;
    case'rosanna':if(fav('burst'))combo.damageTaken+=favoriteValue(resolution,'burst',29)*u30*cond;break;
  }
  note(`Phase ${resolution.phase} · ${resolution.activeSlots.join('→')||'일반'}`);
}

function install(){
  if(root.__V3477_FAVORITE_PHASE_RUNTIME_PATCHED)return true;
  if(typeof v21SkillCycle!=='function'||typeof v21DamageModel!=='function'||typeof v22ComboState!=='function')return false;
  const previousCycle=v21SkillCycle,previousDamage=v21DamageModel,previousCombo=v22ComboState,previousMeta=typeof v23BurstCycleMeta==='function'?v23BurstCycleMeta:null;
  v21SkillCycle=function v3477FavoriteSkillCycle(id,prof,ctx={}){if(!targetIds.has(id))return previousCycle(id,prof,ctx);const resolution=resolve(id,ctx,levelsFor(id));return cycleFor(id,prof,ctx,resolution);};
  v21DamageModel=function v3477FavoriteDamageModel(id,p,prof,sim,ctx={}){if(!targetIds.has(id))return previousDamage(id,p,prof,sim,ctx);const resolution=resolve(id,ctx,levelsFor(id));return damageFor(id,p,prof,sim,ctx,resolution);};
  v22ComboState=function v3477FavoriteComboState(duration,burstRatio,prof,targetId,cond=1,timeline=null){const combo=previousCombo(duration,burstRatio,prof,targetId,cond,timeline);addComboFromSource(combo,combo.b1Id,targetId,prof,clamp01(cond),timeline,duration);addComboFromSource(combo,combo.bufferId,targetId,prof,clamp01(cond),timeline,duration);combo.v3477FavoritePhaseAware=true;return combo;};
  if(previousMeta)v23BurstCycleMeta=function v3477FavoriteBurstCycleMeta(b1Id){const meta=previousMeta(b1Id),record=recordFor(b1Id);if(!record||record.burst!==1)return meta;const phase=phaseFor(b1Id,{}),copy={...meta,label:record.displayName,b1Cooldown:record.cooldown};if(record.slug==='milk'&&phase>=1)copy.b1Cooldown=20;if(record.slug==='moran'&&phase>=1)copy.b1Cooldown=20;if(record.slug==='milk'&&phase>=2){copy.cdr=2.83;copy.cdrTrigger='end';copy.approximation='풀차지 10회마다 2.83초 CDR';}if(record.slug==='moran'&&phase>=2){copy.cdr=7.48;copy.cdrTrigger='start';copy.approximation='Fervor 풀 버스트 진입 CDR';}return copy;};
  root.__V3477_FAVORITE_PHASE_RUNTIME_PATCHED=true;return true;
}
function verify(){
  const expected=Object.values(registry),errors=[];
  if(expected.length!==21)errors.push(`registry=${expected.length}`);
  const tids=new Set(expected.map(record=>record.tid));if(tids.size!==21)errors.push(`tids=${tids.size}`);
  for(const record of expected){for(let phase=0;phase<=3;phase++){const resolution=resolve(record.id,phase,{skill1:2,skill2:7,burst:9});if(resolution.activeSlots.length!==phase)errors.push(`${record.id}:P${phase}:slots`);if(resolution.skillLevels.skill1!==2||resolution.skillLevels.skill2!==7||resolution.skillLevels.burst!==9)errors.push(`${record.id}:P${phase}:levels`);}if(resolve(record.id,0,{skill1:2,skill2:7,burst:9}).signature===resolve(record.id,3,{skill1:2,skill2:7,burst:9}).signature)errors.push(`${record.id}:signature`);}
  const result=Object.freeze({version:VERSION,installed:install(),characters:expected.length,tids:tids.size,errors:Object.freeze(errors),pass:errors.length===0&&Boolean(root.__V3477_FAVORITE_PHASE_RUNTIME_PATCHED)});root.NIKKE_V3477_FAVORITE_VERIFY=result;return result;
}
const api=Object.freeze({version:VERSION,registry,ids:Object.freeze([...targetIds]),phaseFor,levelsFor,resolve,fromEnikk,scaledValue,slotValue,cycleFor,damageFor,install,verify});
root.NIKKE_V3477_FAVORITE_PHASE_API=api;
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',verify,{once:true});else verify();
[0,80,350,900,1800].forEach(ms=>root.setTimeout?.(()=>{install();verify();},ms));
})(window);
</script>
