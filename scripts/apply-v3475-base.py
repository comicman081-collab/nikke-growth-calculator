from pathlib import Path
import shutil, re, hashlib
src=Path('index.html')
backup=Path('index.V34_7_4.before_v3475.html')
if not backup.exists(): shutil.copy2(src, backup)
s=src.read_text('utf-8')
orig=s

def rep(old,new,count=1,label=''):
    global s
    c=s.count(old)
    if c != count:
        raise SystemExit(f'REPLACE FAIL {label}: expected {count}, got {c}')
    s=s.replace(old,new,count)
    print('replaced',label,count)

# 1) Complete cube registry: Rupture / Stealth / Diffusion.
rep("destruction:{label:'렐릭디스트로이어 / Destruction Lv.15',element:19.09,hit:0,reload:0,refund:0,cd:0,cs:0,burstGen:0,ammo:0,pierce:0,parts:31.90,maxHp:0,defense:0,heal:0,damageTaken:0,critMaxHp:0}\n};",
"destruction:{label:'렐릭디스트로이어 / Destruction Lv.15',element:19.09,hit:0,reload:0,refund:0,cd:0,cs:0,burstGen:0,ammo:0,pierce:0,parts:31.90,maxHp:0,defense:0,heal:0,damageTaken:0,critMaxHp:0},\nrupture:{label:'럽처 / Rupture Lv.15',element:19.09,hit:0,reload:0,refund:0,cd:0,cs:0,burstGen:0,ammo:0,pierce:0,parts:0,maxHp:0,defense:0,heal:0,damageTaken:0,critMaxHp:0,trueDamage:14.14,distributed:0},\nstealth:{label:'스텔스 / Stealth Lv.15 · 팀 엄폐물 HP↑(주효과 수치 미검증)',element:19.09,hit:0,reload:0,refund:0,cd:0,cs:0,burstGen:0,ammo:0,pierce:0,parts:0,maxHp:0,defense:0,heal:0,damageTaken:0,critMaxHp:0,trueDamage:0,distributed:0,coverHpTeam:null},\ndiffusion:{label:'디퓨전 / Diffusion Lv.15',element:19.09,hit:0,reload:0,refund:0,cd:0,cs:0,burstGen:0,ammo:0,pierce:0,parts:0,maxHp:0,defense:0,heal:0,damageTaken:0,critMaxHp:0,trueDamage:0,distributed:17.69}\n};",label='cube lexical registry')
rep("['critMaxHp','크리티컬 시 최대 HP','%','passive']];",
"['critMaxHp','크리티컬 시 최대 HP','%','passive'],['trueDamage','트루 대미지','%','direct'],['distributed','분배 대미지','%','direct']];",label='cube native fields')

# 2) Preserve observed equipment totals in central roster schema.
rep("      measuredCoeff: 1,\n      weaponMode: id === 'cinderellaCrystalWave' ? 'mg' : null,",
"      measuredCoeff: 1,\n      equipmentAttack: null,\n      equipmentHp: null,\n      equipmentDefense: null,\n      equipmentObservedSlots: 0,\n      weaponMode: id === 'cinderellaCrystalWave' ? 'mg' : null,",label='roster defaults equipment')
needle="""    for (const [key, min, max, fallback, whole] of numberRules) {\n      if (source[key] != null && !Number.isFinite(Number(source[key]))) errors.push(`characters.${id}.${key}: 숫자여야 해요.`);\n      if (Number.isFinite(Number(source[key])) && (Number(source[key]) < min || Number(source[key]) > max)) {\n        errors.push(`characters.${id}.${key}: ${min}~${max} 범위여야 해요.`);\n      }\n      result[key] = whole ? integer(source[key], min, max, fallback) : clamp(source[key], min, max, fallback);\n    }\n\n    if (source.skills != null"""
insert="""    for (const [key, min, max, fallback, whole] of numberRules) {\n      if (source[key] != null && !Number.isFinite(Number(source[key]))) errors.push(`characters.${id}.${key}: 숫자여야 해요.`);\n      if (Number.isFinite(Number(source[key])) && (Number(source[key]) < min || Number(source[key]) > max)) {\n        errors.push(`characters.${id}.${key}: ${min}~${max} 범위여야 해요.`);\n      }\n      result[key] = whole ? integer(source[key], min, max, fallback) : clamp(source[key], min, max, fallback);\n    }\n    for (const key of ['equipmentAttack','equipmentHp','equipmentDefense']) {\n      if (source[key] == null || source[key] === '') { result[key] = null; continue; }\n      const value = Number(source[key]);\n      if (!Number.isFinite(value) || value < 0 || value > 1000000000) errors.push(`characters.${id}.${key}: 0 이상의 유효한 장비 스탯이어야 해요.`);\n      result[key] = Number.isFinite(value) ? Math.max(0, Math.min(1000000000, value)) : null;\n    }\n    result.equipmentObservedSlots = integer(source.equipmentObservedSlots, 0, 4, 0);\n\n    if (source.skills != null"""
rep(needle,insert,label='normalize equipment schema')

