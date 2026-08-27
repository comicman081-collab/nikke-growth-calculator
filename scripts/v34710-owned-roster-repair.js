<script id="v34710-owned-roster-repair">
(function installV34710OwnedRosterRepair(root){
'use strict';
const VERSION='34.7.13';
// A new state key prevents an in-memory V34.7.11 approximate result from being
// reused after a hot update.  Keep the public API name below for compatibility.
const state=root.__NIKKE_V34713_FIVE_DECK_STATE__||{active:null,last:null,cache:null,installedAt:new Date().toISOString()};
root.__NIKKE_V34713_FIVE_DECK_STATE__=state;
const $=id=>root.document&&root.document.getElementById(id);
const arr=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
const delay=ms=>new Promise(resolve=>root.setTimeout(resolve,ms));
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const canonical=id=>{try{return String(root.NIKKE_FAVORITE_ITEM_IDENTITY?.canonicalId?.(String(id||''))||id||'');}catch(_){return String(id||'');}};
const profileId=profile=>String(profile?.id||'');
const RAID_FAVORITE_UNLOCK_REQUIRED=new Set(['moranTreasure','floraTreasure','privatyTreasure','helmTreasure','sugarTreasure','centiTreasure','zweiTreasure','mirandaTreasure','rosannaTreasure']);
function raidFavoriteEligible(profile){const id=profileId(profile);if(id==='phantomTreasure'||!RAID_FAVORITE_UNLOCK_REQUIRED.has(id))return true;return finite(profile?.growth?.favoriteItemPhase,finite(profile?.favoriteItemPhase,0))>0;}
const memberIds=team=>arr(team?.memberIds).length?arr(team.memberIds).map(String):arr(team?.members).map(member=>String(member?.id||member)).filter(Boolean);
const teamFingerprint=team=>memberIds(team).map(canonical).sort().join('|');
const constrained=()=>Boolean(root.AndroidNative)||finite(root.navigator?.deviceMemory,8)<=4||finite(root.innerWidth,1280)<=820;
function abortIfCancelled(cancelToken){if(cancelToken?.cancelled){const error=new Error('사용자가 계산을 중지했습니다.');error.name='AbortError';throw error;}}
function stableValue(value,seen=new WeakSet()){
 if(value==null||typeof value!=='object')return value;
 if(seen.has(value))return '[circular]';seen.add(value);
 if(Array.isArray(value))return value.map(row=>stableValue(row,seen));
 const out={};for(const key of Object.keys(value).sort()){const row=value[key];if(typeof row!=='function'&&key!=='raw')out[key]=stableValue(row,seen);}return out;
}
function panelParts(){const panel=$('nikke-kit-aware-optimizer-panel');return{panel,status:panel?.querySelector('#nikke-kit-status'),mount:panel?.querySelector('#nikke-kit-results'),button:panel?.querySelector('#nikke-kit-run')};}
function bossId(){return String($('soloBossSelect')?.value||$('v26OptimizerBoss')?.value||'annihilio');}
function centralRoster(){try{return root.NIKKE_V26_ROSTER_API?.load?.()?.characters||{};}catch(_){return{};}}
function dynamicCatalogRows(api){
 const rows=[],seen=new Set(),put=row=>{const id=String(row?.id||'');if(!id||seen.has(id))return;seen.add(id);rows.push(row);};
 try{for(const row of arr(api?.catalog?.()))put(row);}catch(_){}
 try{const characters=api?.load?.()?.characters||{};for(const [id,value] of Object.entries(characters))put({id,name:String(value?.name||id),weapon:'-',element:'-',burst:'-',role:'-',source:'stored-roster-fallback',calculationSupported:false,rosterOnly:true});}catch(_){}
 return rows;
}
function installDynamicOwnedApi(){
 const api=root.NIKKE_V26_ROSTER_API;if(!api?.load)return false;if(api.__v34710DynamicOwned===true)return true;
 const getOwned=()=>{const doc=api.load?.()||{characters:{}},characters=doc.characters||{};return dynamicCatalogRows(api).filter(row=>characters[row.id]?.owned===true).map(row=>{const stored=clone(characters[row.id]||{}),totals=typeof api.aggregate==='function'?api.aggregate(stored):(stored.overloadTotals||stored.overload||{});return Object.assign({},row,stored,{id:String(row.id),overloadTotals:totals});});};
 const getRosterCounts=()=>{const doc=api.load?.()||{characters:{}},characters=doc.characters||{},rows=dynamicCatalogRows(api);return{registered:rows.filter(row=>characters[row.id]).length,owned:rows.filter(row=>characters[row.id]?.owned===true).length,calculationSupported:rows.filter(row=>row.calculationSupported!==false).length,rosterOnly:rows.filter(row=>row.calculationSupported===false).length};};
 const wrapper=Object.freeze(Object.assign({},api,{getOwned,getRosterCounts,__v34710DynamicOwned:true,__v34710WrappedBase:api}));
 try{root.NIKKE_V26_ROSTER_API=wrapper;if(root.NIKKE_V26_API)root.NIKKE_V26_API.roster=wrapper;root.__NIKKE_V34710_DYNAMIC_OWNED_API__=true;return true;}catch(_){return false;}
}
function ownedRows(){installDynamicOwnedApi();try{return root.NIKKE_V26_ROSTER_API?.getOwned?.()||[];}catch(_){return[];}}
function receivedCount(){const text=String($('v34610BlaStatus')?.textContent||'');const match=text.match(/(\d+)\s*명\s*수신/);return match?Number(match[1]):ownedRows().length;}
function rosterFingerprint(input){
 const roster=centralRoster(),rows=arr(input?.owned).map(row=>String(row?.id||row)).sort();
 let hash=2166136261;
 const inputMap=new Map(arr(input?.owned).map(row=>[String(row?.id||row),row]));
 for(const id of rows){
  const central=roster[id]||{},incoming=inputMap.get(id)||{};
  // Growth propagation depends on much more than level/three skill values.  Include
  // every persisted equipment, OL, cube, bond and favorite-item field so a roster
  // edit can never hit a stale five-deck result.
  const snapshot={id,central,incoming};
  const s=JSON.stringify(stableValue(snapshot));for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619);}
 }
 let bossSnapshot=bossId();try{bossSnapshot=JSON.stringify(stableValue(root.NIKKEKitAwareOptimizer?.readBossFromPage?.(root)||bossSnapshot));}catch(_){}
 const suffix=`${VERSION}|${String(input?.mode||'owned')}|${bossSnapshot}`;for(let i=0;i<suffix.length;i++){hash^=suffix.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return `${VERSION}|${bossId()}|${rows.length}|${(hash>>>0).toString(16)}`;
}
function getRuntime(){
 const final=root.NIKKEV340FinalOptimizer,kit=root.NIKKEKitAwareOptimizer,api=root.NIKKE_V26_OPTIMIZER_API,sim=root.NIKKESinglePartyTimelineSimulator;
 if(!final?.resolveV3413RunRosterInput||!final?.profilesFor||!final?.simulateCandidate||!final?.selectFive||!final?.augment||!final?.dedupeAndQuota)throw new Error('V34 180초 후보·고정 규칙 선택기가 초기화되지 않았습니다.');
 if(!kit?.validateTeamRoles||!kit?.evaluateTeamRoles||!kit?.normalizeBoss||!kit?.generateCandidates)throw new Error('5덱 역할·후보 계산기가 초기화되지 않았습니다.');
 // V26 remains available for compatibility/independent diagnostics, but it no
 // longer gates or selects the production result.
 return{final,kit,api,sim};
}
function profilePools(profiles,boss,rules,usedCanonical=new Set()){
 const seen=new Set();const free=profile=>{const id=profileId(profile),key=canonical(id);if(!id||usedCanonical.has(key)||seen.has(key))return false;seen.add(key);return true;};
 const unique=list=>{seen.clear();return list.filter(free);};
 const supportScore=profile=>finite(profile?.support)*finite(profile?.growth?.supportMultiplier,1)+finite(profile?.b1Priority)*2+finite(profile?.growth?.survivalMultiplier)*25+finite(profile?.growth?.dealerMultiplier)*6;
 const dealerScore=profile=>{try{return finite(root.NIKKEKitAwareOptimizer.dealerScore(profile,boss,3,rules,[]),finite(profile?.dealer)*finite(profile?.growth?.dealerMultiplier,1));}catch(_){return finite(profile?.dealer)*finite(profile?.growth?.dealerMultiplier,1);}};
 const flexScore=profile=>dealerScore(profile)*.55+supportScore(profile)+finite(profile?.growth?.survivalMultiplier)*18;
 const by=(score)=>((a,b)=>score(b)-score(a)||profileId(a).localeCompare(profileId(b)));
 const b1=unique(profiles.filter(profile=>root.NIKKEKitAwareOptimizer.stageAllowed(profile,1,boss)&&profile.mainBurst1Eligible!==false)).sort(by(supportScore));
 const b2=unique(profiles.filter(profile=>root.NIKKEKitAwareOptimizer.stageAllowed(profile,2,boss)&&profile.mainBurst2Eligible!==false)).sort(by(supportScore));
 const b3=unique(profiles.filter(profile=>root.NIKKEKitAwareOptimizer.stageAllowed(profile,3,boss)&&root.NIKKEKitAwareOptimizer.activeBurstAllowed(profile,boss))).sort(by(dealerScore));
 const flex=unique(profiles.filter(profile=>profile.flexEligible&&!profile.noFlex&&!profile.activeBurstRequired)).sort(by(flexScore));
 return{b1,b2,b3,flex,supportScore,dealerScore,flexScore};
}
function coverage(profiles,boss,rules){
 const pools=profilePools(profiles,boss,rules,new Set());
 const uniqueAll=new Set(profiles.map(profile=>canonical(profileId(profile))).filter(Boolean));
 return{total:uniqueAll.size,b1:pools.b1.length,b2:pools.b2.length,b3:pools.b3.length,flex:pools.flex.length,pools};
}
function shortageMessage(info,received,owned,profiles){
 const missing=[];
 if(info.total<25)missing.push(`계산 가능 고유 캐릭터 ${info.total}/25`);
 if(info.b1<5)missing.push(`B1 ${info.b1}/5`);
 if(info.b2<5)missing.push(`B2 ${info.b2}/5`);
 if(info.b3<10)missing.push(`활성 B3 ${info.b3}/10`);
 if(info.flex<5)missing.push(`FLEX ${info.flex}/5`);
 return `연동 ${received}명 · 보유 저장 ${owned}명 · 계산 프로필 ${profiles}명. 실제 역할 부족: ${missing.join(' · ')||'없음'}`;
}
function assignedCubeCapacity(){
 const counts={};for(const row of Object.values(centralRoster())){if(!row?.owned)continue;const id=String(row.cubeId||'none');if(id==='none')continue;counts[id]=(counts[id]||0)+1;}
 return Math.max(1,...Object.values(counts));
}
function baseTeamToEvaluation(team,map,boss,rules){
 const provided=team?.__v34713Roles||team?.roles||{},members=arr(team?.members);const bySlot={b1:provided.b1,b2:provided.b2,b3a:arr(provided.b3)[0],b3b:arr(provided.b3)[1],flex:provided.flex};for(const member of members){const slot=String(member?.slot||'').toUpperCase();if(slot==='B1')bySlot.b1=map.get(String(member.id));else if(slot==='B2'||slot.startsWith('B2-1'))bySlot.b2=map.get(String(member.id));else if(slot.startsWith('B2-2')||slot==='FLEX'||slot.startsWith('FLEX-'))bySlot.flex=map.get(String(member.id));else if(slot.startsWith('B3-A'))bySlot.b3a=map.get(String(member.id));else if(slot.startsWith('B3-B'))bySlot.b3b=map.get(String(member.id));}
 if(!bySlot.b1||!bySlot.b2||!bySlot.b3a||!bySlot.b3b||!bySlot.flex){const ids=memberIds(team);bySlot.b1=bySlot.b1||map.get(ids[0]);bySlot.b2=bySlot.b2||map.get(ids[1]);bySlot.b3a=bySlot.b3a||map.get(ids[2]);bySlot.b3b=bySlot.b3b||map.get(ids[3]);bySlot.flex=bySlot.flex||map.get(ids[4]);}
 if([bySlot.b1,bySlot.b2,bySlot.b3a,bySlot.b3b,bySlot.flex].some(profile=>!profile))return null;
 const valid=root.NIKKEKitAwareOptimizer.validateTeamRoles(bySlot.b1,bySlot.b2,bySlot.b3a,bySlot.b3b,bySlot.flex,boss,rules);
 // Modernia is globally off-burst in Solo Raid.  Do not rely on boss-element
 // branches in older validators: active B3 Modernia is rejected on every boss.
 if(!valid?.ok||['modernia'].includes(profileId(bySlot.b3a))||['modernia'].includes(profileId(bySlot.b3b)))return null;
 const evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(bySlot.b1,bySlot.b2,bySlot.b3a,bySlot.b3b,bySlot.flex,boss,rules);
 if(!evaluated)return null;
 evaluated.__baseCandidateScore=finite(team?.score,evaluated.score);evaluated.__source=String(team?.__source||'v34-authoritative');evaluated.blueprintName=team?.blueprintName||'V34 후보';evaluated.memberIds=evaluated.members.map(profileId);evaluated.footprint=evaluated.memberIds.slice();evaluated.rotation=team?.rotation||evaluated.rotation||null;evaluated.__v34Tags=arr(team?.__v34Tags).slice();return evaluated;
}
function evaluationKey(candidate){const roles=candidate?.roles||{},b3=arr(roles.b3).map(profileId).sort().join('+');return`${profileId(roles.b1)}|${profileId(roles.b2)}|${b3}|${profileId(roles.flex)}`;}
function legalEvaluation(candidate,boss,rules,map,emergency=false){
 const roles=candidate?.roles||{},b3=arr(roles.b3),ids=[profileId(roles.b1),profileId(roles.b2),...b3.map(profileId),profileId(roles.flex)];
 if(ids.some(id=>!id)||ids.length!==5||new Set(ids.map(canonical)).size!==5||b3.length!==2)return{ok:false,reason:'shape-or-duplicate'};
 const locked=[roles.b1,roles.b2,...b3,roles.flex].find(profile=>!raidFavoriteEligible(profile));if(locked)return{ok:false,reason:`favorite-item-locked:${profileId(locked)}`};
 if(b3.some(profile=>profileId(profile)==='modernia'))return{ok:false,reason:'modernia-active-burst-global'};
 const hasMakoto=ids.includes('makotoNiijimaQueen'),hasYukiko=ids.includes('yukikoAmagi');if(hasMakoto!==hasYukiko)return{ok:false,reason:'persona-pair-split'};
 // V34 policy is authoritative for production candidates.  Re-running the old
 // kit validator here used to delete valid modern fixed routes (notably every
 // Moran Treasure B1 shell) after V34 policy and quota had already accepted
 // them. Keep the old validator only as a compatibility fallback.
 try{const finalPolicy=root.NIKKEV340FinalOptimizer?.policy;if(typeof finalPolicy==='function'&&map instanceof Map){const result=finalPolicy(candidate,boss,map,emergency);return result?.ok?{ok:true}:{ok:false,reason:String(result?.reason||'v34-final-policy')};}}catch(error){return{ok:false,reason:String(error?.message||'v34-final-policy-exception')};}
 try{const result=root.NIKKEKitAwareOptimizer.validateTeamRoles(roles.b1,roles.b2,b3[0],b3[1],roles.flex,boss,rules);return result?.ok?{ok:true}:{ok:false,reason:String(result?.reason||'role-validation')};}catch(error){return{ok:false,reason:String(error?.message||'role-validation-exception')};}
}
function fixedRouteKey(candidate){
 const roles=candidate?.roles||{},b2=profileId(roles.b2),flex=profileId(roles.flex),ids=new Set(arr(candidate?.members).map(profileId));
 if(b2==='crown'&&flex==='mastRomanticMaid')return'crown-mast';
 if(b2==='crown'&&flex==='helmTreasure')return'crown-helm';
 if(b2==='crown'&&flex==='privatyTreasure')return'crown-privaty';
 if(b2==='mastRomanticMaid'&&flex==='anchorInnocentMaid')return'maid-mast-anchor';
 if(b2==='prika'&&flex==='mint')return'pri-mint';
 if(ids.has('crown'))return'crown';
 if(profileId(roles.flex)==='modernia')return'modernia-offburst';
 return arr(candidate?.__v34Tags)[0]||'';
}
function augmentGlobalModerniaOffBurst(pool,map,boss,rules){
 const modernia=map.get('modernia');if(!modernia)return 0;
 if(pool.some(candidate=>profileId(candidate?.roles?.flex)==='modernia'&&!arr(candidate?.roles?.b3).some(profile=>profileId(profile)==='modernia')))return 0;
 const added=[];for(const candidate of arr(pool).slice().sort((a,b)=>finite(b?.score)-finite(a?.score))){
  const roles=candidate?.roles||{},b3=arr(roles.b3),ids=[profileId(roles.b1),profileId(roles.b2),...b3.map(profileId)];if(!roles.b1||!roles.b2||b3.length!==2||ids.includes('modernia'))continue;
  let evaluated=null;try{evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(roles.b1,roles.b2,b3[0],b3[1],modernia,boss,rules);}catch(_){}
  if(!evaluated||!legalEvaluation(evaluated,boss,rules,map).ok)continue;evaluated.__source='v34713-modernia-global-offburst';evaluated.__v34Tags=arr(evaluated.__v34Tags).concat(['modernia-global-offburst']);added.push(evaluated);if(added.length>=48)break;
 }
 pool.push(...added);return added.length;
}
async function augmentRequiredB1Routes(pool,map,boss,rules,cancelToken,status){
 const profiles=[...map.values()],pools=profilePools(profiles,boss,rules,new Set()),pairs=[];
 for(let i=0;i<pools.b3.length;i++)for(let j=i+1;j<pools.b3.length;j++)pairs.push({a:pools.b3[i],b:pools.b3[j],score:pools.dealerScore(pools.b3[i])+pools.dealerScore(pools.b3[j])});
 pairs.sort((a,b)=>b.score-a.score||profileId(a.a).localeCompare(profileId(b.a))||profileId(a.b).localeCompare(profileId(b.b)));
 const added={},existingBefore={},required=['littleMermaid','moranTreasure'];let checks=0;
 for(const id of required){
  const one=map.get(id);if(!one)continue;const existing=pool.filter(candidate=>profileId(candidate?.roles?.b1)===id).length;existingBefore[id]=existing;
  // V34 already creates a broad protected family for both required B1 routes.
  // Avoid a redundant combinatorial scan when that family is present; the
  // authoritative V34 policy below now preserves it through the timeline pool.
  if(existing>=48){added[id]=0;continue;}
  const local=[],seen=new Set();for(const two of pools.b2.slice(0,28)){
   let accepted=0;const offset=(profileId(two).length*17+id.length*11)%Math.max(1,pairs.length);
   for(let pairIndex=0;pairIndex<Math.min(220,pairs.length)&&accepted<6;pairIndex++){
    const pair=pairs[(offset+pairIndex)%pairs.length],baseIds=new Set([id,profileId(two),profileId(pair.a),profileId(pair.b)]);if(baseIds.size!==4)continue;
    const flexOffset=(pairIndex*13+profileId(two).length*7)%Math.max(1,pools.flex.length);for(let flexIndex=0;flexIndex<Math.min(32,pools.flex.length);flexIndex++){
     const fl=pools.flex[(flexOffset+flexIndex)%pools.flex.length];checks++;if(baseIds.has(profileId(fl)))continue;let valid,evaluated;try{valid=root.NIKKEKitAwareOptimizer.validateTeamRoles(one,two,pair.a,pair.b,fl,boss,rules);if(valid?.ok)evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(one,two,pair.a,pair.b,fl,boss,rules);}catch(_){}
     if(!evaluated||!legalEvaluation(evaluated,boss,rules,map).ok)continue;const key=evaluationKey(evaluated);if(seen.has(key))continue;seen.add(key);evaluated.__source=`v34713-required-b1-${id}`;evaluated.__v34Tags=arr(evaluated.__v34Tags).concat([`v34713-required-b1-${id}`]);local.push(evaluated);accepted++;break;
    }
    if((checks&2047)===0){abortIfCancelled(cancelToken);if(status)status.textContent=`${map.get(id)?.name||id} B1 고정 후보 생성 · ${checks.toLocaleString()}개 역할 확인`;await delay(0);}
   }
  }
  local.sort((a,b)=>finite(b.score)-finite(a.score)||evaluationKey(a).localeCompare(evaluationKey(b),'en'));const chosen=[],perB2=new Map(),perPair=new Map();for(const candidate of local){const b2=profileId(candidate.roles?.b2),pair=arr(candidate.roles?.b3).map(profileId).sort().join('|'),b2Count=perB2.get(b2)||0,pairCount=perPair.get(pair)||0;if(b2Count>=5||pairCount>=4)continue;perB2.set(b2,b2Count+1);perPair.set(pair,pairCount+1);chosen.push(candidate);if(chosen.length>=96)break;}pool.push(...chosen);added[id]=chosen.length;
 }
 return{added,existingBefore,checks,total:Object.values(added).reduce((sum,count)=>sum+count,0)};
}
function boundedLegalPool(source,boss,rules,map,emergency=false){
 const best=new Map(),rejected={};
 for(const candidate of arr(source)){
  const legal=legalEvaluation(candidate,boss,rules,map,emergency);if(!legal.ok){rejected[legal.reason]=(rejected[legal.reason]||0)+1;continue;}
  const key=evaluationKey(candidate),previous=best.get(key);if(!previous||finite(candidate.score)>finite(previous.score))best.set(key,candidate);
 }
 const all=[...best.values()].sort((a,b)=>finite(b.score)-finite(a.score)||evaluationKey(a).localeCompare(evaluationKey(b),'en'));
 // V34 dedupeAndQuota is itself capped at 1,100 candidates.  Preserve that whole
 // authoritative universe on mobile and desktop; runtime memory remains bounded.
 const cap=1100;if(all.length<=cap)return{pool:all,legalCount:all.length,cap,truncated:0,rejected};
 // Preserve every existing semantic/fixed package before applying the hard memory
 // bound to generic rows.  Crown variants are alternatives, not simultaneous locks.
 const keep=[],seen=new Set(),push=c=>{const key=evaluationKey(c);if(!seen.has(key)){seen.add(key);keep.push(c);}};
 for(const c of all)if(fixedRouteKey(c)||arr(c.__v34Tags).length)push(c);
 for(const c of all){if(keep.length>=cap)break;push(c);}
 return{pool:keep.slice(0,cap),legalCount:all.length,cap,truncated:Math.max(0,all.length-cap),rejected};
}
function compactRejectedSimulation(row){
 const simulation=row?.simulation;if(!simulation||typeof simulation!=='object')return;
 for(const key of ['samples','timeline','events','trace','damageTimeline','memberTimeline','burstWindows'])if(Array.isArray(simulation[key]))simulation[key].length=0;
}
function simulatedSpec(row){
 const source=row?.spec||row?.candidate?.spec;if(source)return{b1:String(source.b1||''),b2:String(source.b2||''),b3:arr(source.b3).map(String),flex:String(source.flex||'')};
 const roles=row?.candidate?.roles||row?.roles||{};return{b1:profileId(roles.b1),b2:profileId(roles.b2),b3:arr(roles.b3).map(profileId),flex:profileId(roles.flex)};
}
function specIds(spec){return[spec.b1,spec.b2,...arr(spec.b3),spec.flex].filter(Boolean);}
function requiredB1Counts(rows){const out={littleMermaid:0,moranTreasure:0};for(const row of arr(rows)){const id=simulatedSpec(row).b1;if(Object.prototype.hasOwnProperty.call(out,id))out[id]++;}return out;}
function effectiveBurstCooldown(profile,stage){const shared=root.NIKKEV34713EffectiveBurstCooldown;if(typeof shared==='function')return finite(shared(profile,stage),stage===3?40:20);const direct=[profile?.burstCooldown,profile?.cooldown,profile?.nativeBurstCooldown,profile?.skillProfile?.cooldown].map(value=>finite(value,Infinity)).find(value=>Number.isFinite(value));return finite(direct,stage===3?40:20);}
function moranFavoriteB1Eligible(map){const profile=map?.get?.('moranTreasure');return!!profile&&effectiveBurstCooldown(profile,1)<=20.5;}
function fallbackRequirements(pool,ownedSet,boss,map=null){
 const requirements=[],missing=[],unavailable=[],bossKey=String(boss?.id||boss?.raw?.id||''),weak=String(arr(boss?.weakElements||boss?.raw?.weakElements)[0]||'').toLowerCase(),owns=(...ids)=>ids.every(id=>ownedSet.has(id)&&(!(map instanceof Map)||(map.has(id)&&raidFavoriteEligible(map.get(id)))));
 // Keep every expected predicate in the mask even when the current timeline pool
 // has no matching row. The repair search can then target that missing family;
 // `unavailable` records the pool condition without deleting the requirement.
 const add=(id,predicate,expected=true)=>{if(!expected)return;const rule={id,predicate};requirements.push(rule);if(!arr(pool).some(row=>predicate(simulatedSpec(row)))){missing.push(id);unavailable.push(id);}};
 const active=(spec,id)=>arr(spec.b3).includes(id),has=(spec,id)=>specIds(spec).includes(id),pair=(spec,a,b)=>active(spec,a)&&active(spec,b);
 add('b1-little-mermaid',spec=>spec.b1==='littleMermaid',owns('littleMermaid'));
 // Moran is a mandatory fixed B1 only after her current favorite-item growth
 // produces at least one valid 20-second 180 s timeline. Phase 0 remains a
 // native 40-second B1 and must not make the whole five-deck search impossible.
 add('b1-moran-treasure',spec=>spec.b1==='moranTreasure',owns('moranTreasure')&&moranFavoriteB1Eligible(map));
 add('pri-mint-fixed',spec=>spec.b2==='prika'&&spec.flex==='mint',owns('prika','mint'));
 add('crown-apex-b2-family',spec=>has(spec,'crown'),owns('crown'));
 // Christmas Brid is a high-value Fire B2 candidate, not a hard five-deck
 // allocation lock and not a shotgun-only member.  Her candidate score competes
 // with Arcana when healing is unnecessary and Nayuta/Naga when mechanics or
 // survival demand them.
 add('fire-anis-rapi-anchor',spec=>spec.b1==='anisStar'&&active(spec,'rapiRedHood'),weak==='fire'&&owns('anisStar','rapiRedHood'));
 add('iron-anis-crystal-wave-anchor',spec=>spec.b1==='anisStar'&&active(spec,'cinderellaCrystalWave'),weak==='iron'&&bossKey!=='islandEaterS39'&&owns('anisStar','cinderellaCrystalWave'));
 add('wind-sbs-liberalio-maid-core',spec=>spec.b1==='anisStar'&&spec.b2==='mastRomanticMaid'&&spec.flex==='anchorInnocentMaid'&&pair(spec,'scarletBlackShadow','liberalio'),weak==='wind'&&owns('anisStar','mastRomanticMaid','anchorInnocentMaid','scarletBlackShadow','liberalio'));
 add('water-heavy-arms-core',spec=>active(spec,'snowWhiteHeavyArms')&&['mirandaTreasure','zweiTreasure'].includes(spec.b1)&&['liter','volume','dKillerWife'].includes(spec.flex)&&!['dolla','helmAquamarine','arcana','prika','mastRomanticMaid','blanc'].includes(spec.b2),weak==='water'&&owns('snowWhiteHeavyArms'));
 add('electric-arcana-isabel-18',spec=>spec.b1==='anisStar'&&spec.b2==='arcana'&&pair(spec,'isabel','cinderella')&&['crown','floraTreasure'].includes(spec.flex),weak==='electric'&&owns('anisStar','arcana','isabel','cinderella')&&(owns('crown')||owns('floraTreasure')));
 if(bossKey==='islandEaterS39'){
  add('island-top-crown-package',spec=>spec.b1==='anisStar'&&spec.b2==='crown'&&spec.flex==='naga'&&pair(spec,'rapiRedHood','privatyTreasure'),owns('anisStar','crown','naga','rapiRedHood','privatyTreasure'));
  add('island-cwave-eve-maid-package',spec=>spec.b1==='littleMermaid'&&spec.b2==='mastRomanticMaid'&&spec.flex==='anchorInnocentMaid'&&pair(spec,'cinderellaCrystalWave','eve'),owns('littleMermaid','mastRomanticMaid','anchorInnocentMaid','cinderellaCrystalWave','eve'));
  add('island-miranda-marine-package',spec=>spec.b1==='mirandaTreasure'&&['nayuta','adeAgentBunny'].includes(spec.b2)&&spec.flex==='helmAquamarine'&&has(spec,'marcianaMarineStudy')&&has(spec,'helmTreasure'),owns('mirandaTreasure','marcianaMarineStudy','helmTreasure','helmAquamarine')&&(owns('nayuta')||owns('adeAgentBunny')));
 }
 // Character metadata is the forward-compatible source of five-deck allocation
 // locks. Crown has an explicit family rule above. Christmas Brid is purposely
 // skipped here because Fire preference must not become a mandatory allocation.
 const allocationProfiles=new Map(),putAllocation=profile=>{if(!profile||finite(profile.fiveDeckMinUses)<=0)return;const id=String(profile.id||''),previous=allocationProfiles.get(id)||{};if(id)allocationProfiles.set(id,Object.assign({},previous,profile));};for(const profile of arr(root.NIKKE_V26_7_CHARACTER_CATALOG))putAllocation(profile);if(map instanceof Map)for(const profile of map.values())putAllocation(profile);
 for(const [id,profile] of allocationProfiles){if(!id||['crown','bridSilentTrack'].includes(id)||!owns(id))continue;const weaknesses=arr(profile.fiveDeckAllocationWeaknesses).map(value=>String(value).toLowerCase());if(weaknesses.length&&!weaknesses.includes(weak))continue;const activeB2Only=String(profile.fiveDeckAllocationRole||'')==='weakness-specialist-b2';add(`allocation-${id}`,spec=>activeB2Only?spec.b2===id:has(spec,id));}
 const explicitAnis=(weak==='fire'&&owns('rapiRedHood'))||(weak==='iron'&&bossKey!=='islandEaterS39'&&owns('cinderellaCrystalWave'))||(weak==='wind'&&owns('mastRomanticMaid','anchorInnocentMaid','scarletBlackShadow','liberalio'))||(weak==='water'&&owns('snowWhiteHeavyArms'))||(weak==='electric'&&owns('arcana','isabel','cinderella')&&(owns('crown')||owns('floraTreasure')))||bossKey==='islandEaterS39';
 const pairKey=spec=>arr(spec?.b3).map(String).sort().join('|'),ranked=arr(pool).filter(row=>arr(simulatedSpec(row).b3).length===2).slice().sort((a,b)=>finite(b?.rawDamage,finite(b?.score,finite(b?.candidate?.score)))-finite(a?.rawDamage,finite(a?.score,finite(a?.candidate?.score)))||evaluationKey(a?.candidate||a).localeCompare(evaluationKey(b?.candidate||b),'en')),topPair=ranked.length?pairKey(simulatedSpec(ranked[0])):'',anisTopPairAvailable=!!topPair&&arr(pool).some(row=>{const spec=simulatedSpec(row);return spec.b1==='anisStar'&&pairKey(spec)===topPair;});
 add('anis-generic-top-anchor',spec=>spec.b1==='anisStar'&&(!anisTopPairAvailable||pairKey(spec)===topPair),owns('anisStar')&&!explicitAnis);
 return{requirements,missing,unavailable,weak,bossKey,genericAnisTopPair:anisTopPairAvailable?topPair:''};
}
function enumerateExchangeContenders(rows,winnerPicks,fullRequired,limit=24){
 const ordered=arr(rows),winner=arr(winnerPicks).slice().sort((a,b)=>a-b),winnerSet=new Set(winner),outside=ordered.filter(row=>!winnerSet.has(row.order)),top=[],topKeys=new Set();let oneExchangeCovers=0,twoExchangeCovers=0,pairChecks=0;
 const compare=(a,b)=>b.score-a.score||a.key.localeCompare(b.key,'en'),insert=(picks,score,exchangeCount)=>{const sorted=picks.slice().sort((a,b)=>a-b),key=sorted.join('|');if(topKeys.has(key))return;const cover={picks:sorted,score,key,exchangeCount};if(top.length<limit){top.push(cover);topKeys.add(key);top.sort(compare);return;}if(compare(cover,top[top.length-1])>=0)return;topKeys.delete(top[top.length-1].key);top[top.length-1]=cover;topKeys.add(key);top.sort(compare);};
 const summarize=picks=>{let mask=0n,covered=0,score=0;for(const index of picks){const row=ordered[index];if(!row||(mask&row.mask))return null;mask|=row.mask;covered|=row.requiredMask;score+=row.score;}return{mask,covered,score};};
 const winnerSummary=summarize(winner);if(!winnerSummary||winner.length!==5||winnerSummary.covered!==fullRequired)return{covers:[],oneExchangeCovers,twoExchangeCovers,pairChecks,exhaustive:false};insert(winner,winnerSummary.score,0);
 for(let drop=0;drop<winner.length;drop++){
  const kept=winner.filter((_,index)=>index!==drop),base=summarize(kept);if(!base)continue;
  for(const row of outside){if(row.mask&base.mask)continue;if((base.covered|row.requiredMask)!==fullRequired)continue;oneExchangeCovers++;insert(kept.concat(row.order),base.score+row.score,1);}
 }
 for(let firstDrop=0;firstDrop<winner.length;firstDrop++)for(let secondDrop=firstDrop+1;secondDrop<winner.length;secondDrop++){
  const kept=winner.filter((_,index)=>index!==firstDrop&&index!==secondDrop),base=summarize(kept);if(!base)continue;
  for(let first=0;first<outside.length;first++){
   const a=outside[first];if(a.mask&base.mask)continue;const firstMask=base.mask|a.mask,firstCovered=base.covered|a.requiredMask,firstScore=base.score+a.score;
   for(let second=first+1;second<outside.length;second++){pairChecks++;const b=outside[second];if(b.mask&firstMask)continue;if((firstCovered|b.requiredMask)!==fullRequired)continue;twoExchangeCovers++;insert(kept.concat(a.order,b.order),firstScore+b.score,2);}
  }
 }
 return{covers:top.sort(compare),oneExchangeCovers,twoExchangeCovers,pairChecks,exhaustive:true};
}
function constrainedTimelineSelect(pool,ownedSet,boss,map,seedSelection=null){
 const source=arr(pool).filter(row=>{const ids=specIds(simulatedSpec(row));return ids.length===5&&new Set(ids.map(canonical)).size===5&&finite(row?.rawDamage,finite(row?.score))>0;});
 const required=fallbackRequirements(source,ownedSet,boss,map);if(required.missing.length)return{selected:null,diagnostics:{engine:'v34713-constrained-timeline-exact',missingRequirements:required.missing,requirements:required.requirements.map(row=>row.id)}};
 const characters=[...new Set(source.flatMap(row=>specIds(simulatedSpec(row)).map(canonical)))],bit=new Map(characters.map((id,index)=>[id,BigInt(index)]));
 const rows=source.map(candidate=>{const spec=simulatedSpec(candidate),ids=specIds(spec).map(canonical),score=finite(candidate?.rawDamage,finite(candidate?.score));return{candidate,spec,ids,score,mask:ids.reduce((mask,id)=>mask|(1n<<bit.get(id)),0n),requiredMask:0};}).sort((a,b)=>b.score-a.score||evaluationKey(a.candidate?.candidate||a.candidate).localeCompare(evaluationKey(b.candidate?.candidate||b.candidate),'en'));rows.forEach((row,index)=>{row.order=index;});
 required.requirements.forEach((rule,index)=>{const flag=1<<index;for(const row of rows)if(rule.predicate(row.spec))row.requiredMask|=flag;});
 const fullRequired=(1<<required.requirements.length)-1,deadline=performance.now()+(constrained()?5200:8500),nodeLimit=constrained()?1800000:3600000;let nodes=0,timeCapped=false,nodeCapped=false,best=null;
 if(arr(seedSelection?.teams).length===5){const byKey=new Map(rows.map(row=>[evaluationKey(row.candidate?.candidate||row.candidate),row])),picks=[];let mask=0n,covered=0,score=0,valid=true;for(const team of seedSelection.teams){const row=byKey.get(evaluationKey(team?.candidate||team));if(!row||(mask&row.mask)){valid=false;break;}picks.push(row.order);mask|=row.mask;covered|=row.requiredMask;score+=row.score;}if(valid&&picks.length===5&&covered===fullRequired)best={picks:picks.slice().sort((a,b)=>a-b),score,covered,seeded:true};}
 const compatible=(row,mask)=>!(row.mask&mask),missingCompatible=(missing,mask)=>{for(let bitIndex=0;bitIndex<required.requirements.length;bitIndex++){const flag=1<<bitIndex;if((missing&flag)&&!rows.some(row=>compatible(row,mask)&&(row.requiredMask&flag)))return false;}return true;};
 const seedMemo=new Set();
 function seed(picks,mask,covered,score){
  if(++nodes>nodeLimit){nodeCapped=true;return false;}if((nodes&1023)===0&&performance.now()>deadline){timeCapped=true;return false;}
  if(picks.length===5){if(covered===fullRequired){best={picks:picks.slice(),score,covered};return true;}return false;}
  const missing=fullRequired&~covered;if(!missingCompatible(missing,mask))return false;const memoKey=`${mask}|${covered}|${picks.length}`;if(seedMemo.has(memoKey))return false;seedMemo.add(memoKey);
  let choices=rows;if(missing){let fewest=null;for(let bitIndex=0;bitIndex<required.requirements.length;bitIndex++){const flag=1<<bitIndex;if(!(missing&flag))continue;const list=rows.filter(row=>compatible(row,mask)&&(row.requiredMask&flag));if(fewest===null||list.length<fewest.length)fewest=list;}choices=fewest||[];}
  for(const row of choices){if(picks.includes(row.order)||!compatible(row,mask))continue;if(seed(picks.concat(row.order),mask|row.mask,covered|row.requiredMask,score+row.score))return true;if(timeCapped||nodeCapped)return false;}
  return false;
 }
 if(!best)seed([],0n,0,0);const seedNodes=nodes;
 if(best&&!timeCapped&&!nodeCapped){
  const optimistic=(start,need,mask)=>{let total=0,count=0;for(let index=start;index<rows.length&&count<need;index++){const row=rows[index];if(!compatible(row,mask))continue;total+=row.score;count++;}return count===need?total:-Infinity;};
  function visit(start,need,mask,covered,score,picks){
   if(++nodes>nodeLimit){nodeCapped=true;return;}if((nodes&1023)===0&&performance.now()>deadline){timeCapped=true;return;}
   if(need===0){if(covered===fullRequired&&score>best.score+1e-7)best={picks:picks.slice(),score,covered};return;}
   if(rows.length-start<need)return;const bound=optimistic(start,need,mask);if(!Number.isFinite(bound)||score+bound<=best.score+1e-7)return;
   const missing=fullRequired&~covered;if(!missingCompatible(missing,mask))return;
   for(let index=start;index<=rows.length-need;index++){
    const row=rows[index];if(!compatible(row,mask))continue;const nextMask=mask|row.mask,nextCovered=covered|row.requiredMask,rest=need===1?0:optimistic(index+1,need-1,nextMask);if(!Number.isFinite(rest)||score+row.score+rest<=best.score+1e-7)continue;
    visit(index+1,need-1,nextMask,nextCovered,score+row.score,picks.concat(index));if(timeCapped||nodeCapped)return;
   }
  }
  visit(0,5,0n,0,0,[]);
 }
 if(!best)return{selected:null,diagnostics:{engine:'v34713-constrained-timeline-exact',requirements:required.requirements.map(row=>row.id),missingRequirements:required.missing,nodes,seedNodes,timeCapped,nodeCapped,poolSize:rows.length,feasible:false}};
 const coarsePicks=best.picks.slice().sort((a,b)=>a-b),teams=coarsePicks.map(index=>rows[index].candidate).sort((a,b)=>finite(b?.rawDamage,finite(b?.score))-finite(a?.rawDamage,finite(a?.score))||evaluationKey(a?.candidate||a).localeCompare(evaluationKey(b?.candidate||b),'en')),neighborhood=enumerateExchangeContenders(rows,coarsePicks,fullRequired,24),contenders=neighborhood.covers.map(cover=>{const coverTeams=cover.picks.map(index=>rows[index].candidate);return{teams:coverTeams,score:cover.score,key:cover.key,keys:coverTeams.map(team=>evaluationKey(team?.candidate||team)).sort(),exchangeCount:cover.exchangeCount};}),coarseWinnerKeys=teams.map(team=>evaluationKey(team?.candidate||team)).sort(),commonDiagnostics={engine:'v34713-constrained-timeline-exact',requirements:required.requirements.map(row=>row.id),nodes,seedNodes,timeCapped,nodeCapped,proven:!timeCapped&&!nodeCapped,poolSize:rows.length,feasible:true,coarseWinnerKeys,coarseWinnerTotal:best.score,contenderCoverCount:contenders.length,oneExchangeCovers:neighborhood.oneExchangeCovers,twoExchangeCovers:neighborhood.twoExchangeCovers,exchangePairChecks:neighborhood.pairChecks,exchangeNeighborhoodExhaustive:neighborhood.exhaustive,maxExchangeTeams:2};
 return{selected:{teams,score:best.score,ids:new Set(teams.flatMap(team=>specIds(simulatedSpec(team)))),mandatoryInfo:{mode:'v34713-constrained-timeline-fallback'},searchDiagnostics:{...commonDiagnostics}},contenders,diagnostics:{...commonDiagnostics}};
}
function packingPopcount(value){let n=0,x=value>>>0;while(x){n+=x&1;x>>>=1;}return n;}
function greedyPackingSeeds(pool,ownedSet,boss,map){
 const source=arr(pool).filter(row=>specIds(simulatedSpec(row)).length===5&&finite(row?.rawDamage,finite(row?.score))>0),required=fallbackRequirements(source,ownedSet,boss,map),rules=required.requirements;
 const rows=source.map((candidate,index)=>{const spec=simulatedSpec(candidate),ids=specIds(spec).map(canonical);let requiredMask=0;rules.forEach((rule,bit)=>{if(rule.predicate(spec))requiredMask|=1<<bit;});return{candidate,index,spec,ids,requiredMask,score:finite(candidate?.rawDamage,finite(candidate?.score))};}).sort((a,b)=>b.score-a.score||a.index-b.index);
 const starters=[],seenStart=new Set(),addStart=row=>{if(row&&!seenStart.has(row.index)){seenStart.add(row.index);starters.push(row);}};rows.slice(0,48).forEach(addStart);for(let bit=0;bit<rules.length;bit++)rows.filter(row=>row.requiredMask&(1<<bit)).slice(0,10).forEach(addStart);
 const seeds=[],seenSeed=new Set();for(const first of starters){const picks=[first],used=new Set(first.ids),picked=new Set([first.index]);let covered=first.requiredMask,score=first.score;
  while(picks.length<5){let best=null,bestGain=-1;for(const row of rows){if(picked.has(row.index)||row.ids.some(id=>used.has(id)))continue;const gain=packingPopcount(row.requiredMask&~covered);if(gain>bestGain||(gain===bestGain&&(!best||row.score>best.score))){best=row;bestGain=gain;}}if(!best)break;picks.push(best);picked.add(best.index);best.ids.forEach(id=>used.add(id));covered|=best.requiredMask;score+=best.score;}
  const key=picks.map(row=>row.index).sort((a,b)=>a-b).join('|');if(!seenSeed.has(key)){seenSeed.add(key);seeds.push({picks,used,covered,score,fullRequired:(1<<rules.length)-1,requirements:rules.map(row=>row.id)});}
 }
 return seeds.sort((a,b)=>b.picks.length-a.picks.length||packingPopcount(b.covered)-packingPopcount(a.covered)||b.score-a.score).slice(0,16).map(seed=>({...seed,missingRequirements:required.missing.slice()}));
}
function recomputePackingSeed(picks,requirements,missingRequirements=[]){
 const rules=arr(requirements),rows=arr(picks).map(row=>{const spec=row?.spec||simulatedSpec(row?.candidate||row),ids=arr(row?.ids).length?arr(row.ids).map(canonical):specIds(spec).map(canonical);let requiredMask=0;rules.forEach((rule,bit)=>{if(rule.predicate(spec))requiredMask|=1<<bit;});return{...row,spec,ids,requiredMask};}),used=new Set();let covered=0,score=0;for(const row of rows){row.ids.forEach(id=>used.add(id));covered|=row.requiredMask;score+=finite(row?.score);}return{picks:rows,used,covered,score,fullRequired:(1<<rules.length)-1,requirements:rules.map(row=>row.id),missingRequirements:arr(missingRequirements).slice()};
}
function replacementPackingSeeds(seeds,requirements){
 const out=[],seen=new Set(),push=seed=>{if(seed?.picks?.length!==4)return;const key=seed.picks.map(row=>finite(row?.index,-1)).sort((a,b)=>a-b).join('|');if(seen.has(key))return;seen.add(key);out.push(seed);};
 for(const seed of arr(seeds)){if(seed?.picks?.length===4)push(recomputePackingSeed(seed.picks,requirements,seed.missingRequirements));else if(seed?.picks?.length===5)for(let drop=0;drop<5;drop++)push(recomputePackingSeed(seed.picks.filter((_,index)=>index!==drop),requirements,seed.missingRequirements));}
 return out.sort((a,b)=>packingPopcount(b.covered)-packingPopcount(a.covered)||b.score-a.score).slice(0,28);
}
function requirementPackingSeeds(pool,requirements){
 const rules=arr(requirements),fullRequired=(1<<rules.length)-1;if(!rules.length)return[];
 const rows=arr(pool).map((candidate,index)=>{const spec=simulatedSpec(candidate),ids=specIds(spec).map(canonical);let requiredMask=0;rules.forEach((rule,bit)=>{if(rule.predicate(spec))requiredMask|=1<<bit;});return{candidate,index,spec,ids,requiredMask,score:finite(candidate?.rawDamage,finite(candidate?.score))};}).filter(row=>row.ids.length===5&&new Set(row.ids).size===5).sort((a,b)=>b.score-a.score||a.index-b.index);
 const seeds=[],seen=new Set();let nodes=0;const compatible=(row,used)=>!row.ids.some(id=>used.has(id)),push=picks=>{const seed=recomputePackingSeed(picks,rules,[]),key=seed.picks.map(row=>row.index).sort((a,b)=>a-b).join('|');if(seed.picks.length===4&&seed.covered===fullRequired&&!seen.has(key)){seen.add(key);seeds.push(seed);}};
 function fill(picks,used){if(seeds.length>=48||nodes>=90000)return;if(picks.length===4){push(picks);return;}let scanned=0;for(const row of rows){if(!compatible(row,used))continue;if(scanned++>=32)break;const next=new Set(used);row.ids.forEach(id=>next.add(id));nodes++;fill(picks.concat(row),next);if(seeds.length>=48||nodes>=90000)return;}}
 function visit(picks,used,covered){if(seeds.length>=48||nodes>=90000)return;if(covered===fullRequired){fill(picks,used);return;}if(picks.length>=4)return;let choices=null;for(let bit=0;bit<rules.length;bit++){const flag=1<<bit;if(covered&flag)continue;const list=rows.filter(row=>(row.requiredMask&flag)&&compatible(row,used));if(!list.length)return;if(!choices||list.length<choices.length)choices=list;}let scanned=0;for(const row of choices||[]){if(scanned++>=56)break;const next=new Set(used);row.ids.forEach(id=>next.add(id));nodes++;visit(picks.concat(row),next,covered|row.requiredMask);if(seeds.length>=48||nodes>=90000)return;}}
 visit([],new Set(),0);return seeds.sort((a,b)=>b.score-a.score);
}
function feasibilitySelection(rows,ownedSet,boss,map){
 const teams=arr(rows),ids=teams.flatMap(team=>specIds(simulatedSpec(team)).map(canonical));if(teams.length!==5||ids.length!==25||new Set(ids).size!==25)return null;const required=fallbackRequirements(teams,ownedSet,boss,map);if(required.missing.length)return null;const score=teams.reduce((sum,team)=>sum+finite(team?.rawDamage,finite(team?.score)),0);return{teams,score,ids:new Set(ids),mandatoryInfo:{mode:'v34713-feasibility-witness'},searchDiagnostics:{engine:'v34713-feasibility-witness',requirements:required.requirements.map(row=>row.id),provenFeasible:true,optimalityProven:false,selectedTeamCount:teams.length}};
}
function feasibilityDiagnostic(result){if(!result)return null;const out={...result};if(out.selected){out.witnessKeys=arr(out.selected.teams).map(team=>evaluationKey(team?.candidate||team));delete out.selected;}return out;}
async function augmentTimelineFeasibility({simulated,candidates,pool,profiles,boss,rules,map,ownedSet,cancelToken,status,runtime,timelineStep,emergency=false}){
 const required=fallbackRequirements(simulated,ownedSet,boss,map),before=greedyPackingSeeds(simulated,ownedSet,boss,map),bestBefore=before[0]||null,complete=before.find(seed=>!seed?.missingRequirements?.length&&seed?.picks?.length===5&&seed.covered===seed.fullRequired);
 if(complete){const selected=feasibilitySelection(complete.picks.map(row=>row.candidate),ownedSet,boss,map);if(selected)return{needed:false,added:0,attempts:0,checks:0,bestBefore:5,bestAfter:5,requirements:complete.requirements,missingRequirements:[],selected};}
 const targetedSeeds=requirementPackingSeeds(simulated,required.requirements),fallbackSeeds=replacementPackingSeeds(before,required.requirements),repairSeeds=[],repairSeedKeys=new Set();for(const seed of targetedSeeds.concat(fallbackSeeds)){const key=seed.picks.map(row=>row.index).sort((a,b)=>a-b).join('|');if(!repairSeedKeys.has(key)){repairSeedKeys.add(key);repairSeeds.push(seed);}}repairSeeds.sort((a,b)=>packingPopcount(b.covered)-packingPopcount(a.covered)||b.score-a.score);const candidateKeys=new Set(candidates.map(evaluationKey)),simulationKeys=new Set(simulated.map(row=>evaluationKey(row?.candidate||row)));let added=0,attempts=0,rejected=0,checks=0,remainingChecks=140000;
 // First try a one-team replacement already present in the validated timeline
 // pool. This is O(seed*pool), avoids every role re-evaluation, and is the
 // normal path when the legacy selector merely lost a feasible witness.
 for(const seed of repairSeeds){for(const result of simulated){const spec=simulatedSpec(result),ids=specIds(spec).map(canonical);if(ids.length!==5||ids.some(id=>seed.used.has(id)))continue;let mask=0;required.requirements.forEach((rule,bit)=>{if(rule.predicate(spec))mask|=1<<bit;});if((seed.covered|mask)!==seed.fullRequired)continue;const selected=feasibilitySelection(seed.picks.map(row=>row.candidate).concat(result),ownedSet,boss,map);if(selected)return{needed:true,added:0,attempts:0,rejected:0,checks:0,bestBefore:bestBefore?.picks?.length||0,bestAfter:5,repairSeedCount:repairSeeds.length,requirements:selected.searchDiagnostics.requirements,missingRequirements:[],selected};}}
 // If the validated pool has no compatible fifth team, generate only a team
 // that covers every requirement missing from the retained four. Do not redo a
 // generic 28만-combination scan for five already-known teams.
 for(const seed of repairSeeds.slice(0,12)){
  abortIfCancelled(cancelToken);const missingMask=seed.fullRequired&~seed.covered,missingRules=required.requirements.filter((_,bit)=>missingMask&(1<<bit));attempts++;if(status)status.textContent=`5팀 고정조건 1팀 교체 ${attempts}/${Math.min(12,repairSeeds.length)} · ${missingRules.length?missingRules.map(row=>row.id).join(', '):'고정조건 유지용 미사용 1팀'}`;
  if(remainingChecks<=0)break;const found=await searchUnusedTeam({profiles,boss,rules,used:seed.used,cancelToken,status,runtime,maxResults:12,maxChecks:Math.min(40000,remainingChecks),excludeKeys:candidateKeys,authoritativeMap:map,emergency,requiredPredicates:missingRules.map(row=>row.predicate)});checks+=finite(found?.checks);remainingChecks-=finite(found?.checks);
  for(const evaluated of arr(found?.results)){const key=evaluationKey(evaluated);if(candidateKeys.has(key)||simulationKeys.has(key))continue;if(!legalEvaluation(evaluated,boss,rules,map,emergency).ok)continue;evaluated.__source='v34713-feasibility-filler';evaluated.__v34Tags=arr(evaluated.__v34Tags).concat(['v34713-feasibility-filler']);let result;try{result=runtime.final.simulateCandidate(evaluated,boss,map,timelineStep);}catch(error){result={ok:false,reason:String(error?.message||error)};}if(!result?.ok){rejected++;compactRejectedSimulation(result);continue;}candidateKeys.add(key);simulationKeys.add(key);candidates.push(evaluated);pool.push(evaluated);simulated.push(result);added++;const direct=feasibilitySelection(seed.picks.map(row=>row.candidate).concat(result),ownedSet,boss,map);if(direct)return{needed:true,added,attempts,rejected,checks,bestBefore:bestBefore?.picks?.length||0,bestAfter:5,repairSeedCount:repairSeeds.length,requirements:direct.searchDiagnostics.requirements,missingRequirements:[],selected:direct};}
  await delay(0);abortIfCancelled(cancelToken);
 }
 const after=greedyPackingSeeds(simulated,ownedSet,boss,map)[0]||null,uncoveredRequirements=required.requirements.filter((_,bit)=>!((after?.covered||0)&(1<<bit))).map(row=>row.id);return{needed:true,added,attempts,rejected,checks,bestBefore:bestBefore?.picks?.length||0,bestBeforeCoverage:packingPopcount(bestBefore?.covered||0),bestAfter:after?.picks?.length||0,bestAfterCoverage:packingPopcount(after?.covered||0),targetedSeedCount:targetedSeeds.length,repairSeedCount:repairSeeds.length,requirements:required.requirements.map(row=>row.id),uncoveredRequirements,unavailableRequirements:required.unavailable.slice(),missingRequirements:uncoveredRequirements};
}
function selectedMaterialized(row,index){
 const candidate=row?.candidate||row,profiles=arr(row?.members).length?arr(row.members):arr(candidate?.members),ids=profiles.map(profileId);
 const team=Object.assign({},candidate,{index:index+1,memberIds:ids,footprint:ids.slice(),members:profiles,roles:candidate?.roles||row?.roles,spec:row?.spec||candidate?.spec,rotation:row?.rotation||candidate?.rotation||null,score:finite(row?.rawDamage,finite(row?.score,finite(candidate?.score))),approximateScore:finite(row?.rawDamage,finite(row?.score)),rawDamage:finite(row?.rawDamage),scoreIndex:finite(row?.scoreIndex,finite(row?.score)),damageIndex:finite(row?.damageIndex,finite(row?.rawDamage)),simulation:row?.simulation||null,timelineStep:finite(row?.timelineStep),cadence:row?.cadence||null,finisher:row?.finisher||null,sustain:row?.sustain||null,__v34713Simulation:true});
 team.v34713Timeline={ok:true,totalDamage:finite(row?.rawDamage),fullBurstCount:finite(row?.simulation?.fullBurstCount),timelineStep:finite(row?.timelineStep)};return team;
}
async function buildBase(rosterInput,status,cancelToken,runtime,boss,rules,map,ownedRowsForEngine){
 const started=performance.now();abortIfCancelled(cancelToken);
 if(status)status.textContent='V34 역할·고정 조합 후보를 생성하는 중…';
 const generated=runtime.kit.generateCandidates({boss,scope:root,owned:ownedRowsForEngine,teamCount:5});abortIfCancelled(cancelToken);
 const rawGenerated=arr(generated?.candidates),pool=rawGenerated.slice();
 // V34 augment is the authoritative home of Crown alternatives, Maid Mast+Anchor,
 // Pri→Mint and boss-specific permanent packages.  Never rebuild or split them here.
 runtime.final.augment(pool,boss,map);const requiredB1Augment=await augmentRequiredB1Routes(pool,map,boss,rules,cancelToken,status),moderniaOffBurstAdded=augmentGlobalModerniaOffBurst(pool,map,boss,rules);
 const augmentedCount=pool.length;let authoritative;
 try{authoritative=runtime.final.dedupeAndQuota(pool,boss,map,false);}catch(_){authoritative=pool;}
 const normalized=[];for(const team of arr(authoritative)){const evaluated=team?.roles?team:baseTeamToEvaluation(team,map,boss,rules);if(evaluated)normalized.push(evaluated);}
 let bounded=boundedLegalPool(normalized,boss,rules,map,false),candidates=bounded.pool;
 const generationMs=performance.now()-started,low=constrained(),timelineStep=low?0.50:0.35,batch=low?2:4,simulated=[],rejectedReasons={...bounded.rejected},requiredB1Rejected={littleMermaid:{},moranTreasure:{}};let cooperativeYields=0,timelineRejected=0,requiredB1BeforeTimeline=requiredB1Counts(candidates),requiredB1AfterTimeline={littleMermaid:0,moranTreasure:0};
 for(let index=0;index<candidates.length;index++){
  abortIfCancelled(cancelToken);const candidate=candidates[index];let result;
  try{result=runtime.final.simulateCandidate(candidate,boss,map,timelineStep);}catch(error){result={ok:false,reason:`timeline-exception:${String(error?.message||error)}`};}
  if(result?.ok)simulated.push(result);else{timelineRejected++;const reason=String(result?.reason||'timeline-rejected'),b1=profileId(candidate?.roles?.b1);rejectedReasons[reason]=(rejectedReasons[reason]||0)+1;if(requiredB1Rejected[b1])requiredB1Rejected[b1][reason]=(requiredB1Rejected[b1][reason]||0)+1;compactRejectedSimulation(result);}
  if(status&&(index===0||(index+1)%batch===0||index+1===candidates.length)){const pct=Math.round((index+1)/Math.max(1,candidates.length)*100);status.textContent=`180초 전투 후보 검증 ${pct}% · ${index+1}/${candidates.length} · 통과 ${simulated.length}`;}
  if((index+1)%batch===0){cooperativeYields++;await delay(0);abortIfCancelled(cancelToken);}
 }
 requiredB1AfterTimeline=requiredB1Counts(simulated);const ownedSet=new Set(map.keys()),initialFeasibility=await augmentTimelineFeasibility({simulated,candidates,pool,profiles:[...map.values()],boss,rules,map,ownedSet,cancelToken,status,runtime,timelineStep,emergency:false});let feasibilitySelected=initialFeasibility?.selected||null,feasibilityRepair=feasibilityDiagnostic(initialFeasibility);root.NIKKEV34713FeasibilityDebug={initial:clone(feasibilityRepair),emergency:null};requiredB1AfterTimeline=requiredB1Counts(simulated);
 if(simulated.length<5)throw new Error(`180초 유효 후보가 ${simulated.length}개뿐이라 5팀을 구성할 수 없습니다.`);
 if(status)status.textContent=`기존 고정·보스 규칙을 보존해 5덱 전역 배분 중 · 후보 ${simulated.length}개`;
 await delay(0);abortIfCancelled(cancelToken);const selectStarted=performance.now();let selected=runtime.final.selectFive(simulated,ownedSet,boss),emergencyUsed=false,emergencyCandidates=0,emergencyTimelineValid=0;let selectionMs=performance.now()-selectStarted;if((!selected||arr(selected.teams).length!==5)&&feasibilitySelected)selected=feasibilitySelected;abortIfCancelled(cancelToken);
 // The authoritative V34 selector intentionally has a second, wider quota pass.
 // The previous recovery wrapper skipped it, so a healthy pool could contain
 // hundreds of legal timelines yet still miss the one low-ranked shell needed
 // to satisfy all five disjoint teams and the preserved B1/B2 packages.
 if(!selected||arr(selected.teams).length!==5){
  emergencyUsed=true;if(status)status.textContent='고정 조합을 지키는 확장 후보를 180초 재검증 중…';await delay(0);abortIfCancelled(cancelToken);
  let emergencySource=[];try{emergencySource=runtime.final.dedupeAndQuota(pool,boss,map,true);}catch(_){emergencySource=pool;}
  const emergencyNormalized=[];for(const team of arr(emergencySource)){const evaluated=team?.roles?team:baseTeamToEvaluation(team,map,boss,rules);if(evaluated)emergencyNormalized.push(evaluated);}
  bounded=boundedLegalPool(emergencyNormalized,boss,rules,map,true);candidates=bounded.pool;emergencyCandidates=candidates.length;requiredB1BeforeTimeline=requiredB1Counts(candidates);
  for(const row of simulated)compactRejectedSimulation(row);simulated.length=0;
  for(let index=0;index<candidates.length;index++){
   abortIfCancelled(cancelToken);const candidate=candidates[index];let result;
   try{result=runtime.final.simulateCandidate(candidate,boss,map,timelineStep);}catch(error){result={ok:false,reason:`timeline-exception:${String(error?.message||error)}`};}
   if(result?.ok)simulated.push(result);else{timelineRejected++;const reason=String(result?.reason||'timeline-rejected'),b1=profileId(candidate?.roles?.b1);rejectedReasons[reason]=(rejectedReasons[reason]||0)+1;if(requiredB1Rejected[b1])requiredB1Rejected[b1][reason]=(requiredB1Rejected[b1][reason]||0)+1;compactRejectedSimulation(result);}
   if(status&&(index===0||(index+1)%batch===0||index+1===candidates.length)){const pct=Math.round((index+1)/Math.max(1,candidates.length)*100);status.textContent=`확장 180초 후보 검증 ${pct}% · ${index+1}/${candidates.length} · 통과 ${simulated.length}`;}
   if((index+1)%batch===0){cooperativeYields++;await delay(0);abortIfCancelled(cancelToken);}
  }
  emergencyTimelineValid=simulated.length;requiredB1AfterTimeline=requiredB1Counts(simulated);const emergencyFeasibility=await augmentTimelineFeasibility({simulated,candidates,pool,profiles:[...map.values()],boss,rules,map,ownedSet,cancelToken,status,runtime,timelineStep,emergency:true});feasibilitySelected=emergencyFeasibility?.selected||null;feasibilityRepair={initial:feasibilityRepair,emergency:feasibilityDiagnostic(emergencyFeasibility)};root.NIKKEV34713FeasibilityDebug=clone(feasibilityRepair);requiredB1AfterTimeline=requiredB1Counts(simulated);const retryStarted=performance.now();selected=runtime.final.selectFive(simulated,ownedSet,boss);selectionMs+=performance.now()-retryStarted;if((!selected||arr(selected.teams).length!==5)&&feasibilitySelected)selected=feasibilitySelected;abortIfCancelled(cancelToken);
 }
 let constrainedFallback=null;if(selected&&arr(selected.teams).length===5){if(status)status.textContent='5덱 합계딜 최고점 정확 탐색 중…';await delay(0);abortIfCancelled(cancelToken);const exactStarted=performance.now();constrainedFallback=constrainedTimelineSelect(simulated,ownedSet,boss,map,selected);selectionMs+=performance.now()-exactStarted;if(constrainedFallback?.selected)selected=constrainedFallback.selected;abortIfCancelled(cancelToken);}else{if(status)status.textContent='고정 조합 제약을 보존한 타임라인 정확 탐색 중…';await delay(0);abortIfCancelled(cancelToken);const exactStarted=performance.now();constrainedFallback=constrainedTimelineSelect(simulated,ownedSet,boss,map);selectionMs+=performance.now()-exactStarted;selected=constrainedFallback.selected;abortIfCancelled(cancelToken);}
 if(!selected||arr(selected.teams).length!==5){const feasibilityText=feasibilityRepair?` 보강: ${JSON.stringify(feasibilityRepair)}`:'';throw new Error(`V34 고정 규칙 선택기가 유효 후보 ${simulated.length}개에서 중복 없는 5팀을 완성하지 못했습니다.${constrainedFallback?.diagnostics?.missingRequirements?.length?` 누락 고정 후보: ${constrainedFallback.diagnostics.missingRequirements.join(', ')}`:''}${feasibilityText}`);}
 if(constrainedFallback?.diagnostics?.proven!==true)throw new Error(`5덱 합계딜 최고점 증명을 완료하지 못했습니다. 후보 ${simulated.length}개 · 탐색 노드 ${finite(constrainedFallback?.diagnostics?.nodes).toLocaleString('ko-KR')} · 시간상한 ${constrainedFallback?.diagnostics?.timeCapped?'도달':'미도달'} · 노드상한 ${constrainedFallback?.diagnostics?.nodeCapped?'도달':'미도달'}`);
 const coarseWinnerKeys=arr(selected.teams).map(team=>evaluationKey(team?.candidate||team)).sort(),coarseWinnerKey=coarseWinnerKeys.join('||'),coarseWinnerTotal=finite(selected?.score),contenderCovers=arr(constrainedFallback?.contenders).length?constrainedFallback.contenders:[{teams:arr(selected.teams),score:coarseWinnerTotal,keys:coarseWinnerKeys,key:coarseWinnerKey,exchangeCount:0}],fineSourceByKey=new Map();
 for(const cover of contenderCovers)for(const team of arr(cover.teams)){const key=evaluationKey(team?.candidate||team);if(!fineSourceByKey.has(key))fineSourceByKey.set(key,team);}
 const rerankStarted=performance.now(),fineByKey=new Map(),fineRejected=[];let fineIndex=0;
 if(status)status.textContent=`상위 ${contenderCovers.length}개 완성 덱을 고해상도 180초 타임라인으로 재검증 중…`;
 for(const [key,coarse] of fineSourceByKey){
  abortIfCancelled(cancelToken);const source=coarse?.candidate||coarse;let verified;
  try{verified=runtime.final.simulateCandidate(source,boss,map,.05);}catch(error){verified={ok:false,reason:String(error?.message||error)};}
  if(verified?.ok)fineByKey.set(key,verified);else{fineRejected.push({key,reason:String(verified?.reason||'알 수 없음')});compactRejectedSimulation(verified);}
  fineIndex++;if(status&&(fineIndex===1||fineIndex%3===0||fineIndex===fineSourceByKey.size))status.textContent=`고해상도 후보 재검증 ${fineIndex}/${fineSourceByKey.size} · 완성 덱 ${contenderCovers.length}개`;await delay(0);abortIfCancelled(cancelToken);
 }
 const fineContenders=[];for(const cover of contenderCovers){const keys=arr(cover.keys).length?cover.keys.slice().sort():arr(cover.teams).map(team=>evaluationKey(team?.candidate||team)).sort(),results=keys.map(key=>fineByKey.get(key));if(results.some(row=>!row))continue;const fineTotal=results.reduce((sum,row)=>sum+finite(row?.rawDamage,finite(row?.score)),0),coverKey=keys.join('||');fineContenders.push({cover,keys,coverKey,results,fineTotal});}
 fineContenders.sort((a,b)=>b.fineTotal-a.fineTotal||finite(b.cover?.score)-finite(a.cover?.score)||a.coverKey.localeCompare(b.coverKey,'en'));
 if(!fineContenders.length)throw new Error(`상위 ${contenderCovers.length}개 완성 덱의 고해상도 타임라인이 모두 실패했습니다: ${fineRejected.map(row=>`${row.key}=${row.reason}`).join(' / ')}`);
 const fineWinner=fineContenders[0],fineWinnerKeys=fineWinner.keys.slice(),fineWinnerTotal=fineWinner.fineTotal,coarseWinnerFine=fineContenders.find(row=>row.coverKey===coarseWinnerKey)||null,rerankChanged=fineWinner.coverKey!==coarseWinnerKey,selectedKeys=new Set(fineWinnerKeys),fine=fineWinner.results.map((row,index)=>selectedMaterialized(row,index));
 selected=Object.assign({},selected,{teams:fineWinner.cover.teams,score:finite(fineWinner.cover?.score),ids:new Set(fineWinner.cover.teams.flatMap(team=>specIds(simulatedSpec(team))))});
 fine.sort((a,b)=>finite(b.rawDamage)-finite(a.rawDamage)||evaluationKey(a).localeCompare(evaluationKey(b),'en')).forEach((team,index)=>{team.index=index+1;});
 const rerankMs=performance.now()-rerankStarted,fineContenderSummaries=fineContenders.map(row=>({exchangeCount:finite(row.cover?.exchangeCount),coarseTotal:finite(row.cover?.score),fineTotal:row.fineTotal,keys:row.keys.slice(),teamFingerprints:arr(row.cover?.teams).map(teamFingerprint).sort()})),fineRerankDiagnostics={coarseWinnerKeys,coarseWinnerTotal,coarseWinnerFineTotal:finite(coarseWinnerFine?.fineTotal),contenderCoverCount:contenderCovers.length,fineValidContenderCount:fineContenders.length,fineRejectedTeamCount:fineRejected.length,fineUniqueTeamCount:fineSourceByKey.size,fineWinnerKeys,fineWinnerTotal,fineWinnerCoarseRank:Math.max(1,contenderCovers.findIndex(cover=>(arr(cover.keys).length?cover.keys.slice().sort().join('||'):arr(cover.teams).map(team=>evaluationKey(team?.candidate||team)).sort().join('||'))===fineWinner.coverKey)+1),rerankChanged,rerankMs,fineOptimalWithinContenders:true,fineGlobalProven:false,fineContenderSummaries};
 if(constrainedFallback?.diagnostics)Object.assign(constrainedFallback.diagnostics,fineRerankDiagnostics);if(constrainedFallback?.selected?.searchDiagnostics)Object.assign(constrainedFallback.selected.searchDiagnostics,fineRerankDiagnostics);
 for(const [key,row] of fineByKey)if(!selectedKeys.has(key))compactRejectedSimulation(row);
 // Drop every non-selected candidate/timeline reference before returning.  The five
 // compact/fine selected timelines are the only arrays retained in cache and UI state.
 for(const row of simulated)if(!selectedKeys.has(evaluationKey(row.candidate||row)))compactRejectedSimulation(row);
 const routeAvailability={},selectedRoutes={};for(const route of ['crown','crown-mast','crown-helm','crown-privaty','maid-mast-anchor','pri-mint','modernia-offburst']){routeAvailability[route]=candidates.some(c=>fixedRouteKey(c)===route||(route==='crown'&&fixedRouteKey(c).startsWith('crown')));selectedRoutes[route]=fine.some(c=>fixedRouteKey(c)===route||(route==='crown'&&fixedRouteKey(c).startsWith('crown')));}
 const finalFixedAudit=fallbackRequirements(simulated,ownedSet,boss,map),finalFixedMissing=finalFixedAudit.requirements.filter(rule=>!fine.some(team=>rule.predicate(simulatedSpec(team)))).map(rule=>rule.id),finalFixedRoutesPreserved=finalFixedMissing.length===0;
 const selectionEngine=constrainedFallback?.selected?'v34713-constrained-timeline-exact':selected?.searchDiagnostics?.engine==='v34713-feasibility-witness'?'v34713-feasibility-witness':'NIKKEV340FinalOptimizer.selectFive';
 const diagnostics={generatedCandidates:rawGenerated.length,augmentedCandidates:Math.max(0,augmentedCount-rawGenerated.length),requiredB1Augment,requiredB1BeforeTimeline,requiredB1AfterTimeline,requiredB1Rejected,feasibilityRepair:clone(feasibilityRepair),moderniaOffBurstAdded,authoritativeCandidates:arr(authoritative).length,legalCandidates:bounded.legalCount,boundedCandidates:candidates.length,candidateCap:bounded.cap,candidatesTruncated:bounded.truncated,timelineSimulated:candidates.length,timelineValid:simulated.length,timelineRejected,rejectedReasons,cooperativeYields,timelineStep,generationMs,selectionMs,selectedCount:fine.length,emergencyUsed,emergencyCandidates,emergencyTimelineValid,...fineRerankDiagnostics,constrainedFallback:clone(constrainedFallback?.diagnostics||null),baseOptimizeBypassed:true,selectionEngine,candidateUniverseExhaustivelySimulated:bounded.truncated===0,moderniaGlobalOffBurst:true,fixedRoutesPreserved:finalFixedRoutesPreserved,fixedRequirementsExpected:finalFixedAudit.requirements.map(rule=>rule.id),fixedRequirementsMissing:finalFixedMissing,fixedRequirementsUnavailable:finalFixedAudit.unavailable.slice(),genericAnisTopPair:finalFixedAudit.genericAnisTopPair,fixedRouteAvailability:routeAvailability,fixedRoutesSelected:selectedRoutes,fixedAlternativesAreNotSimultaneousLocks:true,mandatoryMode:String(selected?.mandatoryInfo?.mode||''),selectionSearchDiagnostics:clone(selected?.searchDiagnostics||null),cacheReleased:true};
 if(Array.isArray(generated?.candidates))generated.candidates.length=0;rawGenerated.length=0;pool.length=0;normalized.length=0;candidates.length=0;simulated.length=0;
 return{evaluated:fine,diagnostics,elapsedMs:performance.now()-started};
}
function teamUsedSet(teams){const used=new Set();for(const team of teams)for(const id of team.memberIds||team.members?.map(profileId)||[])used.add(canonical(id));return used;}
function exactSimulateTeam(evaluated,runtime){
 const ids=evaluated.members.map(profileId),party={b1:ids[0],b2:ids[1],b3:[ids[2],ids[3]],flex:ids[4]};
 try{const started=performance.now(),result=runtime.sim.simulate({boss:bossId(),duration:180,party,compact:true});return{ok:true,totalDamage:finite(result?.totalDamage),fullBurstCount:finite(result?.fullBurstCount),elapsedMs:performance.now()-started,party};}catch(error){return{ok:false,error:String(error?.message||error),totalDamage:0,fullBurstCount:0,elapsedMs:0,party};}
}
async function searchUnusedTeam({profiles,boss,rules,used,cancelToken,status,runtime,maxResults=48,maxChecks=520000,excludeKeys=new Set(),authoritativeMap=null,emergency=false,requiredPredicates=[]}){
 const pools=profilePools(profiles,boss,rules,used),pairs=[];
 for(let i=0;i<pools.b3.length;i++)for(let j=i+1;j<pools.b3.length;j++){const a=pools.b3[i],b=pools.b3[j];if(canonical(a.id)===canonical(b.id))continue;pairs.push({a,b,score:pools.dealerScore(a)+pools.dealerScore(b)});}
 pairs.sort((x,y)=>y.score-x.score||profileId(x.a).localeCompare(profileId(y.a))||profileId(x.b).localeCompare(profileId(y.b)));
 const results=[],seen=new Set();let checks=0,nextYield=4096;const policyMap=authoritativeMap instanceof Map?authoritativeMap:new Map(profiles.map(profile=>[profileId(profile),profile]));
 const b1=pools.b1.slice(0,Math.min(22,pools.b1.length)),b2=pools.b2.slice(0,Math.min(30,pools.b2.length)),pairPool=pairs.slice(0,Math.min(420,pairs.length)),flex=pools.flex.slice(0,Math.min(60,pools.flex.length));
 outer:for(let i=0;i<b1.length;i++)for(let j=0;j<b2.length;j++){
  const one=b1[i],two=b2[j],baseIds=new Set([canonical(one.id),canonical(two.id)]);if(baseIds.size<2)continue;
  for(let p=0;p<pairPool.length;p++){
   const pair=pairPool[p],ids=new Set([...baseIds,canonical(pair.a.id),canonical(pair.b.id)]);if(ids.size<4)continue;
   const start=(i*17+j*11+p*7)%Math.max(1,flex.length),scan=Math.min(flex.length,28);let accepted=0;
   for(let f=0;f<scan;f++){
    const fl=flex[(start+f)%flex.length];checks++;if(checks>=nextYield){nextYield=checks+4096;if(status)status.textContent=`보완 후보 탐색 · ${checks.toLocaleString()}개 조합 확인 · 유효 ${results.length}개`;await delay(0);abortIfCancelled(cancelToken);}if(checks>=maxChecks)break outer;if(ids.has(canonical(fl.id)))continue;
    let evaluated=null;try{evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(one,two,pair.a,pair.b,fl,boss,rules);}catch(_){continue;}const key=evaluated?evaluationKey(evaluated):'',spec=evaluated?simulatedSpec(evaluated):null;if(!evaluated||arr(requiredPredicates).some(predicate=>{try{return !predicate(spec);}catch(_){return true;}})||seen.has(key)||excludeKeys.has(key)||!legalEvaluation(evaluated,boss,rules,policyMap,emergency).ok)continue;
    seen.add(key);evaluated.__source='repair';evaluated.memberIds=evaluated.members.map(profileId);evaluated.footprint=evaluated.memberIds.slice();results.push(evaluated);accepted++;
    if(results.length>=maxResults)break outer;if(accepted>=2)break;
   }
   if(checks>=maxChecks)break outer;
  }
 }
 const top=results.sort((a,b)=>b.score-a.score||evaluationKey(a).localeCompare(evaluationKey(b))).slice(0,Math.min(maxResults,results.length));
 return{best:top[0]||null,results:top,candidates:results.length,checks,pools:{b1:pools.b1.length,b2:pools.b2.length,b3:pools.b3.length,flex:pools.flex.length,pairs:pairs.length}};
}
async function fillMissing(initial,{profiles,boss,rules,cancelToken,status,runtime}){
 const teams=initial.slice();let repairChecks=0,repairCandidates=0;
 while(teams.length<5){const used=teamUsedSet(teams),found=await searchUnusedTeam({profiles,boss,rules,used,cancelToken,status,runtime});repairChecks+=found.checks;repairCandidates+=found.candidates;if(!found.best)break;teams.push(found.best);}
 if(teams.length===5)return{teams,repairChecks,repairCandidates,mode:initial.length===5?'base':'append-repair'};
 const ranked=initial.map((team,index)=>({team,index,score:finite(team.__baseCandidateScore,team.score)})).sort((a,b)=>a.score-b.score||a.index-b.index);
 for(const drop of ranked.slice(0,Math.min(3,ranked.length))){const kept=initial.filter((_,index)=>index!==drop.index),attempt=kept.slice();let localChecks=0,localCandidates=0;while(attempt.length<5){const found=await searchUnusedTeam({profiles,boss,rules,used:teamUsedSet(attempt),cancelToken,status,runtime,maxResults:64,maxChecks:650000});localChecks+=found.checks;localCandidates+=found.candidates;if(!found.best)break;attempt.push(found.best);}repairChecks+=localChecks;repairCandidates+=localCandidates;if(attempt.length===5)return{teams:attempt,repairChecks,repairCandidates,mode:'replace-one-repair'};}
 return{teams,repairChecks,repairCandidates,mode:'repair-failed'};
}
function finalizeTeams(teams,baseScale){
 const used=new Set();for(const team of teams){team.memberIds=team.members.map(profileId);team.footprint=team.memberIds.slice();for(const id of team.memberIds){const key=canonical(id);if(used.has(key))throw new Error(`내부 중복 검증 실패: ${id}`);used.add(key);}if(team.__source==='repair'){team.__kitScore=team.score;const simulated=finite(team.v34710Timeline?.totalDamage);team.score=simulated>0?simulated/1000:team.score*baseScale;team.approximateScore=team.score;team.reasons=[`실연동 보유 로스터 보완 탐색 · 180초 시뮬레이션 ${Math.round(simulated).toLocaleString('ko-KR')}`, ...arr(team.reasons)];}else team.score=finite(team.__baseCandidateScore,team.score);}
 return teams;
}
function buildResult(teams,boss,info,diagnostics){
 const totalScore=teams.reduce((sum,team)=>sum+finite(team.score),0),totalDamage=teams.reduce((sum,team)=>sum+finite(team.rawDamage,finite(team.score)),0),weakTeams=teams.filter(team=>finite(team.weakAnchorCount)>0).length,interruptTeams=teams.filter(team=>!boss.requiresElementInterrupt||team.interruptCoverage?.complete).length;
 return{version:VERSION,status:'ok',complete:true,boss,teams,totalScore,totalDamage,profiles:[],violations:[],diagnostics:{catalogCount:diagnostics.catalogCount||info.total,eligibleCatalogCount:info.total,raidExcludedCount:Math.max(0,(diagnostics.catalogCount||info.total)-info.total),rosterMode:true,ownedCount:diagnostics.ownedCount,receivedCount:diagnostics.receivedCount,profileCount:info.total,b1Count:info.b1,b2Count:info.b2,b3Count:info.b3,flexCount:info.flex,weakTeams,interruptTeams,shotgunTeams:teams.filter(team=>team.shotgunArchetype).length,shotgunSelectedMode:'actual-owned-roster',candidateCount:diagnostics.boundedCandidates,elapsedMs:diagnostics.elapsedMs,cubePolicy:'preserve-imported-assignments',cacheReleased:true,engine:'v34713-v34-authoritative-timeline',...diagnostics}};
}
function validateResult(result,rosterInput){
 const teams=arr(result?.teams),ids=teams.flatMap(team=>memberIds(team)),unique=new Set(ids.map(canonical)),errors=[];
 if(result?.status!=='ok')errors.push(`optimizer status ${result?.status}`);if(teams.length!==5)errors.push(`team count ${teams.length}`);if(ids.length!==25)errors.push(`slot count ${ids.length}`);if(ids.length&&unique.size!==ids.length)errors.push(`duplicate members ${ids.length-unique.size}`);
 if(rosterInput?.mode==='owned'){const owned=new Set(arr(rosterInput.owned).map(row=>canonical(row?.id||row)));const outside=ids.filter(id=>!owned.has(canonical(id)));if(outside.length)errors.push(`unowned ${outside.join(',')}`);}
 const boss=result?.boss,rules=root.NIKKEKitAwareOptimizer?.getRules?.();let validationMap=new Map(teams.flatMap(team=>arr(team?.members)).filter(Boolean).map(profile=>[profileId(profile),profile]));try{const grown=root.NIKKEV340FinalOptimizer?.profilesFor?.(root,arr(rosterInput?.owned));if(arr(grown?.profiles).length)validationMap=new Map(grown.profiles.map(profile=>[profileId(profile),profile]));}catch(_){}for(let index=0;index<teams.length;index++){
  const team=teams[index],roles=team?.roles||{},b3=arr(roles.b3),teamIds=memberIds(team);
  if(b3.some(profile=>profileId(profile)==='modernia'))errors.push(`${index+1}팀 Modernia active B3`);
  const hasMakoto=teamIds.includes('makotoNiijimaQueen'),hasYukiko=teamIds.includes('yukikoAmagi');if(hasMakoto!==hasYukiko)errors.push(`${index+1}팀 PERSONA pair split`);
  if(!Number.isFinite(finite(team?.rawDamage,NaN))||finite(team?.rawDamage)<=0)errors.push(`${index+1}팀 invalid 180s damage`);
  if(roles.b1&&roles.b2&&b3.length===2&&roles.flex){const valid=legalEvaluation(team,boss,rules,validationMap,true);if(!valid?.ok)errors.push(`${index+1}팀 role ${valid?.reason||'invalid'}`);}else errors.push(`${index+1}팀 role mapping missing`);
 }
 const ownedSet=new Set(arr(rosterInput?.owned).map(row=>String(row?.id||row))),fixedAudit=fallbackRequirements(teams,ownedSet,boss,validationMap),sourceAuditMissing=arr(result?.diagnostics?.fixedRequirementsMissing);if(fixedAudit.missing.length)errors.push(`fixed packages missing ${fixedAudit.missing.join(',')}`);if(sourceAuditMissing.length)errors.push(`source-pool fixed packages missing ${sourceAuditMissing.join(',')}`);if(finite(result?.diagnostics?.requiredB1AfterTimeline?.moranTreasure)>0&&ownedSet.has('moranTreasure')&&!teams.some(team=>simulatedSpec(team).b1==='moranTreasure'))errors.push('fixed packages missing b1-moran-treasure');
 return{pass:errors.length===0,errors,teamCount:teams.length,slotCount:ids.length,uniqueCount:unique.size,globalModerniaOffBurst:!teams.some(team=>arr(team?.roles?.b3).some(profile=>profileId(profile)==='modernia')),personaPairsIntact:!errors.some(row=>row.includes('PERSONA')),allTimelineDamageFinite:teams.every(team=>Number.isFinite(finite(team?.rawDamage,NaN))&&finite(team?.rawDamage)>0),fixedRequirements:fixedAudit.requirements.map(row=>row.id),fixedRequirementsMissing:fixedAudit.missing,fixedRulesSelectedBy:String(result?.diagnostics?.selectionEngine||'NIKKEV340FinalOptimizer.selectFive'),engine:'v34713-v34-authoritative-timeline',checkedAt:new Date().toISOString()};
}
function render(result,mount,diagnostics){
 if(!mount)return;const roleName=profile=>esc(profile?.name||profile?.id||profile||'미지정'),damageLabel=value=>{const n=finite(value);return n>=1e8?`${(n/1e8).toFixed(n>=1e10?1:2)}억`:Math.round(n).toLocaleString('ko-KR');};
 const cards=arr(result?.teams).map((team,index)=>{const roles=team?.roles||{},active=arr(roles.b3),damage=finite(team?.rawDamage,finite(team?.score)),burstCount=finite(team?.simulation?.fullBurstCount),reasons=arr(team?.reasons).filter(Boolean).slice(0,6),tags=arr(team?.tags).filter(Boolean).slice(0,4),explain=(reasons.length?reasons:tags.length?tags:[team?.cadence?.reason||'180초 타임라인과 보스·성장 조건을 반영한 전역 5덱 선택']).map(row=>`<li>${esc(row)}</li>`).join(''),flexId=profileId(roles.flex),flexLabel=flexId==='modernia'?'FLEX · 모더니아 오프버스트':'FLEX';return `<article class="nikke-kit-team" data-v34713-team="${index+1}"><h4>${index+1}파티 <small>180초 ${damageLabel(damage)} · DPS ${damageLabel(damage/180)}</small></h4><div class="nikke-kit-grid"><b>B1</b><span>${roleName(roles.b1)}</span><b>B2</b><span>${roleName(roles.b2)}</span><b>활성 B3</b><span>${active.map(roleName).join(' / ')}</span><b>${flexLabel}</b><span>${roleName(roles.flex)}</span></div><p><strong>180초 총딜:</strong> ${Math.round(damage).toLocaleString('ko-KR')} · <strong>풀버스트:</strong> ${burstCount||0}회 · <strong>선택 경로:</strong> ${esc(team?.__source||'V34.7.13 전역 배분')}</p><ul>${explain}</ul></article>`;}).join('');
 mount.innerHTML=`<div class="notice ok"><b>V34.7.13 V34 고정 규칙·180초 전 후보 검증 엔진</b><br>연동 ${diagnostics.receivedCount}명 · 보유 저장 ${diagnostics.ownedCount}명 · 계산 프로필 ${diagnostics.profileCount}명 · B1 ${diagnostics.b1Count} / B2 ${diagnostics.b2Count} / 활성 B3 ${diagnostics.b3Count} / FLEX ${diagnostics.flexCount}<br>V34 후보 ${diagnostics.boundedCandidates}개 180초 검증 · 통과 ${diagnostics.timelineValid}개 · 탈락 ${diagnostics.timelineRejected}개 · 5팀 총딜 ${damageLabel(result?.totalDamage)} · ${(diagnostics.elapsedMs/1000).toFixed(1)}초</div>${cards}`;
}
async function calculate(rosterInput,status,cancelToken){
 const runtime=getRuntime(),bossInput=root.NIKKEKitAwareOptimizer.readBossFromPage(root),boss=bossInput&&bossInput.raw&&Array.isArray(bossInput.weakElements)?bossInput:root.NIKKEKitAwareOptimizer.normalizeBoss(bossInput),rules=root.NIKKEKitAwareOptimizer.getRules(),collected=runtime.final.profilesFor(root,rosterInput.owned),allProfiles=arr(collected.profiles),raidFavoriteLocked=allProfiles.filter(profile=>!raidFavoriteEligible(profile)),profiles=allProfiles.filter(raidFavoriteEligible),map=new Map(profiles.map(profile=>[profile.id,profile])),info=coverage(profiles,boss,rules),received=receivedCount(),owned=arr(rosterInput.owned).length;
 if(info.total<25||info.b1<5||info.b2<5||info.b3<10||info.flex<5)throw new Error(shortageMessage(info,received,owned,info.total));
 const eligibleIds=new Set(profiles.map(profile=>profileId(profile))),sourceOwned=arr(collected?.owned).length?collected.owned:rosterInput.owned,engineOwned=arr(sourceOwned).filter(row=>eligibleIds.has(String(row?.id||row))),started=performance.now(),base=await buildBase(rosterInput,status,cancelToken,runtime,boss,rules,map,engineOwned),teams=base.evaluated,elapsedMs=performance.now()-started;
 const diagnostics={receivedCount:received,ownedCount:owned,profileCount:info.total,raidFavoriteLockedIds:raidFavoriteLocked.map(profileId),raidFavoriteLockedCount:raidFavoriteLocked.length,phantomPhaseZeroException:true,b1Count:info.b1,b2Count:info.b2,b3Count:info.b3,flexCount:info.flex,baseTeamCount:teams.length,elapsedMs,catalogCount:finite(collected.info?.catalogCount,info.total),...base.diagnostics};
 const result=buildResult(teams,boss,info,diagnostics),validation=validateResult(result,rosterInput);if(!validation.pass)throw new Error(`5덱 자체검증 실패: ${validation.errors.join(' / ')} · ${shortageMessage(info,received,owned,info.total)}`);
 result.v34710Diagnostics=diagnostics;result.v34713Diagnostics=diagnostics;result.v34710Validation=validation;result.v34713Validation=validation;return{result,diagnostics,validation};
}
async function run(ev){
 if(ev){ev.preventDefault?.();ev.stopPropagation?.();ev.stopImmediatePropagation?.();}
 const parts=panelParts();if(state.active){state.active.cancelToken.cancelled=true;if(parts.status)parts.status.textContent='계산을 안전하게 중지하고 있어요…';if(parts.button)parts.button.textContent='취소 중…';return state.active.promise;}
 const cancelToken={cancelled:false},scrollY=finite(root.scrollY,0),task=(async()=>{try{
  if(parts.panel)parts.panel.setAttribute('aria-busy','true');if(parts.button){parts.button.disabled=false;parts.button.textContent='계산 중지';}if(parts.status)parts.status.textContent='연동 보유 로스터와 역할 수를 확인하는 중…';if(parts.mount)parts.mount.innerHTML='<div class="nikke-kit-loading">기존 Crown·Maid Mast·Anchor·Pri→Mint·보스 고정 규칙을 그대로 보존하고, 모든 합법 후보를 180초 타임라인으로 검증합니다.</div>';
  await delay(50);const resolver=root.NIKKEV340FinalOptimizer?.resolveV3413RunRosterInput,rosterInput=typeof resolver==='function'?resolver():{mode:'owned',owned:ownedRows(),label:'보유 로스터'};if(rosterInput.mode==='owned'&&arr(rosterInput.owned).length<25)throw new Error(`연동 ${receivedCount()}명 · 보유 저장 ${arr(rosterInput.owned).length}명. 중복 없는 5팀에는 최소 25명이 필요합니다.`);
  const fingerprint=rosterFingerprint(rosterInput);let calculated;if(state.cache?.fingerprint===fingerprint){calculated=state.cache.value;calculated.diagnostics.cacheHit=true;calculated.result.diagnostics.cacheHit=true;}else{calculated=await calculate(rosterInput,parts.status,cancelToken);state.cache={fingerprint,value:calculated};}
  const {result,diagnostics,validation}=calculated;state.last={result,diagnostics,validation};root.NIKKEV34710LastResult=result;root.NIKKEV3420LastValidation=validation;root.NIKKEV3420LastError=null;if(parts.mount)render(result,parts.mount,diagnostics);if(parts.status)parts.status.textContent=`완료 · 연동 ${diagnostics.receivedCount}명 / 보유 저장 ${diagnostics.ownedCount}명 / 계산 프로필 ${diagnostics.profileCount}명 · 5팀 25명 · 중복 0 · 자체검증 PASS`;return result;
 }catch(error){const cancelled=error?.name==='AbortError'||cancelToken.cancelled,message=cancelled?'계산을 중지했습니다. 입력값과 로스터는 유지됩니다.':String(error?.message||error);root.NIKKEV3420LastError={code:cancelled?'E34713-CANCEL':'E34713-TIMELINE',message};if(parts.status)parts.status.textContent=(cancelled?'계산 중지':'자동편성 중단')+' · '+message;if(parts.mount)parts.mount.innerHTML=`<div class="v340-error"><b>${cancelled?'5덱 계산을 중지했습니다.':'5덱 자동 구성을 완료하지 못했습니다.'}</b><br>${esc(message)}</div>`;return null;
 }finally{state.active=null;if(parts.panel)parts.panel.setAttribute('aria-busy','false');if(parts.button){parts.button.disabled=false;parts.button.textContent='현재 로스터로 V34.7.13 5팀 계산';}try{root.scrollTo(0,scrollY);}catch(_){}}})();
 state.active={promise:task,cancelToken};return task;
}
function verifyPropagation(id='sugarTreasure'){
 const roster=centralRoster(),central=roster[id]||null,context=root.__v26TeamGrowthContext?.byId?.[id]||null;let profiles=[];try{const input=root.NIKKEV340FinalOptimizer.resolveV3413RunRosterInput();profiles=root.NIKKEV340FinalOptimizer.profilesFor(root,input.owned).profiles;}catch(_){}const profile=profiles.find(row=>row.id===id)||null,growth=profile?.growth||null,skills=central?.skills||{},checks={centralOwned:central?.owned===true,contextLevel:finite(context?.level,-1)===finite(central?.level,-2),skills:['skill1','skill2','burst'].every(key=>finite(growth?.skills?.[key],-1)===finite(skills[key],-2)),favoriteItemPhase:finite(growth?.favoriteItemPhase,-1)===finite(central?.favoriteItemPhase,-2),cubeId:String(growth?.cubeId||'none')===String(central?.cubeId||'none'),equipmentAttack:finite(growth?.equipmentAttack,-1)===finite(central?.equipmentAttack,-2),equipmentHp:finite(growth?.equipmentHp,-1)===finite(central?.equipmentHp,-2),equipmentDefense:finite(growth?.equipmentDefense,-1)===finite(central?.equipmentDefense,-2),challengeLevel:Number(growth?.level)===400||finite(growth?.level,-1)===finite(central?.level,-2)};return{version:VERSION,id,central,context,profileGrowth:growth,ownedCount:ownedRows().length,receivedCount:receivedCount(),challengeLevelNormalized:Number(growth?.level)===400,checks,pass:Boolean(profile&&Object.values(checks).every(Boolean))};
}
function brand(){try{root.document.title='니케 성장 계산기 V34.7.13 · V34 고정 규칙·180초 전 후보 검증';for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent='Nikke Damage Growth Calculator · V34.7.13 · 2026-08-27';}catch(_){}}
function install(){installDynamicOwnedApi();const parts=panelParts();if(parts.button){parts.button.disabled=false;parts.button.textContent=state.active?'계산 중지':'현재 로스터로 V34.7.13 5팀 계산';parts.button.dataset.v34710Repair='true';parts.button.dataset.v34713Timeline='true';}root.NIKKEV3420Run=run;root.NIKKEV34713RaidFavoriteEligible=raidFavoriteEligible;const publicApi=Object.freeze({version:VERSION,run,calculate,verifyPropagation,raidFavoriteEligible,raidFavoriteUnlockRequiredIds:[...RAID_FAVORITE_UNLOCK_REQUIRED],getLastResult:()=>state.last,clearCache:()=>{state.cache=null;}});root.NIKKEV34710OwnedRosterRepair=publicApi;root.NIKKEV34713OwnedRosterRepair=publicApi;brand();}
install();if(!root.__NIKKE_V34710_ROSTER_EVENT_BOUND__){root.__NIKKE_V34710_ROSTER_EVENT_BOUND__=true;root.addEventListener?.('nikke:v26-roster-updated',()=>{state.cache=null;installDynamicOwnedApi();});} [100,500,1200,2500,5000,9000,15000,22000].forEach(ms=>root.setTimeout(install,ms));
})(typeof globalThis!=='undefined'?globalThis:window);
</script>
