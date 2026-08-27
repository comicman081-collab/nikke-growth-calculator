import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * V34.7.13 independent five-deck optimality audit
 *
 * This deliberately treats candidate generation and candidate selection as two
 * separate contracts.  It uses the real browser runtime to build candidates,
 * then checks the returned finite candidate set with independent Node code:
 *
 *   1. every candidate has a finite, positive objective and a legal five-slot
 *      role footprint;
 *   2. selected teams are five disjoint legal candidates;
 *   3. current hard composition rules are not violated;
 *   4. no one-team replacement improves the selected five teams; and
 *   5. a branch-and-bound search cannot find a higher-scoring five-team cover
 *      in the exact same candidate set.
 *
 * The audit intentionally does not compare against a hard-coded damage target.
 * It only compares alternatives produced for the same boss, roster and growth
 * state, so a future boss or character can be validated without retuning a
 * fixed score threshold.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCORE_EPSILON = 1e-7;
const EXACT_SEARCH_LIMIT_MS = Number(process.env.NIKKE_EXACT_SEARCH_LIMIT_MS || 30000);
const EXPECTED_BOSSES = [
  'luxuriousSpiderS40',
  'islandEaterS39',
  'ultraSoloS37',
  'annihilio',
  'egovistaS36'
];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function chromeBinary() {
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    process.env.EDGE_BIN,
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    local && path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome/Chromium/Edge executable not found. Set CHROME_BIN.');
}

