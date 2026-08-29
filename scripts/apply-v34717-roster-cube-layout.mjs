#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.17';
const OLD_VERSION='34.7.16';
const STYLE_ID='v34717-roster-cube-layout-style';
const RUNTIME_ID='v34717-roster-cube-layout';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

const STYLE=`<style id="${STYLE_ID}">
/* V34.7.17 · 카드 자체 폭에 맞춘 큐브 폼과 흔들림 없는 읽기 전용 로스터 행 */
.v32-bulk-cube-control{container-type:inline-size;max-width:100%;min-width:0;overflow:hidden}
.v32-bulk-cube-grid{width:100%;min-width:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(132px,max-content)!important}
.v32-bulk-cube-grid>*{min-width:0;max-width:100%}
.v32-bulk-cube-grid label,.v32-bulk-cube-grid select{width:100%;min-width:0;max-width:100%}
.v32-bulk-cube-grid button{width:100%;min-width:0;max-width:100%;padding-inline:11px!important;white-space:nowrap!important}
@container (max-width:540px){
  .v32-bulk-cube-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .v32-bulk-cube-grid button{grid-column:1/-1}
}
@media(max-width:760px){
  .v32-bulk-cube-grid{grid-template-columns:1fr!important}
  .v32-bulk-cube-grid button{grid-column:1}
}
#v26RosterList.v26-roster-list{scrollbar-gutter:stable;overflow-anchor:none}
#v26RosterList .v26-roster-row,
#v26RosterList .v26-roster-row.is-owned,
#v26RosterList .v26-roster-row.is-selected{min-height:64px;background:#fff!important;border-color:rgba(16,24,39,.16)!important;box-shadow:none!important;transform:none!important;transition:none!important}
#v26RosterList .v26-roster-pick,
#v26RosterList .v26-roster-pick:hover,
#v26RosterList .v26-roster-pick:active{display:grid!important;grid-template-columns:minmax(110px,max-content) max-content minmax(0,1fr) max-content;align-items:center;gap:4px;width:100%!important;min-width:0;min-height:44px;padding:7px 11px!important;border:1px solid rgba(16,24,39,.12)!important;border-radius:10px!important;background:#fff!important;color:var(--ink)!important;box-shadow:none!important;cursor:default!important;pointer-events:none;transform:none!important;transition:none!important;text-align:left}
#v26RosterList .v26-roster-pick strong{display:flex!important;align-items:center;gap:3px;min-width:0;overflow:hidden;white-space:nowrap;flex-wrap:nowrap!important}
#v26RosterList .v26-roster-pick strong .v3475-roster-only-badge{flex:0 0 auto}
#v26RosterList .v26-roster-pick small,
#v26RosterList .v26-roster-pick>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v26RosterList .v26-roster-pick small,#v26RosterList .v26-roster-pick>span{display:block;margin:0!important}
#v26RosterList .v26-roster-pick>.v3466-s40-fit{display:inline-flex!important;width:auto!important;max-width:100%;margin:0!important;overflow:hidden;text-overflow:ellipsis}
#v26RosterList .v26-owned-check{cursor:pointer;transform:none!important}
@media(max-width:760px){#v26RosterList .v26-roster-pick{grid-template-columns:minmax(0,1fr) max-content!important}#v26RosterList .v26-roster-pick small,#v26RosterList .v26-roster-pick>span:not(.v3466-s40-fit){grid-column:1/-1}}
</style>`;

const RUNTIME=`<script id="${RUNTIME_ID}">
(function installV34717RosterCubeLayout(root){
  'use strict';
  function verify(){
    const controls=[...root.document.querySelectorAll('.v32-bulk-cube-control')];
    const rows=[...root.document.querySelectorAll('#v26RosterList .v26-roster-row')];
    const overflow=controls.flatMap(control=>[...control.querySelectorAll('select,button')].filter(node=>node.getBoundingClientRect().right>control.getBoundingClientRect().right+.75));
    const result={version:'34.7.17',cubeControls:controls.length,cubeOverflow:overflow.length,rosterRows:rows.length,interactiveInfoRows:root.document.querySelectorAll('#v26RosterList .v26-roster-pick[data-roster-action]').length,sharedRosterApi:!!root.NIKKE_V26_ROSTER_API,sharedGrowthContext:!!root.__v26TeamGrowthContext,pass:overflow.length===0&&root.document.querySelectorAll('#v26RosterList .v26-roster-pick[data-roster-action]').length===0};
    root.NIKKEV34717RosterCubeLayoutVerification=Object.freeze(result);
    return result;
  }
  function mount(){verify();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  root.addEventListener?.('nikke:v26-roster-updated',()=>root.requestAnimationFrame?.(mount));
  root.NIKKEV34717RosterCubeLayout=Object.freeze({version:'34.7.17',verify,sharedStatePreserved:true});
})(window);
</script>`;

