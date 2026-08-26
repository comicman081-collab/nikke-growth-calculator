#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const ORIGIN='https://enikk.app';
const PATH='audit/enikk-favorite-characters-v3477.json';
const MD_PATH='audit/enikk-favorite-characters-v3477.md';
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

async function fetchText(url){
  const response=await fetch(url,{redirect:'follow',headers:{'user-agent':'nikke-growth-calculator-v3477-base-skill-audit/1.0'}});
  if(!response.ok)throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.text();
}

function balancedObject(text,start){
  if(text[start]!=='{')return null;
  let depth=0,quote=null,escaped=false;
  for(let index=start;index<text.length;index+=1){
    const ch=text[index];
    if(quote!==null){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"')quote='"';
    else if(ch==='{')depth+=1;
    else if(ch==='}'){
      depth-=1;
      if(depth===0)return text.slice(start,index+1);
    }
  }
  return null;
}

function rscStrings(html){
  const strings=[];
  const pattern=/<script[^>]*>\s*self\.__next_f\.push\((\[[\s\S]*?\])\)\s*<\/script>/gi;
  for(const match of html.matchAll(pattern)){
    try{
      const value=JSON.parse(match[1]);
      if(Array.isArray(value)&&typeof value[1]==='string')strings.push(value[1]);
    }catch(_){/* keep the other RSC payloads */}
  }
  return strings;
}

function extractDetail(html,expectedId){
  const joined=rscStrings(html).join('\n');
  const needles=[`\"character\":{\"id\":${expectedId}`,`"character":{"id":${expectedId}`];
  let anchor=-1;
  for(const needle of needles){anchor=joined.indexOf(needle);if(anchor>=0)break;}
  if(anchor<0)throw new Error(`character ${expectedId} was not found in decoded RSC payload`);
  const detailKey=joined.indexOf('"detail":',anchor);
  if(detailKey<0)throw new Error(`detail object for ${expectedId} was not found`);
  const objectStart=joined.indexOf('{',detailKey);
  const raw=balancedObject(joined,objectStart);
  if(!raw)throw new Error(`detail object for ${expectedId} was not balanced`);
  return JSON.parse(raw);
}

function stripMarkup(value){
  return String(value??'')
    .replace(/<color=[^>]+>/gi,'')
    .replace(/<\/color>/gi,'')
    .replace(/<word_group=[^>]+>/gi,'')
    .replace(/<\/word_group>/gi,'')
    .replace(/<[^>]+>/g,'')
    .replace(/\r/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n[ \t]+/g,'\n')
    .replace(/[ \t]{2,}/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

const report=JSON.parse(fs.readFileSync(PATH,'utf8'));
const failures=[];
let cursor=0;
async function worker(){
  while(true){
    const index=cursor++;
    if(index>=report.characters.length)return;
    const row=report.characters[index];
    const url=row.page?.url||`${ORIGIN}/characters/${row.character.slug}`;
    try{
      const html=await fetchText(url),detail=extractDetail(html,row.character.id);
      const shot=detail.shot&&typeof detail.shot==='object'?{
        weaponType:detail.shot.weaponType??null,
        name:detail.shot.name??null,
        maxAmmo:Number(detail.shot.maxAmmo)||0,
        reloadSeconds:Number(detail.shot.reloadSeconds)||0,
        fireType:detail.shot.fireType??null,
        description:stripMarkup(detail.shot.description),
      }:null;
      const skills=(Array.isArray(detail.skills)?detail.skills:[]).map(skill=>{
        const levels=Array.isArray(skill.levels)?skill.levels.map(stripMarkup):[];
        return{
          slot:String(skill.slot||''),
          name:String(skill.name||''),
          icon:String(skill.icon||''),
          cooldownSeconds:skill.cooldownSeconds==null?null:Number(skill.cooldownSeconds),
          levels,
          level10:levels[9]??levels.at(-1)??'',
        };
      });
      row.page.baseDetail={
        source:'ENIKK deployed RSC detail object',
        htmlSha256:sha256(html),
        shot,
        skills,
        complete:Boolean(shot&&skills.length===3&&skills.every(skill=>skill.slot&&skill.name&&skill.levels.length>=10&&skill.level10)),
      };
    }catch(error){failures.push({slug:row.character.slug,url,error:String(error)});}
  }
}
await Promise.all(Array.from({length:Math.min(6,report.characters.length)},worker));

const complete=report.characters.filter(row=>row.page?.baseDetail?.complete).length;
report.auditVersion=Math.max(4,Number(report.auditVersion)||0);
report.baseDetailEnrichment={fetchedAtUtc:new Date().toISOString(),complete,failures};
report.counts.completeBaseDetails=complete;
fs.writeFileSync(PATH,JSON.stringify(report,null,2));

const lines=[
  '# ENIKK complete favorite-character roster — V34.7.7','',
  '> 21개 SSR Favorite 마스터 TID, 일반 Lv.1~10 스킬, 무기 수치, Phase 1~3 애장품 스킬 카드를 ENIKK 배포 데이터에서 직접 대조했다.','',
  `- Favorite master items: **${report.counts.favoriteMasterItems}**`,
  `- Favorite characters resolved: **${report.counts.favoriteCharacters}**`,
  `- Complete base weapon/skill details: **${report.counts.completeBaseDetails}**`,
  `- Complete three-phase orders: **${report.counts.completePhaseOrders}**`,
  `- Complete three-card favorite skill extracts: **${report.counts.completeFavoriteSkillCards}**`,
  `- Base detail fetch/parse failures: **${failures.length}**`,
  `- Unresolved TIDs: **${report.unresolvedMasterTids.join(', ')||'(none)'}**`,'',
  '## Roster','',
  '| Character | TID | Base S1 | Base S2 | Base Burst | Phase 1 | Phase 2 | Phase 3 |','|---|---:|---|---|---|---|---|---|',
  ...report.characters.map(row=>{
    const bySlot=Object.fromEntries((row.page.baseDetail?.skills||[]).map(skill=>[skill.slot,skill.name]));
    const order=row.page.phaseOrder;
    return `| ${row.character.name.replace(/\s+-\s+.*$/,'')} | ${row.favoriteItem.tid} | ${bySlot.skill1||'—'} | ${bySlot.skill2||'—'} | ${bySlot.burst||'—'} | ${order[1]||'—'} | ${order[2]||'—'} | ${order[3]||'—'} |`;
  }),'','## Full evidence','','- `audit/enikk-favorite-characters-v3477.json`',
];
fs.writeFileSync(MD_PATH,lines.join('\n')+'\n');

console.log(JSON.stringify({complete,failures,characters:report.characters.map(row=>({slug:row.character.slug,tid:row.favoriteItem.tid,shot:row.page.baseDetail?.shot,skills:row.page.baseDetail?.skills.map(skill=>({slot:skill.slot,name:skill.name,level10:skill.level10}))}))},null,2));
if(complete!==21||failures.length)throw new Error(`incomplete base detail extraction: ${complete}/21; failures=${failures.length}`);
