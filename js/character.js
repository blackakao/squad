async function loadCharacterJson() {
  const defaults = createDefaultCharacterJson();
  const rawJson = await loadJsonFile("characters", defaults);
  characterJson = normalizeCombatJson(rawJson, defaults, "name");
  ensureCharacterFactions();
}

async function saveCharacterJson() {
  await saveJsonFile("characters", characterJson);
  log("캐릭터 데이터가 저장되었습니다.");
}

function refreshCharacterUI() {
  renderCharacterTable();
  initCharacters();
  updateStatusUI();
}

const CHARACTER_TABLE_COLUMNS = [
  ['name', '이름'], ['role', '계열'], ['faction', '진영'],
  ['combatPower', '종합전투력'], ['hp', 'HP'], ['mp', 'MP'], ['st', 'ST'], ['atk', '공격력'], ['magic', '마력'],
  ['speed', '이동속도'], ['attackSpeed', '공격속도'], ['castSpeed', '시전속도'],
  ['defense', '방어력'], ['resistance', '저항력'], ['attackRange', '사정거리']
];
let characterTableSort = { key: '', direction: 'asc' };
const characterNameCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
let characterDeletePending = false;

function characterSortValue(character, key) {
  if (key === 'combatPower') return getCharacterCombatPower(character).total;
  if (key === 'name') return String(character.name ?? '');
  if (key === 'role' || key === 'faction') {
    const value = key === 'role' ? normalizeRole(character.role) : character.faction ?? getDefaultFactionName();
    return iconMappings.find(mapping => mapping.group === key && mapping.key === value)?.label
      || (key === 'role' ? getRoleLabel(value) : value);
  }
  const value = Number(character[key]);
  return Number.isFinite(value) ? value : 0;
}

function sortCharacterTable(key) {
  if (!CHARACTER_TABLE_COLUMNS.some(([column]) => column === key)) return;
  characterTableSort = { key, direction: characterTableSort.key === key && characterTableSort.direction === 'asc' ? 'desc' : 'asc' };
  renderCharacterTable();
}

