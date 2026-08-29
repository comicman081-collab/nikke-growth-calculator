import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'));
const SCREENSHOT=path.join(ROOT,'V34718_S40_BADGE_QA.png');
const PRECISION_SCREENSHOT=path.join(ROOT,'V34718_PRECISION_OUTPUT_QA.png');
const AUTOSYNC_SCREENSHOT=path.join(ROOT,'V34718_AUTOSYNC_LAYOUT_QA.png');
const FORM_SCREENSHOT=path.join(ROOT,'V34718_FORM_FONT_QA.png');
const FIVE_DECK_SCREENSHOT=path.join(ROOT,'V34718_FIVE_DECK_WAIT_QA.png');
function rgb(value){const parts=String(value).match(/[\d.]+/g)?.slice(0,3).map(Number)||[0,0,0];return parts.map(channel=>{const unit=channel/255;return unit<=.04045?unit/12.92:((unit+.055)/1.055)**2.4;});}
function contrast(foreground,background){const a=rgb(foreground),b=rgb(background),la=.2126*a[0]+.7152*a[1]+.0722*a[2],lb=.2126*b[0]+.7152*b[1]+.0722*b[2];return(Math.max(la,lb)+.05)/(Math.min(la,lb)+.05);}
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
function chromeBinary(){const local=process.env.LOCALAPPDATA||'';for(const file of [process.env.CHROME_BIN,process.env.EDGE_BIN,local&&path.join(local,'Google','Chrome','Application','chrome.exe'),local&&path.join(local,'Microsoft','Edge','Application','msedge.exe'),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'])if(file&&fs.existsSync(file))return file;throw new Error('Chrome/Edge executable not found');}
async function waitForJson(url,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){try{const response=await fetch(url);if(response.ok)return response.json();}catch(_){}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`timeout: ${url}`);}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map();}async connect(){this.ws=new WebSocket(this.url);await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});this.ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id){const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);msg.error?pending.reject(new Error(JSON.stringify(msg.error))):pending.resolve(msg.result);return;}for(const fn of this.listeners.get(msg.method)||[])fn(msg.params);});}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list);}close(){try{this.ws.close();}catch(_){}}}
async function evaluate(cdp,expression){const out=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(out.exceptionDetails)throw new Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);return out.result?.value;}
async function waitFor(cdp,expression,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(cdp,`Boolean(${expression})`))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`browser condition timeout: ${expression}`);}