async function waitForJson(url, timeout = 30000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || lastError}`);
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.socket?.close(); } catch (_) {}
  }
}

async function evaluate(cdp, expression, timeout = 600000) {
  let timer;
  try {
    const result = await Promise.race([
      cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Browser evaluation timed out after ${timeout}ms`)), timeout);
      })
    ]);
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed');
    }
    return result.result?.value;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitFor(cdp, expression, timeout = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`, 10000)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

function teamIds(team) {
  return (team.memberIds || team.members?.map((member) => member.id) || []).map(String);
}

function candidateScore(candidate) {
  return Number(candidate.score ?? candidate.scores?.firepower);
}

function candidateKey(candidate) {
  return String(candidate.id || `${teamIds(candidate).slice().sort().join('|')}:${candidateScore(candidate)}`);
}

function roleViolations(candidate, bossId) {
  const problems = [];
  const members = Array.isArray(candidate.members) ? candidate.members : [];
  const ids = teamIds(candidate);
  const byId = new Map(members.map((member) => [String(member.id), String(member.slot || '')]));
  const slots = members.map((member) => String(member.slot || ''));
  const count = (pattern) => slots.filter((slot) => pattern.test(slot)).length;
  const has = (id) => ids.includes(id);
  const slot = (id) => byId.get(id) || '';
  const fireBoss = bossId === 'luxuriousSpiderS40';

  if (ids.length !== 5) problems.push(`member count ${ids.length}`);
  if (new Set(ids).size !== ids.length) problems.push('duplicate member inside candidate');
  if (members.length !== 5) problems.push(`member metadata count ${members.length}`);
  if (count(/^B1$/) !== 1) problems.push(`B1 slots ${count(/^B1$/)}`);
  if (count(/^B2(?:$|-)/) < 1) problems.push('no B2 slot');
  if (count(/^B3(?:$|-)/) !== 2) problems.push(`active B3 slots ${count(/^B3(?:$|-)/)}`);

  // User-locked rules: Makoto/Yukiko are inseparable active B3s for now.
  if (has('makotoNiijimaQueen') !== has('yukikoAmagi')) {
    problems.push('Makoto/Yukiko split candidate');
  }
  if (has('makotoNiijimaQueen')) {
    if (!fireBoss) problems.push('Makoto/Yukiko set outside fire weakness');
    if (!/^B3(?:$|-)/.test(slot('makotoNiijimaQueen')) || !/^B3(?:$|-)/.test(slot('yukikoAmagi'))) {
      problems.push('Makoto/Yukiko not both active B3');
    }
  }

  // Modernia is globally off-burst-only in Solo Raid, regardless of weakness.
  if (has('modernia') && slot('modernia') !== 'FLEX') {
    problems.push(`Modernia Solo Raid role ${slot('modernia') || 'missing'} (must be FLEX)`);
  }

  // Maid Mast/Anchor are paired except for the explicitly allowed Crown+Mast
  // alternating-B2 route.  The base V26 candidate surface represents that
  // route as two B2-* members, while the later exact simulator represents Mast
  // as FLEX with Crown in B2; both shapes describe the same legal rotation.
  const hasMast = has('mastRomanticMaid');
  const hasAnchor = has('anchorInnocentMaid');
  if (hasMast !== hasAnchor) {
    const crownMastException = hasMast && !hasAnchor && has('crown')
      && slot('crown').startsWith('B2')
      && (slot('mastRomanticMaid') === 'FLEX' || slot('mastRomanticMaid').startsWith('B2'));
    if (!crownMastException) problems.push('Maid Mast/Anchor split outside Crown+Mast exception');
  }
  if (hasMast && hasAnchor && (!/^B2(?:$|-)/.test(slot('mastRomanticMaid')) || slot('anchorInnocentMaid') !== 'FLEX')) {
    problems.push('Maid Mast/Anchor reversed or split roles');
  }

  const hasPrika = has('prika');
  const hasMint = has('mint');
  if (hasPrika !== hasMint) problems.push('Prika/Mint split candidate');
  if (hasPrika && (!/^B2(?:$|-)/.test(slot('prika')) || slot('mint') !== 'FLEX')) {
    problems.push('Prika/Mint reversed or split roles');
  }
  for (const flexId of ['helmTreasure', 'privatyTreasure']) {
    if (has('crown') && has(flexId) && (!/^B2(?:$|-)/.test(slot('crown')) || slot(flexId) !== 'FLEX')) {
      problems.push(`Crown/${flexId} locked route roles changed`);
    }
  }

  for (const flexOnly of ['eleggBoomAndShock', 'maidenIceRose', 'solineFrostTicket']) {
    if (has(flexOnly) && slot(flexOnly) !== 'FLEX') problems.push(`${flexOnly} is not FLEX`);
  }

  if (candidate.rotationAudit && candidate.rotationAudit.ok === false) problems.push('rotation audit failed');
  if ((candidate.interruptCoverage || []).some((entry) => entry?.ok === false)) problems.push('interrupt coverage failed');
  return problems;
}

function normalizeCandidatePool(rawCandidates) {
  const characters = [...new Set(rawCandidates.flatMap(teamIds))].sort();
  const bit = new Map(characters.map((id, index) => [id, BigInt(index)]));
  const bestByFootprint = new Map();
  for (const candidate of rawCandidates) {
    const ids = teamIds(candidate).slice().sort();
    const footprint = ids.join('|');
    const row = {
      ...candidate,
      key: candidateKey(candidate),
      ids,
      score: candidateScore(candidate),
      mask: ids.reduce((mask, id) => mask | (1n << bit.get(id)), 0n)
    };
    const previous = bestByFootprint.get(footprint);
    if (!previous || row.score > previous.score + SCORE_EPSILON
      || Math.abs(row.score - previous.score) <= SCORE_EPSILON && row.key.localeCompare(previous.key, 'en') < 0) {
      bestByFootprint.set(footprint, row);
    }
  }
  return [...bestByFootprint.values()].sort((left, right) => right.score - left.score || left.key.localeCompare(right.key, 'en'));
}

function optimisticScore(rows, start, need, usedMask) {
  let found = 0;
  let total = 0;
  for (let index = start; index < rows.length && found < need; index += 1) {
    if ((rows[index].mask & usedMask) !== 0n) continue;
    total += rows[index].score;
    found += 1;
  }
  return found === need ? total : Number.NEGATIVE_INFINITY;
}

function findBetterExactCover(rawCandidates, selectedScore, deadlineMs) {
  const rows = normalizeCandidatePool(rawCandidates);
  const deadline = Date.now() + deadlineMs;
  const target = selectedScore + Math.max(SCORE_EPSILON, Math.abs(selectedScore) * 1e-11);
  let nodes = 0;
  let timedOut = false;
  let witness = null;

  function visit(start, need, usedMask, score, picks) {
    nodes += 1;
    if ((nodes & 4095) === 0 && Date.now() > deadline) {
      timedOut = true;
      return true;
    }
    if (need === 0) {
      if (score > target) witness = { score, picks: picks.map((index) => rows[index].key) };
      return Boolean(witness);
    }
    if (rows.length - start < need) return false;
    const bound = optimisticScore(rows, start, need, usedMask);
    if (!Number.isFinite(bound) || score + bound <= target) return false;

    for (let index = start; index <= rows.length - need; index += 1) {
      const row = rows[index];
      if ((row.mask & usedMask) !== 0n) continue;
      const remainder = need === 1 ? 0 : optimisticScore(rows, index + 1, need - 1, usedMask | row.mask);
      if (!Number.isFinite(remainder)) continue;
      if (score + row.score + remainder <= target) continue;
      if (visit(index + 1, need - 1, usedMask | row.mask, score + row.score, [...picks, index])) return true;
      if (timedOut) return true;
    }
    return false;
  }

  visit(0, 5, 0n, 0, []);
  return {
    provedOptimal: !timedOut && !witness,
    timedOut,
    witness,
    nodes,
    inputCandidates: rawCandidates.length,
    uniqueFootprints: rows.length
  };
}

function findLocalSwap(rawCandidates, selected) {
  const selectedKeys = new Set(selected.map(candidateKey));
  const selectedIds = selected.map((candidate) => new Set(teamIds(candidate)));
  for (let slot = 0; slot < selected.length; slot += 1) {
    const usedByOthers = new Set(selectedIds.flatMap((ids, index) => index === slot ? [] : [...ids]));
    const current = selected[slot];
    const currentScore = candidateScore(current);
    for (const candidate of rawCandidates) {
      if (selectedKeys.has(candidateKey(candidate))) continue;
      if (candidateScore(candidate) <= currentScore + Math.max(SCORE_EPSILON, Math.abs(currentScore) * 1e-11)) continue;
      if (teamIds(candidate).some((id) => usedByOthers.has(id))) continue;
      return {
        slot,
        removed: candidateKey(current),
        removedScore: currentScore,
        added: candidateKey(candidate),
        addedScore: candidateScore(candidate),
        gain: candidateScore(candidate) - currentScore
      };
    }
  }
  return null;
}

function auditBoss(row) {
  const failures = [];
  assert.equal(row.buildStatus, 'ok', `${row.bossId}: candidate build status`);
  assert.ok(row.candidates.length > 0, `${row.bossId}: no candidates`);
  if (row.optimizeStatus !== 'ok') failures.push(`optimizer status ${row.optimizeStatus}`);
  if (row.selected.length !== 5) failures.push(`selected team count ${row.selected.length}`);
  if (row.candidates.length <= 34) failures.push(`candidate pool did not expand beyond 34 named combinations: ${row.candidates.length}`);

  for (const candidate of row.candidates) {
    const score = candidateScore(candidate);
    if (!Number.isFinite(score) || score <= 0) failures.push(`${candidateKey(candidate)}: invalid score ${score}`);
    for (const problem of roleViolations(candidate, row.bossId)) failures.push(`${candidateKey(candidate)}: ${problem}`);
  }

  const selectedIds = row.selected.flatMap(teamIds);
  if (selectedIds.length !== 25) failures.push(`selected slot count ${selectedIds.length}`);
  if (new Set(selectedIds).size !== selectedIds.length) failures.push('selected teams contain duplicate characters');
  const selectedScore = row.selected.reduce((sum, candidate) => sum + candidateScore(candidate), 0);
  const scoreTolerance = Math.max(1e-5, Math.abs(selectedScore) * 1e-9);
  if (Math.abs(selectedScore - row.totalScore) > scoreTolerance) {
    failures.push(`optimizer total ${row.totalScore} != selected sum ${selectedScore}`);
  }

  const localSwap = findLocalSwap(row.candidates, row.selected);
  if (localSwap) failures.push(`one-team improving swap remains: ${JSON.stringify(localSwap)}`);

  const exact = findBetterExactCover(row.candidates, selectedScore, EXACT_SEARCH_LIMIT_MS);
  if (exact.timedOut) failures.push(`exact-cover proof timed out after ${EXACT_SEARCH_LIMIT_MS}ms / ${exact.nodes} nodes`);
  if (exact.witness) failures.push(`higher exact five-team cover exists: ${JSON.stringify(exact.witness)}`);

  const moderniaFlex = row.candidates.filter((candidate) => candidate.members?.some((member) => member.id === 'modernia' && member.slot === 'FLEX')).length;
  if (!moderniaFlex) failures.push(`${row.bossId}: candidate pool contains no Modernia FLEX/off-burst route`);
  const specialCoverage = row.bossId === 'luxuriousSpiderS40' ? {
    personaPair: row.candidates.filter((candidate) => {
      const ids = teamIds(candidate);
      return ids.includes('makotoNiijimaQueen') && ids.includes('yukikoAmagi');
    }).length,
    crownB2: row.candidates.filter((candidate) => candidate.members?.some((member) => member.id === 'crown' && /^B2(?:$|-)/.test(member.slot))).length,
    bridB2: row.candidates.filter((candidate) => candidate.members?.some((member) => member.id === 'bridSilentTrack' && /^B2(?:$|-)/.test(member.slot))).length,
    moderniaFlex,
    fixedFamilyCounts: row.diagnostics?.v34713FamilyCounts || {}
  } : null;
  if (specialCoverage) {
    if (!specialCoverage.personaPair) failures.push('S40 candidate pool contains no Makoto/Yukiko paired active-B3 route');
    if (!specialCoverage.crownB2) failures.push('S40 candidate pool contains no Crown B2 route');
    if (!specialCoverage.bridB2) failures.push('S40 candidate pool contains no Christmas Brid B2 route');
    for (const family of ['crown-solo-family','crown-mast-locked','crown-helm-locked','crown-privaty-locked','maid-mast-anchor-locked','pri-mint-locked']) {
      if (!(specialCoverage.fixedFamilyCounts[family] > 0)) failures.push(`S40 fixed candidate family missing: ${family}`);
    }
  }

  return {
    bossId: row.bossId,
    candidateCount: row.candidates.length,
    selectedScore,
    optimizerScore: row.totalScore,
    localSwap,
    specialCoverage,
    exact,
    failures
  };
}

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-optimality-'));
const chrome = spawn(chromeBinary(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeStderr = '';
chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });
let cdp;

try {
  const pages = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 30000);
  const page = pages.find((entry) => entry.type === 'page') || pages[0];
  assert.ok(page?.webSocketDebuggerUrl, 'CDP page target');
  cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 1,
    mobile: true
  });

  const bootstrap = `(() => {
    const memoryStorage = () => {
      const values = new Map();
      return {
        getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
        setItem: (key, value) => values.set(String(key), String(value)),
        removeItem: key => values.delete(String(key)),
        clear: () => values.clear(),
        key: index => [...values.keys()][index] ?? null,
        get length() { return values.size; }
      };
    };
    try { localStorage.clear(); sessionStorage.clear(); }
    catch (_) {
      try {
        Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
        Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), configurable: true });
      } catch (__) {}
    }
    try { Object.defineProperty(navigator, 'deviceMemory', { value: 4, configurable: true }); } catch (_) {}
    try { HTMLMediaElement.prototype.play = () => Promise.resolve(); } catch (_) {}
    localStorage.setItem('nikke_v3474_deploy_blablalink_autosync', '0');
  })();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap });
  await cdp.send('Page.navigate', { url: 'data:text/html,<html><head></head><body></body></html>' });
  await waitFor(cdp, "document.readyState === 'complete'", 30000);
  const frameTree = await cdp.send('Page.getFrameTree');
  const frameId = frameTree.frameTree?.frame?.id;
  assert.ok(frameId, 'main frame');
  await cdp.send('Page.setDocumentContent', { frameId, html: HTML });
  await waitFor(cdp, `window.NIKKE_V26_OPTIMIZER_API?.buildCandidates
    && window.NIKKE_V26_OPTIMIZER_API?.optimize
    && window.NIKKE_V26_ROSTER_API?.load
    && Array.isArray(window.NIKKE_V26_7_CHARACTER_CATALOG)
    && window.NIKKEKitAwareOptimizer`, 120000);

  const browserResult = await evaluate(cdp, `(async () => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const catalog = [...new Map((window.NIKKE_V26_7_CHARACTER_CATALOG || [])
      .filter(row => row?.id)
      .map(row => [String(row.id), row])).values()];
    const favoriteIds = new Set(Object.keys(window.NIKKE_V3477_FAVORITE_REGISTRY || {}));
    const roster = window.NIKKE_V26_ROSTER_API.load();
    roster.characters ||= {};
    for (const row of catalog) {
      const id = String(row.id);
      const previous = roster.characters[id] || {};
      roster.characters[id] = {
        ...previous,
        id,
        owned: true,
        level: 400,
        limitBreak: 0,
        coreLevel: 0,
        bond: 30,
        skills: { skill1: 10, skill2: 10, burst: 10 },
        favoriteItemPhase: favoriteIds.has(id) ? 3 : Number(previous.favoriteItemPhase || 0),
        cubeId: 'none',
        manualRatio: 0,
        measuredCoeff: 1,
        overloadTotals: {
          atk: 35, element: 80, maxAmmo: 130, critRate: 10,
          critDamage: 30, chargeSpeed: 12, chargeDamage: 0,
          hit: 0, accuracy: 0, defense: 0
        },
        overload: {}
      };
    }
    window.NIKKE_V26_ROSTER_API.import(roster, 'replace');
    await new Promise(resolve => setTimeout(resolve, 100));

    const bossValues = window.NIKKE_V26_DATA?.bosses?.values || {};
    const availableBosses = Object.values(bossValues).filter(boss => boss?.calcReady !== false).map(boss => String(boss.id));
    const requested = ${JSON.stringify(EXPECTED_BOSSES)}.filter(id => availableBosses.includes(id));
    const api = window.NIKKE_V26_OPTIMIZER_API;
    const rows = [];
    const simplify = candidate => ({
      id: String(candidate.id || ''),
      blueprintId: String(candidate.blueprintId || ''),
      score: finite(candidate.scores?.firepower ?? candidate.score),
      memberIds: (candidate.memberIds || candidate.members?.map(member => member.id) || []).map(String),
      members: (candidate.members || []).map(member => ({ id: String(member.id || ''), slot: String(member.slot || '') })),
      rotationAudit: candidate.rotationAudit ? { ok: candidate.rotationAudit.ok !== false } : null,
      interruptCoverage: (candidate.interruptCoverage || []).map(entry => ({
        requiredElement: entry?.requiredElement || '', ok: entry?.ok !== false
      }))
    });

    for (const bossId of requested) {
      const options = {
        bossId,
        objective: 'firepower',
        teamCount: 5,
        ownedOnly: true,
        allowCubeDuplicates: true,
        defaultCubeCapacity: 25,
        stabilityMode: true,
        pairComputationBudget: 180,
        priorityPairExtraLimit: 2,
        pairLimit: 6,
        flexLimit: 4
      };
      const built = await api.buildCandidates(options);
      const optimized = api.optimize(built, options);
      rows.push({
        bossId,
        buildStatus: built.status,
        optimizeStatus: optimized.status,
        totalScore: finite(optimized.totalScore),
        diagnostics: clone(built.diagnostics || {}),
        candidates: (built.candidates || []).map(simplify),
        selected: (optimized.teams || []).map(simplify)
      });
      if (Array.isArray(built.candidates)) built.candidates.length = 0;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return { catalogCount: catalog.length, availableBosses, requested, rows };
  })()`, 900000);

  assert.ok(browserResult.catalogCount >= 100, `catalog unexpectedly small: ${browserResult.catalogCount}`);
  assert.deepEqual(browserResult.requested, EXPECTED_BOSSES, `missing expected bosses; available=${browserResult.availableBosses.join(',')}`);
  const reports = browserResult.rows.map(auditBoss);
  const failed = reports.filter((report) => report.failures.length);
  const summary = {
    version: '34.7.13-audit',
    catalogCount: browserResult.catalogCount,
    exactSearchLimitMs: EXACT_SEARCH_LIMIT_MS,
    bosses: reports,
    pass: failed.length === 0
  };
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(failed.length, 0, failed.map((report) => `${report.bossId}:\n- ${report.failures.join('\n- ')}`).join('\n'));
  console.log('V34.7.13 multi-boss five-deck candidate/role/global-optimality/local-swap verification: PASS');
} finally {
  cdp?.close();
  if (chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => chrome.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1000))
    ]);
  }
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  chrome.stdout?.destroy();
  chrome.stderr?.destroy();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      break;
    } catch (error) {
      if (attempt === 7) console.warn(`Chrome profile cleanup warning: ${error.message}`);
      else await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  if (chrome.exitCode && chrome.exitCode !== 0 && !process.exitCode) {
    console.warn(`Chrome exited with ${chrome.exitCode}: ${chromeStderr.slice(-1000)}`);
  }
}
