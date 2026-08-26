import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const canon = v => String(v ?? '').toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]+/g, '');

function evalLiteral(text, label) {
  try { return Function(`"use strict"; return (${text});`)(); }
  catch (e) { throw new Error(`${label} eval failed: ${e.message}`); }
}

function balancedLiteralFromAssignment(name, open='[', close=']') {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*=`, 'g');
  let m, pos = -1;
  while ((m = re.exec(html))) pos = m.index + m[0].length;
  if (pos < 0) return null;
  const start = html.indexOf(open, pos);
  if (start < 0) return null;
  let depth = 0, quote = '', esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return html.slice(start, i + 1);
  }
  return null;
}

const explicitMatch = html.match(/const explicit=\{([\s\S]*?)\};\s*function aliasIndex/);
if (!explicitMatch) throw new Error('explicit mapping block not found');
const explicit = evalLiteral(`{${explicitMatch[1]}}`, 'explicit');

let catalog = [];
const catalogLiteral = balancedLiteralFromAssignment('NIKKE_V26_7_CHARACTER_CATALOG');
if (catalogLiteral) {
  try { catalog = evalLiteral(catalogLiteral, 'catalog'); } catch (e) { console.warn(e.message); }
}

const staticMatch = html.match(/window\.__NIKKE_V34610_ENIKK_TABLES__=({[\s\S]*?});<\/script>/);
if (!staticMatch) throw new Error('embedded ENIKK static tables not found');
const staticTables = JSON.parse(staticMatch[1]);

const query = `query AuditCharacters { characters { name_code name_localkey resource_id original_rare class element_id use_burst_skill corporation } }`;
async function gql(endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type':'application/json','accept':'application/json'},
    body: JSON.stringify({query, variables:{}}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${text.slice(0,300)}`);
  const payload = JSON.parse(text);
  if (payload.errors?.length) throw new Error(payload.errors.map(x=>x.message).join(' / '));
  return payload.data?.characters || [];
}
let characters = [];
const errors = [];
for (const endpoint of ['https://enikk.app/api/graphql','https://enikk.app/api/webapp']) {
  try { characters = await gql(endpoint); if (characters.length) break; }
  catch (e) { errors.push(e.message); }
}
if (!characters.length) throw new Error(`ENIKK character master unavailable: ${errors.join(' | ')}`);

const aliasMap = new Map();
const aliasSources = new Map();
function putAlias(name, id, source) {
  const k = canon(name); if (!k || !id) return;
  if (!aliasMap.has(k)) aliasMap.set(k, String(id));
  if (!aliasSources.has(k)) aliasSources.set(k, []);
  aliasSources.get(k).push({id:String(id), name:String(name), source});
}
for (const [name,id] of Object.entries(explicit)) putAlias(name,id,'explicit');
for (const row of Array.isArray(catalog) ? catalog : []) {
  if (!row?.id) continue;
  putAlias(row.id,row.id,'catalog.id');
  putAlias(row.name,row.id,'catalog.name');
  for (const a of Array.isArray(row.aliases)?row.aliases:[]) putAlias(a,row.id,'catalog.alias');
  const sp=row.skillProfile||{};
  putAlias(sp.name,row.id,'skillProfile.name');
  for (const a of Array.isArray(sp.aliases)?sp.aliases:[]) putAlias(a,row.id,'skillProfile.alias');
}
function mapName(name) { return explicit[name] || aliasMap.get(canon(name)) || null; }

const byCode = new Map(characters.map(r=>[String(r.name_code),r]));
const mapped = [], unmapped = [];
for (const row of characters) {
  const name = String(row.name_localkey||'');
  const id = mapName(name);
  (id ? mapped : unmapped).push({nameCode:Number(row.name_code), name, appId:id||null, rare:row.original_rare, burst:row.use_burst_skill, corporation:row.corporation});
}

