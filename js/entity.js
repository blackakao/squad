let entitiesJson = [];
let battleEntitySnapshot = null;
let entityEditorRow = null;
let entityEditorOriginalId = "";
let entityPreviewFrame = null;
const ENTITY_STAT_FIELDS = {hp:"HP",mp:"MP",st:"ST",atk:"공격력",magic:"마력",defense:"방어력",resistance:"저항력",speed:"이동속도",attackSpeed:"공격 간격(초)",castTime:"시전시간(초)",attackRange:"사거리"};
const ENTITY_ROLES = {melee:"근접",ranged:"원거리",healer:"치유 (힐)",tank:"방어",special:"특수"};
const ENTITY_AI = {melee:"근접",ranged:"원거리",healer:"치유",stationary:"설치형"};

function createDefaultEntity() {
  return {entityId:"",name:"새 Entity",description:"",icon:"",role:"melee",ai:"melee",tags:["summon"],stats:{hp:100,mp:100,st:100,atk:10,magic:10,defense:0,resistance:0,speed:1,attackSpeed:1,castTime:0,attackRange:1}};
}

async function entityRequest(path = "", method = "GET", body) {
  const response = await fetch(`/api/entities/${path}`, {method,cache:"no-store",headers:body ? {"Content-Type":"application/json"} : {},body:body ? JSON.stringify(body) : undefined});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Entity API: ${response.status}`);
  return result;
}

async function loadEntityJson() {
  entitiesJson = await entityRequest();
}

function getEntityById(id) {
  return entitiesJson.find(entity => entity.entityId === id);
}

function getSummonConfiguration(source, action) {
  const definitions = typeof isBattleRunning !== "undefined" && isBattleRunning && battleEntitySnapshot ? battleEntitySnapshot : entitiesJson;
  const entity = definitions.find(candidate => candidate.entityId === action.entityId);
  if (!entity) return null;
  const stats={...entity.stats};
  const sourceFields={hp:"maxHp",mp:"maxMp",st:"maxSt",atk:"atk",magic:"magic",defense:"defense",resistance:"resistance",speed:"speed"};
  for(const stat of SUMMON_INHERIT_STATS) stats[stat]=(Number(stats[stat]) || 0)+(Number(source?.[sourceFields[stat]]) || 0)*(Number(action.inheritStats?.[stat]) || 0)/100;
  return {...stats, entityId:entity.entityId,name:entity.name,icon:entity.icon,role:entity.role,ai:entity.ai,
    speed:entity.ai === "stationary" ? 0 : stats.speed,
    count:action.count ?? 1,limit:action.limit ?? 3,lifetime:action.duration ?? 20,summonCenter:action.summonCenter ?? "self",
    protectOwnerPercent:action.protectOwnerPercent ?? 0,protectOwnerScope:action.protectOwnerScope ?? "all",
    protectOwnerPriority:action.protectOwnerPriority ?? 0,transferStateScope:action.transferStateScope ?? "none",
    transferStatePriority:action.transferStatePriority ?? 0};
}

function safeEntityIcon(value) {
  const text = String(value || "").trim();
  return /^(https?:\/\/|assets\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(text) ? text : "";
}

function entityUsages(id) {
  return skillsJson.filter(skill => skill.actions.some(action => action.type === "summon_entity" && action.entityId === id));
}

function renderEntityActionArea(action) {
  return `<div class="entity-action-panel" data-action-field="summon">
    <strong>Entity</strong>
    <input class="entity-search" placeholder="이름 · 역할 · 태그 검색" aria-label="Entity 검색" oninput="filterEntityOptions(this)">
    <select class="skill-action-entity-id" aria-label="Entity 선택" onchange="refreshEntityAction(this.closest('.skill-action-row'))" data-selected="${escapeHtml(action.entityId || "")}"></select>
    <div class="entity-toolbar">
      <button type="button" onclick="openEntityEditor(this)">새 Entity</button>
      <button type="button" data-entity-required onclick="copyEntityFromAction(this)">복사</button>
      <button type="button" data-entity-required onclick="openEntityEditor(this, true)">수정</button>
      <button type="button" data-entity-required onclick="deleteEntityFromAction(this)">삭제</button>
    </div>
    <div class="entity-preview-info"></div><div class="entity-usages"></div>
    <div class="entity-summon-options">
      <label>소환 수<input class="skill-action-count" type="number" min="1" max="10" step="1" value="${action.count ?? 1}"></label>
      <label>동시 유지 수<input class="skill-action-limit" type="number" min="1" max="20" step="1" value="${action.limit ?? 3}"></label>
      <label>유지시간(초, 0: 무제한)<input class="skill-action-duration" type="number" min="0" step="0.1" value="${action.duration ?? 20}"></label>
      <label>소환 위치<select class="skill-action-summon-center"><option value="self" ${action.summonCenter !== "target" ? "selected" : ""}>시전자 주변</option><option value="target" ${action.summonCenter === "target" ? "selected" : ""}>선택 대상 주변</option></select></label>
      <div class="skill-subsection-header">소환자 능력치 계승 (%)</div>
      ${SUMMON_INHERIT_STATS.map(stat=>`<label>${ENTITY_STAT_FIELDS[stat] ?? stat}<input class="skill-action-inherit-stat" data-stat="${stat}" type="number" min="0" max="1000" step="1" value="${action.inheritStats?.[stat] ?? 0}"></label>`).join("")}
      <label>소환자 피해 대리(%)<input class="skill-action-protect-percent" type="number" min="0" max="100" step="1" value="${action.protectOwnerPercent ?? 0}"></label>
      <label>피해 대리 범위<select class="skill-action-protect-scope"><option value="all" ${action.protectOwnerScope === "all" ? "selected" : ""}>모든 피해</option><option value="basic" ${action.protectOwnerScope === "basic" ? "selected" : ""}>기본 공격</option><option value="skill" ${action.protectOwnerScope === "skill" ? "selected" : ""}>스킬 피해</option></select></label>
      <label>피해 대리 우선순위<input class="skill-action-protect-priority" type="number" min="0" max="999" step="1" value="${action.protectOwnerPriority ?? 0}"></label>
      <label>해로운 상태이상 이전<select class="skill-action-transfer-state"><option value="none" ${action.transferStateScope === "none" ? "selected" : ""}>사용 안 함</option><option value="all" ${action.transferStateScope === "all" ? "selected" : ""}>모든 분류</option><option value="general" ${action.transferStateScope === "general" ? "selected" : ""}>일반</option><option value="physical" ${action.transferStateScope === "physical" ? "selected" : ""}>물리</option><option value="magic" ${action.transferStateScope === "magic" ? "selected" : ""}>마법</option></select></label>
      <label>상태이상 이전 우선순위<input class="skill-action-transfer-priority" type="number" min="0" max="999" step="1" value="${action.transferStatePriority ?? 0}"></label>
    </div>
    <small>Entity 변경은 즉시 저장됩니다. 현재 스킬의 연결 변경은 스킬 저장 시 적용됩니다.</small>
  </div>`;
}

function filterEntityOptions(input) {
  const row = input.closest('.skill-action-row');
  const select = row.querySelector('.skill-action-entity-id');
  const selected = select.value || select.dataset.selected || "";
  const query = input.value.trim().toLocaleLowerCase();
  const matches = entitiesJson.filter(entity => `${entity.name} ${entity.role} ${ENTITY_ROLES[entity.role]} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(query));
  const selectedEntity = getEntityById(selected);
  if (selectedEntity && !matches.includes(selectedEntity)) matches.unshift(selectedEntity);
  select.innerHTML = '<option value="">Entity 선택</option>' + matches.map(entity => `<option value="${escapeHtml(entity.entityId)}">${escapeHtml(entity.name)} · ${ENTITY_ROLES[entity.role] || entity.role} (${escapeHtml(entity.entityId)})</option>`).join('');
  if (selected && !selectedEntity) select.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(selected)}">없는 Entity: ${escapeHtml(selected)}</option>`);
  select.value = selected;
}

