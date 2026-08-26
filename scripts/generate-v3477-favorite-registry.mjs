#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = process.argv[2] || 'audit/enikk-favorite-characters-v3477.json';
const outputPath = process.argv[3] || 'scripts/v3477-favorite-registry.generated.js';
const report = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const idMap = Object.freeze({
  diesel: ['dieselTreasure', 'diesel'],
  exia: ['exiaTreasure', 'exia'],
  frima: ['frimaTreasure', 'frima'],
  laplace: ['laplaceTreasure', 'laplace'],
  viper: ['viperTreasure', 'viper'],
  miranda: ['mirandaTreasure', 'miranda'],
  helm: ['helmTreasure', 'helm'],
  drake: ['drakeTreasure', 'drake'],
  milk: ['milkTreasure', 'milk'],
  poli: ['poliTreasure', 'poli'],
  tove: ['toveTreasure', 'tove'],
  julia: ['juliaTreasure', 'julia'],
  bay: ['bayTreasure', 'bay'],
  privaty: ['privatyTreasure', 'privaty'],
  zwei: ['zweiTreasure', 'zwei'],
  centi: ['centiTreasure', 'centi'],
  moran: ['moranTreasure', 'moran'],
  phantom: ['phantomTreasure', 'phantom'],
  flora: ['floraTreasure', 'flora'],
  rosanna: ['rosannaTreasure', 'rosanna'],
  sugar: ['sugarTreasure', 'sugar'],
});
const elementKo = Object.freeze({ Fire: '작열', Water: '수냉', Wind: '풍압', Electronic: '전격', Iron: '철갑' });
const manufacturerKo = Object.freeze({ ELYSION: '엘리시온', MISSILIS: '미실리스', TETRA: '테트라', PILGRIM: '필그림', ABNORMAL: '어브노멀' });
const roleKo = Object.freeze({ Attacker: '화력형', Defender: '방어형', Supporter: '지원형' });
const burstLabel = Object.freeze({ Step1: '버스트 I', Step2: '버스트 II', Step3: '버스트 III' });
const burstNumber = Object.freeze({ Step1: 1, Step2: 2, Step3: 3 });
const intervalByWeapon = Object.freeze({ MG: 1 / 60, SMG: 1 / 20, AR: 1 / 12, SG: 2 / 3, RL: 0.01, SR: 0.01 });

function numericTokens(text) {
  return [...String(text || '').matchAll(/(?<![A-Za-z0-9_.])-?\d+(?:\.\d+)?(?![A-Za-z0-9_.])/g)].map((match) => Number(match[0]));
}
function normalCoefficient(description) {
  const match = String(description || '').match(/Deals\s+([\d.]+)%\s+of ATK as damage/i);
  if (!match) throw new Error(`normal attack coefficient missing: ${description}`);
  return Number(match[1]);
}
function coreMultiplier(description) {
  const match = String(description || '').match(/Deals\s+([\d.]+)%\s+damage when attacking core/i);
  return match ? Number(match[1]) / 100 : 2;
}
function chargeInfo(description) {
  const charge = String(description || '').match(/Charge Time:\s*([\d.]+)\s*sec/i);
  const full = String(description || '').match(/Full Charge Damage:\s*([\d.]+)%/i);
  return { charge: charge ? Number(charge[1]) : 0, fullCharge: full ? Number(full[1]) / 100 : 1 };
}
function curvesForSkill(skill) {
  const perLevel = (skill.levels || []).map(numericTokens);
  const maxColumns = Math.max(0, ...perLevel.map((tokens) => tokens.length));
  const curves = [];
  for (let index = 0; index < maxColumns; index += 1) {
    const values = perLevel.map((tokens) => tokens[index]);
    if (values.length !== 10 || values.some((value) => !Number.isFinite(value))) continue;
    curves.push({
      index,
      lv10: values[9],
      values,
      changing: values.some((value) => Math.abs(value - values[9]) > 1e-9),
    });
  }
  return curves;
}
function cleanName(name) {
  return String(name || '').replace(/\s+-\s+.*$/, '').trim();
}

