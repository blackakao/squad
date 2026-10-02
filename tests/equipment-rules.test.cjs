const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function equipmentEngine() {
  const categories = [
    {key:'sword',label:'한손검',handType:'oneHand',slotType:'both'},
    {key:'greatsword',label:'양손검',handType:'twoHand',slotType:'mainOnly'}
  ];
  const itemsJson = [
    {id:'one',name:'검',slot:'mainWeapon',weaponCategory:'sword',handType:'oneHand',atk:5},
    {id:'two',name:'대검',slot:'mainWeapon',weaponCategory:'greatsword',handType:'twoHand',atk:10},
    {id:'two_b',name:'대검2',slot:'mainWeapon',weaponCategory:'greatsword',handType:'twoHand',atk:12}
  ];
  const context = {
    EQUIPMENT_SLOTS:[{key:'mainWeapon',label:'주무기'},{key:'subWeapon',label:'보조무기'},{key:'top',label:'상의'}],
    WEAPON_SLOT_KEYS:['mainWeapon','subWeapon'],
    ABILITY_ROWS:[['공격력','atk']],
    itemsJson, characterJson:[], selectedEquipmentCharacterIndex:'',
    getWeaponCategory:key=>categories.find(item=>item.key===key),
    getWeaponCategories:()=>categories,
    isArmorSlot:()=>false,
    escapeHtml:String
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js/equipment.js'),'utf8'),context);
  return context;
}

test('equipment rules normalize and create up to five extra weapon slots', () => {
  const e=equipmentEngine();
  assert.deepEqual(JSON.parse(JSON.stringify(e.normalizeEquipmentRules({extraWeaponSlots:9,twoHandSingleSlot:true}))),{extraWeaponSlots:5,twoHandSingleSlot:true,sameTargetWeaponPenaltyPercent:0});
  const character={equipmentRules:{extraWeaponSlots:2,twoHandSingleSlot:false}};
  assert.deepEqual(Array.from(e.getCharacterEquipmentSlots(character),slot=>slot.key),['mainWeapon','subWeapon','top','extraWeapon1','extraWeapon2']);
  assert.equal(e.canEquipItemToSlot(e.itemsJson[0],'extraWeapon1',character),true);
  assert.equal(e.canEquipItemToSlot(e.itemsJson[1],'extraWeapon1',character),false);
});

test('normal two handed weapons occupy both base slots', () => {
  const e=equipmentEngine();
  const character={equipmentRules:{extraWeaponSlots:1,twoHandSingleSlot:false}};
  const equipment=e.createEquipmentSlots({},character);
  e.equipItemToSlot(equipment,e.itemsJson[1],'mainWeapon',character);
  assert.equal(equipment.mainWeapon,'two');
  assert.equal(equipment.subWeapon,'two');
  e.equipItemToSlot(equipment,e.itemsJson[0],'extraWeapon1',character);
  assert.equal(equipment.mainWeapon,'two');
  assert.equal(equipment.subWeapon,'two');
  assert.equal(equipment.extraWeapon1,'one');
});

test('single-slot two handed rule permits distinct weapons and counts both bonuses', () => {
  const e=equipmentEngine();
  const character={equipmentRules:{extraWeaponSlots:1,twoHandSingleSlot:true}};
  const equipment=e.createEquipmentSlots({},character);
  assert.equal(e.canEquipItemToSlot(e.itemsJson[1],'subWeapon',character),true);
  assert.equal(e.canEquipItemToSlot(e.itemsJson[2],'extraWeapon1',character),true);
  e.equipItemToSlot(equipment,e.itemsJson[1],'subWeapon',character);
  e.equipItemToSlot(equipment,e.itemsJson[2],'extraWeapon1',character);
  assert.equal(equipment.subWeapon,'two');
  assert.equal(equipment.extraWeapon1,'two_b');
  assert.equal(e.getCharacterEquipmentBonus({...character,equipment}).atk,22);
});

test('legacy equipment becomes set one and active equipment sets stay independent', () => {
  const e=equipmentEngine();
  const legacy=e.normalizeCharacterEquipmentSets({equipment:{mainWeapon:'one'}});
  assert.equal(legacy.equipmentSets.length,1);assert.equal(legacy.equipmentSets[0].name,'세트 1');assert.equal(legacy.equipment.mainWeapon,'one');
  const character=e.normalizeCharacterEquipmentSets({activeEquipmentSet:1,equipmentSets:[
    {name:'A',equipment:{mainWeapon:'one'}},{name:'B',equipment:{mainWeapon:'two'}}
  ]});
  assert.equal(character.equipment.mainWeapon,'two');
  character.equipment.mainWeapon='two_b';e.syncActiveEquipmentSet(character);
  assert.equal(character.equipmentSets[1].equipment.mainWeapon,'two_b');assert.equal(character.equipmentSets[0].equipment.mainWeapon,'one');
});
