#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ORIGIN = 'https://enikk.app';
const PATH = 'audit/enikk-favorite-characters-v3477.json';
const MD_PATH = 'audit/enikk-favorite-characters-v3477.md';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'nikke-growth-calculator-v3477-page-enrichment/1.0' },
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
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

function visibleText(html) {
  return decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6]|button|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slot(value) {
  const normalized = String(value ?? '').replace(/[\s_-]+/g, '').toLowerCase();
  if (normalized.includes('burst') || normalized.includes('ultimate')) return 'burst';
  if (normalized.includes('skill1')) return 'skill1';
  if (normalized.includes('skill2')) return 'skill2';
  return null;
}

function parsePage(text, itemName) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const phaseOrder = { 1: null, 2: null, 3: null };
  const phaseNames = { 1: null, 2: null, 3: null };

  for (const phase of [1, 2, 3]) {
    const phaseIndex = lines.findIndex(line => new RegExp(`^PHASE\\s*${phase}(?:\\s|$)`, 'i').test(line));
    if (phaseIndex < 0) continue;
    const window = lines.slice(phaseIndex + 1, phaseIndex + 9);
    const upgradeIndex = window.findIndex(line => /^Upgrades?\s+/i.test(line));
    if (upgradeIndex >= 0) {
      phaseOrder[phase] = slot(window[upgradeIndex].replace(/^Upgrades?\s+/i, ''));
      phaseNames[phase] = window.slice(0, upgradeIndex).find(line => !/^\+?\d/.test(line) && !/Quest unlock/i.test(line)) ?? null;
    }
  }

  const cards = [];
  for (const phase of [1, 2, 3]) {
    const marker = `Treasure · Phase ${phase}`;
    const markerIndex = lines.findIndex(line => line.toLowerCase() === marker.toLowerCase());
    if (markerIndex < 0) continue;
    let slotIndex = markerIndex - 1;
    while (slotIndex >= Math.max(0, markerIndex - 5) && !slot(lines[slotIndex])) slotIndex -= 1;
    const skillSlot = slotIndex >= 0 ? slot(lines[slotIndex]) : phaseOrder[phase];
    const name = slotIndex > 0 ? lines[slotIndex - 1] : phaseNames[phase];
    const nextMarkerIndex = [1, 2, 3]
      .filter(other => other !== phase)
      .map(other => lines.findIndex(line => line.toLowerCase() === `Treasure · Phase ${other}`.toLowerCase()))
      .filter(index => index > markerIndex)
      .sort((a, b) => a - b)[0] ?? lines.findIndex((line, index) => index > markerIndex && /^USAGE$/i.test(line));
    const blockEnd = nextMarkerIndex > markerIndex ? nextMarkerIndex : Math.min(lines.length, markerIndex + 70);
    const blockStart = Math.max(0, slotIndex - 1);
    const rawBlock = lines.slice(blockStart, blockEnd);
    while (rawBlock.length && /^(?:LVL\s*10|Compare base)$/i.test(rawBlock[rawBlock.length - 1])) rawBlock.pop();
    const compareIndex = rawBlock.findIndex(line => /^Compare base$/i.test(line));
    const description = rawBlock.slice(compareIndex >= 0 ? compareIndex + 1 : Math.min(rawBlock.length, markerIndex - blockStart + 1)).join('\n').trim();
    const numericTokens = [...new Set([...description.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?%?(?![\w.])/g)].map(match => match[0]))];
    cards.push({ phase, slot: skillSlot, name, marker, description, numericTokens, rawBlock });
  }

  const treasureStart = lines.findIndex(line => line.toLowerCase() === `treasure ${itemName}`.toLowerCase());
  const usageIndex = lines.findIndex((line, index) => index > treasureStart && /^USAGE$/i.test(line));
  const panel = treasureStart >= 0
    ? lines.slice(treasureStart, usageIndex > treasureStart ? usageIndex : Math.min(lines.length, treasureStart + 220)).join('\n')
    : '';

  return {
    phaseOrder,
    phaseNames,
    phaseOrderComplete: Object.values(phaseOrder).every(Boolean),
    favoriteSkillCards: cards.sort((a, b) => a.phase - b.phase),
    favoriteSkillCardsComplete: cards.length === 3 && cards.every(card => card.slot && card.description),
    favoritePanelText: panel,
    lineCount: lines.length,
  };
}

