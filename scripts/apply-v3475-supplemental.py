from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

def rep(old,new,count=1):
    global s
    if old not in s:
        raise SystemExit('MISSING:\n'+old[:500])
    s=s.replace(old,new,count)

# 1) supplemental storage constants inside roster bootstrap
old="""  const AUTO_CUBE_POLICY_BASE_KEY = 'nikke_v34_3_1_auto_cube_policy_v1';
  const AUTO_CUBE_POLICY_KEY = global.NIKKE_V26_ACCOUNT_API?.scopeKey?.(AUTO_CUBE_POLICY_BASE_KEY) || AUTO_CUBE_POLICY_BASE_KEY;
  const PAGE_ID = 'v26Roster';"""
new="""  const AUTO_CUBE_POLICY_BASE_KEY = 'nikke_v34_3_1_auto_cube_policy_v1';
  const AUTO_CUBE_POLICY_KEY = global.NIKKE_V26_ACCOUNT_API?.scopeKey?.(AUTO_CUBE_POLICY_BASE_KEY) || AUTO_CUBE_POLICY_BASE_KEY;
  const SUPPLEMENTAL_BASE_STORAGE_KEY = 'nikke_v3475_roster_supplemental_catalog_v1';
  const SUPPLEMENTAL_STORAGE_KEY = global.NIKKE_V26_ACCOUNT_API?.scopeKey?.(SUPPLEMENTAL_BASE_STORAGE_KEY) || SUPPLEMENTAL_BASE_STORAGE_KEY;
  const PAGE_ID = 'v26Roster';"""
rep(old,new)

# 2) replace registry with supplemental-aware version
start=s.index('  function registry() {', s.index("SUPPLEMENTAL_BASE_STORAGE_KEY"))
end=s.index('\n  function registryMap()', start)
old=s[start:end]
new=r'''  function normalizeSupplementalCatalogEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = String(raw.id || '').trim();
    const name = String(raw.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      aliases: Array.from(new Set((Array.isArray(raw.aliases) ? raw.aliases : []).map((value) => String(value || '').trim()).filter(Boolean))),
      weapon: String(raw.weapon || '-'),
      element: String(raw.element || '-'),
      burst: String(raw.burst || '-'),
      role: String(raw.role || '-'),
      rarity: String(raw.rarity || ''),
      nameCode: String(raw.nameCode || ''),
      resourceId: String(raw.resourceId || ''),
      source: String(raw.source || 'external-master'),
      calculationSupported: raw.calculationSupported === true
    };
  }

  function readSupplementalCatalog() {
    const merged = new Map();
    const absorb = (rows) => {
      for (const raw of (Array.isArray(rows) ? rows : [])) {
        const entry = normalizeSupplementalCatalogEntry(raw);
        if (entry) merged.set(entry.id, entry);
      }
    };
    try { absorb(JSON.parse(global.localStorage?.getItem(SUPPLEMENTAL_STORAGE_KEY) || '[]')); } catch (_) {}
    try { absorb(global.NIKKE_V3475_ROSTER_SUPPLEMENTAL_CATALOG); } catch (_) {}
    return Array.from(merged.values());
  }

  function writeSupplementalCatalog(rows) {
    const normalized = [];
    const seen = new Set();
    for (const raw of (Array.isArray(rows) ? rows : [])) {
      const entry = normalizeSupplementalCatalogEntry(raw);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      normalized.push(entry);
    }
    try { global.localStorage?.setItem(SUPPLEMENTAL_STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
    try { global.NIKKE_V3475_ROSTER_SUPPLEMENTAL_CATALOG = normalized; } catch (_) {}
    return normalized;
  }

  function registerSupplementalCatalog(entries) {
    const merged = new Map(readSupplementalCatalog().map((entry) => [entry.id, entry]));
    let added = 0;
    let changed = 0;
    for (const raw of (Array.isArray(entries) ? entries : [])) {
      const entry = normalizeSupplementalCatalogEntry(raw);
      if (!entry) continue;
      const previous = merged.get(entry.id);
      if (!previous) added += 1;
      const next = previous ? {
        ...previous,
        ...entry,
        aliases: Array.from(new Set([...(previous.aliases || []), ...(entry.aliases || [])].filter(Boolean)))
      } : entry;
      if (JSON.stringify(previous || null) !== JSON.stringify(next)) changed += 1;
      merged.set(entry.id, next);
    }
    const rows = writeSupplementalCatalog(Array.from(merged.values()));
    // load()는 registry()를 매 호출마다 다시 확인하므로 새 ID를 즉시 중앙 문서에 병합한다.
    if (changed && memory) load();
    return { ok: true, added, changed, total: rows.length, storageKey: SUPPLEMENTAL_STORAGE_KEY };
  }

  function registry() {
    const labels = new Map();
    try {
      if (typeof characters !== 'undefined' && Array.isArray(characters)) {
        for (const pair of characters) {
          if (Array.isArray(pair) && pair[0]) labels.set(String(pair[0]), String(pair[1] || pair[0]));
        }
      }
    } catch (_) { /* classic-script global may not be available in isolated tests */ }

    const data = global.NIKKE_V26_DATA || {};
    const groups = [data.burst1?.characters, data.burst2?.characters, data.burst3?.characters];
    for (const group of groups) {
      for (const entry of (Array.isArray(group) ? group : [])) {
        if (entry?.id) labels.set(String(entry.id), String(entry.name || entry.id));
      }
    }
    const builtinIds = new Set(labels.keys());
    const supplemental = readSupplementalCatalog();
    const supplementalById = new Map(supplemental.map((entry) => [entry.id, entry]));
    for (const entry of supplemental) if (!labels.has(entry.id)) labels.set(entry.id, entry.name);

    return Array.from(labels, ([id, name]) => {
      let profile = null;
      let preset = null;
      try {
        if (typeof skillProfilesV21 !== 'undefined') profile = skillProfilesV21[id] || null;
        if (typeof weaponPresets !== 'undefined') preset = weaponPresets[id] || null;
      } catch (_) { /* optional metadata */ }
      const entry = groups.flatMap((group) => Array.isArray(group) ? group : []).find((item) => item?.id === id);
      const extra = supplementalById.get(id) || null;
      profile = profile || entry?.skillProfile || {};
      preset = preset || entry?.weaponPreset || {};
      const calculationSupported = builtinIds.has(id) || extra?.calculationSupported === true;
      return {
        id,
        name,
        aliases: extra?.aliases || [],
        weapon: String(profile.weapon || preset.weapon || extra?.weapon || '-'),
        element: String(profile.element || extra?.element || '-'),
        burst: String(profile.burst || extra?.burst || '-'),
        role: String(profile.role || extra?.role || '-'),
        rarity: String(extra?.rarity || ''),
        nameCode: String(extra?.nameCode || ''),
        resourceId: String(extra?.resourceId || ''),
        source: builtinIds.has(id) ? 'builtin' : String(extra?.source || 'supplemental'),
        calculationSupported,
        rosterOnly: !calculationSupported
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
'''
s=s[:start]+new+s[end:]

