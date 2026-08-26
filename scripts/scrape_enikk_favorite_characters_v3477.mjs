#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ORIGIN = 'https://enikk.app';
const OUT = 'audit';
fs.mkdirSync(OUT, { recursive: true });

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, limit = 16000) => String(value)
  .replaceAll('\0', ' ')
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .slice(0, limit);
const normalizeResourceId = value => {
  const number = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(number) ? String(number) : '';
};

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'nikke-growth-calculator-v3477-full-favorite-audit/2.0' },
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
}

function matchBalancedObject(text, start) {
  if (text[start] !== '{') return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];
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
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function isCharacterRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && value.id !== undefined && value.name_code !== undefined
    && value.resource_id !== undefined && value.slug && value.skill1_id !== undefined
    && value.skill2_id !== undefined && value.ulti_skill_id !== undefined);
}

function walkForCharacters(value, output, seenObjects = new Set(), depth = 0) {
  if (depth > 18 || value === null || typeof value !== 'object' || seenObjects.has(value)) return;
  seenObjects.add(value);
  if (isCharacterRecord(value)) output.push(value);
  if (Array.isArray(value)) {
    for (const child of value) walkForCharacters(child, output, seenObjects, depth + 1);
  } else {
    for (const child of Object.values(value)) walkForCharacters(child, output, seenObjects, depth + 1);
  }
}

function parseJsonParseLiterals(text) {
  const parsed = [];
  const patterns = [
    { quote: "'", regex: /JSON\.parse\('((?:\\.|[^'\\])*)'\)/g },
    { quote: '"', regex: /JSON\.parse\("((?:\\.|[^"\\])*)"\)/g },
  ];
  for (const { quote, regex } of patterns) {
    for (const match of text.matchAll(regex)) {
      try {
        const decoded = Function(`"use strict";return ${quote}${match[1]}${quote}`)();
        parsed.push(JSON.parse(decoded));
      } catch (_) {
        // Keep auditing the other literals. Exact failures are not used as evidence.
      }
    }
  }
  return parsed;
}

function extractCharacterObjects(text) {
  const output = [];
  for (const parsed of parseJsonParseLiterals(text)) walkForCharacters(parsed, output);

  const patterns = [
    /\{"id":\d+,"name_localkey":/g,
    /\{"id":\d+,"name":/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = matchBalancedObject(text, match.index);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        if (isCharacterRecord(value)) output.push(value);
      } catch (_) {
        // A bundle may contain an object-shaped substring that is not standalone JSON.
      }
    }
  }

  const deduped = new Map();
  for (const record of output) {
    const key = `${record.id}|${record.name_code}|${record.resource_id}|${record.slug}`;
    const prior = deduped.get(key);
    if (!prior || (record.hasFavoriteItem === true && prior.hasFavoriteItem !== true)) deduped.set(key, record);
  }
  return [...deduped.values()];
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

function decodeEscapedPageSource(value) {
  return decodeHtml(value)
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0022/gi, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"');
}

function htmlToVisibleText(html) {
  return clean(decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6]|button)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')), 220000);
}

function contexts(text, terms, radius = 2600, maxPerTerm = 24) {
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

function normalizeSlot(value) {
  const text = String(value ?? '').replace(/[\s_-]+/g, '').toLocaleLowerCase('en-US');
  if (text.includes('burst') || text.includes('ulti')) return 'burst';
  if (text.includes('skill1')) return 'skill1';
  if (text.includes('skill2')) return 'skill2';
  return null;
}

function parsePhaseOrder(pageText) {
  const result = { 1: null, 2: null, 3: null };
  for (const phase of [1, 2, 3]) {
    const next = phase + 1;
    const patterns = [
      new RegExp(`PHASE\\s*${phase}([\\s\\S]{0,2200}?)(?=PHASE\\s*${next}|Base skills|Preview cumulative|SKILLS|$)`, 'i'),
      new RegExp(`Phase\\s*${phase}([\\s\\S]{0,2200}?)(?=Phase\\s*${next}|Base skills|Preview cumulative|Skills|$)`, 'i'),
    ];
    let segment = '';
    for (const pattern of patterns) {
      segment = pageText.match(pattern)?.[1] ?? '';
      if (segment) break;
    }
    const upgrade = segment.match(/Upgrades?\s+(Skill\s*1|Skill\s*2|Burst(?:\s*Skill)?|Ultimate(?:\s*Skill)?)/i)?.[1]
      ?? segment.match(/(Skill\s*1|Skill\s*2|Burst(?:\s*Skill)?|Ultimate(?:\s*Skill)?)\s+(?:Upgrade|Enhanced|Enhancement)/i)?.[1]
      ?? null;
    result[phase] = normalizeSlot(upgrade);
  }
  return result;
}

function sliceBetween(text, startTerms, endTerms, limit = 120000) {
  const lower = text.toLocaleLowerCase('en-US');
  let start = -1;
  let matchedLength = 0;
  for (const term of startTerms) {
    const position = lower.indexOf(term.toLocaleLowerCase('en-US'));
    if (position >= 0 && (start < 0 || position < start)) {
      start = position;
      matchedLength = term.length;
    }
  }
  if (start < 0) return '';
  let end = Math.min(text.length, start + limit);
  for (const term of endTerms) {
    const position = lower.indexOf(term.toLocaleLowerCase('en-US'), start + matchedLength);
    if (position >= 0) end = Math.min(end, position);
  }
  return clean(text.slice(start, end), limit);
}

function pageDisplayName(html, record) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const candidate = decodeHtml(og ?? title ?? record.name_localkey ?? record.name ?? record.slug);
  return clean(candidate.replace(/\s*[|·-]\s*ENIKK.*$/i, '').trim(), 300);
}

