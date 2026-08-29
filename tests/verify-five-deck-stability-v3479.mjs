import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHtml=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const sync=fs.readFileSync(new URL('../functions/api/blabla/sync.js',import.meta.url),'utf8');

assert.equal(html,publicHtml,'root/public HTML mirror');
assert.equal(pkg.version,'34.7.15','package version');
assert.match(sync,/const VERSION = '34\.7\.15';/,'Worker bridge version');
assert.match(html,/V34\.7\.15/,'visible V34.7.15 marker');
assert.match(html,/id="v3479-five-deck-stability-marker"/,'release marker');
assert.match(html,/NIKKE_V3479_FIVE_DECK_STABILITY/,'runtime release contract');

// Automatic guard: only a large, synced, owned five-team roster on a constrained device.
assert.match(html,/const largeSyncedRoster = ownedOnly && available\.length >= 80;/);
assert.match(html,/Boolean\(global\.AndroidNative\).*viewportWidth <= 820/,'APK and narrow-web constrained device detection');
assert.match(html,/const stabilityMode = rawOptions\.stabilityMode !== false && constrainedDevice && largeSyncedRoster && requestedTeams >= 5;/);
assert.match(html,/Math\.max\(5, Math\.min\(6, requestedPairLimit\)\)/,'mobile pair cap');
assert.match(html,/Math\.max\(3, Math\.min\(4, Math\.round\(finite\(rawOptions\.flexLimit, 3\)\)\)\)/,'mobile flex cap');
assert.match(html,/finite\(rawOptions\.pairComputationBudget, 180\)/,'exact pair safety budget');

// Expensive pre-ranking is compact/reused, selected teams are still exact recalculations.
assert.match(html,/function compactPreRankScored\(scored\)/);
assert.match(html,/const bossB3TemplateCache = new Map\(\);/);
assert.match(html,/const bossFlexRankCache = new Map\(\);/);
assert.match(html,/bossB3TemplateCache\.set\(row\.id, compactPreRankScored\(scored\)\)/);
assert.match(html,/pairExact = exactPairScore\(pair\.left, pair\.right, team, boss/,'selected candidate exact pair recalculation');
assert.doesNotMatch(html,/const supportDirectScore\s*=/,'dead support direct scoring removed');

// Repeated priority pair expansion is bounded globally, not repeated for every blueprint.
assert.match(html,/priorityPairExtraLimit: 2/);
assert.match(html,/priorityPairCoverage/);
assert.match(html,/if \(stabilityMode && covered\?\.has\(id\)\) continue;/);

// Large transient caches must not survive the completed candidate build.
for(const expression of [
  'pairScoreCache.clear\\(\\)',
  'directScoreCache.clear\\(\\)',
  'pairDirectScoreCache.clear\\(\\)',
  'calibrationRuntime.cache.clear\\(\\)',
  'bossFlexPreRanks.clear\\(\\)',
  'bossB3TemplateCache.clear\\(\\)',
  'bossFlexRankCache.clear\\(\\)'
]) assert.match(html,new RegExp(expression),`cache release: ${expression}`);
assert.match(html,/cacheReleased: true/);
assert.match(html,/await yieldToUi\(\)/,'cooperative browser yielding');


assert.equal((html.match(/id="v3479-five-deck-stability"/g)||[]).length,1,'one visible-route stability runtime');
assert.match(html,/passes=low\?\[\[6,3\],\[8,4\]\]:\[\[8,4\],\[10,5\]\]/,'bounded Android widening passes');
assert.match(html,/stabilityMode:true,pairComputationBudget:180,priorityPairExtraLimit:2/,'visible route forces bounded candidate mode');
assert.match(html,/built\.candidates\.length=0/,'visible route releases heavy candidate pool');
assert.match(html,/root\.NIKKEV3420Run=run/,'visible button route overridden');

console.log('V34.7.15 five-deck large synced roster static stability verification: PASS');
