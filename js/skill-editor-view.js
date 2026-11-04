// Browser-only skill editor presentation helpers.
// Loaded after skill.js; not needed by headless battle simulation.
function renderSkillClassIdentity(skill) {
  const className = inferSkillClassName(skill) || "미지정";
  const character = Array.isArray(characterJson) ? characterJson.find(item => String(item?.name ?? "").trim() === className) : null;
  const icon = character?.portrait ? renderPortraitCell(character.portrait, className) : `<span class="skill-class-placeholder">${escapeHtml(className === "공용" ? "공" : className.slice(0, 1) || "?")}</span>`;
  return `<span class="skill-class-identity">${icon}<span>${escapeHtml(className)}</span></span>`;
}

function formatSkillValueSummary(skill) {
  if (isChoiceSkill(skill)) {
    const choice = normalizeSkillChoice(skill.choice);
    const selected = getChoiceSkillOption(skill);
    return `<span class="skill-value-summary"><span><strong>선택지</strong> ${choice.options.length}개</span><span><strong>기본</strong> ${escapeHtml(selected?.label ?? "미설정")}</span></span>`;
  }
  const costs = formatResourceCostsSummary(skill.resourceCosts ?? normalizeSkillResourceCosts(skill)) || "소모 없음";
  const coefficients = (skill.actions ?? []).flatMap(action => action.coefficients ?? []).map(formatCoefficientSummary);
  const coefficientText = coefficients.length ? [...new Set(coefficients)].slice(0, 3).join(" + ") + (coefficients.length > 3 ? ` 외 ${coefficients.length - 3}개` : "") : "계수 없음";
  const castTime = skill.castTime == null ? "유닛 기준" : Number(skill.castTime) === 0 ? "즉시" : `${skill.castTime}초`;
  const combo=normalizeSkillCombo(skill.combo);
  const cooldownText=combo ? `연계 ${combo.stepCooldown}초 · 전체 ${skill.cooldown ?? 0}초` : `${skill.cooldown ?? 0}초`;
  return `<span class="skill-value-summary"><span><strong>소모</strong> ${escapeHtml(costs)}</span><span><strong>계수</strong> ${escapeHtml(coefficientText)}</span><span><strong>대기</strong> ${escapeHtml(cooldownText)} · <strong>시전</strong> ${escapeHtml(castTime)}</span></span>`;
}


// Skill management page, modal, and choice form UI.
function renderSkillPage() {
  if (!skillTableBodyEl) {
    return;
  }

  const classFilter = document.getElementById("skillClassFilter");
  const selectedClass = classFilter?.value ?? "all";
  if (classFilter) {
    const options = ["all", ...getSkillClassNames()];
    classFilter.innerHTML = options.map(value => `<option value="${escapeHtml(value)}" ${value === selectedClass ? "selected" : ""}>${value === "all" ? "전체 클래스" : escapeHtml(value)}</option>`).join("");
  }
  const query = String(document.getElementById("skillSearch")?.value ?? "").trim().toLocaleLowerCase("ko");
  const slotFilter = document.getElementById("skillSlotFilter")?.value ?? "all";
  const rows = skillsJson.map((skill, index) => ({ skill, index })).filter(({skill}) =>
    !skill.selectionModifier
    && (selectedClass === "all" || inferSkillClassName(skill) === selectedClass)
    && (slotFilter === "all" || skill.slot === slotFilter)
    && (!query || `${skill.name} ${getSkillDescription(skill)}`.toLocaleLowerCase("ko").includes(query)));
  skillTableBodyEl.innerHTML = rows.map(({skill, index}) => `
    <tr class="skill-table-row" tabindex="0" role="button" aria-label="${escapeHtml(skill.name)} 수정" onclick="openSkillModal(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSkillModal(${index});}">
      <td>${renderRecordImageName(skill)}</td>
      <td>${renderSkillClassIdentity(skill)}</td>
      <td>${renderCategoryIcon("skill", skill.slot, getSkillSlotLabel(skill.slot))}</td>
      <td>${formatSkillValueSummary(skill)}</td>
      <td class="skill-description" title="${escapeHtml(getSkillDescription(skill))}">${escapeHtml(summarizeSkillDescription(skill))}
        ${!isSkillExecutable(skill) ? `<div class="skill-support-warning">전투 사용 불가 · ${skill.slot === "passive" && !isPassiveTriggerConfigured(skill) ? "패시브 조건 설정 필요" : `미지원: ${escapeHtml(getUnsupportedActionNames(skill).join(", "))}`}</div>` : ""}
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="empty-text">조건에 맞는 스킬이 없습니다.</td></tr>';
}

let skillFormInitialState = "";

function captureSkillFormState() {
  const fields = [...skillFormEl.querySelectorAll("input, select, textarea")].map((field, index) => ({
    key: field.id || field.name || `${field.tagName}:${index}`,
    type: field.type,
    value: field.value,
    checked: field.checked,
    selected: field instanceof HTMLSelectElement && field.multiple ? [...field.selectedOptions].map(option => option.value) : undefined
  }));
  return JSON.stringify({ fields, icon: getRecordImageSelection("skills") });
}

function isSkillFormDirty() {
  return !skillModalEl.classList.contains("hidden") && Boolean(skillFormInitialState) && captureSkillFormState() !== skillFormInitialState;
}

function openSkillModal(index = "") {
  const skill = skillsJson[index];
  skillModalTitleEl.innerText = skill ? "스킬 수정" : "스킬 추가";
  skillEditIndexEl.value = skill ? index : "";
  skillNameEl.value = skill?.name ?? "";
  const classNames = getAssignableSkillClassNames();
  const selectedClass = inferSkillClassName(skill) || "공용";
  skillClassNameEl.innerHTML = [...new Set(["공용", ...classNames, selectedClass])].map(className => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`).join("");
  skillClassNameEl.value = selectedClass;
  openRecordImageEditor('skills', skill?.icon);
  skillDescriptionEl.value = skill?.description ?? "";
  skillSlotEl.value = skill?.slot ?? "active";
  skillCooldownEl.value = skill?.cooldown ?? 0;
  const combo=normalizeSkillCombo(skill?.combo);
  skillComboCooldownEl.value=combo?.stepCooldown ?? 0.5;
  skillComboCooldownFieldEl.classList.toggle("hidden",!combo);
  skillCastTimeEl.value = skill?.castTime ?? "";
  skillCastReceivedDamagePercentEl.value = skill?.castReceivedDamagePercent ?? 100;
  renderPassiveTriggerForm(skill);
  renderSkillChoiceOptions(skill?.choice);
  renderSkillChannelForm(skill);
  const channelDisclosure = document.getElementById("skillChannelDisclosure");
  if (channelDisclosure) channelDisclosure.open = Number(skill?.channel?.duration ?? 0) > 0;
  renderSkillResourceCostsToForm(skill?.resourceCosts ?? normalizeSkillResourceCosts(skill));
  renderSkillActionRows(skill?.actions ?? [createDefaultAction()]);
  skillDeleteButtonEl?.classList.toggle("hidden", !skill || isDefaultSkill(skill.id));
  skillModalEl.classList.remove("hidden");
  skillFormInitialState = captureSkillFormState();
}

