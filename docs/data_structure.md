# 데이터 구조

## 스킬·시너지 개별 그림

`data/skills.json`과 `data/synergies.json` 레코드는 선택적 `icon` 문자열을 가진다. 값은 `assets/images/skills/파일명` 또는 `assets/images/synergies/파일명`이며 빈 문자열/필드 생략은 그림 없음이다. 스킬 정규화는 이 필드를 보존한다. 기존 데이터를 일괄 수정하지 않는다. 공통 `iconMappings`와는 별개이며 전투 계산 필드가 아니다. [그림 API·수명](RECORD_IMAGES.md).

## 종합전투력 파생값

캐릭터·아이템 JSON과 API 스키마는 변경하지 않습니다. 종합전투력은 현재 빌드에서 재계산하며 combatPower 필드를 저장하지 않습니다. 계산 결과는 version/total/rawTotal/contributions/normalized/metrics, 빌드 어댑터는 finalStats를 추가로 반환합니다. 분석용 문서 JSON만 공식 설정·입력 해시·38명 계산 스냅샷·과거 비교를 보관합니다. [계약·제외 범위](balance/COMBAT_POWER.md), [분석 스냅샷](balance/COMBAT_POWER_RESULTS.json).

## 공용 스탯 시너지

`data/synergies.json`은 `id`, `name`, `condition:{type,value}`, `stacking:highest|cumulative`, `thresholds:[{count,effects:[{type:stat,stat,value,target:team|matching}]}]` 배열이며 `GET/PUT /api/synergies`로 저장합니다. ID는 이름 수정과 독립적입니다. 조건 키는 기존 faction 문자열 또는 role 코드입니다. 캐릭터·팀 스키마는 바꾸지 않습니다.

런타임 `synergySources`는 출처와 효과를 추적하며 저장하지 않습니다. 일반 기록과 시뮬레이터 개별 전투 결과에는 `activeSynergies:{player:[{id,name,count}],enemy:[{id,name,count}]}`를 저장합니다. 시뮬레이터 입력 스냅샷의 `synergies`가 없으면 빈 목록으로 호환합니다. [전체 계약과 검증 경계](synergy/SYNERGY_SYSTEM.md).

이 문서는 저장·런타임 데이터의 요약입니다. 액션 세부 필드는 [스킬 엔진](SKILL_ENGINE.md), 개체 검증과 참조 규칙은 [Entity](ENTITIES.md), 외형 메타데이터는 [초상화 조합](PORTRAIT_COMPOSER.md)과 [외부 SD 모델](IMPORTED_SD_MODELS.md)을 함께 확인합니다.

## 저장 위치와 API

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
- `playerMembers`: 아군 멤버 결과 배열
- `monsterMembers`: 적 멤버 결과 배열
- `durationSeconds`: 새 기록은 진행한 전투 틱 / 60
- `contributionVersion`: 새 소유자 집계는 1, 이전 기록은 0
- `events`: 최근 최대 1,000개 상세 전투 이벤트

멤버 결과는 `name`, `role`, `hp`, `maxHp`, `mp`, `maxMp`, `st`, `maxSt`와 소유자 합계 `damageDealt`, `healingDone`, `kills`, `dps`, `hps`, 전투별 `eventId`, `contribution`을 저장합니다. `contribution`의 `direct/summon/total/groups`는 본체·소환·합계·템플릿/종류별 기여도입니다. DPS/HPS는 합산 누적량/전투시간입니다. 이전 기록은 소유 관계를 추측하지 않고 보존하며 없는 `events`는 빈 배열입니다. [저장 규칙과 호환성](BATTLE_CONTRIBUTIONS.md).

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
- `slot`: `basic`, `active`, `passive`
- `cooldown`: 초 단위 쿨다운
- `castTime`: 초 단위 시전 시간, 비어 있으면 유닛 기본 시전 속도 사용
- `channel`: 채널링 설정
- `passiveTrigger`: 패시브 발동 조건
- `resourceCosts`: HP/MP/ST/BP 또는 `custom:<id>` 비용
- `actions`: 실행 액션 배열