# 3) Propagate observed equipment through 5-deck growth profile.
rep("""      skills: clone(stored.skills || { skill1: 10, skill2: 10, burst: 10 }),\n      favoriteItemPhase: finite(stored.favoriteItemPhase, 0)\n    } : { level: 400, limitBreak: 0, coreLevel: 0, bond: 30, skills: { skill1: 10, skill2: 10, burst: 10 }, favoriteItemPhase: 0 };""",
"""      skills: clone(stored.skills || { skill1: 10, skill2: 10, burst: 10 }),\n      favoriteItemPhase: finite(stored.favoriteItemPhase, 0),\n      ...(stored.equipmentAttack != null && Number.isFinite(Number(stored.equipmentAttack)) ? { equipmentAttack: Math.max(0, Number(stored.equipmentAttack)) } : {}),\n      ...(stored.equipmentHp != null && Number.isFinite(Number(stored.equipmentHp)) ? { equipmentHp: Math.max(0, Number(stored.equipmentHp)) } : {}),\n      ...(stored.equipmentDefense != null && Number.isFinite(Number(stored.equipmentDefense)) ? { equipmentDefense: Math.max(0, Number(stored.equipmentDefense)) } : {}),\n      equipmentObservedSlots: finite(stored.equipmentObservedSlots, 0)\n    } : { level: 400, limitBreak: 0, coreLevel: 0, bond: 30, skills: { skill1: 10, skill2: 10, burst: 10 }, favoriteItemPhase: 0, equipmentObservedSlots: 0 };""",label='storedMember equipment')

rep("""    const rFavorite = read([source.favoriteItemPhase, source.favoriteItemStage], 0);\n    const s1 = clamp(rS1.value, 1, 10), s2 = clamp(rS2.value, 1, 10), burst = clamp(rBurst.value, 1, 10);""",
"""    const rFavorite = read([source.favoriteItemPhase, source.favoriteItemStage], 0);\n    const rEquipmentAttack = read([source.equipmentAttack, source.gearAttack], 0);\n    const rEquipmentHp = read([source.equipmentHp, source.gearHp], 0);\n    const rEquipmentDefense = read([source.equipmentDefense, source.gearDefense], 0);\n    const rEquipmentObservedSlots = read([source.equipmentObservedSlots], 0);\n    const s1 = clamp(rS1.value, 1, 10), s2 = clamp(rS2.value, 1, 10), burst = clamp(rBurst.value, 1, 10);""",label='normalizeGrowth equipment reads')
rep("""      measuredCoeff: measured, manualRatio: manual, cubeId:String(source.cubeId || nested.cubeId || precision.cubeId || 'none'), weaponMode, activeWeaponMode:weaponMode, selectedWeaponMode:weaponMode, cwWeaponMode:weaponMode, cwSrRatio, cwSrCycle, cwSwitches,""",
"""      measuredCoeff: measured, manualRatio: manual, cubeId:String(source.cubeId || nested.cubeId || precision.cubeId || 'none'),\n      ...(rEquipmentAttack.provided ? { equipmentAttack: Math.max(0, rEquipmentAttack.value) } : {}),\n      ...(rEquipmentHp.provided ? { equipmentHp: Math.max(0, rEquipmentHp.value) } : {}),\n      ...(rEquipmentDefense.provided ? { equipmentDefense: Math.max(0, rEquipmentDefense.value) } : {}),\n      equipmentObservedSlots: rEquipmentObservedSlots.provided ? clamp(rEquipmentObservedSlots.value,0,4) : 0,\n      weaponMode, activeWeaponMode:weaponMode, selectedWeaponMode:weaponMode, cwWeaponMode:weaponMode, cwSrRatio, cwSrCycle, cwSwitches,""",label='normalizeGrowth equipment return')
rep("""      ol.atk,ol.element,ol.maxAmmo,ol.chargeSpeed,ol.chargeDamage,ol.critRate,ol.critDamage,ol.accuracy,profile&&profile.cubeId||growth.cubeId||'none',growth.measuredCoeff,growth.manualRatio,status.complete,status.conservativeDefaultsUsed].join(':');""",
"""      ol.atk,ol.element,ol.maxAmmo,ol.chargeSpeed,ol.chargeDamage,ol.critRate,ol.critDamage,ol.accuracy,profile&&profile.cubeId||growth.cubeId||'none',growth.equipmentAttack,growth.equipmentHp,growth.equipmentDefense,growth.equipmentObservedSlots,growth.measuredCoeff,growth.manualRatio,status.complete,status.conservativeDefaultsUsed].join(':');""",label='fingerprint equipment')

