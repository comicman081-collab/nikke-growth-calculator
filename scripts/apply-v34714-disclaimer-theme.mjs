#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.14';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');
const SCRIPT_ID='v34714-disclaimer-and-surface-theme';
const STYLE_ID='v34714-disclaimer-and-surface-theme-style';

const LEGAL=`<div class="legal-disclaimer" id="legalDisclaimer" role="note"><strong>비공식 팬 제작 분석·시뮬레이션 도구</strong><br>본 도구는 SHIFT UP, Level Infinite 및 게임·콜라보 콘텐츠의 각 권리자와 제휴·후원·승인 관계가 없습니다. 「승리의 여신: 니케」와 관련된 게임명·캐릭터명·상표·이미지·기타 원저작물에 관한 권리는 각 권리자에게 귀속됩니다. 표기는 식별과 호환성 안내를 위한 것이며, 권리 또는 공식성을 주장하지 않습니다. 이용자는 원 게임·플랫폼·외부 연동 서비스의 약관과 권리를 준수해야 하며, 권리 침해 우려 또는 정정 요청이 있으면 프로젝트 배포처를 통해 알려 주세요. 이 안내는 개별 사안에 대한 법률 자문이나 이용 허락을 뜻하지 않습니다.</div>`;

const STYLE=`<style id="${STYLE_ID}">
/* V34.7.14 · 계산 화면의 안내·입력 컨트롤 색상/활자 체계 통일. 기존 다크 헤더와 고밀도 카드 구조는 보존한다. */
:root{--v34714-surface:#f7f9fe;--v34714-surface-alt:#edf3fb;--v34714-field:#ffffff;--v34714-ink:#17233a;--v34714-muted:#52637a;--v34714-line:rgba(49,89,201,.20);--v34714-info:#e4f4ff;--v34714-info-line:#78c9ef}
.calculation-disclaimer{grid-column:1/-1;display:flex;align-items:flex-start;gap:6px;order:999;margin:5px 0 0;padding:6px 9px;border:1px solid rgba(120,201,239,.72);border-left:3px solid #55c8ef;border-radius:8px;background:rgba(228,244,255,.82);color:#52637a;font-size:10px;font-weight:600;line-height:1.45;box-shadow:none}
.calculation-disclaimer::before{content:'ⓘ';flex:0 0 auto;color:#087da8;font-size:12px;font-weight:850;line-height:1.3}.calculation-disclaimer strong{color:#35627a;font-weight:800}.calculation-disclaimer small{display:inline;margin:0;color:#66788d;font-size:10px;font-weight:550}.calculation-disclaimer small::before{content:' '}
/* Precision / timeline / 5-deck use the same input and information-surface grammar. */
#precision .card,#battleTimelineSim .timeline-config-card,#battleTimelineSim .timeline-result-card,#v26Optimizer .card,#nikke-kit-aware-optimizer-panel{color:var(--v34714-ink)}
#precision label,#battleTimelineSim label,#v26Optimizer label,#nikke-kit-aware-optimizer-panel label{color:#294664;font-size:12px;font-weight:850;letter-spacing:-.01em}
#precision input,#precision select,#battleTimelineSim input,#battleTimelineSim select,#v26Optimizer input,#v26Optimizer select,#nikke-kit-aware-optimizer-panel input,#nikke-kit-aware-optimizer-panel select{border-color:var(--v34714-line)!important;background:var(--v34714-field)!important;color:var(--v34714-ink)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)}
#precision input:focus,#precision select:focus,#battleTimelineSim input:focus,#battleTimelineSim select:focus,#v26Optimizer input:focus,#v26Optimizer select:focus,#nikke-kit-aware-optimizer-panel input:focus,#nikke-kit-aware-optimizer-panel select:focus{outline:3px solid rgba(98,215,255,.28)!important;outline-offset:1px;border-color:#49bfe9!important}
#battleTimelineSim .timeline-config-card,#v26Optimizer .v26-optimizer-summary>div,#v26Optimizer .v26-optimizer-team,#nikke-kit-aware-optimizer-panel .nikke-kit-team{border-color:var(--v34714-line)!important;background:var(--v34714-surface)!important}
#battleTimelineSim .timeline-controls label,#battleTimelineSim .timeline-picker-field>label,#v26Optimizer .v26-optimizer-team p,#nikke-kit-aware-optimizer-panel .nikke-kit-team p{color:#294664!important}
#battleTimelineSim .timeline-team-picker .panel-sub,#v26Optimizer .v26-optimizer-actions span{color:var(--v34714-muted)!important}
#nikke-kit-aware-optimizer-panel{background:var(--v34714-surface)!important;border-color:var(--v34714-line)!important}
#nikke-kit-aware-optimizer-panel .nikke-kit-head strong{color:var(--v34714-ink)!important}#nikke-kit-aware-optimizer-panel .nikke-kit-head small{color:var(--v34714-muted)!important}
#nikke-kit-aware-optimizer-panel #nikke-kit-status{background:var(--v34714-info)!important;border-color:var(--v34714-info-line)!important;color:var(--v34714-ink)!important}
.legal-disclaimer{max-width:980px!important;margin:14px auto 0!important;padding:13px 16px!important;border-color:rgba(130,170,255,.32)!important;background:rgba(8,15,30,.88)!important;color:#d7e4f5!important;font-size:11px!important;line-height:1.68!important;text-align:left!important}.legal-disclaimer strong{color:#fff!important}
@media(max-width:620px){.calculation-disclaimer{gap:5px;margin-top:4px;padding:5px 7px;font-size:9px;border-radius:7px}.calculation-disclaimer::before{font-size:11px}.calculation-disclaimer small{font-size:9px}.legal-disclaimer{margin-top:12px!important;padding:12px!important;font-size:10px!important;line-height:1.6!important}}
</style>`;

