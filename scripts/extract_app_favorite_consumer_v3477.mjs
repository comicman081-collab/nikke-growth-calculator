#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const sourcePath = 'index.html';
const outDir = 'audit';
fs.mkdirSync(outDir, { recursive: true });
const source = fs.readFileSync(sourcePath, 'utf8');
const lower = source.toLocaleLowerCase('en-US');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, limit = 6000) => String(value)
  .replaceAll('\0', ' ')
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .slice(0, limit);

const terms = [
  'favoriteItemPhase', 'favoriteItemTid', 'favoriteItem', 'favorite_item',
  'favorite item', 'favorite-item', 'treasure', '애장품',
  'poliTreasure', 'sugarTreasure', 'laplaceTreasure',
  'Poli', 'Sugar', 'Laplace', '폴리', '슈가', '라플라스',
  'c030', 'c112', 'c100', '201001', '200501', '200401',
  'skillLevels', 'skillLevel', 'skills', 'blabla', 'nameCode',
];

const lineStarts = [0];
for (let i = 0; i < source.length; i += 1) if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
const lineColumnAt = offset => {
  let lo = 0;
  let hi = lineStarts.length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid;
  }
  return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
};
const offsetsFor = (term, max = 160) => {
  const needle = term.toLocaleLowerCase('en-US');
  const offsets = [];
  let start = 0;
  while (offsets.length < max) {
    const offset = lower.indexOf(needle, start);
    if (offset < 0) break;
    offsets.push(offset);
    start = offset + Math.max(1, needle.length);
  }
  return offsets;
};
const localDeclarationWindow = offset => {
  const localStart = Math.max(0, offset - 14000);
  const prefix = source.slice(localStart, offset);
  const declaration = /(?:^|\n)\s*(?:async\s+function|function|const|let|var|class)\s+/g;
  let last = null;
  for (const match of prefix.matchAll(declaration)) last = match;
  const start = last ? localStart + last.index + (last[0].startsWith('\n') ? 1 : 0) : Math.max(0, offset - 1800);
  return clean(source.slice(start, Math.min(source.length, Math.max(offset + 3200, start + 7000))), 11000);
};
const makeHit = (term, offset) => {
  const lineStart = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextLine = source.indexOf('\n', offset);
  const lineEnd = nextLine < 0 ? source.length : nextLine;
  return {
    term,
    offset,
    ...lineColumnAt(offset),
    lineText: clean(source.slice(lineStart, lineEnd), 16000),
    context: clean(source.slice(Math.max(0, offset - 1500), Math.min(source.length, offset + term.length + 3000)), 7500),
    declarationWindow: localDeclarationWindow(offset),
  };
};

const offsetsByTerm = Object.fromEntries(terms.map(term => [term, offsetsFor(term)]));
const counts = Object.fromEntries(terms.map(term => [term, offsetsByTerm[term].length]));
const richTerms = new Set([
  'favoriteItemPhase', 'favoriteItemTid', 'favoriteItem', 'treasure', '애장품',
  'poliTreasure', 'sugarTreasure', 'laplaceTreasure',
  'Poli', 'Sugar', 'Laplace', '폴리', '슈가', '라플라스',
  'c030', 'c112', 'c100', '201001', '200501', '200401',
]);
const hitsByTerm = Object.fromEntries([...richTerms].map(term => [
  term,
  offsetsByTerm[term].slice(0, 50).map(offset => makeHit(term, offset)),
]));

