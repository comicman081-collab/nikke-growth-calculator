(function installV34712UnifiedDamageTimeline(root){
'use strict';
const VERSION='34.7.12';
const SCRIPT_ID='v34712-unified-damage-timeline';
const STYLE_ID='v34712-unified-damage-timeline-style';
const COLORS=['#67e8d2','#8ab4ff','#ffca66','#c8a8ff','#ff8f9b'];
const cache=new Map();
const CACHE_LIMIT=2;
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
  .v34712-timeline-details>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:11px 14px;cursor:pointer;font-weight:950;color:#18324f;background:linear-gradient(90deg,rgba(49,89,201,.08),rgba(103,232,210,.08));list-style:none}
  .v34712-timeline-details>summary::-webkit-details-marker{display:none}.v34712-timeline-details>summary::after{content:'펼치기 ▾';font-size:11px;color:#52637a}.v34712-timeline-details[open]>summary::after{content:'접기 ▴'}
  .v34712-timeline-shell{padding:12px}.v34712-timeline-note{margin:0 0 9px;padding:8px 10px;border-radius:9px;background:rgba(49,89,201,.065);color:#40566f;font-size:11px;line-height:1.5}
  .v34712-timeline-scroll{overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:4px}.v34712-timeline-layout{display:grid;grid-template-columns:minmax(760px,1fr) 150px;gap:10px;min-width:930px;align-items:stretch}
  .v34712-timeline-chart{height:330px;min-width:760px;padding:7px;border:1px solid rgba(49,89,201,.17);border-radius:12px;background:#09111f}.v34712-timeline-chart canvas{display:block;width:100%;height:100%}
  .v34712-damage-panel{height:330px;display:grid;grid-template-rows:repeat(var(--member-count,5),minmax(0,1fr));border:1px solid rgba(49,89,201,.17);border-radius:12px;background:#0d1727;color:#f4f8ff;overflow:hidden}
  .v34712-damage-row{min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.08)}.v34712-damage-row:last-child{border-bottom:0}
  .v34712-damage-name{display:flex;align-items:center;gap:6px;max-width:100%;font-size:12px;font-weight:900;white-space:nowrap}.v34712-damage-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}.v34712-damage-value{margin-top:4px;font-size:17px;font-weight:950;line-height:1;color:#fff;white-space:nowrap}
  .v34712-audit{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;font-size:10px;color:#60738c}.v34712-audit b{color:#176e4b}.v34712-audit .fail{color:#a62e2e}
  .v34712-loading{padding:20px;text-align:center;color:#52637a;font-weight:850}.v34712-error{padding:12px;border-radius:10px;background:rgba(190,70,70,.1);color:#8b3028;font-weight:850}
  #v34712PrecisionTimeline,#v34712SoloTimeline,#v34712BattleTimeline{grid-column:1/-1}
  @media(max-width:760px){.v34712-timeline-shell{padding:9px}.v34712-timeline-layout{grid-template-columns:minmax(690px,1fr) 132px;min-width:840px}.v34712-timeline-chart{min-width:690px;height:300px}.v34712-damage-panel{height:300px}.v34712-damage-value{font-size:15px}.v34712-timeline-details>summary{padding:10px 11px}}
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
  if(typeof helper==='function'){try{return helper(sim,trace,root.NIKKEV34610ProjectionTrace.burstRows?.(sim,trace)||[]);}catch(_){}}
  const team=finite(sim?.totalDamage),sum=arr(sim?.members).reduce((s,m)=>s+finite(m.damage),0),last=trace[trace.length-1],traceSum=arr(last?.members).reduce((s,m)=>s+finite(m.cumulativeDamage),0),tol=Math.max(1,Math.abs(team)*1e-6);
  return{pass:Math.abs(sum-team)<=tol&&Math.abs(traceSum-team)<=tol,teamTotal:team,memberSum:sum,traceSum};
}
function drawTrace(canvas,sim,trace){
  if(!canvas||!trace.length)return;
  const rect=canvas.getBoundingClientRect(),dpr=root.devicePixelRatio||1,w=Math.max(760,rect.width||760),h=Math.max(280,rect.height||330);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#09111f';c.fillRect(0,0,w,h);
  const pad={l:58,r:16,t:18,b:34},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,dur=Math.max(1,finite(sim?.duration,180)),ids=arr(sim?.members).map(m=>String(m.id));
  const max=Math.max(1,...trace.flatMap(s=>arr(s.members).map(m=>finite(m.instantDps))));
  c.strokeStyle='rgba(255,255,255,.08)';c.lineWidth=1;c.font='10px sans-serif';c.fillStyle='#8fa4bf';
  for(let i=0;i<=6;i++){const x=pad.l+pw*i/6;c.beginPath();c.moveTo(x,pad.t);c.lineTo(x,pad.t+ph);c.stroke();c.fillText(Math.round(dur*i/6)+'s',x-9,h-10);}
  for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;c.beginPath();c.moveTo(pad.l,y);c.lineTo(pad.l+pw,y);c.stroke();}
  for(const e of arr(sim?.events).filter(e=>e?.type==='burst')){const x=pad.l+clamp(finite(e.time)/dur,0,1)*pw;c.fillStyle='rgba(255,202,102,.14)';c.fillRect(x-1,pad.t,3,ph);}
  ids.forEach((id,idx)=>{c.strokeStyle=COLORS[idx%COLORS.length];c.lineWidth=2.1;c.beginPath();let started=false;for(const s of trace){const m=arr(s.members).find(x=>String(x.id)===id);if(!m)continue;const x=pad.l+clamp(finite(s.time)/dur,0,1)*pw,y=pad.t+ph*(1-clamp(finite(m.instantDps)/max,0,1));if(!started){c.moveTo(x,y);started=true}else c.lineTo(x,y);}c.stroke();});
  c.fillStyle='#9eb0c8';c.font='11px sans-serif';c.fillText('캐릭터별 순간 딜 흐름',8,12);c.fillText('0',12,pad.t+ph+3);c.fillText(compactDamage(max)+'/s',4,pad.t+10);
}
function panelHtml(sim,note=''){
  const members=arr(sim?.members),count=Math.max(1,members.length),trace=normalizeTrace(sim),audit=traceAudit(sim,trace);
  return{trace,audit,html:`<div class="v34712-timeline-shell">${note?`<div class="v34712-timeline-note">${esc(note)}</div>`:''}<div class="v34712-timeline-scroll"><div class="v34712-timeline-layout"><div class="v34712-timeline-chart"><canvas></canvas></div><aside class="v34712-damage-panel" style="--member-count:${count}">${members.map((m,i)=>`<div class="v34712-damage-row" title="${esc(m.name||m.id)}"><span class="v34712-damage-name"><i class="v34712-damage-dot" style="background:${COLORS[i%COLORS.length]}"></i>${esc(compactName(m.name||m.id))}</span><b class="v34712-damage-value">${esc(compactDamage(m.damage))}</b></div>`).join('')}</aside></div></div><div class="v34712-audit"><span>총딜 <strong>${formatExact(sim.totalDamage)}</strong></span><span>멤버합 ${formatExact(audit.memberSum)}</span><span>시간축합 ${formatExact(audit.traceSum)}</span><b class="${audit.pass?'':'fail'}">${audit.pass?'TOTAL MATCH PASS':'TOTAL MISMATCH'}</b></div></div>`};
}
function renderPanel(details,sim,note=''){
  const body=details.querySelector('.v34712-timeline-body');if(!body)return;
  const built=panelHtml(sim,note);body.innerHTML=built.html;root.requestAnimationFrame?.(()=>drawTrace(body.querySelector('canvas'),sim,built.trace));details.dataset.auditPass=String(!!built.audit.pass);details.dataset.total=String(finite(sim.totalDamage));
}
function syntheticFromSnapshot(snapshot,totalOverride=null,durationOverride=null){
  if(!snapshot)throw new Error('정밀 계산값이 없습니다.');const durationValue=durationOverride==null?(snapshot.duration||180):durationOverride,totalValue=totalOverride==null?snapshot.totals?.combo:totalOverride,duration=Math.max(1,finite(durationValue,180)),total=Math.max(0,finite(totalValue,0));
  const rawNormal=Math.max(0,finite(snapshot.breakdown?.normal)),rawSkill=Math.max(0,finite(snapshot.breakdown?.skill)),rawBurst=Math.max(0,finite(snapshot.breakdown?.burst)),rawSum=Math.max(1,rawNormal+rawSkill+rawBurst),scale=total/rawSum,normal=rawNormal*scale,skill=rawSkill*scale,burst=rawBurst*scale;
  const starts=arr(snapshot.burstTimeline?.ownStarts).length?arr(snapshot.burstTimeline.ownStarts):arr(snapshot.burstTimeline?.starts),step=1,samples=[];let cumulative=0;
  for(let t=0;t<=duration;t+=step){let dps=(normal+skill)/duration;if(burst>0){if(starts.length){const active=starts.filter(s=>t>=finite(s)&&t<finite(s)+10).length;dps+=active*(burst/starts.length/10);}else dps+=burst/duration;}cumulative+=dps*step;samples.push({time:Math.min(t,duration),members:[{id:snapshot.id,name:snapshot.name,instantDps:dps,cumulativeDamage:cumulative}]});}
  const end=samples[samples.length-1]?.members?.[0],renorm=end?.cumulativeDamage>0?total/end.cumulativeDamage:1;for(const s of samples){s.members[0].instantDps*=renorm;s.members[0].cumulativeDamage*=renorm;}
  const member={id:snapshot.id,name:snapshot.name||snapshot.id,damage:total,normalDamage:normal,skillDamage:skill,burstDamage:burst,weapon:snapshot.weapon||'',shots:finite(snapshot.weaponCycle?.shots),reloads:finite(snapshot.weaponCycle?.reloads),gaugeGenerated:0};
  return{duration,totalDamage:total,averageDps:total/duration,members:[member],samples,events:starts.map((time,index)=>({type:'burst',time:finite(time),label:`버스트 ${index+1}`})),fullBurstCount:starts.length,notes:[]};
}
function makeDetails(id,label){const d=root.document.createElement('details');d.id=id;d.className='v34712-timeline-details';d.innerHTML=`<summary>${esc(label)}</summary><div class="v34712-timeline-body"><div class="v34712-loading">타임라인을 누르면 계산 결과를 시간축으로 펼칩니다.</div></div>`;return d;}
function precisionDetails(){let d=$('v34712PrecisionTimeline');if(d)return d;const grid=$('precision')?.querySelector('.grid');if(!grid)return null;d=makeDetails('v34712PrecisionTimeline','타임라인 · 정밀 조합 딜 흐름');grid.appendChild(d);d.addEventListener('toggle',()=>{if(!d.open)return;try{const s=root.__precisionSnapshot;if(!s)throw new Error('정밀에서 캐릭터와 조합을 먼저 선택해 주세요.');const sim=syntheticFromSnapshot(s);renderPanel(d,sim,'정밀 엔진의 확정 총딜·일반/스킬/버스트 비중을 그대로 보존해 시간축에 시각화합니다. 그래프가 딜을 다시 계산하지 않습니다.');}catch(e){d.querySelector('.v34712-timeline-body').innerHTML=`<div class="v34712-error">${esc(e.message)}</div>`;}});return d;}
function soloDetails(){let d=$('v34712SoloTimeline');if(d)return d;const result=$('soloRaidResult');if(!result)return null;d=makeDetails('v34712SoloTimeline','타임라인 · 레이드 적용 딜 흐름');result.insertAdjacentElement('afterend',d);d.addEventListener('toggle',()=>{if(!d.open)return;try{if(typeof soloRaidRefresh==='function')soloRaidRefresh();let r=null;try{r=(typeof __soloRaidLastResult!=='undefined')?__soloRaidLastResult:null;}catch(_){}if(!r?.snapshot)throw new Error('솔로레이드 결과를 먼저 계산해 주세요.');const sim=syntheticFromSnapshot(r.snapshot,r.combo?.total,r.boss?.duration||r.snapshot.duration);renderPanel(d,sim,'레이드 탭의 확정 보스 환산 총딜을 사용합니다. 절대 발생 시각이 없는 저지·엄폐·이탈 손실은 기존 계산 규칙대로 합산값만 반영하며 임의 시각을 만들지 않습니다.');}catch(e){d.querySelector('.v34712-timeline-body').innerHTML=`<div class="v34712-error">${esc(e.message)}</div>`;}});return d;}
function battleDetails(){let d=$('v34712BattleTimeline');if(d)return d;const mount=$('nikkeTimelineResult');if(!mount)return null;d=makeDetails('v34712BattleTimeline','캐릭터별 타임라인 · 전투 시뮬레이션');mount.insertAdjacentElement('afterend',d);d.addEventListener('toggle',()=>{if(!d.open)return;try{const sim=root.NIKKESinglePartyTimelineLastResult;if(!sim?.members?.length)throw new Error('전투 시뮬레이션을 먼저 실행해 주세요.');renderPanel(d,sim,'전투 시뮬레이터가 계산한 동일 샘플과 멤버별 총딜을 직접 그립니다.');}catch(e){d.querySelector('.v34712-timeline-body').innerHTML=`<div class="v34712-error">${esc(e.message)}</div>`;}});return d;}
function fiveDeckResult(){return root.NIKKEV34710LastResult||root.NIKKEV3420LastResult||root.NIKKEV340LastResult||root.NIKKEKitAwareLastResult||null;}
function teamFingerprint(team,boss,index){const ids=[team?.roles?.b1?.id,team?.roles?.b2?.id,...arr(team?.roles?.b3).map(x=>x?.id),team?.roles?.flex?.id].filter(Boolean);return `${boss?.id||boss?.name||'boss'}|${index}|${ids.join('|')}|${root.NIKKE_V26_ROSTER_API?.load?.()?.updatedAt||''}`;}
function simulateTeam(team,result,index){
  const api=root.NIKKESinglePartyTimelineSimulator;if(!api?.simulate)throw new Error('전투 타임라인 엔진을 찾지 못했습니다.');const key=teamFingerprint(team,result?.boss,index);if(cache.has(key))return cache.get(key);
  let sim=team?.simulation;if(!sim?.samples?.length){const party=typeof api.candidateToRoles==='function'?api.candidateToRoles(team):team?.roles;if(!party)throw new Error('덱 역할 정보를 읽지 못했습니다.');sim=api.simulate({boss:result?.boss||team?.simulation?.boss,party,duration:180,step:.15,compact:false});}
  return cachePut(key,sim);
}
function decorateFiveDeck(){
  const result=fiveDeckResult(),mount=$('nikke-kit-results');if(!result?.teams?.length||!mount)return false;const cards=[...mount.querySelectorAll('.nikke-kit-team')].slice(0,result.teams.length);if(cards.length<Math.min(5,result.teams.length))return false;
  cards.forEach((card,index)=>{if(card.querySelector('.v34712-five-deck-timeline'))return;const d=makeDetails(`v34712FiveDeckTimeline${index+1}`,`타임라인 · 덱 ${index+1} 캐릭터별 딜`);d.classList.add('v34712-five-deck-timeline');card.appendChild(d);d.addEventListener('toggle',()=>{const key=teamFingerprint(result.teams[index],result?.boss,index);d.dataset.v34712CacheKey=key;if(!d.open){cacheDrop(key);return;}const body=d.querySelector('.v34712-timeline-body');try{body.innerHTML='<div class="v34712-loading">이 덱의 180초 캐릭터별 타임라인을 계산 중…</div>';root.setTimeout(()=>{try{const sim=simulateTeam(result.teams[index],result,index);renderPanel(d,sim,`덱 ${index+1} · 180초 실제 타임라인. 오른쪽은 캐릭터별 총딜이며 이름이 3글자를 넘으면 3글자+…로 축약합니다.`);}catch(e){body.innerHTML=`<div class="v34712-error">${esc(e.message)}</div>`;}},0);}catch(e){body.innerHTML=`<div class="v34712-error">${esc(e.message)}</div>`;}});});return true;
}
function updateBrand(){try{root.document.title=root.document.title.replace(/V34\.7\.11/g,'V34.7.12');for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent=String(node.textContent||'').replace(/V34\.7\.11/g,'V34.7.12');}catch(_){}}
function verify(){const result={version:VERSION,precision:!!$('v34712PrecisionTimeline'),soloRaid:!!$('v34712SoloTimeline'),battle:!!$('v34712BattleTimeline'),fiveDeckPanels:root.document.querySelectorAll('.v34712-five-deck-timeline').length,compactNameProbe:compactName('신데렐라'),damageProbe:compactDamage(1200000000),dynamicFiveDeck:true,usesExistingDamageResults:true};result.pass=result.precision&&result.soloRaid&&result.battle&&result.compactNameProbe==='신데렐...'&&result.damageProbe.startsWith('12');root.NIKKEV34712TimelineVerification=Object.freeze(result);return result;}
function install(){ensureStyle();precisionDetails();soloDetails();battleDetails();decorateFiveDeck();updateBrand();verify();}
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
[50,250,1000,3000,6000,10000,16000,23000].forEach(ms=>root.setTimeout(()=>{updateBrand();verify();},ms));
const observer=new MutationObserver(()=>{precisionDetails();soloDetails();battleDetails();decorateFiveDeck();verify();});observer.observe(root.document.documentElement,{subtree:true,childList:true});
root.addEventListener?.('resize',()=>{for(const d of root.document.querySelectorAll('.v34712-timeline-details[open]')){const canvas=d.querySelector('canvas'),key=d.dataset.v34712CacheKey;if(canvas&&key&&cache.has(key)){const sim=cache.get(key);drawTrace(canvas,sim,normalizeTrace(sim));}}});
root.addEventListener?.('nikke:v26-roster-updated',()=>cache.clear());
root.NIKKEV34712UnifiedTimeline=Object.freeze({version:VERSION,compactName,compactDamage,normalizeTrace,traceAudit,syntheticFromSnapshot,simulateTeam,decorateFiveDeck,verify,cacheSize:()=>cache.size,clearCache:()=>cache.clear()});
})(window);
