"""Skill class/icon management and runtime cooldown UI regression checks."""
import importlib.util
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class SkillIconUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('skill_icon_test_server', ROOT / 'server.py')
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-skill-icon-')
        cls.data = Path(cls.temp.name) / 'data'
        shutil.copytree(ROOT / 'data', cls.data)
        cls.module.DATA_DIR = cls.data
        cls.module.ENTITY_STORE = cls.module.EntityStore(cls.data)
        cls.module.BattleHandler.log_message = lambda *args: None
        cls.module.server_log = lambda *args: None
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), cls.module.BattleHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 30)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.temp.cleanup()

    def setUp(self):
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof skillsJson !== 'undefined' && skillsJson.length === 40"))

    def test_skill_list_icons_class_filters_and_character_picker(self):
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'skill\')"]').click()
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '#skillTableBody tr')) == 40)
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, '#skillTableBody .record-image-thumb')), 24)
        Select(self.driver.find_element(By.ID, 'skillClassFilter')).select_by_visible_text('기사')
        rows = self.driver.find_elements(By.CSS_SELECTOR, '#skillTableBody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('기사 · 돌진', rows[0].text)
        self.assertIn('기사', rows[0].text)

        knight = self.driver.execute_script("return characterJson.findIndex(row => row.name === '기사')")
        self.driver.execute_script('openCharacterModal(arguments[0])', knight)
        ids = self.driver.execute_script("return [...document.querySelectorAll('#characterSkills input')].map(row => row.value)")
        self.assertEqual(ids, ['skill_class_knight_charge'])
        self.assertTrue(self.driver.find_element(By.CSS_SELECTOR, '#characterSkills input').is_selected())

    def test_runtime_cooldown_overlay_reads_and_tracks_engine_ticks(self):
        result = self.driver.execute_script("""
          const base = characterJson.find(row => row.name === '기사');
          const unit = {...base, maxHp:base.hp, maxMp:base.mp, maxSt:base.st, hp:base.hp, mp:base.mp, st:base.st,
            skillCooldowns:{skill_class_knight_charge:60}, skillCooldownTotals:{skill_class_knight_charge:120}};
          playerSquad=[unit]; enemySquad=[]; updateStatusUI();
          const before=document.querySelector('.battle-skill-cooldown').style.getPropertyValue('--cooldown-angle');
          for(let i=0;i<30;i++) tickSkillCooldowns(unit);
          updateStatusUI();
          return {before,after:document.querySelector('.battle-skill-cooldown').style.getPropertyValue('--cooldown-angle'),
            seconds:document.querySelector('.battle-skill-time').textContent};
        """)
        self.assertEqual(result, {'before': '180deg', 'after': '90deg', 'seconds': '0.5'})
        severe = [entry for entry in self.driver.get_log('browser') if entry['level'] == 'SEVERE']
        self.assertEqual(severe, [])


if __name__ == '__main__':
    unittest.main()
