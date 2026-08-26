#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const rootPath='index.html';
const publicPath='public/index.html';
const registryPath='scripts/v3477-favorite-registry.generated.js';
const runtimePath='scripts/v3477-favorite-phase-runtime.js';
const auditPath='audit/enikk-favorite-characters-v3477.json';
const VERSION='34.7.7';

const must=(condition,label)=>{if(!condition)throw new Error(`V34.7.7 patch invariant failed: ${label}`);};
const replaceOnce=(text,from,to,label)=>{
  const count=text.split(from).length-1;
  must(count===1,`${label}: expected exactly one anchor, found ${count}`);
  return text.replace(from,to);
};
const replaceRegexOnce=(text,regex,replacer,label)=>{
  const matches=[...text.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
  must(matches.length===1,`${label}: expected exactly one match, found ${matches.length}`);
  return text.replace(regex,replacer);
};
const stripScript=(html,id)=>html.replace(new RegExp(`\\n?<script id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>\\n?`,'g'),'\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

must(fs.existsSync(auditPath),'complete ENIKK audit is missing');
const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
must(audit?.counts?.favoriteCharacters===21,'favorite roster must contain 21 characters');
must(audit?.counts?.resolvedFavoriteTids===21,'all 21 TIDs must be resolved');
must(audit?.counts?.completePhaseOrders===21,'all 21 phase orders must be complete');
must(audit?.counts?.completeFavoriteSkillCards===21,'all 63 favorite skill cards must be complete');
must(audit?.counts?.completeBaseDetails===21,'all 21 base skill/weapon details must be complete');

execFileSync(process.execPath,['scripts/generate-v3477-favorite-registry.mjs',auditPath,registryPath],{stdio:'inherit'});
const registryScript=fs.readFileSync(registryPath,'utf8').trim();
const runtimeScript=fs.readFileSync(runtimePath,'utf8').trim();
must(registryScript.includes('NIKKE_V3477_FAVORITE_TID_TO_APP_ID'),'generated TID registry');
must(runtimeScript.includes('NIKKE_V3477_FAVORITE_PHASE_API'),'phase runtime');

let html=fs.readFileSync(rootPath,'utf8');
html=stripScript(html,'v3477-favorite-registry');
html=stripScript(html,'v3477-favorite-phase-runtime');
html=stripScript(html,'v3477-favorite-phase-skill-resolver');

// Register all 21 phase-aware profiles before the V26 bootstrap snapshots module data.
html=replaceOnce(
  html,
  '<script data-v26-source="js/v26-bootstrap.js">',
  `${registryScript}\n<script data-v26-source="js/v26-bootstrap.js">`,
  'registry insertion before V26 bootstrap'
);

// The B2 timeline previously hard-coded every B2 to 20 seconds. Favorite B2 profiles
// such as Poli/Bay/Flora must consume their actual 20/40 second cooldown.
html=replaceOnce(
  html,
  '      state.b2 = t + 20;',
  "      const selectedB2Cooldown = Math.max(1, Number(b2Data.profiles?.[bufferId]?.timeline?.b2Cooldown ?? b2Data.profiles?.[bufferId]?.cooldown ?? 20) || 20);\n      state.b2 = t + selectedB2Cooldown;",
  'phase-aware B2 cooldown'
);

// Do not manufacture Phase 3 or skill level 4 when collapsing a base/favorite identity.
html=replaceOnce(
  html,
  '    result.favoriteItemPhase=Math.max(Number(a.favoriteItemPhase)||0,Number(b.favoriteItemPhase)||0,3);',
  "    const aPhase=Number(a.favoriteItemPhase),bPhase=Number(b.favoriteItemPhase),preferredPhase=b.owned===true&&Number.isFinite(bPhase)?bPhase:(a.owned===true&&Number.isFinite(aPhase)?aPhase:(Number.isFinite(bPhase)?bPhase:(Number.isFinite(aPhase)?aPhase:0)));result.favoriteItemPhase=Math.min(3,Math.max(0,Math.round(preferredPhase)));",
  'favorite phase migration'
);
html=replaceOnce(
  html,
  '    result.skills={skill1:Math.max(Number(ask.skill1)||0,Number(bsk.skill1)||0,4),skill2:Math.max(Number(ask.skill2)||0,Number(bsk.skill2)||0,4),burst:Math.max(Number(ask.burst)||0,Number(bsk.burst)||0,4)};',
  "    const skillValue=key=>{const av=Number(ask[key]),bv=Number(bsk[key]);const chosen=b.owned===true&&Number.isFinite(bv)?bv:(a.owned===true&&Number.isFinite(av)?av:(Number.isFinite(bv)?bv:(Number.isFinite(av)?av:4)));return Math.min(10,Math.max(1,Math.round(chosen)));};result.skills={skill1:skillValue('skill1'),skill2:skillValue('skill2'),burst:skillValue('burst')};",
  'skill level migration'
);

// Merge the audited favorite identities into the nameCode map. TID remains the import authority;
// nameCode selects the same canonical profile when no favorite is equipped (Phase 0).
const nameCodeMap=Object.fromEntries(audit.characters.map(row=>[String(row.character.nameCode),({
  diesel:'dieselTreasure',exia:'exiaTreasure',frima:'frimaTreasure',laplace:'laplaceTreasure',viper:'viperTreasure',miranda:'mirandaTreasure',helm:'helmTreasure',drake:'drakeTreasure',milk:'milkTreasure',poli:'poliTreasure',tove:'toveTreasure',julia:'juliaTreasure',bay:'bayTreasure',privaty:'privatyTreasure',zwei:'zweiTreasure',centi:'centiTreasure',moran:'moranTreasure',phantom:'phantomTreasure',flora:'floraTreasure',rosanna:'rosannaTreasure',sugar:'sugarTreasure'
})[row.character.slug]]));
const mapRegex=/const V3476_NAMECODE_TO_APP_ID=Object\.freeze\((\{[^\n]+\})\);/;
const mapMatch=html.match(mapRegex);
must(mapMatch,'V3476 nameCode map');
const mergedMap={...JSON.parse(mapMatch[1]),...nameCodeMap};
html=replaceRegexOnce(html,mapRegex,`const V3476_NAMECODE_TO_APP_ID=Object.freeze(${JSON.stringify(mergedMap)});`,'merge 21 favorite nameCodes');
html=html.replace("version:'34.7.6',count:Object.keys(V3476_NAMECODE_TO_APP_ID).length","version:'34.7.7',count:Object.keys(V3476_NAMECODE_TO_APP_ID).length");

// Add missing human-name aliases for direct imports and ranker payloads.
const explicitAdd={Diesel:'dieselTreasure',Exia:'exiaTreasure',Frima:'frimaTreasure',Viper:'viperTreasure',Milk:'milkTreasure',Julia:'juliaTreasure',Bay:'bayTreasure',Poli:'poliTreasure',Rosanna:'rosannaTreasure'};
html=replaceRegexOnce(html,/const explicit=\{([\s\S]*?)\n  \};/,(_full,body)=>{
  const additions=Object.entries(explicitAdd).filter(([name])=>!new RegExp(`['\"]${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['\"]\\s*:`).test(body));
  const suffix=additions.map(([name,id])=>`,'${name}':'${id}'`).join('');
  return `const explicit={${body}${suffix}\n  };`;
},'external explicit alias map');

// Favorite TID is authoritative. Correct examples: Viper=200501, Sugar=202101.
html=replaceOnce(
  html,
  '    const master=byCode.get(String(row.nameCode)),display=master?.name_localkey||`nameCode ${row.nameCode}`,id=idForNameCode(row.nameCode)||supplementalId(row.nameCode);',
  "    const master=byCode.get(String(row.nameCode)),display=master?.name_localkey||`nameCode ${row.nameCode}`,favoriteTid=String(row.favoriteItemTid??''),favoriteAppId=root.NIKKE_V3477_FAVORITE_TID_TO_APP_ID?.[favoriteTid]||'',id=favoriteAppId||idForNameCode(row.nameCode)||supplementalId(row.nameCode);",
  'TID-first external identity'
);
html=replaceOnce(
  html,
  "    const fav=tables.favorites?.[row.favoriteItemTid],favoriteItemPhase=fav?.rare==='SSR'?clamp(num(row.favoriteItemLv)+1,1,3):0,gearTotals=observedGearTotals(row,master);",
  "    const fav=tables.favorites?.[row.favoriteItemTid],favoriteItemPhase=favoriteAppId&&fav?.rare==='SSR'&&fav?.type==='Favorite'?clamp(num(row.favoriteItemLv)+1,1,3):0,gearTotals=observedGearTotals(row,master);",
  'favorite phase only for audited Favorite TID'
);

// Carry phase through precision, optimizer and shared growth contexts. The runtime also has a
// roster fallback, but explicit propagation makes every consumer deterministic and testable.
html=replaceOnce(
  html,
  "  const baseCycle=v21SkillCycle(id,prof,{fb:baseFb,own:baseOwn,cond,ownUsage:ownUsageFrac}),soloCycle=v21SkillCycle(id,prof,{fb:soloFb,own:soloOwn,cond,ownUsage:ownUsageFrac}),targetPersonalCycle=v21SkillCycle(id,prof,{fb,own,cond,ownUsage:ownUsageFrac}),comboCycle={...targetPersonalCycle,ammoPct:(targetPersonalCycle.ammoPct||0)+combo.ammoPct,reload:(targetPersonalCycle.reload||0)+combo.reload,chargeSpeed:(targetPersonalCycle.chargeSpeed||0)+combo.chargeSpeed,attackSpeed:(targetPersonalCycle.attackSpeed||0)+combo.attackSpeed,dynamicReloadWindows:combo.dynamicReloadWindows||[],dynamicAmmoWindows:combo.dynamicAmmoWindows||[],dynamicReloadAverage:combo.dynamicReloadAverage||0,dynamicAmmoAverage:combo.dynamicAmmoAverage||0};",
  "  const favoriteItemPhase=Math.min(3,Math.max(0,Math.round(Number(window.__v26TeamGrowthContext?.byId?.[id]?.favoriteItemPhase)||0))),baseCycle=v21SkillCycle(id,prof,{fb:baseFb,own:baseOwn,cond,ownUsage:ownUsageFrac,favoriteItemPhase}),soloCycle=v21SkillCycle(id,prof,{fb:soloFb,own:soloOwn,cond,ownUsage:ownUsageFrac,favoriteItemPhase}),targetPersonalCycle=v21SkillCycle(id,prof,{fb,own,cond,ownUsage:ownUsageFrac,favoriteItemPhase}),comboCycle={...targetPersonalCycle,ammoPct:(targetPersonalCycle.ammoPct||0)+combo.ammoPct,reload:(targetPersonalCycle.reload||0)+combo.reload,chargeSpeed:(targetPersonalCycle.chargeSpeed||0)+combo.chargeSpeed,attackSpeed:(targetPersonalCycle.attackSpeed||0)+combo.attackSpeed,dynamicReloadWindows:combo.dynamicReloadWindows||[],dynamicAmmoWindows:combo.dynamicAmmoWindows||[],dynamicReloadAverage:combo.dynamicReloadAverage||0,dynamicAmmoAverage:combo.dynamicAmmoAverage||0};",
  'precision phase contexts'
);
html=replaceOnce(
  html,
  "  const shared={duration,ownUsage,ownUsageFrac,cond,targets,skillEff,atk,element,critRate,fieldCritRate,critDmg,chargeDmg,coreRatio,partsRatio,pierceRatio,distributedRatio,projectileRatio,rangeRatio,manualRatio,otherAtk,otherDamage,hpAtk,measured,hasElement,cube,prof,b1Id:combo.b1Id};",
  "  const shared={duration,ownUsage,ownUsageFrac,cond,targets,skillEff,atk,element,critRate,fieldCritRate,critDmg,chargeDmg,coreRatio,partsRatio,pierceRatio,distributedRatio,projectileRatio,rangeRatio,manualRatio,otherAtk,otherDamage,hpAtk,measured,hasElement,cube,prof,b1Id:combo.b1Id,favoriteItemPhase};",
  'damage model shared phase'
);
html=replaceOnce(
  html,
  "      const ctx={skillEff:1,cond:1,fb:fullBurstUptime,own:ownUptime,targets:1,duration,ownUsage:100,ownUsesCount:ownUses,fbEntries:fullBurstEntries,burstRatio:fullBurstUptime*100,partsRatio,b1Id:stage===1?profile.id:'none',cwOwn:ownUptime,sustainedUptime,sim,cube:cubeStats(profile)};",
  "      const ctx={skillEff:1,cond:1,fb:fullBurstUptime,own:ownUptime,targets:1,duration,ownUsage:100,ownUsesCount:ownUses,fbEntries:fullBurstEntries,burstRatio:fullBurstUptime*100,partsRatio,b1Id:stage===1?profile.id:'none',cwOwn:ownUptime,sustainedUptime,favoriteItemPhase:profile?.growth?.favoriteItemPhase,sim,cube:cubeStats(profile)};",
  'optimizer phase context'
);
html=replaceOnce(
  html,
  "skills:{...(g.skills||{})},equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null",
  "skills:{...(g.skills||{})},favoriteItemPhase:finite(g.favoriteItemPhase,0),equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null",
  'shared growth phase context'
);

// Legacy Sugar V34.7.3 self-test must explicitly request Phase 3 now that the final runtime
// correctly defaults an unowned/no-roster character to Phase 0.
html=html.replace(
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9}",
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9,favoriteItemPhase:3}"
);
html=html.replace(
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,hasElement:true,sustainedUptime:.9,targets:1}",
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,hasElement:true,sustainedUptime:.9,targets:1,favoriteItemPhase:3}"
);

