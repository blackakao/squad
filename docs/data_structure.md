# 데이터 구조

## 공작·반복 부활/조건부 실행 (2026-11-11)

- `passiveTrigger.revival`: `{delay,position:start|death,countsWhileWaiting,hpPercent,mpPercent,stPercent,restoreBaseBp}`. 액션 없는 상시 패시브다. 런타임 `unit.revivalState`에 사망 시 설정을 보관하며 부활 완료/전투 초기화 시 비운다. `battleStartX/Y`를 재사용하고 `battleDeathX/Y`를 사망 시 저장한다. 이 런타임 필드는 캐릭터 저장에 추가하지 않는다.
- `skill.activation`: `{selfHpAtMost,nearbyEnemyRadius}`. 자기 HP 비율은 최대 HP 기준/이하 경계 포함이고 시작·완료 때 검사한다. `selfDestruct:true`는 피해 적용 후 보호막/무적을 거치지 않는 강제 사망, `revivalOnly:true`는 생존 중 시전 제외/사망 시 부활 단축이다. `cooldownReductions:[{skillId,seconds}]`는 해당 사용 완료 후 남은 쿨다운을 줄인다.
- `selectionModifier`에 `resourceCostAdd`(비용 모드의 단위, maxPercent면 %p), `revivalDelayAdd`(초), `revivalPosition`, `selfHpAtMost`, `cooldownReductions`를 추가했다. 기본 가산 0/위치 빈 값/HP 조건 null/감소 배열 빈 값으로 구형 데이터 동작을 유지한다.
- `effect.mode: damage_link`는 효과 시전자가 실제 받은 피해 중 value%를 표식 대상에게 전달한다. 런타임 damageLinked 플래그로 추가 전달을 막으며 일반 피격 이벤트를 재사용한다. 일반 피해/치명 피해의 HP/BP 실제 집계 후 실행한다.
- 패배 상태는 `getUnitBattleForm(unit).countsForDefeat:false` 또는 사망·부활 대기의 `revivalState.countsWhileWaiting:false`다. 살아있는 공작은 포함하지 않는다. 공통 승패 판정은 상태 타이머보다 먼저 실행한다. [현행 계약](SKILL_ENGINE.md#공작반복-부활공통-패배-상태-2026-11-11).

## 영혼수확자·치명상 전환/형태별 스킬 (2026-11-09)

- 패시브 `passiveTrigger.lethalTransformation`: `{duration,bodyName,bodyReceivedDamagePercent,bodyBasicAttack?,transform}`. duration은 초(최소 1, 기본 10), bodyReceivedDamagePercent 기본 100이다. 액션 없는 상시 패시브로 처리하고 일반 발동 액션과 분리한다.
- 기존 transform에 선택 `untargetable`, `damageImmune`, `blockHealing`, `basicAttackDisabled`, `countsForDefeat:false`, `movementTarget:injured_ally`, `returnHpPercent`(0~100), `skillReplacements:[{skillId,replacementSkillId}]`를 추가했다. 생략하면 기존 변신 동작이다.
- 런타임 변신 `lifeCycle:true`는 HP 0 생존과 치명상 중복 진입 방지에 쓰며 해제할 수 없다. 변신 만료 시 returnHpPercent로 HP를 복원한다. 캐릭터에 별도 형태/HP/타이머 필드를 저장하지 않는다.
- 치환 실행본의 id는 장착한 원래 스킬 ID, formVariantId는 실제 변형 정의 ID다. 쿨다운은 원본 ID 하나를 공유하고 데이터 원본은 변경하지 않는다. 영혼입김 정의는 internal true다. [실제 수치·판정](SKILL_ENGINE.md#영혼수확자치명상-형태-전환-2026-11-09).

## 각질형·시간제 보호막 (2026-11-09)

- `effect.maxStacks`, `stackBonuses.minStacks` 범위를 1~100으로 확장했다. 보정의 선택 필드 `perNStacks`(1~100)는 현재 스택을 N으로 나눈 정수 몫을 곱한다. 생략 시 기존 perStack 동작이다. attack_rate_percent는 -100 이상을 허용하고 최종 배율 0.1 하한을 적용한다.
- `passiveTrigger.meleeOnly`는 실제 피격 이벤트의 melee 분류를 검사한다. 이벤트 melee는 공격 사거리 1m 이하 적의 직접 피해이며 주기/반사/반격을 제외한다. `sourceEffectIdStacks` 계수는 effectId와 연결한 시전자 중첩을 참조한다. 반사 액션의 reflected 플래그는 정규화·편집에서 보존한다.
- `effect.mode: barrier`, `value`, `barrierMode: maxPercent|fixed`, `breakSkillId`를 추가했다. 적용 시 대상 최대 HP 비율 또는 고정량을 shieldInitial/shieldRemaining에 저장하고 시간제 효과로 관리한다. 일반 bp/maxBp 필드는 그대로이며 화면/피해 집계는 시간제 잔량을 합산한다. 런타임 잔량은 캐릭터 데이터에 저장하지 않는다.
- `skill.internal: true`는 반응 전용 스킬을 일반 캐릭터 장착/시전 후보에서 제외한다. 스킬 관리에서 편집 가능하며 보호막이 참조하는 반응 스킬은 UI 삭제를 막는다. `barrier_break` 이벤트는 파괴 반응 실행을 기록한다. [현행 동작](SKILL_ENGINE.md#각질형단계별-스택파괴-반응-보호막-2026-11-09).

캐릭터의 `skillSelections`는 선택형 스킬 ID → 옵션 ID 문자열의 기본 선택 맵입니다. 캐릭터 상세 창에서 저장하며 런타임 생성 시 팀/전투별 선택으로 덮어씁니다. 생략 시 기존 스킬의 기본 옵션을 사용합니다.

## 외부자원 관리 표시 (2026-11-09)

Entity의 선택 불리언 `mainSummon`은 전투 상태창의 주인 아래 표시 여부다. 생략하면 기존 ID별 표시 정책을 유지한다. 신규 관리 분류는 기존 `tags`의 `external:spirit`, `external:beast`, `external:engineer`, `external:puppet`, `external:demon`으로 보존한다. 룬 저장 형식은 변경하지 않는다. [관리 규칙](ENTITIES.md#외부자원-관리-2026-11-09).

## 캐릭터 선택 강화·혈청형 (2026-11-09)

- 스킬 `slot: optional`은 직접 시전하지 않는 선택 강화다. 캐릭터 `skillIds`에 선택한 최대 3개 ID만 기존 기본 스킬 ID와 함께 저장한다. 미선택 항목은 저장하지 않는다. 구형/외부 데이터에 4개 이상 있으면 전투에서 앞의 3개까지만 인정한다.
- `selectionModifier`의 기존 targetSkillIds·비율 보정에 `castTimeAdd`, `cooldownAdd`(초), `fieldRadiusAdd`(m), `additionalActions`(일반 액션 배열)를 추가했다. 기본 가산 0/배열 빈 값이며 원본을 변경하지 않는다.
- `channel.pulseResourceCosts`: 일반 `{resource,mode,value}` 배열, 매회 지불 후 그 회차 실행 컨텍스트의 resourceSpent에 전달한다. 생략/빈 배열은 이전 채널 동작이다.
- 액션 `noDamageSeconds`(기본 0), `fieldFollowSource`(기본 false), `fieldStoreHpPercent`(기본 0). 필드별 런타임 storedHp와 유닛 undamagedTicks는 전투 상태이며 캐릭터 저장 필드가 아니다. 계수 `maxHp`를 추가했다. [동작과 수치](SKILL_ENGINE.md#혈청형-개편캐릭터-선택-강화-2026-11-09).

## 정령 생산·소환 비용 확장 (2026-11-09)

- `passiveTrigger.repeatInterval`: 생존·참전 중 반복 액션 발동 주기(초), 0/생략은 비활성. 전투 진입 이벤트와 별도로 실행한다.
- `skill.summonCost`: `{entityId, choiceSkillId, count}`. 선택 스킬이 있으면 선택된 패시브의 summon_entity Entity를 재료로 해석한다. 시전 가능 검사와 완료 시 원자적 소모에 사용한다.
- 소환 액션 `entityChoiceSkillId`는 종류 선택을 연결하며 `entityId`는 기본값이다. `limitScope: entity`는 자신이 생성한 동일 Entity를 모든 소환 스킬에 걸쳐 합산한다. 기본 skill은 이전처럼 소환 스킬별 집계다.
- Entity `skillIds`(선택 스킬 ID 배열), `basicAttackDisabled`(선택 boolean, 기본 false). 스킬 삭제/Entity 저장 시 참조를 검증한다. `ownerMagic` 계수는 현재 소환자 마력이다.
- `effect.mode: attribute`/`stat: str|int`는 기본 능력치 가산이며 stackBonuses에도 사용한다. `effect.dispelKinds: [buff,state]`는 통합 검사, `dispelLimit`(0/생략 전체)은 대상별 해제 수 제한이다. [동작 계약](SKILL_ENGINE.md#정령술사-개편-2026-11-09).


## 모든 시전시간 보정 (2026-11-07)

- `effect.mode: "cast_time_percent"`, `stat: "castSpeed"`, 유한 `value >= -100`. 음수는 단축, 양수는 증가다. `stackBonuses`에도 동일 모드/능력치 조합을 저장한다.
- 합산값은 런타임 `effectCastTimeMultiplier`로 환산한다. 기본 castSpeed 능력치와 구분해 명시적 스킬·기본 행동·독립 무기에 한 번 적용하며 런타임 값은 스킬 정의에 저장하지 않는다. [동작·중첩·기존 호환](SKILL_ENGINE.md#응원가모든-시전시간-보정-2026-11-07).


## 룬 정의와 전투 객체 (2026-11-07)

- `data/runes.json`: 배열. 각 정의는 `id`(소문자 영숫자/_/- 1~80자, 유일), `name`, `radius`(양수 m, 최대 100000), `interval`(1/60~100000초), `installationSide`(ally/enemy), `color`(#RRGGBB), `effectSkillId`를 갖는다. 스킬의 효과 액션을 참조해 확장한다.
- `passiveTrigger.runeCount`(1~10), `defaultRuneIds`(룬 ID 배열), `unit.skillSelections[passiveId]`(선택 룬 ID 배열)를 사용한다. 다른 선택 스킬의 문자열 값은 그대로 유지한다.
- 액션 `install_runes`는 선택 정의를 설치한다. `advance_runes.runeAdvanceSeconds`(0 이상 초)는 직전 피해가 양수일 때 자기 룬들의 다음 발동을 앞당긴다.
- 런타임 `battleRunes`는 소유자·고정 좌표·`nextTick`·정의/효과 스냅샷을 보관하며 사용자 데이터에는 저장하지 않는다. 자동 전투 `inputSnapshot.runes`에 정의를 포함한다. [세부 계약](SKILL_ENGINE.md#독립-룬-시스템룬술사-2026-11-07).


## 인형술사 확장 (2026-11-07)

- Entity `ownerDiesOnDeath`: 선택 불리언, 기본 false. `receivedDamagePercent`: 선택 유한 숫자 0~100000, 기본 100. 런타임은 `entityReceivedDamagePercent`로 보관한다.
- `passiveTrigger.healingCurseDuration`: HP 실제 치유량 기반 저주의 유지 초, 0/생략은 비활성. 효과 `mode: heal_absorb`, `value`: 초기 흡수량, `absorbRemaining`은 런타임 전용이다.
- 효과 `mode: basic_echo`, `value`: 기본 공격 실제 피해 대비 추가타 %, `echoHealPercent`: 버프 중 실제 피해 대비 자기 치유 %, 기본 100.
- 명령 액션 `summonCommand: attack`, `originEntityId`, `commandHealRadius`(m), `commandHealPercent`(실제 피해 대비 %)를 사용한다. [세부 계약](SKILL_ENGINE.md#인형술사-2026-11-07).


## 화염술사 누적 피해 확장 (2026-11-07)

- 패시브 액션의 `effect.mode: "damage_pool"`, `value`(기준 피해의 양수 %), `maxStacks`(2 이상), `stackMode: "stack"`, 양수 `action.duration`을 사용한다. 대상/시전자별 `poolRemaining`, `poolPulseTicks`는 전투 중에만 생성한다.
- 계수 `field: "missingMp"`는 현재 부족한 MP다. `settledDamage`는 이미 보정한 누적 피해 지급용 내부 플래그이며 편집·JSON 정의에는 노출하지 않는다. [계약](SKILL_ENGINE.md#화염술사-개편-2026-11-07).


## 저격수 개편 확장 (2026-11-07)

- `passiveTrigger.event: "alone"`: `aloneRadius`(양수 m, 기본 5), `aloneLossDuration`(양수 초, 기본 2), `aloneLossDamagePercent`(0 이상, 기본 130). 조건 유지 중 패시브 액션 버프 적용, 상실 후 받는 피해 규칙 적용.
- 버프 `effect.mode: "stealth"`, `effect.breakOnAttack: boolean`(기본 false). 직접 타겟 제외와 공격 실행 시 해제.
- `action.transform.damageExitStun`: 0 이상 초, 기본 0(기존 동작 유지). 실제 피해 시 형태 해제·기절. [상세 계약](SKILL_ENGINE.md#저격수-개편-2026-11-07).


### 수도승 중첩 보정 필드 (2026-11-07)

- 버프 `effect.mode: attack_rate_percent`, `stat: attackSpeed`, `value`는 공격속도 증감률이다. 2026-11-09부터 음수(-100 이상)도 지원한다. 기존 공격 간격 percent 보정과 구분한다.
- 선택 배열 `effect.stackBonuses`(기본 빈 배열, 최대 20개): `{ stat, mode, value, minStacks, perStack }`. minStacks는 1~100 정수, perStack 기본 false다. 기준 중첩 이상에서 전체 중첩 수를 곱하거나 한 번 적용하며 별도 효과 인스턴스·타이머를 만들지 않는다.
- 연환은 `skill_class_ascetic_chain`의 단일 `ascetic_chain` 버프다. 본체는 atk +1%/중첩, 보정은 공격속도 +2%/중첩과 10중첩 이동속도 +20%다. 최대 중첩 10·갱신 5초.
- 퇴마공 `skill_class_ascetic_exorcism`은 기존 `combo` 스키마로 3단계를 저장한다. 수도승 캐릭터의 기존 데이터에 두 스킬 ID만 추가했으며 저장 API는 변경하지 않았다.
- `effectAttackRateMultiplier`는 독립 무기 주기에도 적용하기 위한 전투 파생값이며 사용자 JSON에 저장하지 않는다.

### 별소환사 지원 필드 (2026-11-06)

- Entity 선택 불리언 `commandOnly`(기본 false), `targetable`·`collidable`(기본 true). `star_companion`은 true/false/false다. 기존 Entity 파일은 일괄 변경하지 않는다. 서버는 해당 필드가 있으면 불리언만 허용한다.
- 액션 `originEntityId`(기본 빈 문자열)는 시전자가 직접 소유한 해당 Entity들을 기준점으로 지정한다. 별 정의는 `data/entities/star_companion.json`, 스킬 ID 접두사는 `skill_class_star_`다. 새 캐릭터 별소환사를 추가했으며 궁극기 데이터는 추가하지 않았다.
- `summonCommand`에 `relocate`·`suspend`를 추가했다. 명령의 `target`은 기존 summon 외 enemy·self를 허용한다. `pathWidth`는 이동 경로 피해의 폭(m), `duration`은 숨김 초, `suspensionEffectId`는 숨김을 유지할 시전자 버프 ID다. 생략 시 독립 시간제를 사용한다.
- 피해 액션 `battlefieldArea`(기본 false), `distanceFalloff: {step, percent, minimum}`(거리 간격 m·간격당 감소 %p·최소 계수 %)를 지원한다. step 0은 감쇠 없음이다.
- `transferDrainedResource`(기본 false)는 실제 감소한 자원을 시전자의 최대치까지 회복한다. 추적 필드의 기준 객체 참조와 숨김 타이머·연결 버프는 전투 런타임 전용이다. 기존 API 경로와 JSON 최상위 형식은 유지한다.

### 몽마 지원 필드 (2026-11-05)

- 캐릭터·몬스터·Entity의 선택 필드 `entityGrade`: 1~10 정수, 생략 기본값 2. 기존 파일을 일괄 변경하지 않는다. 캐릭터·몬스터 정규화와 전투 유닛 생성, Entity 편집·서버 검증·소환 생성에 전달한다.
- 액션 `targetMaxGrade`: 최대 허용 숫자 등급, 0은 제한 없음. `requirePreviousDamage`: 직전 액션의 실제 피해 대상만 후속 액션 허용(기본 false).
- 상태 `sleep`·`charm`. `effect.breakDamagePercent`는 적용 순간 최대 HP 대비 누적 피해 해제 비율, 기본 0(해제 없음). `effect.hitThreshold`는 시전자·대상·효과별 적용에 필요한 횟수, 기본 1이다.
- 패시브 `requiredTargetState`(기본 false), `stateDurationExtension`(초, 기본 0), `preserveSleep`(기본 false). 무한한 꿈은 기존 `damageMultiplierPercent: 120`과 함께 사용한다.
- 버프 `mode: disguise`: 적 외형 위장과 새로운 직접 대상 선정 제외. 복사한 초상화·피해 누적·적중 횟수는 전투 런타임 전용이며 사용자 JSON에 저장하지 않는다.

### 광대 지원 필드 (2026-11-05)

- 소환 액션: `copyAppearance`·`retreatBehindSummons`(기본 false), `inheritMode`(`add` 기본 / `replace`). 능력치 비율은 기존 `inheritStats`를 사용한다. `jester_clone` Entity를 추가했다.
- 상태: `disarm`(기본 공격 차단), `flee`(도주), `polymorph`(양 외형·기본 공격 차단·침묵·도주). 선택적 `effect.movementSpeedPercent`는 상태와 함께 해제되는 이동속도 보정이며 생략 기본값은 100이다. 음메에에는 50을 사용한다.
- 버프: `mode: melee_reaction`, `reactionSkillId`(실행할 보조 스킬 ID). 광대의 반응 보조 스킬은 `slot: basic`이며 캐릭터 `skillIds`에 넣지 않는다.
- 패시브: `passiveTrigger.skillOnly`(기본 false). 계수 `triggerMpSpent`는 완료 이벤트의 실제 MP 비용, `magicPerMovedMeter`는 마력 × 같은 실행의 마지막 이동 액션 거리(m)를 참조한다.
- 피해 액션: `armorMultipliers: { plate, chain, leather, cloth }`는 선택적 음수 없는 배율이다. 생략한 유형은 1이다. 전투 유닛의 `armorCategory`는 장비에서 파생하며 사용자 캐릭터 JSON에 추가하지 않는다.
- 완료 이벤트: 읽기 전용 `resourceSpent` 객체를 추가했다. 기존 저장 API와 JSON 최상위 형식은 유지한다.

## 이동·규칙 액션 확장

- 순간이동 액션의 선택 필드 `movePlacement`는 `target` 또는 `behind`이다. 누락된 기존 데이터는 `target`으로 정규화한다.
- `override_rule.target`은 `self`, `ally`, `enemy`를 지원한다. 기존 데이터의 기본값은 `ally`이다.

## 스킬·시너지 개별 그림

소환수는 별도 `portrait` 필드를 만들지 않고 `data/entities/<id>.json`의 기존 `icon`에 `assets/images/entities/파일명`을 저장한다. 빈 값은 기본 도형 표시이며 전투 유닛 생성 시 `portrait`로 전달한다. [편집·외형 복제 규칙](ENTITIES.md).

`data/skills.json`과 `data/synergies.json` 레코드는 선택적 `icon` 문자열을 가진다. 값은 `assets/images/skills/파일명` 또는 `assets/images/synergies/파일명`이며 빈 문자열/필드 생략은 그림 없음이다. 스킬 정규화는 이 필드를 보존한다. 기존 데이터를 일괄 수정하지 않는다. 공통 `iconMappings`와는 별개이며 전투 계산 필드가 아니다. [그림 API·수명](RECORD_IMAGES.md).

## 종합전투력 파생값

캐릭터·아이템 JSON과 API 스키마는 변경하지 않습니다. 종합전투력은 현재 빌드에서 재계산하며 combatPower 필드를 저장하지 않습니다. 계산 결과는 version/total/rawTotal/contributions/normalized/metrics, 빌드 어댑터는 finalStats를 추가로 반환합니다. 분석용 문서 JSON만 공식 설정·입력 해시·38명 계산 스냅샷·과거 비교를 보관합니다. [계약·제외 범위](balance/COMBAT_POWER.md), [분석 스냅샷](balance/COMBAT_POWER_RESULTS.json).

## 공용 스탯 시너지

`data/synergies.json`은 `id`, `name`, `condition:{type,value}`, `stacking:highest|cumulative`, `thresholds:[{count,effects:[{type:stat,stat,value,target:team|matching}]}]` 배열이며 `GET/PUT /api/synergies`로 저장합니다. ID는 이름 수정과 독립적입니다. 조건 키는 기존 faction 문자열 또는 role 코드입니다. 캐릭터·팀 스키마는 바꾸지 않습니다.

런타임 `synergySources`는 출처와 효과를 추적하며 저장하지 않습니다. 일반 기록과 시뮬레이터 개별 전투 결과에는 `activeSynergies:{player:[{id,name,count}],enemy:[{id,name,count}]}`를 저장합니다. 시뮬레이터 입력 스냅샷의 `synergies`가 없으면 빈 목록으로 호환합니다. [전체 계약과 검증 경계](synergy/SYNERGY_SYSTEM.md).

이 문서는 저장·런타임 데이터의 요약입니다. 액션 세부 필드는 [스킬 엔진](SKILL_ENGINE.md), 개체 검증과 참조 규칙은 [Entity](ENTITIES.md), 외형 메타데이터는 [초상화 조합](PORTRAIT_COMPOSER.md)과 [외부 SD 모델](IMPORTED_SD_MODELS.md)을 함께 확인합니다.

## 저장 위치와 API

2026-11-03 실행 설정 `workers`를 추가했습니다. 시작 요청의 0은 자동, 1~8은 요청 동시 계산 수이며 생략은 0입니다. 실제 `result.json.settings.workers`에는 CPU/총 전투 수에 맞춰 결정한 수를 저장합니다. 진행/이력의 `workers`도 실제 수입니다. 기존 기록의 누락값은 1입니다. 병렬 중단 시 결과 배열에 battleId 번호 간격이 생길 수 있으며 원래 번호순으로 정렬합니다. journal은 완료순이고 completed는 실제 회수한 전투 수입니다.

2026-11-03부터 시뮬레이션 `summary.matchups`에 `version:1`, `battles`(유효 1:1 수), `excludedBattles`, `minSamples`, `possiblePairs/measuredPairs/sufficientPairs`, `classes`를 추가합니다. 클래스 행은 characterId/name/role 및 battles/wins/losses/draws/timeouts/winRate/lowSample, `opponents`(opponentId/name/role별 같은 통계), `roles`(상대 role별 같은 통계)를 가집니다. 미측정 winRate는 null, 측정했지만 승리 없음은 0입니다. 조합 수는 순서 없는 두 클래스 쌍이며 자기 대결은 제외합니다. 기존 원본에는 이 필드가 없어도 되며 브라우저가 저장된 결과로 재집계합니다. 로컬 의견은 파생 문장으로 저장 필드를 추가하지 않습니다. [집계 의미](balance/SIMULATION_GUIDE.md#클래스-상성과-로컬-의견).

밸런스 시뮬레이터는 `balance/results/<UTC>_<횟수>.json`에 실행 메타데이터·게임 입력 스냅샷·전투별 결과·집계 결과를 별도로 저장합니다. `schemaVersion: 1`이며 캐릭터 인덱스, seed, 승자, timeout, 가상 전투시간, 실제 피해·HP 회복·받은 피해·생존시간·시전 이벤트별 수치를 포함합니다. 게임 JSON/API 스키마와 `battle-records.json`은 변경하지 않습니다. [정확한 필드와 집계 정의](balance/SIMULATION_GUIDE.md#지표와-저장-형식)를 참고합니다.

웹 실행은 `balance/jobs/<simulationId>/`에 저장합니다. `request.json`은 settings/inputSnapshot/targetMarkdown, `job.json`은 simulationId/startedAt/finishedAt/status/settings/completed/total/elapsedSeconds/error/resultUrl 및 완료 후 dataHash/engineHash/gitRevision/averageDuration을 보존합니다. 상태는 RUNNING → COMPLETED/FAILED, 중단 요청 시 CANCELLING → CANCELLED입니다. `result.json`은 CLI와 같은 원본 결과에 status/error/completed/finishedAt을 포함하고, `report.md`는 보조 보고서, `battles.ndjson`은 완료 전투 journal, `error.log`는 개발 로그, `cancel`은 중단 요청 표식입니다. 0회 중단도 유효한 결과입니다. 서버 종료로 결과 파일이 없으면 FAILED로 표시하고 journal을 보존합니다. 자동 재실행은 하지 않습니다.

`GET /api/simulations/<id>/result`는 대시보드용으로 inputSnapshot/results를 제외하고 summary와 목표 스냅샷을 반환합니다. 원본은 `/json`에서 조회합니다. 목표의 단일 원본은 `docs/balance/BALANCE_TARGETS.md`이며 `/api/simulation-targets` PUT은 해당 표만 수정합니다. 각 실행이 목표를 복사하므로 과거 비교는 수정되지 않습니다. 기존 CLI 기록에 목표 스냅샷이 없는 경우에만 현재 목표를 사용하며 화면에서 구분합니다.

이미지 사용자 스타일은 `data/image-styles.json` 배열에 저장하며 `GET/PUT /api/image-styles`를 사용합니다. 항목 필드는 `id`(UUID 문자열), `name`(1~80자, UI에서 중복 방지), `stylePrompt`(스타일 문장), `updatedAt`(ISO 시각)입니다. 파일 부재 시 빈 목록을 반환하고 최초 저장 시 생성합니다. 마지막 생성 설정 객체와 별도로 관리합니다. [사용법](IMAGE_GENERATION.md)

대부분의 데이터는 `data/*.json`에 배열 형태로 저장됩니다. `server.py`는 `/api/<name>` 요청을 `data/<name>.json`에 매핑하고, `/api/records`만 `data/battle-records.json`에 매핑합니다.

예외적으로 이미지 생성 설정은 객체 형태의 `data/image-generator-settings.json`에 저장되고, Entity는 `data/entities/<entityId>.json` 파일 단위로 저장됩니다.

이미지 생성 설정은 `GET/PUT /api/image-settings`, Entity는 `/api/entities/` 계열을 사용합니다. 일반 배열 저장 API와 본문 형식·메서드가 다릅니다. 스킬 및 Entity 조회 시 기존 소환 정의가 자동 이전될 수 있습니다.

## Character

아이템의 선택적 `statModifiers`는 스탯 키→가산값의 sparse 객체, `skillModifiers`는 `{skillId,target,signature,value}` 배열입니다. 누락은 빈 보정이며 기존 평면 능력치와 `attackSkillId`를 유지합니다. 캐릭터 저장 `attributes`는 기본 배분값, 전투 `attributes`는 장비 보정 후 값입니다. 세트 스냅샷은 `attributes`·`itemSkillModifiers`를 포함합니다. [허용 대상·단위·참조 정책](ITEM_MANAGEMENT.md).

파일: `data/characters.json`

주요 필드:

- `name`: 캐릭터 이름
- `hp`, `mp`, `st`, `bp`: 기본 자원
- `atk`, `magic`, `speed`, `attackSpeed`, `castSpeed`: 공격/시전/이동 관련 능력치
- `defense`, `resistance`: 물리/마법 피해 감소율
- `attackRange`: 기본 사거리 단위
- `attackType`: 기본 공격 타입
- `role`: `tank`, `melee`, `ranged`, `healer`, `special`
- `faction`: 진영 이름
- `skillIds`: 장착 스킬 ID 배열
- `portrait`: `assets/images/portraits/*` 경로 또는 빈 문자열
- `customResources`: 사용자 정의 자원 배열, 스킬에서 `custom:<id>`로 참조
- `appearance`: 선택적 3D 외형 조합 메타데이터. `version`, 모델 `base`, `hair`, `hairColor`, `eyes`, `eyebrows`, `nose`, `mouth` 등 파츠 ID를 사용합니다. 예전 데이터에 `hairColor` 또는 `eyebrows`가 없으면 각각 `hc1`, `brow1`로 정규화합니다.
- `attributes`: `str`, `vit`, `agi`, `focus`, `int`, `wis` 기반 스탯
- `equipmentRules`: 추가 무기 슬롯, 양손 무기 슬롯 규칙, 동일 대상 다중 무기 감산 규칙
- `battleRules`: 진입 지연, 부활 횟수, 부활 대기, 부활 시 자원 비율, 무적 시간, 부활 위치
- `equipment`: 현재 장착 아이템 ID 맵
- `equipmentSets`: 최대 3개 장비 세트
- `activeEquipmentSet`: 현재 활성 장비 세트 인덱스

전투 시작 시 `character.js`의 `createCharacter`가 Character 데이터를 전투 유닛으로 변환합니다. 장비와 스탯은 `applyCharacterStatAbilities`, `getCharacterEquipmentBonus`, `getCharacterWeaponAttacks` 흐름을 통해 반영됩니다.

## Monster

파일: `data/monsters.json`

주요 필드:

- `label`: 몬스터 이름
- `hp`, `mp`, `st`, `bp`
- `atk`, `magic`, `speed`, `attackSpeed`, `castSpeed`
- `defense`, `resistance`, `attackRange`
- `role`
- `skillIds`
- `portrait`
- `customResources`: 사용자 정의 자원 배열

전투 시작 전 `monster.js`의 `createEnemy`가 Monster 데이터를 적 전투 유닛으로 변환합니다.

## Battle

전투 런타임 데이터는 파일에 직접 저장되지 않고 브라우저 메모리의 `playerSquad`, `enemySquad`, `projectiles`, `battleFields`, 전투 이벤트 배열에 유지됩니다.

전투 유닛 주요 필드:

- `id`, `side`, `role`, `name`, `faction`
- `hp`, `maxHp`, `mp`, `maxMp`, `st`, `maxSt`, `bp`, `maxBp`
- `customResources`
- `atk`, `magic`, `defense`, `resistance`, `speed`, `attackSpeed`, `castSpeed`, `attackRange`, `attackType`
- `skillIds`, `skillCooldowns`, `attackSkillId`
- `weaponAttacks`, `weaponAttackStates`
- `battleRules`, `equipmentLoadouts`, `activeEquipmentSet`
- `x`, `y`, `vx`, `vy`, `alive`, `isWaiting`, `isReserve`, `isSummon`
- `pendingAction`, `castTimer`, `castDuration`, `channelAction`
- `activeEffects`, `runtimeRuleOverrides`
- `stats`, `actualDamageTotal`, `moveDistanceTotal`

전투 기록 파일: `data/battle-records.json`

전투 기록 주요 필드:

- `battleAt`: ISO 날짜 문자열
- `result`: 승리, 패배, 무승부 등 결과 문자열
- `playerMembers`: A팀 멤버 결과 배열 (기존 저장 키 유지)
- `monsterMembers`: B팀 멤버 결과 배열 (기존 저장 키 유지)
- `durationSeconds`: 새 기록은 진행한 전투 틱 / 60
- `contributionVersion`: 새 소유자 집계는 1, 이전 기록은 0
- `events`: 최근 최대 1,000개 상세 전투 이벤트

멤버 결과는 `name`, `role`, `hp`, `maxHp`, `mp`, `maxMp`, `st`, `maxSt`와 소유자 합계 `damageDealt`, `healingDone`, `kills`, `dps`, `hps`, 전투별 `eventId`, `contribution`을 저장합니다. `contribution`의 `direct/summon/total/groups`는 본체·소환·합계·템플릿/종류별 기여도입니다. DPS/HPS는 합산 누적량/전투시간입니다. 이전 기록은 소유 관계를 추측하지 않고 보존하며 없는 `events`는 빈 배열입니다. [저장 규칙과 호환성](BATTLE_CONTRIBUTIONS.md).

멤버의 선택 필드 `portrait`는 새 기록에서 전투 당시 초상화를 보존합니다. 이전 기록은 이름이 일치하는 현재 캐릭터 또는 몬스터의 초상화를 표시하고, 없으면 이름 첫 글자를 표시합니다. 목록은 계열 아이콘과 잔여 HP 비율 막대를 표시하며 막대 안의 숫자는 DPS와 HPS입니다. HP가 0이면 빈 막대에 `HP 소진`, 최대 HP가 없으면 `HP 정보 없음`을 표시합니다. HP 원본 수치와 기여도 데이터는 유지합니다.

전투 이벤트 주요 필드:

- `id`, `tick`, `type`
- `source`, `target`
- `skillId`, `skillName`
- `amount`, `hpDamage`, `barrierDamage`
- `damageType`, `resource`, `moveType`
- `periodic`, `triggered`, `reason`, `depth`

## Skill

파일: `data/skills.json`

주요 필드:

- `id`: 스킬 고유 ID
- `name`, `description`
- `className`: 스킬 소속 클래스 표시명. 기존 데이터는 `클래스 · 스킬명` 접두어를 임시 호환값으로 읽으며 기본 스킬은 `공용`이다.
- `icon`: `assets/images/skills/` 아래의 선택적 개별 그림 경로
- `slot`: `basic`, `active`, `passive`, `choice_team`, `choice_prebattle`
- `choice`: 선택 타입 전용 `{ defaultOptionId, options[] }`. 각 option은 `{ id, label, skillId }`이며 `skillId`로 기존 실행 스킬을 참조한다.
- `selectionModifier`: 선택지가 참조하는 내부 스킬의 지속형 보정. `targetSkillIds`, `resourceTypes`, `castTimePercent`, `resourceCostPercent`, `coefficientPercent`, `areaPercent`, `splashPercent`, `splashRadius`를 사용한다. 필드가 없는 기존 선택지는 다른 스킬을 변경하지 않는다.
- 액션 대상 재적용 제한: `targetCooldown`은 초 단위이며 `targetCooldownScope`는 `caster`(기본, 시전자별) 또는 `global`(모든 시전자 공유)이다. `global`은 `targetCooldownEffectId`와 `targetCooldownEffectName`으로 대상 상태에 표시되는 제한 효과를 만든다.
- 액션의 `allowSelfTarget`은 아군 대상에 시전자 자신을 포함할지 정한다. 생략 기본값은 `true`다.
- 액션의 `ownedSummonCondition`은 `any`·`alive`·`absent`, `ownedSummonEntityId`는 검사할 소환 Entity ID다. `targetSummonEntityId`는 `target: summon`의 후보를 특정 Entity로 제한한다.
- 버프 효과의 `requiredOwnedSummonEntityId`는 해당 Entity가 시전자 소유로 생존하는 동안만 능력치 보정을 활성화한다.
- 주기 효과의 `periodic.coefficient`는 고정값 또는 시전자 능력치 계수이며 적용 순간 기준값을 보관한다. `growthInterval`과 `growthValue`는 시간에 따른 계수 증가를 정의한다. 선택적 `resourceDrains: [{ resource, value }]`는 틱마다 효과 중첩 수를 곱한 MP·ST·BP·커스텀 자원 등의 추가 감소를 적용한다. `effect.stackMode: reject`는 같은 효과 ID가 있는 대상을 선택하지 않는다.
- `cooldown`: 초 단위 쿨다운
- `castTime`: 초 단위 시전 시간, 비어 있으면 유닛 기본 시전 속도 사용
- `castReceivedDamagePercent`: 시전 중 받는 피해 배율, 기본값 100
- `channel`: 채널링 설정 `{ duration, interval, interruptOnDamage, lockTarget, receivedDamagePercent }`. 대상 고정과 채널 중 받는 피해 비율을 선택적으로 저장한다.
- `passiveTrigger`: 패시브 발동 조건. 기존 단일 `event`와 선택적 복수 `events`를 지원한다. `battle_entry`는 유닛의 전투 진입 시 한 번, `dispel`은 소유자가 실제 효과 하나를 해제할 때 발생한다. 선택적 `damageType`은 `physical`, `magic`, `fixed` 중 일치하는 피해 이벤트만 허용한다. `allowMultiplePerTick`은 같은 전투 틱의 조건 이벤트마다 발동할지 정하며 생략 기본값은 `false`다. `requiredTargetEffectTags`와 `damageMultiplierPercent`는 대상이 모든 지정 해로운 효과 태그를 보유할 때 주는 피해 배율을 적용한다. 선택적 `recentAttackerMitigation`은 `{ enabled, window, threshold, initialReductionPercent, additionalReductionPercent, maxReductionPercent }`로 최근 고유 공격자 수에 따른 받는 피해 감소를 저장한다.
- 상태·버프 제거 효과는 `dispelMode: id|category|tags|all`을 사용한다. 태그 방식의 `dispelTags`는 하나 이상 일치하는 효과를 제거하며 `dispelPolarity`와 `dispellable` 규칙을 함께 적용한다.
- 계산계수의 `field: triggerActualDamage`는 패시브를 발동시킨 실제 피해량을 참조한다. `triggerActualAmount`는 피해 또는 회복 이벤트의 실제 수치를 공통으로 참조한다. `field: customResourceCurrent`는 `resourceId`에 지정한 시전자 커스텀 자원의 현재값을 참조한다.
- `resourceCosts`: HP/MP/ST/BP 또는 `custom:<id>` 비용
- `actions`: 실행 액션 배열
- 액션의 `rangeMultiplier`는 주무기 사거리 배율이며 `chainOrigin`은 추가 대상 거리 기준이다.
- 액션의 `requiredTargetEffectId`는 지정 효과를 가진 대상만 허용하며, `requiredTargetEffectCaster: self`는 현재 시전자가 부여한 효과만 인정한다.
- 변신의 `receivedDamagePercent`, `immobile`, `exitHpBelow`, `retreatHpBelow`는 모드형 형태의 피해·이동·자동 해제·후퇴 규칙이다.

캐릭터의 `skillIds`는 스킬 ID만 참조한다. 관리 UI는 현재 별도 클래스 DB가 없으므로 캐릭터 `name`과 스킬 `className`이 같은 항목만 장착 후보로 표시한다.

주요 액션 타입:

- `deal_damage`, `heal`, `drain_resource`
- `move`
- `add_state`, `delete_state`, `add_buff`, `delete_buff`
- `summon_entity`, `command_summon`
- `create_field`
  - 형태: `fieldShape` (`circle`/`line`), `fieldRadius`, `fieldWidth`
  - 오라: `fieldAuras[]`의 `target`, `stat`, `mode`, `value`; 오라 전용은 `fieldEffect: "none"`
  - 이동 ST 추가 비용: `fieldMovementStCostCenter`, `fieldMovementStCostFalloff`, `fieldMovementStCostMinimum`
- `transform`
- `copy_skill`
- `revive_ally`, `deploy_reserve`, `swap_reserve`
- `swap_equipment_set`
- `override_rule`

## 기타 데이터 구조

### Team

파일: `data/teams.json`

- `skillSelections`: `{ [characterId]: { [choiceSkillId]: optionId } }`. 팀편성 선택 스킬의 팀별 선택값이며, 값이 없거나 유효하지 않으면 스킬의 기본 선택지를 사용한다.

- `name`
- `memberIds`: `characters.json` 배열 인덱스 참조
- `activeMemberCount`: 처음 전투에 투입되는 활성 인원 수
- `battleRules`: 피해, 회복, 자원 비용, 쿨다운 배율
- `synergyRules`: 진영 또는 역할 기반 조건부 배율

### Item

파일: `data/items.json`

2026-11-11 현재 기본 무기 15개·방어구 8개(재질별 상의/하의 각각 1개), 합계 23개입니다. 주먹구는 글러브로 통합했고 기존 장착/장비 세트 참조를 남긴 아이템으로 교체했습니다. 스키마 변경은 없습니다. [현재 구성과 DPS 설정](ITEM_MANAGEMENT.md#2026-11-11-장비-통합과-무기-dps-설정). 과거 샘플 생성 이력은 [생성 규칙](data-generation/DATA_GENERATION_RULES.md)을 참고하세요.

- `id`, `name`, `slot`
- `weaponCategory`, `handType`, `attackType`, `attackSkillId`
- `armorCategory`
- `hp`, `mp`, `st`, `atk`, `magic`, `speed`, `attackSpeed`, `castSpeed`, `defense`, `resistance`, `attackRange`

### Category

파일: `data/categories.json`

- `type`: `weapon` 또는 `armor`
- `key`, `label`
- 무기 전용: `handType`, `attackRange`, `attackSpeed`, `castSpeed`, `attackType`, `slotType`

무기 DPS 탭은 기존 Item·Category 필드에 저장하며 DPS는 저장하지 않는 계산값입니다. 주기·사정거리는 카테고리가 원본이며 무기 아이템에도 같은 값을 저장합니다.

### Faction

파일: `data/factions.json`

진영 이름 문자열 배열입니다.

### Entity

폴더: `data/entities/*.json`

- `entityId`
- `name`, `role`, `description`, `icon`, `tags`, `ai`
- `attackType`: `physical` 또는 `magic`. 생략한 기존 파일은 치유 AI만 마법, 나머지는 물리로 해석합니다.
- `attackSkillId`: 선택적 기본 공격 스킬 ID. 실행 가능한 스킬이면 소환수 기본 공격을 교체하며 빈 값·유효하지 않은 참조는 기존 기본 공격으로 호환합니다.
- `summonType`: `persistent` 또는 `temporary`. 생략한 기존 파일은 임시로 해석하며 조회 시 필드를 강제로 쓰지 않습니다.
- `stats`: `hp`, `mp`, `st`, `atk`, `magic`, `defense`, `resistance`, `speed`, `attackSpeed`, `castTime`, `attackRange`

스킬의 `summon_entity` 액션은 Entity 전체 내용을 중복 저장하지 않고 `entityId`를 참조합니다.

전투 런타임에는 `isSummon`, `summonType`, `owner`/`summoner`, `ownerId`, `ownerEventId`와 소유자의 `summons`가 있습니다. 객체 참조는 저장하지 않습니다. 이벤트의 소환수 스냅샷은 `summonType`, `entityId`, `ownerId`, `ownerEventId`를 보존하며 기록 참가자 배열은 소환수를 제외합니다. 영구 사망 객체는 현재 전투에서만 보존하며 별도 전투 간 펫 상태 저장은 없습니다. [생명주기](ENTITIES.md#소환수-생명주기-2026-10-11).

### Image Generator Settings

파일: `data/image-generator-settings.json`

- `assetName`
- `stylePreset`
- `stylePrompt`
- `provider`
- `model`
- `width`, `height`
- `seed`
- `finalPrompt`
- `updatedAt`

## 아이콘 매핑 추가 (2026-10-05)

`data/icon-mappings.json`은 `{ group, key, label, icon, removeBackground, backgroundTolerance }` 객체 배열입니다. `group`은 `role`, `slot`, `weapon`, `armor`, `armorBottom`, `skill`, `faction` 중 하나이며 `key`는 해당 분류의 내부 키(진영은 이름)입니다. `label`은 대체 표시명, `icon`은 원본 로컬 이미지 경로이며 두 필드는 빈 문자열을 허용합니다. `(group, key)`당 하나의 설정을 관리합니다. 초기값은 `[]`이며 게임 데이터의 이름·능력치는 변경하지 않습니다. `armor`는 상의, `armorBottom`은 하의 아이콘이며 같은 방어구 카테고리 키를 사용합니다. [아이콘 관리](ICONS.md)를 참고합니다.

2026-10-09 추가된 `removeBackground`는 배경 자동 제거 여부이며 생략 시 `true`입니다. `backgroundTolerance`는 제거 강도(8~100 정수, 기본 48)입니다. 기존 행은 조회 시 기본값을 사용하며 저장 시 옵션을 포함합니다. 원본 이미지와 `icon` 경로를 유지하고 표시용 투명 PNG는 브라우저 메모리에서만 생성합니다.
# CharacterViewer GLB 조합 저장 (2026-10-16)

브라우저 로컬 저장소 키 `sdCharacterAssembler.v1`은 개발용 조합 프리셋 하나를 저장한다. 게임 캐릭터 JSON과 분리된다.

- `version`, `name`, `gender`, `savedAt`
- `bodyParts[category]`: `{ assetId, name, color }` 또는 `null`
- `equipment[slot]`: `{ assetId, name, color }` 또는 `null`

`assetId`는 자동 카탈로그의 파일 stem이며 파일 경로는 저장 데이터의 핵심 식별자로 사용하지 않는다. `color`는 팔레트를 지원하는 카테고리의 `#RRGGBB` 값이며 미지원 카테고리는 `null`이다. 한글 파일명 전환 전 ID는 `assets/characters/asset-id-aliases.json` 별칭으로 복원한다. 복원 시 ID가 사라졌으면 해당 카테고리만 `없음`으로 처리한다.

### 기사 개편 추가 필드 (2026-11-12)

스킬 `summonVariant`·`summonRequirement`, 이동 `distanceSource`·`distanceAdd`, 계수 `previousMoveDistance`, 선택 보정 `areaAdd`·`knockbackDistanceAdd`, 효과 `requiredOwnedSummonAbsent`를 지원한다. 모두 선택 필드이며 기존 데이터는 기본 동작을 유지한다. [동작 계약](SKILL_ENGINE.md#기사-지원-확장-2026-11-12).

### 마법사 개편 추가 필드 (2026-11-12)

- 선택 옵션 `requiredSkillId`, 선택 보정 `requiredChoiceSkillId`·`requiredChoiceOptionId`·`skillModifiers`.
- 액션 `triggerEvent`·`targetPreviousDamage`, 효과 `barrierMode:coefficient`, 계수 `previousBarrierCreated`, 버프 능력치 `maxMp`.
- 모두 선택 필드이며 기존 데이터의 기본 동작을 유지한다. 조건은 선택된 강화 최대 3개를 기준으로 UI·런타임에서 동일하게 적용한다. [동작 계약](SKILL_ENGINE.md#마법사-개편조건부-속성-선택-2026-11-12).