# 3) list count + roster-only badge
old="""    if (count) count.textContent = `표시 ${entries.length}명 · 보유 ${ownedCount}/${registry().length}명`;"""
new="""    if (count) { const all = registry(), calcCount = all.filter((entry) => entry.calculationSupported !== false).length; count.textContent = `표시 ${entries.length}명 · 보유 ${ownedCount}/${all.length}명 · 계산 모델 ${calcCount}명`; }"""
rep(old,new)
old="""          <strong>${html(entry.name)}</strong><small>${html(entry.burst)} · ${html(entry.weapon)} · ${html(entry.element)} · ${html(entry.role)}</small>
          <span>${html(totalSummary(character))}</span>"""
new="""          <strong>${html(entry.name)}${entry.rosterOnly ? ' <em class="v3475-roster-only-badge">로스터 전용</em>' : ''}</strong><small>${html(entry.burst)} · ${html(entry.weapon)} · ${html(entry.element)} · ${html(entry.role)}</small>
          <span>${html(totalSummary(character))}</span>"""
rep(old,new)

# 4) editor warning and apply button safe for roster-only
old="""    <div class="v26-roster-warning"><b>정밀 탭과 공용 데이터</b><br>스킬 1·2·버스트 레벨, OL 옵션 합계, 큐브, 수동 보정은 정밀 탭과 양방향으로 공유해요. 레벨은 R3 Lv.1~1100 성장곡선으로 정밀·자동편성·시뮬레이션에 반영하며, 한계돌파·코어·스킬·OL·큐브·애장품도 기존 규칙대로 연산합니다. 호감도 절대 스탯만 저장값으로 유지해요.</div>"""
new="""    ${meta.rosterOnly ? '<div class="v26-roster-warning"><b>로스터 저장 전용 캐릭터</b><br>BlaBla에서 받은 보유·레벨·돌파/코어·스킬·OL·큐브·장비값은 중앙 로스터에 안전하게 저장합니다. 아직 전용 스킬/무기 계산 모델이 없으므로 정밀 계산과 5덱 자동편성에는 넣지 않아 가짜 점수를 방지합니다.</div>' : '<div class="v26-roster-warning"><b>정밀 탭과 공용 데이터</b><br>스킬 1·2·버스트 레벨, OL 옵션 합계, 큐브, 수동 보정은 정밀 탭과 양방향으로 공유해요. 레벨은 R3 Lv.1~1100 성장곡선으로 정밀·자동편성·시뮬레이션에 반영하며, 한계돌파·코어·스킬·OL·큐브·애장품도 기존 규칙대로 연산합니다. 호감도 절대 스탯만 저장값으로 유지해요.</div>'}"""
rep(old,new)
old="""    <div class="v26-editor-actions"><button type="button" class="primary" data-roster-action="apply" data-character-id="${html(meta.id)}">정밀 탭에 적용</button><span>${totals.activeOptions}/9개 옵션 입력 · 스킬·OL·큐브를 함께 적용하며 정밀 탭 수정도 이 로스터에 자동 저장돼요.</span></div>`;"""
new="""    <div class="v26-editor-actions">${meta.rosterOnly ? '<button type="button" class="primary" disabled title="전용 정밀 계산 모델 미등록">정밀 모델 미등록</button><span>성장 데이터는 저장되며 전용 계산 모델 추가 전까지 정밀·5덱 계산에서는 제외됩니다.</span>' : `<button type="button" class="primary" data-roster-action="apply" data-character-id="${html(meta.id)}">정밀 탭에 적용</button><span>${totals.activeOptions}/9개 옵션 입력 · 스킬·OL·큐브를 함께 적용하며 정밀 탭 수정도 이 로스터에 자동 저장돼요.</span>`}</div>`;"""
rep(old,new)

