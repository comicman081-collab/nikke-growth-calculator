import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * V34.7.17 conditional shotgun-family regression audit.
 *
 * Contract under test:
 *   - Iron  : Tove / B2 / Dorothy + Bunny Soda / Sugar FLEX
 *   - Water : Tove / B2 / Dorothy + Sugar / Soline FLEX
 *   - Fire  : Tove / B2 / Dorothy + Drake / Soline FLEX
 *   - a team touching the shotgun-only core must satisfy its elemental shell;
 *   - Fire-weak bosses prioritize Christmas Brid as a B2 option, but B2 remains
 *     an optimizer choice unless an interrupt mechanic fixes Nayuta/Naga; and
 *   - shotgun is an optional five-deck branch, never an implicit mandatory
 *     requirement. `requireShotgun:true` is the only explicit force switch.
 *
 * The browser portion executes the real inline engine. Static checks cover the
 * final timeline repair requirement mask as well, so a later wrapper cannot
 * silently turn the optional shotgun family into a five-deck hard lock.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const REPAIR_PATH = path.join(ROOT, 'scripts', 'v34710-owned-roster-repair.js');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const REPAIR = fs.readFileSync(REPAIR_PATH, 'utf8');

function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} source function exists`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `${name} source function body exists`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unterminated function body: ${name}`);
}

const shotgunInfoSource = functionBlock(HTML, 'shotgunArchetypeInfo');
const shotgunBuildSource = functionBlock(HTML, 'buildShotgunCandidates');
const optimizerSource = functionBlock(HTML, 'optimizeFiveTeams');
const fallbackRequirementsSource = functionBlock(REPAIR, 'fallbackRequirements');

assert.match(shotgunInfoSource, /const roleValid = iron/,
  'element-specific shotgun role validation remains present');
assert.match(shotgunBuildSource, /iron-sugar-replaces-drake/,
  'Iron shotgun candidate builder remains present');
assert.match(shotgunBuildSource, /water-sugar-replaces-drake/,
  'Water shotgun candidate builder remains present');
assert.match(shotgunBuildSource, /legacy-drake-other-elements/,
  'Fire/other-element shotgun candidate builder remains present');
assert.match(optimizerSource, /input\.requireShotgun===true/,
  'shotgun can only be forced by the explicit requireShotgun switch');
assert.match(optimizerSource, /filter\(\(candidate\)=>!candidate\.shotgunArchetype\)/,
  'normal five-deck branch excludes shotgun candidates before optional comparison');
assert.match(optimizerSource, /optionalShotgunMinimumGain/,
  'optional shotgun branch must beat the normal five-deck total');