const server=http.createServer((request,response)=>{if(request.url==='/'||request.url==='/index.html'){response.setHeader('content-type','text/html; charset=utf-8');response.end(HTML);return;}response.statusCode=404;response.end('not found');});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port,debugPort=await freePort(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nikke-v34717-chrome-'));
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='',cdp;
chrome.stderr.on('data',chunk=>{stderr+=chunk.toString();});
try{
  const pages=await waitForJson(`http://127.0.0.1:${debugPort}/json`),page=pages.find(row=>row.type==='page')||pages[0];
  assert.ok(page?.webSocketDebuggerUrl,'CDP page target');
  cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.connect();await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  const exceptions=[];cdp.on('Runtime.exceptionThrown',event=>exceptions.push(event.exceptionDetails?.exception?.description||event.exceptionDetails?.text||'exception'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1365,height:768,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  await waitFor(cdp,"document.readyState==='complete' && window.NIKKEV34717RosterCubeLayout && document.querySelectorAll('.v32-bulk-cube-control').length>=3",60000);
  const cube=[];
  for(const [pageId,location] of [['precision','precision'],['v26Optimizer','optimizer'],['v26Roster','roster']]){
    await evaluate(cdp,`(()=>{document.querySelector('[data-page="${pageId}"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;})()`);
    await waitFor(cdp,`document.querySelector('.v32-bulk-cube-control[data-v32-bulk-location="${location}"]')?.getBoundingClientRect().width>100`);
    cube.push(await evaluate(cdp,`(()=>{const control=document.querySelector('.v32-bulk-cube-control[data-v32-bulk-location="${location}"]'),c=control.getBoundingClientRect(),children=[...control.querySelectorAll('select,button')].map(node=>{const r=node.getBoundingClientRect();return{tag:node.tagName,left:r.left,right:r.right,top:r.top,bottom:r.bottom,inside:r.left>=c.left-.75&&r.right<=c.right+.75};});return{location:control.dataset.v32BulkLocation,width:c.width,columns:getComputedStyle(control.querySelector('.v32-bulk-cube-grid')).gridTemplateColumns,children,inside:children.every(row=>row.inside)};})()`));
  }
  assert.equal(cube.length,3,'three shared cube controls');
  assert.ok(cube.every(row=>row.inside),JSON.stringify(cube,null,2));
  const precision=cube.find(row=>row.location==='precision');assert.ok(precision,'precision cube control');
  assert.ok(precision.children.find(row=>row.tag==='BUTTON').top>=Math.max(...precision.children.filter(row=>row.tag==='SELECT').map(row=>row.bottom)),'narrow precision card wraps button below selects');

  await evaluate(cdp,`(()=>{document.querySelector('[data-page="precision"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;document.getElementById('precisionCycleOutput')?.scrollIntoView({block:'center'});})()`);
  await waitFor(cdp,"document.getElementById('precisionCycleOutput')?.getBoundingClientRect().width>500",30000);
  const precisionOutput=await evaluate(cdp,`(()=>{const card=document.getElementById('precisionCycleOutput'),grid=card.closest('.grid'),kpis=card.querySelector('.kpis'),note=document.getElementById('v26CalibrationNotes'),reference=document.getElementById('v26CalibrationDifficulty'),cr=card.getBoundingClientRect(),gr=grid.getBoundingClientRect(),ks=getComputedStyle(kpis),ns=getComputedStyle(note),rs=getComputedStyle(reference);return{cardWidth:cr.width,gridWidth:gr.width,leftDelta:Math.abs(cr.left-gr.left),rightDelta:Math.abs(cr.right-gr.right),columns:ks.gridTemplateColumns.split(' ').filter(Boolean).length,noteFont:ns.fontFamily,referenceFont:rs.fontFamily,noteBackground:ns.backgroundColor,noteColor:ns.color};})()`);
  assert.ok(precisionOutput.cardWidth>=precisionOutput.gridWidth-2,JSON.stringify(precisionOutput));assert.ok(precisionOutput.leftDelta<=1&&precisionOutput.rightDelta<=1,JSON.stringify(precisionOutput));assert.equal(precisionOutput.columns,4,'desktop cycle output uses four equal columns');assert.equal(precisionOutput.noteFont,precisionOutput.referenceFont,'memo inherits the same app font as other form controls');assert.equal(precisionOutput.noteBackground,'rgba(255, 255, 255, 0.96)');assert.equal(precisionOutput.noteColor,'rgb(16, 24, 39)');
  const precisionShot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(PRECISION_SCREENSHOT,Buffer.from(precisionShot.data,'base64'));

  await evaluate(cdp,`(()=>{document.querySelector('[data-page="v26Calibration"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;document.getElementById('v26CalibrationNotes')?.scrollIntoView({block:'center'});})()`);
  await waitFor(cdp,"document.getElementById('v26CalibrationNotes')?.getBoundingClientRect().height>50",30000);
  const formShot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(FORM_SCREENSHOT,Buffer.from(formShot.data,'base64'));

  await evaluate(cdp,`(()=>{document.querySelector('[data-page="v26Optimizer"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;document.querySelector('.v34718-five-deck-wait-note')?.scrollIntoView({block:'center'});})()`);
  await waitFor(cdp,"document.querySelector('.v34718-five-deck-wait-note')?.textContent.includes('30초에서 수분')",30000);
  const waitNotice=await evaluate(cdp,`(()=>{const note=document.querySelector('.v34718-five-deck-wait-note'),panel=document.getElementById('nikke-kit-aware-optimizer-panel'),head=panel.querySelector('.nikke-kit-head'),ns=getComputedStyle(note),nr=note.getBoundingClientRect(),hr=head.getBoundingClientRect();return{text:note.textContent.trim(),fontSize:parseFloat(ns.fontSize),aboveHead:nr.bottom<=hr.top+1,panelFirst:panel.firstElementChild===note};})()`);
  assert.match(waitNotice.text,/30초에서 수분/);assert.ok(waitNotice.fontSize<=13,JSON.stringify(waitNotice));assert.equal(waitNotice.aboveHead,true,JSON.stringify(waitNotice));assert.equal(waitNotice.panelFirst,true,JSON.stringify(waitNotice));
  const waitShot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(FIVE_DECK_SCREENSHOT,Buffer.from(waitShot.data,'base64'));

  await evaluate(cdp,`(()=>{document.querySelector('[data-page="v34610External"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;document.getElementById('v3474DeployAutoPanel')?.scrollIntoView({block:'center'});})()`);
  await waitFor(cdp,"document.getElementById('v3474DeployAutoPanel')?.classList.contains('v34718-deploy-auto-layout')",30000);
  const autoSyncLayout=await evaluate(cdp,`(()=>{const panel=document.getElementById('v3474DeployAutoPanel'),copy=panel.querySelector(':scope>.v34718-deploy-auto-copy'),label=panel.querySelector(':scope>label'),status=panel.querySelector(':scope>#v3474DeploySyncStatus'),ps=getComputedStyle(panel),ls=getComputedStyle(label),pr=panel.getBoundingClientRect(),cr=copy.getBoundingClientRect(),lr=label.getBoundingClientRect(),sr=status.getBoundingClientRect(),contentRight=pr.right-parseFloat(ps.paddingRight||0);return{columns:ps.gridTemplateColumns.split(' ').filter(Boolean).length,labelWhiteSpace:ls.whiteSpace,labelWidth:lr.width,labelHeight:lr.height,centerDelta:Math.abs((cr.top+cr.height/2)-(lr.top+lr.height/2)),statusLeftDelta:Math.abs(sr.left-cr.left),statusRightDelta:Math.abs(sr.right-contentRight),statusBelow:sr.top>=Math.max(cr.bottom,lr.bottom)-1};})()`);
  assert.equal(autoSyncLayout.columns,2,'deployed sync notice uses copy + toggle columns');assert.equal(autoSyncLayout.labelWhiteSpace,'nowrap');assert.ok(autoSyncLayout.labelWidth>120&&autoSyncLayout.labelHeight<32,JSON.stringify(autoSyncLayout));assert.ok(autoSyncLayout.centerDelta<=1,JSON.stringify(autoSyncLayout));assert.ok(autoSyncLayout.statusLeftDelta<=1&&autoSyncLayout.statusRightDelta<=1,JSON.stringify(autoSyncLayout));assert.equal(autoSyncLayout.statusBelow,true,JSON.stringify(autoSyncLayout));
  const autoSyncShot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(AUTOSYNC_SCREENSHOT,Buffer.from(autoSyncShot.data,'base64'));

  await evaluate(cdp,`(()=>{document.querySelector('[data-page="v26Roster"]')?.click();const overlay=document.getElementById('v26AccountOverlay');if(overlay)overlay.hidden=true;})()`);
  await waitFor(cdp,"document.querySelectorAll('#v26RosterList .v26-roster-row').length>50",30000);
  const before=await evaluate(cdp,`(()=>{const list=document.getElementById('v26RosterList'),rows=[...list.querySelectorAll('.v26-roster-row')],pick=rows[10].querySelector('.v26-roster-pick'),checkbox=rows[10].querySelector('input[data-roster-action="owned"]');list.scrollTop=260;window.__v34717Events=0;window.addEventListener('nikke:v26-roster-updated',()=>window.__v34717Events++);return{tag:pick.tagName,action:pick.dataset.rosterAction||'',background:getComputedStyle(pick).backgroundColor,transform:getComputedStyle(pick).transform,scrollTop:list.scrollTop,id:checkbox.dataset.characterId,owned:checkbox.checked,selected:document.querySelector('.v26-roster-row.is-selected')?.querySelector('.v26-roster-pick')?.dataset.characterId||''};})()`);
  assert.equal(before.tag,'DIV');assert.equal(before.action,'');assert.equal(before.background,'rgb(255, 255, 255)');assert.equal(before.transform,'none');
  const clicked=await evaluate(cdp,`(()=>{const pick=document.querySelectorAll('#v26RosterList .v26-roster-pick')[10],prior=document.querySelector('.v26-roster-row.is-selected')?.querySelector('.v26-roster-pick')?.dataset.characterId||'';pick.click();return{prior,after:document.querySelector('.v26-roster-row.is-selected')?.querySelector('.v26-roster-pick')?.dataset.characterId||''};})()`);
  assert.equal(clicked.after,clicked.prior,'read-only character box click does not select or rerender');
  const after=await evaluate(cdp,`(async()=>{const list=document.getElementById('v26RosterList'),id=${JSON.stringify(before.id)},checkbox=list.querySelector('input[data-character-id="'+id+'"]');checkbox.click();await new Promise(resolve=>setTimeout(resolve,180));const row=list.querySelector('input[data-character-id="'+id+'"]').closest('.v26-roster-row'),stored=window.NIKKE_V26_ROSTER_API.load().characters[id],badge=row.querySelector('.v3466-s40-fit'),badgeStyle=getComputedStyle(badge);return{scrollTop:list.scrollTop,id,checked:row.querySelector('input').checked,storedOwned:stored.owned,events:window.__v34717Events,background:getComputedStyle(row.querySelector('.v26-roster-pick')).backgroundColor,transform:getComputedStyle(row.querySelector('.v26-roster-pick')).transform,badgeColor:badgeStyle.color,badgeBackground:badgeStyle.backgroundColor,badgeText:badge.textContent.trim(),sharedApi:!!window.NIKKE_V26_ROSTER_API,sharedGrowth:!!window.__v26TeamGrowthContext,verification:window.NIKKEV34717RosterCubeLayout.verify()};})()`);
  assert.ok(Math.abs(after.scrollTop-before.scrollTop)<=1,`roster scroll moved ${before.scrollTop} -> ${after.scrollTop}`);
  assert.equal(after.checked,!before.owned);assert.equal(after.storedOwned,!before.owned);assert.ok(after.events>=1,'shared roster update event dispatched');assert.equal(after.background,'rgb(255, 255, 255)');assert.equal(after.transform,'none');assert.match(after.badgeText,/S40 타수/);assert.ok(contrast(after.badgeColor,after.badgeBackground)>=7,`S40 badge contrast ${contrast(after.badgeColor,after.badgeBackground).toFixed(2)}:1 (${after.badgeColor} on ${after.badgeBackground})`);assert.ok(after.sharedApi&&after.sharedGrowth,'shared data layers remain active');assert.equal(after.verification.pass,true,JSON.stringify(after.verification));
  await evaluate(cdp,`(()=>{const list=document.getElementById('v26RosterList');list?.scrollIntoView({block:'start'});window.scrollBy(0,-115);})()`);
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(SCREENSHOT,Buffer.from(shot.data,'base64'));
  const actionable=exceptions.filter(text=>!/ResizeObserver loop/i.test(text));assert.deepEqual(actionable,[],`browser exceptions: ${actionable.join('\n')}`);
  console.log(JSON.stringify({pass:true,cube,precisionOutput,waitNotice,autoSyncLayout,roster:{before,after},screenshots:[SCREENSHOT,PRECISION_SCREENSHOT,AUTOSYNC_SCREENSHOT,FORM_SCREENSHOT,FIVE_DECK_SCREENSHOT]},null,2));
}finally{
  cdp?.close();chrome.kill();server.close();try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){}
  if(stderr&&!/DevTools listening on/.test(stderr))console.error(stderr.slice(-2000));
}