const RUNTIME=`<script id="${SCRIPT_ID}">
(function installV34714DisclaimerTheme(root){
  'use strict';
  const NOTICE_SELECTOR='[data-v34714-calculation-notice]';
  const noticeHtml=()=>'<strong>계산 결과 안내</strong><span>표시되는 딜량·DPS·추천 편성·타임라인은 입력값, 보스 패턴 및 모델 가정에 따른 <b>시뮬레이션 추정값</b>입니다. 실제 전투 결과는 조작, 명중·크리티컬, 패턴 대응, 서버·게임 업데이트 및 파티 운용에 따라 달라질 수 있습니다.<small>공식 기록·실전 측정값과 함께 참고용으로 사용해 주세요.</small></span>';
  function addNotice(grid){
    if(!grid||grid.querySelector(NOTICE_SELECTOR))return false;
    const node=root.document.createElement('aside');
    node.className='calculation-disclaimer';node.dataset.v34714CalculationNotice='1';node.setAttribute('role','note');node.setAttribute('aria-label','계산 결과 안내');node.innerHTML=noticeHtml();
    grid.appendChild(node);return true;
  }
  function mount(){
    addNotice(root.document.querySelector('#precision>.grid'));
    addNotice(root.document.querySelector('#soloRaid>.grid'));
    addNotice(root.document.querySelector('#battleTimelineSim>.grid'));
    const panel=root.document.getElementById('nikke-kit-aware-optimizer-panel');
    if(panel&&!panel.querySelector(NOTICE_SELECTOR)){
      const node=root.document.createElement('aside');node.className='calculation-disclaimer';node.dataset.v34714CalculationNotice='1';node.setAttribute('role','note');node.setAttribute('aria-label','5덱 자동 구성 결과 안내');node.innerHTML=noticeHtml();
      panel.appendChild(node);
    }
    addNotice(root.document.querySelector('#v26Optimizer>.grid'));
  }
  function observe(){
    mount();
    const observer=new root.MutationObserver(()=>mount());
    observer.observe(root.document.documentElement,{childList:true,subtree:true});
  }
  function releaseBrand(){
    root.document.title='니케 성장 계산기 V34.7.14 · 시뮬레이션 안내·표기 통일';
    for(const node of root.document.querySelectorAll('.footer,.footer-version'))node.textContent='Nikke Damage Growth Calculator · V34.7.14 · 2026-08-29';
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  releaseBrand();root.setTimeout(releaseBrand,120);root.setTimeout(releaseBrand,900);
  root.NIKKEV34714DisclaimerTheme=Object.freeze({version:'34.7.14',mount,noticeText:'시뮬레이션 추정값'});
})(window);
</script>`;