function replaceBlock(html,tag,id,block){
  const re=new RegExp(`<${tag} id=["']${id}["'][^>]*>[\\s\\S]*?<\\/${tag}>`,'g');
  const matches=html.match(re)||[];
  assert.ok(matches.length<=1,`duplicate ${id}`);
  if(matches.length)return html.replace(re,block);
  return tag==='style'?html.replace(/<\/head>/i,`${block}\n</head>`):html.replace(/<\/body>/i,`${block}\n</body>`);
}

let html=read('index.html').replaceAll(OLD_VERSION,VERSION).replaceAll('V34.7.16','V34.7.17');

const listStart='    list.innerHTML = entries.length ? entries.map((entry) => {';
assert.ok(html.includes(listStart),'roster list rendering anchor');
html=html.replace(listStart,`    const listFingerprint = entries.map((entry) => { const character = documentValue.characters[entry.id]; return entry.id + ':' + (character?.owned ? '1' : '0') + ':' + totalSummary(character || {}); }).join('|');\n    if (list.dataset.v34717Fingerprint === listFingerprint) return;\n    const listScrollTop = list.scrollTop;\n${listStart}`);

const listEnd="    }).join('') : '<div class=\"v26-roster-empty\">검색·보유 조건에 맞는 캐릭터가 없어요.</div>';";
assert.ok(html.includes(listEnd),'roster list completion anchor');
html=html.replace(listEnd,`${listEnd}\n    list.dataset.v34717Fingerprint = listFingerprint;\n    list.scrollTop = listScrollTop;`);

const pickPattern=/<button type="button" class="v26-roster-pick" data-roster-action="select" data-character-id="([^"]+)">([\s\S]*?)<\/button>/g;
const pickMatches=html.match(pickPattern)||[];
assert.equal(pickMatches.length,1,'one roster interactive information template');
html=html.replace(pickPattern,'<div class="v26-roster-pick" data-character-id="$1" aria-readonly="true">$2</div>');

html=replaceBlock(html,'style',STYLE_ID,STYLE);
html=replaceBlock(html,'script',RUNTIME_ID,RUNTIME);
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>니케 성장 계산기 V34.7.17 · 로스터 무진동·큐브 박스 정렬</title>');
write('index.html',html);
write('public/index.html',html);

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts['apply:v34717']='node scripts/apply-v34717-roster-cube-layout.mjs';
const gate='node tests/verify-v34717-roster-cube-layout.mjs';
if(!String(pkg.scripts.check||'').includes(gate))pkg.scripts.check=`${pkg.scripts.check} && ${gate}`;
const browserGate='node tests/verify-v34717-roster-cube-layout-browser.mjs';
if(!String(pkg.scripts['check:browser']||'').includes(browserGate))pkg.scripts['check:browser']=`${pkg.scripts['check:browser']} && ${browserGate}`;
write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));
lock.version=VERSION;if(lock.packages?.[''])lock.packages[''].version=VERSION;
write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

let worker=read('functions/api/blabla/sync.js');
worker=worker.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
write('functions/api/blabla/sync.js',worker);
for(const relative of ['scripts/v34710-owned-roster-repair.js','scripts/v34711-linked-roster-refresh.js','scripts/v34712-timeline-runtime.js','scripts/v34713-optimality-runtime.js']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll(OLD_VERSION,VERSION));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll(OLD_VERSION,VERSION).replaceAll('34\\.7\\.16','34\\.7\\.17'));
}
for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(fs.existsSync(path.join(ROOT,relative)))write(relative,read(relative).replaceAll(OLD_VERSION,VERSION));
}

assert.equal(read('index.html'),read('public/index.html'),'root/public mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.17';/,'bridge version');
console.log('V34.7.17 roster stability and cube layout repair: PASS');
