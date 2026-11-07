// Rune definitions are independent of classes; effects reuse ordinary skill actions.
let runesJson = [];
let battleRunes = [];
let battleRuneCatalog = null;
const RUNE_EFFECT_TYPES = ["deal_damage","heal","drain_resource","add_buff","add_state","delete_buff","delete_state"];

function normalizeRune(definition) {
  return {id:String(definition.id ?? "").trim(),name:String(definition.name ?? "").trim(),
    radius:Number(definition.radius),interval:Number(definition.interval),
    installationSide:definition.installationSide === "enemy" ? "enemy" : "ally",
    color:/^#[0-9a-f]{6}$/i.test(definition.color ?? "") ? definition.color : "#a78bfa",
    effectSkillId:String(definition.effectSkillId ?? "").trim()};
}

function isRuneDefinitionValid(rune) {
  return /^[a-z0-9_-]{1,80}$/.test(rune.id) && rune.name && Number.isFinite(rune.radius) && rune.radius>=.001 && rune.radius<=100000
    && Number.isFinite(rune.interval) && rune.interval>=1/60 && rune.interval<=100000 && rune.effectSkillId;
}

function getRuneEffectSkill(rune) {
  const skill=getSkillById(rune.effectSkillId);
  return skill && ["active","basic"].includes(skill.slot) && isSkillExecutable(skill)
    && skill.actions.every(action=>RUNE_EFFECT_TYPES.includes(action.type) && ["ally","enemy","self"].includes(action.target)) ? skill : null;
}

async function loadRuneJson() {
  runesJson=(await loadJsonFile("runes")).map(normalizeRune).filter(isRuneDefinitionValid);
}

function getRuneLoadout(unit,passive,catalog=runesJson) {
  const count=Math.max(1,Math.min(10,Math.floor(Number(passive.passiveTrigger?.runeCount) || 3)));
  const selected=unit.skillSelections?.[passive.id];
  const requested=Array.isArray(selected) ? selected : [];
  const defaults=Array.isArray(passive.passiveTrigger?.defaultRuneIds) ? passive.passiveTrigger.defaultRuneIds : [];
  const valid=new Set(catalog.map(rune=>rune.id));
  return [...new Set([...requested,...defaults,...catalog.map(rune=>rune.id)].filter(id=>valid.has(id)))].slice(0,count);
}

function resetBattleRunes() {
  battleRunes=[];
  battleRuneCatalog=runesJson.map(rune=>({...structuredClone(rune),effectSkill:structuredClone(getRuneEffectSkill(rune))}));
}

function installRuneLoadout(owner,passive) {
  if (!owner.alive || owner.isEntityPreview) return;
  battleRuneCatalog ??= runesJson.map(rune=>({...structuredClone(rune),effectSkill:structuredClone(getRuneEffectSkill(rune))}));
  const ids=getRuneLoadout(owner,passive,battleRuneCatalog);
  for (const id of ids) {
    if (battleRunes.some(rune=>rune.owner === owner && rune.loadoutSkillId === passive.id && rune.definition.id === id)) continue;
    const definition=battleRuneCatalog.find(rune=>rune.id === id);
    if (!definition?.effectSkill) continue;
    battleRunes.push({owner,loadoutSkillId:passive.id,definition:structuredClone(definition),x:null,y:null,
      nextTick:Math.max(1,Math.ceil(definition.interval*BASE_ATTACK_COOLDOWN))});
  }
  placePendingRunes();
}

function placePendingRunes() {
  for (const rune of battleRunes.filter(rune=>rune.x === null)) {
    const owner=rune.owner,own=owner.side === "enemy" ? enemySquad : playerSquad;
    const other=owner.side === "enemy" ? playerSquad : enemySquad;
    const candidates=getActiveBattleEntities(rune.definition.installationSide === "enemy" ? other : own);
    const target=rune.definition.installationSide === "ally" && candidates.includes(owner) ? owner
      : candidates.sort((a,b)=>distance(owner,a)-distance(owner,b))[0];
    if (!target) continue;
    rune.x=target.x;rune.y=target.y;
    publishBattleEvents([{type:"rune_install",source:owner,target,skill:{id:rune.loadoutSkillId,name:rune.definition.name}}]);
  }
}

function advanceOwnedRunes(owner,seconds) {
  const ticks=Math.max(0,Math.ceil(seconds*BASE_ATTACK_COOLDOWN));
  for (const rune of battleRunes.filter(rune=>rune.owner === owner && rune.x !== null)) rune.nextTick=Math.max(0,rune.nextTick-ticks);
}

function updateBattleRunes() {
  placePendingRunes();
  for (const rune of [...battleRunes]) {
    if (rune.x === null || --rune.nextTick>0) continue;
    rune.nextTick=Math.max(1,Math.ceil(rune.definition.interval*BASE_ATTACK_COOLDOWN));
    const skill={...rune.definition.effectSkill,triggered:true};
    const executions=new Map();
    for (const action of skill.actions) {
      const own=rune.owner.side === "enemy" ? enemySquad : playerSquad;
      const other=rune.owner.side === "enemy" ? playerSquad : enemySquad;
      const pool=action.target === "self" ? [rune.owner] : action.target === "enemy" ? other : own;
      let targets=getActiveBattleEntities(pool).filter(unit=>distance(rune,unit)<=rune.definition.radius*ATTACK_RANGE_UNIT
        && isActionTargetEligible(rune.owner,unit,action,skill));
      targets.sort((a,b)=>distance(rune,a)-distance(rune,b));
      if (action.maxTargets>0) targets=targets.slice(0,action.maxTargets);
      for (const target of targets) {
        if (!executions.has(target)) executions.set(target,createSkillExecutionContext());
        applySkillAction(rune.owner,target,{...action,
          area:0,chainCount:0,splashPercent:0,splashRadius:0,battlefieldArea:false,originEntityId:"",_origin:undefined,periodic:true},skill,executions.get(target));
      }
    }
    publishBattleEvents([{type:"rune_tick",source:rune.owner,skill:{id:rune.loadoutSkillId,name:rune.definition.name}}]);
  }
}

