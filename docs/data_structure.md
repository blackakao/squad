# 데이터 구조

이 문서는 저장·런타임 데이터의 요약입니다. 액션 세부 필드는 [스킬 엔진](SKILL_ENGINE.md), 개체 검증과 참조 규칙은 [Entity](ENTITIES.md), 외형 메타데이터는 [초상화 조합](PORTRAIT_COMPOSER.md)과 [외부 SD 모델](IMPORTED_SD_MODELS.md)을 함께 확인합니다.

## 저장 위치와 API

이미지 사용자 스타일은 `data/image-styles.json` 배열에 저장하며 `GET/PUT /api/image-styles`를 사용합니다. 항목 필드는 `id`(UUID 문자열), `name`(1~80자, UI에서 중복 방지), `stylePrompt`(스타일 문장), `updatedAt`(ISO 시각)입니다. 파일 부재 시 빈 목록을 반환하고 최초 저장 시 생성합니다. 마지막 생성 설정 객체와 별도로 관리합니다. [사용법](IMAGE_GENERATION.md)

대부분의 데이터는 `data/*.json`에 배열 형태로 저장됩니다. `server.py`는 `/api/<name>` 요청을 `data/<name>.json`에 매핑하고, `/api/records`만 `data/battle-records.json`에 매핑합니다.

예외적으로 이미지 생성 설정은 객체 형태의 `data/image-generator-settings.json`에 저장되고, Entity는 `data/entities/<entityId>.json` 파일 단위로 저장됩니다.

이미지 생성 설정은 `GET/PUT /api/image-settings`, Entity는 `/api/entities/` 계열을 사용합니다. 일반 배열 저장 API와 본문 형식·메서드가 다릅니다. 스킬 및 Entity 조회 시 기존 소환 정의가 자동 이전될 수 있습니다.

## Character

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
- `durationSeconds`: 전투 시간
- `events`: 최근 최대 1,000개 상세 전투 이벤트

멤버 결과 필드는 `name`, `role`, `hp`, `maxHp`, `mp`, `maxMp`, `st`, `maxSt`, `dps`입니다. 런타임의 `stats.damage`, `stats.taken`, `stats.heal` 전체는 멤버 결과에 저장하지 않습니다. `dps`는 누적 피해를 전투 시간으로 나눈 값입니다. 이전 기록에 없는 `events`는 빈 배열로 정규화합니다.

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
- `slot`: `basic`, `active`, `passive`
- `cooldown`: 초 단위 쿨다운
- `castTime`: 초 단위 시전 시간, 비어 있으면 유닛 기본 시전 속도 사용
- `channel`: 채널링 설정
- `passiveTrigger`: 패시브 발동 조건
- `resourceCosts`: HP/MP/ST/BP 또는 `custom:<id>` 비용
- `actions`: 실행 액션 배열

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
- `stats`: `hp`, `mp`, `st`, `atk`, `magic`, `defense`, `resistance`, `speed`, `attackSpeed`, `castTime`, `attackRange`

스킬의 `summon_entity` 액션은 Entity 전체 내용을 중복 저장하지 않고 `entityId`를 참조합니다.

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
