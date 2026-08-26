import fs from 'node:fs';
import crypto from 'node:crypto';

const rootPath='index.html', publicPath='public/index.html';
let html=fs.readFileSync(rootPath,'utf8');
const map={"1010":"laplaceTreasure","1021":"moranTreasure","3019":"aigisPersona","5001":"maxwell","5002":"sugarTreasure","5004":"alice","5007":"privatyTreasure","5008":"blanc","5009":"noir","5011":"liter","5012":"snowWhite","5013":"isabel","5016":"poliTreasure","5017":"mirandaTreasure","5021":"centiTreasure","5024":"drakeTreasure","5027":"pepper","5036":"dolla","5037":"novel","5041":"scarlet","5044":"modernia","5045":"rosannaTreasure","5048":"marciana","5049":"rouge","5061":"dorothy","5064":"maryBayGoddess","5065":"crown","5066":"helmTreasure","5074":"noise","5075":"volume","5077":"ein","5081":"toveTreasure","5088":"zweiTreasure","5097":"anisSparklingSummer","5098":"helmAquamarine","5099":"naga","5100":"tia","5101":"redHood","5103":"ludmillaWinterOwner","5105":"scarletBlackShadow","5106":"privatyUnkindMaid","5110":"dKillerWife","5113":"sodaTwinklingBunny","5116":"rosannaChicOcean","5117":"sakuraBloomSummer","5118":"asukaShikinamiLangley","5119":"reiAyanami","5120":"mariMakinami","5121":"quencyEscapeQueen","5122":"phantomTreasure","5124":"cinderella","5125":"grave","5126":"floraTreasure","5127":"maidenIceRose","5128":"guillotineWinterSlayer","5129":"rapiRedHood","5130":"mastRomanticMaid","5131":"anchorInnocentMaid","5132":"reiAyanamiTentative","5133":"asukaWille","5134":"trina","5135":"bready","5137":"littleMermaid","5138":"miharaBondingChain","5140":"arcana","5142":"eve","5143":"raven","5145":"dorothySerendipity","5146":"eleggBoomAndShock","5147":"emmaTacticalUpgrade","5148":"vestiTacticalUpgrade","5149":"eunhwaTacticalUpgrade","5150":"milkBloomingBunny","5151":"adeAgentBunny","5152":"adaWong","5153":"jillValentine","5155":"nayuta","5156":"liberalio","5158":"solineFrostTicket","5159":"dieselWinterSweets","5160":"bridSilentTrack","5161":"snowWhiteHeavyArms","5162":"label","5163":"velvet","5164":"chisato","5165":"takinaInoue","5166":"eH","5167":"arcanaFortuneMate","5168":"snowCrane","5169":"anisStar","5170":"neonVisionEye","5172":"mint","5173":"prika","5174":"arkRangerBlack","5175":"cinderellaCrystalWave","5176":"marcianaMarineStudy","5177":"laplaceUltimateHero","5178":"maxwellOrdinaryMechanic","5179":"makotoNiijimaQueen","5180":"yukikoAmagi"};
const mapText=JSON.stringify(map);

if(html.includes('const V3476_NAMECODE_TO_APP_ID=')){
  console.log('V34.7.6 nameCode patch already present');
}else{
  const anchor=`function supplementalBurst(value){const n=num(value);return n>=1&&n<=3?\`버스트 \${['','I','II','III'][n]}\`:String(value||'-');}`;
  if(!html.includes(anchor))throw new Error('supplementalBurst anchor not found');
  const insert=`${anchor}\nconst V3476_NAMECODE_TO_APP_ID=Object.freeze(${mapText});\nfunction idForNameCode(nameCode){const code=String(nameCode||'').replace(/\\D/g,'');if(!code)return'';const id=V3476_NAMECODE_TO_APP_ID[code]||'';if(!id)return'';try{return root.NIKKE_V26_ROSTER_API?.load?.()?.characters?.[id]?id:'';}catch(_){return id;}}\ntry{root.NIKKEV3476NameCodeMapping=Object.freeze({version:'34.7.6',count:Object.keys(V3476_NAMECODE_TO_APP_ID).length,map:V3476_NAMECODE_TO_APP_ID,idForNameCode});}catch(_){}\n`;
  html=html.replace(anchor,insert);

  const seedOld=`if(!master||!display||!code||idForName(display))continue;`;
  const seedNew=`if(!master||!display||!code||idForNameCode(code))continue;`;
  if(!html.includes(seedOld))throw new Error('seedRosterSupplementals name fallback anchor not found');
  html=html.replace(seedOld,seedNew);

  const importOld=`master=byCode.get(String(row.nameCode)),display=master?.name_localkey||\`nameCode \${row.nameCode}\`,id=idForName(display)||supplementalId(row.nameCode);`;
  const importNew=`master=byCode.get(String(row.nameCode)),display=master?.name_localkey||\`nameCode \${row.nameCode}\`,id=idForNameCode(row.nameCode)||supplementalId(row.nameCode);`;
  if(!html.includes(importOld))throw new Error('importExternalRoster id fallback anchor not found');
  html=html.replace(importOld,importNew);

  html=html.replace('<b>V34.7.3 웹 동기화:</b>','<b>V34.7.6 웹 동기화:</b>');
  html=html.replace('수신한 레벨·돌파/코어·스킬·OL·큐브·애장품·장비는 중앙 로스터에 저장되어 정밀·내 로스터·5덱 자동이 같은 값을 사용합니다.','캐릭터 연결은 BlaBla/ENIKK nameCode를 권위 키로 사용하며 표시 이름은 BlaBla 마스터를 따릅니다. 수신한 레벨·돌파/코어·스킬·OL·큐브·애장품·장비는 중앙 로스터에 저장되어 정밀·내 로스터·5덱 자동이 같은 값을 사용합니다.');
  html=html.replace("root.document.title='니케 성장 계산기 V34.7.5 · BlaBla 실제반영 검증'","root.document.title='니케 성장 계산기 V34.7.6 · BlaBla nameCode 권위 매핑'");
  html=html.replace("f.textContent='Nikke Damage Growth Calculator · V34.7.5 · 2026-08-26'","f.textContent='Nikke Damage Growth Calculator · V34.7.6 · 2026-08-26'");
}

fs.writeFileSync(rootPath,html);
fs.writeFileSync(publicPath,html);

const sha=v=>crypto.createHash('sha256').update(fs.readFileSync(v)).digest('hex');
let sums=fs.readFileSync('SHA256SUMS.txt','utf8');
for(const file of [rootPath,publicPath]){
  const line=`${sha(file)}  ${file}`;
  const re=new RegExp(`^[0-9a-f]{64}  ${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'m');
  if(!re.test(sums))throw new Error(`checksum line missing for ${file}`);
  sums=sums.replace(re,line);
}
fs.writeFileSync('SHA256SUMS.txt',sums);
console.log(`patched V34.7.6 nameCode authority map: ${Object.keys(map).length} supported entries`);
console.log(`index sha256 ${sha(rootPath)}`);