// The final wrapper is intentionally last so earlier legacy patches cannot overwrite it.
html=replaceOnce(html,'</body>',`${runtimeScript}\n</body>`,'final runtime insertion');

// Visible branding. Keep old bridge messages but identify the current canonical build.
html=html.replaceAll('34.7.3','34.7.7').replaceAll('34.7.6','34.7.7');
html=html.replaceAll('BlaBla 공개 동기화 수정','ENIKK 애장품 21명 단계 계산');
html=html.replaceAll('BlaBla nameCode 권위 매핑','ENIKK 애장품 21명 단계 계산');
html=html.replaceAll('V34.7.7 수정:','V34.7.7 수정:');

// Sanity checks before writing the large canonical HTML.
must((html.match(/id="v3477-favorite-registry"/g)||[]).length===1,'one registry script');
must((html.match(/id="v3477-favorite-phase-runtime"/g)||[]).length===1,'one runtime script');
must(html.includes('"200501":"viperTreasure"'),'Viper TID map');
must(html.includes('"202101":"sugarTreasure"'),'Sugar TID map');
must(!html.includes('result.favoriteItemPhase=Math.max(Number(a.favoriteItemPhase)||0,Number(b.favoriteItemPhase)||0,3)'),'forced Phase 3 removed');
must(!html.includes('result.skills={skill1:Math.max(Number(ask.skill1)||0,Number(bsk.skill1)||0,4'),'forced skill level 4 removed');