const favoriteRows = Object.entries(staticTables.favorites||{})
  .filter(([,f])=>f?.rare==='SSR' && Number(f.nameCode)>0)
  .map(([favoriteTid,f])=>{
    const master = byCode.get(String(f.nameCode));
    const gameName = String(master?.name_localkey||'');
    const appId = mapName(gameName);
    return {favoriteTid:Number(favoriteTid), favoriteItemName:f.name, nameCode:Number(f.nameCode), gameName, appId, mapped:!!appId};
  });

const treasureIds = new Set(Object.values(explicit).filter(id=>/Treasure$/i.test(String(id))));
for (const row of Array.isArray(catalog)?catalog:[]) if (/Treasure$/i.test(String(row?.id||''))) treasureIds.add(String(row.id));
const treasureApp = [...treasureIds].sort().map(id=>{
  const aliases=[];
  for (const [k,items] of aliasSources) for (const x of items) if (x.id===id) aliases.push({name:x.name,source:x.source});
  const explicitNames=Object.entries(explicit).filter(([,v])=>v===id).map(([k])=>k);
  const masters=characters.filter(r=>explicitNames.some(n=>canon(n)===canon(r.name_localkey)));
  return {appId:id, explicitNames, aliases, matchedNameCodes:masters.map(r=>Number(r.name_code))};
});

function levenshtein(a,b){a=canon(a);b=canon(b);const m=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const tmp=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp;}}return m[b.length];}
const candidateNames=[];
for (const [k,items] of aliasSources) for (const x of items) candidateNames.push(x);
const fuzzy = unmapped.map(u=>{
  const ranked = candidateNames.map(x=>({id:x.id,name:x.name,source:x.source,d:levenshtein(u.name,x.name)})).sort((a,b)=>a.d-b.d).slice(0,3);
  return {...u, suggestions:ranked};
});

const collisions = [...aliasSources.entries()].filter(([,items])=>new Set(items.map(x=>x.id)).size>1).map(([canonical,items])=>({canonical,items}));
const directNameCodeMap = Object.fromEntries(mapped.map(x=>[String(x.nameCode),x.appId]));

const report = {
  generatedAt:new Date().toISOString(),
  enikkCharacterCount:characters.length,
  appCatalogParsed:Array.isArray(catalog)?catalog.length:0,
  explicitCount:Object.keys(explicit).length,
  mappedCount:mapped.length,
  unmappedCount:unmapped.length,
  favoriteCount:favoriteRows.length,
  favoriteMapped:favoriteRows.filter(x=>x.mapped).length,
  favoriteUnmapped:favoriteRows.filter(x=>!x.mapped),
  favoriteRows,
  treasureApp,
  collisions,
  unmapped:fuzzy,
  directNameCodeMap,
};
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/name-mapping-audit.json',JSON.stringify(report,null,2));
fs.writeFileSync('audit-output/namecode-map.json',JSON.stringify(directNameCodeMap,null,2));
console.log(`ENIKK characters: ${report.enikkCharacterCount}`);
console.log(`App catalog parsed: ${report.appCatalogParsed}`);
console.log(`Mapped by existing naming: ${report.mappedCount}`);
console.log(`Unmapped by existing naming: ${report.unmappedCount}`);
console.log(`Favorite/Treasure master rows: ${report.favoriteCount}, mapped ${report.favoriteMapped}, unmapped ${report.favoriteUnmapped.length}`);
console.log('--- FAVORITE / TREASURE ---');
for (const x of favoriteRows) console.log(`${x.mapped?'PASS':'FAIL'} nameCode=${x.nameCode} game="${x.gameName}" -> ${x.appId||'-'} | item="${x.favoriteItemName}"`);
console.log('--- UNMAPPED FIRST 80 ---');
for (const x of fuzzy.slice(0,80)) console.log(`nameCode=${x.nameCode} game="${x.name}" suggestions=${x.suggestions.map(s=>`${s.name}->${s.id}(d${s.d})`).join(' | ')}`);
console.log(`Alias collisions: ${collisions.length}`);