function renderCharacterTable() {
  const header = document.getElementById('characterTableHeader');
  if (!header.children.length) {
    header.innerHTML = CHARACTER_TABLE_COLUMNS.map(([key, label]) => `<th scope="col" data-sort-key="${key}" onclick="sortCharacterTable('${key}')"><button type="button" class="character-sort-button" title="${label}: 클릭하여 정렬">${label}<span class="character-sort-direction" aria-hidden="true"></span></button></th>`).join('');
  }
  header.querySelectorAll('[data-sort-key]').forEach(th => {
    const active = th.dataset.sortKey === characterTableSort.key;
    th.setAttribute('aria-sort', active ? (characterTableSort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    th.querySelector('.character-sort-direction').textContent = active ? (characterTableSort.direction === 'asc' ? ' ↑' : ' ↓') : '';
  });
  const visibleCharacters = characterJson
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => selectedCharacterRoleFilter === "all" || normalizeRole(character.role) === selectedCharacterRoleFilter);

  if (characterTableSort.key) {
    const { key, direction } = characterTableSort;
    visibleCharacters.sort((a, b) => {
      const left = characterSortValue(a.character, key);
      const right = characterSortValue(b.character, key);
      const comparison = typeof left === 'number' ? left - right : characterNameCollator.compare(left, right);
      return comparison * (direction === 'asc' ? 1 : -1) || a.index - b.index;
    });
  }

  characterTableBodyEl.innerHTML = visibleCharacters.map(({ character, index }) => `
    <tr data-character-index="${index}" tabindex="0" aria-label="${escapeHtml(character.name)} 상세 열기" onclick="openCharacterModal(${index})" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCharacterModal(${index}); }">
      <td><div class="character-identity"><span class="character-portrait">${renderPortraitCell(character.portrait, character.name)}</span><span class="character-name">${escapeHtml(character.name)}</span></div></td>
      <td>${renderCategoryIcon("role", normalizeRole(character.role), getRoleLabel(character.role))}</td>
      <td>${renderCategoryIcon("faction", character.faction ?? getDefaultFactionName(), character.faction ?? getDefaultFactionName())}</td>
      <td data-cp="total" title="${COMBAT_POWER_TOOLTIP}">${formatCombatPower(getCharacterCombatPower(character).total)}</td>
      <td>${character.hp}</td>
      <td>${character.mp}</td>
      <td>${character.st}</td>
      <td>${character.atk}</td>
      <td>${character.magic}</td>
      <td>${character.speed}</td>
      <td>${character.attackSpeed}</td>
      <td>${character.castSpeed}</td>
      <td>${character.defense}</td>
      <td>${character.resistance}</td>
      <td>${character.attackRange}</td>
    </tr>
  `).join("") || '<tr><td colspan="15" class="character-empty">조건에 맞는 캐릭터가 없습니다.</td></tr>';
}

function changeCharacterRoleFilter(role) {
  selectedCharacterRoleFilter = role;
  renderCharacterTable();
}

function openCharacterModal(index = "") {
  if (characterDeletePending) return;
  const character = characterJson[index];

  characterModalTitleEl.innerText = character ? "캐릭터 상세" : "캐릭터 추가";
  characterEditIndexEl.value = character ? index : "";
  document.getElementById('characterDeleteButton').classList.toggle('hidden', !character);
  characterNameEl.value = character?.name ?? "";
  resetPortraitDraft("character", character?.portrait ?? "");
  resetPortraitAppearance(character?.appearance);
  characterRoleEl.value = character?.role ?? "melee";
  renderCharacterFactionOptions();
  characterFactionEl.value = character?.faction ?? getDefaultFactionName();
  characterChoiceSelections = structuredClone(character?.skillSelections ?? {});
  renderCharacterSkillPicker(character?.skillIds ?? []);
  renderCharacterCurrentDetails();
  renderCharacterIdentity();
  document.getElementById('characterPortraitEditor').classList.add('hidden');
  document.getElementById('characterClosePrompt').classList.add('hidden');
  characterModalBaseline = characterModalSnapshot();
  characterModalEl.classList.remove("hidden");
}

let characterModalBaseline = '';
let characterSavePending = false;

function characterModalSnapshot() {
  return JSON.stringify({name:characterNameEl.value,role:characterRoleEl.value,faction:characterFactionEl.value,
    skills:getCharacterSelectedSkillIds().sort(),choices:Object.entries(characterChoiceSelections).sort(),
    portrait:portraitDrafts.character,appearance:portraitAppearanceDraft,
    file:characterPortraitEl.files?.[0]?.name || ''});
}

function requestCloseCharacterModal() {
  if (characterDeletePending || characterSavePending) return;
  if (characterModalSnapshot() === characterModalBaseline) return closeCharacterModal();
  const prompt = document.getElementById('characterClosePrompt');
  prompt.classList.remove('hidden');
  prompt.scrollIntoView({block:'nearest'});
  prompt.querySelector('button').focus();
}

function requestCharacterPortraitEdit() {
  if (!confirm('클래스 초상화를 편집하시겠습니까?')) return;
  const editor = document.getElementById('characterPortraitEditor');
  editor.classList.remove('hidden');
  editor.scrollIntoView({block:'nearest'});
}

function renderCharacterIdentity() {
  const portrait = portraitDrafts.character?.dataUrl;
  const icon = portrait ? renderPortraitCell(portrait, characterNameEl.value) : '<span>초상화 없음</span>';
  document.getElementById('characterCardPortrait').innerHTML = icon;
  document.getElementById('characterCardNameIcon').innerHTML = portrait ? renderPortraitCell(portrait, characterNameEl.value) : '<span aria-hidden="true">♙</span>';
  document.getElementById('characterCardRoleIcon').innerHTML = renderCategoryIcon('role',characterRoleEl.value,getRoleLabel(characterRoleEl.value));
  document.getElementById('characterCardFactionIcon').innerHTML = renderCategoryIcon('faction',characterFactionEl.value,characterFactionEl.value);
}

function closeCharacterModal() {
  if (characterDeletePending || characterSavePending) return;
  if (typeof hideCharacterSkillValueTooltip === "function") hideCharacterSkillValueTooltip();
  characterModalEl.classList.add("hidden");
  characterFormEl.reset();
  resetPortraitDraft("character");
  resetPortraitAppearance();
}

async function saveCharacterFromForm(event) {
  event.preventDefault();
  if (characterDeletePending || characterSavePending) return;
  if (!characterFormEl.reportValidity()) return;
  characterSavePending = true;

  const editIndex = characterEditIndexEl.value;
  const previousCharacter = editIndex !== "" ? characterJson[Number(editIndex)] : null;
  const previousAttributes = previousCharacter?.attributes ?? {};
  const previousCharacters = [...characterJson];
  let saved = false;
  try {
  const character = applyCharacterStatAbilities({
    ...structuredClone(previousCharacter ?? {}),
    name: characterNameEl.value.trim(),
    role: characterRoleEl.value,
    entityGrade: 2,
    faction: characterFactionEl.value,
    skillIds: limitOptionalSkillIds(getCharacterSelectedSkillIds()),
    skillSelections: structuredClone(characterChoiceSelections),
    equipmentRules: structuredClone(previousCharacter?.equipmentRules ?? normalizeEquipmentRules()),
    battleRules: structuredClone(previousCharacter?.battleRules ?? normalizeBattleRules()),
    customResources: structuredClone(previousCharacter?.customResources ?? []),
    attributes: createCharacterAttributes(previousAttributes),
    equipment: previousCharacter?.equipment,
    equipmentSets: previousCharacter?.equipmentSets,
    activeEquipmentSet: previousCharacter?.activeEquipmentSet,
    portrait: await getPortraitForSave("character", previousCharacter?.portrait, characterNameEl.value.trim()),
    ...(portraitAppearanceDraft ? { appearance: { ...portraitAppearanceDraft } } : {})
  });

  if (!character.name || !character.faction || !ROLES.includes(character.role)) {
    alert("캐릭터 정보를 올바르게 입력해주세요.");
    return;
  }

  if (editIndex !== "") {
    characterJson[Number(editIndex)] = character;
  } else {
    characterJson.push(character);
  }

  playerSquad = [];
    await saveCharacterJson();
    saved = true;
    refreshCharacterUI();
    characterSavePending = false;
    closeCharacterModal();
  } catch (error) {
    if (!saved) characterJson = previousCharacters;
    logError("character", "캐릭터 저장 처리 중 실패했습니다.", error);
    alert("캐릭터 데이터를 저장하지 못했습니다.");
  } finally {
    characterSavePending = false;
  }
}

let characterSkillSelection = new Set();
let characterChoiceSelections = {};

function getCharacterSelectedSkillIds() {
  return [...characterSkillSelection];
}

function renderCharacterSkillBox(skill, label) {
  if (!skill) return `<div class="character-skill-box character-skill-vacant"><small>${label}</small><span class="character-skill-placeholder">－</span><span>미등록</span></div>`;
  if (skill.slot !== 'optional') {
    const choice = isChoiceSkill(skill);
    const tag = choice ? 'button' : 'div';
    return `<${tag} class="character-skill-box character-skill-fixed" data-skill-id="${escapeHtml(skill.id)}" ${choice ? 'type="button" aria-expanded="false" aria-controls="characterChoicePanel" onclick="openCharacterSkillChoice(this)"' : 'tabindex="0"'} onmouseenter="updateCharacterSkillDpsTooltip(this)" onmouseleave="hideCharacterSkillValueTooltip()" onfocus="updateCharacterSkillDpsTooltip(this)" onblur="hideCharacterSkillValueTooltip()"><small>${label}${choice ? ' · 선택형' : ''}</small>${recordImagePath(skill.icon) ? `<img src="${escapeHtml(skill.icon)}" alt="">` : `<span class="character-skill-placeholder">${escapeHtml(getSkillShortName(skill).slice(0,1))}</span>`}<strong>${escapeHtml(getSkillShortName(skill))}</strong>${choice ? `<small data-choice-label>${escapeHtml(getChoiceSkillOption(skill, characterChoiceSelections[skill.id],getCharacterSelectedSkillIds())?.label || '선택지 없음')}</small>` : ''}</${tag}>`;
  }
  return `<button type="button" class="character-skill-box" data-skill-id="${escapeHtml(skill.id)}" aria-pressed="${characterSkillSelection.has(skill.id)}" onclick="toggleCharacterSkill(this)" onmouseenter="updateCharacterSkillDpsTooltip(this)" onmouseleave="hideCharacterSkillValueTooltip()" onfocus="updateCharacterSkillDpsTooltip(this)" onblur="hideCharacterSkillValueTooltip()"><small>${label}</small>${recordImagePath(skill.icon) ? `<img src="${escapeHtml(skill.icon)}" alt="" onerror="this.hidden=true">` : `<span class="character-skill-placeholder">${escapeHtml(getSkillShortName(skill).slice(0,1))}</span>`}<strong>${escapeHtml(getSkillShortName(skill))}</strong></button>`;
}

function renderCharacterSkillPicker(selectedSkillIds = null) {
  if (!characterSkillsEl) return;
  characterSkillSelection = new Set(limitOptionalSkillIds(selectedSkillIds ?? getCharacterSelectedSkillIds()));
  const skills = getSkillsForClass(characterNameEl.value.trim());
  skills.filter(skill => skill.slot !== 'optional').forEach(skill => characterSkillSelection.add(skill.id));
  document.getElementById('characterChoicePanel').hidden = true;
  const passive = skills.filter(skill => skill.slot === 'passive' || isChoiceSkill(skill));
  const active = skills.filter(skill => skill.slot === 'active' || skill.slot === 'basic');
  const ultimate = active.find(skill => /궁극|ultimate/i.test(skill.name + ' ' + skill.id));
  const basics = active.filter(skill => skill !== ultimate);
  characterSkillsEl.innerHTML = `<div class="character-passive-slot">${passive.length ? passive.map(skill => renderCharacterSkillBox(skill, '패시브')).join('') : renderCharacterSkillBox(null,'패시브')}</div>`
    + Array.from({length:4}, (_,i) => renderCharacterSkillBox(basics[i], `기본 ${i+1}`)).join('')
    + renderCharacterSkillBox(ultimate, '궁극기');
  const optional = skills.filter(skill => skill.slot === 'optional');
  document.getElementById('characterSelectedSkills').innerHTML = Array.from({length:6}, (_,i) => renderCharacterSkillBox(optional[i], `선택 ${i+1}`)).join('');
  renderCharacterSelectedSkills();
}

function toggleCharacterSkill(button) {
  const id = button.dataset.skillId;
  if (getSkillById(id)?.slot !== 'optional') return;
  if (characterSkillSelection.has(id)) characterSkillSelection.delete(id);
  else {
    if (getSkillById(id)?.slot === 'optional' && getCharacterSelectedSkillIds().filter(value => getSkillById(value)?.slot === 'optional').length >= 3) {
      alert('선택 강화는 최대 3개까지 선택할 수 있습니다.');
      return;
    }
    characterSkillSelection.add(id);
  }
  for (const skill of getCharacterSelectedSkillIds().map(getSkillById).filter(isChoiceSkill)) {
    const option=getChoiceSkillOption(skill,characterChoiceSelections[skill.id],getCharacterSelectedSkillIds());
    if (option) characterChoiceSelections[skill.id]=option.id;
    const label=characterSkillsEl.querySelector(`[data-skill-id="${skill.id}"] [data-choice-label]`);
    if (label) label.textContent=option?.label ?? "";
  }
  const panel=document.getElementById('characterChoicePanel');
  if (!panel.hidden) { panel.hidden=true;const source=characterSkillsEl.querySelector(`[data-skill-id="${panel.dataset.skillId}"]`);if(source)openCharacterSkillChoice(source); }
  renderCharacterSelectedSkills();
  renderCharacterCurrentDetails();
  updateCharacterSkillDpsTooltip(button);
}

function renderCharacterSelectedSkills() {
  document.querySelectorAll('#characterSelectedSkills button[data-skill-id]').forEach(button => {
    button.setAttribute('aria-pressed', String(characterSkillSelection.has(button.dataset.skillId)));
  });
  document.getElementById('characterOptionalCount').textContent = `선택 강화 ${getCharacterSelectedSkillIds().filter(id => getSkillById(id)?.slot === 'optional').length}/3`;
}

function openCharacterSkillChoice(button) {
  const panel = document.getElementById('characterChoicePanel');
  const close = !panel.hidden && panel.dataset.skillId === button.dataset.skillId;
  characterSkillsEl.querySelectorAll('[aria-expanded]').forEach(el => el.setAttribute('aria-expanded', 'false'));
  panel.hidden = close;
  if (close) return;
  const skill = getSkillById(button.dataset.skillId);
  if (!isChoiceSkill(skill)) return;
  panel.dataset.skillId = skill.id;
  button.setAttribute('aria-expanded', 'true');
  const selected = getChoiceSkillOption(skill, characterChoiceSelections[skill.id],getCharacterSelectedSkillIds());
  panel.innerHTML = `<h5>${escapeHtml(getSkillShortName(skill))} · 유형 선택</h5><div class="character-choice-options">${getAvailableSkillChoice(skill,getCharacterSelectedSkillIds()).options.map(option => {
    const target = getSkillById(option.skillId);
    return `<button type="button" class="character-skill-box" data-option-id="${escapeHtml(option.id)}" aria-pressed="${selected?.id === option.id}" onclick="selectCharacterSkillChoice(this)">${recordImagePath(target?.icon) ? `<img src="${escapeHtml(target.icon)}" alt="">` : ''}<strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(target?.description || '')}</small></button>`;
  }).join('') || '<p>등록된 선택지가 없습니다.</p>'}</div>`;
  panel.scrollIntoView({block:'nearest'});
}

