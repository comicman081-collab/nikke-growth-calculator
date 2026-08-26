#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ROOT='index.html';
const PUBLIC='public/index.html';
const VERSION='34.7.8';
let html=fs.readFileSync(ROOT,'utf8');
const must=(condition,label)=>{if(!condition)throw new Error(`V34.7.8 invariant failed: ${label}`);};
const replaceOnce=(source,from,to,label)=>{
  const count=source.split(from).length-1;
  must(count===1,`${label}: expected one anchor, found ${count}`);
  return source.replace(from,to);
};
const stripScript=(source,id)=>source.replace(new RegExp(`\\n?<script id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>\\n?`,'g'),'\n');

const oldOptimizerContext=`      const value = {
        id: row.id,
        name: row.name,
        role: row.role,
        statGrowthFactor: finite(row.statGrowthFactor, 1),
        olAtk: finite(row.overloadTotals?.atk, 0),
        olDefense: finite(row.overloadTotals?.defense, 0),
        cubeId: row.cubeId || 'none',
        cubeDefense: finite(global.NIKKE_V26_DATA?.cubes?.values?.[row.cubeId || 'none']?.defense, 0),
        limitBreak: finite(row.growth?.limitBreak, 0),
        coreLevel: finite(row.growth?.coreLevel, 0),
        level: finite(row.growth?.level, 400),
        r3LevelStats: row.r3LevelStats || null,
        skills: clone(row.growth?.skills || { skill1: 10, skill2: 10, burst: 10 })
      };`;
const newOptimizerContext=`      const growth = row.growth || {};
      const overload = clone(growth.overload || row.overloadTotals || {});
      const value = {
        id: row.id,
        name: row.name,
        role: row.role,
        source: 'v3478-optimizer-central-roster',
        statGrowthFactor: finite(row.statGrowthFactor, 1),
        olAtk: finite(overload.atk, 0),
        olDefense: finite(overload.defense, 0),
        overload,
        cubeId: row.cubeId || growth.cubeId || 'none',
        cubeDefense: finite(global.NIKKE_V26_DATA?.cubes?.values?.[row.cubeId || growth.cubeId || 'none']?.defense, 0),
        limitBreak: finite(growth.limitBreak, 0),
        coreLevel: finite(growth.coreLevel, 0),
        level: finite(growth.level, 400),
        r3LevelStats: row.r3LevelStats || null,
        skills: clone(growth.skills || { skill1: 10, skill2: 10, burst: 10 }),
        favoriteItemPhase: finite(growth.favoriteItemPhase, 0),
        equipmentAttack: growth.equipmentAttack != null ? finite(growth.equipmentAttack, 0) : null,
        equipmentHp: growth.equipmentHp != null ? finite(growth.equipmentHp, 0) : null,
        equipmentDefense: growth.equipmentDefense != null ? finite(growth.equipmentDefense, 0) : null,
        equipmentObservedSlots: finite(growth.equipmentObservedSlots, 0),
        manualRatio: finite(row.manualRatio ?? growth.manualRatio, 0),
        measuredCoeff: finite(row.measuredCoeff ?? growth.measuredCoeff, 1),
        buildFingerprint: row.buildFingerprint || null
      };`;
html=replaceOnce(html,oldOptimizerContext,newOptimizerContext,'5-deck optimizer growth context');

const oldImmediate=`for(const row of rows){const g=row?.growth||{},level=finite(g.level,200),ratio=finite(root.NIKKE_R3_DATA_API?.combatLevelRatio?.(row,level,400,'atk'),1),value={id:row.id,name:row.name,role:row.role,statGrowthFactor:ratio*(1+.02*(finite(g.limitBreak)+finite(g.coreLevel))),olAtk:finite(g.overload?.atk),olDefense:finite(g.overload?.defense),cubeId:row.cubeId||g.cubeId||'none',cubeDefense:finite(root.NIKKE_V26_DATA?.cubes?.values?.[row.cubeId||g.cubeId||'none']?.defense),limitBreak:finite(g.limitBreak),coreLevel:finite(g.coreLevel),level,skills:{...(g.skills||{})},favoriteItemPhase:finite(g.favoriteItemPhase,0),equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null,equipmentObservedSlots:finite(g.equipmentObservedSlots)};byId[row.id]=value;byName[row.name]=value;}`;
const newImmediate=`for(const row of rows){const g=row?.growth||{},level=finite(g.level,200),ratio=finite(root.NIKKE_R3_DATA_API?.combatLevelRatio?.(row,level,400,'atk'),1),value={id:row.id,name:row.name,role:row.role,source:'v3478-central-roster-immediate',statGrowthFactor:ratio*(1+.02*(finite(g.limitBreak)+finite(g.coreLevel))),olAtk:finite(g.overload?.atk),olDefense:finite(g.overload?.defense),overload:{...(g.overload||{})},cubeId:row.cubeId||g.cubeId||'none',cubeDefense:finite(root.NIKKE_V26_DATA?.cubes?.values?.[row.cubeId||g.cubeId||'none']?.defense),limitBreak:finite(g.limitBreak),coreLevel:finite(g.coreLevel),level,r3LevelStats:g.r3LevelStats||row.r3LevelStats||null,skills:{...(g.skills||{})},favoriteItemPhase:finite(g.favoriteItemPhase,0),equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null,equipmentHp:g.equipmentHp!=null?finite(g.equipmentHp):null,equipmentDefense:g.equipmentDefense!=null?finite(g.equipmentDefense):null,equipmentObservedSlots:finite(g.equipmentObservedSlots),manualRatio:finite(g.manualRatio),measuredCoeff:finite(g.measuredCoeff,1)};byId[row.id]=value;byName[row.name]=value;}`;
html=replaceOnce(html,oldImmediate,newImmediate,'immediate shared growth context');

