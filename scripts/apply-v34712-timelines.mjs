import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='34.7.12';
const PRIOR_VERSION='34.7.11';
const SCRIPT_ID='v34712-unified-damage-timeline';
const LINKED_SCRIPT_ID='v34711-linked-roster-refresh';
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const write=(relative,value)=>fs.writeFileSync(path.join(ROOT,relative),value,'utf8');

function integrateRuntime(html,runtime){
  const open=`<script id="${SCRIPT_ID}">`;
  const block=`${open}\n${runtime.trim()}\n</script>`;
  const existing=new RegExp(`<script id=["']${SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(existing)||[];
  assert.ok(matches.length<=1,`duplicate ${SCRIPT_ID} blocks: ${matches.length}`);
  if(matches.length===1)html=html.replace(existing,block);
  else{
    assert.match(html,/<\/body>/i,'index.html closing body');
    html=html.replace(/<\/body>/i,`${block}\n</body>`);
  }
  return html;
}

function integrateLinkedRosterRuntime(html,script){
  const existing=new RegExp(`<script id=["']${LINKED_SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>`,'g');
  const matches=html.match(existing)||[];
  assert.equal(matches.length,1,`expected one ${LINKED_SCRIPT_ID} block, found ${matches.length}`);
  assert.match(script,new RegExp(`^<script id=["']${LINKED_SCRIPT_ID}["']>`),`source ${LINKED_SCRIPT_ID} block`);
  assert.match(script,/nikke:blabla-refresh-request/,'APK native refresh request listener');
  assert.match(script,/acknowledgeBlaBlaRefresh/,'APK refresh acknowledgement bridge');
  return html.replace(existing,script.trim());
}

function exposeSoloRaidResult(html){
  if(!html.includes('let __soloRaidLastResult=null;window.NIKKESoloRaidLastResult=null;')){
    html=html.replace(
      'let __soloRaidLastResult=null;',
      'let __soloRaidLastResult=null;window.NIKKESoloRaidLastResult=null;'
    );
  }
  if(!html.includes('window.NIKKESoloRaidLastResult=__soloRaidLastResult;')){
    html=html.replace(
      "__soloRaidLastResult=soloRaidCompute(s,b);$('soloRaidResult').innerHTML=soloRaidResultHtml(__soloRaidLastResult);",
      "__soloRaidLastResult=soloRaidCompute(s,b);window.NIKKESoloRaidLastResult=__soloRaidLastResult;$('soloRaidResult').innerHTML=soloRaidResultHtml(__soloRaidLastResult);"
    );
  }
  assert.match(html,/window\.NIKKESoloRaidLastResult=__soloRaidLastResult;/,'Solo Raid result exposure');
  return html;
}

function preserveCubeRuntimeFields(html){
  const legacyCubes="try{if(typeof cubes!=='undefined'&&cubes)Object.assign(cubes,NEW_CUBES);}catch(_){}";
  const mergedCubes="try{if(typeof cubes!=='undefined'&&cubes)for(const [id,patch] of Object.entries(NEW_CUBES))cubes[id]={...(cubes[id]||{}),...patch};}catch(_){}";
  const legacyValues="try{const values=root.NIKKE_V26_DATA?.cubes?.values;if(values)Object.assign(values,NEW_CUBES);}catch(_){}";
  const mergedValues="try{const values=root.NIKKE_V26_DATA?.cubes?.values;if(values)for(const [id,patch] of Object.entries(NEW_CUBES))values[id]={...(values[id]||{}),...patch};}catch(_){}";
  html=html.replace(legacyCubes,mergedCubes).replace(legacyValues,mergedValues);
  assert.ok(html.includes(mergedCubes),'precision cube definitions preserve native numeric fields');
  assert.ok(html.includes(mergedValues),'shared cube definitions preserve native numeric fields');
  assert.ok(!html.includes(legacyCubes),'destructive precision cube replacement removed');
  assert.ok(!html.includes(legacyValues),'destructive shared cube replacement removed');
  return html;
}

function preserveTemplateNormalDamage(html){
  const legacy='normal:Number(wp.normal||0)';
  const fixed='normal:Number(wp.normal||templateEntry(def.template)?.skillProfile?.normal||0)';
  html=html.replace(legacy,fixed);
  assert.ok(html.includes(fixed),'template-based characters preserve normal-attack coefficients');
  assert.ok(!html.includes(legacy),'zero-normal template fallback removed');
  return html;
}

function restrictLinkedRosterToCalculableIntersection(html){
  const legacyEligible=`function calculationEligibleIds(){
  const registered=appRegisteredIds(),owned=[];
  try{for(const row of api()?.getOwned?.()||[])if(registered.has(String(row?.id||'')))owned.push(row);}catch(_){}
  try{const final=root.NIKKEV340FinalOptimizer;if(final?.profilesFor){const profiles=arr(final.profilesFor(root,owned).profiles);return new Set(profiles.map(row=>String(row?.id||'')).filter(id=>registered.has(id)));}}catch(_){}
  return new Set(appCatalog().filter(row=>row.calculationSupported!==false).map(row=>String(row.id)));
}`;
  const fixedEligible=`function calculationEligibleIds(){
  const registered=appRegisteredIds(),catalog=appCatalog();
  try{const final=root.NIKKEV340FinalOptimizer;if(final?.profilesFor){const seed=catalog.map(row=>({...row,owned:true,level:400,limitBreak:3,coreLevel:0,skills:{skill1:10,skill2:10,burst:10}}));const profiles=arr(final.profilesFor(root,seed).profiles);const ids=new Set(profiles.map(row=>String(row?.id||'')).filter(id=>registered.has(id)));if(ids.size)return ids;}}catch(_){}
  return new Set(catalog.filter(row=>row.calculationSupported===true).map(row=>String(row.id)));
}`;
  if(!html.includes(fixedEligible)){
    const eligibleBlock=/function calculationEligibleIds\(\)\{[\s\S]*?\r?\n\}/;
    assert.match(html,eligibleBlock,'linked-roster calculation eligibility block');
    html=html.replace(eligibleBlock,fixedEligible);
  }
  assert.ok(html.includes(fixedEligible),'calculation eligibility is derived from the complete app registry, not the imported roster');

  const registeredFiltered="function filteredRoster(roster){const kept=[],excluded=[];for(const row of arr(roster?.characters)){const id=mappedId(row);if(id)kept.push(row);else excluded.push(row);}return{roster:{...roster,characters:kept},kept,excluded};}";
  assert.ok(html.includes(registeredFiltered),'all current app-registered rows reach My Roster while external-only rows remain excluded');

  const legacyOptimizer="const ids=appRegisteredIds(),owned=arr(out.owned).filter(row=>ids.has(String(row?.id||row)));";
  const fixedOptimizer="const ids=calculationEligibleIds(),owned=arr(out.owned).filter(row=>ids.has(String(row?.id||row)));";
  html=html.replace(legacyOptimizer,fixedOptimizer);
  assert.ok(html.includes(fixedOptimizer),'Precision and five-deck owned candidates use the calculation intersection');
  assert.match(html,/function storeSnapshot\(roster,source,optionOverride\)\{[^}]*characters:clone\(arr\(roster\?\.characters\)\)/s,'all external rows remain in the raw linked snapshot');
  return html;
}

const runtime=read('scripts/v34712-timeline-runtime.js');
const linkedRuntime=read('scripts/v34711-linked-roster-refresh.js');
assert.match(runtime,/const VERSION='34\.7\.12';/,'timeline runtime version');
assert.doesNotMatch(runtime,/<\/script>/i,'runtime must be safe to embed inline');

let html=read('index.html');
html=integrateLinkedRosterRuntime(html,linkedRuntime);
html=exposeSoloRaidResult(html);
html=preserveCubeRuntimeFields(html);
html=preserveTemplateNormalDamage(html);
html=restrictLinkedRosterToCalculableIntersection(html);
html=integrateRuntime(html,runtime).replaceAll(PRIOR_VERSION,VERSION);
assert.equal((html.match(new RegExp(`id=["']${SCRIPT_ID}["']`,'g'))||[]).length,1,'one integrated runtime');
assert.match(html,/window\.NIKKESoloRaidLastResult=__soloRaidLastResult;/);
write('index.html',html);
write('public/index.html',html);

for(const relative of ['functions/api/blabla/sync.js']){
  write(relative,read(relative).replaceAll(PRIOR_VERSION,VERSION));
}

for(const name of fs.readdirSync(path.join(ROOT,'tests'))){
  if(!name.endsWith('.mjs'))continue;
  const relative=path.join('tests',name);
  write(relative,read(relative).replaceAll(PRIOR_VERSION,VERSION).replaceAll('34\\.7\\.11','34\\.7\\.12'));
}

const pkgPath='package.json';
const pkg=JSON.parse(read(pkgPath));
pkg.version=VERSION;
pkg.scripts=pkg.scripts||{};
pkg.scripts['apply:v34712']='node scripts/apply-v34712-timelines.mjs';
const staticGate='node tests/verify-damage-surfaces-v34712.mjs';
if(!String(pkg.scripts.check||'').includes(staticGate))pkg.scripts.check=`${pkg.scripts.check||''} && ${staticGate}`.replace(/^\s*&&\s*/, '');
write(pkgPath,JSON.stringify(pkg,null,2)+'\n');

const lockPath='package-lock.json';
const lock=JSON.parse(read(lockPath));
lock.version=VERSION;
if(lock.packages?.[''])lock.packages[''].version=VERSION;
write(lockPath,JSON.stringify(lock,null,2)+'\n');

assert.equal(read('index.html'),read('public/index.html'),'root/public HTML mirror');
assert.equal(JSON.parse(read('package.json')).version,VERSION,'package version');
assert.equal(JSON.parse(read('package-lock.json')).version,VERSION,'lock version');
assert.match(read('functions/api/blabla/sync.js'),/const VERSION = '34\.7\.12';/,'BlaBla bridge version');
assert.match(read('package.json'),/verify-damage-surfaces-v34712\.mjs/,'static damage surface gate');

console.log('V34.7.12 unified timelines, linked-roster calculation intersection, version bump, and regression gates integrated: PASS');
