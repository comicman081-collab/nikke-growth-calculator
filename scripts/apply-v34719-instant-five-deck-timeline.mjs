import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FROM='34.7.18';
const TO='34.7.19';
const SCRIPT_ID='v34712-unified-damage-timeline';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

const runtime=read('scripts/v34712-timeline-runtime.js');
assert.match(runtime,/const VERSION='34\.7\.19';/,'instant timeline runtime version');
assert.match(runtime,/d\.open=true;renderFiveDeckPanel/,'five-deck panels auto-open and render');
assert.doesNotMatch(runtime,/<\/script>/i,'runtime must remain safe for inline embedding');

function integrate(html){
  const block=`<script id="${SCRIPT_ID}">\n${runtime.trim()}\n</script>`;
  const existing=new RegExp(`<script id=["']${SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  assert.equal((html.match(existing)||[]).length,1,`one ${SCRIPT_ID} block`);
  return html.replace(existing,block).replaceAll(FROM,TO);
}

const rootHtml=integrate(read('index.html'));
write('index.html',rootHtml);
write('public/index.html',rootHtml);

for(const relative of ['functions/api/blabla/sync.js','README.md','GITHUB_DEPLOY_STATUS.md']){
  const file=path.join(ROOT,relative);if(fs.existsSync(file))write(relative,read(relative).replaceAll(FROM,TO));
}
for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name),value=read(relative).replaceAll(FROM,TO).replaceAll('34\\.7\\.18','34\\.7\\.19');
  write(relative,value);
}
for(const name of ['v34710-owned-roster-repair.js','v34711-linked-roster-refresh.js','v34713-optimality-runtime.js']){
  const relative=path.join('scripts',name);write(relative,read(relative).replaceAll(FROM,TO));
}

const pkg=JSON.parse(read('package.json'));pkg.version=TO;pkg.scripts=pkg.scripts||{};pkg.scripts['apply:v34719']='node scripts/apply-v34719-instant-five-deck-timeline.mjs';write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));lock.version=TO;if(lock.packages?.[''])lock.packages[''].version=TO;write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal((read('index.html').match(new RegExp(`id=["']${SCRIPT_ID}["']`,'g'))||[]).length,1,'one embedded timeline runtime');
assert.match(read('index.html'),/const VERSION='34\.7\.19';/,'embedded instant timeline runtime');
assert.doesNotMatch(read('index.html'),/>계산 전<\/b><\/summary><div class="v34712-timeline-body"><div class="v34712-loading">이 덱의/,'five-deck result is not click-gated');
console.log('V34.7.19 instant five-deck damage/timeline integration: PASS');
