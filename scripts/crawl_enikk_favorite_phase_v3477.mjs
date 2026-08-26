#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ORIGIN = 'https://enikk.app';
const ENTRY = `${ORIGIN}/soloraid/40`;
const OUT = 'audit';
fs.mkdirSync(OUT, { recursive: true });

const strongTerms = [
  'favoriteItemLv', 'favoriteItemTid', 'favoriteItemPhase', 'favorite_item',
  'skill1Lv', 'skill2Lv', 'ultiSkillLv',
  '200401', '200501', '201001', 'si_favoriteitem_c100_00',
  'si_favoriteitem_c112_00', 'si_favoriteitem_c030_00',
  'Laplace', 'Sugar', 'Poli', '라플라스', '슈가', '폴리',
];
const structureTerms = [
  'phase', 'Phase', 'skill1', 'skill2', 'burst', 'ultiSkill',
  'favorite', 'Favorite', 'treasure', 'Treasure',
];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const compact = (value, limit = 2600) => String(value)
  .replaceAll('\0', ' ')
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .slice(0, limit);

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'nikke-growth-calculator-v3477-phase-audit/1.0' },
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
}

function contexts(text, term, max = 30, radius = 1300) {
  const out = [];
  const hay = text.toLocaleLowerCase('en-US');
  const needle = term.toLocaleLowerCase('en-US');
  let start = 0;
  while (out.length < max) {
    const offset = hay.indexOf(needle, start);
    if (offset < 0) break;
    out.push({ term, offset, context: compact(text.slice(Math.max(0, offset - radius), Math.min(text.length, offset + term.length + radius))) });
    start = offset + Math.max(1, needle.length);
  }
  return out;
}

const html = await fetchText(ENTRY);
const urls = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/g)) {
  urls.add(new URL(match[1], ENTRY).href);
}
const runtimeUrl = [...urls].find(url => /webpack-[^/]+\.js/.test(url));
if (!runtimeUrl) throw new Error('webpack runtime not found');
const runtime = await fetchText(runtimeUrl);
for (const match of runtime.matchAll(/(?:^|[,{}])\s*(\d+)\s*:\s*["']([A-Za-z0-9_-]{4,})["']/g)) {
  urls.add(`${ORIGIN}/_next/static/chunks/${match[1]}.${match[2]}.js`);
}
// Capture any literal Next chunk path present in the page/runtime as well.
for (const source of [html, runtime]) {
  for (const match of source.matchAll(/(?:https?:\/\/[^"'\\\s]+)?\/_next\/static\/chunks\/[^"'\\\s]+\.js/g)) {
    urls.add(new URL(match[0], ORIGIN).href);
  }
}

const queue = [...urls].sort();
const results = [];
const failures = [];
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= queue.length) return;
    const url = queue[index];
    try {
      const text = url === runtimeUrl ? runtime : await fetchText(url);
      const strong = strongTerms.filter(term => text.toLocaleLowerCase('en-US').includes(term.toLocaleLowerCase('en-US')));
      if (!strong.length) continue;
      const hits = [];
      for (const term of [...strongTerms, ...structureTerms]) {
        if (text.toLocaleLowerCase('en-US').includes(term.toLocaleLowerCase('en-US'))) hits.push(...contexts(text, term));
      }
      const endpoints = [...new Set([
        ...[...text.matchAll(/https?:\/\/[^\s"'`<>\\]{5,500}/g)].map(match => match[0]),
        ...[...text.matchAll(/["'`](\/(?:api|graphql|trpc|nikke|master|data)[^"'`\\\s]{1,500})["'`]/gi)].map(match => new URL(match[1], ORIGIN).href),
      ])].filter(value => /api|graphql|trpc|master|skill|favorite|nikke|enikk/i.test(value)).slice(0, 400);
      results.push({
        url,
        bytes: Buffer.byteLength(text),
        sha256: sha256(text),
        strongTerms: strong,
        hits: hits.slice(0, 1000),
        endpoints,
      });
    } catch (error) {
      failures.push({ url, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(16, queue.length || 1) }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
failures.sort((a, b) => a.url.localeCompare(b.url));

const cross = {};
for (const term of strongTerms) {
  cross[term] = results.filter(result => result.strongTerms.some(value => value.toLocaleLowerCase('en-US') === term.toLocaleLowerCase('en-US'))).map(result => result.url);
}
const report = {
  auditVersion: 1,
  evidenceRule: 'All excerpts are literal bytes fetched from the deployed ENIKK Next.js application. No phase or skill rule is inferred here.',
  fetchedAtUtc: new Date().toISOString(),
  entry: { url: ENTRY, bytes: Buffer.byteLength(html), sha256: sha256(html) },
  runtime: { url: runtimeUrl, bytes: Buffer.byteLength(runtime), sha256: sha256(runtime) },
  discoveredChunkCount: queue.length,
  relevantChunkCount: results.length,
  failureCount: failures.length,
  crossReference: cross,
  chunks: results,
  failures,
};
fs.writeFileSync(`${OUT}/enikk-favorite-phase-crawl-v3477.json`, JSON.stringify(report, null, 2));

const lines = [
  '# ENIKK deployed phase/skill crawl — V34.7.7',
  '',
  '> Literal deployed-byte evidence only. No phase/skill rule is guessed.',
  '',
  `- Entry: \`${ENTRY}\``,
  `- Runtime: \`${runtimeUrl}\``,
  `- Discovered chunks: **${queue.length}**`,
  `- Relevant chunks: **${results.length}**`,
  `- Fetch failures: **${failures.length}**`,
  '',
  '## Strong-term cross-reference',
  ...strongTerms.flatMap(term => [
    `### ${term}`,
    ...(cross[term].length ? cross[term].map(url => `- \`${url}\``) : ['- (none)']),
  ]),
  '',
  '## Relevant chunks',
  ...results.map(result => `- \`${result.url}\` — ${result.strongTerms.join(', ')} — SHA-256 \`${result.sha256}\``),
  '',
  '## Full excerpts',
  '- `audit/enikk-favorite-phase-crawl-v3477.json`',
];
fs.writeFileSync(`${OUT}/enikk-favorite-phase-crawl-v3477.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({
  discoveredChunkCount: queue.length,
  relevantChunkCount: results.length,
  failureCount: failures.length,
  crossReference: cross,
}, null, 2));