const report = JSON.parse(fs.readFileSync(PATH, 'utf8'));
let cursor = 0;
const failures = [];
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= report.characters.length) return;
    const row = report.characters[index];
    const url = row.page?.url || `${ORIGIN}/characters/${row.character.slug}`;
    try {
      const html = await fetchText(url);
      const text = visibleText(html);
      const parsed = parsePage(text, row.favoriteItem.name);
      row.page = {
        ...row.page,
        url,
        bytes: Buffer.byteLength(html),
        sha256: sha256(html),
        visibleTextSha256: sha256(text),
        ...parsed,
      };
    } catch (error) {
      failures.push({ slug: row.character.slug, url, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(6, report.characters.length) }, worker));

report.auditVersion = Math.max(3, Number(report.auditVersion) || 0);
report.pageEnrichment = {
  fetchedAtUtc: new Date().toISOString(),
  failures,
  completePhaseOrders: report.characters.filter(row => row.page.phaseOrderComplete).length,
  completeFavoriteSkillCards: report.characters.filter(row => row.page.favoriteSkillCardsComplete).length,
};
report.counts.completePhaseOrders = report.pageEnrichment.completePhaseOrders;
report.counts.completeFavoriteSkillCards = report.pageEnrichment.completeFavoriteSkillCards;
fs.writeFileSync(PATH, JSON.stringify(report, null, 2));

const lines = [
  '# ENIKK complete favorite-character roster — V34.7.7',
  '',
  '> 21개 SSR Favorite 마스터 TID와 각 ENIKK 캐릭터 페이지의 Phase 1~3 스킬 카드를 직접 대조했다.',
  '',
  `- Favorite master items: **${report.counts.favoriteMasterItems}**`,
  `- Favorite characters resolved: **${report.counts.favoriteCharacters}**`,
  `- Complete three-phase orders: **${report.counts.completePhaseOrders}**`,
  `- Complete three-card skill extracts: **${report.counts.completeFavoriteSkillCards}**`,
  `- Page fetch failures: **${failures.length}**`,
  `- Unresolved TIDs: **${report.unresolvedMasterTids.join(', ') || '(none)'}**`,
  '',
  '## Roster',
  '',
  '| Character | slug | nameCode | resource | TID | Phase 1 | Phase 2 | Phase 3 |',
  '|---|---|---:|---:|---:|---|---|---|',
  ...report.characters.map(row => {
    const order = row.page.phaseOrder;
    return `| ${row.character.name.replace(/\s+-\s+.*$/, '')} | ${row.character.slug} | ${row.character.nameCode} | ${row.character.resourceId} | ${row.favoriteItem.tid} | ${order[1] ?? '—'} | ${order[2] ?? '—'} | ${order[3] ?? '—'} |`;
  }),
  '',
  '## Full evidence',
  '',
  '- `audit/enikk-favorite-characters-v3477.json`',
];
fs.writeFileSync(MD_PATH, lines.join('\n') + '\n');

const summary = {
  counts: report.counts,
  failures,
  roster: report.characters.map(row => ({
    character: row.character.name.replace(/\s+-\s+.*$/, ''),
    slug: row.character.slug,
    tid: row.favoriteItem.tid,
    phaseOrder: row.page.phaseOrder,
    cards: row.page.favoriteSkillCards.map(card => ({ phase: card.phase, slot: card.slot, name: card.name, numericTokens: card.numericTokens })),
  })),
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length || report.counts.completePhaseOrders !== 21 || report.counts.completeFavoriteSkillCards !== 21) {
  throw new Error(`incomplete favorite page enrichment: phaseOrders=${report.counts.completePhaseOrders}/21 cards=${report.counts.completeFavoriteSkillCards}/21 failures=${failures.length}`);
}
