"""Equipment UI regression checks against the real API with isolated user data."""
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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class EquipmentUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('equipment_test_server', ROOT / 'server.py')
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-equipment-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.data = Path(cls.temp.name) / 'data'
        shutil.copytree(ROOT / 'data', cls.data)
        cls.module.DATA_DIR = cls.data
        cls.module.ENTITY_STORE = cls.module.EntityStore(cls.data)
        cls.module.IMAGE_SETTINGS_PATH = cls.data / 'image-generator-settings.json'
        cls.module.BattleHandler.log_message = lambda *args: None
        cls.module.server_log = lambda *args: None
        class TestServer(ThreadingHTTPServer):
            request_queue_size = 64
        cls.server = TestServer(('127.0.0.1', 0), cls.module.BattleHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)
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
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length > 0 && typeof iconMappingsReady !== 'undefined' && iconMappingsReady"))
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'equipment\')"]').click()
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.inventory-item')) > 0)

    def item(self, name):
        return self.driver.find_element(By.XPATH, f'//button[contains(@class,"inventory-item")][span[text()="{name}"]]')

    def slot(self, key):
        return self.driver.find_element(By.CSS_SELECTOR, f'.equipment-slot[data-slot="{key}"]')

    def equipped(self, key):
        return self.driver.execute_script('return characterJson[selectedEquipmentCharacterIndex].equipment[arguments[0]]', key)

    def test_drag_equip_reverse_and_persistence(self):
        for name, key in [('한손검샘플', 'mainWeapon'), ('방패샘플', 'subWeapon'), ('한손검샘플', 'mainWeapon')]:
            source = self.item(name)
            item_id = source.get_attribute('data-item-id')
            ActionChains(self.driver).drag_and_drop(source, self.slot(key)).perform()
            self.wait.until(lambda d: self.equipped(key) == item_id)
            self.wait.until(lambda d: json.loads((self.data / 'characters.json').read_text(encoding='utf-8'))[0]['equipment'][key] == item_id)
            self.wait.until(lambda d: name in self.slot(key).text)
            self.assertEqual(self.driver.execute_script("return document.querySelectorAll('.equipment-drag-preview').length"), 0)
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length>0"))
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'equipment\')"]').click()
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.inventory-item')) > 0)
        self.assertTrue(self.equipped('subWeapon'))
        source = self.slot('subWeapon').find_element(By.CSS_SELECTOR, '.equipment-slot-target')
        ActionChains(self.driver).drag_and_drop(source, self.driver.find_element(By.CSS_SELECTOR, '.equipment-inventory h5')).perform()
        self.wait.until(lambda d: self.equipped('subWeapon') == '')

    def test_drag_preview_and_invalid_slot(self):
        source = self.item('한손검샘플')
        self.wait.until(lambda d: source.find_element(By.CSS_SELECTOR, 'img').get_attribute('data-icon-processing') is None)
        before = self.equipped('top')
        ActionChains(self.driver).move_to_element(source).click_and_hold().move_by_offset(15, 15).pause(.3).perform()
        self.wait.until(lambda d: d.execute_script('return equipmentDragState !== null'))
        self.assertEqual(self.driver.execute_script("return document.querySelector('.equipment-drag-preview').textContent.trim()"), '')
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, '.equipment-drag-preview img')), 1)
        self.assertIn('drop-blocked', self.slot('top').get_attribute('class'))
        self.assertIn('drop-allowed', self.slot('mainWeapon').get_attribute('class'))
        self.assertEqual(self.driver.execute_script('return window.getSelection().toString()'), '')
        if os.environ.get('EQUIPMENT_SCREENSHOTS'):
            self.driver.save_screenshot(str(ROOT / '.tmp-equipment-drag.png'))
        ActionChains(self.driver).move_to_element(self.slot('top')).release().perform()
        self.assertEqual(self.equipped('top'), before)
        self.assertEqual(self.driver.execute_script("return document.querySelectorAll('.equipment-drag-preview').length"), 0)

    def test_selection_search_sets_and_responsive(self):
        self.item('방패샘플').click()
        self.assertIn('방패샘플', self.driver.find_element(By.ID, 'equipmentItemDetail').text)
        self.slot('subWeapon').find_element(By.CSS_SELECTOR, '.equipment-slot-target').click()
        self.wait.until(lambda d: bool(self.equipped('subWeapon')))
        self.driver.find_element(By.ID, 'equipmentItemSearch').send_keys('없는아이템')
        self.assertIn('조건에 맞는 아이템이 없습니다', self.driver.find_element(By.ID, 'equipmentItemTableBody').text)
        self.driver.find_element(By.ID, 'equipmentItemSearch').clear()
        self.driver.execute_script('renderEquipmentItemTable()')
        count = self.driver.execute_script('return characterJson[selectedEquipmentCharacterIndex].equipmentSets.length')
        if count < 3:
            self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="copyActiveEquipmentSet()"]').click()
            self.wait.until(lambda d: d.execute_script('return characterJson[selectedEquipmentCharacterIndex].equipmentSets.length') == count + 1)
            self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '#equipmentSetControls option')) == count + 1)
            self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="deleteActiveEquipmentSet()"]').click()
            self.wait.until(lambda d: d.execute_script('return characterJson[selectedEquipmentCharacterIndex].equipmentSets.length') == count)
        for width in [1920, 1440, 640]:
            self.driver.set_window_size(width, 1050)
            self.assertTrue(self.driver.execute_script("const p=document.getElementById('equipmentPage');return p.scrollWidth<=p.clientWidth+1"))
            self.assertTrue(self.driver.execute_script("return [...document.querySelectorAll('.equipment-slot,.inventory-item')].every(e=>e.getBoundingClientRect().width>=68)"))
            if os.environ.get('EQUIPMENT_SCREENSHOTS'):
                self.driver.save_screenshot(str(ROOT / f'.tmp-equipment-{width}.png'))
                if width == 640:
                    self.driver.execute_script("document.querySelector('.equipment-inventory').scrollIntoView()")
                    self.driver.save_screenshot(str(ROOT / '.tmp-equipment-640-inventory.png'))
        self.assertFalse([row for row in self.driver.get_log('browser') if row['level'] == 'SEVERE' and self.url in row['message'] and 'favicon' not in row['message']])

    def test_filters_character_switch_buttons_and_collapse(self):
        Select(self.driver.find_element(By.ID, 'equipmentItemSlotFilter')).select_by_value('subWeapon')
        names = [el.text for el in self.driver.find_elements(By.CSS_SELECTOR, '.inventory-item')]
        self.assertIn('방패샘플', names)
        self.assertNotIn('활', names)
        self.driver.find_elements(By.CSS_SELECTOR, '#equipmentCharacterButtons button')[1].click()
        self.assertEqual(self.driver.execute_script('return selectedEquipmentCharacterIndex'), 1)
        self.item('방패샘플').click()
        self.slot('subWeapon').find_element(By.CSS_SELECTOR, '.equipment-slot-target').click()
        self.wait.until(lambda d: '방패샘플' in self.slot('subWeapon').text)
        self.slot('subWeapon').find_element(By.CSS_SELECTOR, '.equipment-unequip').click()
        self.wait.until(lambda d: not self.equipped('subWeapon'))
        summary = self.driver.find_element(By.CSS_SELECTOR, '.equipment-stats summary')
        summary.click()
        self.assertFalse(self.driver.find_element(By.ID, 'equipmentAbilityPreview').is_displayed())
        summary.click()
        self.assertTrue(self.driver.find_element(By.ID, 'equipmentAbilityPreview').is_displayed())


if __name__ == '__main__':
    unittest.main()
