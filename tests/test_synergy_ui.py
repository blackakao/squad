"""Chrome + isolated real Python API: no production character/team edits."""
import json
import os
import unittest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import test_character_ui as harness


class SynergyUI(unittest.TestCase):
    setUpClass = classmethod(harness.CharacterUI.setUpClass.__func__)

    def js(self, code, *args):
        return self.driver.execute_script(code, *args)

    def setUp(self):
        (self.data / 'synergies.json').write_text('[]', encoding='utf-8')
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof characterJson!=='undefined' && characterJson.length && typeof synergiesJson!=='undefined' && document.querySelector('#characterTableBody tr')"))
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'synergy\')"]').click()
        self.wait.until(lambda d: d.find_element(By.ID, 'synergyTableBody').text)

    def create(self, name, condition, stat, value):
        self.driver.find_element(By.CSS_SELECTOR, '#synergyPage button').click()
        self.driver.find_element(By.ID, 'synergyName').send_keys(name)
        Select(self.driver.find_element(By.ID, 'synergyType')).select_by_value(condition)
        key = self.js("return characterJson[0][arguments[0]]", condition)
        Select(self.driver.find_element(By.ID, 'synergyValue')).select_by_value(key)
        Select(self.driver.find_element(By.CSS_SELECTOR, '.synergy-stat')).select_by_value(stat)
        field = self.driver.find_element(By.CSS_SELECTOR, '.synergy-amount')
        field.clear(); field.send_keys(str(value))
        self.driver.find_element(By.CSS_SELECTOR, '#synergyModal button[type="submit"]').click()
        self.wait.until(lambda d: not d.find_element(By.ID, 'synergyModal').is_displayed())

    def test_crud_preview_battle_and_repeat(self):
        self.create('검증 진영', 'faction', 'speed', 10)
        self.create('검증 계열', 'role', 'vit', 5)
        saved = json.loads((self.data / 'synergies.json').read_text(encoding='utf-8'))
        self.assertEqual(len(saved), 2)
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof synergiesJson!=='undefined' && synergiesJson.length===2"))
        self.js("showPage('synergy')")
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '#synergyTableBody tr')) == 2)
        self.driver.find_element(By.CSS_SELECTOR, '#synergyTableBody button').click()
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, '.synergy-amount').get_attribute('value'), '10')
        field = self.driver.find_element(By.ID, 'synergyName'); field.clear(); field.send_keys('이름 수정')
        self.driver.find_element(By.CSS_SELECTOR, '#synergyModal button[type="submit"]').click()
        self.wait.until(lambda d: not d.find_element(By.ID, 'synergyModal').is_displayed())
        self.assertEqual(next(s for s in json.loads((self.data / 'synergies.json').read_text(encoding='utf-8')) if s['name']=='이름 수정')['id'], saved[0]['id'])
        self.driver.execute_async_script("showPage('team').then(arguments[0])")
        # Isolated in-browser roster fixture; only synergy CRUD is persisted.
        self.js("""characterJson[1]={...characterJson[1],faction:characterJson[0].faction,role:characterJson[0].role};
          teamsJson=[{name:'검증 팀',memberIds:[0],battleRules:{},synergyRules:[]}];selectTeamForEdit(0);""")
        self.assertIn('1 / 2', self.driver.find_element(By.ID, 'teamSynergyPreview').text)
        self.driver.find_element(By.CSS_SELECTOR, '#teamCharacterList button[onclick="toggleCharacterInSelectedTeam(1)"]').click()
        self.assertIn('2 / 2', self.driver.find_element(By.ID, 'teamSynergyPreview').text)
        self.assertEqual(self.js("return document.querySelectorAll('#teamSynergyPreview .active').length"), 2)
        if os.environ.get('SYNERGY_SCREENSHOTS'):
            self.js("document.getElementById('teamSynergyPreview').scrollIntoView({block:'start',behavior:'instant'})")
            self.driver.save_screenshot(str(harness.ROOT / '.tmp-synergy-team.png'))
            self.js("window.scrollTo({top:0,behavior:'instant'})")
        self.driver.find_element(By.CSS_SELECTOR, '#teamMemberList button[onclick="removeCharacterFromSelectedTeam(1)"]').click()
        self.assertIn('1 / 2', self.driver.find_element(By.ID, 'teamSynergyPreview').text)
        values = self.js("""selectedBattleTeamIds.clear();selectedBattleCharacterIds=new Set([0,1]);battleMode='team';selectedEnemyTeamIndex='';
          const original=JSON.stringify(characterJson);const base=createCharacter(characterJson[0],0);
          enemySquad=createSquadFromCharacterIds([2,3],'enemy');startBattle();
          const first=playerSquad[0], delta=first.speed-base.speed, hp=first.maxHp-base.maxHp;
          for(let i=0;i<120;i++) runBattleTick();
          const ticks=combatEventTick;
          playerSquad[1].hp=0;syncAliveState(playerSquad[1]);
          const config={...entitiesJson[0],hp:100,mp:10,st:10,speed:1,attackSpeed:1,castTime:0,attackRange:1,atk:1,magic:1,defense:0,resistance:0};
          for (const summonType of ['persistent','temporary']) playerSquad.push(createSummonedBattleUnit(first,{...config,summonType}));
          const count=activeBattleSynergies.player.length;
          const record=createBattleRecord('검증');abortBattle();
          enemySquad=createSquadFromCharacterIds([2,3],'enemy');startBattle();
          const repeated=playerSquad[0].speed;abortBattle();closeBattleScreenModal();
          return [delta,hp,count,record.activeSynergies.player.length,repeated===first.speed,original===JSON.stringify(characterJson),ticks===120];""")
        self.assertEqual(values, [10,250,2,2,True,True,True])
        self.js("showPage('synergy')")
        self.wait.until(lambda d: d.find_element(By.ID, 'synergyPage').is_displayed())
        self.driver.find_element(By.CSS_SELECTOR, '#synergyTableBody button').click()
        self.driver.find_element(By.ID, 'synergyDelete').click()
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d: not d.find_element(By.ID, 'synergyModal').is_displayed())
        self.assertEqual(len(json.loads((self.data / 'synergies.json').read_text(encoding='utf-8'))),1)

    def test_validation_and_responsive(self):
        self.driver.find_element(By.CSS_SELECTOR, '#synergyPage button').click()
        self.driver.find_element(By.ID, 'synergyName').send_keys('유효성')
        if os.environ.get('SYNERGY_SCREENSHOTS'):
            self.driver.save_screenshot(str(harness.ROOT / '.tmp-synergy-editor.png'))
        self.js("document.querySelector('.synergy-effect').remove()")
        self.driver.find_element(By.CSS_SELECTOR, '#synergyModal button[type="submit"]').click()
        self.wait.until(lambda d: d.find_element(By.ID, 'synergyError').text)
        self.assertEqual(json.loads((self.data/'synergies.json').read_text(encoding='utf-8')), [])
        for width in [1920,1440,640]:
            self.driver.set_window_size(width,1000)
            self.assertTrue(self.js("const m=document.querySelector('.synergy-modal-content');return m.scrollWidth<=m.clientWidth && m.getBoundingClientRect().right<=innerWidth"))
            if width == 640 and os.environ.get('SYNERGY_SCREENSHOTS'):
                self.driver.save_screenshot(str(harness.ROOT / '.tmp-synergy-mobile.png'))

    def test_save_failure_keeps_draft_and_saved_definitions(self):
        self.create('저장된 정의', 'faction', 'speed', 10)
        before = (self.data/'synergies.json').read_bytes()
        self.driver.find_element(By.CSS_SELECTOR, '#synergyTableBody button').click()
        field=self.driver.find_element(By.ID, 'synergyName');field.clear();field.send_keys('실패 후 재시도')
        original_put=self.handler.do_PUT
        def fail(handler):
            if handler.path == '/api/synergies':
                handler.send_error(500, 'Test save failure')
            else:
                original_put(handler)
        self.handler.do_PUT=fail
        try:
            self.driver.find_element(By.CSS_SELECTOR, '#synergyModal button[type="submit"]').click()
            self.wait.until(lambda d:d.find_element(By.ID, 'synergyError').text)
            self.assertEqual(self.js('return synergiesJson[0].name'), '저장된 정의')
            self.assertEqual(field.get_attribute('value'), '실패 후 재시도')
            self.assertEqual((self.data/'synergies.json').read_bytes(), before)
        finally:
            self.handler.do_PUT=original_put
        self.driver.find_element(By.CSS_SELECTOR, '#synergyModal button[type="submit"]').click()
        self.wait.until(lambda d:not d.find_element(By.ID, 'synergyModal').is_displayed())
        self.assertEqual(self.js('return synergiesJson[0].name'), '실패 후 재시도')


if __name__ == '__main__':
    unittest.main()