function drawBattleRunes() {
  for (const rune of battleRunes.filter(rune=>rune.x !== null)) {
    ctx.save();ctx.strokeStyle=rune.definition.color;ctx.fillStyle=rune.definition.color;ctx.globalAlpha=.08;
    ctx.beginPath();ctx.arc(rune.x,rune.y,rune.definition.radius*ATTACK_RANGE_UNIT,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.65;ctx.stroke();
    ctx.globalAlpha=1;ctx.font="18px sans-serif";ctx.textAlign="center";ctx.fillText("◇",rune.x,rune.y);
    ctx.font="11px sans-serif";ctx.fillText(`${rune.definition.name} · ${(Math.max(0,rune.nextTick)/BASE_ATTACK_COOLDOWN).toFixed(1)}초`,rune.x,rune.y-15);ctx.restore();
  }
}

function renderRuneChoices(characterId,selections,scope) {
  const character=characterJson[characterId];
  const passives=(character?.skillIds ?? []).map(getSkillById).filter(skill=>skill?.slot === "passive" && skill.passiveTrigger?.runeCount>0);
  return passives.map(passive=>{
    const ids=getRuneLoadout({skillSelections:selections},passive);
    return `<fieldset class="rune-choice-panel"><legend>룬 선택 · ${escapeHtml(character.name)} (${ids.length}개)</legend><p>전투 진입 시 설치할 서로 다른 룬을 고르세요.</p>${ids.map((selected,index)=>
      `<label>룬 ${index+1}<select onchange="setRuneChoice('${scope}',${characterId},'${escapeHtml(passive.id)}',${index},this.value)">${runesJson.map(rune=>`<option value="${escapeHtml(rune.id)}" ${selected === rune.id ? "selected" : ""} ${ids.includes(rune.id) && rune.id !== selected ? "disabled" : ""}>${escapeHtml(rune.name)}</option>`).join("")}</select></label>`).join("")}</fieldset>`;
  }).join("");
}

function setRuneChoice(scope,id,skillId,index,runeId) {
  if (isBattleRunning) return;
  const store=scope === "prebattle" ? selectedPreBattleSkillChoices : duelSkillChoices[scope];
  if (!store) return;
  const passive=getSkillById(skillId),ids=getRuneLoadout({skillSelections:store[id]},passive);
  if (!runesJson.some(rune=>rune.id === runeId) || ids.some((value,i)=>i !== index && value === runeId)) return;
  ids[index]=runeId;store[id] ??= {};store[id][skillId]=ids;
  if (scope === "prebattle") rebuildPlayerSquadFromSelection();
  else {playerSquad=createDuelSquad("player");enemySquad=createDuelSquad("enemy");renderBattleSelectionSummary();}
}

function renderRunePage() {
  const list=document.getElementById("runeList");
  list.innerHTML=runesJson.map((rune,index)=>`<tr><td>${escapeHtml(rune.name)}</td><td>${rune.radius}m</td><td>${rune.interval}초</td><td>${rune.installationSide === "enemy" ? "적" : "아군"}</td><td>${escapeHtml(getSkillById(rune.effectSkillId)?.name ?? "효과 스킬 없음")}</td><td><button onclick="editRune(${index})">수정</button></td></tr>`).join("");
  const select=document.getElementById("runeEffectSkill");const selected=select.value;
  select.innerHTML=skillsJson.filter(skill=>getRuneEffectSkill({effectSkillId:skill.id})).map(skill=>`<option value="${escapeHtml(skill.id)}">${escapeHtml(skill.name)}</option>`).join("");
  if ([...select.options].some(option=>option.value === selected)) select.value=selected;
}

function editRune(index=-1) {
  const form=document.getElementById("runeForm");form.reset();form.elements.editIndex.value=index;
  const rune=runesJson[index];
  if (rune) for (const key of ["id","name","radius","interval","installationSide","color","effectSkillId"]) form.elements[key].value=rune[key];
  form.elements.id.readOnly=Boolean(rune);
}

async function saveRune(event) {
  event.preventDefault();const form=event.target;if (!form.reportValidity()) return;
  const rune=normalizeRune(Object.fromEntries(new FormData(form))),index=Number(form.elements.editIndex.value);
  if (!isRuneDefinitionValid(rune) || !getRuneEffectSkill(rune)) {alert("룬 설정과 발동효과 스킬을 확인해주세요.");return;}
  if (runesJson.some((entry,i)=>entry.id === rune.id && i !== index)) {alert("이미 사용 중인 룬 ID입니다.");return;}
  const next=runesJson.map(entry=>({...entry}));if (index>=0) next[index]=rune;else next.push(rune);
  const button=form.querySelector('[type="submit"]');button.disabled=true;
  try {await saveJsonFile("runes",next);runesJson=next;renderRunePage();editRune();}
  catch(error){logError("runes","룬 저장 실패",error);alert("룬 저장에 실패했습니다.");}
  finally {button.disabled=false;}
}