const phaseHits = hitsByTerm.favoriteItemPhase;
const phaseEvidenceText = phaseHits.map(hit => `${hit.context}\n${hit.declarationWindow}`).join('\n---PHASE-HIT---\n');
const uniqueMatches = pattern => [...new Set([...phaseEvidenceText.matchAll(pattern)].map(match => clean(match[0], 1500)))];
const phaseComparisons = uniqueMatches(/favoriteItemPhase\s*(?:===|!==|==|!=|>=|<=|>|<)\s*[^\s,;)\]}]+|[^\s,;({\[]+\s*(?:===|!==|==|!=|>=|<=|>|<)\s*favoriteItemPhase/gi);
const phaseAssignments = uniqueMatches(/(?:[A-Za-z_$][\w$]*\.)*favoriteItemPhase\s*(?:=|\?\?=|\|\|=|&&=)\s*[^;\n]{0,500}/gi);
const phaseReads = uniqueMatches(/[^\n;{}]{0,240}(?:\?|\.)?favoriteItemPhase[^\n;{}]{0,500}/gi);
const phaseValues = [...new Set(phaseReads.flatMap(value =>
  [...value.matchAll(/(?<!\d)-?\d+(?:\.\d+)?(?!\d)/g)].map(match => match[0])
))].sort();

const targetSpecs = [
  { key: 'poli', names: ['Poli', '폴리'], code: 'c030', tid: '201001' },
  { key: 'sugar', names: ['Sugar', '슈가'], code: 'c112', tid: '200501' },
  { key: 'laplace', names: ['Laplace', '라플라스'], code: 'c100', tid: '200401' },
];
const targets = {};
for (const target of targetSpecs) {
  const targetTerms = [...target.names, target.code, target.tid, `${target.key}Treasure`];
  const occurrences = targetTerms.flatMap(term => hitsByTerm[term] ?? []);
  const combined = occurrences.map(hit => `${hit.context}\n${hit.declarationWindow}`).join('\n');
  targets[target.key] = {
    ...target,
    termCounts: Object.fromEntries(targetTerms.map(term => [term, counts[term] ?? 0])),
    numericTokens: [...new Set([...combined.matchAll(/(?<!\d)\d{3,14}(?!\d)/g)].map(match => match[0]))].sort(),
    identifiers: [...new Set([...combined.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]{3,80}\b/g)].map(match => match[0]))]
      .filter(value => /(?:skill|favorite|treasure|phase|poli|sugar|laplace|blabla|nikke|char|master)/i.test(value))
      .sort(),
    occurrences,
  };
}

const versions = {};
for (const term of ['34.7.6', 'V34.7.6', '34.7.7', 'V34.7.7']) {
  versions[term] = offsetsFor(term, 20).map(offset => makeHit(term, offset));
}

const report = {
  auditVersion: 3,
  rule: 'Source-only lexical audit. No favorite-item TID, phase, skill variant, or level rule is inferred.',
  source: { path: sourcePath, bytes: Buffer.byteLength(source), sha256: sha256(source), lines: lineStarts.length },
  counts,
  phase: {
    exactCount: counts.favoriteItemPhase,
    literalNumbersObservedNearPhase: phaseValues,
    comparisons: phaseComparisons,
    assignments: phaseAssignments,
    reads: phaseReads,
    occurrences: phaseHits,
  },
  targets,
  versions,
};
fs.writeFileSync(`${outDir}/enikk-favorite-app-consumer-v3477.json`, JSON.stringify(report, null, 2));

const md = [
  '# App favorite-item consumer audit — V34.7.7',
  '',
  '> Source-only extraction; no phase/TID/skill behavior is guessed.',
  '',
  `- index SHA-256: \`${report.source.sha256}\``,
  `- index bytes/lines: **${report.source.bytes} / ${report.source.lines}**`,
  `- \`favoriteItemPhase\` occurrences: **${report.phase.exactCount}**`,
  `- literal numbers near phase reads: **${phaseValues.join(', ') || '(none)'}**`,
  '',
  '## Exact comparisons',
  ...phaseComparisons.map(value => `- \`${value}\``),
  '',
  '## Exact assignments',
  ...phaseAssignments.map(value => `- \`${value}\``),
  '',
  '## Phase read fragments',
  ...phaseReads.map(value => `- \`${value}\``),
  '',
  '## Target counts',
  ...Object.values(targets).flatMap(target => [
    `### ${target.key}`,
    ...Object.entries(target.termCounts).map(([term, count]) => `- \`${term}\`: **${count}**`),
  ]),
  '',
  '## Full contexts',
  '- `audit/enikk-favorite-app-consumer-v3477.json`',
];
fs.writeFileSync(`${outDir}/enikk-favorite-app-consumer-v3477.md`, md.join('\n') + '\n');
console.log(JSON.stringify({
  source: report.source,
  counts,
  phaseValues,
  phaseComparisons,
  phaseAssignments,
  phaseReads,
  targetCounts: Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, value.termCounts])),
}, null, 2));
