import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Production CDP audit: S40 must complete through the visible NIKKEV3420Run
// route in all three roster modes, without sharing a first-run cache entry.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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
  const choices = [
    process.env.CHROME_BIN,
    process.env.EDGE_BIN,
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    local && path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ];
  for (const value of choices) if (value && fs.existsSync(value)) return value;
  throw new Error('Chrome/Edge not found; set CHROME_BIN');
}

async function waitJson(url, timeout = 30_000) {
  const started = Date.now(); let last;
  while (Date.now() - started < timeout) {
    try { const response = await fetch(url); if (response.ok) return response.json(); last = response.status; }
    catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`CDP timeout: ${last}`);
}

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) { this.listeners.set(method, [...(this.listeners.get(method) || []), listener]); }
  close() { try { this.ws?.close(); } catch (_) {} }
}

async function evaluate(cdp, expression, timeout = 600_000) {
  let timer;
  try {
    const result = await Promise.race([
      cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`evaluate timeout ${timeout}ms`)), timeout); })
    ]);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  } finally { clearTimeout(timer); }
}

async function waitFor(cdp, expression, timeout = 240_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`, 10_000)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`condition timeout: ${expression}`);
}

function fatal(entry) {
  const level = String(entry?.level || entry?.type || '').toLowerCase();
  const text = String(entry?.text || entry?.args?.map(arg => arg?.value || arg?.description || '').join(' ') || '');
  return ['error', 'assert'].includes(level) && !/autoplay|media|favicon|ERR_(?:BLOCKED_BY_CLIENT|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED)/i.test(text);
}

const port = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-v34713-three-modes-'));
const chrome = spawn(chromeBinary(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-allow-origins=*', '--js-flags=--max-old-space-size=96',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let cdp;
const runtimeExceptions = [], fatalConsole = [], pageCrashes = [];

try {
  const pages = await waitJson(`http://127.0.0.1:${port}/json`);
  const page = pages.find(row => row.type === 'page') || pages[0];
  cdp = new Cdp(page.webSocketDebuggerUrl); await cdp.connect();
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeExceptions.push(exceptionDetails?.exception?.description || exceptionDetails?.text));
  cdp.on('Runtime.consoleAPICalled', entry => { if (fatal(entry)) fatalConsole.push(entry.args?.map(arg => arg.value || arg.description).join(' ') || entry.type); });
  cdp.on('Log.entryAdded', ({ entry }) => { if (fatal(entry)) fatalConsole.push(entry.text || entry.level); });
  cdp.on('Inspector.targetCrashed', () => pageCrashes.push('Inspector.targetCrashed'));
  cdp.on('Page.crash', () => pageCrashes.push('Page.crash'));
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const memoryStorage=()=>{const values=new Map();return{getItem:key=>values.has(String(key))?values.get(String(key)):null,
      setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),
      key:index=>[...values.keys()][index]??null,get length(){return values.size;}}};
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {
      try { Object.defineProperty(window,'localStorage',{value:memoryStorage(),configurable:true});
        Object.defineProperty(window,'sessionStorage',{value:memoryStorage(),configurable:true}); } catch (__) {}
    }
    try { Object.defineProperty(navigator, 'deviceMemory', {value:4, configurable:true}); } catch (_) {}
    try { HTMLMediaElement.prototype.play=()=>Promise.resolve(); } catch (_) {}
  ` });
  await cdp.send('Page.navigate', { url: 'data:text/html,<html><body></body></html>' });
  await waitFor(cdp, `document.readyState==='complete'`, 30_000);
  const tree = await cdp.send('Page.getFrameTree');
  await cdp.send('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html: HTML });
  await waitFor(cdp, `window.NIKKEV3420Run && window.NIKKEV34713OwnedRosterRepair?.clearCache
    && window.NIKKEV340FinalOptimizer?.resolveV3413RunRosterInput
    && window.NIKKE_V26_ROSTER_API?.load && document.getElementById('v3413RosterMode')`, 240_000);
  runtimeExceptions.length = fatalConsole.length = 0;

  const setup = await evaluate(cdp, `(() => {
    const catalog=[...new Map((NIKKE_V26_7_CHARACTER_CATALOG||[])
      .filter(row=>row?.id&&row.calculationSupported!==false).map(row=>[String(row.id),row])).values()];
    const roster=NIKKE_V26_ROSTER_API.load(); roster.characters||={};
    for(const row of catalog) roster.characters[row.id]={...(roster.characters[row.id]||{}),id:row.id,owned:true,
      level:400,limitBreak:0,coreLevel:0,bond:30,skills:{skill1:10,skill2:10,burst:10},
      favoriteItemPhase:roster.characters[row.id]?.favoriteItemPhase||0,cubeId:'none',manualRatio:0,measuredCoeff:1,
      overloadTotals:{atk:35,element:80,maxAmmo:130,critRate:10,critDamage:30,chargeSpeed:12,chargeDamage:0,hit:0,accuracy:0,defense:0},overload:{}};
    NIKKE_V26_ROSTER_API.save(roster);
    // import may replace the wrapped API; the production roster event
    // reinstalls the dynamic getOwned view used by the five-deck route.
    window.dispatchEvent(new Event('nikke:v26-roster-updated'));
    for(const id of ['soloBossSelect','v26OptimizerBoss']){const select=document.getElementById(id);if(select){select.value='luxuriousSpiderS40';select.dispatchEvent(new Event('change',{bubbles:true}));}}
    return {catalog:catalog.length,owned:NIKKE_V26_ROSTER_API.getOwned?.().length||0};
  })()`);
  assert.ok(setup.catalog >= 100 && setup.owned >= 100, JSON.stringify(setup));

  const report = await evaluate(cdp, `(async()=>{
    const modes=['auto','owned','allEqual'], output={};
    const runOnce=async requested=>{
      const select=document.getElementById('v3413RosterMode');select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}));
      const resolvedBefore=NIKKEV340FinalOptimizer.resolveV3413RunRosterInput();
      NIKKEV34713OwnedRosterRepair.clearCache();
      const started=performance.now();const result=await NIKKEV3420Run();const elapsedMs=performance.now()-started;
      const ids=(result?.teams||[]).flatMap(team=>team.memberIds||team.members?.map(row=>row.id)||[]);
      const diagnostics=result?.v34713Diagnostics||result?.diagnostics||{};
      const validation=result?.v34713Validation||NIKKEV3420LastValidation||null;
      const inputLevels=(resolvedBefore.owned||[]).map(row=>Number(row.level));
      const first={status:result?.status||null,elapsedMs,requested,resolverRequested:resolvedBefore.requested,
        resolverMode:resolvedBefore.mode,inputCount:inputLevels.length,allLevel400:inputLevels.length>0&&inputLevels.every(level=>level===400),
        teams:result?.teams?.length||0,slots:ids.length,unique:new Set(ids).size,ids,totalScore:result?.totalScore,
        selectionEngine:diagnostics.selectionEngine,constrainedFallback:diagnostics.constrainedFallback||null,
        shotgunFlexes:(result?.teams||[]).filter(team=>team.shotgunArchetype===true).map(team=>String(team.roles?.flex?.id||'')),
        christmasBridSelected:ids.includes('bridSilentTrack'),
        moderniaActive:(result?.teams||[]).some(team=>(team.roles?.b3||[]).some(member=>String(member?.id||member)==='modernia')),
        validation,lastError:NIKKEV3420LastError||null};
      const cacheStarted=performance.now();const cached=await NIKKEV3420Run();const cacheElapsedMs=performance.now()-cacheStarted;
      const cachedIds=(cached?.teams||[]).flatMap(team=>team.memberIds||team.members?.map(row=>row.id)||[]);
      return {...first,cacheElapsedMs,cacheHit:Boolean(cached?.diagnostics?.cacheHit||cached?.v34713Diagnostics?.cacheHit),
        deterministic:JSON.stringify(cachedIds)===JSON.stringify(ids)&&cached?.totalScore===result?.totalScore};
    };
    for(const mode of modes) output[mode]=await runOnce(mode);
    return output;
  })()`, 900_000);

  for (const requested of ['auto', 'owned', 'allEqual']) {
    const row = report[requested];
    assert.equal(row.requested, requested);
    assert.equal(row.resolverRequested, requested, `${requested} resolver requested`);
    assert.equal(row.resolverMode, requested === 'allEqual' ? 'allEqual' : 'owned', `${requested} resolver mode`);
    assert.equal(row.allLevel400, true, `${requested} input levels (${row.inputCount})`);
    assert.equal(row.status, 'ok', `${requested}: ${JSON.stringify(row)}`);
    assert.equal(row.teams, 5, `${requested} teams`);
    assert.equal(row.slots, 25, `${requested} slots`);
    assert.equal(row.unique, 25, `${requested} unique`);
    assert.equal(row.selectionEngine, 'v34713-constrained-timeline-exact', `${requested} engine`);
    assert.equal(row.constrainedFallback?.proven, true, `${requested} optimality`);
    assert.equal(row.constrainedFallback?.timeCapped, false, `${requested} time cap`);
    assert.equal(row.constrainedFallback?.nodeCapped, false, `${requested} node cap`);
    assert.equal((row.constrainedFallback?.requirements||[]).includes('fire-brid-specialist-b2'), false,
      `${requested} Christmas Brid must remain optional`);
    assert.equal(row.shotgunFlexes.every(id => id === 'solineFrostTicket' || id === 'sugarTreasure'), true,
      `${requested} shotgun FLEX must use the current Frost Ticket/Sugar elemental rule`);
    assert.equal(row.moderniaActive, false, `${requested} Modernia active`);
    assert.equal(row.validation?.pass, true, `${requested} validation ${JSON.stringify(row.validation)}`);
    assert.equal(row.cacheHit, true, `${requested} cache hit`);
    assert.equal(row.deterministic, true, `${requested} deterministic cache`);
  }
  assert.equal(pageCrashes.length, 0, pageCrashes.join('\n'));
  assert.equal(runtimeExceptions.length, 0, runtimeExceptions.join('\n'));
  assert.equal(fatalConsole.length, 0, fatalConsole.join('\n'));
  console.log(JSON.stringify({version:'34.7.18',boss:'luxuriousSpiderS40',modes:report,runtimeExceptions,fatalConsole,pageCrashes,pass:true},null,2));
  console.log('V34.7.18 S40 auto/owned/allEqual production-mode verification: PASS');
} finally {
  cdp?.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 500));
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (_) {}
}
