#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ORIGIN = 'https://enikk.app';
const OUT = 'audit';
fs.mkdirSync(OUT, { recursive: true });

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, limit = 16000) => String(value)
  .replaceAll('\0', ' ')
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .slice(0, limit);

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'nikke-growth-calculator-v3477-full-favorite-audit/1.0' },
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
}

function matchBalancedObject(text, start) {
  if (text[start] !== '{') return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"') quote = '"';
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractCharacterObjects(text) {
  const objects = [];
  const pattern = /\{"id":\d+,"name_localkey":/g;
  for (const match of text.matchAll(pattern)) {
    const raw = matchBalancedObject(text, match.index);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === 'object' && value.name_localkey && value.name_code) objects.push(value);
    } catch (_) {
      // Not every object-like sequence is standalone JSON. Ignore and continue.
    }
  }
  return objects;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function htmlToText(html) {
  return clean(decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6]|button)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')), 120000);
}

function contexts(text, terms, radius = 2200, maxPerTerm = 20) {
  const output = [];
  const lower = text.toLocaleLowerCase('en-US');
  for (const term of terms) {
    const needle = term.toLocaleLowerCase('en-US');
    let start = 0;
    let count = 0;
    while (count < maxPerTerm) {
      const offset = lower.indexOf(needle, start);
      if (offset < 0) break;
      output.push({
        term,
        offset,
        context: clean(text.slice(Math.max(0, offset - radius), Math.min(text.length, offset + term.length + radius))),
      });
      start = offset + Math.max(1, needle.length);
      count += 1;
    }
  }
  return output;
}

function parsePhaseOrder(plainText) {
  const result = {};
  for (const phase of [1, 2, 3]) {
    const segment = plainText.match(new RegExp(`PHASE\\s*${phase}([\\s\\S]{0,1200}?)(?=PHASE\\s*${phase + 1}|Base skills|SKILLS|$)`, 'i'))?.[1] ?? '';
    const upgrade = segment.match(/Upgrades\s+(Skill\s*1|Skill\s*2|Burst\s*Skill)/i)?.[1] ?? null;
    result[phase] = upgrade
      ? upgrade.toLowerCase().includes('burst') ? 'burst' : upgrade.replace(/\s+/g, '').toLowerCase() === 'skill1' ? 'skill1' : 'skill2'
      : null;
  }
  return result;
}

function sliceBetween(text, startTerm, endTerms, limit = 70000) {
  const lower = text.toLocaleLowerCase('en-US');
  const start = lower.indexOf(startTerm.toLocaleLowerCase('en-US'));
  if (start < 0) return '';
  let end = Math.min(text.length, start + limit);
  for (const term of endTerms) {
    const pos = lower.indexOf(term.toLocaleLowerCase('en-US'), start + startTerm.length);
    if (pos >= 0) end = Math.min(end, pos);
  }
  return clean(text.slice(start, end), limit);
}

const crawlPath = `${OUT}/enikk-favorite-phase-crawl-v3477.json`;
if (!fs.existsSync(crawlPath)) throw new Error(`missing prerequisite ${crawlPath}`);
const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
const chunkUrls = [...new Set(crawl.chunks.map((entry) => entry.url))];
const characters = new Map();
const chunkEvidence = [];

for (const url of chunkUrls) {
  const text = await fetchText(url);
  const records = extractCharacterObjects(text);
  const favorites = records.filter((record) => record.hasFavoriteItem === true);
  if (favorites.length) {
    chunkEvidence.push({ url, sha256: sha256(text), bytes: Buffer.byteLength(text), parsedCharacters: records.length, favoriteCharacters: favorites.length });
  }
  for (const record of favorites) characters.set(String(record.name_code), record);
}

if (characters.size < 15) {
  throw new Error(`expected a complete favorite-character roster; parsed only ${characters.size}`);
}

const favoriteMaster = JSON.parse(fs.readFileSync(`${OUT}/enikk-favorite-master-raw-v3477.json`, 'utf8'));
const favoritesByNameCode = new Map();
for (const [tid, item] of Object.entries(favoriteMaster)) {
  if (item?.rare !== 'SSR' || item?.type !== 'Favorite') continue;
  const key = String(item.nameCode ?? '');
  if (!favoritesByNameCode.has(key)) favoritesByNameCode.set(key, []);
  favoritesByNameCode.get(key).push({ tid, ...item });
}

