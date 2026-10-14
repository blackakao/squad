"""Character table sorting and modal deletion against an isolated real API."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class CharacterUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('character_ui_server', ROOT / 'server.py')
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-character-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.data = Path(cls.temp.name) / 'data'
        shutil.copytree(ROOT / 'data', cls.data)
        cls.module.DATA_DIR = cls.data
        cls.module.ENTITY_STORE = cls.module.EntityStore(cls.data)
        cls.module.IMAGE_SETTINGS_PATH = cls.data / 'image-generator-settings.json'
        cls.module.server_log = lambda *args: None
        cls.original_characters = (cls.data / 'characters.json').read_bytes()
        cls.original_teams = (cls.data / 'teams.json').read_bytes()
        class Handler(cls.module.BattleHandler):
            fail_characters = False
            def log_message(self, *args):
                pass
            def do_PUT(self):
                if self.path == '/api/characters' and type(self).fail_characters:
                    self.send_error(500, 'Test save failure')
                    return
                super().do_PUT()
        cls.handler = Handler
        class TestServer(ThreadingHTTPServer):
            request_queue_size = 64
        cls.server = TestServer(('127.0.0.1', 0), Handler)
        cls.addClassCleanup(cls.server.server_close)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.addClassCleanup(cls.server.shutdown)
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options)
        cls.addClassCleanup(cls.driver.quit)
        cls.wait = WebDriverWait(cls.driver, 30)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'

    def setUp(self):
        self.handler.fail_characters = False
        (self.data / 'characters.json').write_bytes(self.original_characters)
        (self.data / 'teams.json').write_bytes(self.original_teams)
        self.driver.set_window_size(1440, 1000)
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length>0 && typeof teamsJson !== 'undefined' && teamsJson.length>0"))
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'character\')"]').click()
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '#characterTableBody tr[data-character-index]')) > 0)

    def sort(self, key):
        self.driver.find_element(By.CSS_SELECTOR, f'#characterTableHeader [data-sort-key="{key}"] button').click()

    def displayed_values(self, key):
        return self.driver.execute_script("return [...document.querySelectorAll('#characterTableBody tr[data-character-index]')].map(row=>characterSortValue(characterJson[Number(row.dataset.characterIndex)],arguments[0]))", key)

    def test_numeric_sort_is_numeric_stable_and_does_not_save(self):
        self.driver.execute_script('''characterJson=characterJson.slice(0,5).map((c,i)=>({...c,
            hp:[1000,20,110,100,200][i], mp:[100,20,100,200,0][i],
            speed:[2.5,0.5,1.5,1.1,2][i]})); renderCharacterTable();''')
        before = self.driver.execute_script('return JSON.stringify(characterJson)')
        for key in ['hp','mp','st','atk','magic','speed','attackSpeed','castSpeed','defense','resistance','attackRange']:
            self.sort(key)
            values = self.displayed_values(key)
            self.assertEqual(values, sorted(values), key)
            self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, f'th[data-sort-key="{key}"]').get_attribute('aria-sort'), 'ascending')
            self.sort(key)
            self.assertEqual(self.displayed_values(key), sorted(values, reverse=True), key)
        self.assertEqual(self.driver.execute_script('return JSON.stringify(characterJson)'), before)
        self.assertEqual((self.data / 'characters.json').read_bytes(), self.original_characters)

    def test_text_sort_filter_and_edit_preserve_original_index(self):
        for key in ['name', 'role', 'faction']:
            self.sort(key)
            self.assertTrue(self.driver.execute_script("const v=[...document.querySelectorAll('#characterTableBody tr[data-character-index]')].map(r=>characterSortValue(characterJson[Number(r.dataset.characterIndex)],arguments[0]));return v.every((s,i)=>!i||s.localeCompare(v[i-1],'ko',{numeric:true,sensitivity:'base'})>=0)", key))
            self.sort(key)
            self.assertTrue(self.driver.execute_script("const v=[...document.querySelectorAll('#characterTableBody tr[data-character-index]')].map(r=>characterSortValue(characterJson[Number(r.dataset.characterIndex)],arguments[0]));return v.every((s,i)=>!i||s.localeCompare(v[i-1],'ko',{numeric:true,sensitivity:'base'})<=0)", key))
        role = self.driver.execute_script('return normalizeRole(characterJson[0].role)')
        Select(self.driver.find_element(By.ID, 'characterRoleFilter')).select_by_value(role)
        self.sort('atk')
        self.sort('atk')
        self.assertEqual(self.displayed_values('atk'), sorted(self.displayed_values('atk'), reverse=True))
        self.assertTrue(self.driver.execute_script("return [...document.querySelectorAll('#characterTableBody tr[data-character-index]')].every(r=>normalizeRole(characterJson[Number(r.dataset.characterIndex)].role)===arguments[0])", role))
        row = self.driver.find_element(By.CSS_SELECTOR, '#characterTableBody tr')
        index = int(row.get_attribute('data-character-index'))
        name = self.driver.execute_script('return characterJson[arguments[0]].name', index)
        row.find_element(By.TAG_NAME, 'button').click()
        self.assertEqual(self.driver.find_element(By.ID, 'characterEditIndex').get_attribute('value'), str(index))
        self.assertEqual(self.driver.find_element(By.ID, 'characterName').get_attribute('value'), name)
        self.driver.find_element(By.ID, 'characterDeleteButton').click()
        self.wait.until(EC.alert_is_present())
        self.assertIn(name, self.driver.switch_to.alert.text)
        self.driver.switch_to.alert.dismiss()
        self.assertTrue(self.driver.find_element(By.ID, 'characterModal').is_displayed())
        self.assertEqual((self.data / 'characters.json').read_bytes(), self.original_characters)
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="closeCharacterModal()"]').click()
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="openCharacterModal()"]').click()
        self.assertFalse(self.driver.find_element(By.ID, 'characterDeleteButton').is_displayed())

    def prepare_test_character(self):
        characters = json.loads(self.original_characters)
        fixture = copy.deepcopy(characters[0])
        fixture['name'] = 'UI 삭제 검증 전용'
        index = len(characters)
        characters.append(fixture)
        teams = json.loads(self.original_teams)
        teams.append({'name':'UI 삭제 검증 팀', 'memberIds':[0,index]})
        (self.data / 'characters.json').write_text(json.dumps(characters, ensure_ascii=False), encoding='utf-8')
        (self.data / 'teams.json').write_text(json.dumps(teams, ensure_ascii=False), encoding='utf-8')
        self.driver.execute_async_script("const done=arguments[0];Promise.all([loadCharacterJson(),loadTeamJson()]).then(()=>{renderCharacterTable();done();})")
        self.sort('hp')
        self.driver.find_element(By.CSS_SELECTOR, f'#characterTableBody tr[data-character-index="{index}"] button').click()
        if os.environ.get('CHARACTER_UI_SCREENSHOTS'):
            self.driver.save_screenshot(str(ROOT/'.tmp-character-modal.png'))
        return index

    def test_fixture_delete_confirm_and_team_references_persist(self):
        index = self.prepare_test_character()
        self.driver.find_element(By.ID, 'characterDeleteButton').click()
        self.wait.until(EC.alert_is_present())
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d: not d.find_element(By.ID, 'characterModal').is_displayed())
        self.assertEqual(len(json.loads((self.data / 'characters.json').read_bytes())), index)
        self.assertEqual(json.loads((self.data / 'teams.json').read_bytes())[-1]['memberIds'], [0])
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length>0"))
        self.assertEqual(self.driver.execute_script("return characterJson.some(c=>c.name==='UI 삭제 검증 전용')"), False)

    def test_failed_delete_can_retry_without_deleting_neighbor(self):
        index = self.prepare_test_character()
        self.handler.fail_characters = True
        self.driver.find_element(By.ID, 'characterDeleteButton').click()
        self.driver.switch_to.alert.accept()
        self.wait.until(EC.alert_is_present())
        self.assertIn('저장하지 못했습니다', self.driver.switch_to.alert.text)
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d: not d.execute_script('return characterDeletePending'))
        self.assertEqual(self.driver.execute_script('return characterJson.length'), index+1)
        self.assertTrue(self.driver.find_element(By.ID, 'characterDeleteButton').is_enabled())
        self.handler.fail_characters = False
        self.driver.find_element(By.ID, 'characterDeleteButton').click()
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d: not d.find_element(By.ID, 'characterModal').is_displayed())
        self.assertEqual(self.driver.execute_script('return characterJson.length'), index)

    def test_columns_keyboard_sort_and_responsive(self):
        expected = ['이름','계열','진영','종합전투력','HP','MP','ST','공격력','마력','이동속도','공격속도','시전속도','방어력','저항력','사정거리','수정']
        self.assertEqual([e.text for e in self.driver.find_elements(By.CSS_SELECTOR, '#characterTableHeader th')], expected)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '#characterPage input[type="checkbox"]'))
        self.assertNotIn('선택 삭제', self.driver.find_element(By.ID,'characterPage').text)
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, '#characterTableBody td:first-child .portrait-thumb'))
        self.driver.find_element(By.CSS_SELECTOR, 'th[data-sort-key="hp"] button').send_keys(Keys.ENTER)
        self.assertEqual(self.displayed_values('hp'), sorted(self.displayed_values('hp')))
        for width in [1920,1440,640]:
            self.driver.set_window_size(width, 1000)
            scroll = self.driver.find_element(By.CSS_SELECTOR,'.character-table-scroll')
            self.assertTrue(self.driver.execute_script("return document.documentElement.scrollWidth<=innerWidth"))
            self.assertTrue(self.driver.execute_script("return [...document.querySelectorAll('#characterTableBody .portrait-thumb')].every(e=>e.getBoundingClientRect().width===44&&e.getBoundingClientRect().height===44)"))
            if os.environ.get('CHARACTER_UI_SCREENSHOTS'):
                self.driver.save_screenshot(str(ROOT/f'.tmp-character-{width}.png'))
            if width==640:
                self.driver.execute_script('arguments[0].scrollLeft=500',scroll)
                self.assertLess(abs(scroll.rect['x'] - self.driver.find_element(By.CSS_SELECTOR,'#characterTableBody td').rect['x']),3)
                if os.environ.get('CHARACTER_UI_SCREENSHOTS'):
                    self.driver.save_screenshot(str(ROOT/'.tmp-character-scroll.png'))


if __name__ == '__main__':
    unittest.main()