function getChoiceTargetSkillOptions(selected = "") {
  const editingId = skillEditIndexEl.value !== "" ? skillsJson[Number(skillEditIndexEl.value)]?.id : "";
  return skillsJson.filter(skill => skill.id !== editingId && !isChoiceSkill(skill) && (isSkillExecutable(skill) || skill.selectionModifier))
    .map(skill => `<option value="${escapeHtml(skill.id)}" ${skill.id === selected ? "selected" : ""}>${escapeHtml(skill.name)} (${escapeHtml(getSkillSlotLabel(skill.slot))})</option>`).join("");
}

function renderSkillChoiceOptions(choice = {}) {
  const normalized = normalizeSkillChoice(choice);
  const rows = normalized.options.length ? normalized.options : [{id:"option_1",label:"선택지 1",skillId:""}];
  document.getElementById("skillChoiceOptions").innerHTML = rows.map((option, index) => `
    <div class="skill-choice-option-row">
      <label><input type="radio" name="skillChoiceDefault" value="${escapeHtml(option.id)}" ${option.id === normalized.defaultOptionId || (!normalized.defaultOptionId && index === 0) ? "checked" : ""}> 기본</label>
      <input class="skill-choice-label" value="${escapeHtml(option.label)}" placeholder="선택지 이름">
      <select class="skill-choice-skill"><option value="">적용 스킬 선택</option>${getChoiceTargetSkillOptions(option.skillId)}</select>
      <button type="button" onclick="this.closest('.skill-choice-option-row').remove()">삭제</button>
      <input class="skill-choice-id" type="hidden" value="${escapeHtml(option.id)}">
    </div>`).join("");
  updateSkillTypeFields();
}

function addSkillChoiceOptionRow() {
  const current = readSkillChoiceForm(false);
  current.options.push({id:`option_${Date.now()}`,label:`선택지 ${current.options.length + 1}`,skillId:""});
  renderSkillChoiceOptions(current);
}

function readSkillChoiceForm(strict = true) {
  const rows = [...document.querySelectorAll("#skillChoiceOptions .skill-choice-option-row")];
  const options = rows.map((row, index) => ({
    id: row.querySelector(".skill-choice-id").value || `option_${index + 1}`,
    label: row.querySelector(".skill-choice-label").value.trim(),
    skillId: row.querySelector(".skill-choice-skill").value
  }));
  if (strict && options.some(option => !option.label || !option.skillId)) throw new Error("모든 선택지의 이름과 적용 스킬을 선택하세요.");
  const checked = document.querySelector('input[name="skillChoiceDefault"]:checked')?.value;
  return normalizeSkillChoice({defaultOptionId:checked,options});
}

async function closeSkillModal(force = false) {
  if (document.getElementById('entityEditorModal')) closeEntityEditor();
  if (!force && isSkillFormDirty()) {
    if (confirm("수정된 내용이 있습니다. 저장하고 닫을까요?\n취소를 누르면 변경사항을 버리고 닫습니다.")) {
      await saveSkillFromForm();
      return;
    }
  }
  skillModalEl.classList.add("hidden");
  skillFormEl.reset();
  skillResourceCostsEl.innerHTML = "";
  skillActionsEl.innerHTML = "";
  skillFormInitialState = "";
}

if (typeof skillModalEl !== "undefined") skillModalEl?.addEventListener("click", event => {
  if (event.target === skillModalEl) closeSkillModal();
});


// Skill action row rendering.
function renderSkillActionRows(actions) {
  skillActionsEl.innerHTML = actions.map((action, index) => renderSkillActionRow(normalizeSkillAction(action), index)).join("");
  skillActionsEl.querySelectorAll(".skill-action-row").forEach(updateSkillActionFieldVisibility);
  skillActionsEl.querySelectorAll(".skill-action-row").forEach(row => refreshEntityAction(row, true));
}

