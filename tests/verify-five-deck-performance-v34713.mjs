import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Production-route performance/cancellation audit for V34.7.16.
 *
 * Unlike the candidate-optimality test, this invokes the same NIKKEV3420Run
 * function as the visible "5팀 계산" button.  It deliberately runs with a
 * mobile viewport, navigator.deviceMemory=4 and a 96 MiB V8 old-space limit.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MAX_FIRST_RUN_MS = Number(process.env.NIKKE_FIVE_DECK_MAX_MS || 120000);
const MAX_CANCEL_LATENCY_MS = Number(process.env.NIKKE_FIVE_DECK_CANCEL_MAX_MS || 2500);
const MAX_POST_GC_HEAP = Number(process.env.NIKKE_FIVE_DECK_MAX_HEAP || 140_000_000);

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
  for (const candidate of candidates) if (candidate && fs.existsSync(candidate)) return candidate;
  throw new Error('Chrome/Chromium/Edge executable not found. Set CHROME_BIN.');
}

async function waitForJson(url, timeout = 30000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      last = `HTTP ${response.status}`;
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout waiting for ${url}: ${last}`);
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

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    try { this.socket?.close(); } catch (_) {}
  }
}

async function evaluate(cdp, expression, timeout = 300000) {
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
        timer = setTimeout(() => reject(new Error(`browser evaluation timeout after ${timeout}ms`)), timeout);
      })
    ]);
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'browser evaluation failed');
    }
    return result.result?.value;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitFor(cdp, expression, timeout = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`, 10000)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser condition timeout: ${expression}`);
}

function fatalConsoleEntry(entry) {
  const level = String(entry?.level || entry?.type || '').toLowerCase();
  const text = String(entry?.text || entry?.args?.map((arg) => arg?.value || arg?.description || '').join(' ') || '');
  if (!['error', 'assert'].includes(level)) return false;
  // Browser media autoplay and intentionally unavailable external network data
  // are not computation failures. Runtime exceptions and renderer/page crashes
  // remain fatal through their dedicated CDP events below.
  return !/autoplay|media|favicon|ERR_(?:BLOCKED_BY_CLIENT|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED)/i.test(text);
}

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-performance-'));
const chrome = spawn(chromeBinary(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--enable-precise-memory-info',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*',
  '--js-flags=--max-old-space-size=96',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
chrome.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
let cdp;
const runtimeExceptions = [];
const fatalConsole = [];
const pageCrashes = [];

try {
  const pages = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 30000);
  const page = pages.find((entry) => entry.type === 'page') || pages[0];
  assert.ok(page?.webSocketDebuggerUrl, 'CDP page target');
  cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    runtimeExceptions.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'unknown exception');
  });
  cdp.on('Runtime.consoleAPICalled', (entry) => {
    if (fatalConsoleEntry(entry)) fatalConsole.push(String(entry.args?.map((arg) => arg.value || arg.description || '').join(' ') || entry.type));
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (fatalConsoleEntry(entry)) fatalConsole.push(String(entry.text || entry.url || entry.level));
  });
  cdp.on('Inspector.targetCrashed', () => pageCrashes.push('Inspector.targetCrashed'));
  cdp.on('Page.crash', () => pageCrashes.push('Page.crash'));
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('HeapProfiler.enable');
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
  await waitFor(cdp, `window.NIKKEV3420Run
    && window.NIKKEV34713OwnedRosterRepair?.clearCache
    && window.NIKKEV34713OwnedRosterRepair?.getLastResult
    && window.NIKKEV34713Optimality
    && window.NIKKE_V26_ROSTER_API?.load
    && Array.isArray(window.NIKKE_V26_7_CHARACTER_CATALOG)
    && document.getElementById('nikke-kit-run')`, 240000);

  // Ignore any legacy startup diagnostics. From this point every fatal belongs
  // to roster setup, cancellation or an actual five-deck production run.
  runtimeExceptions.length = 0;
  fatalConsole.length = 0;

  const setup = await evaluate(cdp, `(() => {
    const catalog = [...new Map((window.NIKKE_V26_7_CHARACTER_CATALOG || [])
      .filter(row => row?.id && row.calculationSupported !== false)
      .map(row => [String(row.id), row])).values()];
    const roster = window.NIKKE_V26_ROSTER_API.load();
    roster.characters ||= {};
    for (const row of catalog) {
      const id = String(row.id), previous = roster.characters[id] || {};
      roster.characters[id] = {
        ...previous,
        id,
        owned: true,
        level: 400,
        limitBreak: 0,
        coreLevel: 0,
        bond: 30,
        skills: { skill1: 10, skill2: 10, burst: 10 },
        favoriteItemPhase: previous.favoriteItemPhase || 0,
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
    const mode = document.getElementById('v3413RosterMode');
    if (mode) {
      mode.value = 'owned';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return {
      catalog: catalog.length,
      owned: window.NIKKE_V26_ROSTER_API.getOwned?.().length || 0,
      version: window.NIKKEV34713OwnedRosterRepair.version,
      optimalityVersion: window.NIKKEV34713Optimality.version
    };
  })()`);
  assert.ok(setup.catalog >= 100, `calculation catalog ${setup.catalog}`);
  assert.ok(setup.owned >= 100, `owned roster ${setup.owned}`);
  assert.equal(setup.version, '34.7.16');
  assert.equal(setup.optimalityVersion, '34.7.16');

  const heapBefore = await cdp.send('Runtime.getHeapUsage');

  // Cancellation is tested before any valid result exists. This makes a stale
  // result/fallback card impossible to mistake for a successful cancellation.
  const cancelled = await evaluate(cdp, `(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const boss = document.getElementById('soloBossSelect');
    boss.value = 'luxuriousSpiderS40';
    boss.dispatchEvent(new Event('change', { bubbles: true }));
    NIKKEV34713OwnedRosterRepair.clearCache();
    const button = document.getElementById('nikke-kit-run');
    const panel = document.getElementById('nikke-kit-aware-optimizer-panel');
    const mount = document.getElementById('nikke-kit-results');
    const first = NIKKEV3420Run();
    await delay(20);
    const requestedAt = performance.now();
    const second = NIKKEV3420Run();
    const [result, repeated] = await Promise.all([first, second]);
    const cancelLatencyMs = performance.now() - requestedAt;
    await delay(40);
    return {
      resultIsNull: result === null,
      repeatedIsNull: repeated === null,
      cancelLatencyMs,
      error: window.NIKKEV3420LastError || null,
      buttonText: button?.textContent || '',
      buttonDisabled: button?.disabled === true,
      ariaBusy: panel?.getAttribute('aria-busy'),
      status: document.getElementById('nikke-kit-status')?.textContent || '',
      resultText: mount?.textContent || '',
      renderedTeams: mount?.querySelectorAll('.v340-team,.v26-optimizer-team,.v3479-stable-team').length || 0,
      lastResult: NIKKEV34713OwnedRosterRepair.getLastResult()
    };
  })()`, 180000);
  const cancellationSummary = {
    resultIsNull: cancelled.resultIsNull,
    repeatedIsNull: cancelled.repeatedIsNull,
    cancelLatencyMs: cancelled.cancelLatencyMs,
    error: cancelled.error,
    buttonText: cancelled.buttonText,
    buttonDisabled: cancelled.buttonDisabled,
    ariaBusy: cancelled.ariaBusy,
    status: cancelled.status,
    renderedTeams: cancelled.renderedTeams,
    lastResultStatus: cancelled.lastResult?.status || null,
    lastResultTeams: cancelled.lastResult?.result?.teams?.length
      || cancelled.lastResult?.teams?.length
      || 0
  };
  console.log('[cancellation-summary]', JSON.stringify(cancellationSummary));
  assert.equal(cancelled.resultIsNull, true, JSON.stringify(cancellationSummary));
  assert.equal(cancelled.repeatedIsNull, true, JSON.stringify(cancellationSummary));
  assert.ok(cancelled.cancelLatencyMs <= MAX_CANCEL_LATENCY_MS, `cancel latency ${cancelled.cancelLatencyMs}ms`);
  assert.equal(cancelled.error?.code, 'E34713-CANCEL', JSON.stringify(cancelled.error));
  assert.equal(cancelled.buttonDisabled, false, 'button remains disabled after cancellation');
  assert.match(cancelled.buttonText, /V34\.7\.16 5팀 계산/);
  assert.equal(cancelled.ariaBusy, 'false');
  assert.match(cancelled.status, /계산 중지/);
  assert.match(cancelled.resultText, /계산을 중지/);
  assert.equal(cancelled.renderedTeams, 0, 'fallback/stale team cards rendered after cancellation');
  assert.equal(cancelled.lastResult, null, 'cancel before first success must not synthesize a fallback result');

  const completed = await evaluate(cdp, `(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const boss = document.getElementById('soloBossSelect');
    boss.value = 'annihilio';
    boss.dispatchEvent(new Event('change', { bubbles: true }));
    NIKKEV34713OwnedRosterRepair.clearCache();
    const run = async () => {
      let heartbeat = 0, maxGapMs = 0, previous = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        maxGapMs = Math.max(maxGapMs, now - previous);
        previous = now;
        heartbeat += 1;
      }, 25);
      const started = performance.now();
      const result = await NIKKEV3420Run();
      await delay(40); // record a delayed timer after the final synchronous phase
      const elapsedMs = performance.now() - started;
      clearInterval(timer);
      const ids = (result?.teams || []).flatMap(team => team.memberIds || team.members?.map(member => member.id) || []);
      const diagnostics = result?.v34713Diagnostics || result?.diagnostics || {};
      const validation = result?.v34713Validation || window.NIKKEV34713OwnedRosterRepair.getLastResult()?.validation || null;
      return {
        result,
        status: result?.status,
        totalScore: result?.totalScore,
        totalDamage: result?.totalDamage,
        teams: result?.teams?.length || 0,
        ids,
        unique: new Set(ids).size,
        elapsedMs,
        heartbeat,
        maxGapMs,
        diagnostics,
        validation,
      lastError: window.NIKKEV3420LastError || null,
      feasibilityDebug: window.NIKKEV34713FeasibilityDebug || null,
        statusText: document.getElementById('nikke-kit-status')?.textContent || '',
        resultText: document.getElementById('nikke-kit-results')?.textContent || '',
        activeModernia: (result?.teams || []).some(team => (team.roles?.b3 || []).some(member => String(member?.id || member) === 'modernia')),
        buttonText: document.getElementById('nikke-kit-run')?.textContent || '',
        buttonDisabled: document.getElementById('nikke-kit-run')?.disabled === true,
        ariaBusy: document.getElementById('nikke-kit-aware-optimizer-panel')?.getAttribute('aria-busy')
      };
    };
    const first = await run();
    const second = await run();
    return { first, second };
  })()`, 600000);

  const { first, second } = completed;
  for (const [label, row] of [['first', first], ['second', second]]) {
    assert.equal(row.status, 'ok', `${label}: ${JSON.stringify(row)}`);
    assert.equal(row.teams, 5, `${label} team count`);
    assert.equal(row.ids.length, 25, `${label} slot count`);
    assert.equal(row.unique, 25, `${label} unique characters`);
    assert.ok(Number.isFinite(row.totalScore) && row.totalScore > 0, `${label} total score ${row.totalScore}`);
    assert.ok(Number.isFinite(row.totalDamage) && row.totalDamage > 0, `${label} total damage ${row.totalDamage}`);
    assert.ok(row.heartbeat >= 2, `${label} heartbeat ${row.heartbeat}`);
    assert.ok(row.maxGapMs < 5000, `${label} UI heartbeat gap ${row.maxGapMs}ms`);
    assert.equal(row.activeModernia, false, `${label} Modernia used as active B3`);
    assert.equal(row.buttonDisabled, false, `${label} button disabled`);
    assert.match(row.buttonText, /V34\.7\.16 5팀 계산/);
    assert.equal(row.ariaBusy, 'false');
    assert.equal(row.validation?.pass, true, `${label} validation ${JSON.stringify(row.validation)}`);
  }
  assert.ok(first.elapsedMs <= MAX_FIRST_RUN_MS, `first run ${first.elapsedMs}ms > ${MAX_FIRST_RUN_MS}ms`);
  assert.ok(first.diagnostics.generatedCandidates > 0, 'no generated candidates');
  assert.ok(first.diagnostics.authoritativeCandidates > 0, 'no authoritative candidates');
  assert.ok(first.diagnostics.boundedCandidates > 0 && first.diagnostics.boundedCandidates <= 1100,
    `bounded candidates ${first.diagnostics.boundedCandidates}`);
  assert.equal(first.diagnostics.candidateCap, 1100, `candidate cap ${first.diagnostics.candidateCap}`);
  assert.equal(first.diagnostics.timelineSimulated, first.diagnostics.boundedCandidates, 'not every bounded candidate simulated');
  assert.ok(first.diagnostics.timelineValid >= 5, `valid timelines ${first.diagnostics.timelineValid}`);
  assert.ok(first.diagnostics.cooperativeYields > 0, `cooperative yields ${first.diagnostics.cooperativeYields}`);
  assert.equal(first.diagnostics.cacheReleased, true);
  assert.equal(first.diagnostics.baseOptimizeBypassed, true);
  assert.ok(['NIKKEV340FinalOptimizer.selectFive','v34713-constrained-timeline-exact','v34713-feasibility-witness'].includes(first.diagnostics.selectionEngine),
    `unexpected selection engine ${first.diagnostics.selectionEngine}`);
  assert.equal(first.diagnostics.moderniaGlobalOffBurst, true);

  assert.equal(second.diagnostics.cacheHit, true, `second run cache diagnostics ${JSON.stringify(second.diagnostics)}`);
  assert.deepEqual(second.ids, first.ids, 'cached repeat changed selected teams/order');
  assert.equal(second.totalScore, first.totalScore, 'cached repeat changed total score');
  assert.equal(second.totalDamage, first.totalDamage, 'cached repeat changed total damage');
  assert.ok(second.elapsedMs <= Math.max(1500, first.elapsedMs * 0.20),
    `cached repeat ${second.elapsedMs}ms was not materially faster than ${first.elapsedMs}ms`);

  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfter = await cdp.send('Runtime.getHeapUsage');
  assert.ok(heapAfter.usedSize < MAX_POST_GC_HEAP, `post-GC renderer heap ${heapAfter.usedSize}`);
  assert.equal(pageCrashes.length, 0, `page crash events: ${pageCrashes.join(', ')}`);
  assert.equal(runtimeExceptions.length, 0, `runtime exceptions:\n${runtimeExceptions.join('\n')}`);
  assert.equal(fatalConsole.length, 0, `fatal console entries:\n${fatalConsole.join('\n')}`);

  const report = {
    version: '34.7.16',
    environment: {
      viewport: '412x915',
      deviceMemoryGb: 4,
      v8OldSpaceMb: 96,
      heapBefore,
      heapAfter
    },
    cancellation: cancelled,
    firstRun: {
      elapsedMs: first.elapsedMs,
      heartbeat: first.heartbeat,
      maxGapMs: first.maxGapMs,
      teams: first.teams,
      unique: first.unique,
      totalScore: first.totalScore,
      totalDamage: first.totalDamage,
      diagnostics: first.diagnostics
    },
    cachedRun: {
      elapsedMs: second.elapsedMs,
      heartbeat: second.heartbeat,
      maxGapMs: second.maxGapMs,
      cacheHit: second.diagnostics.cacheHit,
      deterministic: JSON.stringify(second.ids) === JSON.stringify(first.ids)
    },
    runtimeExceptions,
    fatalConsole,
    pageCrashes,
    pass: true
  };
  console.log(JSON.stringify(report, null, 2));
  console.log('V34.7.16 production five-deck mobile performance/cancel/cache/crash verification: PASS');
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
    console.warn(`Chrome exited with ${chrome.exitCode}: ${stderr.slice(-1000)}`);
  }
}
