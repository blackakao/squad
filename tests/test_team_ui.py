"""Team composition UI against copied data and real Chrome mouse drag/scroll."""
import json
import unittest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.wheel_input import ScrollOrigin
from selenium.webdriver.common.keys import Keys
import test_character_ui as harness


class TeamUI(unittest.TestCase):
    setUpClass = classmethod(harness.CharacterUI.setUpClass.__func__)

    def js(self, code, *args):
        return self.driver.execute_script(code, *args)

    def setUp(self):
        self.driver.set_window_size(1440,1000)
        (self.data/'characters.json').write_bytes(self.original_characters)
        self.rules={'damagePercent':123,'healingPercent':87,'resourceCostPercent':64,'cooldownPercent':91}
        self.legacy=[{'type':'role','value':'tank','requiredCount':1,**self.rules}]
        self.team={'name':'검증 팀','memberIds':[0,1],'activeMemberCount':2,'battleRules':self.rules,'synergyRules':self.legacy}
        (self.data/'teams.json').write_text(json.dumps([self.team],ensure_ascii=False),encoding='utf-8')
        chars=json.loads(self.original_characters)
        chars[1]['role']=chars[0]['role']
        (self.data/'characters.json').write_text(json.dumps(chars,ensure_ascii=False),encoding='utf-8')
        self.synergy={'id':'team_ui_synergy','name':'공식 편성 시너지','condition':{'type':'role','value':chars[0]['role']},'stacking':'highest','thresholds':[{'count':2,'effects':[{'type':'stat','stat':'vit','value':5,'target':'team'}]}]}
        (self.data/'synergies.json').write_text(json.dumps([self.synergy],ensure_ascii=False),encoding='utf-8')
        self.driver.get(self.url)
        self.wait.until(lambda d:d.execute_script("return typeof characterJson!=='undefined' && characterJson.length && teamsJson.length && document.querySelector('#teamList button')"))
        self.driver.execute_async_script("showPage('team').then(arguments[0])")
        self.driver.find_element('css selector','#teamList button').click()
        self.wait.until(lambda d:d.execute_script("return document.querySelector('.team-manager').style.getPropertyValue('--team-workspace-height')!==''"))

    def drag(self, id, cancel=False):
        source=self.driver.find_element('css selector',f'#teamCharacterList [data-character-id="{id}"]')
        self.js("arguments[0].scrollIntoView({block:'nearest'})",source)
        target=self.driver.find_element('id','teamDropTarget')
        ActionChains(self.driver).move_to_element(source).click_and_hold().move_by_offset(-12,0).pause(.2).perform()
        self.wait.until(lambda d:d.execute_script("return !!teamCharacterDrag"))
        self.assertEqual(len(self.driver.find_elements('css selector','.team-drag-preview')),1)
        if cancel:
            ActionChains(self.driver).send_keys(Keys.ESCAPE).release().perform()
        else:
            ActionChains(self.driver).move_to_element(target).pause(.2).perform()
            self.assertIn('drop-hover',target.get_attribute('class'))
            ActionChains(self.driver).release().perform()
        self.wait.until(lambda d:not d.find_elements('css selector','.team-drag-preview,.drop-hover,.drop-allowed,.is-dragging'))

    def test_real_drag_scrolled_save_reload_and_preserved_rules(self):
        count=self.js('return characterJson.length')
        target=self.driver.find_element('id','teamDropTarget')
        before=target.rect['y']
        listing=self.driver.find_element('id','teamCharacterList')
        ActionChains(self.driver).scroll_from_origin(ScrollOrigin.from_element(listing),0,3000).perform()
        self.wait.until(lambda d:d.execute_script("return document.getElementById('teamCharacterList').scrollTop>0"))
        self.assertEqual(target.rect['y'],before)
        self.drag(count-1)
        self.assertIn(count-1,self.js('return selectedTeamMemberIds'))
        self.assertEqual(self.js("return document.getElementById('teamCharacterList').scrollTop>0"),True)
        self.drag(count-2,cancel=True)
        self.assertNotIn(count-2,self.js('return selectedTeamMemberIds'))
        for id in [count-2,count-3]:self.drag(id)
        self.driver.find_element('id','teamSaveButton').click()
        self.wait.until(lambda d:'저장했습니다' in d.find_element('id','teamEditStatus').text)
        saved=json.loads((self.data/'teams.json').read_text(encoding='utf-8'))[0]
        self.assertEqual(saved['battleRules'],self.rules)
        self.assertEqual(saved['activeMemberCount'],2)
        self.assertEqual(saved['synergyRules'],self.legacy)
        self.assertEqual(saved['memberIds'],[0,1,count-1,count-2,count-3])
        self.driver.refresh()
        self.wait.until(lambda d:d.execute_script("return typeof teamsJson!=='undefined' && teamsJson.length"))
        self.driver.execute_async_script("showPage('team').then(arguments[0])")
        self.driver.find_element('css selector','#teamList button').click()
        self.assertEqual(self.js('return selectedTeamMemberIds'),saved['memberIds'])
        self.driver.find_element('css selector',f'#teamMemberList button[onclick="removeCharacterFromSelectedTeam({count-1})"]').click()
        self.assertNotIn(count-1,self.js('return selectedTeamMemberIds'))

    def test_validation_and_official_synergy(self):
        page=self.driver.find_element('id','teamPage')
        for label in ['선봉','예비대','전투 규칙 배율','팀별 배율 시너지']:self.assertNotIn(label,page.text)
        self.assertIn('공식 편성 시너지',self.driver.find_element('id','teamSynergyPreview').text)
        self.driver.find_element('css selector','#teamMemberList button[onclick="removeCharacterFromSelectedTeam(1)"]').click()
        self.assertNotIn('공식 편성 시너지',self.driver.find_element('id','teamSynergyPreview').text)
        self.drag(1)
        self.assertIn('공식 편성 시너지',self.driver.find_element('id','teamSynergyPreview').text)
        # A duplicate drag cannot toggle/remove an existing member.
        source=self.driver.find_element('css selector','#teamCharacterList [data-character-id="1"]')
        ActionChains(self.driver).drag_and_drop(source,self.driver.find_element('id','teamDropTarget')).perform()
        self.assertEqual(self.js('return selectedTeamMemberIds'),[0,1])
        self.js('selectedTeamMemberIds=Array.from({length:MAX_PLAYER_SQUAD},(_,i)=>i);renderTeamEditor()')
        source=self.driver.find_element('css selector','#teamCharacterList [data-character-id="10"]')
        self.js("arguments[0].scrollIntoView({block:'nearest'})",source)
        ActionChains(self.driver).drag_and_drop(source,self.driver.find_element('id','teamDropTarget')).perform()
        self.assertEqual(self.js('return selectedTeamMemberIds.length'),10)
        self.assertEqual(len(self.driver.find_elements('css selector','.team-drag-preview,.drop-blocked,.drop-hover')),0)
        self.assertIn('팀 계산 기준 준비 중',page.text)
        card=self.driver.find_element('css selector','#teamCharacterList [data-character-id="10"]')
        self.assertIn(self.js('return formatCombatPower(getCharacterCombatPower(characterJson[10]).total)'),card.text)
        # Remove definition through the actual management page; no legacy fallback.
        self.driver.execute_async_script("showPage('synergy').then(arguments[0])")
        self.driver.find_element('css selector','#synergyTableBody button').click()
        self.driver.find_element('id','synergyDelete').click()
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d:not d.find_element('id','synergyModal').is_displayed())
        self.driver.execute_async_script("showPage('team').then(arguments[0])")
        self.assertNotIn('공식 편성 시너지',self.driver.find_element('id','teamSynergyPreview').text)

    def test_list_sizes_and_responsive(self):
        originals=self.js('return characterJson')
        for width in [1920,1440,640]:
            self.driver.set_window_size(width,1000)
            heights=[]
            for count in [5,10,38,100]:
                self.js("characterJson=Array.from({length:arguments[1]},(_,i)=>({...arguments[0][i%arguments[0].length]}));renderTeamEditor()",originals,count)
                self.wait.until(lambda d:len(d.find_elements('css selector','#teamCharacterList button'))==count)
                m=self.js("const l=document.getElementById('teamCharacterList');return [document.documentElement.scrollHeight,l.clientHeight,l.scrollHeight,document.documentElement.scrollWidth,document.documentElement.clientWidth]")
                heights.append(m[0]);self.assertLessEqual(m[3],m[4]+1)
                if count>=38:self.assertGreater(m[2],m[1])
            self.assertLessEqual(max(heights)-min(heights),2,(width,heights))
            self.driver.save_screenshot(str(harness.ROOT/f'.tmp-team-{width}.png'))


if __name__=='__main__':unittest.main()