const records = report.characters.map((row) => {
  const slug = row.character.slug;
  const ids = idMap[slug];
  if (!ids) throw new Error(`unmapped favorite character slug: ${slug}`);
  const [appId, baseId] = ids;
  const shot = row.page.baseDetail.shot;
  const charge = chargeInfo(shot.description);
  const baseSkills = Object.fromEntries(row.page.baseDetail.skills.map((skill) => [skill.slot, {
    name: skill.name,
    cooldownSeconds: skill.cooldownSeconds,
    levels: skill.levels,
    level10: skill.level10,
    curves: curvesForSkill(skill),
  }]));
  const favoriteSkills = Object.fromEntries(row.page.favoriteSkillCards.map((card) => [String(card.phase), {
    phase: card.phase,
    slot: card.slot,
    name: card.name,
    description: card.description,
    numericTokens: card.numericTokens,
  }]));
  const phaseSlots = [1, 2, 3].map((phase) => row.page.phaseOrder[String(phase)]);
  if (phaseSlots.some((slot) => !['skill1', 'skill2', 'burst'].includes(slot))) throw new Error(`incomplete phase order: ${slug}`);
  const name = cleanName(row.character.name);
  const burst = burstNumber[row.character.burst];
  const cooldown = Number(baseSkills.burst?.cooldownSeconds) || (burst === 3 ? 40 : 20);
  return {
    id: appId,
    baseId,
    slug,
    name,
    displayName: `${name} · 애장품`,
    tid: String(row.favoriteItem.tid),
    favoriteItemName: row.favoriteItem.name,
    favoriteItemIcon: row.favoriteItem.icon,
    nameCode: String(row.character.nameCode),
    resourceId: Number(row.character.resourceId),
    role: roleKo[row.character.class] || row.character.class,
    roleCode: String(row.character.class || '').toLowerCase(),
    manufacturer: manufacturerKo[row.character.manufacturer] || row.character.manufacturer,
    element: elementKo[row.character.element] || row.character.element,
    elementCode: row.character.element,
    burst,
    burstLabel: burstLabel[row.character.burst],
    cooldown,
    weapon: shot.weaponType,
    weaponPreset: {
      name: `${name} · 애장품`,
      weapon: shot.weaponType,
      ammo: Number(shot.maxAmmo),
      reload: Number(shot.reloadSeconds),
      charge: charge.charge,
      interval: intervalByWeapon[shot.weaponType] ?? 0.05,
      weaponInfo: `${shot.weaponType} / 장탄 ${shot.maxAmmo} / 재장전 ${Number(shot.reloadSeconds).toFixed(2)}초 / 일반 공격 ${normalCoefficient(shot.description)}%${charge.charge ? ` / 차지 ${charge.charge.toFixed(2)}초 / 풀차지 ${(charge.fullCharge * 100).toFixed(0)}%` : ''} / 코어 ${(coreMultiplier(shot.description) * 100).toFixed(0)}%`,
      desc: `ENIKK ${row.favoriteItem.tid} 기준. favoriteItemPhase 0은 일반 스킬, 1~3은 해당 단계까지 애장품 스킬을 적용합니다.`,
      coreMultiplier: coreMultiplier(shot.description),
    },
    skillProfile: {
      name: `${name} · 애장품`,
      rarity: 'SSR 애장품',
      manufacturer: manufacturerKo[row.character.manufacturer] || row.character.manufacturer,
      squad: 'ENIKK 애장품 마스터',
      role: roleKo[row.character.class] || row.character.class,
      element: elementKo[row.character.element] || row.character.element,
      burst: burstLabel[row.character.burst],
      cooldown,
      weapon: shot.weaponType,
      normal: normalCoefficient(shot.description),
      fullCharge: charge.fullCharge,
      coreMultiplier: coreMultiplier(shot.description),
      status: [
        `ENIKK TID ${row.favoriteItem.tid} · nameCode ${row.character.nameCode}`,
        `Phase 1 ${phaseSlots[0]} → Phase 2 ${phaseSlots[1]} → Phase 3 ${phaseSlots[2]}`,
        `일반 상태와 애장품 상태는 동일한 입력 스킬 레벨을 유지`,
      ],
      skills: ['skill1', 'skill2', 'burst'].map((slot) => ({
        name: `${slot === 'burst' ? '버스트' : slot === 'skill1' ? '스킬 1' : '스킬 2'} · ${baseSkills[slot].name} Lv.10`,
        text: baseSkills[slot].level10,
        calc: `Phase ${phaseSlots.indexOf(slot) + 1}부터 ENIKK 애장품 변형으로 교체`,
      })),
      note: `V34.7.7 ENIKK 직접 감사. 일반 Lv.1~10과 애장품 Phase 1~3 카드를 분리 계산합니다.`,
    },
    shot,
    phaseSlots,
    phaseBySlot: Object.fromEntries(phaseSlots.map((slot, index) => [slot, index + 1])),
    baseSkills,
    favoriteSkills,
    sourceUrl: row.page.url,
    sourceHashes: {
      characterPage: row.page.sha256,
      visibleText: row.page.visibleTextSha256,
      favoriteMaster: report.chunkEvidence?.[0]?.sha256 || '',
    },
  };
});