function refreshEntityAction(row, initialize = false) {
  const select = row.querySelector('.skill-action-entity-id');
  if (!select) return;
  if (initialize) filterEntityOptions(row.querySelector('.entity-search'));
  select.dataset.selected = select.value;
  const entity = getEntityById(select.value);
  row.querySelectorAll('[data-entity-required]').forEach(button => button.disabled = !entity);
  const info = row.querySelector('.entity-preview-info');
  if (!entity) {
    info.textContent = select.value ? "참조하는 Entity가 없습니다. 다른 Entity를 선택하세요." : "소환할 Entity를 선택하거나 생성하세요.";
    row.querySelector('.entity-usages').textContent = "";
    return;
  }
  const icon = safeEntityIcon(entity.icon);
  info.innerHTML = `${icon ? `<img class="entity-icon" src="${escapeHtml(icon)}" alt="Entity 아이콘">` : ''}<strong>${escapeHtml(entity.name)}</strong><p>${escapeHtml(entity.description || '')}</p>
    <dl><dt>역할 / AI</dt><dd>${ENTITY_ROLES[entity.role]} / ${ENTITY_AI[entity.ai]}</dd>${Object.entries(ENTITY_STAT_FIELDS).map(([key,label])=>`<dt>${label}</dt><dd>${entity.stats[key]}</dd>`).join('')}<dt>태그</dt><dd>${escapeHtml(entity.tags.join(', '))}</dd></dl>`;
  const usages = entityUsages(entity.entityId);
  row.querySelector('.entity-usages').innerHTML = `<strong>사용 중인 Skill (${usages.length})</strong>${usages.length ? usages.map(skill=>`<button type="button" data-skill-id="${escapeHtml(skill.id)}" onclick="navigateEntityUsage(this)">${escapeHtml(skill.name)}</button>`).join('') : '<p>저장된 사용처 없음</p>'}`;
}

