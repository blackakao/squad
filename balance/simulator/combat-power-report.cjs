'use strict';
const fs = require('node:fs');
const path = require('node:path');
const buildContext = require('./build-context.cjs');
const {loadData, fingerprint, ROOT} = require('./engine.cjs');
const {COMBAT_POWER_CONFIG} = require('../../js/combat-power.js');

function evaluate(data) {
  const context = buildContext(data);
  return context.characters.map((character, index) => {
    const result = context.getCharacterCombatPower(character);
    return {index, name:character.name, role:character.role, ...result,
      finalStats:Object.fromEntries(context.abilityKeys.map(key=>[key,result.finalStats[key]]))};
  });
}

const data = loadData();
const characters = evaluate(data);
const historicPath = 'balance/results/2026-10-10T13-12-05-837Z_1000.json';
const historic = JSON.parse(fs.readFileSync(path.join(ROOT,historicPath),'utf8'));
const comparison = evaluate(historic.inputSnapshot).map(row => {
  const result = historic.summary.characters.find(c=>c.characterId===row.index);
  return {name:row.name, total:row.total, winRate:result.winRate, dps:result.dps, hps:result.hps,
    battles:result.battles};
});
const report = {generatedAt:new Date().toISOString(), version:COMBAT_POWER_CONFIG.version,
  config:COMBAT_POWER_CONFIG, dataHash:fingerprint(data),
  distributions:Object.fromEntries(Object.keys(characters[0].finalStats).map(key=>{
    const values=characters.map(c=>c.finalStats[key]).sort((a,b)=>a-b);
    return [key,{min:values[0],median:(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2,max:values.at(-1)}];
  })), characters, historical:{source:historicPath, startedAt:historic.startedAt,
    note:'현재 V1으로 과거 입력을 재평가한 CP와 당시 엔진 전투 결과 비교. 현재 빌드 승률이 아님.',
    comparison}};
const round = n => Math.round(n*100)/100;
const table = (headers, rows) => ['| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',
  ...rows.map(row=>'| '+row.join(' | ')+' |')].join('\n');
const markdown = '# 종합전투력 V1 실데이터 보고서\n\n'+
  '생성: '+report.generatedAt+' · 공식: '+report.version+' · 입력 SHA-256: '+report.dataHash+'\n\n'+
  '현재 데이터의 계산 스냅샷이며 캐릭터 수치를 변경하지 않는다. 전체 최종 스탯·기여도·정규화값은 [JSON](COMBAT_POWER_RESULTS.json)에 보존한다.\n\n'+
  '## 최종 능력치 분포\n\n'+table(['능력치','최소','중앙값','최대'],Object.entries(report.distributions).map(([key,v])=>[key,v.min,v.median,v.max]))+'\n\n'+
  '## 현재 캐릭터\n\n'+table(['캐릭터','CP','HP','공격력','마력','방어/저항','공격간격/시전시간','생존 기여','공격 기여','이동 기여','사거리 기여'],
    characters.map(c=>[c.name,c.total,c.finalStats.hp,c.finalStats.atk,c.finalStats.magic,
      c.finalStats.defense+'/'+c.finalStats.resistance,c.finalStats.attackSpeed+'/'+c.finalStats.castSpeed,
      ...Object.values(c.contributions).map(round)]))+'\n\n'+
  '## 과거 1,000회 전투 비교\n\n'+report.historical.note+' 원본: ['+historicPath+'](../../'+historicPath+').\n\n'+
  table(['당시 캐릭터','당시 입력의 V1 CP','당시 승률 %','DPS','HPS','표본'],comparison.map(c=>[c.name,c.total,round(c.winRate),round(c.dps),round(c.hps),c.battles]))+'\n';

if (process.argv.includes('--write')) {
  const directory=path.join(ROOT,'docs/balance');
  fs.writeFileSync(path.join(directory,'COMBAT_POWER_RESULTS.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(directory,'COMBAT_POWER_RESULTS.md'),markdown);
}
console.log(markdown);