// Every user-facing sync completion message must name all four consuming surfaces.
html=html
  .replaceAll('정밀/내 로스터/5덱 자동','정밀/내 로스터/시뮬레이션/5덱 자동')
  .replaceAll('정밀·내 로스터·5덱 자동','정밀·내 로스터·시뮬레이션·5덱 자동')
  .replaceAll('정밀·내 로스터·5덱 공통','정밀·내 로스터·시뮬레이션·5덱 공통');

html=stripScript(html,'v3478-blabla-propagation');
const diagnostics=`<script id="v3478-blabla-propagation">
(function installV3478BlaPropagationDiagnostics(root){
'use strict';
const VERSION='34.7.8';
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function profileFor(id){try{return root.NIKKEKitAwareOptimizer?.collectProfiles?.({},root)?.profiles?.find?.(row=>row.id===id)||null;}catch(_){return null;}}
function snapshot(id){
  const central=root.NIKKE_V26_ROSTER_API?.load?.()?.characters?.[id]||null;
  const profile=profileFor(id);
  const context=root.__v26TeamGrowthContext?.byId?.[id]||null;
  const precisionSelected=String(root.document?.getElementById('precisionChar')?.value||'');
  const precision=precisionSelected===id?{
    selected:precisionSelected,
    skills:{skill1:finite(root.document?.getElementById('precisionSkill1')?.value),skill2:finite(root.document?.getElementById('precisionSkill2')?.value),burst:finite(root.document?.getElementById('precisionBurstSkill')?.value)},
    cubeId:String(root.document?.getElementById('precisionCube')?.value||'none'),
    overload:{atk:finite(root.document?.getElementById('precisionAtk')?.value),element:finite(root.document?.getElementById('precisionElement')?.value),maxAmmo:finite(root.document?.getElementById('maxAmmo')?.value),critRate:finite(root.document?.getElementById('precisionCritRate')?.value),critDamage:finite(root.document?.getElementById('precisionCritDamage')?.value)}
  }:null;
  return clone({version:VERSION,id,central,profile,context,precision});
}
function verify(id){
  const state=snapshot(id),central=state.central,profile=state.profile,growth=profile?.growth||{},context=state.context||{};
  const checks={
    central:!!central,
    profile:!!profile,
    context:!!state.context,
    level:finite(central?.level,-1)===finite(growth.level,-2)&&finite(growth.level,-1)===finite(context.level,-2),
    limitBreak:finite(central?.limitBreak,-1)===finite(growth.limitBreak,-2)&&finite(growth.limitBreak,-1)===finite(context.limitBreak,-2),
    coreLevel:finite(central?.coreLevel,-1)===finite(growth.coreLevel,-2)&&finite(growth.coreLevel,-1)===finite(context.coreLevel,-2),
    skills:same(central?.skills,growth.skills)&&same(growth.skills,context.skills),
    favoriteItemPhase:finite(central?.favoriteItemPhase,-1)===finite(growth.favoriteItemPhase,-2)&&finite(growth.favoriteItemPhase,-1)===finite(context.favoriteItemPhase,-2),
    cubeId:String(central?.cubeId||'none')===String(profile?.cubeId||growth.cubeId||'none')&&String(profile?.cubeId||growth.cubeId||'none')===String(context.cubeId||'none'),
    equipmentAttack:finite(central?.equipmentAttack,-1)===finite(growth.equipmentAttack,-2)&&finite(growth.equipmentAttack,-1)===finite(context.equipmentAttack,-2),
    equipmentHp:finite(central?.equipmentHp,-1)===finite(growth.equipmentHp,-2)&&finite(growth.equipmentHp,-1)===finite(context.equipmentHp,-2),
    equipmentDefense:finite(central?.equipmentDefense,-1)===finite(growth.equipmentDefense,-2)&&finite(growth.equipmentDefense,-1)===finite(context.equipmentDefense,-2),
    equipmentObservedSlots:finite(central?.equipmentObservedSlots,-1)===finite(growth.equipmentObservedSlots,-2)&&finite(growth.equipmentObservedSlots,-1)===finite(context.equipmentObservedSlots,-2)
  };
  return Object.freeze({version:VERSION,id,checks:Object.freeze(checks),pass:Object.values(checks).every(Boolean),state});
}
root.NIKKEV3478BlaPropagation=Object.freeze({version:VERSION,snapshot,verify});
})(window);
</script>`;
html=replaceOnce(html,'</body>',`${diagnostics}\n</body>`,'propagation diagnostics insertion');

