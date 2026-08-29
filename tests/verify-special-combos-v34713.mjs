import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * V34.7.19 special-combination browser regression
 *
 * Runs the real Precision and Solo Raid calculation path for every option in
 * #precisionBufferCombo (none + 33 presets).  The audit deliberately avoids a
 * hard-coded damage target: every preset must produce finite positive totals,
 * and the common timeline audit must reconcile authoritative total, member
 * total and the 180-second trace endpoint exactly.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '34.7.19';

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
  let lastError;
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
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
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
        timer = setTimeout(() => reject(new Error(`evaluation timeout after ${timeout}ms`)), timeout);
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
  let last = false;
  while (Date.now() - started < timeout) {
    last = await evaluate(cdp, `Boolean(${expression})`, 10000);
    if (last) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser condition timeout: ${expression}; last=${last}`);
}

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-combos-'));
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
    localStorage.setItem('nikke_v3474_deploy_blablalink_autosync', '0');
    try { Object.defineProperty(navigator, 'deviceMemory', { value: 4, configurable: true }); } catch (_) {}
    try { HTMLMediaElement.prototype.play = () => Promise.resolve(); } catch (_) {}
  })();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap });
  await cdp.send('Page.navigate', { url: 'data:text/html,<html><head></head><body></body></html>' });
  await waitFor(cdp, "document.readyState === 'complete'", 30000);
  const frameTree = await cdp.send('Page.getFrameTree');
  const frameId = frameTree.frameTree?.frame?.id;
  assert.ok(frameId, 'main frame');
  await cdp.send('Page.setDocumentContent', { frameId, html: HTML });
  await waitFor(cdp, `window.NIKKE_V26_ROSTER_API?.load
    && window.NIKKEV3475SyncPropagation?.refreshPrecision
    && window.NIKKEV34712UnifiedTimeline
    && window.NIKKE_V3477_FAVORITE_PHASE_API
    && document.getElementById('precisionBufferCombo')?.options?.length`, 120000);

  const audit = await evaluate(cdp, `(async () => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const api = window.NIKKEV34712UnifiedTimeline;
    const rosterApi = window.NIKKE_V26_ROSTER_API;
    const select = document.getElementById('precisionBufferCombo');
    const character = 'sugarTreasure';
    const optionRows = [...select.options].map(option => ({ id: option.value, label: option.textContent.trim() }));

    const roster = rosterApi.load();
    roster.characters ||= {};
    const previous = roster.characters[character] || {};
    roster.characters[character] = {
      ...previous,
      id: character,
      owned: true,
      level: 450,
      limitBreak: 3,
      coreLevel: 5,
      bond: 40,
      skills: { skill1: 10, skill2: 10, burst: 10 },
      favoriteItemPhase: 3,
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
    rosterApi.import(roster, 'replace');
    await wait(60);

    const setPhase = async phase => {
      const doc = rosterApi.load();
      doc.characters[character].favoriteItemPhase = phase;
      rosterApi.import(doc, 'replace');
      await wait(30);
      rosterApi.apply(character);
      const precisionCharacter = document.getElementById('precisionChar');
      precisionCharacter.value = character;
      select.value = 'none';
      window.NIKKEV3475SyncPropagation.refreshPrecision();
      await wait(10);
    };

    const capturePhase = async phase => {
      await setPhase(phase);
      const originalCycle = window.v21SkillCycle;
      const originalModel = window.v21DamageModel;
      const cycles = [];
      const models = [];
      window.v21SkillCycle = function (...args) {
        const result = originalCycle.apply(this, args);
        if (args[0] === character) cycles.push(clone(result));
        return result;
      };
      window.v21DamageModel = function (...args) {
        const result = originalModel.apply(this, args);
        if (args[0] === character) models.push(clone(result));
        return result;
      };
      try {
        window.precisionCalc();
      } finally {
        window.v21SkillCycle = originalCycle;
        window.v21DamageModel = originalModel;
      }
      return {
        phase,
        snapshot: clone(window.__precisionSnapshot),
        cycle: cycles.at(-1) || null,
        model: models.at(-1) || null,
        contextPhase: Number(window.__v26TeamGrowthContext?.byId?.[character]?.favoriteItemPhase)
      };
    };

    const phase0 = await capturePhase(0);
    const phase3 = await capturePhase(3);
    await setPhase(3);

    const comboRows = [];
    for (const option of optionRows) {
      let error = '';
      let row = { id: option.id, label: option.label };
      try {
        select.value = option.id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        window.NIKKEV3475SyncPropagation.refreshPrecision();
        window.precisionCalc();
        window.soloRaidRefresh(true);
        const snapshot = clone(window.__precisionSnapshot);
        const raid = clone(window.NIKKESoloRaidLastResult);
        const sim = api.syntheticFromSnapshot(snapshot);
        const trace = api.normalizeTrace(sim);
        const precisionAudit = api.traceAudit(sim, trace);
        const raidSim = api.syntheticFromSnapshot(raid.snapshot, raid.combo.total, raid.boss?.duration || 180);
        const raidTrace = api.normalizeTrace(raidSim);
        const raidAudit = api.traceAudit(raidSim, raidTrace);
        const damageValues = [
          snapshot.totals?.base,
          snapshot.totals?.solo,
          snapshot.totals?.combo,
          snapshot.breakdown?.normal,
          snapshot.breakdown?.skill,
          snapshot.breakdown?.burst,
          ...(snapshot.breakdown?.packets || []).flatMap(packet => [packet.units, packet.total]),
          raid.combo?.total,
          sim.totalDamage,
          raidSim.totalDamage,
          ...sim.members.map(member => member.damage),
          ...raidSim.members.map(member => member.damage)
        ].map(Number);
        row = {
          ...row,
          selectedCharacter: snapshot.id,
          selectedBuffer: snapshot.selections?.bufferId,
          phase: Number(window.__v26TeamGrowthContext?.byId?.[character]?.favoriteItemPhase),
          precisionTotal: Number(snapshot.totals?.combo),
          raidTotal: Number(raid.combo?.total),
          finite: damageValues.every(Number.isFinite),
          nonnegative: damageValues.every(value => value >= 0),
          positiveTotals: Number(snapshot.totals?.combo) > 0 && Number(raid.combo?.total) > 0,
          precisionAudit: precisionAudit.pass,
          precisionMemberSum: Number(precisionAudit.memberSum),
          precisionTraceSum: Number(precisionAudit.traceSum),
          raidAudit: raidAudit.pass,
          raidMemberSum: Number(raidAudit.memberSum),
          raidTraceSum: Number(raidAudit.traceSum)
        };
      } catch (caught) {
        error = String(caught?.stack || caught?.message || caught);
      }
      comboRows.push({ ...row, error });
    }
    return { version: ${JSON.stringify(VERSION)}, optionRows, phase0, phase3, comboRows };
  })()`, 360000);

  assert.equal(audit.version, VERSION);
  assert.equal(audit.optionRows.length, 34, 'none + 33 special presets');
  assert.equal(audit.optionRows.filter((row) => row.id === 'none').length, 1, 'one none preset');
  assert.equal(new Set(audit.optionRows.map((row) => row.id)).size, 34, 'unique preset IDs');

  assert.equal(audit.phase0.contextPhase, 0, 'Sugar normal phase propagated');
  assert.equal(audit.phase3.contextPhase, 3, 'Sugar favorite phase propagated');
  assert.equal(audit.phase3.model?.favoriteItemSkillResolution?.phase, 3, 'Sugar favorite resolver phase');
  assert.ok(audit.phase3.cycle?.reload > audit.phase0.cycle?.reload, 'Sugar favorite reload calculation');
  assert.ok(audit.phase3.cycle?.ammoPct > audit.phase0.cycle?.ammoPct, 'Sugar favorite ammunition calculation');
  assert.ok(audit.phase3.model?.atk > audit.phase0.model?.atk, 'Sugar favorite ATK calculation');
  assert.ok(audit.phase3.model?.dmg > audit.phase0.model?.dmg, 'Sugar favorite attack-damage calculation');
  assert.ok(audit.phase3.model?.strongElementDmg > audit.phase0.model?.strongElementDmg, 'Sugar favorite elemental calculation');
  assert.notEqual(audit.phase3.snapshot?.totals?.combo, audit.phase0.snapshot?.totals?.combo, 'Sugar favorite changes common Precision result');

  for (const row of audit.comboRows) {
    assert.equal(row.error, '', `${row.id} exception: ${row.error}`);
    assert.equal(row.selectedCharacter, 'sugarTreasure', `${row.id} Sugar selection`);
    assert.equal(row.selectedBuffer, row.id, `${row.id} preset selection`);
    assert.equal(row.phase, 3, `${row.id} Sugar favorite phase`);
    assert.equal(row.finite, true, `${row.id} contains NaN/Infinity`);
    assert.equal(row.nonnegative, true, `${row.id} contains negative damage`);
    assert.equal(row.positiveTotals, true, `${row.id} non-positive total`);
    assert.equal(row.precisionAudit, true, `${row.id} Precision member/trace sum mismatch`);
    assert.equal(row.raidAudit, true, `${row.id} Solo Raid member/trace sum mismatch`);
    assert.equal(row.precisionMemberSum, row.precisionTotal, `${row.id} Precision member sum`);
    assert.equal(row.precisionTraceSum, row.precisionTotal, `${row.id} Precision trace endpoint`);
    assert.equal(row.raidMemberSum, row.raidTotal, `${row.id} Solo Raid member sum`);
    assert.equal(row.raidTraceSum, row.raidTotal, `${row.id} Solo Raid trace endpoint`);
  }

  const summary = {
    version: VERSION,
    presets: audit.optionRows.length,
    nonNonePresets: audit.optionRows.filter((row) => row.id !== 'none').length,
    sugar: {
      phase0Total: audit.phase0.snapshot.totals.combo,
      phase3Total: audit.phase3.snapshot.totals.combo,
      favoriteResolutionPhase: audit.phase3.model.favoriteItemSkillResolution.phase,
      reloadGain: audit.phase3.cycle.reload - audit.phase0.cycle.reload,
      ammoGain: audit.phase3.cycle.ammoPct - audit.phase0.cycle.ammoPct
    },
    precisionRange: {
      min: Math.min(...audit.comboRows.map((row) => row.precisionTotal)),
      max: Math.max(...audit.comboRows.map((row) => row.precisionTotal))
    },
    raidRange: {
      min: Math.min(...audit.comboRows.map((row) => row.raidTotal)),
      max: Math.max(...audit.comboRows.map((row) => row.raidTotal))
    },
    pass: true
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log('V34.7.19 none + 33 special presets / Sugar favorite common-engine browser verification: PASS');
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
