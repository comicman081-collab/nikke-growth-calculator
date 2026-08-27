import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const lock=JSON.parse(fs.readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
const worker=fs.readFileSync(new URL('../functions/api/blabla/sync.js',import.meta.url),'utf8');

assert.equal(html,publicHtml,'root/public HTML mirror');
assert.equal(pkg.version,'34.7.10','package version');
assert.equal(lock.version,'34.7.10','lockfile version');
assert.equal(lock.packages?.['']?.version,'34.7.10','lockfile root package version');
assert.match(worker,/const VERSION = '34\.7\.10';/,'Worker bridge version');
assert.match(html,/V34\.7\.10/,'visible V34.7.10 marker');
assert.equal((html.match(/id="v34710-owned-roster-repair"/g)||[]).length,1,'one V34.7.10 runtime');
assert.match(html,/function dynamicCatalogRows\(api\)/,'dynamic catalog wrapper');
assert.match(html,/for\(const row of arr\(api\?\.catalog\?\.\(\)\)\)put\(row\)/,'dynamic API catalog consumed');
assert.match(html,/for\(const \[id,value\] of Object\.entries\(characters\)\)put\(/,'stored supplemental fallback retained');
assert.match(html,/__v34710DynamicOwned:true/,'dynamic owned wrapper marker');
assert.match(html,/function ownedRows\(\)\{installDynamicOwnedApi\(\)/,'all consumers install dynamic wrapper');
assert.match(html,/allowCubeDuplicates:true/,'imported cube assignments are preserved');
assert.match(html,/defaultCubeCapacity:assignedCubeCapacity\(\)/,'cube capacity derived from actual linked assignments');
assert.match(html,/async function fillMissing\(/,'bounded missing-team repair');
assert.match(html,/if\(ids\.length&&unique\.size!==ids\.length\)/,'duplicate warning only when members exist');
assert.match(html,/완료 · 연동 \$\{diagnostics\.receivedCount\}명 \/ 보유 저장 \$\{diagnostics\.ownedCount\}명 \/ 계산 프로필/,'truthful final counts');
assert.match(html,/실제 역할 부족:/,'real shortage reports role counts');
assert.doesNotMatch(html,/optimizer status insufficientRoster \/ team count 0 \/ slot count 0 \/ duplicate members/,'misleading zero-team error removed');

const match=html.match(/<script id="v34710-owned-roster-repair">([\s\S]*?)<\/script>/);
assert.ok(match,'V34.7.10 runtime body');
const rows=Array.from({length:186},(_,index)=>({id:`row${index}`,name:`Row ${index}`,calculationSupported:index<107,rosterOnly:index>=107}));
// Reproduce the V34.7.10 failure: the inherited wrapper returns only the built-in 107 rows
// even though catalog() and the central document both contain all 186 linked characters.
const characters=Object.fromEntries(rows.map((row,index)=>[row.id,{id:row.id,owned:true,level:400+index%51,skills:{skill1:10,skill2:10,burst:10},cubeId:'none',overload:{atk:index%7}}]));
const inherited={
  load(){return {schemaVersion:1,characters};},
  save(value){return value;},
  catalog(){return rows;},
  aggregate(row){return row.overload||{};},
  getOwned(){return rows.slice(0,107).map(row=>({...row,...characters[row.id]}));},
  getRosterCounts(){return {registered:107,owned:107};},
};
const context=vm.createContext({
  console,JSON,Object,Array,Number,String,Math,Set,Map,Date,performance:{now:()=>0},
  NIKKE_V26_ROSTER_API:inherited,
  NIKKE_V26_API:{roster:inherited},
  document:{title:'',readyState:'complete',getElementById(){return null;},querySelectorAll(){return [];},createElement(){return {className:'',innerHTML:'',prepend(){}};}},
  navigator:{deviceMemory:4},innerWidth:412,scrollY:0,
  setTimeout(){return 0;},addEventListener(){},scrollTo(){},
});
vm.runInContext(match[1],context,{filename:'v34710-owned-roster-repair.js'});
const fixed=context.NIKKE_V26_ROSTER_API;
assert.equal(fixed.__v34710DynamicOwned,true,'wrapper installed');
assert.equal(fixed.catalog().length,186,'catalog remains complete');
assert.equal(fixed.getOwned().length,186,'all linked owned rows restored');
assert.equal(JSON.stringify(fixed.getRosterCounts()),JSON.stringify({registered:186,owned:186,calculationSupported:107,rosterOnly:79}));
assert.equal(context.NIKKE_V26_API.roster,fixed,'shared API reference updated');

console.log('V34.7.10 dynamic 186-row roster retention + truthful five-deck repair static verification: PASS');
