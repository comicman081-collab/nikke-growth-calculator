(function installV34712UnifiedDamageTimeline(root){
'use strict';
const VERSION='34.7.19';
const SCRIPT_ID='v34712-unified-damage-timeline';
const STYLE_ID='v34712-unified-damage-timeline-style';
const COLORS=['#67e8d2','#8ab4ff','#ffca66','#c8a8ff','#ff8f9b'];
const CHARACTER_SEARCH_TARGETS=Object.freeze([
  ['precisionChar','정밀 캐릭터'],['precisionBurst1','1버스트'],['precisionBufferCombo','조합 버퍼'],
  ['precisionSecondaryBurst3','교대 B3'],['precisionAuxBurst1','보조 B1'],['precisionOffBurstB3','오프버스트 B3'],
  ['soloTeamB3A','솔로레이드 첫 B3'],['soloTeamB3B','솔로레이드 둘째 B3'],['v26CalibrationCharacter','실전 기록 B3']
]);
const cache=new Map();
const panelSims=new WeakMap();
const fiveDeckPanelContexts=new WeakMap();
const CACHE_LIMIT=2;
let searchOutsideBound=false;
function cachePut(key,value){if(cache.has(key))cache.delete(key);cache.set(key,value);while(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value);return value;}
function cacheDrop(key){if(key)cache.delete(key);}
const $=id=>root.document?.getElementById(id);
const arr=v=>Array.isArray(v)?v:[];
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function compactName(name){
  const raw=String(name||'').trim();
  const glyphs=Array.from(raw.replace(/[^0-9A-Za-z가-힣]/g,''));
  if(glyphs.length<=3)return raw||'-';
  return glyphs.slice(0,3).join('')+'...';
}
function compactDamage(value){
  const n=Math.max(0,finite(value));
  const fmt=(q,unit)=>{const digits=q>=100?0:q>=10?1:2;return q.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/,'')+unit;};
  if(n>=1e12)return fmt(n/1e12,'조');
  if(n>=1e8)return fmt(n/1e8,'억');
  if(n>=1e4)return fmt(n/1e4,'만');
  return Math.round(n).toLocaleString('ko-KR');
}
function formatExact(value){return Math.round(finite(value)).toLocaleString('ko-KR');}
function ensureStyle(){
  if($(STYLE_ID))return;
  const style=root.document.createElement('style');style.id=STYLE_ID;
  style.textContent=`
  .v34712-timeline-details{margin-top:12px;border:1px solid rgba(49,89,201,.20);border-radius:14px;background:rgba(255,255,255,.82);overflow:hidden;color:#172a43}
  .v34712-timeline-details>summary{display:flex;align-items:center;gap:10px;min-height:46px;padding:11px 14px;cursor:pointer;font-weight:950;color:#18324f;background:linear-gradient(90deg,rgba(49,89,201,.08),rgba(103,232,210,.08));list-style:none}
  .v34712-timeline-details>summary>span{min-width:0}.v34712-summary-total{margin-left:auto;color:#176e62;font-size:12px;white-space:nowrap}
  .v34712-timeline-details>summary::-webkit-details-marker{display:none}.v34712-timeline-details>summary::after{content:'펼치기 ▾';font-size:11px;color:#52637a}.v34712-timeline-details[open]>summary::after{content:'접기 ▴'}
  .v34712-timeline-shell{padding:12px}.v34712-timeline-note{margin:0 0 9px;padding:8px 10px;border-radius:9px;background:rgba(49,89,201,.065);color:#40566f;font-size:11px;line-height:1.5}
  .v34712-timeline-scroll{overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:4px}.v34712-timeline-layout{display:grid;grid-template-columns:minmax(760px,1fr) 180px;gap:10px;min-width:950px;align-items:stretch}
  .v34712-timeline-chart{box-sizing:border-box;height:330px;min-width:760px;padding:7px;border:1px solid rgba(49,89,201,.17);border-radius:12px;background:#09111f}.v34712-timeline-chart canvas{display:block;width:100%;height:100%}
  .v34712-damage-panel{box-sizing:border-box;height:330px;display:grid;grid-template-rows:repeat(var(--member-count,5),minmax(0,1fr));border:1px solid rgba(49,89,201,.17);border-radius:12px;background:#0d1727;color:#f4f8ff;overflow:hidden}
  .v34712-damage-row{min-height:0;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.08)}.v34712-damage-row:last-child{border-bottom:0}
  .v34712-damage-name{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px;font-weight:900;white-space:nowrap}.v34712-damage-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}.v34712-damage-value{font-size:16px;font-weight:950;line-height:1;color:#fff;white-space:nowrap;text-align:right}
  .v34712-audit{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;font-size:10px;color:#60738c}.v34712-audit b{color:#176e4b}.v34712-audit .fail{color:#a62e2e}
  .v34712-loading{padding:20px;text-align:center;color:#52637a;font-weight:850}.v34712-error{padding:12px;border-radius:10px;background:rgba(190,70,70,.1);color:#8b3028;font-weight:850}
  .v34712-character-search{position:relative;width:100%;margin:0 0 7px;z-index:2}.v34712-character-search.is-open{z-index:1200}
  .v34712-character-search-input{width:100%;min-height:38px!important;height:38px!important;padding:8px 34px 8px 11px!important;border:1px solid rgba(92,108,132,.28)!important;border-radius:10px!important;background:#fff!important;color:#687386!important;font-size:13px!important;font-weight:650!important;box-shadow:none!important}
  .v34712-character-search-input::placeholder{color:#8a94a6!important;opacity:1!important;font-weight:650!important}.v34712-character-search-input:focus{outline:3px solid rgba(73,191,233,.20)!important;border-color:#49bfe9!important}.v34712-character-search::after{content:'⌕';position:absolute;right:11px;top:7px;color:#7f8999;font-size:19px;font-weight:850;pointer-events:none}
  .v34712-character-search-menu{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:1201;max-height:min(310px,calc(100vh - 110px));overflow:auto;padding:6px;border:1px solid rgba(232,154,36,.34);border-radius:11px;background:rgba(255,255,255,.99);box-shadow:0 14px 34px rgba(25,44,76,.22)}.v34712-character-search-menu[hidden]{display:none}
  .v34712-character-search-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;border:0;border-bottom:1px solid rgba(49,89,201,.08);border-radius:7px;background:#fff;color:#1e3551;padding:9px;text-align:left;cursor:pointer}.v34712-character-search-option:last-child{border-bottom:0}.v34712-character-search-option:hover,.v34712-character-search-option:focus{outline:0;background:rgba(255,184,77,.19)}.v34712-character-search-option[aria-selected='true']{background:rgba(49,89,201,.09);font-weight:950}.v34712-character-search-empty{padding:12px 9px;color:#6a7b91;text-align:center;font-size:12px;font-weight:800}
  #v34712PrecisionTimeline,#v34712SoloTimeline,#v34712BattleTimeline{grid-column:1/-1}
  @media(max-width:760px){.v34712-timeline-shell{padding:9px}.v34712-timeline-layout{grid-template-columns:minmax(690px,1fr) 165px;min-width:865px}.v34712-timeline-chart{min-width:690px;height:300px}.v34712-damage-panel{height:300px}.v34712-damage-value{font-size:14px}.v34712-timeline-details>summary{padding:10px 11px}}
  `;
  root.document.head.appendChild(style);
}
function normalizeTrace(sim){
  const helper=root.NIKKEV34610ProjectionTrace?.normalizedTrace;
  if(typeof helper==='function'){try{return helper(sim);}catch(_){}}
  const samples=arr(sim?.samples),final=new Map(arr(sim?.members).map(m=>[String(m.id),finite(m.damage)])),last=samples[samples.length-1];
  if(!samples.length)return[];
  const scale=new Map(arr(last?.members).map(m=>[String(m.id),final.get(String(m.id))/Math.max(1,finite(m.cumulativeDamage))]));
  return samples.map(s=>({time:finite(s.time),members:arr(s.members).map(m=>({...m,cumulativeDamage:finite(m.cumulativeDamage)*finite(scale.get(String(m.id)),1),instantDps:finite(m.instantDps)*finite(scale.get(String(m.id)),1)}))}));
}
function traceAudit(sim,trace){
  const helper=root.NIKKEV34610ProjectionTrace?.traceAudit;
  if(typeof helper==='function'){try{const audit=helper(sim,trace,root.NIKKEV34610ProjectionTrace.burstRows?.(sim,trace)||[]),team=finite(sim?.totalDamage);return{...audit,pass:team>0&&arr(sim?.members).length>0&&trace.length>0&&audit?.pass===true};}catch(_){}}
  const team=finite(sim?.totalDamage),sum=arr(sim?.members).reduce((s,m)=>s+finite(m.damage),0),last=trace[trace.length-1],traceSum=arr(last?.members).reduce((s,m)=>s+finite(m.cumulativeDamage),0),tol=Math.max(1,Math.abs(team)*1e-6);
  return{pass:team>0&&arr(sim?.members).length>0&&trace.length>0&&Math.abs(sum-team)<=tol&&Math.abs(traceSum-team)<=tol,teamTotal:team,memberSum:sum,traceSum};
}
function drawTrace(canvas,sim,trace){
  if(!canvas||!trace.length)return;
  const rect=canvas.getBoundingClientRect(),dpr=root.devicePixelRatio||1,w=Math.max(760,rect.width||760),h=Math.max(280,rect.height||330);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#09111f';c.fillRect(0,0,w,h);
  const pad={l:58,r:16,t:18,b:34},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,dur=Math.max(1,finite(sim?.duration,180)),ids=arr(sim?.members).map(m=>String(m.id));
  const max=Math.max(1,...trace.flatMap(s=>arr(s.members).map(m=>finite(m.instantDps))));
  for(const e of arr(sim?.events).filter(e=>e?.type==='burst')){const from=clamp(finite(e.time),0,dur),matched=String(e.detail||'').match(/·\s*(\d+(?:\.\d+)?)초/),bandSeconds=clamp(matched?finite(matched[1],10):(['modernia','sodaTwinklingBunny'].includes(e.b3Id)?15:10),1,20),to=clamp(from+bandSeconds,0,dur),x0=pad.l+from/dur*pw,x1=pad.l+to/dur*pw;c.fillStyle='rgba(255,202,102,.085)';c.fillRect(x0,pad.t,Math.max(2,x1-x0),ph);c.fillStyle='rgba(255,202,102,.28)';c.fillRect(x0,pad.t,1.5,ph);}
  c.strokeStyle='rgba(255,255,255,.08)';c.lineWidth=1;c.font='10px sans-serif';c.fillStyle='#8fa4bf';
  for(let i=0;i<=6;i++){const x=pad.l+pw*i/6;c.beginPath();c.moveTo(x,pad.t);c.lineTo(x,pad.t+ph);c.stroke();c.fillText(Math.round(dur*i/6)+'s',x-9,h-10);}
  for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;c.beginPath();c.moveTo(pad.l,y);c.lineTo(pad.l+pw,y);c.stroke();}
  ids.forEach((id,idx)=>{c.strokeStyle=COLORS[idx%COLORS.length];c.lineWidth=2.1;c.beginPath();let started=false;for(const s of trace){const m=arr(s.members).find(x=>String(x.id)===id);if(!m)continue;const x=pad.l+clamp(finite(s.time)/dur,0,1)*pw,y=pad.t+ph*(1-clamp(finite(m.instantDps)/max,0,1));if(!started){c.moveTo(x,y);started=true}else c.lineTo(x,y);}c.stroke();});
  c.fillStyle='#9eb0c8';c.font='11px sans-serif';c.fillText('캐릭터별 순간 딜 흐름',8,12);c.fillText('0',12,pad.t+ph+3);c.fillText(compactDamage(max)+'/s',4,pad.t+10);
}
function panelHtml(sim,note=''){
  const members=arr(sim?.members),count=Math.max(1,members.length),trace=normalizeTrace(sim),audit=traceAudit(sim,trace);
  return{trace,audit,html:`<div class="v34712-timeline-shell">${note?`<div class="v34712-timeline-note">${esc(note)}</div>`:''}<div class="v34712-timeline-scroll"><div class="v34712-timeline-layout"><div class="v34712-timeline-chart"><canvas></canvas></div><aside class="v34712-damage-panel" style="--member-count:${count}">${members.map((m,i)=>`<div class="v34712-damage-row" title="${esc(m.name||m.id)}"><span class="v34712-damage-name"><i class="v34712-damage-dot" style="background:${COLORS[i%COLORS.length]}"></i>${esc(compactName(m.name||m.id))}</span><b class="v34712-damage-value">${esc(compactDamage(m.damage))}</b></div>`).join('')}</aside></div></div><div class="v34712-audit"><span>총딜 <strong>${formatExact(sim.totalDamage)}</strong></span><span>멤버합 ${formatExact(audit.memberSum)}</span><span>시간축합 ${formatExact(audit.traceSum)}</span><b class="${audit.pass?'':'fail'}">${audit.pass?'TOTAL MATCH PASS':'TOTAL MISMATCH'}</b></div></div>`};
}
function renderPanel(details,sim,note=''){
  const body=details.querySelector('.v34712-timeline-body');if(!body)return;
  const built=panelHtml(sim,note);body.innerHTML=built.html;const total=finite(sim.totalDamage);const meta=details.querySelector('.v34712-summary-total');if(meta)meta.textContent=`총 ${compactDamage(total)}`;panelSims.set(details,{sim,trace:built.trace});root.requestAnimationFrame?.(()=>drawTrace(body.querySelector('canvas'),sim,built.trace));details.dataset.auditPass=String(!!built.audit.pass);details.dataset.total=String(total);
}
function syntheticFromSnapshot(snapshot,totalOverride=null,durationOverride=null){
  if(!snapshot)throw new Error('정밀 계산값이 없습니다.');const durationValue=durationOverride==null?(snapshot.duration||180):durationOverride,totalValue=totalOverride==null?snapshot.totals?.combo:totalOverride,duration=Math.max(1,finite(durationValue,180)),total=Math.max(0,finite(totalValue,0));
  if(!(total>0))throw new Error('확정 총딜이 0입니다. 캐릭터·성장값·조합 선택을 다시 확인해 주세요.');
  if(!snapshot.id||!snapshot.breakdown||!['normal','skill','burst'].every(key=>Number.isFinite(Number(snapshot.breakdown[key]))))throw new Error('캐릭터별 정밀 피해 분해값이 없거나 유효하지 않습니다.');
  const rawNormal=Math.max(0,finite(snapshot.breakdown?.normal)),rawSkill=Math.max(0,finite(snapshot.breakdown?.skill)),rawBurst=Math.max(0,finite(snapshot.breakdown?.burst)),rawSum=Math.max(1,rawNormal+rawSkill+rawBurst),scale=total/rawSum,normal=rawNormal*scale,skill=rawSkill*scale,burst=rawBurst*scale;
  const starts=arr(snapshot.burstTimeline?.ownStarts).length?arr(snapshot.burstTimeline.ownStarts):arr(snapshot.burstTimeline?.starts),step=1,samples=[];let cumulative=0;
  for(let t=0;t<=duration;t+=step){let dps=(normal+skill)/duration;if(burst>0){if(starts.length){const active=starts.filter(s=>t>=finite(s)&&t<finite(s)+10).length;dps+=active*(burst/starts.length/10);}else dps+=burst/duration;}cumulative+=dps*step;samples.push({time:Math.min(t,duration),members:[{id:snapshot.id,name:snapshot.name,instantDps:dps,cumulativeDamage:cumulative}]});}
  const end=samples[samples.length-1]?.members?.[0],renorm=end?.cumulativeDamage>0?total/end.cumulativeDamage:1;for(const s of samples){s.members[0].instantDps*=renorm;s.members[0].cumulativeDamage*=renorm;}
  const member={id:snapshot.id,name:snapshot.name||snapshot.id,damage:total,normalDamage:normal,skillDamage:skill,burstDamage:burst,weapon:snapshot.weapon||'',shots:finite(snapshot.weaponCycle?.shots),reloads:finite(snapshot.weaponCycle?.reloads),gaugeGenerated:0};
  return{duration,totalDamage:total,averageDps:total/duration,members:[member],samples,events:starts.map((time,index)=>({type:'burst',time:finite(time),label:`버스트 ${index+1}`})),fullBurstCount:starts.length,notes:[]};
}
function makeDetails(id,label){const d=root.document.createElement('details');d.open=false;d.id=id;d.className='v34712-timeline-details';d.innerHTML=`<summary><span>${esc(label)}</span><b class="v34712-summary-total">계산 전</b></summary><div class="v34712-timeline-body"><div class="v34712-loading">타임라인을 누르면 계산 결과를 시간축으로 펼칩니다.</div></div>`;return d;}
function setPanelError(d,error){const body=d?.querySelector('.v34712-timeline-body');if(body)body.innerHTML=`<div class="v34712-error">${esc(error?.message||error)}</div>`;const meta=d?.querySelector('.v34712-summary-total');if(meta)meta.textContent='확인 필요';}
function precisionSourceKey(s){return ['precision',s?.id,finite(s?.totals?.combo),finite(s?.breakdown?.normal),finite(s?.breakdown?.skill),finite(s?.breakdown?.burst),arr(s?.burstTimeline?.ownStarts).join(',')].join('|');}
function refreshPrecisionSnapshot(recalculate=true){const selectedId=String($('precisionChar')?.value||''),bufferId=String($('precisionBufferCombo')?.value||'none');if(!selectedId)throw new Error('정밀 캐릭터를 먼저 선택해 주세요.');if(recalculate){try{root.NIKKEV3475SyncPropagation?.refreshPrecision?.();}catch(_){}if(typeof root.precisionCalc==='function')root.precisionCalc();}const s=root.__precisionSnapshot;if(!s)throw new Error('정밀 계산 결과가 생성되지 않았습니다.');if(String(s.id)!==selectedId)throw new Error(`선택 캐릭터(${selectedId})와 계산 결과(${s.id||'없음'})가 일치하지 않습니다.`);if(String(s.selections?.bufferId||'none')!==bufferId)throw new Error(`선택 특수조합(${bufferId})이 계산 결과에 반영되지 않았습니다.`);if(!Number.isFinite(Number(s.totals?.combo))||Number(s.totals.combo)<=0)throw new Error('정밀 조합 총딜이 0이거나 유효하지 않습니다.');return s;}
function renderPrecisionDetails(d,recalculate=false){try{const s=refreshPrecisionSnapshot(recalculate),key=precisionSourceKey(s);if(d.dataset.v34712SourceKey===key&&d.querySelector('canvas'))return;const sim=syntheticFromSnapshot(s);renderPanel(d,sim,'정밀 엔진의 확정 총딜·일반/스킬/버스트 비중을 그대로 보존한 선택 딜러 1인의 시간축입니다. 그래프가 딜을 다시 계산하지 않습니다.');d.dataset.v34712SourceKey=key;}catch(e){setPanelError(d,e);}}
function soloResult(){let r=root.NIKKESoloRaidLastResult||root.__soloRaidLastResult||null;if(!r){try{r=(typeof __soloRaidLastResult!=='undefined')?__soloRaidLastResult:null;}catch(_){}}return r;}
function renderSoloDetails(d,refresh=false){try{if(refresh&&typeof root.soloRaidRefresh==='function')root.soloRaidRefresh();const r=soloResult();if(!r?.snapshot)throw new Error('솔로레이드 결과를 먼저 계산해 주세요.');if(!(finite(r.combo?.total)>0))throw new Error('솔로레이드 확정 총딜이 0입니다.');const key=['solo',precisionSourceKey(r.snapshot),finite(r.combo?.total),r.boss?.id||r.boss?.name||'',finite(r.boss?.duration)].join('|');if(d.dataset.v34712SourceKey===key&&d.querySelector('canvas'))return;const sim=syntheticFromSnapshot(r.snapshot,r.combo?.total,r.boss?.duration||r.snapshot.duration);renderPanel(d,sim,'레이드 탭의 확정 보스 환산 총딜을 사용한 선택 딜러 1인의 시간축입니다. 절대 발생 시각이 없는 저지·엄폐·이탈 손실은 기존 계산 규칙대로 합산값만 반영합니다.');d.dataset.v34712SourceKey=key;}catch(e){setPanelError(d,e);}}
function renderBattleDetails(d){try{const sim=root.NIKKESinglePartyTimelineLastResult;if(!sim?.members?.length)throw new Error('전투 시뮬레이션을 먼저 실행해 주세요.');const key=['battle',finite(sim.totalDamage),...arr(sim.members).map(m=>`${m.id}:${finite(m.damage)}`)].join('|');if(d.dataset.v34712SourceKey===key&&d.querySelector('canvas'))return;renderPanel(d,sim,'전투 시뮬레이터가 계산한 동일 샘플과 5명 멤버별 총딜을 직접 그립니다.');d.dataset.v34712SourceKey=key;}catch(e){setPanelError(d,e);}}
function precisionDetails(){let d=$('v34712PrecisionTimeline');if(d)return d;const grid=$('precision')?.querySelector('.grid');if(!grid)return null;d=makeDetails('v34712PrecisionTimeline','타임라인 · 정밀 조합 딜 흐름');grid.appendChild(d);d.addEventListener('toggle',()=>{if(d.open)renderPrecisionDetails(d,true);});return d;}
function soloDetails(){let d=$('v34712SoloTimeline');if(d)return d;const result=$('soloRaidResult');if(!result)return null;d=makeDetails('v34712SoloTimeline','타임라인 · 레이드 적용 딜 흐름');result.insertAdjacentElement('afterend',d);d.addEventListener('toggle',()=>{if(d.open)renderSoloDetails(d,true);});return d;}
function battleDetails(){let d=$('v34712BattleTimeline');if(d)return d;const mount=$('nikkeTimelineResult');if(!mount)return null;d=makeDetails('v34712BattleTimeline','캐릭터별 타임라인 · 전투 시뮬레이션');mount.insertAdjacentElement('afterend',d);d.addEventListener('toggle',()=>{if(d.open)renderBattleDetails(d);});return d;}
function fiveDeckResult(){return root.NIKKEV34710LastResult||root.NIKKEV3420LastResult||root.NIKKEV340LastResult||root.NIKKEKitAwareLastResult||null;}
function teamMemberIds(team){const roleIds=[team?.roles?.b1?.id||team?.roles?.b1,team?.roles?.b2?.id||team?.roles?.b2,...arr(team?.roles?.b3).map(x=>x?.id||x),team?.roles?.flex?.id||team?.roles?.flex].filter(Boolean).map(String);if(roleIds.length===5)return roleIds;const memberIds=arr(team?.memberIds).filter(Boolean).map(String);if(memberIds.length===5)return memberIds;return arr(team?.members).map(x=>String(x?.id||x||'')).filter(Boolean);}
function teamFingerprint(team,result,index){const ids=teamMemberIds(team),boss=result?.boss,mode=result?.rosterMode||result?.mode||$('v3413RosterMode')?.value||'';return `${boss?.id||boss?.name||'boss'}|${mode}|${index}|${ids.join('|')}|${finite(team?.simulation?.totalDamage)}|${finite(team?.score)}|${finite(result?.totalScore)}|${root.NIKKE_V26_ROSTER_API?.load?.()?.updatedAt||''}`;}
function partyFromTeam(api,team){const converted=typeof api.candidateToRoles==='function'?api.candidateToRoles(team):null;if(converted)return converted;if(team?.roles)return team.roles;if(team?.spec)return{b1:team.spec.b1,b2:team.spec.b2,b3:arr(team.spec.b3),flex:team.spec.flex,rotation:team.rotation||null};const rows=arr(team?.members),by={b3:[]};for(const row of rows){const id=String(row?.id||row||''),slot=String(row?.slot||'').toUpperCase().replace(/\s+/g,'').replace(/_/g,'-');if(!id)continue;if(slot==='B1'||slot.startsWith('B1-'))by.b1=id;else if(slot==='B2'||slot==='B2-1'||slot==='BURST2')by.b2=id;else if(slot.startsWith('B3')||slot.startsWith('BURST3'))by.b3.push(id);else if(slot==='FLEX'||slot==='B2-2'||slot.startsWith('FLEX-'))by.flex=id;}const fallback=teamMemberIds(team);by.b1=by.b1||fallback[0];by.b2=by.b2||fallback[1];while(by.b3.length<2&&fallback[by.b3.length+2])by.b3.push(fallback[by.b3.length+2]);by.flex=by.flex||fallback[4];return by.b1&&by.b2&&by.b3.length>=2&&by.flex?{b1:by.b1,b2:by.b2,b3:by.b3.slice(0,2),flex:by.flex,rotation:team?.rotation||null}:null;}
function simulateTeam(team,result,index){
  const api=root.NIKKESinglePartyTimelineSimulator;if(!api?.simulate)throw new Error('전투 타임라인 엔진을 찾지 못했습니다.');const key=teamFingerprint(team,result,index);if(cache.has(key))return cache.get(key);
  let sim=team?.simulation;if(!sim?.samples?.length){const party=partyFromTeam(api,team);if(!party)throw new Error('덱 역할 정보를 읽지 못했습니다.');const duration=Math.max(1,finite(result?.boss?.duration||team?.simulation?.duration,180));sim=api.simulate({boss:result?.boss||team?.simulation?.boss,party,duration,step:.15,compact:false});}
  if(!(finite(sim?.totalDamage)>0))throw new Error('덱 타임라인 총딜이 0입니다. 성장값과 보스 설정을 확인해 주세요.');if(arr(sim?.members).length!==5)throw new Error(`덱 멤버 결과가 ${arr(sim?.members).length}명입니다. 5명 구성을 다시 계산해 주세요.`);if(!arr(sim?.samples).length)throw new Error('캐릭터별 시간 샘플이 생성되지 않았습니다.');
  return cachePut(key,sim);
}
function renderFiveDeckPanel(details,team,result,index){
  const key=teamFingerprint(team,result,index),body=details.querySelector('.v34712-timeline-body');
  if(details.dataset.v34712SourceKey===key&&details.dataset.auditPass==='true'&&details.querySelector('canvas')){if(details.open){const stored=panelSims.get(details);root.requestAnimationFrame?.(()=>stored&&drawTrace(details.querySelector('canvas'),stored.sim,stored.trace));}return;}
  if(details.dataset.v34712SourceKey===key&&['rendering','error'].includes(details.dataset.v34712State))return;
  details.dataset.v34712SourceKey=key;details.dataset.v34712State='rendering';details.setAttribute('aria-busy','true');
  const knownTotal=finite(team?.simulation?.totalDamage||team?.totalDamage||team?.damage||team?.score),meta=details.querySelector('.v34712-summary-total');
  if(meta)meta.textContent=knownTotal>0?`총 ${compactDamage(knownTotal)}`:'결과 표시 중';
  if(body)body.innerHTML='<div class="v34712-loading">계산이 끝난 덱의 캐릭터별 딜과 타임라인을 표시 중…</div>';
  root.setTimeout(()=>{try{const sim=simulateTeam(team,result,index);renderPanel(details,sim,`덱 ${index+1} · 현재 선택 성장·현재 보스 조건의 180초 정밀 시뮬레이션입니다. 편성 카드 점수는 후보 비교값이며, 여기의 총딜과 오른쪽 5명 딜은 동일 타임라인 샘플의 실제 합계입니다. 긴 이름은 앞 3글자+…로 축약합니다.`);details.dataset.v34712State='ready';details.setAttribute('aria-busy','false');}catch(e){details.dataset.v34712State='error';details.setAttribute('aria-busy','false');setPanelError(details,e);}},0);
}
function decorateFiveDeck(){
  const result=fiveDeckResult(),mount=$('nikke-kit-results');if(!result?.teams?.length||!mount)return false;const cards=[...mount.querySelectorAll('.nikke-kit-team,.v26-optimizer-team,.v340-team,.v3309-team,.v3307-team')].slice(0,result.teams.length);if(cards.length<Math.min(5,result.teams.length))return false;
  cards.forEach((card,index)=>{card.dataset.v34712TeamIndex=String(index);let d=card.querySelector('.v34712-five-deck-timeline');if(!d){d=makeDetails(`v34712FiveDeckTimeline${index+1}`,`타임라인 · 덱 ${index+1} 캐릭터별 딜`);d.classList.add('v34712-five-deck-timeline');card.appendChild(d);d.addEventListener('toggle',()=>{const current=fiveDeckPanelContexts.get(d);if(d.open&&current)renderFiveDeckPanel(d,current.team,current.result,current.index);});}fiveDeckPanelContexts.set(d,{team:result.teams[index],result,index});d.open=true;renderFiveDeckPanel(d,result.teams[index],result,index);});return true;
}
function normalizedSearch(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]/g,'');}
function closeCharacterSearch(wrap){if(!wrap)return;wrap.classList.remove('is-open');const input=wrap.querySelector('.v34712-character-search-input'),menu=wrap.querySelector('.v34712-character-search-menu');if(input)input.setAttribute('aria-expanded','false');if(menu)menu.hidden=true;}
function renderCharacterSearch(wrap,select){
  const input=wrap.querySelector('.v34712-character-search-input'),menu=wrap.querySelector('.v34712-character-search-menu'),query=normalizedSearch(input?.value),options=[...select.options].filter(option=>!option.disabled),selected=String(select.value||'');
  const rows=options.filter(option=>!query||normalizedSearch(`${option.textContent} ${option.value}`).includes(query)).slice(0,40);menu.replaceChildren();
  if(!rows.length){const empty=root.document.createElement('div');empty.className='v34712-character-search-empty';empty.textContent='검색 결과가 없습니다.';menu.appendChild(empty);}else for(const option of rows){const button=root.document.createElement('button');button.type='button';button.className='v34712-character-search-option';button.dataset.value=option.value;button.setAttribute('aria-selected',String(String(option.value)===selected));const name=root.document.createElement('span');name.textContent=String(option.textContent||option.value).trim();button.appendChild(name);button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));input.value='';closeCharacterSearch(wrap);});menu.appendChild(button);}
  wrap.classList.add('is-open');menu.hidden=false;input?.setAttribute('aria-expanded','true');
}
function decorateCharacterSearch(select,label){
  if(!select||select.dataset.v34712Search==='1')return false;const id=String(select.id||''),old=root.document.querySelector(`.v34712-character-search[data-search-for="${id}"]`);if(old&&old.nextElementSibling!==select)old.remove();
  const wrap=root.document.createElement('div');wrap.className='v34712-character-search';wrap.dataset.searchFor=id;const input=root.document.createElement('input'),menu=root.document.createElement('div'),menuId=`${id}V34712SearchMenu`;input.type='search';input.className='v34712-character-search-input';input.autocomplete='off';input.spellcheck=false;input.placeholder='검색';input.setAttribute('aria-label',`${label} 검색`);input.setAttribute('aria-controls',menuId);input.setAttribute('aria-expanded','false');menu.id=menuId;menu.className='v34712-character-search-menu';menu.hidden=true;wrap.append(input,menu);select.insertAdjacentElement('beforebegin',wrap);select.dataset.v34712Search='1';
  const clearSearch=()=>{if(root.document.activeElement!==input)input.value='';};clearSearch();input.addEventListener('focus',()=>{input.value='';renderCharacterSearch(wrap,select);});input.addEventListener('input',()=>renderCharacterSearch(wrap,select));input.addEventListener('keydown',event=>{if(event.key==='Escape'){closeCharacterSearch(wrap);input.value='';select.focus();}else if(event.key==='Enter'){event.preventDefault();menu.querySelector('.v34712-character-search-option')?.click();input.value='';}else if(event.key==='ArrowDown'){event.preventDefault();menu.querySelector('.v34712-character-search-option')?.focus();}});input.addEventListener('blur',()=>root.setTimeout(clearSearch,0));select.addEventListener('change',clearSearch);return true;
}
function decorateCharacterSearches(){let count=0;for(const [id,label] of CHARACTER_SEARCH_TARGETS)if(decorateCharacterSearch($(id),label))count++;if(!searchOutsideBound){searchOutsideBound=true;root.document.addEventListener('pointerdown',event=>{for(const wrap of root.document.querySelectorAll('.v34712-character-search.is-open'))if(!wrap.contains(event.target))closeCharacterSearch(wrap);});}return count;}
function updateBrand(){try{root.document.title=root.document.title.replace(/V34\.7\.(?:11|12|18)/g,'V34.7.19');for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent=String(node.textContent||'').replace(/V34\.7\.(?:11|12|18)/g,'V34.7.19');}catch(_){}}
function refreshOpenPanels(){const precision=$('v34712PrecisionTimeline'),solo=$('v34712SoloTimeline'),battle=$('v34712BattleTimeline');if(precision?.open)renderPrecisionDetails(precision);if(solo?.open)renderSoloDetails(solo,false);if(battle?.open)renderBattleDetails(battle);}
function verify(){const fiveDeckPanels=[...root.document.querySelectorAll('.v34712-five-deck-timeline')],result={version:VERSION,precision:!!$('v34712PrecisionTimeline'),soloRaid:!!$('v34712SoloTimeline'),battle:!!$('v34712BattleTimeline'),fiveDeckPanels:fiveDeckPanels.length,fiveDeckAutoOpen:fiveDeckPanels.length>0&&fiveDeckPanels.every(panel=>panel.open),characterSearches:root.document.querySelectorAll('.v34712-character-search').length,precisionSearch:!!root.document.querySelector('.v34712-character-search[data-search-for="precisionChar"]'),compactNameProbe:compactName('신데렐라'),damageProbe:compactDamage(1200000000),dynamicFiveDeck:true,usesExistingDamageResults:true,equalHeightBoxSizing:true,instantFiveDeckResults:true};result.pass=result.precision&&result.soloRaid&&result.battle&&result.precisionSearch&&result.compactNameProbe==='신데렐...'&&result.damageProbe.startsWith('12');root.NIKKEV34712TimelineVerification=Object.freeze(result);return result;}
function install(){ensureStyle();decorateCharacterSearches();precisionDetails();soloDetails();battleDetails();decorateFiveDeck();updateBrand();verify();}
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
[50,250,1000,3000,6000,10000,16000,23000].forEach(ms=>root.setTimeout(()=>{decorateCharacterSearches();updateBrand();verify();},ms));
let refreshQueued=false;const observer=new MutationObserver(()=>{decorateCharacterSearches();precisionDetails();soloDetails();battleDetails();decorateFiveDeck();verify();if(!refreshQueued){refreshQueued=true;root.setTimeout(()=>{refreshQueued=false;refreshOpenPanels();},0);}});observer.observe(root.document.documentElement,{subtree:true,childList:true});
root.addEventListener?.('resize',()=>{for(const d of root.document.querySelectorAll('.v34712-timeline-details[open]')){const canvas=d.querySelector('canvas'),stored=panelSims.get(d);if(canvas&&stored)drawTrace(canvas,stored.sim,stored.trace);}});
root.addEventListener?.('nikke:v26-roster-updated',()=>cache.clear());
root.NIKKEV34712UnifiedTimeline=Object.freeze({version:VERSION,compactName,compactDamage,normalizeTrace,traceAudit,syntheticFromSnapshot,refreshPrecisionSnapshot,simulateTeam,renderFiveDeckPanel,decorateFiveDeck,decorateCharacterSearches,verify,cacheSize:()=>cache.size,clearCache:()=>cache.clear()});
})(window);

// v34712 canonical integration trigger
// v34712 normalized regression trigger
