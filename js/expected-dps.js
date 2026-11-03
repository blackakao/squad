// Read-only build estimates: no battle execution, RNG, saved fields, or live team rules.
const EXPECTED_DPS_BASIS = '단일 대상 · 방어/저항 0 · 자원 충분 · 이동/투사체 시간·패시브 추가 발동·팀 시너지 제외';

function createDpsPreviewUnit(character) {
  const build = applyCharacterStatAbilities({...structuredClone(character), runtimeSynergyModifiers:{}});
  const unit={...build, side:'preview', alive:true, exhausted:false,
    attributes:getCharacterEffectiveAttributes(build), itemSkillModifiers:getCharacterItemSkillModifiers(build),
    maxHp:build.hp, maxMp:build.mp, maxSt:build.st, maxBp:build.bp,
    customResources:createBattleCustomResources(build.customResources), skillSelections:{},
    activeEffects:[], runtimeRuleOverrides:[]};
  applyPassiveStatConversion(unit);
  return unit;
}

function resolvePreviewSkill(unit, originalSkill) {
  let base=originalSkill;
  const visited=new Set();
  while (isChoiceSkill(base)) {
    if (visited.has(base.id)) return null;
    visited.add(base.id);
    base=getSkillById(getChoiceSkillOption(base)?.skillId);
    if (!base) return null;
  }
  return getRuntimeSelectionSkill(unit,getRuntimeItemSkill(unit,base));
}

function estimateSkillDps(character, originalSkill, weapon = null) {
  if (!character || !originalSkill) return null;
  const unit = createDpsPreviewUnit(character);
  const skill = weapon ? getRuntimeItemSkill(unit,originalSkill) : resolvePreviewSkill(unit,originalSkill);
  if (!skill) return null;
  const combo = normalizeSkillCombo(skill.combo);
  const stages = combo ? combo.stages.map((_,index)=>getRuntimeComboSkill({...unit,skillComboStages:{[skill.id]:index}},skill)) : [skill];
  const actions = stages.flatMap(stage=>stage.actions || []);
  const hasDamage = actions.some(action=>action.type==='deal_damage' || action.fieldEffect==='deal_damage' && action.type==='create_field' || action.effect?.periodic?.type==='damage');
  if (!hasDamage) return null;
  const unavailable = reason => ({dps:null, reason});
  if (skill.slot === 'passive') return unavailable('패시브 발동 빈도에 따라 달라집니다.');
  if (actions.some(action=>action.type==='create_field' || action.effect?.periodic?.type==='damage')) return unavailable('지속 피해의 유지·중첩 조건에 따라 달라집니다.');
  if (actions.some(action=>['transform','swap_equipment_set','override_rule','add_buff','add_state','apply_next_skill_modifier'].includes(action.type))) return unavailable('전투 중 능력치·효과 변화에 따라 달라집니다.');
  const sourceFields = new Set(['hp','mp','st','bp','atk','magic','defense','resistance',...CHARACTER_STAT_DEFS.map(row=>row.key)]);
  const damageActions=actions.filter(action=>action.type==='deal_damage');
  if (damageActions.some(action=>action.requiredTargetEffectId || action.targetHpBelow < 100 || action.targetCooldown > 0 ||
    action.ownedSummonEntityId && action.ownedSummonCondition !== 'any' ||
    action.coefficients.some(c=>c.type!=='fixed' && !sourceFields.has(c.field)))) return unavailable('대상 상태·전투 누적값·조건에 따라 달라집니다.');
  const channel=normalizeSkillChannel(skill.channel);
  if (weapon && (combo || channel.duration>0)) return unavailable('무기 연계·채널링은 전투 실행 조건이 필요합니다.');
  let damage=0, ticks=0;
  for (const stage of stages) {
    const castTicks=weapon?.independent ? Math.round(weapon.castSpeed*BASE_ATTACK_COOLDOWN)
      : skill.castTime == null ? getCastDuration(unit) : Math.round(skill.castTime*BASE_ATTACK_COOLDOWN);
    const channelTicks=channel.duration>0 ? Math.max(1,Math.ceil(channel.duration*BASE_ATTACK_COOLDOWN)) : 0;
    const pulses=channelTicks ? Math.floor(channelTicks/Math.max(1,Math.ceil(channel.interval*BASE_ATTACK_COOLDOWN))) : 1;
    damage += stage.actions.filter(action=>action.type==='deal_damage').reduce((sum,action)=>sum+Math.max(0,getActionCoefficientValue(action,unit)),0)*pulses;
    const cycle = weapon ? Math.max(castTicks,weapon.independent ? Math.round(weapon.attackSpeed*BASE_ATTACK_COOLDOWN) : getAttackCooldown(unit))
      : skill.slot==='basic' ? channelTicks ? castTicks+channelTicks+getAttackCooldown(unit) : Math.max(castTicks,getAttackCooldown(unit))
      : castTicks+channelTicks+getResolvedSkillCooldownTicks(stage,unit);
    ticks += Math.max(1,cycle);
  }
  const dps=damage/(ticks/BASE_ATTACK_COOLDOWN);
  return Number.isFinite(dps) ? {dps,damage,seconds:ticks/BASE_ATTACK_COOLDOWN,reason:''} : unavailable('계산에 필요한 수치를 확인해주세요.');
}