// Overall deployed build version. Feature API names intentionally retain their historical V3477 identifiers.
html=html.replaceAll('34.7.7','34.7.8').replaceAll('2026-08-26','2026-08-27');
html=html.replaceAll('ENIKK 애장품 21명 단계 계산','BlaBla 4화면 연산 동기화');

must((html.match(/id="v3478-blabla-propagation"/g)||[]).length===1,'one propagation diagnostic script');
must(html.includes("source: 'v3478-optimizer-central-roster'"),'optimizer source marker');
must(html.includes('equipmentHp: growth.equipmentHp != null'),'optimizer equipment HP');
must(html.includes('equipmentDefense: growth.equipmentDefense != null'),'optimizer equipment defense');
must(html.includes('favoriteItemPhase: finite(growth.favoriteItemPhase, 0)'),'optimizer favorite phase');
must(html.includes('정밀/내 로스터/시뮬레이션/5덱 자동'),'four-surface slash message');
must(html.includes('정밀·내 로스터·시뮬레이션·5덱 자동'),'four-surface dot message');

fs.writeFileSync(ROOT,html);
fs.writeFileSync(PUBLIC,html);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version=VERSION;
pkg.scripts.check='node --check functions/api/blabla/sync.js && node tests/verify-deploy-autosync.mjs && node tests/verify-favorite-phase-v3477.mjs && node tests/verify-blabla-propagation-v3478.mjs';
pkg.scripts['check:browser']='node tests/verify-blabla-propagation-browser-v3478.mjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
if(fs.existsSync('package-lock.json')){
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  lock.version=VERSION;
  if(lock.packages?.[''])lock.packages[''].version=VERSION;
  fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
}

let sync=fs.readFileSync('functions/api/blabla/sync.js','utf8');
sync=sync.replace(/const VERSION = '34\.7\.\d+';/,`const VERSION = '${VERSION}';`);
fs.writeFileSync('functions/api/blabla/sync.js',sync);

for(const file of ['tests/verify-deploy-autosync.mjs','tests/verify-favorite-phase-v3477.mjs']){
  let text=fs.readFileSync(file,'utf8').replaceAll('34.7.7','34.7.8');
  fs.writeFileSync(file,text);
}

const verifyWorkflowPath='.github/workflows/verify.yml';
if(fs.existsSync(verifyWorkflowPath)){
  let workflow=fs.readFileSync(verifyWorkflowPath,'utf8');
  if(!workflow.includes('Verify BlaBla four-surface browser propagation')){
    workflow=workflow.replace(
      '      - name: Verify HTML mirror\n        run: cmp --silent index.html public/index.html\n',
      `      - name: Verify HTML mirror\n        run: cmp --silent index.html public/index.html\n      - name: Verify BlaBla four-surface browser propagation\n        run: |\n          CHROME_BIN=\"$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)\"\n          test -n \"$CHROME_BIN\"\n          CHROME_BIN=\"$CHROME_BIN\" npm run check:browser\n`
    );
  }
  fs.writeFileSync(verifyWorkflowPath,workflow);
}

let status=fs.readFileSync('GITHUB_DEPLOY_STATUS.md','utf8');
status=status.replace(/Current production build: \*\*[^\n]+\*\*/,`Current production build: **V${VERSION} BlaBla four-surface calculation propagation**`);
if(!status.includes('BlaBla four-surface propagation'))status=status.replace('## Automatic deployment',`- BlaBla four-surface propagation is verified from one central roster into Precision, My Roster, Simulation, and 5-deck calculation contexts.\n- The 5-deck optimizer now preserves favorite phase and observed equipment ATK/HP/DEF instead of overwriting the rich central context.\n- Live Cloudflare verification checks the deployed HTML and same-origin /api/blabla/sync bridge.\n\n## Automatic deployment`);
fs.writeFileSync('GITHUB_DEPLOY_STATUS.md',status);

const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const files=['index.html','public/index.html','functions/api/blabla/sync.js','package.json','package-lock.json','wrangler.worker.jsonc','README.md','GITHUB_DEPLOY_STATUS.md','.github/workflows/verify.yml','tests/verify-blabla-propagation-v3478.mjs','tests/verify-blabla-propagation-browser-v3478.mjs','tests/verify-cloudflare-production-v3478.mjs'];
fs.writeFileSync('SHA256SUMS.txt',files.filter(fs.existsSync).map(path=>`${hash(path)}  ${path}`).join('\n')+'\n');
console.log(JSON.stringify({version:VERSION,indexBytes:Buffer.byteLength(html),indexSha256:hash(ROOT)},null,2));