const rows = [];
for (const record of [...characters.values()].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))) {
  const pageUrl = `${ORIGIN}/characters/${record.slug}`;
  const html = await fetchText(pageUrl);
  const plainText = htmlToText(html);
  const phaseOrder = parsePhaseOrder(plainText);
  const itemCandidates = favoritesByNameCode.get(String(record.name_code)) ?? [];
  const iconCandidates = Object.entries(favoriteMaster)
    .filter(([, item]) => item?.rare === 'SSR' && item?.type === 'Favorite' && String(item.icon ?? '').endsWith(`c${String(record.resource_id).padStart(3, '0')}_00`))
    .map(([tid, item]) => ({ tid, ...item }));
  const candidates = itemCandidates.length ? itemCandidates : iconCandidates;
  const scriptUrls = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => new URL(match[1], pageUrl).href))];
  const nextPayloadContexts = contexts(html, [
    'PHASE 1', 'PHASE 2', 'PHASE 3', 'Upgrades Skill', 'Preview cumulative skill upgrades',
    'favoriteItem', 'hasFavoriteItem', 'skill1_id', 'skill2_id', 'ulti_skill_id', 'CharacterSkill', 'StateEffect',
  ], 2600, 30);
  rows.push({
    character: {
      id: record.id,
      name: record.name_localkey,
      slug: record.slug,
      nameCode: record.name_code,
      resourceId: record.resource_id,
      weapon: record.weapon,
      class: record.class,
      burst: record.use_burst_skill,
      element: record.element_id?.element ?? null,
      manufacturer: record.corporation,
      skill1Id: record.skill1_id,
      skill1Table: record.skill1_table,
      skill2Id: record.skill2_id,
      skill2Table: record.skill2_table,
      burstSkillId: record.ulti_skill_id,
    },
    favoriteItems: candidates,
    page: {
      url: pageUrl,
      bytes: Buffer.byteLength(html),
      sha256: sha256(html),
      phaseOrder,
      phaseOrderComplete: Object.values(phaseOrder).every(Boolean),
      phasePanelText: sliceBetween(plainText, 'TREASURE', ['USAGE', 'SQUAD'], 90000),
      skillSectionText: sliceBetween(plainText, 'SKILLS', ['USAGE', 'SQUAD'], 90000),
      contexts: nextPayloadContexts,
      scriptUrls,
    },
  });
}

const itemTids = new Set(Object.entries(favoriteMaster)
  .filter(([, item]) => item?.rare === 'SSR' && item?.type === 'Favorite')
  .map(([tid]) => tid));
const resolvedTids = new Set(rows.flatMap((row) => row.favoriteItems.map((item) => item.tid)));
const report = {
  auditVersion: 1,
  evidenceRule: 'Character records, TIDs, phase upgrade order, and page excerpts are literal ENIKK deployed data. No missing mapping is filled by guess.',
  fetchedAtUtc: new Date().toISOString(),
  counts: {
    parsedFavoriteCharacters: rows.length,
    favoriteMasterItems: itemTids.size,
    resolvedFavoriteTids: resolvedTids.size,
    completePhaseOrders: rows.filter((row) => row.page.phaseOrderComplete).length,
  },
  chunkEvidence,
  unresolvedMasterTids: [...itemTids].filter((tid) => !resolvedTids.has(tid)).sort(),
  characters: rows,
};
fs.writeFileSync(`${OUT}/enikk-favorite-characters-v3477.json`, JSON.stringify(report, null, 2));

const lines = [
  '# ENIKK complete favorite-character roster — V34.7.7',
  '',
  '> Literal deployed ENIKK data only. No character, TID, or phase order is guessed.',
  '',
  `- Favorite characters parsed: **${report.counts.parsedFavoriteCharacters}**`,
  `- SSR Favorite master items: **${report.counts.favoriteMasterItems}**`,
  `- TIDs resolved: **${report.counts.resolvedFavoriteTids}**`,
  `- Complete three-phase orders: **${report.counts.completePhaseOrders}**`,
  `- Unresolved TIDs: **${report.unresolvedMasterTids.join(', ') || '(none)'}**`,
  '',
  '## Roster',
  '',
  '| Character | nameCode | TID | Phase 1 | Phase 2 | Phase 3 |',
  '|---|---:|---:|---|---|---|',
  ...rows.map((row) => {
    const tids = row.favoriteItems.map((item) => item.tid).join(', ') || '—';
    const order = row.page.phaseOrder;
    return `| ${row.character.name} | ${row.character.nameCode} | ${tids} | ${order[1] ?? '—'} | ${order[2] ?? '—'} | ${order[3] ?? '—'} |`;
  }),
  '',
  '## Full evidence',
  '',
  '- `audit/enikk-favorite-characters-v3477.json`',
];
fs.writeFileSync(`${OUT}/enikk-favorite-characters-v3477.md`, lines.join('\n') + '\n');

console.log(JSON.stringify({
  counts: report.counts,
  unresolvedMasterTids: report.unresolvedMasterTids,
  roster: rows.map((row) => ({
    name: row.character.name,
    slug: row.character.slug,
    nameCode: row.character.nameCode,
    tids: row.favoriteItems.map((item) => item.tid),
    phaseOrder: row.page.phaseOrder,
  })),
}, null, 2));