const crawlPath = `${OUT}/enikk-favorite-phase-crawl-v3477.json`;
if (!fs.existsSync(crawlPath)) throw new Error(`missing prerequisite ${crawlPath}`);
const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
const chunkUrls = [...new Set(crawl.discoveredChunkUrls ?? crawl.allChunkInventory?.map(entry => entry.url) ?? crawl.chunks.map(entry => entry.url))];
const characterRecords = new Map();
const chunkEvidence = [];
const fetchFailures = [];

let chunkCursor = 0;
async function chunkWorker() {
  while (true) {
    const index = chunkCursor++;
    if (index >= chunkUrls.length) return;
    const url = chunkUrls[index];
    try {
      const text = await fetchText(url);
      const records = extractCharacterObjects(text);
      if (records.length) chunkEvidence.push({
        url,
        sha256: sha256(text),
        bytes: Buffer.byteLength(text),
        parsedCharacters: records.length,
        favoriteFlaggedCharacters: records.filter(record => record.hasFavoriteItem === true).length,
      });
      for (const record of records) {
        const key = `${record.id}|${record.name_code}|${record.resource_id}|${record.slug}`;
        const prior = characterRecords.get(key);
        if (!prior || (record.hasFavoriteItem === true && prior.hasFavoriteItem !== true)) characterRecords.set(key, record);
      }
    } catch (error) {
      fetchFailures.push({ url, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(16, chunkUrls.length || 1) }, chunkWorker));
chunkEvidence.sort((a, b) => a.url.localeCompare(b.url));
fetchFailures.sort((a, b) => a.url.localeCompare(b.url));

const allCharacters = [...characterRecords.values()];
const byResource = new Map();
for (const record of allCharacters) {
  const key = normalizeResourceId(record.resource_id);
  if (!byResource.has(key)) byResource.set(key, []);
  byResource.get(key).push(record);
}
for (const records of byResource.values()) {
  records.sort((a, b) => Number(b.hasFavoriteItem === true) - Number(a.hasFavoriteItem === true)
    || Number(a.order ?? Number.MAX_SAFE_INTEGER) - Number(b.order ?? Number.MAX_SAFE_INTEGER));
}

const favoriteMaster = JSON.parse(fs.readFileSync(`${OUT}/enikk-favorite-master-raw-v3477.json`, 'utf8'));
const masterItems = Object.entries(favoriteMaster)
  .filter(([, item]) => item?.rare === 'SSR' && item?.type === 'Favorite')
  .map(([tid, item]) => {
    const resourceId = String(item.icon ?? '').match(/c(\d+)_00$/i)?.[1] ?? '';
    return { tid, ...item, masterResourceId: normalizeResourceId(resourceId) };
  })
  .sort((a, b) => Number(a.tid) - Number(b.tid));

const resolutions = masterItems.map(item => {
  const resourceMatches = byResource.get(item.masterResourceId) ?? [];
  const nameCodeMatches = allCharacters.filter(record => String(record.name_code) === String(item.nameCode));
  const matches = resourceMatches.length ? resourceMatches : nameCodeMatches;
  return {
    item,
    method: resourceMatches.length ? 'favorite-icon-resource-id' : (nameCodeMatches.length ? 'master-nameCode-fallback' : 'unresolved'),
    matches,
    character: matches[0] ?? null,
  };
});

const unresolved = resolutions.filter(resolution => !resolution.character);
if (masterItems.length !== 21) throw new Error(`expected 21 SSR Favorite master items, found ${masterItems.length}`);
if (unresolved.length) {
  throw new Error(`unresolved favorite master TIDs: ${unresolved.map(entry => entry.item.tid).join(', ')}`);
}

const rows = [];
let pageCursor = 0;
async function pageWorker() {
  while (true) {
    const index = pageCursor++;
    if (index >= resolutions.length) return;
    const resolution = resolutions[index];
    const { item, character: record } = resolution;
    const pageUrl = `${ORIGIN}/characters/${record.slug}`;
    const html = await fetchText(pageUrl);
    const visibleText = htmlToVisibleText(html);
    const decodedSource = decodeEscapedPageSource(html);
    const combinedText = clean(`${visibleText}\n\n${decodedSource}`, 450000);
    const phaseOrder = parsePhaseOrder(combinedText);
    const scriptUrls = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], pageUrl).href))];
    const evidenceTerms = [
      'PHASE 1', 'PHASE 2', 'PHASE 3', 'Upgrades Skill', 'Upgrades Burst',
      'Preview cumulative skill upgrades', 'favoriteItem', 'hasFavoriteItem',
      String(record.skill1_id), String(record.skill2_id), String(record.ulti_skill_id),
      'CharacterSkill', 'StateEffect', String(item.tid), String(item.icon),
    ];
    rows[index] = {
      character: {
        id: record.id,
        name: pageDisplayName(html, record),
        nameLocalKey: record.name_localkey ?? null,
        slug: record.slug,
        nameCode: record.name_code,
        resourceId: record.resource_id,
        hasFavoriteItemFlag: record.hasFavoriteItem === true,
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
      favoriteItem: item,
      mapping: {
        method: resolution.method,
        masterResourceId: item.masterResourceId,
        matchCount: resolution.matches.length,
        matchedCharacterIds: resolution.matches.map(match => match.id),
      },
      page: {
        url: pageUrl,
        bytes: Buffer.byteLength(html),
        sha256: sha256(html),
        phaseOrder,
        phaseOrderComplete: Object.values(phaseOrder).every(Boolean),
        treasureText: sliceBetween(combinedText, ['TREASURE', 'Favorite Item', item.name], ['USAGE', 'SQUAD', 'Recommended Team'], 150000),
        skillSectionText: sliceBetween(combinedText, ['SKILLS', 'Skills'], ['USAGE', 'SQUAD', 'Recommended Team'], 150000),
        contexts: contexts(combinedText, evidenceTerms, 3600, 40),
        scriptUrls,
      },
    };
  }
}
await Promise.all(Array.from({ length: Math.min(6, resolutions.length) }, pageWorker));

