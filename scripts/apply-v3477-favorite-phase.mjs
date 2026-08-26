import fs from 'node:fs';
import crypto from 'node:crypto';

const rootPath='index.html',publicPath='public/index.html';
let html=fs.readFileSync(rootPath,'utf8');
const runtime=fs.readFileSync('scripts/v3477-favorite-phase-runtime.js','utf8').trim();
const mustReplace=(from,to,label)=>{if(!html.includes(from))throw new Error(`missing patch anchor: ${label}`);html=html.replace(from,to);};

mustReplace(
  "result.favoriteItemPhase=Math.max(Number(a.favoriteItemPhase)||0,Number(b.favoriteItemPhase)||0,3);",
  "const aPhase=Number(a.favoriteItemPhase),bPhase=Number(b.favoriteItemPhase),preferredPhase=b.owned===true&&Number.isFinite(bPhase)?bPhase:(a.owned===true&&Number.isFinite(aPhase)?aPhase:(Number.isFinite(bPhase)?bPhase:(Number.isFinite(aPhase)?aPhase:0)));result.favoriteItemPhase=Math.min(3,Math.max(0,Math.round(preferredPhase)));",
  'favorite phase migration'
);
mustReplace(
  "result.skills={skill1:Math.max(Number(ask.skill1)||0,Number(bsk.skill1)||0,4),skill2:Math.max(Number(ask.skill2)||0,Number(bsk.skill2)||0,4),burst:Math.max(Number(ask.burst)||0,Number(bsk.burst)||0,4)};",
  "const skillValue=key=>{const av=Number(ask[key]),bv=Number(bsk[key]);const chosen=b.owned===true&&Number.isFinite(bv)?bv:(a.owned===true&&Number.isFinite(av)?av:(Number.isFinite(bv)?bv:(Number.isFinite(av)?av:4)));return Math.min(10,Math.max(1,Math.round(chosen)));};result.skills={skill1:skillValue('skill1'),skill2:skillValue('skill2'),burst:skillValue('burst')};",
  'skill level migration'
);
mustReplace(
  "const ctx={skillEff:1,cond:1,fb:fullBurstUptime,own:ownUptime,targets:1,duration,ownUsage:100,ownUsesCount:ownUses,fbEntries:fullBurstEntries,burstRatio:fullBurstUptime*100,partsRatio,b1Id:stage===1?profile.id:'none',cwOwn:ownUptime,sustainedUptime,sim,cube:cubeStats(profile)};",
  "const ctx={skillEff:1,cond:1,fb:fullBurstUptime,own:ownUptime,targets:1,duration,ownUsage:100,ownUsesCount:ownUses,fbEntries:fullBurstEntries,burstRatio:fullBurstUptime*100,partsRatio,b1Id:stage===1?profile.id:'none',cwOwn:ownUptime,sustainedUptime,favoriteItemPhase:profile?.growth?.favoriteItemPhase,sim,cube:cubeStats(profile)};",
  'optimizer phase context'
);
mustReplace(
  "skills:{...(g.skills||{})},equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null",
  "skills:{...(g.skills||{})},favoriteItemPhase:finite(g.favoriteItemPhase,0),equipmentAttack:g.equipmentAttack!=null?finite(g.equipmentAttack):null",
  'shared growth phase context'
);
mustReplace(
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9}",
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,sustainedUptime:.9,favoriteItemPhase:3}",
  'sugar cycle self-test phase'
);
mustReplace(
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,hasElement:true,sustainedUptime:.9,targets:1}",
  "{fb:.5,own:.25,cond:1,duration:180,ownUsesCount:3,hasElement:true,sustainedUptime:.9,targets:1,favoriteItemPhase:3}",
  'sugar damage self-test phase'
);
const insertAnchor='</script>\n<style id="v34610-external-style">';
if(!html.includes('id="v3477-favorite-phase-skill-resolver"'))mustReplace(insertAnchor,`</script>\n${runtime}\n<style id="v34610-external-style">`,'runtime insertion');
html=html.replace("version:'34.7.6',count:Object.keys(V3476_NAMECODE_TO_APP_ID).length","version:'34.7.7',count:Object.keys(V3476_NAMECODE_TO_APP_ID).length");
html=html.replaceAll('V34.7.6 웹 동기화:','V34.7.7 웹 동기화:');
html=html.replaceAll("니케 성장 계산기 V34.7.6 · BlaBla nameCode 권위 매핑","니케 성장 계산기 V34.7.7 · ENIKK 애장품 단계 계산");
html=html.replaceAll("Nikke Damage Growth Calculator · V34.7.6 · 2026-08-26","Nikke Damage Growth Calculator · V34.7.7 · 2026-08-26");
fs.writeFileSync(rootPath,html);
fs.writeFileSync(publicPath,html);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.version='34.7.7';
pkg.scripts.check='node --check functions/api/blabla/sync.js && node tests/verify-deploy-autosync.mjs && node tests/verify-favorite-phase-v3477.mjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

if(fs.existsSync('GITHUB_DEPLOY_STATUS.md')){
  let status=fs.readFileSync('GITHUB_DEPLOY_STATUS.md','utf8').replace(/V34\.7\.6 BlaBla nameCode Authority AutoSync/g,'V34.7.7 ENIKK Favorite Phase Skill Resolution');
  fs.writeFileSync('GITHUB_DEPLOY_STATUS.md',status);
}
if(fs.existsSync('tests/verify-deploy-autosync.mjs')){
  let test=fs.readFileSync('tests/verify-deploy-autosync.mjs','utf8').replace('V34.7.6 deploy autosync + nameCode authority verification: PASS','V34.7.7 deploy autosync + nameCode authority verification: PASS');
  fs.writeFileSync('tests/verify-deploy-autosync.mjs',test);
}
const hashes=['index.html','public/index.html','package.json','functions/api/blabla/sync.js'].filter(fs.existsSync).map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${file}`).join('\n')+'\n';
fs.writeFileSync('SHA256SUMS.txt',hashes);
console.log('V34.7.7 favorite phase patch applied');
