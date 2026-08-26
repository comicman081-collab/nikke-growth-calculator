#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'audit';
fs.mkdirSync(OUT, { recursive: true });

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fetchText = async url => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'nikke-growth-calculator-v3477-audit/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
};
const clean = (value, limit = 5000) => String(value)
  .replaceAll('\0', ' ')
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .slice(0, limit);

const homeUrl = 'https://enikk.app/soloraid/40';
const home = await fetchText(homeUrl);
const runtimeSrc = [...home.matchAll(/(?:src|href)=["']([^"']*webpack-[^"']+\.js)["']/g)][0]?.[1];
if (!runtimeSrc) throw new Error('ENIKK webpack runtime was not found in the solo-raid page');
const runtimeUrl = new URL(runtimeSrc, homeUrl).href;
const runtime = await fetchText(runtimeUrl);

const chunkId = '1741';
const chunkHash = runtime.match(new RegExp(`${chunkId}:\"([^\"]+)\"`))?.[1]
  ?? runtime.match(new RegExp(`${chunkId}:["']([^"']+)["']`))?.[1];
if (!chunkHash) throw new Error(`ENIKK chunk ${chunkId} hash was not found in webpack runtime`);
const chunkUrl = new URL(`/_next/static/chunks/${chunkId}.${chunkHash}.js`, homeUrl).href;
const chunk = await fetchText(chunkUrl);

// Parse every JSON.parse('...') literal in the authoritative chunk. We select the
// largest structured candidate but retain metadata for every candidate so the choice
// is reviewable and no schema/value is guessed.
const candidates = [];
const literalPattern = /JSON\.parse\('((?:\\.|[^'\\])*)'\)/g;
for (const match of chunk.matchAll(literalPattern)) {
  try {
    const decoded = Function(`"use strict";return '${match[1]}'`)();
    const parsed = JSON.parse(decoded);
    const structured = parsed !== null && typeof parsed === 'object';
    const length = decoded.length;
    candidates.push({
      offset: match.index,
      decoded,
      parsed,
      structured,
      length,
      rootType: Array.isArray(parsed) ? 'array' : typeof parsed,
      rootCount: Array.isArray(parsed)
        ? parsed.length
        : (structured ? Object.keys(parsed).length : 0),
    });
  } catch (error) {
    candidates.push({ offset: match.index, error: String(error), structured: false, length: match[1].length });
  }
}
if (!candidates.some(candidate => candidate.structured)) {
  throw new Error(`No structured JSON.parse candidate found in ${chunkUrl}`);
}
const selectedIndex = candidates
  .map((candidate, index) => ({ index, score: candidate.structured ? candidate.length : -1 }))
  .sort((a, b) => b.score - a.score)[0].index;
const selected = candidates[selectedIndex];
const master = selected.parsed;

const entries = Array.isArray(master)
  ? master.map((value, index) => ({ __rootIndex: index, value }))
  : Object.entries(master).map(([key, value]) => ({ __rootKey: key, value }));
const expandedEntries = entries.map(wrapper => {
  const value = wrapper.value;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...wrapper, ...value }
    : wrapper;
});

const targetNames = ['Poli', 'Sugar', 'Laplace', '폴리', '슈가', '라플라스'];
const sourceTerms = [
  'favoriteItemPhase', 'favorite_item_phase', 'favoriteitemphase',
  'favorite item', 'favorite_item', 'favoriteitem', 'treasure', '애장품',
  'sugarTreasure', 'poliTreasure', 'laplaceTreasure',
];

const appText = fs.readFileSync('index.html', 'utf8');
const contextsFor = (term, max = 30, before = 1800, after = 4200) => {
  const out = [];
  const lower = appText.toLocaleLowerCase('en-US');
  const needle = term.toLocaleLowerCase('en-US');
  let start = 0;
  while (out.length < max) {
    const offset = lower.indexOf(needle, start);
    if (offset < 0) break;
    out.push({
      term,
      offset,
      context: clean(appText.slice(Math.max(0, offset - before), Math.min(appText.length, offset + term.length + after))),
    });
    start = offset + Math.max(1, needle.length);
  }
  return out;
};
const appContexts = [...sourceTerms, ...targetNames, 'V34.7.6', '34.7.6']
  .flatMap(term => contextsFor(term));

const numericTokensByTarget = {};
for (const target of targetNames) {
  const contexts = contextsFor(target, 80, 2500, 5000);
  numericTokensByTarget[target] = [...new Set(contexts.flatMap(hit =>
    [...hit.context.matchAll(/(?<!\d)\d{5,14}(?!\d)/g)].map(match => match[0])
  ))].sort();
}
const allAppNumericTokens = [...new Set(Object.values(numericTokensByTarget).flat())];

const serializedEntry = entry => JSON.stringify(entry);
const targetMatches = {};
for (const target of targetNames) {
  const needle = target.toLocaleLowerCase('en-US');
  targetMatches[target] = expandedEntries.filter(entry =>
    serializedEntry(entry).toLocaleLowerCase('en-US').includes(needle)
  );
}

// Cross-reference only tokens that literally appear near a named target in the app.
// The result is evidence of co-occurrence, not an inferred identity mapping.
const tokenMatches = {};
for (const token of allAppNumericTokens) {
  const matches = expandedEntries.filter(entry => serializedEntry(entry).includes(token));
  if (matches.length) tokenMatches[token] = matches;
}