function refreshAllEntityActions() {
  document.querySelectorAll('#skillActions .skill-action-row').forEach(row => refreshEntityAction(row, true));
  renderSkillPage();
}

function linkEntityToAction(row, id) {
  row.querySelector('.skill-action-entity-id').dataset.selected = id;
  row.querySelector('.skill-action-entity-id').innerHTML = '';
  row.querySelector('.entity-search').value = '';
  refreshEntityAction(row, true);
}

function nextEntityCopyId(id) {
  const base = id.slice(0,65) + '_copy';
  let candidate = base, count = 2;
  while (getEntityById(candidate)) candidate = `${base}_${count++}`;
  return candidate;
}

async function copyEntityFromAction(button) {
  try {
    const row = button.closest('.skill-action-row');
    const original = getEntityById(row.querySelector('.skill-action-entity-id').value);
    const copy = structuredClone(original);
    copy.entityId = nextEntityCopyId(original.entityId);
    copy.name += ' (복사)';
    const saved = await entityRequest('', 'POST', copy);
    entitiesJson.push(saved);
    linkEntityToAction(row, saved.entityId);
    refreshAllEntityActions();
  } catch(error) { logError('entity','Entity 복사 실패',error); alert(error.message); }
}

async function deleteEntityFromAction(button) {
  try {
    const row = button.closest('.skill-action-row');
    const id = row.querySelector('.skill-action-entity-id').value;
    const usages = await entityRequest(`${encodeURIComponent(id)}/usages`);
    if (usages.length) { alert(`이 Entity는 ${usages.length}개의 Skill에서 사용 중입니다.\n\n${usages.map(s=>'- '+s.name).join('\n')}`); return; }
    // A draft reference cannot be persisted concurrently with DELETE: server validates both operations.
    if (!confirm('이 Entity를 DB에서 삭제할까요? 현재 편집 중인 연결도 해제됩니다.')) return;
    await entityRequest(encodeURIComponent(id),'DELETE');
    entitiesJson = entitiesJson.filter(e=>e.entityId!==id);
    document.querySelectorAll('#skillActions .skill-action-entity-id').forEach(select=>{
      if(select.value===id){select.value='';select.dataset.selected='';}
    });
    refreshAllEntityActions();
  } catch(error) { logError('entity','Entity 삭제 실패',error); alert(error.message); }
}

function navigateEntityUsage(button) {
  const index = skillsJson.findIndex(s=>s.id===button.dataset.skillId);
  if (index < 0 || String(index) === skillEditIndexEl.value) return;
  if (!confirm('현재 스킬의 저장하지 않은 편집을 버리고 선택한 스킬로 이동할까요?')) return;
  openSkillModal(index);
}