function replaceOrAppend(html,id,block){
  const re=new RegExp(`<${id==='style'?'style':'script'} id=["']${id==='style'?STYLE_ID:SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/${id==='style'?'style':'script'}>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id} block`);
  if(matches.length)return html.replace(re,block);
  return html.replace(/<\/body>/i,`${block}\n</body>`);
}

let html=read('index.html');
// This is a release-level presentation/notice update: keep the existing engine
// identifiers (v34713) stable, but report one coherent build version everywhere.
html=html.replaceAll('34.7.13',VERSION);
html=html.replace(/<div class="legal-disclaimer" id="legalDisclaimer"[^>]*>[\s\S]*?<\/div>/,LEGAL);
assert.match(html,/비공식 팬 제작 분석·시뮬레이션 도구/,'legal disclaimer title');
assert.match(html,/법률 자문이나 이용 허락을 뜻하지 않습니다/,'legal disclaimer non-advice limit');
html=replaceOrAppend(html,'style',STYLE);
html=replaceOrAppend(html,'script',RUNTIME);
html=html.replace('니케 성장 계산기 V34.7.13 · 실연동 보유 로스터 5덱 복구','니케 성장 계산기 V34.7.14 · 시뮬레이션 안내·표기 통일');
html=html.replaceAll('Nikke Damage Growth Calculator · V34.7.13 · 2026-08-27','Nikke Damage Growth Calculator · V34.7.14 · 2026-08-29');
write('index.html',html);
write('public/index.html',html);

const pkg=JSON.parse(read('package.json'));pkg.version=VERSION;pkg.scripts['apply:v34714']='node scripts/apply-v34714-disclaimer-theme.mjs';
const staticGate='node tests/verify-v34714-disclaimer-theme.mjs';
if(!String(pkg.scripts.check||'').includes(staticGate))pkg.scripts.check=`${pkg.scripts.check} && ${staticGate}`;
write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));lock.version=VERSION;if(lock.packages?.[''])lock.packages[''].version=VERSION;write('package-lock.json',JSON.stringify(lock,null,2)+'\n');
let worker=read('functions/api/blabla/sync.js');worker=worker.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);write('functions/api/blabla/sync.js',worker);
for(const relative of ['scripts/v34710-owned-roster-repair.js','scripts/v34711-linked-roster-refresh.js','scripts/v34712-timeline-runtime.js','scripts/v34713-optimality-runtime.js']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll('34.7.13',VERSION));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll('34.7.13',VERSION).replaceAll('34\\.7\\.13','34\\.7\\.14'));
}
for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(!fs.existsSync(path.join(ROOT,relative)))continue;
  let text=read(relative);text=text.replace('V34.7.13 Unified Damage Timeline & Linked Roster Refresh','V34.7.14 Simulation Notice & Surface Theme');text=text.replace('V34.7.13 Solo Raid Five-Deck MVP','V34.7.14 Simulation Notice & Surface Theme');write(relative,text);
}
assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.14';/,'bridge version');
console.log('V34.7.14 legal disclaimer, simulation notices, and calculation-surface theme: PASS');
