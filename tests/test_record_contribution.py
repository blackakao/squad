"""Real combat actions, record persistence and expandable UI in an isolated API."""
import json
import unittest
import test_character_ui as harness


class RecordContribution(unittest.TestCase):
    setUpClass = classmethod(harness.CharacterUI.setUpClass.__func__)

    def test_combat_save_reload_and_details(self):
        d = self.driver
        d.set_script_timeout(30)
        d.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof entitiesJson !== 'undefined' && entitiesJson.length && characterJson.length >= 6"))
        result = d.execute_async_script("""
const done=arguments[0];
(async()=>{
  await showPage('record');
  selectedBattleTeamIds.clear();selectedBattleCharacterIds=new Set([0,1,2]);
  battleMode='team';selectedEnemyTeamIndex='';enemySquad=createSquadFromCharacterIds([3,4,5],'enemy');
  prepareBattleSession({openScreen:false});
  const [a,b]=playerSquad, target=enemySquad[0];a.name=b.name='동일 이름 소환사';
  for(const unit of [...playerSquad,...enemySquad]) {clearBattleEffects(unit);unit.skillIds=[];unit.weaponAttackStates=[];}
  target.hp=target.maxHp=100000;target.bp=0;target.reviveInvulnerableTicks=0;
  const template=createDefaultEntity();template.entityId='record_test_temp';template.name='노포';
  template.summonType='temporary';template.stats.hp=100;
  battleEntitySnapshot.push(template,{...structuredClone(template),entityId:'record_test_pet',summonType:'persistent',name:'야수'});
  const action={type:'summon_entity',target:'self',entityId:template.entityId,count:1,limit:3,duration:0};
  const hit=(source,value)=>applyActionDamage(source,target,{type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value}]});
  hit(a,10);
  for(let i=0;i<12;i++) {
    summonBattleUnits(a,action,{id:'record_summon'});
    const s=a.summons[0];hit(s,7);s.hp=0;syncAliveState(s);
  }
  summonBattleUnits(a,{...action,entityId:'record_test_pet'},{id:'record_pet'});
  hit(a.summons[0],11);
  a.hp=a.maxHp-20;
  applyActionHeal(a.summons[0],a,{healResource:'HP',coefficients:[{type:'fixed',value:20}]});
  summonBattleUnits(b,action,{id:'record_summon'});hit(b.summons[0],13);
  combatEventTick=600;
  battleRecordsJson=[];
  await finishBattle('검증');
  await showPage('record');
  done(battleRecordsJson[0]);
})().catch(e=>done({error:String(e),stack:e.stack}));
""")
        self.assertNotIn('error', result, result)
        self.assertEqual(len(result['playerMembers']), 3)
        self.assertEqual(len(result['monsterMembers']), 3)
        owner = result['playerMembers'][0]
        self.assertEqual(owner['damageDealt'], 105)
        self.assertEqual(owner['dps'], 10.5)
        self.assertEqual(owner['contribution']['summon']['damageDealt'], 95)
        self.assertEqual(owner['healingDone'], 20)
        self.assertEqual(result['playerMembers'][1]['damageDealt'], 13)
        self.assertEqual(owner['contribution']['groups'][0]['count'], 12)
        saved = json.loads((self.data / 'battle-records.json').read_text(encoding='utf-8'))
        self.assertEqual(saved[0], result)
        d.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length > 0"))
        d.execute_async_script("const done=arguments[0];showPage('record').then(()=>done(true));")
        self.assertEqual(len(d.find_elements('css selector', '#recordTableBody > tr')), 1)
        self.assertEqual(len(d.find_elements('css selector', '.record-contribution-toggle')), 6)
        self.assertTrue(all(not x.is_displayed() for x in d.find_elements('css selector', '.record-contribution-row')))
        d.find_element('css selector', '.record-contribution-toggle').click()
        detail = d.find_element('css selector', '.record-contribution-row')
        self.assertTrue(detail.is_displayed())
        for text in ['총 기여', '직접', '소환수', '노포 ×12', '야수 ×1', 'DPS 10.5']:
            self.assertIn(text, detail.text)
        d.find_element('css selector', '.record-events summary').click()
        self.assertIn('노포', d.find_element('css selector', '.record-event-list').text)
        self.assertEqual(len(d.find_elements('css selector', '.record-check')), 1)
        d.find_element('css selector', '.record-events summary').click()
        d.save_screenshot(str(harness.ROOT / '.tmp-record-contribution.png'))


if __name__ == '__main__':
    unittest.main()
