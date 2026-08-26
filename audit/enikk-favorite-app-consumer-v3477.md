# App favorite-item consumer audit — V34.7.7

> Source-only extraction; no phase/TID/skill behavior is guessed.

- index SHA-256: `d2989c26c6e679c44db69748c916fa434368570fcd6a17124bdd53ec6a204103`
- index bytes/lines: **9061574 / 30991**
- `favoriteItemPhase` occurrences: **31**
- literal numbers near phase reads: **-100, 0, 01, 1, 10, 1000, 2, 3**

## Exact comparisons

## Exact assignments
- `result.favoriteItemPhase=Math.max(Number(a.favoriteItemPhase)||0,Number(b.favoriteItemPhase)||0,3)`
- `favoriteItemPhase=fav?.rare==='SSR'?clamp(num(row.favoriteItemLv)+1,1,3):0,gearTotals=observedGearTotals(row,master)`

## Phase read fragments
- ` favoriteItemPhase: 0,`
- ` ['favoriteItemPhase', 0, 3, base.favoriteItemPhase, true],`
- ` favoriteItemPhase: character.favoriteItemPhase`
- ` <div><label>애장품 단계 <span>저장 전용</span></label><select data-roster-field="favoriteItemPhase">$`
- `value === character.favoriteItemPhase ? ' selected' : ''`
- ` favoriteItemPhase: [0, 3, 0, true],`
- ` favoriteItemPhase: finite(stored.favoriteItemPhase, 0),`
- `, favoriteItemPhase: 0, equipmentObservedSlots: 0 `
- ` const rFavorite = read([source.favoriteItemPhase, source.favoriteItemStage], 0)`
- ` limitBreak:rLimit.provided, coreLevel:rCore.provided, favoriteItemPhase:rFavorite.provided,`
- `, level, limitBreak, coreLevel, favoriteItemPhase: favorite,`
- ` growth.level,growth.limitBreak,growth.coreLevel,growth.favoriteItemPhase,growth.skills&&growth.skills.skill1,growth.skills&&growth.skills.skill2,growth.skills&&growth.skills.burst,`
- ` return [profile&&profile.id,profile&&profile.weaponMode||profile&&profile.weapon,profile&&profile.cwSrRatio,profile&&profile.cwSrCycle,profile&&profile.cwSwitches,growth.level,growth.limitBreak,growth.coreLevel,growth.favoriteItemPhase,`
- `,favoriteItemPhase:0,cubeId:'none',manualRatio:0,measuredCoeff:1,overloadTotals:`
- `,favoriteItemPhase:num(x.favoriteItemPhase,0,3,b.favoriteItemPhase,true),cubeId:String(x.cubeId||'none'),manualRatio:num(x.manualRatio,-100,1000,b.manualRatio),measuredCoeff:num(x.measuredCoeff,.01,10,b.measuredCoeff),overloadTotals:`
- ` result.favoriteItemPhase=Math.max(Number(a.favoriteItemPhase)||0,Number(b.favoriteItemPhase)||0,3)`
- ` const fav=tables.favorites?.[row.favoriteItemTid],favoriteItemPhase=fav?.rare==='SSR'?clamp(num(row.favoriteItemLv)+1,1,3):0,gearTotals=observedGearTotals(row,master)`
- `,favoriteItemPhase,cubeId:cubeMode==='preserve'?String(current[id]?.cubeId||'none'):cubeId(row.harmonyCubeTid),overloadTotals:olTotals(row,options),...(gearTotals.equipmentObservedSlots?`

## Target counts
### poli
- `201001`: **1**
- `Poli`: **160**
- `폴리`: **3**
- `c030`: **1**
- `poliTreasure`: **6**
### sugar
- `200501`: **1**
- `Sugar`: **160**
- `슈가`: **64**
- `c112`: **1**
- `sugarTreasure`: **79**
### laplace
- `200401`: **1**
- `Laplace`: **33**
- `라플라스`: **22**
- `c100`: **1**
- `laplaceTreasure`: **11**

## Full contexts
- `audit/enikk-favorite-app-consumer-v3477.json`