const resolvedTids = new Set(rows.map(row => row.favoriteItem.tid));
const report = {
  auditVersion: 2,
  evidenceRule: 'The 21-character roster is driven by the 21 literal SSR Favorite master TIDs. Each item is joined to the deployed character master by the c### resource ID encoded in its icon; nameCode is only a recorded fallback. Phase order and skill excerpts come from each deployed ENIKK character page.',
  fetchedAtUtc: new Date().toISOString(),
  counts: {
    discoveredChunks: chunkUrls.length,
    fetchedChunkFailures: fetchFailures.length,
    parsedCharacterRecords: allCharacters.length,
    favoriteMasterItems: masterItems.length,
    resolvedFavoriteTids: resolvedTids.size,
    favoriteCharacters: rows.length,
    completePhaseOrders: rows.filter(row => row.page.phaseOrderComplete).length,
  },
  chunkEvidence,
  fetchFailures,
  unresolvedMasterTids: masterItems.map(item => item.tid).filter(tid => !resolvedTids.has(tid)),
  duplicateResourceMatches: resolutions.filter(resolution => resolution.matches.length !== 1).map(resolution => ({
    tid: resolution.item.tid,
    resourceId: resolution.item.masterResourceId,
    method: resolution.method,
    matches: resolution.matches.map(record => ({ id: record.id, name: record.name_localkey, slug: record.slug, nameCode: record.name_code, resourceId: record.resource_id })),
  })),
  characters: rows,
};
fs.writeFileSync(`${OUT}/enikk-favorite-characters-v3477.json`, JSON.stringify(report, null, 2));

const lines = [
  '# ENIKK complete favorite-character roster — V34.7.7',
  '',
  '> 21개 SSR Favorite 마스터 TID를 기준으로 전원 추출했다. 캐릭터 결합은 애장품 아이콘의 c### 자원번호를 우선 사용하며 추측값을 채우지 않는다.',
  '',
  `- Discovered chunks: **${report.counts.discoveredChunks}**`,
  `- Parsed character records: **${report.counts.parsedCharacterRecords}**`,
  `- SSR Favorite master items: **${report.counts.favoriteMasterItems}**`,
  `- Favorite characters resolved: **${report.counts.favoriteCharacters}**`,
  `- TIDs resolved: **${report.counts.resolvedFavoriteTids}**`,
  `- Complete three-phase orders: **${report.counts.completePhaseOrders}**`,
  `- Unresolved TIDs: **${report.unresolvedMasterTids.join(', ') || '(none)'}**`,
  '',
  '## Roster',
  '',
  '| Character | slug | nameCode | resource | TID | Phase 1 | Phase 2 | Phase 3 |',
  '|---|---|---:|---:|---:|---|---|---|',
  ...rows.map(row => {
    const order = row.page.phaseOrder;
    return `| ${row.character.name} | ${row.character.slug} | ${row.character.nameCode} | ${row.character.resourceId} | ${row.favoriteItem.tid} | ${order[1] ?? '—'} | ${order[2] ?? '—'} | ${order[3] ?? '—'} |`;
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
  duplicateResourceMatches: report.duplicateResourceMatches,
  roster: rows.map(row => ({
    name: row.character.name,
    slug: row.character.slug,
    nameCode: row.character.nameCode,
    resourceId: row.character.resourceId,
    tid: row.favoriteItem.tid,
    mapping: row.mapping.method,
    phaseOrder: row.page.phaseOrder,
  })),
}, null, 2));