const fieldStats = new Map();
const visit = (value, parts = []) => {
  if (Array.isArray(value)) {
    value.slice(0, 5000).forEach((item, index) => visit(item, [...parts, `[${index}]`]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = [...parts, key];
      if (/(tid|phase|skill|level|character|favorite|treasure|item|id)/i.test(key)) {
        const canonicalPath = next.map(part => /^\[\d+\]$/.test(part) ? '[]' : part).join('.');
        const stat = fieldStats.get(canonicalPath) ?? { path: canonicalPath, samples: [], types: new Set(), count: 0 };
        stat.count += 1;
        stat.types.add(Array.isArray(child) ? 'array' : (child === null ? 'null' : typeof child));
        if (stat.samples.length < 30 && !stat.samples.some(sample => JSON.stringify(sample) === JSON.stringify(child))) {
          stat.samples.push(child);
        }
        fieldStats.set(canonicalPath, stat);
      }
      visit(child, next);
    }
  }
};
visit(master);
const relevantFieldStats = [...fieldStats.values()]
  .map(stat => ({ ...stat, types: [...stat.types].sort() }))
  .sort((a, b) => a.path.localeCompare(b.path));

const masterRawPath = path.join(OUT, 'enikk-favorite-master-raw-v3477.json');
fs.writeFileSync(masterRawPath, JSON.stringify(master, null, 2));

const evidence = {
  auditVersion: 3,
  evidenceRule: 'No TID, phase, skill variant, or level rule is inferred. Values below are literal ENIKK/app source observations.',
  fetchedAtUtc: new Date().toISOString(),
  source: {
    homeUrl,
    runtimeUrl,
    chunkId,
    chunkHash,
    chunkUrl,
    homeSha256: sha256(home),
    runtimeSha256: sha256(runtime),
    chunkSha256: sha256(chunk),
    chunkBytes: Buffer.byteLength(chunk),
  },
  parser: {
    selectedIndex,
    candidates: candidates.map((candidate, index) => ({
      index,
      offset: candidate.offset,
      structured: candidate.structured,
      length: candidate.length,
      rootType: candidate.rootType,
      rootCount: candidate.rootCount,
      error: candidate.error,
    })),
  },
  master: {
    rootType: Array.isArray(master) ? 'array' : typeof master,
    rootCount: Array.isArray(master) ? master.length : Object.keys(master).length,
    rootKeys: Array.isArray(master) ? [] : Object.keys(master),
    entryCount: expandedEntries.length,
    entryFields: [...new Set(expandedEntries.flatMap(entry => Object.keys(entry)))].sort(),
    relevantFieldStats,
    firstEntries: expandedEntries.slice(0, 60),
  },
  targets: {
    literalNameMatches: targetMatches,
    appNumericTokensNearNamedTargets: numericTokensByTarget,
    masterEntriesContainingThoseTokens: tokenMatches,
  },
  app: {
    indexBytes: Buffer.byteLength(appText),
    indexSha256: sha256(appText),
    favoriteItemPhaseExactCount: appText.split('favoriteItemPhase').length - 1,
    contexts: appContexts,
  },
};
fs.writeFileSync(path.join(OUT, 'enikk-favorite-master-evidence-v3477.json'), JSON.stringify(evidence, null, 2));

const lines = [
  '# Live ENIKK favorite master evidence — V34.7.7',
  '',
  '> Literal extraction only. TIDs, phases, skill variants, and level behavior are not guessed.',
  '',
  `- Source chunk: \`${chunkUrl}\``,
  `- Chunk SHA-256: \`${evidence.source.chunkSha256}\``,
  `- Parsed JSON candidates: **${candidates.length}**; selected candidate: **${selectedIndex}**`,
  `- Master root: **${evidence.master.rootType}**, entries/keys: **${evidence.master.entryCount}**`,
  `- App \`favoriteItemPhase\` exact occurrences: **${evidence.app.favoriteItemPhaseExactCount}**`,
  '',
  '## Master fields containing TID / phase / skill / level / item semantics',
  '',
  ...relevantFieldStats.map(stat => `- \`${stat.path}\` — count=${stat.count}; types=${stat.types.join(', ')}; samples=${clean(JSON.stringify(stat.samples), 1400)}`),
  '',
  '## Literal target-name matches in the master',
  '',
  ...targetNames.map(name => `- ${name}: **${targetMatches[name].length}**`),
  '',
  '## Evidence files',
  '',
  '- `audit/enikk-favorite-master-raw-v3477.json` — complete parsed master candidate',
  '- `audit/enikk-favorite-master-evidence-v3477.json` — source hashes, schema, target/token cross-reference, and app consumer snippets',
];
fs.writeFileSync(path.join(OUT, 'enikk-favorite-master-evidence-v3477.md'), lines.join('\n') + '\n');

console.log(JSON.stringify({
  chunkUrl,
  chunkSha256: evidence.source.chunkSha256,
  selectedIndex,
  rootType: evidence.master.rootType,
  entryCount: evidence.master.entryCount,
  relevantFieldPaths: relevantFieldStats.map(stat => stat.path),
  literalTargetMatches: Object.fromEntries(targetNames.map(name => [name, targetMatches[name].length])),
  appFavoriteItemPhaseCount: evidence.app.favoriteItemPhaseExactCount,
}, null, 2));
