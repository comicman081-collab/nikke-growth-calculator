<script id="v34710-owned-roster-repair">
(function installV34710OwnedRosterRepair(root){
'use strict';
const VERSION='34.7.10';
const state=root.__NIKKE_V34710_FIVE_DECK_STATE__||{active:null,last:null,cache:null,installedAt:new Date().toISOString()};
root.__NIKKE_V34710_FIVE_DECK_STATE__=state;
const $=id=>root.document&&root.document.getElementById(id);
const arr=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
const delay=ms=>new Promise(resolve=>root.setTimeout(resolve,ms));
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const canonical=id=>{try{return String(root.NIKKE_FAVORITE_ITEM_IDENTITY?.canonicalId?.(String(id||''))||id||'');}catch(_){return String(id||'');}};
const profileId=profile=>String(profile?.id||'');
const memberIds=team=>arr(team?.memberIds).length?arr(team.memberIds).map(String):arr(team?.members).map(member=>String(member?.id||member)).filter(Boolean);
const teamFingerprint=team=>memberIds(team).map(canonical).sort().join('|');
const constrained=()=>Boolean(root.AndroidNative)||finite(root.navigator?.deviceMemory,8)<=4||finite(root.innerWidth,1280)<=820;
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
 for(const id of rows){const r=roster[id]||{};const s=`${id}:${r.level||0}:${r.coreLevel||0}:${r.favoriteItemPhase||0}:${r.cubeId||'none'}:${r.skills?.skill1||0}/${r.skills?.skill2||0}/${r.skills?.burst||0}:${r.equipmentAttack||0}:${r.equipmentHp||0}:${r.equipmentDefense||0}`;for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619);}}
 return `${bossId()}|${rows.length}|${(hash>>>0).toString(16)}`;
}
function getRuntime(){
 const final=root.NIKKEV340FinalOptimizer,kit=root.NIKKEKitAwareOptimizer,api=root.NIKKE_V26_OPTIMIZER_API,sim=root.NIKKESinglePartyTimelineSimulator;
 if(!final?.resolveV3413RunRosterInput||!final?.profilesFor)throw new Error('보유 로스터 변환기가 초기화되지 않았습니다.');
 if(!kit?.validateTeamRoles||!kit?.evaluateTeamRoles||!kit?.normalizeBoss)throw new Error('5덱 역할 계산기가 초기화되지 않았습니다.');
 if(!api?.buildCandidates||!api?.optimize)throw new Error('기본 5덱 후보 계산기가 초기화되지 않았습니다.');
 if(!sim?.simulate)throw new Error('전투 시뮬레이션 계산기가 초기화되지 않았습니다.');
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
 const members=arr(team?.members);const bySlot={};for(const member of members){const slot=String(member?.slot||'').toUpperCase();if(slot==='B1')bySlot.b1=map.get(String(member.id));else if(slot==='B2'||slot.startsWith('B2-1'))bySlot.b2=map.get(String(member.id));else if(slot.startsWith('B2-2')||slot==='FLEX'||slot.startsWith('FLEX-'))bySlot.flex=map.get(String(member.id));else if(slot.startsWith('B3-A'))bySlot.b3a=map.get(String(member.id));else if(slot.startsWith('B3-B'))bySlot.b3b=map.get(String(member.id));}
 if(!bySlot.b1||!bySlot.b2||!bySlot.b3a||!bySlot.b3b||!bySlot.flex){const ids=memberIds(team);bySlot.b1=bySlot.b1||map.get(ids[0]);bySlot.b2=bySlot.b2||map.get(ids[1]);bySlot.b3a=bySlot.b3a||map.get(ids[2]);bySlot.b3b=bySlot.b3b||map.get(ids[3]);bySlot.flex=bySlot.flex||map.get(ids[4]);}
 const evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(bySlot.b1,bySlot.b2,bySlot.b3a,bySlot.b3b,bySlot.flex,boss,rules);
 if(evaluated){evaluated.__baseCandidateScore=finite(team?.score,evaluated.score);evaluated.__source='base';evaluated.blueprintName=team?.blueprintName||'기본 후보';evaluated.memberIds=evaluated.members.map(profileId);evaluated.footprint=evaluated.memberIds.slice();return evaluated;}
 const profiles=[bySlot.b1,bySlot.b2,bySlot.b3a,bySlot.b3b,bySlot.flex];if(profiles.some(profile=>!profile))return null;
 const interruptRows=arr(team?.interruptCoverage),required=[...new Set(interruptRows.map(row=>String(row?.requiredElement||'')).filter(Boolean))],providers={};for(const requiredElement of required)providers[requiredElement]=interruptRows.filter(row=>String(row?.requiredElement||'')===requiredElement).flatMap(row=>arr(row?.coveredBy||row?.providers));
 return{__source:'base-fallback',__baseCandidateScore:finite(team?.score),blueprintName:team?.blueprintName||'기본 후보',members:profiles,roles:{b1:bySlot.b1,b2:bySlot.b2,b3:[bySlot.b3a,bySlot.b3b],flex:bySlot.flex},memberIds:profiles.map(profileId),footprint:profiles.map(profileId),score:finite(team?.score),approximateScore:finite(team?.score),weakAnchorCount:finite(team?.weakElementCoverage?.count),shotgunArchetype:false,rangeSummary:{effectiveUptime:1,damageMultiplier:1,pelletRetention:1,movementStability:1},interruptCoverage:{required,providers,missing:[],complete:interruptRows.every(row=>row?.ok!==false)},ammo:{roundsPerSecond:0,triggers400:0,triggers500:0},burstGaugeIndex:0,breakdown:{direct:finite(team?.score),supportB1:0,supportB2:0,supportB3:0,supportFlex:0,synergy:0,raidSuitability:0,element:0,burstGauge:0,survival:0},reasons:arr(team?.assumptions).slice(0,8),key:profiles.map(profileId).join('|')};
}
function scaleForBase(teams){const ratios=teams.map(team=>finite(team.__baseCandidateScore)/Math.max(.0001,finite(team.score))).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);return ratios.length?ratios[Math.floor(ratios.length/2)]:10000;}
async function buildBase(rosterInput,status,cancelToken,runtime,boss,rules,map){
 const low=constrained(),options={bossId:bossId(),objective:'firepower',ownedOnly:rosterInput.mode==='owned',teamCount:5,pairLimit:low?6:8,flexLimit:low?3:4,stabilityMode:true,pairComputationBudget:low?180:260,priorityPairExtraLimit:2,allowCubeDuplicates:true,defaultCubeCapacity:assignedCubeCapacity(),cancelToken,onProgress:event=>{if(status){const pct=Math.round(finite(event?.completed)/Math.max(1,finite(event?.total,100))*100);status.textContent=`1차 후보 계산 ${pct}% · ${String(event?.label||'평가')}`;}}};
 const started=performance.now(),built=await runtime.api.buildCandidates(options);if(cancelToken.cancelled){const error=new Error('사용자가 계산을 중지했습니다.');error.name='AbortError';throw error;}
 const optimized=runtime.api.optimize(built,options);const candidates=arr(built?.candidates).length,rawTeams=arr(optimized?.teams),evaluated=rawTeams.map(team=>baseTeamToEvaluation(team,map,boss,rules)).filter(Boolean);
 if(Array.isArray(built?.candidates))built.candidates.length=0;
 return{optimized,evaluated,options,candidates,elapsedMs:performance.now()-started};
}
function teamUsedSet(teams){const used=new Set();for(const team of teams)for(const id of team.memberIds||team.members?.map(profileId)||[])used.add(canonical(id));return used;}
function exactSimulateTeam(evaluated,runtime){
 const ids=evaluated.members.map(profileId),party={b1:ids[0],b2:ids[1],b3:[ids[2],ids[3]],flex:ids[4]};
 try{const started=performance.now(),result=runtime.sim.simulate({boss:bossId(),duration:180,party,compact:true});return{ok:true,totalDamage:finite(result?.totalDamage),fullBurstCount:finite(result?.fullBurstCount),elapsedMs:performance.now()-started,party};}catch(error){return{ok:false,error:String(error?.message||error),totalDamage:0,fullBurstCount:0,elapsedMs:0,party};}
}
async function searchUnusedTeam({profiles,boss,rules,used,cancelToken,status,runtime,maxResults=48,maxChecks=520000}){
 const pools=profilePools(profiles,boss,rules,used),pairs=[];
 for(let i=0;i<pools.b3.length;i++)for(let j=i+1;j<pools.b3.length;j++){const a=pools.b3[i],b=pools.b3[j];if(canonical(a.id)===canonical(b.id))continue;pairs.push({a,b,score:pools.dealerScore(a)+pools.dealerScore(b)});}
 pairs.sort((x,y)=>y.score-x.score||profileId(x.a).localeCompare(profileId(y.a))||profileId(x.b).localeCompare(profileId(y.b)));
 const results=[],seen=new Set();let checks=0;
 const b1=pools.b1.slice(0,Math.min(22,pools.b1.length)),b2=pools.b2.slice(0,Math.min(30,pools.b2.length)),pairPool=pairs.slice(0,Math.min(420,pairs.length)),flex=pools.flex.slice(0,Math.min(60,pools.flex.length));
 outer:for(let i=0;i<b1.length;i++)for(let j=0;j<b2.length;j++){
  const one=b1[i],two=b2[j],baseIds=new Set([canonical(one.id),canonical(two.id)]);if(baseIds.size<2)continue;
  for(let p=0;p<pairPool.length;p++){
   const pair=pairPool[p],ids=new Set([...baseIds,canonical(pair.a.id),canonical(pair.b.id)]);if(ids.size<4)continue;
   const start=(i*17+j*11+p*7)%Math.max(1,flex.length),scan=Math.min(flex.length,28);let accepted=0;
   for(let f=0;f<scan;f++){
    const fl=flex[(start+f)%flex.length];checks++;if(ids.has(canonical(fl.id)))continue;
    const valid=root.NIKKEKitAwareOptimizer.validateTeamRoles(one,two,pair.a,pair.b,fl,boss,rules);if(!valid.ok)continue;
    const evaluated=root.NIKKEKitAwareOptimizer.evaluateTeamRoles(one,two,pair.a,pair.b,fl,boss,rules);if(!evaluated||seen.has(evaluated.key))continue;
    seen.add(evaluated.key);evaluated.__source='repair';evaluated.memberIds=evaluated.members.map(profileId);evaluated.footprint=evaluated.memberIds.slice();results.push(evaluated);accepted++;
    if(results.length>=maxResults)break outer;if(accepted>=2)break;
    if(checks>=maxChecks)break outer;
   }
   if(checks>=maxChecks)break outer;
   if((checks&4095)===0){if(status)status.textContent=`보완 후보 탐색 · ${checks.toLocaleString()}개 조합 확인 · 유효 ${results.length}개`;await delay(0);if(cancelToken.cancelled){const error=new Error('사용자가 계산을 중지했습니다.');error.name='AbortError';throw error;}}
  }
 }
 const top=results.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key)).slice(0,Math.min(14,results.length));
 for(const candidate of top){candidate.v34710Timeline=exactSimulateTeam(candidate,runtime);await delay(0);}
 top.sort((a,b)=>finite(b.v34710Timeline?.totalDamage)-finite(a.v34710Timeline?.totalDamage)||b.score-a.score||a.key.localeCompare(b.key));
 return{best:top[0]||null,candidates:results.length,checks,pools:{b1:pools.b1.length,b2:pools.b2.length,b3:pools.b3.length,flex:pools.flex.length,pairs:pairs.length}};
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
 const totalScore=teams.reduce((sum,team)=>sum+finite(team.score),0),weakTeams=teams.filter(team=>finite(team.weakAnchorCount)>0).length,interruptTeams=teams.filter(team=>!boss.requiresElementInterrupt||team.interruptCoverage?.complete).length;
 return{status:'ok',complete:true,boss,teams,totalScore,profiles:[],violations:[],diagnostics:{catalogCount:diagnostics.catalogCount||info.total,eligibleCatalogCount:info.total,raidExcludedCount:Math.max(0,(diagnostics.catalogCount||info.total)-info.total),rosterMode:true,ownedCount:diagnostics.ownedCount,receivedCount:diagnostics.receivedCount,profileCount:info.total,b1Count:info.b1,b2Count:info.b2,b3Count:info.b3,flexCount:info.flex,weakTeams,interruptTeams,shotgunTeams:teams.filter(team=>team.shotgunArchetype).length,shotgunSelectedMode:'actual-owned-roster',candidateCount:diagnostics.candidateCount,elapsedMs:diagnostics.elapsedMs,repairChecks:diagnostics.repairChecks,repairCandidates:diagnostics.repairCandidates,repairMode:diagnostics.repairMode,cubePolicy:'preserve-imported-assignments',cacheReleased:true,engine:'v34710-owned-roster-repair'}};
}
function validateResult(result,rosterInput){const teams=arr(result?.teams),ids=teams.flatMap(team=>memberIds(team)),unique=new Set(ids.map(canonical)),errors=[];if(result?.status!=='ok')errors.push(`optimizer status ${result?.status}`);if(teams.length!==5)errors.push(`team count ${teams.length}`);if(ids.length!==25)errors.push(`slot count ${ids.length}`);if(ids.length&&unique.size!==ids.length)errors.push(`duplicate members ${ids.length-unique.size}`);if(rosterInput?.mode==='owned'){const owned=new Set(arr(rosterInput.owned).map(row=>canonical(row?.id||row)));const outside=ids.filter(id=>!owned.has(canonical(id)));if(outside.length)errors.push(`unowned ${outside.join(',')}`);}return{pass:errors.length===0,errors,teamCount:teams.length,slotCount:ids.length,uniqueCount:unique.size,engine:'v34710-owned-roster-repair',checkedAt:new Date().toISOString()};}
function render(result,mount,diagnostics){
 root.NIKKEKitAwareOptimizer.renderResult(result,mount);
 const note=root.document.createElement('div');note.className='notice ok';note.innerHTML=`<b>V34.7.10 실연동 로스터 5덱 복구 엔진</b><br>연동 ${diagnostics.receivedCount}명 · 보유 저장 ${diagnostics.ownedCount}명 · 계산 프로필 ${diagnostics.profileCount}명 · B1 ${diagnostics.b1Count} / B2 ${diagnostics.b2Count} / 활성 B3 ${diagnostics.b3Count} / FLEX ${diagnostics.flexCount} · ${esc(diagnostics.repairMode)} · ${(diagnostics.elapsedMs/1000).toFixed(1)}초`;mount.prepend(note);
}
async function calculate(rosterInput,status,cancelToken){
 const runtime=getRuntime(),boss=root.NIKKEKitAwareOptimizer.normalizeBoss(root.NIKKEKitAwareOptimizer.readBossFromPage(root)),rules=root.NIKKEKitAwareOptimizer.getRules(),collected=runtime.final.profilesFor(root,rosterInput.owned),profiles=collected.profiles,map=new Map(profiles.map(profile=>[profile.id,profile])),info=coverage(profiles,boss,rules),received=receivedCount(),owned=arr(rosterInput.owned).length;
 if(info.total<25||info.b1<5||info.b2<5||info.b3<10||info.flex<5)throw new Error(shortageMessage(info,received,owned,info.total));
 const started=performance.now(),base=await buildBase(rosterInput,status,cancelToken,runtime,boss,rules,map),baseTeams=base.evaluated,filled=await fillMissing(baseTeams,{profiles,boss,rules,cancelToken,status,runtime}),baseScale=scaleForBase(baseTeams),teams=finalizeTeams(filled.teams,baseScale),elapsedMs=performance.now()-started;
 const diagnostics={receivedCount:received,ownedCount:owned,profileCount:info.total,b1Count:info.b1,b2Count:info.b2,b3Count:info.b3,flexCount:info.flex,candidateCount:base.candidates,baseTeamCount:baseTeams.length,repairChecks:filled.repairChecks,repairCandidates:filled.repairCandidates,repairMode:filled.mode,elapsedMs,catalogCount:finite(collected.info?.catalogCount,info.total)};
 const result=buildResult(teams,boss,info,diagnostics),validation=validateResult(result,rosterInput);if(!validation.pass)throw new Error(`5덱 자체검증 실패: ${validation.errors.join(' / ')} · ${shortageMessage(info,received,owned,info.total)}`);
 result.v34710Diagnostics=diagnostics;result.v34710Validation=validation;return{result,diagnostics,validation};
}
async function run(ev){
 if(ev){ev.preventDefault?.();ev.stopPropagation?.();ev.stopImmediatePropagation?.();}
 const parts=panelParts();if(state.active){state.active.cancelToken.cancelled=true;if(parts.status)parts.status.textContent='계산을 안전하게 중지하고 있어요…';if(parts.button)parts.button.textContent='취소 중…';return state.active.promise;}
 const cancelToken={cancelled:false},scrollY=finite(root.scrollY,0),task=(async()=>{try{
  if(parts.panel)parts.panel.setAttribute('aria-busy','true');if(parts.button){parts.button.disabled=false;parts.button.textContent='계산 중지';}if(parts.status)parts.status.textContent='연동 보유 로스터와 역할 수를 확인하는 중…';if(parts.mount)parts.mount.innerHTML='<div class="nikke-kit-loading">실제 연동 큐브 배치를 보존하고, 기본 후보가 4팀에서 막히면 남은 보유 캐릭터로 5번째 팀을 보완합니다.</div>';
  await delay(50);const resolver=root.NIKKEV340FinalOptimizer?.resolveV3413RunRosterInput,rosterInput=typeof resolver==='function'?resolver():{mode:'owned',owned:ownedRows(),label:'보유 로스터'};if(rosterInput.mode==='owned'&&arr(rosterInput.owned).length<25)throw new Error(`연동 ${receivedCount()}명 · 보유 저장 ${arr(rosterInput.owned).length}명. 중복 없는 5팀에는 최소 25명이 필요합니다.`);
  const fingerprint=rosterFingerprint(rosterInput);let calculated;if(state.cache?.fingerprint===fingerprint){calculated=state.cache.value;calculated.diagnostics.cacheHit=true;}else{calculated=await calculate(rosterInput,parts.status,cancelToken);state.cache={fingerprint,value:calculated};}
  const {result,diagnostics,validation}=calculated;state.last={result,diagnostics,validation};root.NIKKEV34710LastResult=result;root.NIKKEV3420LastValidation=validation;root.NIKKEV3420LastError=null;if(parts.mount)render(result,parts.mount,diagnostics);if(parts.status)parts.status.textContent=`완료 · 연동 ${diagnostics.receivedCount}명 / 보유 저장 ${diagnostics.ownedCount}명 / 계산 프로필 ${diagnostics.profileCount}명 · 5팀 25명 · 중복 0 · 자체검증 PASS`;return result;
 }catch(error){const cancelled=error?.name==='AbortError'||cancelToken.cancelled,message=cancelled?'계산을 중지했습니다. 입력값과 로스터는 유지됩니다.':String(error?.message||error);root.NIKKEV3420LastError={code:cancelled?'E34710-CANCEL':'E34710-REPAIR',message};if(parts.status)parts.status.textContent=(cancelled?'계산 중지':'자동편성 중단')+' · '+message;if(parts.mount)parts.mount.innerHTML=`<div class="v340-error"><b>${cancelled?'5덱 계산을 중지했습니다.':'5덱 자동 구성을 완료하지 못했습니다.'}</b><br>${esc(message)}</div>`;return null;
 }finally{state.active=null;if(parts.panel)parts.panel.setAttribute('aria-busy','false');if(parts.button){parts.button.disabled=false;parts.button.textContent='현재 로스터로 V34.7.10 5팀 계산';}try{root.scrollTo(0,scrollY);}catch(_){}}})();
 state.active={promise:task,cancelToken};return task;
}
function verifyPropagation(id='sugarTreasure'){
 const roster=centralRoster(),central=roster[id]||null,context=root.__v26TeamGrowthContext?.byId?.[id]||null;let profiles=[];try{const input=root.NIKKEV340FinalOptimizer.resolveV3413RunRosterInput();profiles=root.NIKKEV340FinalOptimizer.profilesFor(root,input.owned).profiles;}catch(_){}const profile=profiles.find(row=>row.id===id)||null,growth=profile?.growth||null,skills=central?.skills||{},checks={centralOwned:central?.owned===true,contextLevel:finite(context?.level,-1)===finite(central?.level,-2),skills:['skill1','skill2','burst'].every(key=>finite(growth?.skills?.[key],-1)===finite(skills[key],-2)),favoriteItemPhase:finite(growth?.favoriteItemPhase,-1)===finite(central?.favoriteItemPhase,-2),cubeId:String(growth?.cubeId||'none')===String(central?.cubeId||'none'),equipmentAttack:finite(growth?.equipmentAttack,-1)===finite(central?.equipmentAttack,-2),equipmentHp:finite(growth?.equipmentHp,-1)===finite(central?.equipmentHp,-2),equipmentDefense:finite(growth?.equipmentDefense,-1)===finite(central?.equipmentDefense,-2),challengeLevel:Number(growth?.level)===400||finite(growth?.level,-1)===finite(central?.level,-2)};return{version:VERSION,id,central,context,profileGrowth:growth,ownedCount:ownedRows().length,receivedCount:receivedCount(),challengeLevelNormalized:Number(growth?.level)===400,checks,pass:Boolean(profile&&Object.values(checks).every(Boolean))};
}
function brand(){try{root.document.title='니케 성장 계산기 V34.7.10 · 실연동 186명 로스터 5덱 복구';for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent='Nikke Damage Growth Calculator · V34.7.10 · 2026-08-27';}catch(_){}}
function install(){installDynamicOwnedApi();const parts=panelParts();if(parts.button){parts.button.disabled=false;parts.button.textContent=state.active?'계산 중지':'현재 로스터로 V34.7.10 5팀 계산';parts.button.dataset.v34710Repair='true';}root.NIKKEV3420Run=run;root.NIKKEV34710OwnedRosterRepair=Object.freeze({version:VERSION,run,calculate,verifyPropagation,getLastResult:()=>state.last,clearCache:()=>{state.cache=null;}});brand();}
install();if(!root.__NIKKE_V34710_ROSTER_EVENT_BOUND__){root.__NIKKE_V34710_ROSTER_EVENT_BOUND__=true;root.addEventListener?.('nikke:v26-roster-updated',()=>{state.cache=null;installDynamicOwnedApi();});} [100,500,1200,2500,5000,9000,15000,22000].forEach(ms=>root.setTimeout(install,ms));
})(typeof globalThis!=='undefined'?globalThis:window);
</script>