캐릭터의 `skillIds`는 스킬 ID만 참조한다. 관리 UI는 현재 별도 클래스 DB가 없으므로 캐릭터 `name`과 스킬 `className`이 같은 항목만 장착 후보로 표시한다.

주요 액션 타입:

- `deal_damage`, `heal`, `drain_resource`
- `move`
- `add_state`, `delete_state`, `add_buff`, `delete_buff`
- `summon_entity`, `command_summon`
- `create_field`
- `transform`
- `copy_skill`
- `revive_ally`, `deploy_reserve`, `swap_reserve`
- `swap_equipment_set`
- `override_rule`

## 기타 데이터 구조

### Team

파일: `data/teams.json`

- `name`
- `memberIds`: `characters.json` 배열 인덱스 참조
- `activeMemberCount`: 처음 전투에 투입되는 활성 인원 수
- `battleRules`: 피해, 회복, 자원 비용, 쿨다운 배율
- `synergyRules`: 진영 또는 역할 기반 조건부 배율

### Item

파일: `data/items.json`

2026-10-10 고정형 샘플 140개를 추가해 기존 6개와 합계 146개입니다. 카테고리 14종에 각 10개이며, 방어구는 각 상의 5개·하의 5개입니다. 스키마 변경은 없습니다. [생성 규칙](data-generation/DATA_GENERATION_RULES.md)과 [실제 이름·능력치 목록](data-generation/DATA_GENERATION_LOG.md)을 참고하세요.

- `id`, `name`, `slot`
- `weaponCategory`, `handType`, `attackType`, `attackSkillId`
- `armorCategory`
- `hp`, `mp`, `st`, `atk`, `magic`, `speed`, `attackSpeed`, `castSpeed`, `defense`, `resistance`, `attackRange`

### Category

파일: `data/categories.json`

- `type`: `weapon` 또는 `armor`
- `key`, `label`
- 무기 전용: `handType`, `attackRange`, `attackSpeed`, `castSpeed`, `attackType`, `slotType`

### Faction

파일: `data/factions.json`

진영 이름 문자열 배열입니다.

### Entity

폴더: `data/entities/*.json`

- `entityId`
- `name`, `role`, `description`, `icon`, `tags`, `ai`
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

`data/icon-mappings.json`은 `{ group, key, label, icon, removeBackground, backgroundTolerance }` 객체 배열입니다. `group`은 `role`, `slot`, `weapon`, `armor`, `skill`, `faction` 중 하나이며 `key`는 해당 분류의 내부 키(진영은 이름)입니다. `label`은 대체 표시명, `icon`은 원본 로컬 이미지 경로이며 두 필드는 빈 문자열을 허용합니다. `(group, key)`당 하나의 설정을 관리합니다. 초기값은 `[]`이며 기존 게임 데이터의 마이그레이션은 없습니다. [아이콘 관리](ICONS.md)를 참고합니다.

2026-10-09 추가된 `removeBackground`는 배경 자동 제거 여부이며 생략 시 `true`입니다. `backgroundTolerance`는 제거 강도(8~100 정수, 기본 48)입니다. 기존 행은 조회 시 기본값을 사용하며 저장 시 옵션을 포함합니다. 원본 이미지와 `icon` 경로를 유지하고 표시용 투명 PNG는 브라우저 메모리에서만 생성합니다.
# CharacterViewer GLB 조합 저장 (2026-10-16)

브라우저 로컬 저장소 키 `sdCharacterAssembler.v1`은 개발용 조합 프리셋 하나를 저장한다. 게임 캐릭터 JSON과 분리된다.

- `version`, `name`, `gender`, `savedAt`
- `bodyParts[category]`: `{ assetId, name, color }` 또는 `null`
- `equipment[slot]`: `{ assetId, name, color }` 또는 `null`

`assetId`는 자동 카탈로그의 파일 stem이며 파일 경로는 저장 데이터의 핵심 식별자로 사용하지 않는다. `color`는 팔레트를 지원하는 카테고리의 `#RRGGBB` 값이며 미지원 카테고리는 `null`이다. 한글 파일명 전환 전 ID는 `assets/characters/asset-id-aliases.json` 별칭으로 복원한다. 복원 시 ID가 사라졌으면 해당 카테고리만 `없음`으로 처리한다.