function formatExpectedDps(result) {
  if (!result) return '';
  return result.dps == null ? `기대 DPS: 산출 불가 (${result.reason})` : `기대 DPS: ${result.dps.toLocaleString('ko-KR',{maximumFractionDigits:1})}`;
}

function formatCurrentSkillAmount(value) {
  return Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2});
}

function getCurrentSkillValueRows(character,originalSkill) {
  if (!character || !originalSkill) return [];
  const unit=createDpsPreviewUnit(character);
  const skill=resolvePreviewSkill(unit,originalSkill);
  if (!skill) return [];
  const sourceFields=new Set(['hp','mp','st','bp','atk','magic','defense','resistance',...CHARACTER_STAT_DEFS.map(row=>row.key)]);
  const previewable=coefficient=>coefficient.type==='fixed' || sourceFields.has(coefficient.field);
  const combo=normalizeSkillCombo(skill.combo);
  const stages=combo ? combo.stages.map((stage,index)=>({name:stage.name || `${index+1}연계`,actions:stage.actions})) : [{name:'',actions:skill.actions ?? []}];
  const rows=[];
  const append=(label,type,coefficients,interval=0)=>{
    const normalized=(coefficients ?? []).map(normalizeCoefficient);
    if (!normalized.length) return;
    const coefficient=normalized.map(formatCoefficientSummary).join(' + ');
    const value=normalized.every(previewable) ? normalized.reduce((sum,row)=>sum+getCoefficientValue(row,unit),0) : null;
    rows.push({label,type,coefficient,value,interval});
  };
  for (const stage of stages) for (const [index,action] of stage.actions.entries()) {
    const label=[stage.name,stage.actions.length>1 ? `액션 ${index+1}` : ''].filter(Boolean).join(' · ') || '스킬';
    const type=action.type==='create_field' ? action.fieldEffect : action.type;
    if (type==='deal_damage') append(label,'damage',action.coefficients,action.type==='create_field' ? action.fieldInterval : 0);
    if (type==='heal') append(label,'heal',action.coefficients,action.type==='create_field' ? action.fieldInterval : 0);
    const periodic=action.effect?.periodic;
    if (periodic && ['damage','heal'].includes(periodic.type)) append(`${label} · ${action.effect.name || '주기 효과'}`,periodic.type,[periodic.coefficient ?? {type:'fixed',value:periodic.value}],periodic.interval);
  }
  return {skill,unit,rows};
}

function formatCurrentSkillValueTooltip(character,skill) {
  const preview=getCurrentSkillValueRows(character,skill);
  if (!preview?.skill) return '';
  const lines=[preview.skill.name,`현재 장비 반영 · 공격력 ${formatCurrentSkillAmount(preview.unit.atk)} · 마력 ${formatCurrentSkillAmount(preview.unit.magic)}`];
  if (!preview.rows.length) lines.push('피해·회복 계수 없음');
  for (const row of preview.rows) {
    lines.push(`${row.label} · 계수: ${row.coefficient}`);
    const typeLabel=row.type==='damage' ? '예상 피해' : '예상 회복';
    const interval=row.interval>0 ? ` · 주기 ${row.interval}초` : '';
    lines.push(`${typeLabel}${interval}: ${row.value == null ? '상황 의존' : `${formatCurrentSkillAmount(row.value)} (대상 보정 전)`}`);
  }
  const dps=formatExpectedDps(estimateSkillDps(character,skill));
  if (dps) lines.push(dps);
  lines.push(EXPECTED_DPS_BASIS,'현재 스탯·장비 / 선택 스킬은 기본 선택지 기준');
  return lines.join('\n');
}