# 5) API expose catalog + supplemental register
old="""    getOwned,
    cubeEntries,"""
new="""    getOwned,
    catalog: registry,
    supplementalStorageKey: SUPPLEMENTAL_STORAGE_KEY,
    registerSupplementalCatalog,
    isCalculationSupported: (id) => registryMap().get(String(id || ''))?.calculationSupported !== false,
    cubeEntries,"""
rep(old,new)

# 6) alias index sees central supplemental catalog
old="""  const catalog=arr(root.NIKKE_V26_7_CHARACTER_CATALOG);for(const row of catalog){if(!row?.id)continue;put(row.id,row.id);put(row.name,row.id);arr(row.aliases).forEach(a=>put(a,row.id));const sp=row.skillProfile||{};put(sp.name,row.id);arr(sp.aliases).forEach(a=>put(a,row.id));}
  try{for(const p of arr(root.NIKKEKitAwareOptimizer?.collectProfiles?.({},root)?.profiles)){put(p.id,p.id);put(p.name,p.id);arr(p.aliases).forEach(a=>put(a,p.id));}}catch(_){}"""
new="""  const catalog=arr(root.NIKKE_V26_7_CHARACTER_CATALOG);for(const row of catalog){if(!row?.id)continue;put(row.id,row.id);put(row.name,row.id);arr(row.aliases).forEach(a=>put(a,row.id));const sp=row.skillProfile||{};put(sp.name,row.id);arr(sp.aliases).forEach(a=>put(a,row.id));}
  try{for(const row of arr(root.NIKKE_V26_ROSTER_API?.catalog?.())){if(!row?.id)continue;put(row.id,row.id);put(row.name,row.id);arr(row.aliases).forEach(a=>put(a,row.id));if(row.nameCode)put(row.nameCode,row.id);if(row.resourceId)put(row.resourceId,row.id);}}catch(_){}
  try{for(const p of arr(root.NIKKEKitAwareOptimizer?.collectProfiles?.({},root)?.profiles)){put(p.id,p.id);put(p.name,p.id);arr(p.aliases).forEach(a=>put(a,p.id));}}catch(_){}"""
rep(old,new)

# 7) add supplemental helpers before importExternalRoster
needle="""function observedGearTotals(row,master){
  const api=root.NIKKE_R3_DATA_API,role=master?.class||master?.role||'',map={head:'head',torso:'body',arm:'arm',leg:'leg'};let atk=0,hp=0,defense=0,observedSlots=0,unknownSlots=0,t9Slots=0;"""
