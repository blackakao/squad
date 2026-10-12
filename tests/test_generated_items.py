"""Validate the October sample batch with the real app and isolated API storage.

Run: python tests/test_generated_items.py
Requires the existing Selenium/Chrome test environment.
"""
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from selenium.webdriver.common.by import By
import test_equipment_ui as harness

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'item_gen_20261010_'


def item_hash():
    return hashlib.sha256((ROOT / 'data/items.json').read_bytes()).hexdigest()


class GeneratedItems(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before = item_hash()
        harness.EquipmentUI.setUpClass.__func__(cls)
        assert cls.module.DATA_DIR.resolve() == cls.data.resolve()
        assert cls.module.DATA_DIR.resolve() != (ROOT / 'data').resolve()

    @classmethod
    def tearDownClass(cls):
        try:
            harness.EquipmentUI.tearDownClass.__func__(cls)
        finally:
            if item_hash() != cls.before:
                raise AssertionError('Original item data changed during isolated tests')

    def setUp(self):
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script(
            "return typeof iconMappingsReady !== 'undefined' && iconMappingsReady && itemsJson.length >= 146 && characterJson.length > 0"))

    def open_page(self, name):
        result = self.driver.execute_async_script("""
            const done = arguments[arguments.length-1];
            showPage(arguments[0]).then(()=>done('ok')).catch(e=>done(String(e)));
        """, name)
        self.assertEqual(result, 'ok')

    def test_schema_normalization_and_all_140_equipment_combinations(self):
        result = self.driver.execute_async_script("""
          const done = arguments[arguments.length - 1];
          (async () => {
            const raw = await (await fetch('/api/items')).json();
            const batch = raw.filter(x => x.id.startsWith('item_gen_20261010_'));
            const fail = message => {throw new Error(message)};
            const check = (ok, message) => {if (!ok) fail(message)};
            const keys = ['id','name','slot','weaponCategory','handType','attackType','attackSkillId','armorCategory',...ABILITY_ROWS.map(x=>x[1])].sort();
            check(batch.length === 140, 'Batch count');
            check(new Set(raw.map(x=>x.id)).size === raw.length, 'Duplicate ID');
            check(new Set(raw.map(x=>x.name)).size === raw.length, 'Duplicate name');
            const normalized = normalizeItemJson(batch);
            const catalog = [...getWeaponCategories().map(c=>({...c, type:'weapon'})), ...getArmorCategories().map(c=>({...c,type:'armor'}))];
            check(catalog.length === 14, 'Catalog changed');
            for (const cat of catalog) {
              const field = cat.type === 'weapon' ? 'weaponCategory' : 'armorCategory';
              const rows = batch.filter(x=>x[field]===cat.key);
              check(rows.length===10, `Category count ${cat.key}`);
              check(new Set(rows.map(x=>JSON.stringify(ABILITY_ROWS.map(([,k])=>x[k])))).size===10, 'Repeated stats');
              if(cat.type==='armor') {
                check(rows.filter(x=>x.slot==='top').length===5 && rows.filter(x=>x.slot==='bottom').length===5, 'Armor split');
              }
            }
            let placements = 0;
            for (const item of batch) {
              check(JSON.stringify(Object.keys(item).sort())===JSON.stringify(keys), `Schema ${item.id}`);
              check(ABILITY_ROWS.every(([,k])=>typeof item[k]==='number' && Number.isFinite(item[k]) && item[k]>=0), 'Numeric stat');
              const loaded = normalized.find(x=>x.id===item.id);
              check(loaded && keys.every(k=>loaded[k]===item[k]), `Normalization changed ${item.id}`);
              check(!item.attackSkillId || getSkillById(item.attackSkillId), 'Skill reference');
              if(item.weaponCategory==='치유서') check(item.attackSkillId==='skill_basic_heal', 'Healing link');
              const cat = catalog.find(c=>c.key===(item.weaponCategory||item.armorCategory));
              check(cat, 'Category reference');
              const character = {equipmentRules:{}, equipment:createEquipmentSlots()};
              for (const slot of EQUIPMENT_SLOTS) {
                const expected = cat.type==='armor' ? slot.key===item.slot :
                  cat.slotType==='mainOnly' ? slot.key==='mainWeapon' :
                  cat.slotType==='subOnly' ? slot.key==='subWeapon' : ['mainWeapon','subWeapon'].includes(slot.key);
                check(canEquipItemToSlot(item,slot.key,character)===expected, `Slot ${item.id}/${slot.key}`);
                if(!expected) continue;
                character.equipment = createEquipmentSlots();
                equipItemToSlot(character.equipment,item,slot.key,character);
                check(character.equipment[slot.key]===item.id, 'Equip reference');
                if(item.handType==='twoHand') check(character.equipment.mainWeapon===item.id && character.equipment.subWeapon===item.id, 'Two hands');
                const bonus = getCharacterEquipmentBonus(character);
                for(const [,k] of ABILITY_ROWS) {
                  const value = cat.type==='weapon' && ['attackSpeed','castSpeed'].includes(k) ? 0 : item[k];
                  check(Math.abs(bonus[k]-value)<1e-8, `Bonus ${item.id}/${k}`);
                }
                placements++;
              }
            }
            done({count:batch.length, placements});
          })().catch(e=>done({error:String(e)}));
        """)
        self.assertNotIn('error', result, result)
        self.assertEqual(result['count'], 140)
        self.assertEqual(result['placements'], 180)

    def test_api_save_reload_and_item_inventory_lists(self):
        original = json.loads((self.data / 'items.json').read_text(encoding='utf-8'))
        expected = [x for x in original if x['id'].startswith(PREFIX)]
        result = self.driver.execute_async_script("""
          const done=arguments[arguments.length-1];
          saveItemJson().then(()=>fetch('/api/items')).then(r=>r.json()).then(done).catch(e=>done({error:String(e)}));
        """)
        self.assertIsInstance(result, list)
        self.assertEqual([x for x in result if x['id'].startswith(PREFIX)], expected)
        self.assertEqual(json.loads((self.data / 'items.json').read_text(encoding='utf-8')), result)
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof iconMappingsReady !== 'undefined' && iconMappingsReady"))
        self.open_page('item')
        self.driver.execute_script("selectedItemSlotFilter='all'; renderItemPage();")
        names = self.driver.execute_script("return Array.from(itemTableBodyEl.rows,r=>r.cells[1].textContent)")
        self.assertTrue(all(x['name'] in names for x in expected))
        self.open_page('equipment')
        ids = [el.get_attribute('data-item-id') for el in self.driver.find_elements(By.CSS_SELECTOR, '.inventory-item')]
        self.assertTrue(all(x['id'] in ids for x in expected))
        mappings = json.loads((self.data / 'icon-mappings.json').read_text(encoding='utf-8'))
        for row in mappings:
            if row.get('group') in ('weapon', 'armor') and row.get('icon'):
                self.assertTrue((ROOT / row['icon'].lstrip('/')).is_file(), row['icon'])

    def test_click_equip_each_category_and_persist_after_refresh(self):
        batch = [x for x in json.loads((self.data / 'items.json').read_text(encoding='utf-8')) if x['id'].startswith(PREFIX)]
        examples = [x for x in batch if x['id'].endswith('_01') or (x['armorCategory'] and x['id'].endswith('_06'))]
        self.assertEqual(len(examples), 18)
        self.open_page('equipment')
        for item in examples:
            with self.subTest(item=item['name']):
                slot = item['slot']
                self.driver.find_element(By.CSS_SELECTOR, f'.inventory-item[data-item-id="{item["id"]}"]').click()
                self.assertIn(item['name'], self.driver.find_element(By.ID, 'equipmentItemDetail').text)
                self.driver.find_element(By.CSS_SELECTOR, f'.equipment-slot[data-slot="{slot}"] .equipment-slot-target').click()
                self.wait.until(lambda d: d.execute_script(
                    'return document.querySelector(arguments[0])?.textContent.includes(arguments[1])',
                    f'.equipment-slot[data-slot="{slot}"]', item['name']))
                self.wait.until(lambda d: json.loads((self.data / 'characters.json').read_text(encoding='utf-8'))[0]['equipment'][slot] == item['id'])
                self.driver.refresh()
                self.wait.until(lambda d: d.execute_script("return typeof iconMappingsReady !== 'undefined' && iconMappingsReady"))
                self.open_page('equipment')
                self.assertEqual(self.driver.execute_script('return characterJson[0].equipment[arguments[0]]', slot), item['id'])
                self.assertIn(item['name'], self.driver.find_element(By.CSS_SELECTOR, f'.equipment-slot[data-slot="{slot}"]').text)


if __name__ == '__main__':
    unittest.main(verbosity=2)
