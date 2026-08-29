(function installV34713OptimalityRuntime(root){
'use strict';
const VERSION='34.7.15';
const arr=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const delay=ms=>new Promise(resolve=>root.setTimeout(resolve,ms));
const canonical=id=>{try{return String(root.NIKKE_FAVORITE_ITEM_IDENTITY?.canonicalId?.(String(id||''))||id||'');}catch(_){return String(id||'');}};
const idsOf=candidate=>arr(candidate?.memberIds).length?arr(candidate.memberIds).map(String):arr(candidate?.members).map(member=>String(member?.id||member)).filter(Boolean);
const scoreOf=(candidate,objective='firepower')=>finite(candidate?.scores?.[objective],finite(candidate?.score,0));
const candidateId=(candidate,index=0)=>String(candidate?.id||candidate?.key||candidate?.candidateId||`v34713-${index}`);
const weakElements=boss=>arr(boss?.weakElements||boss?.raw?.weakElements).map(value=>String(value).toLowerCase());
const isFireBoss=boss=>weakElements(boss).some(value=>value==='fire'||value==='작열');
const slotOf=(candidate,id)=>String(arr(candidate?.members).find(member=>String(member?.id||'')===id)?.slot||'');
const isActiveSlot=slot=>/^B3(?:$|-)/.test(String(slot||''));
const isB2Slot=slot=>/^B2(?:$|-)/.test(String(slot||''));
const roleKey=candidate=>arr(candidate?.members).map(member=>`${String(member?.slot||'?')}:${canonical(member?.id||member)}`).join('|')+`|rotation:${String(candidate?.rotation?.type||candidate?.rotation?.mode||candidate?.rotationMode||'standard')}`;
const RAID_FAVORITE_UNLOCK_REQUIRED=new Set([
 'moranTreasure','floraTreasure','privatyTreasure','helmTreasure','sugarTreasure',
 'centiTreasure','zweiTreasure','mirandaTreasure','rosannaTreasure'
]);

function explicitFavoritePhase(profile){
 if(!profile||typeof profile!=='object')return null;
 if(profile.growth&&profile.growth.favoriteItemPhase!=null)return finite(profile.growth.favoriteItemPhase,0);
 if(profile.favoriteItemPhase!=null)return finite(profile.favoriteItemPhase,0);
 return null;
}
function centralFavoriteProfile(id){
 try{return root.NIKKE_V26_ROSTER_API?.load?.()?.characters?.[id]||null;}catch(_){return null;}
}
function candidateProfile(candidate,id){
 const direct=arr(candidate?.members).find(member=>String(member?.id||member||'')===id);
 if(direct&&typeof direct==='object'&&explicitFavoritePhase(direct)!=null)return direct;
 const roles=candidate?.__v34713Roles||candidate?.roles||{};
 const roleProfiles=[roles?.b1,roles?.b2,...arr(roles?.b3),roles?.flex];
 const role=roleProfiles.find(profile=>String(profile?.id||profile||'')===id);
 if(role&&typeof role==='object'&&explicitFavoritePhase(role)!=null)return role;
 return centralFavoriteProfile(id)||direct||role||{id};
}
function raidFavoriteEligible(profile){
 const id=String(profile?.id||profile||'');
 if(id==='phantomTreasure'||!RAID_FAVORITE_UNLOCK_REQUIRED.has(id))return true;
 const phase=explicitFavoritePhase(profile);
 return finite(phase,0)>0;
}
function lockedFavoriteIds(candidate){
 return idsOf(candidate).filter(id=>RAID_FAVORITE_UNLOCK_REQUIRED.has(id)&&!raidFavoriteEligible(candidateProfile(candidate,id)));
}

function currentBoss(options,built){
 const id=String(options?.bossId||built?.bossId||built?.boss?.id||root.document?.getElementById('soloBossSelect')?.value||'annihilio');
 const raw=root.NIKKE_V26_DATA?.bosses?.values?.[id]||built?.boss||{id};
 try{return root.NIKKEKitAwareOptimizer?.normalizeBoss?.(raw)||raw;}catch(_){return raw;}
}
function candidateLegal(candidate,boss){
 const ids=idsOf(candidate),slots=arr(candidate?.members);
 if(ids.length!==5||new Set(ids.map(canonical)).size!==5||slots.length!==5)return false;
 if(lockedFavoriteIds(candidate).length)return false;
 if(candidate?.rotationAudit?.ok===false)return false;
 if(arr(candidate?.interruptCoverage).some(entry=>entry?.ok===false))return false;
 const hasMakoto=ids.includes('makotoNiijimaQueen'),hasYukiko=ids.includes('yukikoAmagi');
 if(hasMakoto!==hasYukiko)return false;
 if(hasMakoto&&(!isFireBoss(boss)||!isActiveSlot(slotOf(candidate,'makotoNiijimaQueen'))||!isActiveSlot(slotOf(candidate,'yukikoAmagi'))))return false;
 if(ids.includes('modernia')&&slotOf(candidate,'modernia')!=='FLEX')return false;
 const hasMast=ids.includes('mastRomanticMaid'),hasAnchor=ids.includes('anchorInnocentMaid');
 const crownSlot=slotOf(candidate,'crown'),mastSlot=slotOf(candidate,'mastRomanticMaid');
 const crownMastException=hasMast&&!hasAnchor&&ids.includes('crown')&&isB2Slot(crownSlot)&&(mastSlot==='FLEX'||isB2Slot(mastSlot));
 if(hasMast!==hasAnchor&&!crownMastException)return false;
 if(hasMast&&hasAnchor&&(!isB2Slot(mastSlot)||slotOf(candidate,'anchorInnocentMaid')!=='FLEX'))return false;
 const hasPrika=ids.includes('prika'),hasMint=ids.includes('mint');
 if(hasPrika!==hasMint)return false;
 if(hasPrika&&(!isB2Slot(slotOf(candidate,'prika'))||slotOf(candidate,'mint')!=='FLEX'))return false;
 for(const id of ['helmTreasure','privatyTreasure'])if(ids.includes('crown')&&ids.includes(id)&&(!isB2Slot(crownSlot)||slotOf(candidate,id)!=='FLEX'))return false;
 for(const id of ['eleggBoomAndShock','maidenIceRose','solineFrostTicket'])if(ids.includes(id)&&slotOf(candidate,id)!=='FLEX')return false;
 if(boss?.requiresElementInterrupt===true&&!arr(candidate?.interruptCoverage).length)return false;
 return true;
}
function candidateShape(evaluated,label){
 const roles=evaluated?.roles;if(!roles?.b1||!roles?.b2||arr(roles?.b3).length!==2||!roles?.flex)return null;
 const members=[
  {profile:roles.b1,slot:'B1'},
  {profile:roles.b2,slot:'B2'},
  {profile:roles.b3[0],slot:'B3-A'},
  {profile:roles.b3[1],slot:'B3-B'},
  {profile:roles.flex,slot:'FLEX'}
 ];
 const compact=members.map(({profile,slot})=>({id:String(profile.id),name:String(profile.name||profile.id),slot,element:profile.element||'',role:profile.role||'',cubeId:profile.cubeId||'none',favoriteItemPhase:finite(explicitFavoritePhase(profile),0)}));
 const score=Math.max(1,finite(evaluated.score,1)),memberIds=compact.map(member=>member.id);
 const required=arr(evaluated?.interruptCoverage?.required),providers=evaluated?.interruptCoverage?.providers||{};
 return Object.assign({},evaluated,{
  id:`v34713:${label}:${memberIds.join('+')}`,
  blueprintId:`v34713-${label}`,
  blueprintName:label,
  members:compact,
  memberIds,
  footprint:memberIds.slice(),
  score,
  scores:{firepower:score,stable:score,manual:score,investment:score},
  rotationAudit:evaluated?.rotationAudit||{ok:null,pending:true},
  interruptCoverage:required.map(element=>({requiredElement:element,coveredBy:arr(providers[element]),ok:arr(providers[element]).length>0})),
  __v34713Augmented:true,
  __v34713Roles:roles,
  rotation:evaluated.rotation||null
 });
}
function supportRank(profile){return finite(profile?.support)*finite(profile?.growth?.supportMultiplier,1)+finite(profile?.b1Priority)*2+finite(profile?.growth?.survivalMultiplier)*24;}
function dealerRank(profile,boss,rules){try{return finite(root.NIKKEKitAwareOptimizer?.dealerScore?.(profile,boss,3,rules,[]),finite(profile?.dealer));}catch(_){return finite(profile?.dealer)*finite(profile?.growth?.dealerMultiplier,1);}}
function flexRank(profile,boss,rules){return supportRank(profile)+dealerRank(profile,boss,rules)*.55;}
function topPairs(profiles,boss,rules,limit){
 const rows=[];for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){
  const a=profiles[i],b=profiles[j],ids=new Set([a.id,b.id]);
  if(!arr(a.requiredActivePartners).every(id=>ids.has(id))||!arr(b.requiredActivePartners).every(id=>ids.has(id)))continue;
  rows.push({a,b,score:dealerRank(a,boss,rules)+dealerRank(b,boss,rules)});
 }
 return rows.sort((x,y)=>y.score-x.score||String(x.a.id).localeCompare(String(y.a.id))||String(x.b.id).localeCompare(String(y.b.id))).slice(0,limit);
}
async function augmentedCandidates(built,options,boss){
 const final=root.NIKKEV340FinalOptimizer,kit=root.NIKKEKitAwareOptimizer;if(!final?.profilesFor||!kit?.evaluateTeamRoles)return[];
 let owned=arr(options?.owned);if(!owned.length)try{owned=arr(root.NIKKE_V26_ROSTER_API?.getOwned?.());}catch(_){}
 let collected;try{collected=final.profilesFor(root,owned);}catch(_){return[];}
 const profiles=arr(collected?.profiles).filter(raidFavoriteEligible),rules=kit.getRules?.(),map=new Map(profiles.map(profile=>[String(profile.id),profile]));
 const allowedStage=(profile,stage)=>{try{return kit.stageAllowed(profile,stage,boss);}catch(_){return false;}};
 const activeAllowed=profile=>allowedStage(profile,3)&&kit.activeBurstAllowed?.(profile,boss)!==false;
 const b1=profiles.filter(profile=>allowedStage(profile,1)&&profile.mainBurst1Eligible!==false).sort((a,b)=>supportRank(b)-supportRank(a)).slice(0,8);
 const b2=profiles.filter(profile=>allowedStage(profile,2)&&profile.mainBurst2Eligible!==false).sort((a,b)=>supportRank(b)-supportRank(a)).slice(0,14);
 const b3=profiles.filter(activeAllowed).sort((a,b)=>dealerRank(b,boss,rules)-dealerRank(a,boss,rules)).slice(0,26);
 const flex=profiles.filter(profile=>profile.flexEligible&&!profile.noFlex&&!profile.activeBurstRequired).sort((a,b)=>flexRank(b,boss,rules)-flexRank(a,boss,rules)).slice(0,28);
 const out=[],seen=new Map(),cancelToken=options?.cancelToken;
 const commit=(shaped,label)=>{if(!shaped||!candidateLegal(shaped,boss))return null;const key=roleKey(shaped),prior=seen.get(key);if(prior){prior.__v34713Families=[...new Set(arr(prior.__v34713Families).concat(label))];return prior;}shaped.__v34713Families=[label];seen.set(key,shaped);out.push(shaped);return shaped;};
 let checks=0;
 const evaluate=(one,two,a,b,fl,label)=>{checks++;if(new Set([one?.id,two?.id,a?.id,b?.id,fl?.id]).size!==5)return null;try{const shaped=candidateShape(kit.evaluateTeamRoles(one,two,a,b,fl,boss,rules),label);return candidateLegal(shaped,boss)?shaped:null;}catch(_){return null;}}
 const requiredPairs=[];
 for(const profile of b3)for(const partnerId of arr(profile.requiredActivePartners)){
  const partner=map.get(String(partnerId));if(!partner||!activeAllowed(partner))continue;
  const key=[profile.id,partner.id].sort().join('|');if(!requiredPairs.some(row=>row.key===key))requiredPairs.push({key,a:profile,b:partner});
 }
 for(const pair of requiredPairs){
  const local=[];for(const one of b1)for(const two of b2)for(const fl of flex){const shaped=evaluate(one,two,pair.a,pair.b,fl,`required-active-pair:${pair.key}`);if(shaped)local.push(shaped);if((checks&255)===0){if(cancelToken?.cancelled)throw Object.assign(new Error('사용자가 계산을 중지했습니다.'),{name:'AbortError'});await delay(0);}}
  local.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en')).slice(0,28).forEach(candidate=>commit(candidate,`required-active-pair:${pair.key}`));
 }
 if(map.has('modernia')){
  const modernia=map.get('modernia'),pairs=topPairs(b3.filter(profile=>profile.id!=='modernia'),boss,rules,48),local=[];
  for(const one of b1.slice(0,6))for(const two of b2.slice(0,10))for(const pair of pairs){const shaped=evaluate(one,two,pair.a,pair.b,modernia,'modernia-offburst');if(shaped)local.push(shaped);if((checks&255)===0){if(cancelToken?.cancelled)throw Object.assign(new Error('사용자가 계산을 중지했습니다.'),{name:'AbortError'});await delay(0);}}
  local.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en')).slice(0,32).forEach(candidate=>commit(candidate,'modernia-offburst'));
 }
 const fixedRoutes=[
  ['crown','mastRomanticMaid','crown-mast-locked'],
  ['crown','helmTreasure','crown-helm-locked'],
  ['crown','privatyTreasure','crown-privaty-locked'],
  ['crown','naga','crown-naga-locked'],
  ['mastRomanticMaid','anchorInnocentMaid','maid-mast-anchor-locked']
 ];
 const pairs=topPairs(b3,boss,rules,30);
 for(const [b2Id,flexId,label] of fixedRoutes){const two=map.get(b2Id),fl=map.get(flexId);if(!two||!fl)continue;const local=[];for(const one of b1.slice(0,6))for(const pair of pairs){const shaped=evaluate(one,two,pair.a,pair.b,fl,label);if(shaped)local.push(shaped);}local.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en')).slice(0,20).forEach(candidate=>commit(candidate,label));await delay(0);}
 if(map.has('crown')){
  const crown=map.get('crown'),locked=new Set(['mastRomanticMaid','helmTreasure','privatyTreasure','naga']),local=[];
  for(const one of b1.slice(0,6))for(const pair of pairs)for(const fl of flex.filter(profile=>!locked.has(profile.id)).slice(0,12)){const shaped=evaluate(one,crown,pair.a,pair.b,fl,'crown-solo-family');if(shaped)local.push(shaped);}
  local.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en')).slice(0,24).forEach(candidate=>commit(candidate,'crown-solo-family'));
 }
 if(map.has('prika')&&map.has('mint')){
  const two=map.get('prika'),fl=map.get('mint'),local=[];for(const one of b1.slice(0,8))for(const pair of pairs){const shaped=evaluate(one,two,pair.a,pair.b,fl,'pri-mint-locked');if(shaped)local.push(shaped);}
  local.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en')).slice(0,24).forEach(candidate=>commit(candidate,'pri-mint-locked'));
 }
 return out;
}
async function authoritativeV34Candidates(options,boss){
 const final=root.NIKKEV340FinalOptimizer,kit=root.NIKKEKitAwareOptimizer;if(!final?.profilesFor||!final?.augment||!final?.dedupeAndQuota||!kit?.generateCandidates)return[];
 let owned=arr(options?.owned);if(!owned.length)try{owned=arr(root.NIKKE_V26_ROSTER_API?.getOwned?.());}catch(_){}
 if(!owned.length)return[];let profiles,map;try{const collected=final.profilesFor(root,owned);profiles=arr(collected?.profiles);map=new Map(profiles.map(profile=>[String(profile.id),profile]));}catch(_){return[];}
 let generated;try{generated=kit.generateCandidates({boss,scope:root,owned,teamCount:5});}catch(_){return[];}
 const pool=arr(generated?.candidates).slice();try{final.augment(pool,boss,map);}catch(_){}
 let emergency=pool;try{emergency=final.dedupeAndQuota(pool,boss,map,true);}catch(_){}
 const shaped=[];for(const candidate of arr(emergency)){const row=candidateShape(candidate,'v34-authoritative');if(row&&candidateLegal(row,boss))shaped.push(row);}
 shaped.sort((a,b)=>scoreOf(b)-scoreOf(a)||roleKey(a).localeCompare(roleKey(b),'en'));
 // Keep the exact old API bounded, but never prune semantic backstops or every
 // support/B2 route down to the same handful of characters. Production uses
 // the complete V34 timeline pool; this bridge exists for diagnostics only.
 const out=[],seen=new Set(),push=row=>{const key=roleKey(row);if(!seen.has(key)){seen.add(key);out.push(row);}};
 for(const row of shaped)if(arr(row.__v34Tags).length)push(row);
 const preserveBy=(getKey,limit)=>{const counts=new Map();for(const row of shaped){const key=String(getKey(row)||'');if(!key)continue;const count=counts.get(key)||0;if(count>=limit)continue;counts.set(key,count+1);push(row);}};
 preserveBy(row=>row.members?.find(member=>member.slot==='B1')?.id,12);
 preserveBy(row=>row.members?.find(member=>member.slot==='B2')?.id,10);
 for(const row of shaped){if(out.length>=520)break;push(row);}
 return out.slice(0,620);
}
function sanitizeAndDedupe(candidates,boss,objective='firepower'){
 const best=new Map();for(const candidate of arr(candidates)){if(!candidateLegal(candidate,boss))continue;const key=roleKey(candidate),previous=best.get(key);if(!previous||scoreOf(candidate,objective)>scoreOf(previous,objective))best.set(key,candidate);}
 return[...best.values()].sort((a,b)=>scoreOf(b,objective)-scoreOf(a,objective)||candidateId(a).localeCompare(candidateId(b),'en'));
}
function capacityFor(cubeId,options){if(!cubeId||cubeId==='none'||options?.allowCubeDuplicates===true)return Infinity;const explicit=options?.cubeCapacity?.[cubeId],fallback=finite(options?.defaultCubeCapacity,1);return Math.max(0,explicit==null?fallback:finite(explicit,fallback));}
function cubeUsage(candidate){const out={};for(const member of arr(candidate?.members)){const id=String(member?.cubeId||'none');if(id!=='none')out[id]=(out[id]||0)+1;}return out;}
function exactOptimize(candidates,options,incumbent){
 const objective=options?.objective||'firepower',teamCount=Math.max(1,Math.min(5,Math.round(finite(options?.teamCount,5))));
 const rows=candidates.map((candidate,index)=>({candidate,id:candidateId(candidate,index),score:scoreOf(candidate,objective),ids:idsOf(candidate).map(canonical),cubes:cubeUsage(candidate)})).filter(row=>Number.isFinite(row.score)&&row.ids.length===5&&new Set(row.ids).size===5).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id,'en'));
 const characters=[...new Set(rows.flatMap(row=>row.ids))],bit=new Map(characters.map((id,index)=>[id,BigInt(index)]));for(const row of rows)row.mask=row.ids.reduce((mask,id)=>mask|(1n<<bit.get(id)),0n);
 const deadline=Date.now()+Math.max(500,finite(options?.exactTimeMs,(root.navigator?.deviceMemory||8)<=4?5000:9000)),nodeLimit=Math.max(50000,finite(options?.exactNodeLimit,2500000));
 const selected=arr(incumbent?.teams),selectedIds=new Set(selected.flatMap(idsOf).map(canonical));let best=selected.length===teamCount&&selectedIds.size===teamCount*5?{teams:selected.slice(),score:selected.reduce((sum,row)=>sum+scoreOf(row,objective),0)}:null;
 let nodes=0,timeCapped=false,nodeCapped=false;
 const optimistic=(start,need,mask)=>{let total=0,count=0;for(let i=start;i<rows.length&&count<need;i++){if((rows[i].mask&mask)!==0n)continue;total+=Math.max(0,rows[i].score);count++;}return count===need?total:-Infinity;};
 function visit(start,need,mask,score,picks,cubes){
  nodes++;if(nodes>nodeLimit){nodeCapped=true;return;}if((nodes&2047)===0&&Date.now()>deadline){timeCapped=true;return;}
  if(need===0){if(!best||score>best.score+1e-9)best={teams:picks.map(index=>rows[index].candidate),score};return;}
  if(rows.length-start<need)return;const bound=optimistic(start,need,mask);if(!Number.isFinite(bound)||best&&score+bound<=best.score+1e-9)return;
  for(let index=start;index<=rows.length-need;index++){
   const row=rows[index];if((mask&row.mask)!==0n)continue;let allowed=true;for(const [id,count] of Object.entries(row.cubes))if((cubes[id]||0)+count>capacityFor(id,options)){allowed=false;break;}if(!allowed)continue;
   const nextCubes={...cubes};for(const [id,count] of Object.entries(row.cubes))nextCubes[id]=(nextCubes[id]||0)+count;
   const rest=need===1?0:optimistic(index+1,need-1,mask|row.mask);if(!Number.isFinite(rest)||best&&score+row.score+rest<=best.score+1e-9)continue;
   picks.push(index);visit(index+1,need-1,mask|row.mask,score+row.score,picks,nextCubes);picks.pop();if(timeCapped||nodeCapped)return;
  }
 }
 visit(0,teamCount,0n,0,[],{});
 return{best,nodes,timeCapped,nodeCapped,proven:!!best&&!timeCapped&&!nodeCapped,poolSize:rows.length};
}
function wrapOptimizerApi(){
 const api=root.NIKKE_V26_OPTIMIZER_API;if(!api?.buildCandidates||!api?.optimize||api.__v34713Optimality)return false;
 const baseBuild=api.buildCandidates.bind(api),baseOptimize=api.optimize.bind(api);
 const buildCandidates=async options=>{
  const objective=String(options?.objective||'firepower'),built=await baseBuild(options||{}),boss=currentBoss(options,built),original=arr(built?.candidates),favoriteLockedOriginal=original.filter(candidate=>lockedFavoriteIds(candidate).length),filtered=sanitizeAndDedupe(original,boss,objective),extra=await augmentedCandidates(built,options||{},boss),merged=sanitizeAndDedupe(filtered.concat(extra),boss,objective);
  const authoritative=await authoritativeV34Candidates(options||{},boss),combined=sanitizeAndDedupe(merged.concat(authoritative),boss,objective);
  const familyCounts={};for(const candidate of combined)for(const family of arr(candidate.__v34713Families))familyCounts[family]=(familyCounts[family]||0)+1;
  let auditOwned=arr(options?.owned);if(!auditOwned.length)try{auditOwned=arr(root.NIKKE_V26_ROSTER_API?.getOwned?.());}catch(_){}const ownedIds=new Set(auditOwned.map(row=>String(row?.id||row)));
  const familyMembers={'crown-solo-family':['crown'],'crown-mast-locked':['crown','mastRomanticMaid'],'crown-helm-locked':['crown','helmTreasure'],'crown-privaty-locked':['crown','privatyTreasure'],'maid-mast-anchor-locked':['mastRomanticMaid','anchorInnocentMaid'],'pri-mint-locked':['prika','mint']};
  const fixedRoutesPreserved=Object.entries(familyMembers).every(([family,members])=>!members.every(id=>ownedIds.has(id))||finite(familyCounts[family])>0);
  built.candidates=combined;built.diagnostics=Object.assign({},built.diagnostics,{v34713OriginalCandidates:original.length,v34713FilteredCandidates:filtered.length,v34713AugmentedCandidates:extra.length,v34713AuthoritativeCandidates:authoritative.length,v34713Candidates:combined.length,v34713IllegalCandidatesRemoved:Math.max(0,original.length-filtered.length),v34713FavoriteLockedCandidatesRemoved:favoriteLockedOriginal.length,v34713FavoriteLockedIds:[...new Set(favoriteLockedOriginal.flatMap(lockedFavoriteIds))],v34713FamilyCounts:familyCounts,v34713FixedRoutesPreserved:fixedRoutesPreserved,v34713PersonaAugmented:extra.some(candidate=>idsOf(candidate).includes('makotoNiijimaQueen')),v34713ModerniaOffBurstAugmented:extra.some(candidate=>arr(candidate.__v34713Families).includes('modernia-offburst'))});return built;
 };
 const optimize=(source,options={})=>{
  const candidates=arr(Array.isArray(source)?source:source?.candidates),boss=currentBoss(options,source),objective=String(options?.objective||'firepower'),favoriteLockedCandidates=candidates.filter(candidate=>lockedFavoriteIds(candidate).length),legal=sanitizeAndDedupe(candidates,boss,objective),fallback=baseOptimize(legal,options),exact=exactOptimize(legal,options,fallback),chosen=exact.best;
  const auditDiagnostics={search:'v34713-exact-bnb',proofScope:'exact-within-legal-pruned-candidate-pool',exactWithinCandidatePool:exact.proven,exactNodes:exact.nodes,exactTimeCapped:exact.timeCapped,exactNodeCapped:exact.nodeCapped,exactProven:exact.proven,exactPoolSize:exact.poolSize,illegalCandidatesRemoved:candidates.length-legal.length,favoriteLockedCandidatesRemoved:favoriteLockedCandidates.length,favoriteLockedIds:[...new Set(favoriteLockedCandidates.flatMap(lockedFavoriteIds))]};
  if(!chosen)return Object.assign({},fallback,{diagnostics:Object.assign({},fallback?.diagnostics,auditDiagnostics)});
  const feasible=chosen.teams.length===Math.max(1,Math.min(5,Math.round(finite(options.teamCount,source?.teamCount||5))));
  return Object.assign({},fallback,{status:feasible?'ok':fallback.status,feasible,teams:chosen.teams.map(team=>JSON.parse(JSON.stringify(team))),totalScore:chosen.score,maxTeams:chosen.teams.length,unassigned:Math.max(0,finite(options.teamCount,source?.teamCount||5)-chosen.teams.length),diagnostics:Object.assign({},fallback.diagnostics,auditDiagnostics)});
 };
 const wrapped=Object.freeze(Object.assign({},api,{version:VERSION,buildCandidates,optimize,__v34713Optimality:true,__v34713BaseApi:api}));root.NIKKE_V26_OPTIMIZER_API=wrapped;if(root.NIKKE_V26_API)root.NIKKE_V26_API.optimizer=wrapped;return true;
}
function install(){if(!wrapOptimizerApi())root.setTimeout(install,80);}
root.NIKKEV34713Optimality=Object.freeze({version:VERSION,install,wrapOptimizerApi,candidateLegal,candidateShape,raidFavoriteEligible,lockedFavoriteIds,raidFavoriteUnlockRequiredIds:Object.freeze([...RAID_FAVORITE_UNLOCK_REQUIRED]),exactOptimize});
install();
})(typeof globalThis!=='undefined'?globalThis:window);
