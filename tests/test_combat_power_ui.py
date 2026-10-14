"""Real Chrome + isolated Python API: CP across all three management pages."""
import json
import os
import unittest
from pathlib import Path
from selenium.webdriver.common.by import By
import test_equipment_ui as equipment_test


class CombatPowerUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        equipment_test.EquipmentUI.setUpClass.__func__(cls)
        cls.original = (cls.data / 'characters.json').read_bytes()

    @classmethod
    def tearDownClass(cls):
        equipment_test.EquipmentUI.tearDownClass.__func__(cls)

    def setUp(self):
        data = json.loads(self.original)
        data[0].update(attributes={}, equipment={}, equipmentSets=[], activeEquipmentSet=0)
        (self.data / 'characters.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length>0 && typeof iconMappingsReady !== 'undefined' && iconMappingsReady"))

    def page(self, name):
        self.driver.execute_async_script("const done=arguments[arguments.length-1];showPage(arguments[0]).then(done)", name)

    def value(self, selector):
        return int(self.driver.find_element(By.CSS_SELECTOR, selector).text.replace(',', ''))

    def persisted(self, predicate):
        def saved(_):
            try:
                return predicate(json.loads((self.data / 'characters.json').read_text(encoding='utf-8'))[0])
            except (KeyError, json.JSONDecodeError):
                return False
        self.wait.until(saved)

    def click_action(self, action):
        self.driver.find_element(By.CSS_SELECTOR, f'button[onclick="{action}"]').click()

    def test_all_characters_sort_and_three_page_consistency(self):
        self.page('character')
        expected = self.driver.execute_script('return characterJson.map(c=>getCharacterCombatPower(c).total)')
        before = (self.data / 'characters.json').read_bytes()
        for reverse in [False, True]:
            self.driver.find_element(By.CSS_SELECTOR, '[data-sort-key="combatPower"] button').click()
            values = [int(e.text.replace(',', '')) for e in self.driver.find_elements(By.CSS_SELECTOR, '#characterTableBody [data-cp="total"]')]
            self.assertEqual(values, sorted(expected, reverse=reverse))
        self.assertEqual((self.data / 'characters.json').read_bytes(), before)
        for page, buttons, selector in [
            ('stats', '#statCharacterButtons button', '#statAbilityPreview [data-cp="current"]'),
            ('equipment', '#equipmentCharacterButtons button', '#equipmentCombatPower [data-cp="next"]')
        ]:
            self.page(page)
            for index, total in enumerate(expected):
                # All-roster value check uses actual DOM click handlers; pointer
                # interactions and API persistence are covered in the next test.
                button = self.driver.find_elements(By.CSS_SELECTOR, buttons)[index]
                self.driver.execute_script("arguments[0].click()", button)
                self.assertEqual(self.value(selector), total, (page, index))
        self.driver.refresh()
        self.page('character')
        after = self.driver.execute_script('return characterJson.map(c=>getCharacterCombatPower(c).total)')
        self.assertEqual(after, expected)

    def test_stat_equipment_restore_persistence_and_navigation(self):
        self.page('stats')
        current = '#statAbilityPreview [data-cp="current"]'
        preview = '#statAbilityPreview [data-cp="next"]'
        baseline = self.value(current)
        for stat in ['str', 'vit', 'agi']:
            self.click_action(f"changeCharacterStat('{stat}', 10)")
            self.assertGreater(self.value(preview), baseline)
            self.assertEqual(self.value(current), baseline)
            self.click_action(f"changeCharacterStat('{stat}', -10)")
            self.assertEqual(self.value(preview), baseline)
        self.click_action("changeCharacterStat('str', 10)")
        invested = self.value(preview)
        self.click_action('saveSelectedCharacterStats()')
        self.persisted(lambda c: c['attributes']['str'] == 10)
        self.wait.until(lambda d: self.value(current) == invested)
        self.page('character')
        self.assertEqual(self.value('tr[data-character-index="0"] [data-cp="total"]'), invested)
        self.page('stats')
        self.click_action("changeCharacterStat('str', -10)")
        self.click_action('saveSelectedCharacterStats()')
        self.persisted(lambda c: c['attributes']['str'] == 0)
        self.wait.until(lambda d: self.value(current) == baseline)
        self.page('equipment')
        equipped = '#equipmentCombatPower [data-cp="next"]'
        self.assertEqual(self.value(equipped), baseline)
        armor_name = self.driver.execute_script("return itemsJson.find(i=>i.slot==='top' && i.defense>0).name")
        for name, slot in [('한손검샘플','mainWeapon'), ('방패샘플','subWeapon'), (armor_name,'top'), ('한손검샘플','mainWeapon')]:
            self.driver.find_element(By.XPATH, f'//button[contains(@class,"inventory-item")][span[text()="{name}"]]').click()
            self.driver.find_element(By.CSS_SELECTOR, f'.equipment-slot[data-slot="{slot}"] .equipment-slot-target').click()
            self.persisted(lambda c: bool(c['equipment'][slot]))
            self.wait.until(lambda d: self.value(equipped) > baseline)
            total = self.value(equipped)
            self.page('stats')
            self.assertEqual(self.value(current), total)
            self.page('character')
            self.assertEqual(self.value('tr[data-character-index="0"] [data-cp="total"]'), total)
            self.driver.refresh()
            self.wait.until(lambda d: d.execute_script("return typeof characterJson !== 'undefined' && characterJson.length>0"))
            self.page('equipment')
            self.assertEqual(self.value(equipped), total)
            self.driver.find_element(By.CSS_SELECTOR, f'.equipment-slot[data-slot="{slot}"] .equipment-unequip').click()
            self.persisted(lambda c: not c['equipment'][slot])
            self.wait.until(lambda d: self.value(equipped) == baseline)
        for width in [1920,1440,640]:
            self.driver.set_window_size(width,1000)
            for name in ['character','stats','equipment']:
                self.page(name)
                self.assertTrue(self.driver.execute_script("const e=document.querySelector('#'+arguments[0]+'Page .combat-power-summary')||document.querySelector('#characterTableBody [data-cp]');return !!e&&e.getBoundingClientRect().width>0", name))
                if os.environ.get('CP_SCREENSHOTS') and width == 1440:
                    self.driver.execute_script("window.scrollTo(0,0)")
                    self.driver.save_screenshot(str(Path(__file__).resolve().parents[1] / f'.tmp-cp-{name}.png'))
        saved = json.loads((self.data / 'characters.json').read_text(encoding='utf-8'))
        self.assertTrue(all('combatPower' not in c for c in saved))
        self.assertFalse([e for e in self.driver.get_log('browser') if e['level']=='SEVERE' and self.url in e['message'] and 'favicon' not in e['message']])


if __name__ == '__main__':
    unittest.main()
