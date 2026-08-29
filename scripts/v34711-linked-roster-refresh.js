<script id="v34711-linked-roster-refresh">
(function installV34711LinkedRosterRefresh(root){
'use strict';
const VERSION='34.7.18';
const RAW_BASE='nikke_v34711_linked_roster_snapshot_v1';
const REFRESH_BASE='nikke_v34711_linked_roster_refresh_v1';
const PROFILE_KEY='nikke_v3474_deploy_blablalink_profile';
const SERVER_KEY='nikke_v3474_deploy_blablalink_server';
const SUPPLEMENTAL_BASE='nikke_v3475_roster_supplemental_catalog_v1';
const KST=9*60*60*1000;
const state=root.__NIKKE_V34711_LINKED_REFRESH_STATE__||{installed:false,wrapping:false,timer:0,syncing:false,lastResult:null,lastError:'',rehydrated:false};
root.__NIKKE_V34711_LINKED_REFRESH_STATE__=state;
const nativeRequestIds=root.__NIKKE_V34712_NATIVE_REFRESH_IDS__||new Set();
root.__NIKKE_V34712_NATIVE_REFRESH_IDS__=nativeRequestIds;
const $=id=>root.document?.getElementById(id);
const arr=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const scoped=base=>{try{return root.NIKKE_V26_ACCOUNT_API?.scopeKey?.(base)||base;}catch(_){return base;}};
const read=(base,fallback='')=>{try{return root.localStorage?.getItem(scoped(base))??fallback;}catch(_){return fallback;}};
const write=(base,value)=>{try{root.localStorage?.setItem(scoped(base),String(value));return true;}catch(_){return false;}};
const readJson=(base,fallback)=>{try{const value=JSON.parse(read(base,''));return value&&typeof value==='object'?value:fallback;}catch(_){return fallback;}};
const writeJson=(base,value)=>write(base,JSON.stringify(value));
function api(){return root.NIKKE_V26_ROSTER_API||null;}
function appCatalog(){try{return arr(api()?.catalog?.()).filter(row=>String(row?.source||'')==='builtin');}catch(_){return[];}}
function appRegisteredIds(){return new Set(appCatalog().map(row=>String(row.id)).filter(Boolean));}
function nameCodeMap(){
  const ids=appRegisteredIds(),map=new Map();
  try{for(const [code,id] of Object.entries(root.NIKKEV3476NameCodeMapping?.map||{}))if(ids.has(String(id)))map.set(String(code),String(id));}catch(_){}
  try{for(const [code,id] of Object.entries(root.NIKKE_V3477_FAVORITE_NAMECODE_TO_APP_ID||{}))if(ids.has(String(id)))map.set(String(code),String(id));}catch(_){}
  try{const data=root.NIKKE_V26_DATA||{};for(const group of [data.burst1?.characters,data.burst2?.characters,data.burst3?.characters])for(const row of arr(group)){const id=String(row?.id||''),code=String(row?.nameCode??row?.name_code??row?.characterNameCode??'').replace(/\D/g,'');if(id&&code&&ids.has(id))map.set(code,id);}}catch(_){}
  return map;
}
function favoriteTidMap(){const ids=appRegisteredIds(),out=new Map();try{for(const [tid,id] of Object.entries(root.NIKKE_V3477_FAVORITE_TID_TO_APP_ID||{}))if(ids.has(String(id)))out.set(String(tid),String(id));}catch(_){}return out;}
function mappedId(row){const ids=appRegisteredIds(),fav=favoriteTidMap().get(String(row?.favoriteItemTid??''));if(fav&&ids.has(fav))return fav;const code=String(row?.nameCode??'').replace(/\D/g,'');const id=nameCodeMap().get(code)||'';return id&&ids.has(id)?id:'';}
function calculationEligibleIds(){
  const registered=appRegisteredIds(),catalog=appCatalog();
  try{const final=root.NIKKEV340FinalOptimizer;if(final?.profilesFor){const seed=catalog.map(row=>({...row,owned:true,level:400,limitBreak:3,coreLevel:0,skills:{skill1:10,skill2:10,burst:10}}));const profiles=arr(final.profilesFor(root,seed).profiles);const ids=new Set(profiles.map(row=>String(row?.id||'')).filter(id=>registered.has(id)));if(ids.size)return ids;}}catch(_){}
  return new Set(catalog.filter(row=>row.calculationSupported===true).map(row=>String(row.id)));
}
function purgeExternalSupplementals(){try{root.localStorage?.removeItem(scoped(SUPPLEMENTAL_BASE));}catch(_){}try{root.localStorage?.removeItem(SUPPLEMENTAL_BASE);}catch(_){}try{root.NIKKE_V3475_ROSTER_SUPPLEMENTAL_CATALOG=[];}catch(_){}try{api()?.load?.();}catch(_){}}
function reconstructLegacySnapshot(){
  const existing=readJson(RAW_BASE,null);if(existing?.characters?.length)return existing;const roster=api()?.load?.()?.characters||{};let meta={};try{const base='nikke_v34610_external_roster_meta_v1',key=scoped(base);meta=JSON.parse(root.localStorage?.getItem(key)||root.localStorage?.getItem(base)||'{}')||{};}catch(_){}
  const rows=[];for(const [id,m] of Object.entries(meta||{})){if(id==='_meta'||!m||typeof m!=='object')continue;const r=roster[id];if(!r?.owned||!m.nameCode)continue;rows.push({nameCode:finite(m.nameCode),lv:finite(r.level),combat:finite(m.combat),arenaCombat:finite(m.arenaCombat),grade:finite(r.limitBreak),core:finite(r.coreLevel),skill1Lv:finite(r.skills?.skill1),skill2Lv:finite(r.skills?.skill2),ultiSkillLv:finite(r.skills?.burst),attractiveLv:finite(r.bond),favoriteItemTid:finite(m.favoriteItemTid),favoriteItemLv:finite(m.favoriteItemLevel),harmonyCubeTid:finite(m.cubeTid),harmonyCubeLv:finite(m.cubeLevel),gear:clone(m.gear||{})});}
  if(!rows.length)return null;const snap={version:VERSION,provider:'legacy-v34710-migration',source:String(meta?._meta?.source||'legacy linked roster'),nickname:String(meta?._meta?.nickname||''),observedAt:String(meta?._meta?.observedAt||new Date().toISOString()),savedAt:new Date().toISOString(),characters:rows,optionOverride:null};writeJson(RAW_BASE,snap);return snap;
}
function storeSnapshot(roster,source,optionOverride){const snap={version:VERSION,provider:/BlaBla/i.test(String(source||''))?'blabla':/ENIKK/i.test(String(source||''))?'enikk':'external',source:String(source||''),nickname:String(roster?.nickname||''),observedAt:String(roster?.observedAt||new Date().toISOString()),savedAt:new Date().toISOString(),characters:clone(arr(roster?.characters)),optionOverride:clone(optionOverride||null)};writeJson(RAW_BASE,snap);return snap;}
function filteredRoster(roster){const kept=[],excluded=[];for(const row of arr(roster?.characters)){const id=mappedId(row);if(id)kept.push(row);else excluded.push(row);}return{roster:{...roster,characters:kept},kept,excluded};}
function renderPolicySummary(rawCount,imported,excluded,reason){const host=$('v34610SyncResult');if(!host)return;const registered=appCatalog().length,eligible=calculationEligibleIds().size;host.innerHTML=`<div class="ext-status"><b>연동 원본 ${rawCount}명 저장</b> · 현재 앱 등록 ${registered}명 · 현재 계산 프로필 ${eligible}명<br>앱 등록 캐릭터 매핑 ${imported}명 · 앱 미등록 ${excluded}명은 원본 스냅샷에만 보관 · ${esc(reason||'동기화')}<br><b>정밀·내 로스터·시뮬레이션·5덱은 현재 앱 등록/계산 프로필만 동적으로 사용합니다.</b></div>`;}
function installImporterWrapper(){
  const ext=root.NIKKEV34610External;if(!ext?.importExternalRoster||ext.__v34711FilteredImporter)return false;const original=ext.importExternalRoster.bind(ext);
  ext.importExternalRoster=async function v34711ImportExternalRoster(roster,source,optionOverride=null){storeSnapshot(roster,source,optionOverride);rememberInputs();purgeExternalSupplementals();const filtered=filteredRoster(roster),out=await original(filtered.roster,source,optionOverride);purgeExternalSupplementals();const excluded=filtered.excluded.map(row=>String(row?.nameCode||'')).filter(Boolean);renderPolicySummary(arr(roster?.characters).length,out.imported,excluded.length,'최신 연동');try{root.dispatchEvent(new CustomEvent('nikke:v34711-linked-snapshot-updated',{detail:{received:arr(roster?.characters).length,imported:out.imported,excluded:excluded.length,source}}));}catch(_){}return{...out,received:arr(roster?.characters).length,excludedCount:excluded.length,unmatched:excluded,snapshotStored:true};};
  ext.__v34711FilteredImporter=true;ext.__v34711OriginalImporter=original;return true;
}
async function rehydrateSnapshot(reason='앱 등록 캐릭터 재수화'){
  if(state.rehydrated&&reason==='부팅 재수화')return null;const snap=readJson(RAW_BASE,null);if(!snap?.characters?.length)return null;if(!installImporterWrapper())return null;const filtered=filteredRoster({nickname:snap.nickname,observedAt:snap.observedAt,characters:snap.characters});const ext=root.NIKKEV34610External,original=ext.__v34711OriginalImporter;if(!original)return null;purgeExternalSupplementals();const out=await original(filtered.roster,`${snap.source||snap.provider||'linked snapshot'} · V34.7.18 rehydrate`,snap.optionOverride||null);purgeExternalSupplementals();state.rehydrated=true;renderPolicySummary(snap.characters.length,out.imported,filtered.excluded.length,reason);try{root.dispatchEvent(new CustomEvent('nikke:v26-roster-updated',{detail:{source:'v34711-linked-snapshot-rehydrate',count:out.imported,updatedAt:new Date().toISOString()}}));}catch(_){}return{...out,received:snap.characters.length,excludedCount:filtered.excluded.length};
}
function installCalculationFilter(){const final=root.NIKKEV340FinalOptimizer;if(!final?.resolveV3413RunRosterInput||final.__v34711AppRegistryFilter)return false;const previous=final.resolveV3413RunRosterInput.bind(final);const wrapped=Object.assign({},final,{resolveV3413RunRosterInput:function(){const out=previous();if(out?.mode!=='owned')return out;const ids=calculationEligibleIds(),owned=arr(out.owned).filter(row=>ids.has(String(row?.id||row)));return{...out,owned,label:`${out.label||'보유 로스터'} · 계산 가능 ${owned.length}명`};},__v34711AppRegistryFilter:true,__v34711PreviousResolver:previous});root.NIKKEV340FinalOptimizer=wrapped;return true;}
function refreshState(){return readJson(REFRESH_BASE,{slots:{},lastSuccess:'',lastReason:'',lastAttempt:'',lastError:''});}
function saveRefreshState(value){writeJson(REFRESH_BASE,value);return value;}
function kstParts(ms=Date.now()){const d=new Date(ms+KST);return{y:d.getUTCFullYear(),m:d.getUTCMonth(),d:d.getUTCDate(),day:d.getUTCDay(),h:d.getUTCHours(),min:d.getUTCMinutes()};}
function kstEpoch(y,m,d,h){return Date.UTC(y,m,d,h-9,0,0,0);}
function thursdayForWeek(ms=Date.now()){const p=kstParts(ms),delta=4-p.day,date=new Date(Date.UTC(p.y,p.m,p.d+delta));return{y:date.getUTCFullYear(),m:date.getUTCMonth(),d:date.getUTCDate()};}
function slotInfo(epoch,hour){const p=kstParts(epoch);return{id:`${p.y}-${String(p.m+1).padStart(2,'0')}-${String(p.d).padStart(2,'0')}-${String(hour).padStart(2,'0')}`,epoch,hour};}
function latestDueSlot(now=Date.now()){const thu=thursdayForWeek(now),s11=kstEpoch(thu.y,thu.m,thu.d,11),s19=kstEpoch(thu.y,thu.m,thu.d,19);if(now>=s19)return slotInfo(s19,19);if(now>=s11)return slotInfo(s11,11);const prev=new Date(Date.UTC(thu.y,thu.m,thu.d-7));return slotInfo(kstEpoch(prev.getUTCFullYear(),prev.getUTCMonth(),prev.getUTCDate(),19),19);}
function nextSlot(now=Date.now()){const thu=thursdayForWeek(now),s11=kstEpoch(thu.y,thu.m,thu.d,11),s19=kstEpoch(thu.y,thu.m,thu.d,19);if(now<s11)return slotInfo(s11,11);if(now<s19)return slotInfo(s19,19);const next=new Date(Date.UTC(thu.y,thu.m,thu.d+7));return slotInfo(kstEpoch(next.getUTCFullYear(),next.getUTCMonth(),next.getUTCDate(),11),11);}
function formatKst(epoch){const p=kstParts(epoch);return `${p.y}.${String(p.m+1).padStart(2,'0')}.${String(p.d).padStart(2,'0')} ${String(p.h).padStart(2,'0')}:${String(p.min).padStart(2,'0')} KST`;}
function rememberInputs(){const profile=String($('v34610BlaUrl')?.value||read(PROFILE_KEY,'')).trim(),server=String($('v34610BlaServer')?.value||read(SERVER_KEY,'')).trim().toUpperCase();if(profile)write(PROFILE_KEY,profile);if(server)write(SERVER_KEY,server);return{profile,server};}
function prefill(){const input=$('v34610BlaUrl'),server=$('v34610BlaServer');if(input&&!String(input.value||'').trim())input.value=read(PROFILE_KEY,'');const saved=read(SERVER_KEY,'');if(server&&saved&&[...server.options].some(o=>String(o.value).toUpperCase()===saved))server.value=saved;}
function hasProfile(){return !!String($('v34610BlaUrl')?.value||read(PROFILE_KEY,'')).trim();}
async function nativeOrWebSync(reason){
  if(state.syncing)return state.lastResult;prefill();rememberInputs();if(!hasProfile())throw new Error('BlaBla 공개 프로필 URL을 먼저 한 번 저장해 주세요.');state.syncing=true;const rs=refreshState();rs.lastAttempt=new Date().toISOString();rs.lastReason=reason;saveRefreshState(rs);updateRefreshPanel(`동기화 중 · ${reason}`);
  try{let result;if(root.AndroidNative&&root.NIKKEV3473ApkNativeSync?.sync)result=await root.NIKKEV3473ApkNativeSync.sync();else if(root.NIKKEV3474DeployAutoSync?.sync&&root.NIKKEV3474DeployAutoSync?.isDeployedWeb?.())result=await root.NIKKEV3474DeployAutoSync.sync({manual:true});else if(root.NIKKEV3472BlaPublicSync?.sync)result=await root.NIKKEV3472BlaPublicSync.sync();else throw new Error('BlaBla 동기화 모듈이 아직 준비되지 않았습니다.');const next=refreshState();next.lastSuccess=new Date().toISOString();next.lastReason=reason;next.lastError='';saveRefreshState(next);state.lastResult=result;state.lastError='';updateRefreshPanel(`완료 · ${reason}`);return result;}catch(error){const next=refreshState();next.lastError=String(error?.message||error);saveRefreshState(next);state.lastError=next.lastError;updateRefreshPanel(`실패 · ${next.lastError}`,true);throw error;}finally{state.syncing=false;scheduleTimer();}
}
function nativeScheduleAvailable(){return typeof root.AndroidNative?.acknowledgeBlaBlaRefresh==='function';}
function acknowledgeNativeRefresh(requestId,success,message){if(!requestId||!nativeScheduleAvailable())return;try{root.AndroidNative.acknowledgeBlaBlaRefresh(String(requestId),!!success,String(message||''));}catch(_){} }
async function handleNativeRefreshRequest(detail={}){
  const requestId=String(detail?.requestId||'').trim();if(!requestId||nativeRequestIds.has(requestId))return null;nativeRequestIds.add(requestId);
  try{const reason=detail?.reason==='manual'?'APK 수동 새로고침':'APK 목요일 자동 갱신',out=await nativeOrWebSync(reason);if(detail?.slotKey){const rs=refreshState();rs.slots={...(rs.slots||{}),[String(detail.slotKey)]:new Date().toISOString()};saveRefreshState(rs);}acknowledgeNativeRefresh(requestId,true,'BlaBla 연동 완료');return out;}
  catch(error){acknowledgeNativeRefresh(requestId,false,String(error?.message||error));throw error;}
}
function installNativeRefreshBridge(){
  if(state.nativeBound)return true;state.nativeBound=true;
  root.addEventListener?.('nikke:blabla-refresh-request',event=>{handleNativeRefreshRequest(event?.detail||{}).catch(()=>{});});
  const queued=arr(root.__NIKKE_ANDROID_BLABLA_REFRESH_QUEUE__).splice(0);for(const detail of queued)handleNativeRefreshRequest(detail).catch(()=>{});
  return true;
}
async function requestManualRefresh(){
  if(typeof root.AndroidNative?.requestBlaBlaRefreshNow==='function'){rememberInputs();root.AndroidNative.requestBlaBlaRefreshNow();updateRefreshPanel('APK 새로고침 요청 전달');return{queued:true,native:true};}
  return nativeOrWebSync('수동 새로고침');
}
async function runScheduledIfDue(){if(!hasProfile()||state.syncing)return null;const due=latestDueSlot(),rs=refreshState();if(rs.slots?.[due.id])return null;try{const out=await nativeOrWebSync(`목요일 ${due.hour===11?'오전 11시':'오후 7시'} 자동 갱신${Date.now()-due.epoch>30*60*1000?' · 지연 실행':''}`);const next=refreshState();next.slots={...(next.slots||{}),[due.id]:new Date().toISOString()};const keys=Object.keys(next.slots).sort().slice(-10);next.slots=Object.fromEntries(keys.map(key=>[key,next.slots[key]]));saveRefreshState(next);return out;}catch(_){return null;}}
function scheduleTimer(){if(state.timer)root.clearTimeout(state.timer);state.timer=0;if(nativeScheduleAvailable()){updateRefreshPanel();return;}const next=nextSlot(),wait=Math.max(1000,next.epoch-Date.now()+1500);state.timer=root.setTimeout(()=>{runScheduledIfDue().finally(scheduleTimer);},Math.min(wait,2147480000));updateRefreshPanel();}
function updateRefreshPanel(message='',error=false){const panel=$('v34711RefreshPanel');if(!panel)return;const rs=refreshState(),next=nextSlot(),registered=appCatalog().length,eligible=calculationEligibleIds().size,snap=readJson(RAW_BASE,null),raw=arr(snap?.characters).length;const status=$('v34711RefreshStatus');if(status){status.classList.toggle('error',!!error);status.innerHTML=`${message?`<b>${esc(message)}</b><br>`:''}연동 원본 ${raw||'-'}명 · 앱 등록 ${registered}명 · 현재 계산 프로필 ${eligible}명<br>마지막 성공 ${rs.lastSuccess?esc(new Date(rs.lastSuccess).toLocaleString('ko-KR')):'없음'} · 다음 자동 ${esc(formatKst(next.epoch))}`;}}
function installRefreshUi(){if($('v34711RefreshPanel'))return true;const official=$('v34610BlaOfficial'),form=official?.closest('.ext-form');if(!form)return false;const button=root.document.createElement('button');button.id='v34711RefreshNow';button.type='button';button.textContent='🔄 연동 데이터 새로고침';button.title='저장된 BlaBla 공개 링크로 즉시 최신 데이터를 다시 가져옵니다.';form.appendChild(button);const panel=root.document.createElement('div');panel.id='v34711RefreshPanel';panel.className='notice';panel.style.marginTop='10px';panel.innerHTML='<b>V34.7.18 연동 갱신</b> · 매주 목요일 11:00 / 19:00 KST 앱이 실행 중이면 자동 갱신하며, 꺼져 있던 경우 다음 실행 시 최신 미실행 슬롯을 즉시 보정합니다.<div id="v34711RefreshStatus" class="ext-status" style="margin-top:8px"></div>';form.insertAdjacentElement('afterend',panel);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();requestManualRefresh().catch(()=>{});});const input=$('v34610BlaUrl'),server=$('v34610BlaServer');for(const node of [input,server])node?.addEventListener('change',()=>{rememberInputs();scheduleTimer();});return true;}
function brand(){try{root.document.title='니케 성장 계산기 V34.7.18 · 동적 앱 등록 연산 · 주 2회 연동 갱신';for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent='Nikke Damage Growth Calculator · V34.7.18 · 2026-08-27';const button=$('nikke-kit-run');if(button&&!state.syncing)button.textContent='현재 앱 등록 로스터로 V34.7.18 5팀 계산';}catch(_){}}
function verify(){const registered=appCatalog().length,eligible=calculationEligibleIds().size,snap=readJson(RAW_BASE,null),result={version:VERSION,registered,calculationEligible:eligible,rawLinkedRows:arr(snap?.characters).length,hardcoded100:false,dynamicRegistration:true,manualRefresh:!!$('v34711RefreshNow'),weeklySlots:[11,19],timezone:'Asia/Seoul',importerWrapped:!!root.NIKKEV34610External?.__v34711FilteredImporter,optimizerFiltered:!!root.NIKKEV340FinalOptimizer?.__v34711AppRegistryFilter};result.pass=result.dynamicRegistration&&result.manualRefresh&&result.importerWrapped&&result.optimizerFiltered&&registered>=eligible;root.NIKKEV34711LinkedRosterRefreshVerification=Object.freeze(result);return result;}
async function install(){if(!root.NIKKE_V26_ROSTER_API||!root.NIKKEV34610External){root.setTimeout(install,100);return;}if(!readJson(RAW_BASE,null))reconstructLegacySnapshot();purgeExternalSupplementals();installImporterWrapper();installCalculationFilter();prefill();installNativeRefreshBridge();installRefreshUi();brand();if(!state.rehydrated)rehydrateSnapshot('부팅 재수화').catch(()=>{});scheduleTimer();verify();if(!state.installed){state.installed=true;root.addEventListener?.('focus',()=>{if(!nativeScheduleAvailable())runScheduledIfDue();});root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.visibilityState==='visible'&&!nativeScheduleAvailable())runScheduledIfDue();});root.addEventListener?.('nikke:v26-roster-updated',()=>{installCalculationFilter();updateRefreshPanel();});if(!nativeScheduleAvailable())root.setTimeout(runScheduledIfDue,1200);}}
root.NIKKEV34711LinkedRosterRefresh=Object.freeze({version:VERSION,appCatalog,appRegisteredIds,calculationEligibleIds,mappedId,storeSnapshot,rehydrateSnapshot,manualRefresh:requestManualRefresh,runScheduledIfDue,nextSlot,latestDueSlot,handleNativeRefreshRequest,verify,getSnapshot:()=>readJson(RAW_BASE,null),getRefreshState:refreshState});
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
[200,700,1500,3000,6000,10000,16000].forEach(ms=>root.setTimeout(()=>{installImporterWrapper();installCalculationFilter();installRefreshUi();brand();verify();},ms));
})(window);
</script>