idx=s.index(needle)
endobs=s.index('\nasync function importExternalRoster', idx)
helpers=r'''
function supplementalId(nameCode){const code=String(nameCode||'').replace(/\D/g,'');return code?`enikk_${code}`:'';}
function supplementalBurst(value){const n=num(value);return n>=1&&n<=3?`버스트 ${['','I','II','III'][n]}`:String(value||'-');}
function seedRosterSupplementals(rows,byCode){
  const api=root.NIKKE_V26_ROSTER_API;if(!api?.registerSupplementalCatalog)return{ok:false,added:0,changed:0,total:0};
  const additions=[];
  for(const row of arr(rows)){
    const master=byCode.get(String(row?.nameCode)),display=String(master?.name_localkey||'').trim(),code=String(row?.nameCode||master?.name_code||'').trim();
    if(!master||!display||!code||idForName(display))continue;
    const id=supplementalId(code);if(!id)continue;
    additions.push({id,name:display,aliases:[String(master.resource_id||'').trim(),code].filter(Boolean),weapon:'-',element:String(master.element_id||'-'),burst:supplementalBurst(master.use_burst_skill),role:String(master.class||'-'),rarity:String(master.original_rare||''),nameCode:code,resourceId:String(master.resource_id||''),source:'ENIKK/BlaBla master',calculationSupported:false});
  }
  return api.registerSupplementalCatalog(additions);
}
'''
s=s[:endobs]+helpers+s[endobs:]

# 8) import function seed before current load + fallback ID
old="""  const [{byCode},tables]=await Promise.all([enikkLookups(),staticTables()]),options=optionOverride||tables.options||{},characters={},external={},unmatched=[],cubeMode=$('v34610CubeImportMode')?.value||'import',current=api.load?.()?.characters||{};
  for(const row of arr(roster.characters)){
    const master=byCode.get(String(row.nameCode)),display=master?.name_localkey||`nameCode ${row.nameCode}`,id=idForName(display);
    if(!id||!api.load()?.characters?.[id]){unmatched.push(display);continue;}"""
new="""  const [{byCode},tables]=await Promise.all([enikkLookups(),staticTables()]),options=optionOverride||tables.options||{},characters={},external={},unmatched=[],cubeMode=$('v34610CubeImportMode')?.value||'import';
  const supplemental=seedRosterSupplementals(roster.characters,byCode),current=api.load?.()?.characters||{};
  for(const row of arr(roster.characters)){
    const master=byCode.get(String(row.nameCode)),display=master?.name_localkey||`nameCode ${row.nameCode}`,id=idForName(display)||supplementalId(row.nameCode);
    if(!id||!api.load()?.characters?.[id]){unmatched.push(display);continue;}"""
rep(old,new)

# 9) include supplemental stats in return and render summary
old="""  return {imported:Object.keys(characters).length,unmatched};
}
function renderSyncResult(result,external){"""
new="""  return {imported:Object.keys(characters).length,unmatched,supplemental};
}
function renderSyncResult(result,external){"""
rep(old,new)
old="""수신 ${result.count}명 · 중앙 로스터 매핑/저장 ${result.imported}명 · 장비 상세 ${gearCount}명 · 미지원 ${result.unmatched.length}명 · 큐브"""
new="""수신 ${result.count}명 · 중앙 로스터 매핑/저장 ${result.imported}명 · 장비 상세 ${gearCount}명 · 신규 로스터 전용 등록 ${num(result.supplementalAdded)}명 · 미지원 ${result.unmatched.length}명 · 큐브"""
oldcall="""renderSyncResult({source,nickname:roster.nickname||'',observedAt:roster.observedAt,count:arr(roster.characters).length,imported:Object.keys(characters).length,unmatched,warning:tables.warning||'',cubeMode},external);"""
newcall="""renderSyncResult({source,nickname:roster.nickname||'',observedAt:roster.observedAt,count:arr(roster.characters).length,imported:Object.keys(characters).length,unmatched,warning:tables.warning||'',cubeMode,supplementalAdded:num(supplemental?.added)},external);"""
rep(oldcall,newcall)
rep(old,new)

# 10) cube manager names from full central catalog, not rich catalog only
old="""const saved=api.load()?.characters||{},names=new Map(arr(root.NIKKE_V26_7_CHARACTER_CATALOG).map(x=>[x.id,x.name||x.id]));"""
new="""const saved=api.load()?.characters||{},names=new Map(arr(api.catalog?.()).map(x=>[x.id,x.name||x.id]));"""
rep(old,new)

# 11) append styles for badge
insert='''\n<style id="v3475-supplemental-roster-style">\n.v3475-roster-only-badge{display:inline-block;margin-left:6px;padding:1px 5px;border-radius:999px;background:rgba(214,146,40,.14);color:#9a5a00;font-size:9px;font-style:normal;vertical-align:1px}.v26-roster-row .v26-roster-pick strong{display:flex;align-items:center;gap:3px;flex-wrap:wrap}\n</style>\n'''
pos=s.rfind('</body>')
s=s[:pos]+insert+s[pos:]

p.write_text(s,encoding='utf-8')
Path('public/index.html').write_text(s,encoding='utf-8')
print('patched',len(s))