# 4) Make new category cubes affect both legacy precision formula and stat-native 5deck basis.
rep("""distributedDamagePct:finite(out.distributedDmg,0),trueDamagePct:finite(out.trueDamageDmg,0),selfRateMultiplier""",
"""distributedDamagePct:finite(out.distributedDmg,0)+finite(ctx.cube?.distributed,0),trueDamagePct:finite(out.trueDamageDmg,0)+finite(ctx.cube?.trueDamage,0),selfRateMultiplier""",label='stat-native cube categories')

# 5) Scope external gear/meta by active account and import R3 observed gear stats.
rep("const VERSION='34.7.1',PAGE='v34610External',META_KEY='nikke_v34610_external_roster_meta_v1';",
"const VERSION='34.7.5',PAGE='v34610External',META_BASE_KEY='nikke_v34610_external_roster_meta_v1';\nconst metaStorageKey=()=>root.NIKKE_V26_ACCOUNT_API?.scopeKey?.(META_BASE_KEY)||META_BASE_KEY;",label='external meta scope header')
rep("""function gearMeta(row){const out={};for(const slot of ['head','torso','arm','leg']){const g=publicGear(row)?.[slot]||{};out[slot]={tid:num(g.tid),tier:num(g.tier),level:num(g.lv),corporationType:num(g.corporationType),optionIds:arr(g.optionIds).map(Number)};}return out;}\nasync function importExternalRoster""",
"""function gearMeta(row){const out={};for(const slot of ['head','torso','arm','leg']){const g=publicGear(row)?.[slot]||{};out[slot]={tid:num(g.tid),tier:num(g.tier),level:num(g.lv),corporationType:num(g.corporationType),optionIds:arr(g.optionIds).map(Number)};}return out;}\nfunction observedGearTotals(row,master){\n  const api=root.NIKKE_R3_DATA_API,role=master?.class||master?.role||'',map={head:'head',torso:'body',arm:'arm',leg:'leg'};let atk=0,hp=0,defense=0,observedSlots=0,unknownSlots=0,t9Slots=0;\n  for(const [slot,part] of Object.entries(map)){const g=publicGear(row)?.[slot]||{},tier=num(g.tier),level=num(g.lv);if(tier<=0)continue;const stat=api?.gearStats?.(role,tier,part,level,false);if(!stat){unknownSlots++;continue;}observedSlots++;if(tier===9)t9Slots++;atk+=num(stat.atk);hp+=num(stat.hp);defense+=num(stat.def);}\n  return{equipmentAttack:atk,equipmentHp:hp,equipmentDefense:defense,equipmentObservedSlots:observedSlots,equipmentUnknownSlots:unknownSlots,t9Slots,manufacturerBonusMode:t9Slots?'base-stat-no-manufacturer-bonus':'not-applicable'};\n}\nasync function importExternalRoster""",label='observed gear helper')
rep("""    const fav=tables.favorites?.[row.favoriteItemTid],favoriteItemPhase=fav?.rare==='SSR'?clamp(num(row.favoriteItemLv)+1,1,3):0;\n    characters[id]={owned:true,level:clamp(row.lv,1,1100),limitBreak:clamp(row.grade,0,3),coreLevel:clamp(row.core,0,7),bond:clamp(row.attractiveLv,0,40),skills:{skill1:clamp(row.skill1Lv,1,10),skill2:clamp(row.skill2Lv,1,10),burst:clamp(row.ultiSkillLv,1,10)},favoriteItemPhase,cubeId:cubeMode==='preserve'?String(current[id]?.cubeId||'none'):cubeId(row.harmonyCubeTid),overloadTotals:olTotals(row,options)};\n    external[id]={source,nameCode:row.nameCode,display,combat:num(row.combat),arenaCombat:num(row.arenaCombat),cubeTid:num(row.harmonyCubeTid),cubeLevel:num(row.harmonyCubeLv),favoriteItemTid:num(row.favoriteItemTid),favoriteItemLevel:num(row.favoriteItemLv),gear:gearMeta(row),observedAt:roster.observedAt||new Date().toISOString()};""",
"""    const fav=tables.favorites?.[row.favoriteItemTid],favoriteItemPhase=fav?.rare==='SSR'?clamp(num(row.favoriteItemLv)+1,1,3):0,gearTotals=observedGearTotals(row,master);\n    characters[id]={owned:true,level:clamp(row.lv,1,1100),limitBreak:clamp(row.grade,0,3),coreLevel:clamp(row.core,0,7),bond:clamp(row.attractiveLv,0,40),skills:{skill1:clamp(row.skill1Lv,1,10),skill2:clamp(row.skill2Lv,1,10),burst:clamp(row.ultiSkillLv,1,10)},favoriteItemPhase,cubeId:cubeMode==='preserve'?String(current[id]?.cubeId||'none'):cubeId(row.harmonyCubeTid),overloadTotals:olTotals(row,options),...(gearTotals.equipmentObservedSlots?{equipmentAttack:gearTotals.equipmentAttack,equipmentHp:gearTotals.equipmentHp,equipmentDefense:gearTotals.equipmentDefense,equipmentObservedSlots:gearTotals.equipmentObservedSlots}:{})};\n    external[id]={source,nameCode:row.nameCode,display,combat:num(row.combat),arenaCombat:num(row.arenaCombat),cubeTid:num(row.harmonyCubeTid),cubeLevel:num(row.harmonyCubeLv),favoriteItemTid:num(row.favoriteItemTid),favoriteItemLevel:num(row.favoriteItemLv),gear:gearMeta(row),gearTotals,observedAt:roster.observedAt||new Date().toISOString()};""",label='import observed gear fields')
rep("""  try{const old=JSON.parse(localStorage.getItem(META_KEY)||'{}');localStorage.setItem(META_KEY,JSON.stringify({...old,...external,_meta:{source,nickname:roster.nickname||'',observedAt:roster.observedAt||new Date().toISOString()}}));}catch(_){}""",
"""  try{const key=metaStorageKey(),legacy=localStorage.getItem(META_BASE_KEY),old=JSON.parse(localStorage.getItem(key)||legacy||'{}');localStorage.setItem(key,JSON.stringify({...old,...external,_meta:{source,nickname:roster.nickname||'',observedAt:roster.observedAt||new Date().toISOString()}}));}catch(_){}""",label='external meta scoped write')

