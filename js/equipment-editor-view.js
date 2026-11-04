// Browser-only item editor UI. Loaded after equipment.js.
function renderItemModifiers(item) {
  document.getElementById('itemStatModifiers').innerHTML=CHARACTER_STAT_DEFS.map(({key,label})=>`<label>${escapeHtml(label)}<input type="number" step="any" data-stat-key="${key}" value="${Number(item?.statModifiers?.[key])||0}"></label>`).join('');
  document.getElementById('itemSkillModifiers').innerHTML='';
  normalizeItemSkillModifiers(item?.skillModifiers).forEach(addItemSkillModifierRow);
}
function addItemSkillModifierRow(modifier=null) {
  const row=document.createElement('div');row.className='item-skill-modifier';
  const skills=skillsJson.filter(skill=>isSkillExecutable(skill) && !isDefaultSkill(skill.id));
  row.innerHTML=`<label>스킬<select class="item-modifier-skill" onchange="updateItemModifierTargets(this.closest('.item-skill-modifier'))"><option value="">스킬 선택</option>${skills.map(skill=>`<option value="${escapeHtml(skill.id)}">${escapeHtml(skill.name)}</option>`).join('')}</select></label><label>대상 효과 · 보조 항목<select class="item-modifier-target"></select></label><label>보정값<input class="item-modifier-value" type="number" step="any" value="${modifier?.value ?? 0}"></label><button type="button" onclick="this.closest('.item-skill-modifier').remove()">보조 삭제</button>`;
  document.getElementById('itemSkillModifiers').appendChild(row);
  if(modifier && !skills.some(s=>s.id===modifier.skillId)) row.querySelector('select').add(new Option('삭제되거나 미지원인 스킬',modifier.skillId));
  row.querySelector('select').value=modifier?.skillId ?? '';
  updateItemModifierTargets(row,modifier);
}
function updateItemModifierTargets(row, modifier=null) {
  const targets=getItemSkillTargets(getSkillById(row.querySelector('.item-modifier-skill').value));
  row.modifierTargets=targets;
  const select=row.querySelector('.item-modifier-target');
  select.innerHTML='<option value="">보조 항목 선택</option>'+targets.map((target,i)=>`<option value="${i}">${escapeHtml(target.label)}</option>`).join('');
  if (modifier) {
    const index=targets.findIndex(t=>t.target===modifier.target && t.signature===modifier.signature);
    if(index>=0) select.value=String(index);
    else {select.add(new Option('대상 변경됨 · 다시 선택하거나 삭제하세요','stale'));select.value='stale';}
  }
}
function readItemModifiers() {
  const statModifiers=normalizeItemStatModifiers(Object.fromEntries([...document.querySelectorAll('#itemStatModifiers input')].map(input=>[input.dataset.statKey,Number(input.value)])));
  const skillModifiers=[...document.querySelectorAll('.item-skill-modifier')].map(row=>{
    const skillId=row.querySelector('.item-modifier-skill').value;
    const selection=row.querySelector('.item-modifier-target').value;
    const target=selection!=='' ? row.modifierTargets[Number(selection)] : null;
    const value=Number(row.querySelector('.item-modifier-value').value);
    if(!skillId || !target || !Number.isFinite(value) || !value) throw new Error('스킬 보조의 스킬·대상·0이 아닌 보정값을 확인하세요.');
    return {skillId,target:target.target,signature:target.signature,value};
  });
  return {...(Object.keys(statModifiers).length ? {statModifiers} : {}),...(skillModifiers.length ? {skillModifiers} : {})};
}

function changeItemSlotFilter(slotKey) {
  selectedItemSlotFilter = slotKey;
  renderItemPage();
}

function openItemModal(index = "") {
  if (itemMutationPending) return;
  const item = itemsJson[index];
  itemModalTitleEl.innerText = item ? "아이템 수정" : "아이템 추가";
  itemEditIndexEl.value = item ? index : "";
  itemNameEl.value = item?.name ?? "";
  itemSlotEl.value = item?.slot ?? EQUIPMENT_SLOTS[0].key;
  renderCategoryOptions();
  itemWeaponCategoryEl.value = item?.weaponCategory || getWeaponCategories()[0]?.key || "";
  if (itemAttackSkillEl) {
    itemAttackSkillEl.innerHTML = getSkillOptionsHtml(item?.attackSkillId ?? "");
    itemAttackSkillEl.value = item?.attackSkillId ?? "";
  }
  itemArmorCategoryEl.value = item?.armorCategory || getArmorCategories()[0]?.key || "";
  itemHpEl.value = item?.hp ?? 0;
  itemMpEl.value = item?.mp ?? 0;
  itemStEl.value = item?.st ?? 0;
  itemAtkEl.value = item?.atk ?? 0;
  itemMagicEl.value = item?.magic ?? 0;
  itemSpeedEl.value = item?.speed ?? 0;
  itemAttackSpeedEl.value = item?.attackSpeed ?? 0;
  itemCastSpeedEl.value = item?.castSpeed ?? 0;
  itemDefenseEl.value = item?.defense ?? 0;
  itemResistanceEl.value = item?.resistance ?? 0;
  itemAttackRangeEl.value = item?.attackRange ?? 0;
  syncItemWeaponFields();
  renderItemModifiers(item);
  document.getElementById("itemDeleteButton").classList.toggle("hidden", !item);
  itemModalEl.classList.remove("hidden");
}

function closeItemModal() {
  if (itemMutationPending) return;
  itemModalEl.classList.add("hidden");
  itemFormEl.reset();
}

