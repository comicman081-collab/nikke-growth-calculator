import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * V34.7.16 real-browser UI audit
 *
 * The test opens the current production HTML in headless Chrome/Edge and uses
 * the same summary-click interaction as a user.  It checks default collapse,
 * expand/render, re-collapse, the five vertical character-damage rows, compact
 * names/damage labels, equal graph/totals height, and the character-search UI.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const PUBLIC_HTML = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const VERSION = '34.7.16';

assert.equal(HTML, PUBLIC_HTML, 'root/public production HTML mirror');

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
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-ui-timeline-'));
const chrome = spawn(chromeBinary(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*',
  '--enable-precise-memory-info',
  '--renderer-process-limit=1',
  '--js-flags=--max-old-space-size=256',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeStderr = '';
chrome.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });
let cdp;
const browserExceptions = [];

try {
  const pages = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 30000);
  const page = pages.find((entry) => entry.type === 'page') || pages[0];
  assert.ok(page?.webSocketDebuggerUrl, 'CDP page target');
  cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on('Runtime.exceptionThrown', (params) => {
    browserExceptions.push(params?.exceptionDetails?.exception?.description || params?.exceptionDetails?.text || 'unknown exception');
  });
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
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
    && window.NIKKESinglePartyTimelineSimulator?.simulate
    && window.NIKKEV34712UnifiedTimeline
    && window.NIKKEV34713Optimality
    && typeof window.NIKKEV3420Run === 'function'
    && document.getElementById('v34712PrecisionTimeline')
    && document.getElementById('v34712SoloTimeline')
    && document.getElementById('v34712BattleTimeline')
    && document.querySelectorAll('.v34712-character-search').length >= 8
    && document.querySelectorAll('[data-v34714-calculation-notice]').length >= 4`, 120000);
  browserExceptions.length = 0;

  const audit = await evaluate(cdp, `(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const api = window.NIKKEV34712UnifiedTimeline;
    const rosterApi = window.NIKKE_V26_ROSTER_API;
    const finite = value => Number.isFinite(Number(value));
    const waitPanel = async (details, timeout = 90000) => {
      const started = performance.now();
      while (performance.now() - started < timeout) {
        const error = details.querySelector('.v34712-error');
        if (error) throw new Error(details.id + ': ' + error.textContent.trim());
        if (details.dataset.auditPass === 'true' && details.querySelector('canvas')) return;
        await wait(25);
      }
      throw new Error('timeline panel timeout: ' + details.id);
    };
    const dimensions = details => {
      const chart = details.querySelector('.v34712-timeline-chart')?.getBoundingClientRect();
      const damage = details.querySelector('.v34712-damage-panel')?.getBoundingClientRect();
      return {
        chartW: chart?.width || 0,
        chartH: chart?.height || 0,
        damageW: damage?.width || 0,
        damageH: damage?.height || 0
      };
    };
    const clickPanel = async (details, expectedRows) => {
      const defaultClosed = details.open === false;
      details.querySelector('summary').click();
      await waitPanel(details);
      const rows = [...details.querySelectorAll('.v34712-damage-row')].map(row => ({
        title: row.getAttribute('title') || '',
        name: row.querySelector('.v34712-damage-name')?.textContent?.trim() || '',
        damage: row.querySelector('.v34712-damage-value')?.textContent?.trim() || ''
      }));
      const expanded = details.open === true;
      const rendered = details.dataset.auditPass === 'true' && !!details.querySelector('canvas');
      const total = Number(details.dataset.total || 0);
      const size = dimensions(details);
      details.querySelector('summary').click();
      await wait(25);
      return {
        id: details.id,
        defaultClosed,
        expanded,
        rendered,
        collapsedAgain: details.open === false,
        rows,
        expectedRows,
        total,
        dimensions: size
      };
    };

    const catalog = [...new Map((window.NIKKE_V26_7_CHARACTER_CATALOG || [])
      .filter(row => row?.id)
      .map(row => [String(row.id), row])).values()];
    const favoriteIds = new Set(Object.keys(window.NIKKE_V3477_FAVORITE_REGISTRY || {}));
    const cleanPrivacy = (() => {
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
      return {
        linkedSnapshotKeys: keys.filter(key => key.includes('nikke_v34711_linked_roster_snapshot_v1')),
        savedProfileKeys: keys.filter(key => key.includes('nikke_v3474_deploy_blablalink_profile')),
        profileInput: document.getElementById('v34610BlaUrl')?.value || '',
        rawLinkedRows: window.NIKKEV34711LinkedRosterRefresh?.getSnapshot?.()?.characters?.length || 0
      };
    })();
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
        favoriteItemPhase: favoriteIds.has(id) ? 3 : 0,
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
    await wait(100);

    const searches = [...document.querySelectorAll('.v34712-character-search')];
    const searchTargets = searches.map(wrap => wrap.dataset.searchFor).filter(Boolean);
    const precisionSearch = document.querySelector('.v34712-character-search[data-search-for="precisionChar"]');
    const searchInput = precisionSearch?.querySelector('.v34712-character-search-input');
    searchInput.focus();
    searchInput.value = 'Sugar';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    const sugarOption = precisionSearch.querySelector('.v34712-character-search-option[data-value="sugarTreasure"]');
    const resultCount = precisionSearch.querySelectorAll('.v34712-character-search-option').length;
    sugarOption?.click();
    const search = {
      count: searches.length,
      targets: searchTargets,
      resultCount,
      selected: document.getElementById('precisionChar')?.value || '',
      value: searchInput.value,
      placeholder: searchInput.placeholder,
      closed: precisionSearch.querySelector('.v34712-character-search-menu')?.hidden === true
    };

    rosterApi.apply('sugarTreasure');
    document.getElementById('precisionChar').value = 'sugarTreasure';
    document.getElementById('precisionBufferCombo').value = 'none';
    window.NIKKEV3475SyncPropagation.refreshPrecision();
    window.precisionCalc();
    window.soloRaidRefresh(true);
    await wait(40);

    const precision = await clickPanel(document.getElementById('v34712PrecisionTimeline'), 1);
    const solo = await clickPanel(document.getElementById('v34712SoloTimeline'), 1);

    const battleSimulation = window.NIKKESinglePartyTimelineSimulator.simulate({
      boss: 'annihilio',
      duration: 180,
      step: .15,
      compact: false,
      party: {
        b1: 'toveTreasure',
        b2: 'crown',
        b3: ['sugarTreasure', 'drakeTreasure'],
        flex: 'solineFrostTicket'
      }
    });
    window.NIKKESinglePartyTimelineLastResult = battleSimulation;
    const battle = await clickPanel(document.getElementById('v34712BattleTimeline'), 5);

    const bossSelect = document.getElementById('soloBossSelect');
    if ([...bossSelect.options].some(option => option.value === 'annihilio')) bossSelect.value = 'annihilio';
    const optimizerStarted = performance.now();
    const fiveDeckResult = await window.NIKKEV3420Run();
    const optimizerMs = performance.now() - optimizerStarted;
    const result = window.NIKKEV34710LastResult || fiveDeckResult;
    api.decorateFiveDeck();
    const attachStarted = performance.now();
    while ((result?.teams?.length || 0) === 5 && document.querySelectorAll('.v34712-five-deck-timeline').length < 5 && performance.now() - attachStarted < 30000) {
      api.decorateFiveDeck();
      await wait(25);
    }
    const panels = [...document.querySelectorAll('.v34712-five-deck-timeline')].slice(0, 5);
    const decks = [];
    for (let index = 0; index < panels.length; index += 1) {
      const team = result.teams[index];
      const sim = api.simulateTeam(team, result, index);
      const ui = await clickPanel(panels[index], 5);
      decks.push({
        ...ui,
        index: index + 1,
        memberCount: sim.members.length,
        members: sim.members.map(member => ({
          id: member.id,
          name: member.name || member.id,
          compactName: api.compactName(member.name || member.id),
          damage: Number(member.damage),
          compactDamage: api.compactDamage(member.damage)
        })),
        memberSum: sim.members.reduce((sum, member) => sum + Number(member.damage || 0), 0),
        simulationTotal: Number(sim.totalDamage),
        traceAudit: api.traceAudit(sim, api.normalizeTrace(sim)).pass
      });
    }

    const ids = (result?.teams || []).flatMap(team => team.memberIds || team.members?.map(member => member.id) || []);
    const motionStability = await (async () => {
      const tab=document.querySelector('.tab[data-page="v26Roster"]');
      window.switchTab?.('v26Roster',tab);
      await wait(80);
      const list=document.getElementById('v26RosterList'),titleNode=document.querySelector('title');
      if(!list||!titleNode)return{present:false};
      list.scrollTop=Math.min(420,Math.max(0,list.scrollHeight-list.clientHeight));
      const startScroll=list.scrollTop,startTop=list.getBoundingClientRect().top,startTitle=document.title;
      let titleMutations=0,listMutations=0;const listMutationSamples=[];
      const titleObserver=new MutationObserver(records=>titleMutations+=records.length);
      const listObserver=new MutationObserver(records=>{listMutations+=records.length;for(const record of records.slice(0,3)){if(listMutationSamples.length>=18)break;listMutationSamples.push({type:record.type,target:record.target?.id||record.target?.className||record.target?.nodeName,added:record.addedNodes?.length||0,removed:record.removedNodes?.length||0,addedNames:[...(record.addedNodes||[])].slice(0,2).map(node=>node.nodeName+':'+String(node.className||node.textContent||'').slice(0,50)),removedNames:[...(record.removedNodes||[])].slice(0,2).map(node=>node.nodeName+':'+String(node.className||node.textContent||'').slice(0,50))});}});
      titleObserver.observe(titleNode,{childList:true,characterData:true,subtree:true});
      listObserver.observe(list,{childList:true,characterData:true,subtree:true});
      const scrollSamples=[],topSamples=[];
      for(let index=0;index<45;index+=1){await wait(40);scrollSamples.push(list.scrollTop);topSamples.push(list.getBoundingClientRect().top);}
      titleObserver.disconnect();listObserver.disconnect();
      return{present:true,startTitle,endTitle:document.title,titleMutations,listMutations,listMutationSamples,startScroll,scrollRange:Math.max(...scrollSamples)-Math.min(...scrollSamples),topRange:Math.max(...topSamples)-Math.min(...topSamples),guard:window.NIKKEV34716PresentationStability||null};
    })();
    return {
      version: api.version,
      catalogCount: catalog.length,
      cleanPrivacy,
      motionStability,
      simulationNotices: {
        total: document.querySelectorAll('[data-v34714-calculation-notice]').length,
        precision: document.querySelectorAll('#precision [data-v34714-calculation-notice]').length,
        soloRaid: document.querySelectorAll('#soloRaid [data-v34714-calculation-notice]').length,
        battle: document.querySelectorAll('#battleTimelineSim [data-v34714-calculation-notice]').length,
        currentOptimizer: document.querySelectorAll('#nikke-kit-aware-optimizer-panel [data-v34714-calculation-notice]').length,
        legacyOptimizer: document.querySelectorAll('#v26Optimizer [data-v34714-calculation-notice]').length,
        text: document.querySelector('[data-v34714-calculation-notice]')?.textContent?.trim() || '',
        allLast: [...document.querySelectorAll('[data-v34714-calculation-notice]')].every(node => node.parentElement?.lastElementChild === node)
      },
      legalLast: document.getElementById('legalDisclaimer')?.parentElement?.lastElementChild?.id === 'legalDisclaimer',
      auditSurface: (() => { const node=document.querySelector('#precision .v26-audit-ok,#precision .v26-audit-warn'); if(!node)return null; const style=getComputedStyle(node); return {background:style.backgroundColor,color:style.color}; })(),
      searchPlaceholders: [...document.querySelectorAll('input[type="search"]')].map(input => input.placeholder),
      search,
      precision,
      solo,
      battle,
      battleExpected: Number(battleSimulation.totalDamage),
      fiveDeck: {
        status: fiveDeckResult?.status || result?.status || ((result?.teams?.length || 0) === 5 ? 'ok' : ''),
        lastError: window.NIKKEV3420LastError || null,
        uiStatus: document.getElementById('nikke-kit-status')?.textContent || '',
        resultText: document.getElementById('nikke-kit-results')?.textContent?.slice(0, 2000) || '',
        optimizerMs,
        panels: panels.length,
        teams: result?.teams?.length || 0,
        slots: ids.length,
        unique: new Set(ids).size,
        totalScore: Number(result?.totalScore || 0),
        finiteTotal: finite(result?.totalScore) && Number(result?.totalScore) > 0,
        validationPass: result?.v34710Validation?.pass !== false,
        decks
      },
      compactNameProbe: api.compactName('신데렐라'),
      compactDamageProbes: [api.compactDamage(2e8), api.compactDamage(12e8), api.compactDamage(60e8)],
      cacheSize: api.cacheSize()
    };
  })()`, 600000);

  assert.equal(audit.version, VERSION);
  assert.ok(audit.catalogCount >= 100, `catalog unexpectedly small: ${audit.catalogCount}`);
  assert.deepEqual(audit.cleanPrivacy.linkedSnapshotKeys, [], 'clean browser has no linked roster snapshot');
  assert.deepEqual(audit.cleanPrivacy.savedProfileKeys, [], 'clean browser has no saved BlaBla profile');
  assert.equal(audit.cleanPrivacy.profileInput, '', 'clean browser profile URL is empty');
  assert.equal(audit.cleanPrivacy.rawLinkedRows, 0, 'clean browser receives no other user roster');
  assert.equal(audit.motionStability.present, true, 'roster stability probe mounted');
  assert.equal(audit.motionStability.startTitle, '니케 성장 계산기 V34.7.16 · 로스터·탭 화면 안정화', 'stable title baseline');
  assert.equal(audit.motionStability.endTitle, audit.motionStability.startTitle, 'tab title remains fixed');
  assert.equal(audit.motionStability.titleMutations, 0, 'legacy brand timers cannot rewrite the tab title');
  assert.equal(audit.motionStability.listMutations, 0, `idle roster list is not repeatedly rendered: ${JSON.stringify(audit.motionStability.listMutationSamples)}`);
  assert.equal(audit.motionStability.scrollRange, 0, 'idle roster scroll position is stable');
  assert.ok(audit.motionStability.topRange <= 0.01, `idle roster top position is stable: ${audit.motionStability.topRange}`);
  assert.equal(audit.motionStability.guard?.titleLocked, true, 'title property lock installed');
  assert.ok(audit.simulationNotices.total >= 4, 'simulation notices mounted');
  assert.equal(audit.simulationNotices.precision, 1, 'Precision simulation notice');
  assert.equal(audit.simulationNotices.soloRaid, 1, 'Solo Raid simulation notice');
  assert.equal(audit.simulationNotices.battle, 1, 'battle simulation notice');
  assert.equal(audit.simulationNotices.currentOptimizer, 1, 'current five-deck simulation notice');
  assert.equal(audit.simulationNotices.legacyOptimizer, 1, 'legacy five-deck simulation notice');
  assert.match(audit.simulationNotices.text, /시뮬레이션 추정값/, 'simulation notice wording');
  assert.equal(audit.simulationNotices.allLast, true, 'every calculation notice stays at its calculation surface bottom');
  assert.equal(audit.legalLast, true, 'legal notice is the final app body element after every dynamic tab');
  assert.ok(audit.auditSurface, 'Precision rotation audit notice is rendered');
  assert.ok(['rgb(237, 243, 251)','rgb(248, 241, 229)'].includes(audit.auditSurface.background), `Precision audit light surface: ${audit.auditSurface.background}`);
  assert.equal(audit.auditSurface.color, 'rgb(38, 59, 85)', 'Precision audit readable text color');

  assert.ok(audit.search.count >= 8, `character-search coverage: ${audit.search.count}`);
  assert.ok(audit.search.targets.includes('precisionChar'), 'Precision search target');
  assert.ok(audit.search.targets.includes('soloTeamB3A'), 'Solo Raid first B3 search target');
  assert.ok(audit.search.targets.includes('soloTeamB3B'), 'Solo Raid second B3 search target');
  assert.ok(audit.search.targets.includes('v26CalibrationCharacter'), 'calibration search target');
  assert.ok(audit.search.resultCount >= 1, 'Sugar search result');
  assert.equal(audit.search.selected, 'sugarTreasure', 'Sugar search selection');
  assert.equal(audit.search.value, '', 'search input clears redundant selected character text');
  assert.equal(audit.search.placeholder, '검색', 'search input neutral placeholder');
  assert.equal(audit.search.closed, true, 'search menu closes after selection');
  assert.ok(audit.searchPlaceholders.length >= audit.search.count, 'search placeholders discovered');
  assert.ok(audit.searchPlaceholders.every(value => value === '검색'), 'all search placeholders are normalized to 검색');

  const checkPanel = (panel, label, expectedRows, expectedTotal = null) => {
    assert.equal(panel.defaultClosed, true, `${label} default collapsed`);
    assert.equal(panel.expanded, true, `${label} expands by summary click`);
    assert.equal(panel.rendered, true, `${label} rendered canvas/audit`);
    assert.equal(panel.collapsedAgain, true, `${label} re-collapses by summary click`);
    assert.equal(panel.rows.length, expectedRows, `${label} vertical damage rows`);
    assert.ok(Number.isFinite(panel.total) && panel.total > 0, `${label} finite positive total`);
    if (expectedTotal !== null) assert.equal(panel.total, expectedTotal, `${label} authoritative total`);
  };
  checkPanel(audit.precision, 'Precision timeline', 1);
  checkPanel(audit.solo, 'Solo Raid timeline', 1);
  checkPanel(audit.battle, 'battle timeline', 5, audit.battleExpected);
  assert.ok(audit.battle.dimensions.chartW >= audit.battle.dimensions.damageW * 4, 'battle graph is much wider than totals');
  assert.ok(Math.abs(audit.battle.dimensions.chartH - audit.battle.dimensions.damageH) <= 1, 'battle graph/totals equal height');

  if (audit.fiveDeck.status !== 'ok') console.error('five-deck browser audit diagnostics', JSON.stringify(audit.fiveDeck, null, 2));
  assert.equal(audit.fiveDeck.status, 'ok', 'automatic five-deck status');
  assert.equal(audit.fiveDeck.panels, 5, 'five result cards each receive one timeline details');
  assert.equal(audit.fiveDeck.teams, 5, 'five automatic teams');
  assert.equal(audit.fiveDeck.slots, 25, '25 automatic slots');
  assert.equal(audit.fiveDeck.unique, 25, '25 unique automatic characters');
  assert.equal(audit.fiveDeck.finiteTotal, true, 'automatic five-deck finite positive total');
  assert.equal(audit.fiveDeck.validationPass, true, 'automatic five-deck validation');
  assert.equal(audit.fiveDeck.decks.length, 5, 'five deck timeline audits');

  let sawTruncatedName = false;
  let sawEokDamage = false;
  for (const deck of audit.fiveDeck.decks) {
    checkPanel(deck, `deck ${deck.index} timeline`, 5, deck.simulationTotal);
    assert.equal(deck.memberCount, 5, `deck ${deck.index} simulation members`);
    assert.equal(deck.traceAudit, true, `deck ${deck.index} timeline sum audit`);
    assert.ok(Math.abs(deck.memberSum - deck.simulationTotal) <= Math.max(1, deck.simulationTotal * 1e-6), `deck ${deck.index} member sum`);
    assert.deepEqual(deck.rows.map((row) => row.name), deck.members.map((member) => member.compactName), `deck ${deck.index} compact names`);
    assert.deepEqual(deck.rows.map((row) => row.damage), deck.members.map((member) => member.compactDamage), `deck ${deck.index} compact damage values`);
    assert.ok(deck.dimensions.chartW >= deck.dimensions.damageW * 4, `deck ${deck.index} graph is much wider than totals`);
    assert.ok(Math.abs(deck.dimensions.chartH - deck.dimensions.damageH) <= 1, `deck ${deck.index} graph/totals equal height`);
    for (const row of deck.rows) {
      assert.match(row.damage, /^[0-9][0-9,.]*(?:만|억|조)?$/, `deck ${deck.index} damage unit ${row.damage}`);
      if (row.name.endsWith('...')) {
        sawTruncatedName = true;
        assert.equal([...row.name.slice(0, -3)].length, 3, `deck ${deck.index} three-glyph name prefix`);
      }
      if (row.damage.includes('억')) sawEokDamage = true;
    }
  }
  assert.equal(sawTruncatedName, true, 'at least one long name is reduced to three glyphs + ellipsis');
  assert.equal(sawEokDamage, true, 'at least one character damage value uses 억 notation');
  assert.equal(audit.compactNameProbe, '신데렐...', 'three-glyph compact-name probe');
  assert.deepEqual(audit.compactDamageProbes, ['2억', '12억', '60억'], 'requested 억 notation probes');
  assert.ok(audit.cacheSize <= 2, `bounded timeline cache: ${audit.cacheSize}`);
  assert.deepEqual(browserExceptions, [], `uncaught browser exceptions:\n${browserExceptions.join('\n')}`);

  const summary = {
    version: VERSION,
    searches: audit.search.count,
    basePanels: {
      precision: audit.precision.rows.length,
      soloRaid: audit.solo.rows.length,
      battle: audit.battle.rows.length
    },
    fiveDeck: {
      teams: audit.fiveDeck.teams,
      panels: audit.fiveDeck.panels,
      rows: audit.fiveDeck.decks.map((deck) => deck.rows.length),
      totalScore: audit.fiveDeck.totalScore,
      optimizerMs: audit.fiveDeck.optimizerMs
    },
    compactNameProbe: audit.compactNameProbe,
    compactDamageProbes: audit.compactDamageProbes,
    pass: true
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log('V34.7.16 Precision / Solo Raid / battle / automatic five-deck collapsible timeline UI browser verification: PASS');
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
