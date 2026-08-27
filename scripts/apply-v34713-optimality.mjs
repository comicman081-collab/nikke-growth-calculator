#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.13';
const PRIOR='34.7.12';
const RECOVERY_ID='v34710-owned-roster-repair';
const RUNTIME_ID='v34713-optimality-runtime';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

function replaceEmbeddedBlock(html,id,block){
  const pattern=new RegExp(`<script id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(pattern)||[];
  assert.equal(matches.length,1,`expected exactly one ${id} block, found ${matches.length}`);
  return html.replace(pattern,block.trim());
}

function integrateRuntime(html,runtime){
  assert.doesNotMatch(runtime,/<\/script>/i,'runtime must be safe for inline embedding');
  const block=`<script id="${RUNTIME_ID}">\n${runtime.trim()}\n</script>`;
  const pattern=new RegExp(`<script id=["']${RUNTIME_ID}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(pattern)||[];
  assert.ok(matches.length<=1,`duplicate ${RUNTIME_ID} blocks: ${matches.length}`);
  if(matches.length===1)return html.replace(pattern,block);
  assert.match(html,/<\/body>/i,'closing body');
  return html.replace(/<\/body>/i,`${block}\n</body>`);
}

const recovery=read('scripts/v34710-owned-roster-repair.js').trim();
const runtime=read('scripts/v34713-optimality-runtime.js');
assert.match(recovery,new RegExp(`^<script id=["']${RECOVERY_ID}["']>`),'recovery runtime marker');
assert.match(runtime,/const VERSION='34\.7\.13';/,'optimality runtime version');

let html=read('index.html');
html=replaceEmbeddedBlock(html,RECOVERY_ID,recovery);
html=integrateRuntime(html,runtime);
html=html.replaceAll(PRIOR,VERSION);
// The legacy V34 installer keeps rebinding the visible button for 24 seconds.
// Keep that compatibility binder, but prevent it from reverting the current
// release label after the V34.7.13 runtime has installed.
html=html.replaceAll('현재 로스터로 V34 통합 5팀 계산','현재 로스터로 V34.7.13 5팀 계산');
html=html.replaceAll('V34 통합 5덱 계산 중…','V34.7.13 5덱 계산 중…');
html=html.replaceAll(
  '마코토·유키코는 한 세트로 처리하며 S40 작열에서 모더니아는 오프버스트만 허용합니다.',
  '마코토·유키코는 한 세트로 처리하며 모든 솔로레이드에서 모더니아는 FLEX 오프버스트만 허용합니다.'
);
assert.equal((html.match(new RegExp(`id=["']${RECOVERY_ID}["']`,'g'))||[]).length,1,'one recovery runtime');
assert.equal((html.match(new RegExp(`id=["']${RUNTIME_ID}["']`,'g'))||[]).length,1,'one optimality runtime');
assert.match(html,/if \(profile\.id === 'modernia'\) return false;/,'global Modernia active-B3 ban');
assert.match(html,/솔로레이드 모더니아 전역 오프버스트 규칙 위반/,'global Modernia result audit');
assert.match(html,/모든 솔로레이드에서 모더니아는 FLEX 오프버스트만 허용합니다/,'global Modernia UI guidance');
write('index.html',html);
write('public/index.html',html);

let bridge=read('functions/api/blabla/sync.js');
bridge=bridge.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
write('functions/api/blabla/sync.js',bridge);

for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name),source=read(relative);
  write(relative,source.replaceAll(PRIOR,VERSION).replaceAll('34\\.7\\.12','34\\.7\\.13'));
}

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts||={};
pkg.scripts['apply:v34713']='node scripts/apply-v34713-optimality.mjs';
const browserTests=[
  'node tests/verify-five-deck-optimality-v34713.mjs',
  'node tests/verify-five-deck-performance-v34713.mjs'
];
for(const command of browserTests){
  if(fs.existsSync(path.join(ROOT,command.split(' ').at(-1)))&&!String(pkg.scripts['check:browser']||'').includes(command)){
    pkg.scripts['check:browser']=`${pkg.scripts['check:browser']||''} && ${command}`.replace(/^\s*&&\s*/, '');
  }
}
write('package.json',JSON.stringify(pkg,null,2)+'\n');

const lock=JSON.parse(read('package-lock.json'));
lock.version=VERSION;
if(lock.packages?.[''])lock.packages[''].version=VERSION;
write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

for(const relative of ['README.md','GITHUB_DEPLOY_STATUS.md']){
  if(!fs.existsSync(path.join(ROOT,relative)))continue;
  write(relative,read(relative).replaceAll(PRIOR,VERSION));
}

assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.equal(JSON.parse(read('package-lock.json')).version,VERSION,'lock version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.13';/,'bridge version');

console.log(`V${VERSION} timeline-first five-deck optimality, global Modernia off-burst rule, and runtime integration: PASS`);
