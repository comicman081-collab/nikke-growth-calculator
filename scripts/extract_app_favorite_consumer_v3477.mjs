#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const sourcePath = 'index.html';
const outDir = 'audit';
fs.mkdirSync(outDir, { recursive: true });
const source = fs.readFileSync(sourcePath, 'utf8');
const lower = source.toLocaleLowerCase('en-US');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, limit = 5000) => String(value)
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

const containingLine = offset => {
  const start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const endPos = source.indexOf('\n', offset);
  const end = endPos < 0 ? source.length : endPos;
  return clean(source.slice(start, end), 12000);
};

const declarationWindow = offset => {
  const anchors = [
    source.lastIndexOf('\nfunction ', offset),
    source.lastIndexOf('\nasync function ', offset),
    source.lastIndexOf('\nconst ', offset),
    source.lastIndexOf('\nlet ', offset),
    source.lastIndexOf('\nvar ', offset),
    source.lastIndexOf('\nclass ', offset),
    source.lastIndexOf('\n  function ', offset),
    source.lastIndexOf('\n  const ', offset),
    source.lastIndexOf('\n    function ', offset),
    source.lastIndexOf('\n    const ', offset),
  ].filter(pos => pos >= 0);
  const start = anchors.length ? Math.max(...anchors) + 1 : Math.max(0, offset - 1400);
  return clean(source.slice(start, Math.min(source.length, Math.max(offset + 2600, start + 5200))), 9000);
};

const collect = (term, max = 80) => {
  const needle = term.toLocaleLowerCase('en-US');
  const hits = [];
  let start = 0;
  while (hits.length < max) {
    const offset = lower.indexOf(needle, start);
    if (offset < 0) break;
    hits.push({
      term,
      offset,
      ...lineColumnAt(offset),
      lineText: containingLine(offset),
      context: clean(source.slice(Math.max(0, offset - 1100), Math.min(source.length, offset + term.length + 2200)), 5000),
      declarationWindow: declarationWindow(offset),
    });
    start = offset + Math.max(1, needle.length);
  }
  return hits;
};

const hitsByTerm = Object.fromEntries(terms.map(term => [term, collect(term)]));

const phaseContexts = hitsByTerm.favoriteItemPhase;
const assignmentFragments = [...new Set(phaseContexts.flatMap(hit => {
  const fragments = [];
  const text = hit.context;
  const pattern = /[^\n;{}]{0,260}favoriteItemPhase[^\n;{}]{0,420}/gi;
  for (const match of text.matchAll(pattern)) fragments.push(clean(match[0], 1000));
  return fragments;
}))];

const targetSpecs = [
  { key: 'poli', names: ['Poli', '폴리'], code: 'c030', tid: '201001' },
  { key: 'sugar', names: ['Sugar', '슈가'], code: 'c112', tid: '200501' },
  { key: 'laplace', names: ['Laplace', '라플라스'], code: 'c100', tid: '200401' },
];
const targetEvidence = {};
for (const target of targetSpecs) {
  const targetTerms = [...target.names, target.code, target.tid, `${target.key}Treasure`];
  const occurrences = targetTerms.flatMap(term => hitsByTerm[term] ?? collect(term));
  const combined = occurrences.map(hit => `${hit.context}\n${hit.declarationWindow}`).join('\n');
  targetEvidence[target.key] = {
    ...target,
    termCounts: Object.fromEntries(targetTerms.map(term => [term, (hitsByTerm[term] ?? collect(term)).length])),
    numericTokens: [...new Set([...combined.matchAll(/(?<!\d)\d{3,14}(?!\d)/g)].map(match => match[0]))].sort(),
    identifiers: [...new Set([...combined.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]{3,80}\b/g)].map(match => match[0]))]
      .filter(value => /(?:skill|favorite|treasure|phase|poli|sugar|laplace|blabla|nikke|char|master)/i.test(value))
      .sort(),
    occurrences,
  };
}

const exactPatterns = {
  phaseComparisons: /favoriteItemPhase\s*(?:===|!==|==|!=|>=|<=|>|<)\s*[^\s,;)\]}]+|[^\s,;({\[]+\s*(?:===|!==|==|!=|>=|<=|>|<)\s*favoriteItemPhase/gi,
  phaseAssignments: /(?:[A-Za-z_$][\w$]*\.)*favoriteItemPhase\s*(?:=|\?\?=|\|\|=|&&=)\s*[^;\n]{0,500}/gi,
  phaseReads: /(?:[A-Za-z_$][\w$]*|\[[^\]]{0,160}\])(?:\??\.[A-Za-z_$][\w$]*|\[[^\]]{0,160}\])*\??\.favoriteItemPhase\b/gi,
  targetTreasureIdentifiers: /\b(?:poli|sugar|laplace)[A-Za-z0-9_$]*(?:treasure|favorite)[A-Za-z0-9_$]*\b|\b(?:treasure|favorite)[A-Za-z0-9_$]*(?:poli|sugar|laplace)[A-Za-z0-9_$]*\b/gi,
  targetTidLiterals: /(?<!\d)(?:201001|200501|200401)(?!\d)/g,
  targetCharacterCodes: /\bc(?:030|112|100)\b/gi,
};
const patternMatches = {};
for (const [name, pattern] of Object.entries(exactPatterns)) {
  patternMatches[name] = [...new Set([...source.matchAll(pattern)].map(match => clean(match[0], 900)))];
}

const phaseValues = [...new Set(phaseContexts.flatMap(hit => {
  const values = [];
  for (const match of hit.context.matchAll(/favoriteItemPhase[^\n;]{0,200}/gi)) {
    for (const number of match[0].matchAll(/(?<!\d)-?\d+(?:\.\d+)?(?!\d)/g)) values.push(number[0]);
  }
  return values;
}))].sort();

const versionTerms = ['34.7.6', 'V34.7.6', '34.7.7', 'V34.7.7'];
const versionHits = Object.fromEntries(versionTerms.map(term => [term, collect(term, 40)]));

const report = {
  auditVersion: 1,
  rule: 'Source-only lexical audit. No favorite-item phase or skill rule is inferred.',
  source: {
    path: sourcePath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(source),
    lines: lineStarts.length,
  },
  counts: Object.fromEntries(terms.map(term => [term, hitsByTerm[term].length])),
  phase: {
    exactCount: phaseContexts.length,
    literalNumbersObservedNearPhase: phaseValues,
    assignmentFragments,
    comparisons: patternMatches.phaseComparisons,
    assignments: patternMatches.phaseAssignments,
    reads: patternMatches.phaseReads,
    occurrences: phaseContexts,
  },
  targets: targetEvidence,
  exactPatternMatches: patternMatches,
  versions: versionHits,
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
  `- literal numbers observed near it: **${report.phase.literalNumbersObservedNearPhase.join(', ') || '(none)'}**`,
  '',
  '## Exact comparisons',
  ...report.phase.comparisons.map(value => `- \`${value}\``),
  '',
  '## Exact assignments',
  ...report.phase.assignments.map(value => `- \`${value}\``),
  '',
  '## Exact reads',
  ...report.phase.reads.map(value => `- \`${value}\``),
  '',
  '## Target counts',
  ...Object.values(targetEvidence).flatMap(target => [
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
  counts: report.counts,
  phaseValues: report.phase.literalNumbersObservedNearPhase,
  comparisons: report.phase.comparisons,
  assignments: report.phase.assignments,
  reads: report.phase.reads,
  targetCounts: Object.fromEntries(Object.entries(targetEvidence).map(([key, value]) => [key, value.termCounts])),
}, null, 2));
