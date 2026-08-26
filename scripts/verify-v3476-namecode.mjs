import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';

const html=fs.readFileSync('index.html','utf8');
if(!html.includes("NIKKEV3476NameCodeMapping"))throw new Error('V34.7.6 runtime map export missing');
if(html.includes('id=idForName(display)||supplementalId(row.nameCode)'))throw new Error('legacy name-first importer still present');
if(!html.includes('id=idForNameCode(row.nameCode)||supplementalId(row.nameCode)'))throw new Error('nameCode-first importer not installed');
if(fs.readFileSync('public/index.html','utf8')!==html)throw new Error('root/public HTML diverged');

const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files']});
const page=await browser.newPage();
page.on('pageerror',e=>console.error('PAGEERROR',e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>!!window.NIKKEV3476NameCodeMapping?.idForNameCode&&!!window.NIKKEV34610External?.importExternalRoster&&!!window.NIKKE_V26_ROSTER_API?.load,{timeout:30000});
await new Promise(r=>setTimeout(r,1500));

const check=await page.evaluate(async()=>{
  const m=window.NIKKEV3476NameCodeMapping;
  const catalog=window.NIKKE_V26_7_CHARACTER_CATALOG||[];
  const values=Object.values(m.map||{});
  const catalogIds=[...new Set(catalog.map(x=>String(x?.id||'')).filter(Boolean))];
  const expected={
    '5118':'asukaShikinamiLangley',
    '5119':'reiAyanami',
    '5132':'reiAyanamiTentative',
    '5133':'asukaWille',
    '5016':'poliTreasure',
    '5122':'phantomTreasure',
    '5045':'rosannaTreasure',
    '5120':'mariMakinami',
    '5153':'jillValentine'
  };
  const direct={};for(const [k,v] of Object.entries(expected))direct[k]=m.idForNameCode(k);
  direct['5069']=m.idForNameCode('5069');

  const rows=['5069','5119','5132','5118','5133','5016','5122','5045','5120','5153'].map((code,i)=>({
    nameCode:Number(code),lv:700+i,grade:3,core:2,attractiveLv:30,skill1Lv:10,skill2Lv:9,ultiSkillLv:8,
    favoriteItemTid:0,favoriteItemLv:0,harmonyCubeTid:0,equipments:[],equipment:[],overload:[],overloadInfo:[]
  }));
  let importResult=null,importError='';
  try{importResult=await window.NIKKEV34610External.importExternalRoster({characters:rows},'v3476-namecode-fixture');}
  catch(e){importError=String(e?.stack||e);}
  const roster=window.NIKKE_V26_ROSTER_API.load();
  const ids=['enikk_5069','reiAyanami','reiAyanamiTentative','asukaShikinamiLangley','asukaWille','poliTreasure','phantomTreasure','rosannaTreasure','mariMakinami','jillValentine'];
  const stored=Object.fromEntries(ids.map(id=>[id,roster?.characters?.[id]||null]));
  const registry=window.NIKKE_V26_ROSTER_API.catalog?.()||[];
  const supplemental=registry.find(x=>x?.id==='enikk_5069')||null;
  return {count:m.count,mapKeys:Object.keys(m.map||{}).length,uniqueValues:new Set(values).size,catalogCount:catalogIds.length,missingCatalog:catalogIds.filter(id=>!values.includes(id)),extraValues:values.filter(id=>!catalogIds.includes(id)),direct,importError,importResult,stored,supplemental};
});
await browser.close();

if(check.count!==100||check.mapKeys!==100||check.uniqueValues!==100)throw new Error(`authority map not 100x100: ${JSON.stringify(check)}`);
if(check.catalogCount!==100||check.missingCatalog.length||check.extraValues.length)throw new Error(`authority map does not cover runtime catalog exactly: ${JSON.stringify(check)}`);
const expected={5118:'asukaShikinamiLangley',5119:'reiAyanami',5132:'reiAyanamiTentative',5133:'asukaWille',5016:'poliTreasure',5122:'phantomTreasure',5045:'rosannaTreasure',5120:'mariMakinami',5153:'jillValentine'};
for(const [code,id] of Object.entries(expected))if(check.direct[code]!==id)throw new Error(`${code} expected ${id}, got ${check.direct[code]}`);
if(check.direct['5069'])throw new Error(`base NIKKE Rei 5069 incorrectly mapped to ${check.direct['5069']}`);
if(check.importError)throw new Error(`fixture import failed: ${check.importError}`);
for(const id of ['enikk_5069','reiAyanami','reiAyanamiTentative','asukaShikinamiLangley','asukaWille','poliTreasure','phantomTreasure','rosannaTreasure','mariMakinami','jillValentine'])if(!check.stored[id]?.owned)throw new Error(`fixture did not store ${id}`);
if(check.stored.enikk_5069.level===check.stored.reiAyanami.level)throw new Error('base Rei and Ayanami Rei collided in storage');
if(check.supplemental?.calculationSupported!==false)throw new Error('base Rei supplemental should remain roster-only');
console.log('V34.7.6 nameCode authority verification PASS');
console.log(JSON.stringify({mapCount:check.count,catalogCount:check.catalogCount,direct:check.direct,stored:Object.fromEntries(Object.entries(check.stored).map(([k,v])=>[k,{owned:v?.owned,level:v?.level}]))},null,2));
