import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FROM='34.7.19';
const TO='34.7.20';
const LINKED_SCRIPT_ID='v34711-linked-roster-refresh';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

const linkedSource=read('scripts/v34711-linked-roster-refresh.js').trim();
const linkedRuntimeMatch=linkedSource.match(/^<script id=["']v34711-linked-roster-refresh["']>\s*([\s\S]*?)\s*<\/script>$/);
assert.ok(linkedRuntimeMatch,'linked refresh source must have one outer script wrapper');
const linkedRuntime=linkedRuntimeMatch[1];
assert.match(linkedRuntime,/const VERSION='34\.7\.20';/,'linked refresh runtime version');
assert.match(linkedRuntime,/const PUBLIC_WEB_BLABLA_SYNC_ENABLED=false;/,'shared web pause flag');
assert.match(linkedRuntime,/function sharedWebSyncPaused|const sharedWebSyncPaused/,'shared web pause guard');

function pauseLegacyDeployRuntime(html){
  if(html.includes('PUBLIC_WEB_BLABLA_IMPORT_ENABLED'))return html;
  const replaceOnce=(from,to,label)=>{
    assert.ok(html.includes(from),`legacy deploy runtime ${label} anchor`);
    html=html.replace(from,to);
  };
  replaceOnce(
    "const VERSION='34.7.5';",
    "const VERSION='34.7.5';\nconst PUBLIC_WEB_BLABLA_IMPORT_ENABLED=false;\nconst publicImportPaused=()=>isDeployedWeb()&&!PUBLIC_WEB_BLABLA_IMPORT_ENABLED;\nconst publicImportPausedMessage='공유 웹 버전의 BlaBlaLink 공개 URL 동기화는 현재 일시 중지되어 있습니다. 기존에 저장된 로스터는 계속 사용할 수 있습니다.';",
    'switch'
  );
  replaceOnce(
    "function enabled(){const raw=read(ENABLED_KEY);return raw===''?true:raw!=='0';}",
    "function enabled(){if(publicImportPaused())return false;const raw=read(ENABLED_KEY);return raw===''?true:raw!=='0';}",
    'enabled guard'
  );
  replaceOnce(
    "const toggle=$('v3474AutoSyncToggle');if(toggle){toggle.checked=enabled();toggle.addEventListener('change',()=>{write(ENABLED_KEY,toggle.checked?'1':'0');status(toggle.checked?'배포판 자동 동기화를 켰습니다.':'배포판 자동 동기화를 껐습니다.');});}",
    "const toggle=$('v3474AutoSyncToggle');if(toggle){toggle.checked=enabled();toggle.disabled=publicImportPaused();if(publicImportPaused())toggle.title=publicImportPausedMessage;toggle.addEventListener('change',()=>{if(publicImportPaused()){toggle.checked=false;status(publicImportPausedMessage);return;}write(ENABLED_KEY,toggle.checked?'1':'0');status(toggle.checked?'배포판 자동 동기화를 켰습니다.':'배포판 자동 동기화를 껐습니다.');});}",
    'toggle guard'
  );
  replaceOnce(
    "if(!isDeployedWeb())return null;forceSameOrigin();",
    "if(!isDeployedWeb())return null;if(publicImportPaused()){state.bridgeReady=false;status(publicImportPausedMessage);return{ok:true,enabled:false,configured:false,code:'BLABLA_PUBLIC_SYNC_DISABLED'};}forceSameOrigin();",
    'probe guard'
  );
  replaceOnce(
    "if(state.syncing)return state.lastResult;if(!isDeployedWeb())throw new Error('배포판 웹 자동연동 경로가 아닙니다.');forceSameOrigin();prefill();",
    "if(publicImportPaused())throw new Error(publicImportPausedMessage);if(state.syncing)return state.lastResult;if(!isDeployedWeb())throw new Error('배포판 웹 자동연동 경로가 아닙니다.');forceSameOrigin();prefill();",
    'sync guard'
  );
  replaceOnce(
    "button.dataset.v3472Capture='1';button.dataset.v3474Deploy='1';button.disabled=false;button.textContent='공개 URL 동기화';button.title='배포 도메인의 동일 출처 BlaBla 브리지에 자동 연결합니다.';",
    "button.dataset.v3472Capture='1';button.dataset.v3474Deploy='1';button.disabled=publicImportPaused();button.textContent=publicImportPaused()?'공유 웹판 연동 일시 중지':'공개 URL 동기화';button.title=publicImportPaused()?publicImportPausedMessage:'배포 도메인의 동일 출처 BlaBla 브리지에 자동 연결합니다.';",
    'button guard'
  );
  replaceOnce(
    "if(state.autoAttempted||!isDeployedWeb()||!enabled())return;",
    "if(publicImportPaused()||state.autoAttempted||!isDeployedWeb()||!enabled())return;",
    'auto guard'
  );
  return html;
}

function embedLinkedRuntime(html){
  html=pauseLegacyDeployRuntime(html);
  const block=`<script id="${LINKED_SCRIPT_ID}">\n${linkedRuntime}\n</script>`;
  // The optional second closing tag repairs an earlier malformed nested embed.
  const existing=new RegExp(`<script id=["']${LINKED_SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>(?:\\s*<\\/script>)?`,'g');
  assert.equal((html.match(existing)||[]).length,1,`one ${LINKED_SCRIPT_ID} block`);
  return html.replace(existing,block).replaceAll(FROM,TO);
}

const html=embedLinkedRuntime(read('index.html'));
write('index.html',html);
write('public/index.html',html);

for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  const file=path.join(ROOT,relative);
  if(fs.existsSync(file))write(relative,read(relative).replaceAll(FROM,TO));
}
for(const relative of ['v34710-owned-roster-repair.js','v34711-linked-roster-refresh.js','v34712-timeline-runtime.js','v34713-optimality-runtime.js']){
  write(path.join('scripts',relative),read(path.join('scripts',relative)).replaceAll(FROM,TO));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll(FROM,TO).replaceAll('34\\.7\\.19','34\\.7\\.20'));
}

const pkg=JSON.parse(read('package.json'));
pkg.version=TO;
pkg.scripts={...pkg.scripts,'apply:v34720':'node scripts/apply-v34720-public-blabla-pause.mjs'};
write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));
lock.version=TO;
if(lock.packages?.[''])lock.packages[''].version=TO;
write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal(JSON.parse(read('package.json')).version,TO,'package version');
assert.equal(JSON.parse(read('package-lock.json')).version,TO,'lock version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.20';/,'Worker version');
assert.match(read('functions/api/blabla/sync.js'),/BLABLA_PUBLIC_SYNC_ENABLED/,'Worker re-open switch');
assert.match(read('index.html'),/PUBLIC_WEB_BLABLA_SYNC_ENABLED=false/,'web pause flag embedded');
console.log(`V${TO} shared-web BlaBla URL sync pause: PASS`);