function renderSkillActionRow(action, index) {
  if (!isSkillActionSupported(action)) {
    const options = action.type === "move"
      ? `<option value="unsupported_move" selected disabled>${escapeHtml(getUnsupportedActionNames({actions:[action]})[0])} · 미지원 (잠금)</option>${renderActionTypeOptions("")}`
      : renderActionTypeOptions(action.type);
    return `<div class="skill-action-row skill-action-row-unsupported" data-action-index="${index}" data-unsupported-action="${escapeHtml(JSON.stringify(action))}">
      <div class="skill-action-card-header"><div><span>ACTION ${index + 1}</span><strong>지원되지 않는 액션</strong></div><button type="button" onclick="removeSkillActionRow(this)">삭제</button></div>
      <label class="skill-action-field skill-action-type-field"><span>액션 종류</span><select class="skill-action-type" onchange="renderSkillActionRows(readSkillActionsFromForm())">${options}</select></label>
      <div class="skill-support-warning">미지원 액션이거나 효과 설정이 누락되었습니다. 원본 데이터는 보존되지만 이 스킬 전체는 전투에서 사용하지 않습니다. 저장하려면 지원 설정으로 바꾸거나 삭제하세요.</div>
      ${TIMED_EFFECT_ACTIONS.includes(action.type) ? '<button type="button" onclick="replaceMissingEffectAction(this)">기본 효과 설정으로 교체</button>' : ""}
    </div>`;
  }
  const targetOptions = getActionTargetsForType(action.type);
  return `
    <div class="skill-action-row" data-action-index="${index}">
      <div class="skill-action-card-header">
        <div><span>ACTION ${index + 1}</span><strong>액션 설정</strong></div>
        <button type="button" onclick="removeSkillActionRow(this)">삭제</button>
      </div>
      <label class="skill-action-field skill-action-type-field">
        <span>액션 종류</span>
        <select class="skill-action-type" onchange="changeSkillActionType(this)">
          ${renderActionTypeOptions(action.type)}
        </select>
      </label>
      <label class="skill-action-field skill-action-target-field">
        <span>대상 (액션별 선택)</span>
        <select class="skill-action-target">
          ${targetOptions.map(target => `<option value="${target}" ${target === action.target ? "selected" : ""}>${ACTION_TARGET_LABELS[target] ?? target}</option>`).join("")}
        </select>
        <small>각 액션의 사거리 안에서 대상을 찾습니다. 회복은 해당 자원이 부족한 대상을 우선합니다.</small>
      </label>
      <div class="skill-action-condition-field">
        <label class="skill-check-field"><input class="skill-action-allow-self" type="checkbox" ${action.allowSelfTarget !== false ? "checked" : ""}>시전자 자신도 대상 허용</label>
        <label class="skill-action-field"><span>필수 대상 효과 ID</span><input class="skill-action-required-target-effect-id" value="${escapeHtml(action.requiredTargetEffectId ?? "")}" placeholder="비우면 제한 없음"></label>
        <label class="skill-action-field"><span>필수 효과 시전자</span><select class="skill-action-required-target-effect-caster"><option value="any" ${action.requiredTargetEffectCaster !== "self" ? "selected" : ""}>누구나</option><option value="self" ${action.requiredTargetEffectCaster === "self" ? "selected" : ""}>이 스킬 시전자</option></select></label>
        <label class="skill-action-field"><span>대상 HP 이하 (%) · 100: 제한 없음</span><input class="skill-action-target-hp" type="number" min="0" max="100" step="1" value="${action.targetHpBelow ?? 100}"></label>
        <label class="skill-action-field"><span>대상별 쿨타임 (초) · 0: 제한 없음</span><input class="skill-action-target-cooldown" type="number" min="0" step="0.1" value="${action.targetCooldown ?? 0}"></label>
        <label class="skill-action-field"><span>대상 제한 범위</span><select class="skill-action-target-cooldown-scope"><option value="caster" ${action.targetCooldownScope !== "global" ? "selected" : ""}>같은 시전자·스킬·액션</option><option value="global" ${action.targetCooldownScope === "global" ? "selected" : ""}>모든 시전자 공유 효과</option></select></label>
        <label class="skill-action-field"><span>공유 효과 ID</span><input class="skill-action-target-cooldown-effect-id" value="${escapeHtml(action.targetCooldownEffectId ?? "")}" placeholder="예: overdose_lock"></label>
        <label class="skill-action-field"><span>공유 효과 이름</span><input class="skill-action-target-cooldown-effect-name" value="${escapeHtml(action.targetCooldownEffectName ?? "")}" placeholder="예: 과다투약 금지"></label>
        <small>시전자별은 같은 시전자의 같은 스킬·액션만 제한합니다. 전체 공유는 대상에게 표시되는 효과를 부여해 모든 시전자의 같은 효과 ID를 제한합니다.</small>
      </div>
      <div class="skill-action-condition-field">
        <label class="skill-action-field"><span>소유 소환수 조건</span><select class="skill-action-owned-summon-condition"><option value="any" ${action.ownedSummonCondition === "any" ? "selected" : ""}>제한 없음</option><option value="alive" ${action.ownedSummonCondition === "alive" ? "selected" : ""}>지정 Entity 생존</option><option value="absent" ${action.ownedSummonCondition === "absent" ? "selected" : ""}>지정 Entity 부재</option></select></label>
        <label class="skill-action-field"><span>조건 Entity</span><select class="skill-action-owned-summon-entity"><option value="">선택 없음</option>${entitiesJson.map(entity=>`<option value="${escapeHtml(entity.entityId)}" ${action.ownedSummonEntityId === entity.entityId ? "selected" : ""}>${escapeHtml(entity.name)}</option>`).join("")}</select></label>
        <label class="skill-action-field"><span>대상 소환수 Entity</span><select class="skill-action-target-summon-entity"><option value="">모든 내 소환수</option>${entitiesJson.map(entity=>`<option value="${escapeHtml(entity.entityId)}" ${action.targetSummonEntityId === entity.entityId ? "selected" : ""}>${escapeHtml(entity.name)}</option>`).join("")}</select></label>
      </div>
      <label class="skill-action-field" data-action-field="damageType">
        <span>피해 타입</span>
        <select class="skill-action-damage-type">
          ${ACTION_DAMAGE_TYPES.map(type => `<option value="${type}" ${type === action.damageType ? "selected" : ""}>${ACTION_DAMAGE_TYPE_LABELS[type] ?? type}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field" data-action-field="moveType">
        <span>이동 방식</span>
        <select class="skill-action-move-type" onchange="updateSkillActionFieldVisibility(this)">
          ${MOVE_ACTION_TYPES.map(type => `<option value="${type}" ${type === action.moveType ? "selected" : ""}>${ACTION_MOVE_TYPE_LABELS[type] ?? type}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field" data-action-field="movePlacement">
        <span>순간이동 도착 위치</span>
        <select class="skill-action-move-placement">
          <option value="target" ${action.movePlacement === "target" ? "selected" : ""}>대상 위치</option>
          <option value="behind" ${action.movePlacement === "behind" ? "selected" : ""}>대상 뒤</option>
        </select>
      </label>
      <label class="skill-action-field" data-action-field="moveSpeed">
        <span>이동속도</span>
        <input class="skill-action-move-speed" type="number" min="0" step="0.1" value="${action.moveSpeed}" placeholder="1">
      </label>
      <label class="skill-action-field" data-action-field="distance">
        <span>이동 거리</span>
        <input class="skill-action-distance" type="number" min="1" max="10" step="1" value="${action.distance}" placeholder="10">
      </label>
      <div class="skill-action-field" data-action-field="fieldSettings">
        <label>필드 적용 효과<select class="skill-action-field-effect" onchange="changeSkillFieldEffect(this)">
          <option value="none" ${action.fieldEffect === "none" ? "selected" : ""}>효과 없음 (오라 전용)</option>
          <option value="deal_damage" ${action.fieldEffect === "deal_damage" ? "selected" : ""}>피해</option>
          <option value="heal" ${action.fieldEffect === "heal" ? "selected" : ""}>회복</option>
          <option value="drain_resource" ${action.fieldEffect === "drain_resource" ? "selected" : ""}>자원 감소</option>
          <option value="move" ${action.fieldEffect === "move" ? "selected" : ""}>강제 이동</option>
          <option value="add_buff" ${action.fieldEffect === "add_buff" ? "selected" : ""}>버프 부여</option>
          <option value="add_state" ${action.fieldEffect === "add_state" ? "selected" : ""}>상태 부여</option>
        </select></label>
        <label>필드 형태<select class="skill-action-field-shape"><option value="circle" ${action.fieldShape !== "line" ? "selected" : ""}>원형</option><option value="line" ${action.fieldShape === "line" ? "selected" : ""}>선형</option></select></label>
        <label>강제 이동 방식<select class="skill-action-field-move-type"><option value="Push" ${action.fieldMoveType === "Push" ? "selected" : ""}>중심에서 밀치기</option><option value="Knockback" ${action.fieldMoveType === "Knockback" ? "selected" : ""}>중심에서 넉백</option><option value="Pull" ${action.fieldMoveType === "Pull" ? "selected" : ""}>중심으로 끌어오기</option></select></label>
        <label>강제 이동 거리<input class="skill-action-field-distance" type="number" min="1" max="10" step="0.1" value="${action.fieldDistance ?? 1}"></label>
        <label>설치 중심<select class="skill-action-field-center"><option value="target" ${action.fieldCenter === "target" ? "selected" : ""}>선택 대상 위치</option><option value="self" ${action.fieldCenter === "self" ? "selected" : ""}>시전자 위치</option></select></label>
        <label>필드 반경<input class="skill-action-field-radius" type="number" min="0.1" step="0.1" value="${action.fieldRadius}" placeholder="3"></label>
        <label>선형 필드 폭<input class="skill-action-field-width" type="number" min="0.1" step="0.1" value="${action.fieldWidth ?? 2}" placeholder="2"></label>
        <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-action-field-duration" type="number" min="0" step="0.1" value="${action.duration}"></label>
        <label>적용 간격 (초)<input class="skill-action-field-interval" type="number" min="${1/60}" step="any" value="${action.fieldInterval}"></label>
        <label>중심 이동 ST 추가 비용/초<input class="skill-action-field-st-center" type="number" min="0" step="0.1" value="${action.fieldMovementStCostCenter ?? 0}"></label>
        <label>1m당 ST 비용 감소<input class="skill-action-field-st-falloff" type="number" min="0" step="0.1" value="${action.fieldMovementStCostFalloff ?? 0}"></label>
        <label>최소 이동 ST 추가 비용/초<input class="skill-action-field-st-minimum" type="number" min="0" step="0.1" value="${action.fieldMovementStCostMinimum ?? 0}"></label>
        <label>필드 오라 설정<input class="skill-action-field-auras" value="${escapeHtml((action.fieldAuras ?? []).map(aura=>`${aura.target}:${aura.stat}:${aura.mode}:${aura.value}`).join(", "))}" placeholder="ally:castSpeed:percent:-20, enemy:speed:percent:-20"></label>
        <small>오라는 대상:능력치:방식:값 형식으로 쉼표로 구분합니다. 대상은 ally/enemy, 방식은 percent/flat을 사용합니다.</small>
        <small>생성 순간의 위치에 고정됩니다. 각 간격마다 범위 안의 유효 대상을 다시 찾습니다. 강제 이동은 계수를 사용하지 않고 필드 중심을 기준으로 적용됩니다.</small>
      </div>
      <div class="skill-range-section" data-action-field="range">
        <div data-action-field="chain">
          <label>추가 연쇄 횟수 (0: 사용 안 함)<input class="skill-action-chain-count" type="number" min="0" max="20" step="1" value="${action.chainCount}" onchange="updateSkillActionFieldVisibility(this)"></label>
          <label>연쇄 거리<input class="skill-action-chain-range" type="number" min="0" step="0.1" value="${action.chainRange}"></label>
          <label>추가 대상 거리 기준<select class="skill-action-chain-origin"><option value="previous" ${action.chainOrigin !== "primary" ? "selected" : ""}>직전 대상</option><option value="primary" ${action.chainOrigin === "primary" ? "selected" : ""}>최초 주 대상</option></select></label>
          <small>연쇄 사용 시 원형 광역 대신 첫 대상부터 가까운 다음 대상으로 이어집니다. 같은 대상은 한 번만 적용하며, 횟수 2는 최대 3명입니다. 회복은 부족한 자원이 있는 대상만 이어집니다.</small>
        </div>
        <div data-action-field="area">
          <label>광역 반경 (0: 단일)<input class="skill-action-area" type="number" min="0" step="0.1" value="${action.area}"></label>
          <label>광역 중심<select class="skill-action-area-center"><option value="target" ${action.areaCenter === "target" ? "selected" : ""}>선택 대상</option><option value="self" ${action.areaCenter === "self" ? "selected" : ""}>자신</option></select></label>
        </div>
        <label data-action-field="maxTargets">최대 대상 수 (0: 별도 제한 없음)<input class="skill-action-max-targets" type="number" min="0" step="1" value="${action.maxTargets}"></label>
        <div class="skill-subsection-header">사거리</div>
        <label>최소 거리 (0: 제한 없음)<input class="skill-action-min-range" type="number" min="0" step="0.1" value="${action.minRange}"></label>
        <small>시전자와 지정 대상 사이 거리입니다. 자신·소환·자신 중심 광역에는 적용하지 않으며, 광역 피해의 내부 빈 공간을 만들지는 않습니다. 최대 사거리보다 크면 대상을 선택할 수 없습니다.</small>
        <div class="skill-range-options">
          <label><input type="radio" name="skillRangeMode_${index}" value="mainWeapon" class="skill-range-mode" onchange="updateSkillRangeValueVisibility(this)" ${action.rangeMode === "mainWeapon" ? "checked" : ""}> 주장비</label>
          <label><input type="radio" name="skillRangeMode_${index}" value="custom" class="skill-range-mode" onchange="updateSkillRangeValueVisibility(this)" ${action.rangeMode === "custom" ? "checked" : ""}> 특정값</label>
          <label class="skill-inline-field skill-range-custom-field${action.rangeMode === "mainWeapon" ? " hidden" : ""}">
            <span>특정 사거리</span>
            <input class="skill-range-value" type="number" step="0.1" value="${action.rangeValue}" placeholder="사정거리">
          </label>
        </div>
        <label class="skill-action-field"><span>주장비 사거리 배율 (%)</span><input class="skill-action-range-multiplier" type="number" min="0" step="1" value="${action.rangeMultiplier ?? 100}"></label>
      </div>
      <div class="skill-coefficients" data-action-field="coefficients">
        <div class="skill-coefficient-header">
          <span>계수</span>
          <button type="button" onclick="addSkillCoefficientRow(this)">계수 추가</button>
        </div>
        <label class="skill-inline-field skill-heal-resource-field" data-action-field="healResource">
          <span>회복대상값</span>
          <select class="skill-action-heal-resource">
            ${renderResourceOptions(action.healResource)}
          </select>
          <span>주 자원이 가득 찼을 때 대체 회복</span>
          <select class="skill-action-full-resource-alternative">
            <option value="">사용 안 함</option>
            ${renderResourceOptions(action.fullResourceAlternative)}
          </select>
        </label>
        <label class="skill-inline-field" data-action-field="drainResource">
          <span>감소 대상 자원</span>
          <select class="skill-action-drain-resource">
            ${renderResourceOptions(action.drainResource)}
          </select>
        </label>
        <div class="skill-coefficient-label-row">
          <span>계수 유형</span>
          <span>필드</span>
          <span>값계산</span>
          <span>값입력</span>
          <span></span>
        </div>
        <div class="skill-coefficient-list">
          ${action.coefficients.map(coefficient => renderSkillCoefficientRow(coefficient)).join("")}
        </div>
      </div>
      ${renderTransformActionArea(action)}
      ${renderCopySkillActionArea(action)}
      ${renderSummonCommandActionArea(action)}
      ${renderReserveSwapActionArea(action)}
      ${renderReviveAllyActionArea(action)}
      ${renderEquipmentSetSwapActionArea(action)}
      ${renderRuleOverrideActionArea(action)}
      ${renderTimedEffectFields(action.type === "create_field" ? {...action,type:action.fieldEffect,duration:action.fieldEffectDuration} : action)}
      ${renderEntityActionArea(action)}
    </div>
  `;
}


// Coefficient, resource-cost and action-row editor controls.
function renderSkillCoefficientRow(coefficient) {
  const normalized = normalizeCoefficient(coefficient);
  const effectIdField = normalized.type === "calculated" && normalized.field === "targetEffectIdStacks"
    ? `<label class="skill-coefficient-effect-id">효과 ID<input class="skill-coefficient-effect-id-input" value="${escapeHtml(normalized.effectId)}" placeholder="예: bleed"></label>` : "";
  const effectTagField = normalized.type === "calculated" && normalized.field === "targetEffectTagStacks"
    ? `<label class="skill-coefficient-effect-id">효과 태그<input class="skill-coefficient-effect-tag-input" value="${escapeHtml(normalized.effectTag)}" placeholder="예: disease"></label>
       <label class="skill-coefficient-effect-id">중첩당 기준 능력치<select class="skill-coefficient-stack-source"><option value="magic" ${normalized.stackSourceField === "magic" ? "selected" : ""}>마력</option><option value="atk" ${normalized.stackSourceField === "atk" ? "selected" : ""}>공격력</option></select></label>` : "";
  const resourceIdField = normalized.type === "calculated" && normalized.field === "customResourceCurrent"
    ? `<label class="skill-coefficient-effect-id">커스텀 자원 ID<input class="skill-coefficient-resource-id-input" value="${escapeHtml(normalized.resourceId)}" placeholder="예: effort_magic"></label>` : "";
  const detailFields = normalized.type === "calculated" ? `
      <select class="skill-coefficient-field" onchange="refreshSkillCoefficientRow(this)">
        ${COEFFICIENT_FIELDS.map(field => `<option value="${field}" ${field === normalized.field ? "selected" : ""}>${COEFFICIENT_FIELD_LABELS[field] ?? field}</option>`).join("")}
      </select>
      <select class="skill-coefficient-calc">
        ${COEFFICIENT_CALCS.map(calc => `<option value="${calc}" ${calc === normalized.calc ? "selected" : ""}>${COEFFICIENT_CALC_LABELS[calc] ?? calc}</option>`).join("")}
      </select>
    ` : `
      <span class="skill-coefficient-empty"></span>
      <span class="skill-coefficient-empty"></span>
    `;
  return `
    <div class="skill-coefficient-row">
      <select class="skill-coefficient-type" onchange="refreshSkillCoefficientRow(this)">
        ${COEFFICIENT_TYPES.map(type => `<option value="${type}" ${type === normalized.type ? "selected" : ""}>${COEFFICIENT_TYPE_LABELS[type] ?? type}</option>`).join("")}
      </select>
      ${detailFields}
      <input class="skill-coefficient-value" type="number" step="0.1" value="${normalized.value}" placeholder="1">
      <button type="button" onclick="removeSkillCoefficientRow(this)">삭제</button>
      ${effectIdField}
      ${effectTagField}
      ${resourceIdField}
    </div>
  `;
}

function renderSkillResourceCosts(resourceCosts) {
  return normalizeResourceCosts({ resourceCosts }).map(renderSkillResourceCostRow).join("");
}

function renderSkillResourceCostsToForm(resourceCosts) {
  skillResourceCostsEl.innerHTML = renderSkillResourceCosts(resourceCosts);
}

function renderSkillResourceCostRow(resourceCost) {
  const normalized = normalizeResourceCost(resourceCost);
  return `
    <div class="skill-resource-cost-row">
      <label class="skill-inline-field">
        <span>자원 종류</span>
        <select class="skill-resource-cost-resource">
          ${renderResourceOptions(normalized.resource)}
        </select>
      </label>
      <label class="skill-inline-field">
        <span>소모 방식</span>
        <select class="skill-resource-cost-mode">
          ${RESOURCE_COST_MODES.map(mode => `<option value="${mode}" ${mode === normalized.mode ? "selected" : ""}>${RESOURCE_COST_MODE_LABELS[mode] ?? mode}</option>`).join("")}
        </select>
      </label>
      <label class="skill-inline-field">
        <span>소모치</span>
        <input class="skill-resource-cost-value" type="number" step="0.1" value="${normalized.value}" placeholder="0">
      </label>
      <button type="button" onclick="removeSkillResourceCostRow(this)">삭제</button>
    </div>
  `;
}

function addSkillActionRow() {
  const currentActions = readSkillActionsFromForm();
  currentActions.push(createDefaultAction());
  renderSkillActionRows(currentActions);
}

function removeSkillActionRow(button) {
  if (skillActionsEl.querySelectorAll(".skill-action-row").length <= 1) {
    alert("스킬에는 액션이 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-action-row").remove();
}


// Action-field visibility and movement form controls.
function updateSkillActionFieldVisibility(selectOrRow) {
  const row = selectOrRow.closest?.(".skill-action-row") ?? selectOrRow;
  if (row.dataset.unsupportedAction) return;
  const type = row.querySelector(".skill-action-type")?.value ?? "deal_damage";
  const fieldEffect = row.querySelector(".skill-action-field-effect")?.value ?? "deal_damage";
  const fieldTimedEffect = type === "create_field" && ["add_buff","add_state"].includes(fieldEffect);
  updateSkillActionTargetOptions(row, type);
  normalizeMoveFields(row, type);
  const hiddenFieldsByType = {
    deal_damage: ["healResource", "drainResource", "moveType", "distance", "fieldSettings"],
    heal: ["damageType", "drainResource", "moveType", "distance", "fieldSettings", "moveSpeed"],
    drain_resource: ["damageType", "healResource", "moveType", "distance", "fieldSettings", "moveSpeed"],
    command_summon:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings"],
    move: ["damageType", "healResource", "drainResource", "coefficients", "fieldSettings"],
    transform:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    copy_skill:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    swap_reserve:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    deploy_reserve:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    revive_ally:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings"],
    swap_equipment_set:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    override_rule:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"]
  };
  const hiddenFields = [...(hiddenFieldsByType[type] ?? [])];
  if (!TIMED_EFFECT_ACTIONS.includes(type) && !fieldTimedEffect) hiddenFields.push("timedEffect");
  else {
    hiddenFields.push("coefficients", "damageType", "healResource", "drainResource", "moveType", "distance", "moveSpeed");
    if (!fieldTimedEffect) hiddenFields.push("fieldSettings");
    if (type.startsWith("delete_")) hiddenFields.push("effectAdd");
    else hiddenFields.push("effectDelete");
    const effectType=fieldTimedEffect ? fieldEffect : type;
    if (effectType !== "add_buff") hiddenFields.push("effectBuff");
    if (effectType !== "add_state") hiddenFields.push("effectState");
  }
  if (!supportsActionArea(type) && type !== "create_field") hiddenFields.push("area", "chain", "maxTargets");
  else if (TIMED_EFFECT_ACTIONS.includes(type)) hiddenFields.push("chain");
  if (type === "create_field") hiddenFields.push("area","chain","moveType","distance","moveSpeed");
  else hiddenFields.push("fieldSettings");
  if (Number(row.querySelector(".skill-action-chain-count")?.value) > 0) hiddenFields.push("area");
  if (type !== "summon_entity") hiddenFields.push("summon");
  else hiddenFields.push("coefficients", "damageType", "healResource", "drainResource", "moveType", "distance", "fieldSettings");
  if(type !== "transform") hiddenFields.push("transform");
  if(type !== "copy_skill") hiddenFields.push("copySkill");
  if(type !== "command_summon") hiddenFields.push("summonCommand");
  if(!["swap_reserve","deploy_reserve"].includes(type)) hiddenFields.push("reserveSwap");
  if(type !== "revive_ally") hiddenFields.push("reviveAlly");
  if(type !== "swap_equipment_set") hiddenFields.push("equipmentSetSwap");
  if(type !== "override_rule") hiddenFields.push("ruleOverride");
  const moveType = row.querySelector(".skill-action-move-type")?.value ?? "Dash";
  if (type !== "move" || moveType !== "Dash") {
    hiddenFields.push("moveSpeed");
  }
  if (type !== "move" || moveType !== "Teleport") {
    hiddenFields.push("movePlacement");
  }

  row.querySelectorAll("[data-action-field]").forEach(field => {
    field.classList.toggle("hidden", hiddenFields.includes(field.dataset.actionField));
  });
}

function updateSkillActionTargetOptions(row, type) {
  const select = row.querySelector(".skill-action-target");
  const currentValue = select.value;
  const targets = getActionTargetsForType(type);
  const nextValue = targets.includes(currentValue) ? currentValue : targets[targets.length - 1];
  select.innerHTML = targets
    .map(target => `<option value="${target}" ${target === nextValue ? "selected" : ""}>${ACTION_TARGET_LABELS[target] ?? target}</option>`)
    .join("");
}

function normalizeMoveFields(row, type) {
  if (type !== "move") {
    return;
  }

  const moveTypeSelect = row.querySelector(".skill-action-move-type");
  if (!MOVE_ACTION_TYPES.includes(moveTypeSelect.value)) {
    moveTypeSelect.value = "Dash";
  }

  const distanceInput = row.querySelector(".skill-action-distance");
  const distanceValue = Number(distanceInput.value);
  if (!Number.isFinite(distanceValue) || distanceValue < 1) {
    distanceInput.value = 10;
  } else if (distanceValue > 10) {
    distanceInput.value = 10;
  }
}

function updateSkillRangeValueVisibility(radio) {
  const section = radio.closest(".skill-range-section");
  const checked = section.querySelector(".skill-range-mode:checked");
  const customField = section.querySelector(".skill-range-custom-field");
  customField.classList.toggle("hidden", checked?.value !== "custom");
}


// Action form manipulation and value readers.
function addSkillCoefficientRow(button) {
  const list = button.closest(".skill-coefficients").querySelector(".skill-coefficient-list");
  list.insertAdjacentHTML("beforeend", renderSkillCoefficientRow(createDefaultCoefficient()));
}

function refreshSkillCoefficientRow(select) {
  const row = select.closest(".skill-coefficient-row");
  row.outerHTML = renderSkillCoefficientRow({
    type: select.value,
    field: row.querySelector(".skill-coefficient-field")?.value,
    calc: row.querySelector(".skill-coefficient-calc")?.value,
    effectId: row.querySelector(".skill-coefficient-effect-id-input")?.value,
    effectTag: row.querySelector(".skill-coefficient-effect-tag-input")?.value,
    stackSourceField: row.querySelector(".skill-coefficient-stack-source")?.value,
    resourceId: row.querySelector(".skill-coefficient-resource-id-input")?.value,
    value: Number(row.querySelector(".skill-coefficient-value").value)
  });
}

function addSkillResourceCostRow(button) {
  const list = button.closest(".skill-resource-cost").querySelector(".skill-resource-cost-list");
  list.insertAdjacentHTML("beforeend", renderSkillResourceCostRow(createDefaultResourceCost()));
}

function removeSkillResourceCostRow(button) {
  const list = button.closest(".skill-resource-cost-list");
  if (list.querySelectorAll(".skill-resource-cost-row").length <= 1) {
    alert("자원 소모는 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-resource-cost-row").remove();
}

function removeSkillCoefficientRow(button) {
  const list = button.closest(".skill-coefficient-list");
  if (list.querySelectorAll(".skill-coefficient-row").length <= 1) {
    alert("계수는 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-coefficient-row").remove();
}

function readSkillCoefficientsFromRow(row) {
  const coefficients = [...row.querySelectorAll(".skill-coefficient-row")].map(coefficientRow => normalizeCoefficient({
    type: coefficientRow.querySelector(".skill-coefficient-type")?.value,
    field: coefficientRow.querySelector(".skill-coefficient-field")?.value,
    calc: coefficientRow.querySelector(".skill-coefficient-calc")?.value,
    effectId: coefficientRow.querySelector(".skill-coefficient-effect-id-input")?.value,
    effectTag: coefficientRow.querySelector(".skill-coefficient-effect-tag-input")?.value,
    stackSourceField: coefficientRow.querySelector(".skill-coefficient-stack-source")?.value,
    resourceId: coefficientRow.querySelector(".skill-coefficient-resource-id-input")?.value,
    value: Number(coefficientRow.querySelector(".skill-coefficient-value")?.value)
  }));
  return coefficients.length ? coefficients : [createDefaultCoefficient()];
}

function readSkillResourceCostsFromList(list) {
  const costs = [...(list?.querySelectorAll(".skill-resource-cost-row") ?? [])].map(costRow => normalizeResourceCost({
    resource: costRow.querySelector(".skill-resource-cost-resource")?.value,
    mode: costRow.querySelector(".skill-resource-cost-mode")?.value,
    value: Number(costRow.querySelector(".skill-resource-cost-value")?.value)
  }));
  return costs.length ? costs : createDefaultResourceCosts();
}

function readSkillResourceCostsFromForm() {
  return readSkillResourceCostsFromList(skillResourceCostsEl);
}

function readSkillRangeFromRow(row) {
  const checked = row.querySelector(".skill-range-mode:checked");
  const rangeValueInput = row.querySelector(".skill-range-value");
  return normalizeRange({
    rangeMode: checked?.value ?? "mainWeapon",
    rangeValue: Number(rangeValueInput?.value ?? 1)
  });
}

function readSkillActionsFromForm() {
  return [...skillActionsEl.querySelectorAll(".skill-action-row")].map(row => {
    const type = row.querySelector(".skill-action-type").value;
    if (row.dataset.unsupportedAction) {
      const original = JSON.parse(row.dataset.unsupportedAction);
      if (type === "unsupported_move" || (type === original.type && original.type !== "move")) return original;
      return normalizeSkillAction(createDefaultAction(type));
    }
    const range = readSkillRangeFromRow(row);
    return normalizeSkillAction({
      type,
      target: row.querySelector(".skill-action-target")?.value,
      rangeMode: range.rangeMode,
      rangeValue: range.rangeValue,
      minRange: Number(row.querySelector(".skill-action-min-range")?.value ?? 0),
      allowSelfTarget: row.querySelector(".skill-action-allow-self")?.checked ?? true,
      requiredTargetEffectId:row.querySelector(".skill-action-required-target-effect-id")?.value ?? "",
      requiredTargetEffectCaster:row.querySelector(".skill-action-required-target-effect-caster")?.value ?? "any",
      targetHpBelow: Number(row.querySelector(".skill-action-target-hp")?.value ?? 100),
      targetCooldown: Number(row.querySelector(".skill-action-target-cooldown")?.value ?? 0),
      targetCooldownScope: row.querySelector(".skill-action-target-cooldown-scope")?.value ?? "caster",
      targetCooldownEffectId: row.querySelector(".skill-action-target-cooldown-effect-id")?.value ?? "",
      targetCooldownEffectName: row.querySelector(".skill-action-target-cooldown-effect-name")?.value ?? "",
      ownedSummonCondition:row.querySelector(".skill-action-owned-summon-condition")?.value ?? "any",
      ownedSummonEntityId:row.querySelector(".skill-action-owned-summon-entity")?.value ?? "",
      targetSummonEntityId:row.querySelector(".skill-action-target-summon-entity")?.value ?? "",
      fullResourceAlternative:row.querySelector(".skill-action-full-resource-alternative")?.value ?? "",
      ...(TIMED_EFFECT_ACTIONS.includes(type) || (type === "create_field" && ["add_buff","add_state"].includes(row.querySelector('.skill-action-field-effect')?.value)) ? {effect:readSkillEffectFromRow(row)} : {}),
      ...(type === "transform" ? {transform:{id:row.querySelector('.skill-transform-id')?.value,name:row.querySelector('.skill-transform-name')?.value,
        mode:row.querySelector('.skill-transform-mode')?.value,modifiers:Object.fromEntries([...row.querySelectorAll('.skill-transform-stat')].map(input=>[input.dataset.stat,Number(input.value)])),
        skillIds:[...row.querySelectorAll('.skill-transform-skills option:checked')].map(option=>option.value),
        attackSkillId:row.querySelector('.skill-transform-attack-skill')?.value ?? "",
        receivedDamagePercent:Number(row.querySelector('.skill-transform-received-damage')?.value ?? 100),
        immobile:Boolean(row.querySelector('.skill-transform-immobile')?.checked),
        exitHpBelow:Number(row.querySelector('.skill-transform-exit-hp')?.value ?? 0),
        retreatHpBelow:Number(row.querySelector('.skill-transform-retreat-hp')?.value ?? 0)}} : {}),
      ...(type === "copy_skill" ? {
        copySourceIndex:Number(row.querySelector('.skill-copy-source-index')?.value ?? 1),
        copySlot:Number(row.querySelector('.skill-copy-slot')?.value ?? 1)
      } : {}),
      ...(["swap_reserve","deploy_reserve"].includes(type) ? {
        reserveIndex:Number(row.querySelector('.skill-reserve-index')?.value ?? 1)
      } : {}),
      ...(type === "revive_ally" ? {
        reviveHpPercent:Number(row.querySelector('.skill-revive-hp')?.value ?? 50),
        reviveMpPercent:Number(row.querySelector('.skill-revive-mp')?.value ?? 100),
        reviveStPercent:Number(row.querySelector('.skill-revive-st')?.value ?? 100),
        reviveInvulnerable:Number(row.querySelector('.skill-revive-invulnerable')?.value ?? 0),
        revivePosition:row.querySelector('.skill-revive-position')?.value ?? "death"
      } : {}),
      ...(type === "command_summon" ? {summonCommand:row.querySelector('.skill-summon-command')?.value ?? "hold"} : {}),
      ...(type === "swap_equipment_set" ? {
        equipmentSetIndex:Number(row.querySelector('.skill-equipment-set-index')?.value ?? 1)
      } : {}),
      ...(type === "override_rule" ? {ruleOverride:{
        id:row.querySelector('.skill-rule-id')?.value,
        disableTeamSynergies:Boolean(row.querySelector('.skill-rule-disable-synergies')?.checked),
        disableEquipmentEffects:Boolean(row.querySelector('.skill-rule-disable-equipment')?.checked),
        disableAllSkills:Boolean(row.querySelector('.skill-rule-disable-all')?.checked),
        disabledSkillIds:[...row.querySelectorAll('.skill-rule-disabled-skills option:checked')].map(option=>option.value),
        damagePercent:Number(row.querySelector('.skill-rule-damage')?.value ?? 100),
        receivedDamagePercent:Number(row.querySelector('.skill-rule-received-damage')?.value ?? 100),
        healingPercent:Number(row.querySelector('.skill-rule-healing')?.value ?? 100),
        receivedHealingPercent:Number(row.querySelector('.skill-rule-received-healing')?.value ?? 100),
        resourceCostPercent:Number(row.querySelector('.skill-rule-cost')?.value ?? 100),
        cooldownPercent:Number(row.querySelector('.skill-rule-cooldown')?.value ?? 100)
      }} : {}),
      chainCount: Number(row.querySelector(".skill-action-chain-count")?.value ?? 0),
      chainRange: Number(row.querySelector(".skill-action-chain-range")?.value ?? 3),
      chainOrigin:row.querySelector(".skill-action-chain-origin")?.value ?? "previous",
      rangeMultiplier:Number(row.querySelector(".skill-action-range-multiplier")?.value ?? 100),
      coefficients: type === "move" ? [] : readSkillCoefficientsFromRow(row),
      healResource: row.querySelector(".skill-action-heal-resource")?.value ?? "HP",
      drainResource: row.querySelector(".skill-action-drain-resource")?.value ?? "MP",
      damageType: row.querySelector(".skill-action-damage-type")?.value ?? "physical",
      moveType: row.querySelector(".skill-action-move-type")?.value ?? "Walk",
      movePlacement: row.querySelector(".skill-action-move-placement")?.value ?? "target",
      moveSpeed: Number(row.querySelector(".skill-action-move-speed")?.value ?? 1),
      distance: Number(row.querySelector(".skill-action-distance")?.value ?? 0),
      fieldRadius: Number(row.querySelector(".skill-action-field-radius")?.value ?? 0),
      fieldShape:row.querySelector(".skill-action-field-shape")?.value ?? "circle",
      fieldWidth:Number(row.querySelector(".skill-action-field-width")?.value ?? 2),
      fieldEffect: row.querySelector(".skill-action-field-effect")?.value,
      fieldEffectDuration:Number(row.querySelector('.skill-effect-duration')?.value ?? 5),
      fieldMoveType:row.querySelector(".skill-action-field-move-type")?.value,
      fieldDistance:Number(row.querySelector(".skill-action-field-distance")?.value ?? 1),
      fieldCenter: row.querySelector(".skill-action-field-center")?.value,
      fieldInterval: Number(row.querySelector(".skill-action-field-interval")?.value ?? 1),
      fieldMovementStCostCenter:Number(row.querySelector(".skill-action-field-st-center")?.value ?? 0),
      fieldMovementStCostFalloff:Number(row.querySelector(".skill-action-field-st-falloff")?.value ?? 0),
      fieldMovementStCostMinimum:Number(row.querySelector(".skill-action-field-st-minimum")?.value ?? 0),
      fieldAuras:String(row.querySelector(".skill-action-field-auras")?.value ?? "").split(",").map(value=>{
        const [target,stat,mode,amount]=value.trim().split(":");return {target,stat,mode,value:Number(amount)};
      }).filter(aura=>["ally","enemy"].includes(aura.target) && aura.stat && ["percent","flat"].includes(aura.mode) && Number.isFinite(aura.value) && aura.value !== 0),
      area: Number(row.querySelector(".skill-action-area")?.value ?? 0),
      areaCenter: row.querySelector(".skill-action-area-center")?.value,
      maxTargets: Number(row.querySelector(".skill-action-max-targets")?.value ?? 0),
      entityId: row.querySelector('.skill-action-entity-id')?.value,
      summonCenter:row.querySelector('.skill-action-summon-center')?.value ?? "self",
      inheritStats:Object.fromEntries([...row.querySelectorAll('.skill-action-inherit-stat')].map(input=>[input.dataset.stat,Number(input.value)])),
      count: Number(row.querySelector('.skill-action-count')?.value ?? 1),
      limit: Number(row.querySelector('.skill-action-limit')?.value ?? 3),
      protectOwnerPercent: Number(row.querySelector('.skill-action-protect-percent')?.value ?? 0),
      protectOwnerScope: row.querySelector('.skill-action-protect-scope')?.value ?? "all",
      protectOwnerPriority: Number(row.querySelector('.skill-action-protect-priority')?.value ?? 0),
      transferStateScope: row.querySelector('.skill-action-transfer-state')?.value ?? "none",
      transferStatePriority: Number(row.querySelector('.skill-action-transfer-priority')?.value ?? 0),
      duration: Number(row.querySelector(type === "create_field" ? '.skill-action-field-duration' : type === "transform" ? '.skill-transform-duration' : type === "override_rule" ? '.skill-rule-duration' : ["swap_reserve","deploy_reserve"].includes(type) ? '.skill-reserve-duration' : TIMED_EFFECT_ACTIONS.includes(type) ? '.skill-effect-duration' : '.skill-action-duration')?.value ?? (type === "create_field" ? 0 : 20))
    });
  });
}


// Custom-resource editor controls (browser only).
function renderCustomResourceEditor(container, resources = []) {
  if (!container) return;
  container.innerHTML = normalizeCustomResourceDefinitions(resources).map(renderCustomResourceRow).join("");
}

function renderCustomResourceRow(resource = {}) {
  const normalized = normalizeCustomResourceDefinitions([{ id: resource.id || "resource", name: resource.name, initial: resource.initial, max: resource.max }])[0];
  return `<div class="custom-resource-row">
    <label>ID<input class="custom-resource-id" value="${escapeHtml(resource.id ? normalized.id : "")}" placeholder="soul"></label>
    <label>이름<input class="custom-resource-name" value="${escapeHtml(resource.name ? normalized.name : "")}" placeholder="영혼 포인트"></label>
    <label>초기값<input class="custom-resource-initial" type="number" min="0" step="0.1" value="${Number(resource.initial) || 0}"></label>
    <label>최대값<input class="custom-resource-max" type="number" min="0" step="0.1" value="${Number(resource.max) || 100}"></label>
    <button type="button" onclick="this.closest('.custom-resource-row').remove()">삭제</button>
  </div>`;
}

function addCustomResourceRow(container) {
  if (!container) return;
  container.insertAdjacentHTML("beforeend", renderCustomResourceRow({ max: 100 }));
}

function readCustomResourcesFromEditor(container) {
  if (!container) return [];
  return normalizeCustomResourceDefinitions([...container.querySelectorAll(".custom-resource-row")].map(row => ({
    id: row.querySelector(".custom-resource-id")?.value,
    name: row.querySelector(".custom-resource-name")?.value,
    initial: row.querySelector(".custom-resource-initial")?.value,
    max: row.querySelector(".custom-resource-max")?.value
  })));
}