function getWeaponDpsPreviews(character,item) {
  if (!character || !isWeaponItem(item)) return [];
  return getCharacterEquipmentSlots(character).filter(slot=>canEquipItemToSlot(item,slot.key,character)).map(slot=>{
    const draft=structuredClone(character);
    draft.equipment=createEquipmentSlots(draft.equipment,draft);
    equipItemToSlot(draft.equipment,item,slot.key,draft);
    const weapon=getCharacterWeaponAttacks(draft).find(entry=>entry.slot===slot.key && entry.itemId===item.id)
      || getCharacterWeaponAttacks(draft).find(entry=>entry.itemId===item.id);
    if (!weapon) return {label:slot.label,result:null};
    const assigned=getSkillById(weapon.attackSkillId);
    const skill=isSkillExecutable(assigned) && assigned.slot!=='passive' ? assigned
      : createDefaultAttackSkillForUnit({...createDpsPreviewUnit(draft),attackType:weapon.attackType,attackSkillId:''});
    return {label:slot.label,result:estimateSkillDps(draft,skill,{...weapon,independent:getCharacterWeaponAttacks(draft).length>1})};
  });
}

function renderWeaponDpsPreview(character,item) {
  if (!isWeaponItem(item)) return '';
  if (!character) return '<p>기대 DPS: 캐릭터를 선택하세요.</p>';
  const rows=getWeaponDpsPreviews(character,item);
  return `<div class="equipment-dps-preview">${rows.map(row=>`<div>${escapeHtml(row.label)} 장착 시 · ${escapeHtml(formatExpectedDps(row.result) || '피해 없는 무기 스킬')}</div>`).join('') || '장착 가능한 슬롯이 없습니다.'}<small>선택 무기의 단독 공격 기준 · 다른 무기의 동시 공격·집중 감산 제외<br>${escapeHtml(EXPECTED_DPS_BASIS)}</small></div>`;
}

function updateCharacterSkillDpsTooltip(label) {
  const saved=characterEditIndexEl.value!=='' ? characterJson[Number(characterEditIndexEl.value)] : null;
  const draft={...structuredClone(saved || {}),name:characterNameEl.value.trim(),role:characterRoleEl.value,
    skillIds:[...characterSkillsEl.querySelectorAll('input:checked')].map(input=>input.value),
    equipmentRules:normalizeEquipmentRules({extraWeaponSlots:characterExtraWeaponSlotsEl.value,twoHandSingleSlot:characterTwoHandSingleSlotEl.checked,sameTargetWeaponPenaltyPercent:characterSameTargetWeaponPenaltyEl.value})};
  const skill=getSkillById(label.dataset.skillId);
  const text=formatCurrentSkillValueTooltip(draft,skill);
  label.dataset.tooltip=text;
  showCharacterSkillValueTooltip(label);
}

let characterSkillValueTooltipEl=null;

function showCharacterSkillValueTooltip(label) {
  const text=label?.dataset?.tooltip;
  if (!text) return;
  characterSkillValueTooltipEl ??= Object.assign(document.createElement('div'),{className:'character-skill-value-tooltip',hidden:true});
  if (!characterSkillValueTooltipEl.isConnected) document.body.appendChild(characterSkillValueTooltipEl);
  characterSkillValueTooltipEl.textContent=text;
  characterSkillValueTooltipEl.hidden=false;
  const rect=label.getBoundingClientRect();
  const left=Math.min(window.innerWidth-characterSkillValueTooltipEl.offsetWidth-8,Math.max(8,rect.right+8));
  const top=Math.min(window.innerHeight-characterSkillValueTooltipEl.offsetHeight-8,Math.max(8,rect.top));
  characterSkillValueTooltipEl.style.left=`${left}px`;
  characterSkillValueTooltipEl.style.top=`${top}px`;
}

function hideCharacterSkillValueTooltip() {
  if (characterSkillValueTooltipEl) characterSkillValueTooltipEl.hidden=true;
}