function selectCharacterSkillChoice(button) {
  const panel = document.getElementById('characterChoicePanel');
  characterChoiceSelections[panel.dataset.skillId] = button.dataset.optionId;
  panel.querySelectorAll('[data-option-id]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
  const source = [...characterSkillsEl.querySelectorAll('[data-skill-id]')].find(el => el.dataset.skillId === panel.dataset.skillId);
  source.querySelector('[data-choice-label]').textContent = getChoiceSkillOption(getSkillById(panel.dataset.skillId), button.dataset.optionId,getCharacterSelectedSkillIds()).label;
  renderCharacterCurrentDetails();
}

function renderCharacterCurrentDetails() {
  const saved = characterEditIndexEl.value !== '' ? characterJson[Number(characterEditIndexEl.value)] : {};
  const character = applyCharacterStatAbilities({...structuredClone(saved), name: characterNameEl.value.trim(), role: characterRoleEl.value,
    skillIds: getCharacterSelectedSkillIds(), skillSelections: structuredClone(characterChoiceSelections)});
  const stats = [['hp','HP'],['mp','MP'],['st','ST'],['atk','공격력'],['magic','마력'],['defense','방어력'],['resistance','저항력'],['attackSpeed','공격속도'],['speed','이동속도']];
  document.getElementById('characterCurrentStats').innerHTML = stats.map(([key,label]) => `<div><span>${label}</span><strong>${Number(Number(character[key] || 0).toFixed(2))}</strong></div>`).join('');
  document.getElementById('characterCurrentEquipment').innerHTML = getCharacterEquipmentSlots(character).map(slot => {
    const item = getItemById(character.equipment?.[slot.key]);
    return `<div><span>${escapeHtml(slot.label)}</span><strong class="character-equipped-item">${item ? equipmentItemIcon(item,slot.key) : ''}${escapeHtml(item?.name || '미착용')}</strong></div>`;
  }).join('');
}

function refreshCharacterSkillPicker(selectAll = false) {
  if (selectAll) characterChoiceSelections = {};
  const classSkills = typeof getSkillsForClass === "function" ? getSkillsForClass(characterNameEl.value.trim()) : [];
  renderCharacterSkillPicker(selectAll ? classSkills.filter(skill=>skill.slot !== "optional").map(skill => skill.id) : null);
  renderCharacterCurrentDetails();
}

async function deleteCharacterFromModal() {
  if (characterDeletePending || characterEditIndexEl.value === '') return;
  const index = Number(characterEditIndexEl.value);
  const character = characterJson[index];
  if (!character || !window.confirm(`"${character.name}" 캐릭터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  const deletedIndexes = [index];
  const previousCharacters = [...characterJson];
  const previousTeams = teamsJson;
  const previousTeamSelection = selectedTeamMemberIds;
  let characterSaved = false;
  characterDeletePending = true;
  characterFormEl.querySelectorAll('.character-modal-actions button').forEach(button => { button.disabled = true; });

  characterJson.splice(index, 1);
  playerSquad = [];
  enemySquad = [];
  selectedEnemyTeamIndex = "";
  duelCharacterIds = {player:[],enemy:[]};
  duelSkillChoices = {player:{},enemy:{}};
  selectedBattleCharacterIds.clear();
  selectedBattleTeamIds.clear();
  if (typeof syncTeamsAfterCharacterDeletion === "function") {
    syncTeamsAfterCharacterDeletion(deletedIndexes);
  }
  try {
    await saveCharacterJson();
    characterSaved = true;
    if (typeof saveTeamJson === "function") {
      await saveTeamJson();
    }
  } catch (error) {
    if (!characterSaved) {
      characterJson = previousCharacters;
      teamsJson = previousTeams;
      selectedTeamMemberIds = previousTeamSelection;
    }
    logError("character", "캐릭터 삭제 처리 중 실패했습니다.", error);
    alert(characterSaved ? "캐릭터는 삭제됐지만 팀 편성 저장에 실패했습니다. 팀 편성을 확인하고 다시 저장해주세요." : "캐릭터 데이터를 저장하지 못했습니다. 다시 시도해주세요.");
  } finally {
    characterDeletePending = false;
    characterFormEl.querySelectorAll('.character-modal-actions button').forEach(button => { button.disabled = false; });
    if (characterSaved) {
      refreshCharacterUI();
      if (typeof renderBattleTeamButtons === 'function') {
        renderBattleTeamButtons();
        renderBattleEnemyControls();
      }
      closeCharacterModal();
    }
  }
}

function createCharacter(characterData, index, side = "player", synergyModifiers = null) {
  const originalData = characterData;
  if (synergyModifiers) characterData = {...characterData, runtimeSynergyModifiers:synergyModifiers};
  const derivedCharacter = applyCharacterStatAbilities(characterData);
  const unequippedCharacter = applyCharacterStatAbilities({...characterData,equipment:{}});
  const equipmentLoadouts = normalizeEquipmentSets(derivedCharacter).map(set => {
    const equipped = applyCharacterStatAbilities({...derivedCharacter,equipment:set.equipment});
    const weapon = getEquippedWeaponItemForCombat(equipped);
    return {name:set.name,attributes:getCharacterEffectiveAttributes(equipped),itemSkillModifiers:getCharacterItemSkillModifiers(equipped),maxHp:equipped.hp,maxMp:equipped.mp,maxSt:equipped.st,baseBp:Math.max(0,Number(equipped.bp)||0),
      atk:equipped.atk,magic:equipped.magic,speed:equipped.speed,attackSpeed:equipped.attackSpeed,castSpeed:equipped.castSpeed,armorCategory:getCharacterArmorCategory(equipped),
      defense:equipped.defense,resistance:equipped.resistance,attackRange:equipped.attackRange,attackType:equipped.attackType,
      attackSkillId:weapon?.attackSkillId ?? "",weaponAttacks:getCharacterWeaponAttacks(equipped),
      sameTargetWeaponPenaltyPercent:equipped.equipmentRules.sameTargetWeaponPenaltyPercent,
      withoutEquipment:{name:`${set.name} (장비 효과 무효)`,attributes:getCharacterEffectiveAttributes(unequippedCharacter),itemSkillModifiers:[],maxHp:unequippedCharacter.hp,maxMp:unequippedCharacter.mp,maxSt:unequippedCharacter.st,baseBp:Math.max(0,Number(unequippedCharacter.bp)||0),
        atk:unequippedCharacter.atk,magic:unequippedCharacter.magic,speed:unequippedCharacter.speed,attackSpeed:unequippedCharacter.attackSpeed,castSpeed:unequippedCharacter.castSpeed,
        defense:unequippedCharacter.defense,resistance:unequippedCharacter.resistance,attackRange:unequippedCharacter.attackRange,attackType:unequippedCharacter.attackType,
        attackSkillId:"",weaponAttacks:[],sameTargetWeaponPenaltyPercent:0}};
  });
  if (synergyModifiers && Object.keys(synergyModifiers).length) {
    const plain = createCharacter(originalData, index, side);
    equipmentLoadouts.forEach((loadout, i) => { loadout.withoutSynergy = plain.equipmentLoadouts[i]; });
  }
  const equippedWeapon = getEquippedWeaponItemForCombat(derivedCharacter);
  const role = derivedCharacter.role;
  const fieldWidth = canvas.width || 400;
  const fieldHeight = canvas.height || 300;
  const x = side === "enemy"
    ? fieldWidth * (0.7 + Math.random() * 0.25)
    : fieldWidth * (Math.random() * 0.3);

  return {
    id: index,
    side,
    role,
    name: derivedCharacter.name,
    entityGrade:derivedCharacter.entityGrade ?? 2,
    hp: derivedCharacter.hp,
    maxHp: derivedCharacter.hp,
    mp: derivedCharacter.mp,
    maxMp: derivedCharacter.mp,
    st: derivedCharacter.st,
    maxSt: derivedCharacter.st,
    bp: Math.max(0, Number(derivedCharacter.bp) || 0),
    baseBp: Math.max(0, Number(derivedCharacter.bp) || 0),
    maxBp: Math.max(0, Number(derivedCharacter.bp) || 0),
    customResources: createBattleCustomResources(derivedCharacter.customResources),
    battleRules: normalizeBattleRules(derivedCharacter.battleRules),
    atk: derivedCharacter.atk,
    magic: derivedCharacter.magic,
    speed: derivedCharacter.speed,
    attackSpeed: derivedCharacter.attackSpeed,
    castSpeed: derivedCharacter.castSpeed,
    attackType: derivedCharacter.attackType,
    armorCategory:getCharacterArmorCategory(derivedCharacter),
    attackSkillId: equippedWeapon?.attackSkillId ?? "",
    weaponAttacks: getCharacterWeaponAttacks(derivedCharacter),
    sameTargetWeaponPenaltyPercent: derivedCharacter.equipmentRules.sameTargetWeaponPenaltyPercent,
    equipmentLoadouts,
    activeEquipmentSet: derivedCharacter.activeEquipmentSet ?? 0,
    skillIds: Array.isArray(derivedCharacter.skillIds) ? derivedCharacter.skillIds : [],
    skillSelections: structuredClone(derivedCharacter.skillSelections ?? {}),
    skillCooldowns: {},
    defense: derivedCharacter.defense,
    resistance: derivedCharacter.resistance,
    attackRange: derivedCharacter.attackRange,
    attributes: getCharacterEffectiveAttributes(derivedCharacter),
    itemSkillModifiers: getCharacterItemSkillModifiers(derivedCharacter),
    faction: derivedCharacter.faction ?? getDefaultFactionName(),
    portrait: derivedCharacter.portrait,
    x,
    y: Math.random() * fieldHeight,
    vx: 0,
    vy: 0,
    attackCooldown: 0,
    alive: true,
    stats: createStats(),
    effectType: null,
    effectTimer: 0
  };
}

function renderBattleCharacterButtonContent(character) {
  const portrait = normalizePortrait(character.portrait)
    ? renderPortraitCell(character.portrait, character.name)
    : `<span class="skill-class-placeholder">${escapeHtml(character.name?.slice(0,1) || '?')}</span>`;
  return `<span class="duel-class-icon">${portrait}</span>${renderCategoryIcon('role',normalizeRole(character.role),getRoleLabel(character.role))}<span class="duel-character-name">${escapeHtml(character.name)}</span>`;
}

function initCharacters() {
  charactersEl.innerHTML = "";
  allCharacters = [];

  characterJson.forEach((characterData, index) => {
    const character = createCharacter(characterData, index);
    const button = document.createElement("button");

    allCharacters.push(character);
    button.type = 'button';
    button.className = 'duel-character-button';
    button.innerHTML = renderBattleCharacterButtonContent(characterData);
    button.setAttribute('aria-pressed', String(selectedBattleCharacterIds.has(character.id)));
    button.onclick = () => toggleSelect(character.id);
    button.style.background = selectedBattleCharacterIds.has(character.id) ? "lightblue" : "";

    charactersEl.appendChild(button);
  });
}

function toggleSelect(characterId) {
  if (battleMode === 'duel') { selectDuelCharacter('player',characterId); return; }
  if (selectedBattleCharacterIds.has(characterId)) {
    selectedBattleCharacterIds.delete(characterId);
  } else {
    const nextIds = getSelectedBattleCharacterIds();
    if (!nextIds.includes(characterId) && nextIds.length >= MAX_PLAYER_SQUAD) {
      alert(`아군은 최대 ${MAX_PLAYER_SQUAD}명까지 선택할 수 있습니다.`);
      return;
    }
    selectedBattleCharacterIds.add(characterId);
  }

  rebuildPlayerSquadFromSelection();
  initCharacters();
  renderBattleSelectionSummary();
  updateStatusUI();
}