if (records.length !== 21) throw new Error(`expected 21 favorite characters, got ${records.length}`);
const tids = new Set(records.map((record) => record.tid));
if (tids.size !== 21) throw new Error('duplicate favorite TID');
const ids = new Set(records.map((record) => record.id));
if (ids.size !== 21) throw new Error('duplicate app ID');

const payload = JSON.stringify(records);
const tidPayload = JSON.stringify(Object.fromEntries(records.map((record) => [record.tid, record.id])));
const nameCodePayload = JSON.stringify(Object.fromEntries(records.map((record) => [record.nameCode, record.id])));
const script = `<script id="v3477-favorite-registry">\n(function registerV3477FavoriteRegistry(root){\n'use strict';\nconst records=${payload};\nconst freezeDeep=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freezeDeep(child);return value;};\nconst registry=Object.fromEntries(records.map(record=>[record.id,record]));\nconst byTid=${tidPayload};\nconst byNameCode=${nameCodePayload};\nroot.NIKKE_V3477_FAVORITE_REGISTRY=freezeDeep(registry);\nroot.NIKKE_V3477_FAVORITE_TID_TO_APP_ID=freezeDeep(byTid);\nroot.NIKKE_V3477_FAVORITE_NAMECODE_TO_APP_ID=freezeDeep(byNameCode);\nconst data=root.NIKKE_V26_DATA=root.NIKKE_V26_DATA||{};\nfor(const key of ['burst1','burst2','burst3']){data[key]=data[key]||{};data[key].characters=Array.isArray(data[key].characters)?data[key].characters:[];if(key!=='burst3')data[key].profiles=data[key].profiles||{};}\nconst moduleFor=record=>record.burst===1?data.burst1:record.burst===2?data.burst2:data.burst3;\nfor(const record of records){\n  let existing=null;\n  for(const module of [data.burst1,data.burst2,data.burst3]){const index=module.characters.findIndex(entry=>entry&&entry.id===record.id);if(index>=0){existing=module.characters[index];module.characters.splice(index,1);}}\n  const entry=Object.assign({},existing||{}, {id:record.id,name:record.displayName,aliases:[record.name+' 애장품',record.name+' Favorite Item',record.name+' Treasure'],baseCharacterId:record.baseId,originalCharacterId:record.baseId,favoriteItemTid:record.tid,nameCode:record.nameCode,resourceId:record.resourceId,sourceUrl:record.sourceUrl,weaponPreset:record.weaponPreset,skillProfile:record.skillProfile,v3477FavoriteRecordId:record.id,manualLevel:0});\n  moduleFor(record).characters.push(entry);\n  if(record.burst===1||record.burst===2){const module=record.burst===1?data.burst1:data.burst2;const prior=module.profiles[record.id]||{};module.profiles[record.id]=Object.assign({},prior,{name:record.displayName,characterId:record.id,role:record.roleCode,cooldown:record.cooldown,desc:record.skillProfile.note,tags:['favorite-item','enikk-v3477','phase-aware'],sourceUrl:record.sourceUrl,timeline:record.burst===1?Object.assign({},prior.timeline||{},{b1Cooldown:record.cooldown,cdr:0,cdrTrigger:'none',approximation:'V34.7.7 favorite phase runtime'}):Object.assign({},prior.timeline||{},{b2Cooldown:record.cooldown,approximation:'V34.7.7 favorite phase runtime'}),effects:{}});}\n}\nroot.NIKKE_V3477_FAVORITE_REGISTRY_REPORT=freezeDeep({version:'34.7.7',characters:records.length,tids:Object.keys(byTid).length,nameCodes:Object.keys(byNameCode).length,ids:records.map(record=>record.id)});\n})(window);\n</script>\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, script);
console.log(JSON.stringify({ outputPath, characters: records.length, tids: tids.size, ids: ids.size, bytes: Buffer.byteLength(script) }, null, 2));