function ensureEntityEditor() {
  if(document.getElementById('entityEditorModal')) return;
  const options = map => Object.entries(map).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<div id="entityEditorModal" class="modal hidden entity-editor-modal"><div class="modal-content entity-editor-content">
    <h4>Entity 편집</h4><form id="entityEditorForm" onsubmit="saveEntityEditor(event)">
      <label>Entity ID (생성 시 빈칸: 자동)<input name="entityId" pattern="[a-z0-9](?:[a-z0-9]|_|-){0,79}"></label>
      <label>이름<input name="name" required></label><label>설명<textarea name="description"></textarea></label>
      <label>아이콘 URL / assets 경로<input name="icon"></label>
      <label>역할<select name="role">${options(ENTITY_ROLES)}</select></label>
      <label>태그 (쉼표 구분)<input name="tags"></label>
      <fieldset><legend>능력치</legend><div class="entity-stat-grid">${Object.entries(ENTITY_STAT_FIELDS).map(([key,label])=>`<label>${label}<input name="${key}" type="number" min="${key==='hp'?1:['attackSpeed','attackRange'].includes(key)?0.1:0}" max="100000" step="any" required></label>`).join('')}</div></fieldset>
      <label>AI<select name="ai">${options(ENTITY_AI)}</select></label>
      <p id="entityEditorUsage"></p>
      <label>저장 방식<select name="saveMode" onchange="updateEntitySaveMode()"><option value="update">기존 Entity 수정 (모든 Skill에 반영)</option><option value="new">새 Entity로 저장 (현재 액션만 연결)</option></select></label>
      <div class="entity-toolbar"><button type="submit">Entity 저장</button><button type="button" onclick="startEntityPreview()">미리보기</button><button type="button" onclick="stopEntityPreview()">미리보기 중지</button><button type="button" onclick="closeEntityEditor()">닫기</button></div>
    </form><p id="entityEditorError" role="alert"></p><canvas id="entityPreviewCanvas" width="600" height="320" class="hidden"></canvas><p id="entityPreviewCaption"></p>
  </div></div>`);
}

function openEntityEditor(button, edit = false) {
  ensureEntityEditor(); stopEntityPreview();
  entityEditorRow = button.closest('.skill-action-row');
  const entity = edit ? getEntityById(entityEditorRow.querySelector('.skill-action-entity-id').value) : createDefaultEntity();
  entityEditorOriginalId = edit ? entity.entityId : '';
  const form = document.getElementById('entityEditorForm');
  for(const key of ['entityId','name','description','icon','role','ai']) form.elements[key].value = entity[key] || '';
  form.elements.tags.value = entity.tags.join(', ');
  for(const key of Object.keys(ENTITY_STAT_FIELDS)) form.elements[key].value = entity.stats[key];
  form.elements.saveMode.value = edit ? 'update' : 'new';
  form.elements.saveMode.querySelector('[value="update"]').disabled = !edit;
  document.getElementById('entityEditorUsage').textContent = `${entityUsages(entity.entityId).length}개 Skill에서 사용 중. 기존 Entity 수정은 모든 참조에 반영됩니다.`;
  document.getElementById('entityEditorError').textContent = '';
  document.getElementById('entityPreviewCanvas').classList.add('hidden');
  document.getElementById('entityPreviewCaption').textContent = '';
  updateEntitySaveMode();
  document.getElementById('entityEditorModal').classList.remove('hidden');
}

function updateEntitySaveMode() {
  const form = document.getElementById('entityEditorForm');
  const update = form.elements.saveMode.value === 'update';
  form.elements.entityId.readOnly = update;
  if(update) form.elements.entityId.value = entityEditorOriginalId;
  else if(entityEditorOriginalId && form.elements.entityId.value === entityEditorOriginalId) form.elements.entityId.value = nextEntityCopyId(entityEditorOriginalId);
}

function readEntityEditor() {
  const form = document.getElementById('entityEditorForm');
  return {entityId:form.elements.entityId.value.trim(),name:form.elements.name.value.trim(),description:form.elements.description.value,
    icon:form.elements.icon.value.trim(),role:form.elements.role.value,ai:form.elements.ai.value,tags:form.elements.tags.value.split(',').map(s=>s.trim()).filter(Boolean),
    stats:Object.fromEntries(Object.keys(ENTITY_STAT_FIELDS).map(key=>[key,Number(form.elements[key].value)]))};
}

async function saveEntityEditor(event) {
  event.preventDefault();
  const form = document.getElementById('entityEditorForm');
  if(!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  if(button.disabled) return;
  button.disabled = true;
  try {
    const entity = readEntityEditor();
    const update = form.elements.saveMode.value === 'update';
    const saved = await entityRequest(update ? encodeURIComponent(entityEditorOriginalId) : '',update?'PUT':'POST',entity);
    entitiesJson = [...entitiesJson.filter(e=>e.entityId!==saved.entityId),saved];
    linkEntityToAction(entityEditorRow,saved.entityId);
    refreshAllEntityActions();
    closeEntityEditor();
    log('Entity를 저장했습니다.','entity');
  } catch(error) {logError('entity','Entity 저장 실패',error);document.getElementById('entityEditorError').textContent=error.message;}
  finally {button.disabled=false;}
}

function closeEntityEditor() {
  stopEntityPreview();
  document.getElementById('entityEditorModal').classList.add('hidden');
}

function stopEntityPreview() {
  if(entityPreviewFrame != null) cancelAnimationFrame(entityPreviewFrame);
  entityPreviewFrame = null;
}

function startEntityPreview() {
  const form = document.getElementById('entityEditorForm');
  if(!form.reportValidity()) return;
  stopEntityPreview();
  const entity = readEntityEditor(), preview = document.getElementById('entityPreviewCanvas'), pen = preview.getContext('2d');
  preview.classList.remove('hidden');
  const width = canvas.width || 400, height = canvas.height || 300;
  const owner = {name:'미리보기',side:'player',x:width*.2,y:height*.5,isEntityPreview:true,previewBounds:{width,height}};
  const unit = createSummonedBattleUnit(owner,{...entity.stats,name:entity.name,icon:entity.icon,role:entity.role,ai:entity.ai,speed:entity.ai==='stationary'?0:entity.stats.speed});
  unit.x=width*.2;unit.y=height*.5;
  const dummy = createSummonedBattleUnit({...owner,side:'enemy'}, {...entity.stats,name:'훈련 대상',role:'melee',ai:'stationary',hp:100000,atk:0,magic:0,speed:0});
  dummy.x=width*.7;dummy.y=height*.5;
  if (entity.ai === 'stationary') dummy.x = Math.min(width - UNIT_RADIUS, unit.x + getUnitRange(unit) * 0.8);
  const friend = createSummonedBattleUnit(owner,{...entity.stats,name:'치유 대상',role:'melee',ai:'stationary',hp:100000,atk:0,magic:0,speed:0});
  friend.x=width*.45;friend.y=height*.5;friend.hp=100;
  let shots=[],last=performance.now(),accumulator=0;
  document.getElementById('entityPreviewCaption').textContent='저장 전 독립 전투 미리보기 · 원: 공격 사거리 · 실제 전투와 같은 크기/이동/공격 규칙 · 스탯 변경 후 미리보기를 다시 누르세요.';
  const frame = now => {
    accumulator += Math.min(100,now-last);last=now;
    const previousPlayers=playerSquad, previousEnemies=enemySquad, previousProjectiles=projectiles;
    try {
      playerSquad=[unit,friend];enemySquad=[dummy];projectiles=shots;
      while(accumulator>=1000/60){
        accumulator-=1000/60;
        unit.mp=Math.min(unit.maxMp,unit.mp+1);unit.st=Math.min(unit.maxSt,unit.st+1);
        dummy.hp=dummy.maxHp;dummy.alive=true;friend.hp=Math.min(friend.hp,friend.maxHp/2);
        moveUnit(unit,enemySquad);takeAction(unit,playerSquad,enemySquad);updateProjectiles();updateEffects();
      }
      shots=projectiles;
      pen.clearRect(0,0,preview.width,preview.height);
      pen.save();pen.scale(preview.width/width,preview.height/height);
      pen.strokeStyle='#60a5fa';pen.beginPath();pen.arc(unit.x,unit.y,getUnitRange(unit),0,Math.PI*2);pen.stroke();
      for(const [member,color] of [[unit,'#2563eb'],[dummy,'#dc2626'],[friend,'#16a34a']]){
        const portrait=getCachedPortraitImage(member.portrait);
        const radius=portrait?.complete && portrait.naturalWidth>0 ? UNIT_RADIUS*2.6 : UNIT_RADIUS;
        pen.fillStyle=color;pen.beginPath();pen.arc(member.x,member.y,radius,0,Math.PI*2);pen.fill();
        if(portrait?.complete && portrait.naturalWidth>0) pen.drawImage(portrait,member.x-radius,member.y-radius,radius*2,radius*2);
        pen.font='10px sans-serif';pen.fillText(member.name,member.x,member.y-15);
      }
      for(const shot of shots){pen.fillStyle='#f59e0b';pen.fillRect(shot.x,shot.y,3,3);}
      pen.restore();
      pen.fillStyle='#111827';pen.font='14px sans-serif';pen.fillText(`피해 ${Math.round(unit.stats.damage)} / 치유 ${Math.round(unit.stats.heal)} / 시전 ${(unit.castTimer/60).toFixed(1)}초`,10,20);
    } catch(error) {stopEntityPreview();document.getElementById('entityEditorError').textContent=error.message;return;}
    finally {playerSquad=previousPlayers;enemySquad=previousEnemies;projectiles=previousProjectiles;}
    entityPreviewFrame=requestAnimationFrame(frame);
  };
  entityPreviewFrame=requestAnimationFrame(frame);
}
