let synergyEditingId = null;
let synergySaving = false;
const synergyEl = id => document.getElementById(id);

function synergyEffectsText(effects) {
  return effects.map(e => `${getSynergyStatDefs().find(s => s.key === e.stat)?.label || e.stat} ${e.value >= 0 ? '+' : ''}${e.value} (${e.target === 'matching' ? '조건 대상' : '전체 아군 캐릭터'})`).join(', ');
}

function renderSynergyPage() {
  synergyEl('synergyTableBody').innerHTML = synergiesJson.map((s,i) => {
    let error = ''; try { validateSynergies([s]); } catch(e) { error = e.message; }
    const label = getSynergyConditionOptions(s.condition?.type).find(o => o.key === s.condition.value)?.label || s.condition?.value || '조건 없음';
    return `<tr><td>${renderRecordImageName(s)}${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}</td><td>${escapeHtml(label)}</td><td>${s.stacking === 'cumulative' ? '충족 단계 합산' : '최고 단계만'}</td><td>${(s.thresholds || []).map(t => `${t.count}명: ${escapeHtml(synergyEffectsText(t.effects || []))}`).join('<br>')}</td><td><button onclick="openSynergyModal(${i})">수정</button></td></tr>`;
  }).join('') || '<tr><td colspan="5">등록된 시너지가 없습니다. 시너지를 추가해주세요.</td></tr>';
}

function updateSynergyConditionOptions(value = '') {
  synergyEl('synergyValue').innerHTML = getSynergyConditionOptions(synergyEl('synergyType').value).map(o => `<option value="${escapeHtml(o.key)}">${escapeHtml(o.label)}</option>`).join('');
  if (value) synergyEl('synergyValue').value = value;
}

function openSynergyModal(index = null) {
  const s = index === null ? null : synergiesJson[index];
  synergyEditingId = s?.id || null;
  synergyEl('synergyName').value = s?.name || '';
  openRecordImageEditor('synergies', s?.icon);
  synergyEl('synergyType').value = s?.condition?.type || 'faction';
  updateSynergyConditionOptions(s?.condition?.value);
  synergyEl('synergyStacking').value = s?.stacking || 'highest';
  synergyEl('synergyThresholds').innerHTML = '';
  (s?.thresholds || [{count:2,effects:[]}]).forEach(addSynergyThreshold);
  synergyEl('synergyDelete').hidden = !s;
  synergyEl('synergyError').textContent = '';
  synergyEl('synergyModal').classList.remove('hidden');
  synergyEl('synergyName').focus();
}

function closeSynergyModal() {
  if (!synergySaving) synergyEl('synergyModal').classList.add('hidden');
}

function addSynergyThreshold(tier = {count:2,effects:[]}) {
  const row = document.createElement('section');
  row.className = 'synergy-tier';
  row.innerHTML = `<div class="synergy-fields"><label>필요 인원<input class="synergy-count" type="number" min="1" step="1" required value="${Number(tier.count) || 2}"></label><button type="button" onclick="this.closest('.synergy-tier').remove()">단계 삭제</button></div><div class="synergy-effects"></div><button type="button" onclick="addSynergyEffect(this.closest('.synergy-tier'))">+ 효과 추가</button>`;
  synergyEl('synergyThresholds').appendChild(row);
  (tier.effects.length ? tier.effects : [{type:'stat',stat:getSynergyStatDefs()[0].key,value:0,target:'team'}]).forEach(e => addSynergyEffect(row,e));
}

function addSynergyEffect(tier, effect = {}) {
  const row = document.createElement('div');
  row.className = 'synergy-fields synergy-effect';
  row.innerHTML = `<label>스탯<select class="synergy-stat" required>${getSynergyStatDefs().map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)} (${escapeHtml(s.key)})</option>`).join('')}</select></label><label>보정값<input class="synergy-amount" type="number" step="any" required value="${Number(effect.value) || 0}"></label><label>효과 적용 대상<select class="synergy-target"><option value="team">전체 아군 캐릭터</option><option value="matching">조건 대상 캐릭터</option></select></label><button type="button" onclick="this.closest('.synergy-effect').remove()">효과 삭제</button>`;
  tier.querySelector('.synergy-effects').appendChild(row);
  if (effect.stat) row.querySelector('.synergy-stat').value = effect.stat;
  row.querySelector('.synergy-target').value = effect.target || 'team';
}

async function persistSynergies(next) {
  if (synergySaving) return;
  synergySaving = true;
  synergyEl('synergyFormFields').disabled = true;
  try {
    validateSynergies(next);
    await saveJsonFile('synergies', next);
    synergiesJson = next;
    renderSynergyPage();
    renderTeamSynergyPreview();
    synergySaving = false;
    closeSynergyModal();
  } catch(e) {
    synergyEl('synergyError').textContent = e.message;
    logError('synergy', '시너지 저장 실패', e);
  } finally {
    synergySaving = false;
    synergyEl('synergyFormFields').disabled = false;
  }
}

async function saveSynergyForm(event) {
  event.preventDefault();
  let icon;
  try { icon = getRecordImageSelection('synergies'); }
  catch (error) { synergyEl('synergyError').textContent = error.message; return; }
  const row = {
    icon,
    id:synergyEditingId || `synergy_${crypto.randomUUID()}`,
    name:synergyEl('synergyName').value.trim(),
    condition:{type:synergyEl('synergyType').value,value:synergyEl('synergyValue').value},
    stacking:synergyEl('synergyStacking').value,
    thresholds:[...synergyEl('synergyThresholds').querySelectorAll('.synergy-tier')].map(t => ({
      count:Number(t.querySelector('.synergy-count').value),
      effects:[...t.querySelectorAll('.synergy-effect')].map(e => ({type:'stat',stat:e.querySelector('.synergy-stat').value,value:Number(e.querySelector('.synergy-amount').value),target:e.querySelector('.synergy-target').value}))
    }))
  };
  const next = synergiesJson.filter(s => s.id !== synergyEditingId);
  next.push(row);
  await persistSynergies(next);
}

async function deleteSynergy() {
  if (synergySaving || !synergyEditingId || !confirm('이 시너지를 삭제하시겠습니까?')) return;
  await persistSynergies(synergiesJson.filter(s => s.id !== synergyEditingId));
}

function renderTeamSynergyPreview() {
  const el = synergyEl('teamSynergyPreview');
  if (!el) return;
  if (!getSelectedTeam()) { el.innerHTML = '<p>팀을 선택해주세요.</p>'; return; }
  const result = evaluateSynergies([...new Set(selectedTeamMemberIds)].map(id => characterJson[id]));
  const active = result.states.filter(s=>s.active.length);
  el.innerHTML = '<h5>활성 시너지</h5>' + (active.map(s=>`<div class="synergy-preview active"><strong>${renderRecordImageName(s.definition)}</strong>${s.active.map(t=>`<p>${t.count}명 효과 · ${escapeHtml(synergyEffectsText(t.effects))}</p>`).join('')}</div>`).join('') || '<p class="empty-text">활성 시너지가 없습니다.</p>');
}
