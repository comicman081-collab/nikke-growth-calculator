import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimeSource=fs.readFileSync(new URL('../scripts/v34713-optimality-runtime.js',import.meta.url),'utf8');
const required=[
  'moranTreasure','floraTreasure','privatyTreasure','helmTreasure','sugarTreasure',
  'centiTreasure','zweiTreasure','mirandaTreasure','rosannaTreasure'
];

function member(id,slot,phase){
  const row={id,name:id,slot,element:'fire',role:'attacker',cubeId:'none'};
  if(phase!==undefined)row.favoriteItemPhase=phase;
  return row;
}
function candidate(id,phase,suffix='a'){
  return {
    id:`${id}-${phase}-${suffix}`,
    members:[
      member(id,'B1',phase),member(`b2-${suffix}`,'B2',0),member(`b3a-${suffix}`,'B3-A',0),
      member(`b3b-${suffix}`,'B3-B',0),member(`flex-${suffix}`,'FLEX',0)
    ],
    memberIds:[id,`b2-${suffix}`,`b3a-${suffix}`,`b3b-${suffix}`,`flex-${suffix}`],
    score:100,
    scores:{firepower:100}
  };
}

const rawRoster={characters:{moranTreasure:{id:'moranTreasure',owned:true,favoriteItemPhase:1}}};
let importCalls=0;
const lockedFromOldApi=candidate('sugarTreasure',0,'locked');
const legalFromOldApi=candidate('alice',0,'legal');
const context={
  console,
  setTimeout(){return 0;},
  clearTimeout(){},
  navigator:{deviceMemory:8},
  document:{getElementById(){return null;}},
  NIKKE_V26_ROSTER_API:{
    load(){return rawRoster;},
    getOwned(){return Object.values(rawRoster.characters);},
    import(){importCalls++;throw new Error('candidate legality must not mutate linked roster');}
  },
  NIKKE_V26_OPTIMIZER_API:{
    async buildCandidates(){return{candidates:[lockedFromOldApi,legalFromOldApi],teamCount:1,boss:{id:'test'}};},
    optimize(rows){return{status:'ok',feasible:true,teams:rows.slice(0,1),diagnostics:{base:true}};}
  },
  NIKKE_V26_API:{},
  NIKKE_V26_DATA:{bosses:{values:{test:{id:'test'}}}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(runtimeSource,context,{filename:'v34713-optimality-runtime.js'});

const api=context.NIKKEV34713Optimality;
assert.ok(api,'runtime API must install');
assert.deepEqual([...api.raidFavoriteUnlockRequiredIds].sort(),required.slice().sort());

for(const id of required){
  assert.equal(api.candidateLegal(candidate(id,0,id),{id:'test'}),false,`${id} Phase0 must be excluded`);
  assert.equal(api.candidateLegal(candidate(id,1,id),{id:'test'}),true,`${id} unlocked favorite must be legal`);
}
assert.equal(api.candidateLegal(candidate('phantomTreasure',0,'phantom'),{id:'test'}),true,'Phantom is the sole Phase0 favorite exception');

// Old/compact candidates without phase metadata must recover it read-only from
// the central roster, while newly shaped candidates must retain the phase.
assert.equal(api.candidateLegal(candidate('moranTreasure',undefined,'central'),{id:'test'}),true,'central roster phase fallback must keep unlocked Moran legal');
const shaped=api.candidateShape({
  score:1,
  roles:{
    b1:{id:'moranTreasure',name:'Moran',favoriteItemPhase:2},
    b2:{id:'b2-shape'},b3:[{id:'b3a-shape'},{id:'b3b-shape'}],flex:{id:'flex-shape'}
  }
},'favorite-shape');
assert.equal(shaped.members[0].favoriteItemPhase,2,'compact candidate shape must retain favorite phase');
assert.equal(api.candidateLegal(shaped,{id:'test'}),true);

const built=await context.NIKKE_V26_OPTIMIZER_API.buildCandidates({bossId:'test',teamCount:1});
assert.equal(built.candidates.length,1,'wrapped old build API must remove locked candidates');
assert.equal(built.candidates[0].memberIds[0],'alice');
assert.equal(built.diagnostics.v34713FavoriteLockedCandidatesRemoved,1);
assert.deepEqual([...built.diagnostics.v34713FavoriteLockedIds],['sugarTreasure']);
const result=context.NIKKE_V26_OPTIMIZER_API.optimize([lockedFromOldApi,legalFromOldApi],{bossId:'test',teamCount:1});
assert.equal(result.feasible,true);
assert.equal(result.teams[0].memberIds[0],'alice','wrapped old optimize API must not select Phase0 favorite');
assert.equal(result.diagnostics.favoriteLockedCandidatesRemoved,1);
assert.deepEqual([...result.diagnostics.favoriteLockedIds],['sugarTreasure']);
const lockedOnly=context.NIKKE_V26_OPTIMIZER_API.optimize([lockedFromOldApi],{bossId:'test',teamCount:1});
assert.equal(lockedOnly.diagnostics.favoriteLockedCandidatesRemoved,1,'infeasible fallback must retain favorite gate diagnostics');
assert.deepEqual([...lockedOnly.diagnostics.favoriteLockedIds],['sugarTreasure']);
assert.equal(importCalls,0,'candidate filtering must preserve linked roster storage');
assert.equal(rawRoster.characters.moranTreasure.favoriteItemPhase,1);

console.log(JSON.stringify({
  pass:true,
  requiredPhaseGateCount:required.length,
  phantomPhase0Allowed:true,
  compactPhase:shaped.members[0].favoriteItemPhase,
  oldApiRemoved:built.diagnostics.v34713FavoriteLockedCandidatesRemoved,
  linkedRosterWrites:importCalls
},null,2));
