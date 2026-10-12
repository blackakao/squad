"""Real Chrome + isolated Python API checks for item management and modifiers."""
import json
import os
import unittest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
import test_character_ui as harness
ROOT = harness.ROOT


class ItemUI(unittest.TestCase):
    setUpClass = classmethod(harness.CharacterUI.setUpClass.__func__)

    def setUp(self):
        self.handler.fail_characters = False
        for name in ['items', 'characters', 'teams', 'skills']:
            (self.data / f'{name}.json').write_bytes((ROOT / 'data' / f'{name}.json').read_bytes())
        self.driver.set_window_size(1440, 1000)
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof characterJson!=='undefined' && characterJson.length && document.querySelector('#itemTableBody tr')"))
        self.run_js("const original=showPage;window.showPage=(...args)=>window.itemTestNavigation=original(...args)")
        self.driver.find_element(By.CSS_SELECTOR, 'button[onclick="showPage(\'item\')"]').click()
        self.driver.execute_async_script('Promise.resolve(window.itemTestNavigation).then(arguments[0])')

    def run_js(self, code, *args):
        return self.driver.execute_script(code, *args)

    def save(self):
        self.driver.find_element(By.CSS_SELECTOR, '#itemForm button[type="submit"]').click()
        try:
            self.wait.until(lambda d: not d.find_element(By.ID, 'itemModal').is_displayed())
        except Exception:
            self.fail(str(self.run_js("return {pending:itemMutationPending,invalid:[...itemFormEl.querySelectorAll(':invalid')].map(e=>[e.id,e.value,e.validationMessage]),logs:document.getElementById('logPage')?.innerText.slice(-2500)}")))

    def fixture(self):
        self.run_js("itemsJson.push({...createEmptyItemStats(),id:'ui_modifier_fixture',name:'검증 전용 장신구',slot:'accessory'});renderItemPage();openItemModal(itemsJson.length-1)")

    def test_table_sort_filter_original_index_and_responsive(self):
        expected=['이름','착용방식','공격력','마력','방어력','저항력','사정거리','작동스킬','부가 능력치','수정']
        self.assertEqual([e.text for e in self.driver.find_elements(By.CSS_SELECTOR,'#itemTableHeader th')],expected)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR,'#itemPage input[type="checkbox"]'))
        self.assertTrue(self.run_js("return [...document.querySelectorAll('#itemTableHeader th')].every((th,i)=>getComputedStyle(th).textAlign===([0,8].includes(i)?'left':'center')) && [...document.querySelector('#itemTableBody tr').cells].every((td,i)=>getComputedStyle(td).textAlign===([0,8].includes(i)?'left':'center'))"))
        self.assertTrue(self.run_js("const row=document.querySelector('.item-identity');const icon=row.querySelector('.equipment-icon').getBoundingClientRect(), name=row.querySelector('strong').getBoundingClientRect();return icon.width===36&&icon.height===36&&Math.abs(icon.y+icon.height/2-name.y-name.height/2)<1"))
        extra=self.driver.find_element(By.CSS_SELECTOR,'.item-extra')
        extra.find_element(By.TAG_NAME,'summary').click()
        self.assertTrue(extra.get_attribute('open'))
        self.assertTrue(extra.find_element(By.TAG_NAME,'ul').is_displayed())
        extra.find_element(By.TAG_NAME,'summary').click()
        before=self.run_js('return JSON.stringify(itemsJson)')
        for key in ['name','handType','atk','magic','defense','resistance','attackRange','skill','extra']:
            for direction in [1,-1]:
                self.driver.find_element(By.CSS_SELECTOR,f'#itemTableHeader [data-sort-key="{key}"] button').click()
                self.assertTrue(self.run_js("const v=[...document.querySelectorAll('#itemTableBody tr[data-item-index]')].map(r=>getItemSortValue(itemsJson[Number(r.dataset.itemIndex)],arguments[0]));return v.every((x,i)=>!i||(typeof x==='number'?x-v[i-1]:x.localeCompare(v[i-1],'ko',{numeric:true}))*arguments[1]>=0)",key,direction))
        Select(self.driver.find_element(By.ID,'itemSlotFilter')).select_by_value('mainWeapon')
        self.assertTrue(self.run_js("return [...document.querySelectorAll('#itemTableBody tr')].every(r=>itemsJson[Number(r.dataset.itemIndex)].slot==='mainWeapon')"))
        row=self.driver.find_element(By.CSS_SELECTOR,'#itemTableBody tr')
        index=row.get_attribute('data-item-index')
        row.find_element(By.TAG_NAME,'button').click()
        self.assertEqual(self.driver.find_element(By.ID,'itemEditIndex').get_attribute('value'),index)
        self.run_js('closeItemModal()')
        self.assertEqual(self.run_js('return JSON.stringify(itemsJson)'),before)
        for width in [1920,1440,640]:
            self.driver.set_window_size(width,1000)
            self.assertTrue(self.run_js('return document.documentElement.scrollWidth<=innerWidth'))
            if width>=1440:
                self.assertTrue(self.run_js("const s=document.querySelector('.item-table-scroll');return s.scrollWidth<=s.clientWidth"))
            if os.environ.get('ITEM_UI_SCREENSHOTS'):
                self.driver.save_screenshot(str(ROOT/f'.tmp-item-{width}.png'))

    def test_existing_bow_modal_values_and_responsive(self):
        index=self.run_js("return itemsJson.findIndex(i=>i.name==='활')")
        self.assertGreaterEqual(index,0)
        self.run_js('openItemModal(arguments[0])',index)
        for element,key in [('itemAtk','atk'),('itemMagic','magic'),('itemHp','hp'),('itemAttackSpeed','attackSpeed'),('itemCastSpeed','castSpeed')]:
            self.assertEqual(float(self.driver.find_element(By.ID,element).get_attribute('value')),self.run_js('return itemsJson[arguments[0]][arguments[1]]',index,key))
        for width in [1440,640]:
            self.driver.set_window_size(width,1000)
            self.assertTrue(self.run_js("const m=document.querySelector('.item-modal-content');return m.scrollWidth<=m.clientWidth && m.getBoundingClientRect().right<=innerWidth"))
            if os.environ.get('ITEM_UI_SCREENSHOTS'):
                self.driver.save_screenshot(str(ROOT/f'.tmp-item-modal-{width}.png'))

    def test_stat_save_equip_unequip_without_accumulation(self):
        self.fixture()
        hp=self.driver.find_element(By.ID,'itemHp');hp.clear();hp.send_keys('125')
        strength=self.driver.find_element(By.CSS_SELECTOR,'#itemStatModifiers [data-stat-key="str"]');strength.clear();strength.send_keys('5')
        self.save()
        self.driver.refresh()
        self.wait.until(lambda d:d.execute_script("return typeof itemsJson!=='undefined'&&itemsJson.some(i=>i.id==='ui_modifier_fixture')"))
        self.assertEqual(self.run_js("return getItemById('ui_modifier_fixture').statModifiers"),{'str':5})
        self.run_js("openItemModal(itemsJson.findIndex(i=>i.id==='ui_modifier_fixture'))")
        self.assertEqual(self.driver.find_element(By.ID,'itemHp').get_attribute('value'),'125')
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR,'[data-stat-key="str"]').get_attribute('value'),'5')
        values=self.run_js("""const c={...characterJson[0],equipment:{},equipmentSets:undefined};const before=JSON.stringify(c);
          const base=applyCharacterStatAbilities(c);const equipped={...c,equipment:{accessory:'ui_modifier_fixture'}};
          const once=applyCharacterStatAbilities(equipped), twice=applyCharacterStatAbilities(once);
          const runtime=createCharacter(equipped,0);const off=applyCharacterStatAbilities({...twice,equipment:{}});
          return [once.atk-base.atk,once.hp-base.hp,runtime.attributes.str-base.attributes.str,twice.atk===once.atk,off.atk===base.atk,JSON.stringify(c)===before]""")
        self.assertEqual(values,[5,125,5,True,True,True])
        self.run_js('closeItemModal()')
        self.driver.execute_async_script("showPage('equipment').then(arguments[0])")
        self.run_js('selectEquipmentCharacter(0)')
        self.driver.find_element(By.CSS_SELECTOR,'.inventory-item[data-item-id="ui_modifier_fixture"]').click()
        self.driver.find_element(By.CSS_SELECTOR,'.equipment-slot[data-slot="accessory"] .equipment-slot-target').click()
        self.wait.until(lambda d:json.loads((self.data/'characters.json').read_bytes())[0]['equipment'].get('accessory')=='ui_modifier_fixture')
        self.assertEqual(self.run_js('return createCharacter(characterJson[0],0).attributes.str-characterJson[0].attributes.str'),5)
        self.driver.find_element(By.CSS_SELECTOR,'button[onclick="unequipItem(\'accessory\')"]').click()
        self.wait.until(lambda d:json.loads((self.data/'characters.json').read_bytes())[0]['equipment'].get('accessory')=='')
        self.assertEqual(self.run_js('return createCharacter(characterJson[0],0).attributes.str-characterJson[0].attributes.str'),0)
        self.driver.execute_async_script("showPage('item').then(arguments[0])")
        self.run_js("openItemModal(itemsJson.findIndex(i=>i.id==='ui_modifier_fixture'))")
        strength=self.driver.find_element(By.CSS_SELECTOR,'[data-stat-key="str"]');strength.clear();strength.send_keys('0')
        self.save()
        self.assertNotIn('statModifiers',json.loads((self.data/'items.json').read_bytes())[-1])

    def test_skill_editor_save_real_battle_and_restore(self):
        self.run_js("""const action=normalizeSkillAction({type:'deal_damage',target:'enemy',damageType:'fixed',rangeMode:'custom',rangeValue:20,coefficients:[{type:'fixed',value:10},{type:'fixed',value:20}]});
          skillsJson.push(normalizeSkillJson([{id:'ui_skill_fixture',name:'검증용 두 계수',slot:'active',castTime:0,cooldown:5,resourceCosts:[{resource:'MP',mode:'fixed',value:10}],actions:[action]}]).find(s=>s.id==='ui_skill_fixture'));""")
        self.driver.execute_async_script("saveJsonFile('skills',skillsJson).then(arguments[0])")
        self.fixture()
        self.driver.find_element(By.CSS_SELECTOR,'button[onclick="addItemSkillModifierRow()"]').click()
        Select(self.driver.find_element(By.CSS_SELECTOR,'.item-modifier-skill')).select_by_value('ui_skill_fixture')
        self.run_js("const row=document.querySelector('.item-skill-modifier');row.querySelector('.item-modifier-target').value=String(row.modifierTargets.findIndex(t=>t.target==='actions.0.coefficients.1.value'))")
        value=self.driver.find_element(By.CSS_SELECTOR,'.item-modifier-value');value.clear();value.send_keys('7')
        self.save()
        saved=json.loads((self.data/'items.json').read_bytes())[-1]
        self.assertEqual(saved['skillModifiers'][0]['value'],7)
        self.driver.refresh()
        self.wait.until(lambda d:d.execute_script("return typeof characterJson!=='undefined'&&characterJson.length&&getSkillById('ui_skill_fixture')"))
        self.run_js("openItemModal(itemsJson.findIndex(i=>i.id==='ui_modifier_fixture'))")
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR,'.item-modifier-value').get_attribute('value'),'7')
        result=self.run_js("""closeItemModal();const original=JSON.stringify(skillsJson);const raw={...characterJson[0],equipment:{accessory:'ui_modifier_fixture'},equipmentSets:undefined,skillIds:['ui_skill_fixture']};
          const source=createCharacter(raw,0),target=createCharacter({...raw,equipment:{},skillIds:[]},1,'enemy');
          playerSquad=[source];enemySquad=[target];resetUnitForBattle(source);resetUnitForBattle(target);
          source.x=100;source.y=100;target.x=110;target.y=100;const hp=target.hp;
          const used=tryUseReadySkill(source,[source],[target]);const damage=hp-target.hp;
          const off=createCharacter({...raw,equipment:{}},0);const restored=getEquippedSkills(off)[0].actions[0].coefficients[1].value;
          return [used,damage,restored,JSON.stringify(skillsJson)===original]""")
        self.assertEqual(result,[True,37,20,True])

    def test_delete_cancel_and_detach_all_sets(self):
        self.fixture();self.save()
        self.driver.execute_async_script("const done=arguments[0];fetch(API_URLS.characters).then(r=>r.json()).then(c=>{c[0].equipment.accessory='ui_modifier_fixture';c[0].equipmentSets=[{name:'검증1',equipment:{accessory:'ui_modifier_fixture'}},{name:'검증2',equipment:{accessory:'ui_modifier_fixture'}}];return saveJsonFile('characters',c)}).then(done)")
        self.run_js("openItemModal(itemsJson.findIndex(i=>i.id==='ui_modifier_fixture'))")
        self.driver.find_element(By.ID,'itemDeleteButton').click();self.wait.until(EC.alert_is_present())
        self.assertIn('검증 전용 장신구',self.driver.switch_to.alert.text)
        self.assertIn('장착 중',self.driver.switch_to.alert.text)
        self.driver.switch_to.alert.dismiss()
        self.assertTrue(self.run_js("return !!getItemById('ui_modifier_fixture')"))
        self.handler.fail_characters=True
        self.driver.find_element(By.ID,'itemDeleteButton').click();self.wait.until(EC.alert_is_present());self.driver.switch_to.alert.accept()
        self.wait.until(EC.alert_is_present())
        self.assertIn('삭제하지 못했습니다',self.driver.switch_to.alert.text)
        self.driver.switch_to.alert.accept()
        self.wait.until(lambda d:not d.execute_script('return itemMutationPending'))
        self.assertIn('ui_modifier_fixture',(self.data/'items.json').read_text(encoding='utf-8'))
        self.handler.fail_characters=False
        self.driver.find_element(By.ID,'itemDeleteButton').click();self.wait.until(EC.alert_is_present());self.driver.switch_to.alert.accept()
        self.wait.until(lambda d:not d.find_element(By.ID,'itemModal').is_displayed())
        self.assertNotIn('ui_modifier_fixture',(self.data/'characters.json').read_text(encoding='utf-8'))
        self.assertNotIn('ui_modifier_fixture',(self.data/'items.json').read_text(encoding='utf-8'))


if __name__=='__main__':
    unittest.main()
