import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const query = `query AuditCharacters { characters { name_code name_localkey resource_id original_rare class element_id use_burst_skill corporation } }`;
async function gql(endpoint) {
  const res = await fetch(endpoint, {method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{}})});
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${text.slice(0,200)}`);
  const p = JSON.parse(text);
  if (p.errors?.length) throw new Error(p.errors.map(x=>x.message).join(' / '));
  return p.data?.characters || [];
}
let characters=[]; const errs=[];
for (const ep of ['https://enikk.app/api/graphql','https://enikk.app/api/webapp']) { try { characters=await gql(ep); if(characters.length) break; } catch(e){errs.push(e.message);} }
if (!characters.length) throw new Error(`ENIKK master unavailable: ${errs.join(' | ')}`);

const browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files']});
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(() => !!window.NIKKEV34610External?.idForName && Array.isArray(window.NIKKE_V26_7_CHARACTER_CATALOG) && !!window.NIKKE_V26_ROSTER_API?.load,{timeout:30000});
await new Promise(r=>setTimeout(r,1800));

const runtime = await page.evaluate((rows)=>{
  const ext=window.NIKKEV34610External;
  const api=window.NIKKE_V26_ROSTER_API;
  const catalog=Array.isArray(window.NIKKE_V26_7_CHARACTER_CATALOG)?window.NIKKE_V26_7_CHARACTER_CATALOG:[];
  const saved=api.load?.()?.characters||{};
  const byId=new Map(catalog.filter(x=>x?.id).map(x=>[String(x.id),x]));
  const mappings=rows.map(row=>{
    const name=String(row.name_localkey||'');
    let id=null, error='';
    try{id=ext.idForName(name)||null;}catch(e){error=String(e?.message||e);}
    const c=id?byId.get(String(id)):null;
    return {nameCode:Number(row.name_code),gameName:name,id,error,catalogPresent:!!c,rosterSchemaPresent:!!(id&&saved[id]),appName:c?.name||'',aliases:Array.isArray(c?.aliases)?c.aliases:[],skillName:c?.skillProfile?.name||'',skillAliases:Array.isArray(c?.skillProfile?.aliases)?c.skillProfile.aliases:[]};
  });
  const catalogRows=catalog.filter(x=>x?.id).map(x=>({id:String(x.id),name:String(x.name||''),aliases:Array.isArray(x.aliases)?x.aliases.map(String):[],skillName:String(x.skillProfile?.name||''),skillAliases:Array.isArray(x.skillProfile?.aliases)?x.skillProfile.aliases.map(String):[],origin:String(x.origin||''),sourceConfidence:String(x.sourceConfidence||'')}));
  const favorites=window.__NIKKE_V34610_ENIKK_TABLES__?.favorites||{};
  return {mappings,catalogRows,favorites,rosterCount:Object.keys(saved).length,catalogCount:catalog.length};
}, characters);
await browser.close();

const byCode=new Map(characters.map(x=>[String(x.name_code),x]));
const favRows=Object.entries(runtime.favorites||{}).filter(([,x])=>x?.rare==='SSR'&&Number(x.nameCode)>0).map(([tid,x])=>{
  const m=runtime.mappings.find(y=>y.nameCode===Number(x.nameCode));
  return {favoriteTid:Number(tid),favoriteItemName:String(x.name||''),nameCode:Number(x.nameCode),gameName:String(byCode.get(String(x.nameCode))?.name_localkey||''),mappedId:m?.id||null,appName:m?.appName||'',catalogPresent:!!m?.catalogPresent,rosterSchemaPresent:!!m?.rosterSchemaPresent};
});
const mapped=runtime.mappings.filter(x=>x.id&&x.catalogPresent&&x.rosterSchemaPresent);
const nameOnly=runtime.mappings.filter(x=>x.id&&(!x.catalogPresent||!x.rosterSchemaPresent));
const unmapped=runtime.mappings.filter(x=>!x.id);
const catalogByName=new Map();
const canon=v=>String(v??'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]+/g,'');
for(const c of runtime.catalogRows){for(const n of [c.name,c.skillName,...c.aliases,...c.skillAliases]){const k=canon(n);if(!k)continue;if(!catalogByName.has(k))catalogByName.set(k,[]);catalogByName.get(k).push({id:c.id,name:n});}}
function lev(a,b){a=canon(a);b=canon(b);const m=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const t=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return m[b.length];}
const candidates=runtime.catalogRows.flatMap(c=>[c.name,c.skillName,...c.aliases,...c.skillAliases].filter(Boolean).map(name=>({id:c.id,name})));
const unmatchedWithSuggestions=unmapped.map(u=>({...u,suggestions:candidates.map(c=>({...c,d:lev(u.gameName,c.name)})).sort((a,b)=>a.d-b.d).slice(0,4)}));
const report={generatedAt:new Date().toISOString(),enikkCount:characters.length,catalogCount:runtime.catalogCount,rosterSchemaCount:runtime.rosterCount,fullyMappedCount:mapped.length,nameResolvedButUnavailableCount:nameOnly.length,unmappedCount:unmapped.length,favoriteCount:favRows.length,favoriteFullyMapped: favRows.filter(x=>x.mappedId&&x.catalogPresent&&x.rosterSchemaPresent).length,favoriteRows:favRows,mapped,nameOnly,unmapped:unmatchedWithSuggestions,catalogRows:runtime.catalogRows};
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/runtime-name-mapping-audit.json',JSON.stringify(report,null,2));
console.log(`ENIKK=${report.enikkCount} runtimeCatalog=${report.catalogCount} rosterSchema=${report.rosterSchemaCount}`);
console.log(`FULLY_MAPPED=${report.fullyMappedCount} NAME_ONLY=${report.nameResolvedButUnavailableCount} UNMAPPED=${report.unmappedCount}`);
console.log(`FAVORITE=${report.favoriteCount} FULLY_MAPPED=${report.favoriteFullyMapped}`);
console.log('--- FAVORITE ---');
for(const x of favRows) console.log(`${x.mappedId&&x.catalogPresent&&x.rosterSchemaPresent?'PASS':'FAIL'} code=${x.nameCode} game="${x.gameName}" -> ${x.mappedId||'-'} app="${x.appName}" item="${x.favoriteItemName}" schema=${x.rosterSchemaPresent}`);
console.log('--- UNMAPPED ---');
for(const x of unmatchedWithSuggestions) console.log(`code=${x.nameCode} game="${x.gameName}" suggestions=${x.suggestions.map(s=>`${s.name}->${s.id}(d${s.d})`).join(' | ')}`);
console.log('--- NAME RESOLVED BUT NOT AVAILABLE ---');
for(const x of nameOnly) console.log(`code=${x.nameCode} game="${x.gameName}" -> ${x.id} catalog=${x.catalogPresent} schema=${x.rosterSchemaPresent}`);