assert.doesNotMatch(fallbackRequirementsSource, /add\(['"][^'"]*shotgun/i,
  'final five-deck fixed-requirement mask must not contain a shotgun requirement');
assert.doesNotMatch(fallbackRequirementsSource, /fire-brid-specialist|allocation-bridSilentTrack/,
  'Christmas Brid remains a scored Fire candidate rather than a mandatory five-deck lock');

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

async function waitFor(cdp, expression, timeout = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`, 10000)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

const MATRIX = Object.freeze({
  iron: {
    active: ['dorothySerendipity', 'sodaTwinklingBunny'],
    flex: 'sugarTreasure',
    forbidden: ['drakeTreasure', 'solineFrostTicket'],
    malformedActive: ['dorothySerendipity', 'sodaTwinklingBunny'],
    malformedFlex: 'solineFrostTicket'
  },
  water: {
    active: ['dorothySerendipity', 'sugarTreasure'],
    flex: 'solineFrostTicket',
    forbidden: ['drakeTreasure', 'sodaTwinklingBunny'],
    malformedActive: ['dorothySerendipity', 'drakeTreasure'],
    malformedFlex: 'solineFrostTicket'
  },
  fire: {
    active: ['dorothySerendipity', 'drakeTreasure'],
    flex: 'solineFrostTicket',
    forbidden: ['sugarTreasure', 'sodaTwinklingBunny'],
    malformedActive: ['dorothySerendipity', 'sugarTreasure'],
    malformedFlex: 'solineFrostTicket'
  }
});

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-shotgun-'));
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
  await waitFor(cdp, `window.NIKKEKitAwareOptimizer?.buildShotgunCandidates
    && window.NIKKEKitAwareOptimizer?.shotgunArchetypeInfo
    && window.NIKKEKitAwareOptimizer?.optimizeFiveTeams
    && window.NIKKE_V26_ROSTER_API?.load
    && Array.isArray(window.NIKKE_V26_7_CHARACTER_CATALOG)`, 120000);

  const audit = await evaluate(cdp, `(async () => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const matrix = ${JSON.stringify(MATRIX)};
    const opt = window.NIKKEKitAwareOptimizer;
    const rosterApi = window.NIKKE_V26_ROSTER_API;
    const catalog = [...new Map((window.NIKKE_V26_7_CHARACTER_CATALOG || [])
      .filter(row => row?.id)
      .map(row => [String(row.id), row])).values()];
    const favoriteIds = new Set(Object.keys(window.NIKKE_V3477_FAVORITE_REGISTRY || {}));
    const roster = rosterApi.load();
    roster.characters ||= {};
    for (const row of catalog) {
      const id = String(row.id);
      const previous = roster.characters[id] || {};
      roster.characters[id] = {
        ...previous,
        id,
        owned: true,
        level: 400,
        limitBreak: 3,
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
    rosterApi.import(roster, 'replace');
    await new Promise(resolve => setTimeout(resolve, 100));

    const collected = opt.collectProfiles({}, window);
    const profiles = collected.profiles || [];
    const byId = new Map(profiles.map(profile => [String(profile.id), profile]));
    const requiredIds = [
      'toveTreasure', 'dorothySerendipity', 'sodaTwinklingBunny',
      'sugarTreasure', 'drakeTreasure', 'solineFrostTicket'
    ];
    const missing = requiredIds.filter(id => !byId.has(id));
    const makeBoss = element => opt.normalizeBoss({
      id: 'shotgun-audit-' + element,
      name: 'Shotgun Audit ' + element,
      weakElement: element,
      duration: 180,
      core: false,
      parts: false,
      survivalPressure: false,
      recommendedWeapons: ['SG']
    });
    const idsFor = roles => [
      roles?.b1?.id,
      roles?.b2?.id,
      ...(roles?.b3 || []).map(profile => profile?.id),
      roles?.flex?.id
    ].filter(Boolean).map(String);
    const orderedFor = roles => [roles?.b1, roles?.b2, ...(roles?.b3 || []), roles?.flex].filter(Boolean);
    const candidateRow = (candidate, boss, rules) => {
      const roles = candidate.roles || {};
      const ordered = orderedFor(roles);
      const info = opt.shotgunArchetypeInfo(ordered, boss, rules);
      const validation = ordered.length === 5
        ? opt.validateTeamRoles(ordered[0], ordered[1], ordered[2], ordered[3], ordered[4], boss, rules)
        : { ok: false, reason: 'candidate-role-count' };
      return {
        ids: idsFor(roles),
        b1: String(roles?.b1?.id || ''),
        b2: String(roles?.b2?.id || ''),
        active: (roles?.b3 || []).map(profile => String(profile?.id || '')).sort(),
        flex: String(roles?.flex?.id || ''),
        shotgunArchetype: candidate.shotgunArchetype === true,
        shotgunPreserved: candidate.shotgunPreserved === true,
        selectionPolicy: String(candidate.shotgunSelectionPolicy || ''),
        shotgunRecipients: ordered.filter(profile => profile?.weapon === 'SG').length,
        info: {
          touches: info.touches,
          core: info.core,
          valid: info.valid,
          roleValid: info.roleValid,
          iron: info.iron,
          water: info.water,
          allowedB2: [...(info.allowedB2 || [])]
        },
        validation: clone(validation)
      };
    };
    const rows = [];
    for (const element of ['iron', 'water', 'fire']) {
      const expected = matrix[element];
      const boss = makeBoss(element);
      const rules = opt.getRules();
      const candidates = opt.buildShotgunCandidates(profiles, boss, rules);
      const allowedB2 = opt.shotgunAllowedB2Ids(boss);
      const candidateB2 = candidates.map(candidate => String(candidate.roles?.b2?.id || ''));
      const preferredB2 = [...allowedB2, ...candidateB2]
        .map(id => byId.get(id))
        .find(profile => profile && opt.stageAllowed(profile, 2, boss) && profile.mainBurst2Eligible !== false);
      const intended = [
        byId.get('toveTreasure'),
        preferredB2,
        byId.get(expected.active[0]),
        byId.get(expected.active[1]),
        byId.get(expected.flex)
      ];
      const malformed = [
        byId.get('toveTreasure'),
        preferredB2,
        byId.get(expected.malformedActive[0]),
        byId.get(expected.malformedActive[1]),
        byId.get(expected.malformedFlex)
      ];
      const intendedInfo = intended.every(Boolean) ? opt.shotgunArchetypeInfo(intended, boss, rules) : null;
      const intendedValidation = intended.every(Boolean)
        ? opt.validateTeamRoles(intended[0], intended[1], intended[2], intended[3], intended[4], boss, rules)
        : { ok: false, reason: 'missing-intended-profile' };
      const intendedEvaluation = intended.every(Boolean)
        ? opt.evaluateTeamRoles(intended[0], intended[1], intended[2], intended[3], intended[4], boss, rules)
        : null;
      const malformedInfo = malformed.every(Boolean) ? opt.shotgunArchetypeInfo(malformed, boss, rules) : null;
      const malformedValidation = malformed.every(Boolean)
        ? opt.validateTeamRoles(malformed[0], malformed[1], malformed[2], malformed[3], malformed[4], boss, rules)
        : { ok: false, reason: 'missing-malformed-profile' };
      const malformedEvaluation = malformed.every(Boolean)
        ? opt.evaluateTeamRoles(malformed[0], malformed[1], malformed[2], malformed[3], malformed[4], boss, rules)
        : null;
      rows.push({
        element,
        weakElements: [...boss.weakElements],
        expected,
        allowedB2,
        buildCount: candidates.length,
        candidateB2,
        preferredB2: String(preferredB2?.id || ''),
        candidates: candidates.map(candidate => candidateRow(candidate, boss, rules)),
        intended: {
          ids: intended.filter(Boolean).map(profile => String(profile.id)),
          info: intendedInfo ? {
            touches: intendedInfo.touches,
            core: intendedInfo.core,
            valid: intendedInfo.valid,
            roleValid: intendedInfo.roleValid,
            allowedB2: [...(intendedInfo.allowedB2 || [])]
          } : null,
          validation: clone(intendedValidation),
          evaluated: !!intendedEvaluation
        },
        malformed: {
          ids: malformed.filter(Boolean).map(profile => String(profile.id)),
          info: malformedInfo ? {
            touches: malformedInfo.touches,
            core: malformedInfo.core,
            valid: malformedInfo.valid,
            roleValid: malformedInfo.roleValid
          } : null,
          validation: clone(malformedValidation),
          evaluated: !!malformedEvaluation
        }
      });
    }

    const generalSolineTeam = ['liter', 'crown', 'alice', 'redHood', 'solineFrostTicket'].map(id => byId.get(id));
    const generalSolineBoss = makeBoss('fire');
    const generalSolineInfo = generalSolineTeam.every(Boolean)
      ? opt.shotgunArchetypeInfo(generalSolineTeam, generalSolineBoss, opt.getRules())
      : null;
    const generalSolineValidation = generalSolineTeam.every(Boolean)
      ? opt.validateTeamRoles(...generalSolineTeam, generalSolineBoss, opt.getRules())
      : { ok: false, reason: 'missing-general-soline-profile' };

    // A complete real five-deck solve with shotgun explicitly disabled proves
    // that the archetype is not hidden in the normal mandatory requirement set.
    const optionalBoss = makeBoss('fire');
    const fiveDeck = opt.optimizeFiveTeams({
      profiles,
      boss: optionalBoss,
      teamCount: 5,
      allowShotgun: false,
      requireShotgun: false
    });
    return {
      catalogCount: catalog.length,
      profileCount: profiles.length,
      missing,
      rows,
      generalSolineMisuse: {
        ids: generalSolineTeam.filter(Boolean).map(profile => String(profile.id)),
        shotgunTouches: generalSolineInfo?.touches === true,
        shotgunValid: generalSolineInfo?.valid === true,
        validation: clone(generalSolineValidation)
      },
      fiveDeck: {
        complete: fiveDeck.complete === true,
        teamCount: (fiveDeck.teams || []).length,
        uniqueCharacters: new Set((fiveDeck.teams || []).flatMap(team => team.members || []).map(profile => profile.id)).size,
        shotgunRequired: fiveDeck.diagnostics?.shotgunRequired,
        shotgunAvailable: fiveDeck.diagnostics?.shotgunAvailable,
        shotgunSelectedMode: fiveDeck.diagnostics?.shotgunSelectedMode,
        shotgunTeams: fiveDeck.diagnostics?.shotgunTeams,
        selectedShotgunFlags: (fiveDeck.teams || []).map(team => team.shotgunArchetype === true),
        totalScore: Number(fiveDeck.totalScore || 0)
      }
    };
  })()`, 900000);

  const failures = [];
  const fail = (condition, message) => { if (!condition) failures.push(message); };
  fail(audit.catalogCount >= 100, `catalog unexpectedly small: ${audit.catalogCount}`);
  fail(audit.profileCount >= 100, `normalized profile pool unexpectedly small: ${audit.profileCount}`);
  fail(audit.missing.length === 0, `shotgun profiles missing: ${audit.missing.join(',')}`);

  for (const row of audit.rows) {
    const expectedActive = [...row.expected.active].sort();
    fail(row.weakElements.length === 1 && row.weakElements[0] === row.element,
      `${row.element}: boss weakness normalization ${JSON.stringify(row.weakElements)}`);
    fail(row.buildCount > 0, `${row.element}: no canonical shotgun candidate built`);
    fail(row.intended.info?.valid === true && row.intended.info?.roleValid === true,
      `${row.element}: intended shell rejected by shotgunArchetypeInfo`);
    fail(row.intended.validation?.ok === true,
      `${row.element}: intended shell rejected by validateTeamRoles (${row.intended.validation?.reason || 'unknown'})`);
    fail(row.intended.evaluated === true, `${row.element}: intended shell rejected by evaluateTeamRoles`);
    fail(row.malformed.info?.touches === true && row.malformed.info?.valid === false,
      `${row.element}: malformed elemental shell not rejected by shotgunArchetypeInfo`);
    fail(row.malformed.validation?.ok === false,
      `${row.element}: malformed elemental shell passed validateTeamRoles`);
    fail(row.malformed.evaluated === false,
      `${row.element}: malformed elemental shell passed evaluateTeamRoles`);
    for (const [index, candidate] of row.candidates.entries()) {
      fail(candidate.b1 === 'toveTreasure', `${row.element}[${index}]: B1 ${candidate.b1}`);
      fail(JSON.stringify(candidate.active) === JSON.stringify(expectedActive),
        `${row.element}[${index}]: active B3 ${candidate.active.join('+')}`);
      fail(candidate.flex === row.expected.flex, `${row.element}[${index}]: FLEX ${candidate.flex}`);
      fail(row.expected.forbidden.every(id => !candidate.ids.includes(id)),
        `${row.element}[${index}]: forbidden variant present in ${candidate.ids.join('+')}`);
      fail(candidate.shotgunArchetype && candidate.shotgunPreserved,
        `${row.element}[${index}]: missing shotgun candidate markers`);
      fail(candidate.shotgunRecipients >= 3,
        `${row.element}[${index}]: only ${candidate.shotgunRecipients} SG recipients`);
      fail(candidate.info.valid && candidate.info.roleValid && candidate.validation?.ok === true,
        `${row.element}[${index}]: builder returned invalid candidate (${candidate.validation?.reason || 'shotgun-info'})`);
    }
    if (row.element === 'fire') {
      fail(row.allowedB2[0] === 'bridSilentTrack',
        `fire: Christmas Brid is not first B2 priority (${row.allowedB2.join(',')})`);
      fail(row.candidateB2.includes('bridSilentTrack'),
        'fire: no Christmas Brid shotgun candidate survived');
      fail(row.candidateB2.includes('arcanaFortuneMate'),
        'fire: no-heal Arcana alternative did not survive');
      fail(row.candidateB2.includes('nayuta') && row.candidateB2.includes('naga'),
        'fire: mechanic/survival Nayuta and Naga alternatives did not survive');
    }
  }

  fail(audit.generalSolineMisuse.shotgunTouches === true && audit.generalSolineMisuse.shotgunValid === false,
    'general Soline FLEX misuse was not recognized as an incomplete shotgun shell');
  fail(audit.generalSolineMisuse.validation?.ok === false
      && ['shotgun-archetype', 'shotgun-party-only'].includes(audit.generalSolineMisuse.validation?.reason),
    `general Soline FLEX misuse passed or failed for the wrong reason (${audit.generalSolineMisuse.validation?.reason || 'unknown'})`);

  fail(audit.fiveDeck.complete === true, 'allowShotgun:false did not complete five teams');
  fail(audit.fiveDeck.teamCount === 5, `allowShotgun:false team count ${audit.fiveDeck.teamCount}`);
  fail(audit.fiveDeck.uniqueCharacters === 25,
    `allowShotgun:false unique character count ${audit.fiveDeck.uniqueCharacters}`);
  fail(audit.fiveDeck.shotgunRequired === false,
    `allowShotgun:false diagnostics.shotgunRequired=${audit.fiveDeck.shotgunRequired}`);
  fail(audit.fiveDeck.shotgunTeams === 0 && audit.fiveDeck.selectedShotgunFlags.every(flag => !flag),
    `allowShotgun:false selected shotgun team(s): ${audit.fiveDeck.shotgunTeams}`);
  fail(Number.isFinite(audit.fiveDeck.totalScore) && audit.fiveDeck.totalScore > 0,
    `allowShotgun:false invalid total score ${audit.fiveDeck.totalScore}`);

  const summary = {
    version: '34.7.17-shotgun-conditional-audit',
    staticContracts: {
      explicitForceSwitchOnly: true,
      normalPoolExcludesShotgun: true,
      optionalGainComparison: true,
      finalRepairHasNoShotgunRequirement: true
    },
    catalogCount: audit.catalogCount,
    profileCount: audit.profileCount,
    elements: audit.rows.map(row => ({
      element: row.element,
      buildCount: row.buildCount,
      preferredB2: row.preferredB2,
      candidateB2: row.candidateB2,
      intendedValidation: row.intended.validation,
      malformedValidation: row.malformed.validation
    })),
    generalSolineMisuse: audit.generalSolineMisuse,
    fiveDeck: audit.fiveDeck,
    failures,
    pass: failures.length === 0
  };
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('V34.7.17 water/iron/fire conditional shotgun role and optional five-deck verification: PASS');
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
