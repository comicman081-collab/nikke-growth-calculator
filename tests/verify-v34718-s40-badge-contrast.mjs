import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const publicHtml=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

assert.equal(html,publicHtml,'root/public HTML mirror');
assert.equal(pkg.version,'34.7.20');
assert.equal((html.match(/id="v34718-s40-badge-contrast-style"/g)||[]).length,1,'one badge contrast style');
assert.match(html,/#f4fbff!important/,'bright S40 badge foreground');
assert.match(html,/#0b3a50!important/,'stable dark S40 badge background');
assert.match(html,/border-color:#62d7ff!important/,'visible badge border');
assert.match(html,/font-weight:850!important/,'readable badge weight');
assert.match(html,/id="precisionCycleOutput"/,'precision cycle output has an explicit full-width target');
assert.match(html,/#precisionCycleOutput\{grid-column:1\/-1!important\}/,'precision cycle output spans the shared grid');
assert.match(html,/button,input,select,textarea\{font-family:inherit\}/,'all form controls inherit the app font');
assert.match(html,/textarea::placeholder\{color:#8a93a3/,'textarea placeholder uses the shared subdued tone');
assert.equal((html.match(/id="v34718-ui-alignment-runtime"/g)||[]).length,1,'one runtime alignment repair');
assert.match(html,/v34718-deploy-auto-layout/,'deployed auto-sync row uses the repaired horizontal layout');
assert.match(html,/white-space:nowrap/,'auto-sync toggle remains on one line');
assert.match(html,/v34718-five-deck-wait-note/,'five-deck wait notice is installed above the optimizer');
assert.match(html,/약 30초에서 수분까지 걸릴 수 있습니다/,'five-deck wait notice states the expected duration range');
assert.match(html,/id="v34717-roster-cube-layout-style"/,'previous containment and roster stability retained');
assert.doesNotMatch(html,/<button type="button" class="v26-roster-pick" data-roster-action="select"/,'roster information remains non-interactive');
console.log('V34.7.20 S40 contrast + full-width precision output + shared form typography: PASS');