# 6) Append V34.7.5 runtime fix: cube category injection + immediate precision growth context + verification.
marker='</body>'
if marker not in s: raise SystemExit('body marker missing')
patch=r'''
<script id="v3475-sync-propagation-audit-fix">
(function(root){
'use strict';
const VERSION='34.7.5';
const NEW_CUBES={
  rupture:{label:'럽처 / Rupture Lv.15',element:19.09,trueDamage:14.14,distributed:0},
  stealth:{label:'스텔스 / Stealth Lv.15 · 팀 엄폐물 HP↑(주효과 수치 미검증)',element:19.09,trueDamage:0,distributed:0,coverHpTeam:null},
  diffusion:{label:'디퓨전 / Diffusion Lv.15',element:19.09,trueDamage:0,distributed:17.69}
};
function finite(v,d=0){return Number.isFinite(Number(v))?Number(v):d;}
function augmentCubeTable(){
  try{if(typeof cubes!=='undefined'&&cubes)Object.assign(cubes,NEW_CUBES);}catch(_){}
  try{const values=root.NIKKE_V26_DATA?.cubes?.values;if(values)Object.assign(values,NEW_CUBES);}catch(_){}
  try{if(typeof nativeFields!=='undefined'&&Array.isArray(nativeFields)){if(!nativeFields.some(x=>x?.[0]==='trueDamage'))nativeFields.push(['trueDamage','트루 대미지','%','direct']);if(!nativeFields.some(x=>x?.[0]==='distributed'))nativeFields.push(['distributed','분배 대미지','%','direct']);}}catch(_){}
}
function patchLegacyPrecisionCategoryCubes(){
  try{
    if(root.__V3475_CATEGORY_CUBE_PATCHED__||typeof v21ApplyMultipliers!=='function')return;
    const previous=v21ApplyMultipliers;
    v21ApplyMultipliers=function(model,p,ctx,isTarget){
      const cube=ctx?.cube||{};
      if(!isTarget||(!finite(cube.trueDamage)&&!finite(cube.distributed)))return previous(model,p,ctx,isTarget);
      const next={...ctx,combo:{...(ctx?.combo||{})}};
      next.combo.trueDamageDmg=finite(next.combo.trueDamageDmg)+finite(cube.trueDamage);
      next.combo.distributedDmg=finite(next.combo.distributedDmg)+finite(cube.distributed);
      return previous(model,p,next,isTarget);
    };
    root.__V3475_CATEGORY_CUBE_PATCHED__=true;
  }catch(_){}
}
function installImmediateGrowthContext(){
  try{
    const result=root.NIKKEKitAwareOptimizer?.collectProfiles?.({},root);
    const rows=Array.isArray(result?.profiles)?result.profiles:[];if(!rows.length)return null;
    const byId={},byName={};
    for(const row of rows){const g=row?.growth||{},level=finite(g.level,200),ratio=finite(root.NIKKE_R3_DATA_API?.combatLevelRatio?.(row,level,400,'atk'),1),value={id:row.id,name:row.name,role:row.role,statGrowthFactor:ratio*(1+.02*(finite(g.limitBreak)+finite(g.coreLevel))),olAtk:finite(g.overload?.atk),olDefense:finite(g.overload?.defense),cubeId:row.cubeId||g.cubeId||'none',cubeDefense:finite(root.NIKKE_V26_DATA?.cubes?.values?.[row.cubeId||g.cubeId||'none']?.defense),limitBreak:finite(g.limitBreak),coreLevel:finite(g.coreLevel),level,skills:{...(g.skills||{})},equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null,equipmentObservedSlots:finite(g.equipmentObservedSlots)};byId[row.id]=value;byName[row.name]=value;}
    if(byId.mastRomanticMaid)byName['메이드 마스트']=byId.mastRomanticMaid;if(byId.anchorInnocentMaid)byName['메이드 앵커']=byId.anchorInnocentMaid;
    root.__v26TeamGrowthContext={byId,byName,source:'v3475-central-roster-immediate',updatedAt:new Date().toISOString()};return root.__v26TeamGrowthContext;
  }catch(_){return null;}
}
function refreshPrecision(){installImmediateGrowthContext();try{root.NIKKEV34610ProjectionTrace?.applyPrecisionRoster?.();}catch(_){}}
function verify(){augmentCubeTable();patchLegacyPrecisionCategoryCubes();const entries=root.NIKKE_V26_ROSTER_API?.cubeEntries?.()||[],ids=new Set(entries.map(x=>x.id)),ctx=installImmediateGrowthContext(),result={version:VERSION,cubes:{rupture:ids.has('rupture'),stealth:ids.has('stealth'),diffusion:ids.has('diffusion'),count:entries.length},categoryPrecisionPatched:!!root.__V3475_CATEGORY_CUBE_PATCHED__,growthContext:!!ctx,contextCount:Object.keys(ctx?.byId||{}).length,externalImporter:!!root.NIKKEV34610External?.importExternalRoster,accountScopedMeta:typeof root.NIKKE_V26_ACCOUNT_API?.scopeKey==='function'};result.pass=result.cubes.rupture&&result.cubes.stealth&&result.cubes.diffusion&&result.categoryPrecisionPatched&&result.growthContext&&result.externalImporter;root.NIKKEV3475SyncPropagationVerification=Object.freeze(result);return result;}
function brand(){try{root.document.title='니케 성장 계산기 V34.7.5 · BlaBla 실제반영 검증';for(const f of root.document.querySelectorAll('.footer,.footer-version'))f.textContent='Nikke Damage Growth Calculator · V34.7.5 · 2026-08-26';}catch(_){}}
function install(){augmentCubeTable();patchLegacyPrecisionCategoryCubes();refreshPrecision();verify();brand();if(root.__V3475_PROPAGATION_BOUND__)return;root.__V3475_PROPAGATION_BOUND__=true;root.addEventListener('nikke:v26-roster-updated',()=>root.setTimeout(refreshPrecision,0));root.document?.getElementById('precisionChar')?.addEventListener('change',()=>root.setTimeout(refreshPrecision,0));}
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();[80,350,900,1800,4200].forEach(ms=>root.setTimeout(install,ms));
root.NIKKEV3475SyncPropagation=Object.freeze({version:VERSION,verify,refreshPrecision,installImmediateGrowthContext});
})(window);
</script>
'''
s=s.replace(marker,patch+marker,1)
# Version labels in deployment autosync visible UI only.
s=s.replace("const VERSION='34.7.4';\nconst PROFILE_KEY='nikke_v3474_deploy_blablalink_profile';","const VERSION='34.7.5';\nconst PROFILE_KEY='nikke_v3474_deploy_blablalink_profile';",1)

src.write_text(s,'utf-8')
Path('public/index.html').write_text(s,'utf-8')
print('size',len(s.encode('utf-8')),'delta',len(s)-len(orig),'sha256',hashlib.sha256(s.encode()).hexdigest())