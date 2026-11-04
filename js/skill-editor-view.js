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