fs.writeFileSync(rootPath,html);
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync(publicPath,html);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version=VERSION;
pkg.scripts.check='node --check functions/api/blabla/sync.js && node tests/verify-deploy-autosync.mjs && node tests/verify-favorite-phase-v3477.mjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

let sync=fs.readFileSync('functions/api/blabla/sync.js','utf8');
sync=sync.replace(/const VERSION = '34\.7\.\d+';/,"const VERSION = '34.7.7';");
fs.writeFileSync('functions/api/blabla/sync.js',sync);

let deployTest=fs.readFileSync('tests/verify-deploy-autosync.mjs','utf8');
deployTest=deployTest
  .replace(/assert\.match\(html, \/id=idForNameCode\\\(row\\\.nameCode\\\)\\\|\\\|supplementalId\\\(row\\\.nameCode\\\)\//,
    "assert.match(html, /favoriteAppId\\|\\|idForNameCode\\(row\\.nameCode\\)\\|\\|supplementalId\\(row\\.nameCode\\)/")
  .replace(/V34\.7\.6 deploy autosync \+ nameCode authority verification: PASS/g,'V34.7.7 deploy autosync + TID/nameCode authority verification: PASS');
fs.writeFileSync('tests/verify-deploy-autosync.mjs',deployTest);

let status=fs.readFileSync('GITHUB_DEPLOY_STATUS.md','utf8');
status=status.replace(/Current production build: \*\*[^\n]+\*\*/,'Current production build: **V34.7.7 ENIKK Favorite Phase Skill Resolution**');
if(!status.includes('21-character ENIKK favorite-item registry'))status=status.replace('## Automatic deployment',`- 21-character ENIKK favorite-item registry is TID-authoritative; Phase 0 uses base skills and Phases 1-3 replace only the audited slot.\n- Viper TID 200501 and Sugar TID 202101 are permanently regression-tested.\n- Imported skill levels are preserved independently of favorite-item phase.\n\n## Automatic deployment`);
fs.writeFileSync('GITHUB_DEPLOY_STATUS.md',status);

const hashFiles=['index.html','public/index.html','functions/api/blabla/sync.js','package.json','wrangler.worker.jsonc','README.md','GITHUB_DEPLOY_STATUS.md','audit/enikk-favorite-characters-v3477.json','tests/verify-favorite-phase-v3477.mjs'];
fs.writeFileSync('SHA256SUMS.txt',hashFiles.filter(fs.existsSync).map(file=>`${sha(file)}  ${file}`).join('\n')+'\n');

console.log(JSON.stringify({
  version:VERSION,
  indexBytes:Buffer.byteLength(html),
  indexSha256:sha(rootPath),
  registryCharacters:audit.counts.favoriteCharacters,
  resolvedTids:audit.counts.resolvedFavoriteTids,
  phaseCards:audit.counts.completeFavoriteSkillCards*3,
  baseDetails:audit.counts.completeBaseDetails,
},null,2));
