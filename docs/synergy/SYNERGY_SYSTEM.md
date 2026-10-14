# 공용 스탯 시너지 V1

2026-10-13 완료. 팀 편성 조건을 공통 평가기로 판정하여 캐릭터 런타임에 고정 가산 보정을 적용한다. 기존 팀별 피해·치유·비용·쿨타임 배율 시너지는 별도로 유지한다.

## 기존 프로젝트와 연결

- 관리 화면은 다른 관리 페이지와 동일한 공통 페이지 여백 변수, panel 카드, h4 제목, data-toolbar, data-table 및 table-responsive를 사용한다. 설명문은 공통 문단 흐름에 유지하고 시너지 전용 외곽 여백은 두지 않는다. 2026-10-13에 누락된 래퍼/공통 여백 적용을 복구하고 Chrome 1920·1440·640px에서 아이템 관리와 비교했다.

- 캐릭터는 별도 classId 없이 `role`을 사용한다. 선택지는 `ROLES`, 이름은 `getRoleLabel`이다.
- 진영은 별도 ID 레지스트리가 없고 `factions.json`의 문자열과 `character.faction`이 정식 키다. 이 기존 계약을 유지하며 아이콘의 대체 표시명이나 DOM 텍스트로 비교하지 않는다. 진영 ID 마이그레이션은 하지 않았다.
- 배분 스탯은 `CHARACTER_STAT_DEFS`(str/vit/agi/focus/int/wis), 파생 능력치는 `ABILITY_ROWS`가 원본 정의다. 관리 화면은 두 목록에서 선택지를 구성한다. 새로운 스탯의 전투 계산 자체는 기존 스탯 엔진의 책임이다.
- 팀은 `memberIds`로 캐릭터 배열 인덱스를 참조한다. 중복을 제거하고 실제 편성된 최대 10명(선봉·예비대·진입 대기 포함)을 평가한다. 단독 선택·여러 팀 합산도 실제 최종 편성이 기준이다.
- 장비의 `getCharacterEffectiveAttributes`와 `applyCharacterStatAbilities`를 재사용한다. 배분 원본을 제한하는 50 상한은 시너지 보정값을 잘라내지 않는다.

## 저장과 스키마

`data/synergies.json` 배열, 기존 `GET/PUT /api/synergies` API로 저장한다. 기본 파일은 빈 배열이며 밸런스 수치는 자동 등록하지 않는다. 테스트는 격리된 데이터에서만 정의를 만든다.

```json
{
  "id": "synergy_UUID",
  "name": "사용자가 정한 이름",
  "condition": {"type": "role", "value": "tank"},
  "stacking": "highest",
  "thresholds": [
    {"count": 2, "effects": [
      {"type": "stat", "stat": "vit", "value": 5, "target": "team"}
    ]}
  ]
}
```

위 수치는 구조 예시이며 게임 밸런스 기본값이 아니다.

- `id`: 생성 시 UUID 기반으로 부여하며 이름을 수정해도 유지한다.
- `condition`: V1의 단일 분류 조건. `type`은 faction/role이고 `value`는 현재 레지스트리의 실제 키다. 이후 별도 조건 타입으로 AND/OR 트리를 확장할 수 있지만 V1은 지원하지 않는 타입을 거부한다.
- `thresholds`: 중복되지 않는 양의 정수 `count`와 하나 이상의 `effects`. 편집기에서 단계·효과 추가/제거 가능.
- `stacking`: `highest`는 충족한 최고 인원 단계 하나, `cumulative`는 충족한 모든 단계 합산. 생성 폼 초기 선택은 highest이며 각 정의에 저장한다. 서로 다른 시너지의 효과는 합산한다.
- `effect`: `type:stat`, 등록된 `stat`, 유한한 숫자 `value`, 대상 `target`.
- `target:team`: 편성된 전체 아군 캐릭터. `matching`: 해당 조건에 일치하는 편성 캐릭터. 두 대상 모두 소환수를 제외한다.

저장 UI는 중복/빈 ID, 빈 이름, 사라진 진영/계열/스탯, 잘못된 단계, NaN/Infinity, 빈 조건/효과, 알 수 없는 단계 방식/대상을 검사한다. 실패하면 기존 메모리 데이터와 편집 내용을 유지하고 오류를 표시한다. 삭제는 기존 confirm 패턴을 사용한다.

일반 배열 API는 별도의 도메인 검증을 제공하지 않는다. 파일/API 직접 편집 시 이 계약을 지켜야 한다. 외부 편집으로 참조가 깨지면 관리·팀 화면에 오류를 표시하고 해당 정의를 적용하지 않는다. headless 입력은 검증 실패로 실행을 거부한다. 기존 진영 레지스트리는 이름 자체가 키이므로 진영 이름 변경/삭제 후 관련 시너지의 조건 대상을 다시 선택해야 한다.

## 평가와 화면

`js/synergy.js`의 `evaluateSynergies(members, definitions)`는 저장/DOM 변경 없이 `roster`, 캐릭터별 `modifiers`, 출처 `sources`, 단계별 `states`를 반환한다. 소환수를 먼저 제외하며 생존 여부는 보지 않는다. 조건과 인원 평가를 전투 틱마다 반복하지 않는다.

`js/synergy-ui.js`가 관리 표·모달·팀 미리보기를 제공한다. 팀 편집기의 미저장 선택 목록을 사용하므로 추가/제거/교체 시 즉시 갱신한다. 2026-10-14 팀 UI 개편부터 공용 평가기의 활성 정의와 적용 단계별 효과·대상만 표시한다. 미달 단계와 이전 팀별 배율 시너지는 이 영역에 표시하지 않는다. 평가·런타임 합산 로직은 유지한다. [팀 UI](../TEAM_UI.md)를 참고한다.

보정은 기존 단위의 고정 가산이다. `vit +5`는 런타임 체력 스탯과 기존 HP 공식에 함께 반영된다. 공격속도와 시전속도는 이 엔진에서 시간 값이므로 **양수 가산은 느려지는 효과**다. 체력/자원/속도/사거리의 런타임 하한을 적용하며 미리보기 합산값은 하한 적용 전 보정 합계다.

## 전투와 장비

`createSquadFromCharacterIds`에서 동일 평가기를 호출하고 `createCharacter`에 캐릭터별 보정을 전달한다. `runtimeSynergyModifiers`는 계산용 복사본에만 존재한다. `characterJson`과 저장된 attributes는 수정하지 않는다. 계산 순서는 기본 배분 + 장비/시너지 배분 보정 → 기존 파생 공식 → 장비/시너지 파생 능력치 가산이다.

모든 장비 loadout에 시너지를 반영하며 `withoutEquipment`에는 시너지를 유지한다. `withoutSynergy`에는 시너지만 제외한 장비 계산을 보관한다. `disableTeamSynergies`는 기존 배율 시너지와 새 스탯 시너지를 함께 무효화하고, 장비 무효화와 독립적으로 조합된다. 기존 버프 재계산을 거쳐 세트 교체·무효화 만료·사망 시 보정 기반을 복구한다. 최대 HP/자원 감소 시 현재값은 상한에 맞춰 제한하며 복구 시 무료 회복하지 않는다.

전투가 시작되면 편성 결과는 고정된다. 사망·부활·소환 생성은 조건 인원을 바꾸지 않는다. 소환수는 직접 대상도 아니지만 기존 소환 액션의 능력치 계승은 시너지 적용 후 소환자의 능력치를 읽을 수 있다. 전투 재시작 시 원본으로 새 유닛을 계산하므로 중복 가산하지 않는다.

## 기록과 시뮬레이터

전투 시작 시 `activeBattleSynergies`에 양측 활성 정의의 `{id,name,count}`를 복사한다. 일반 전투 기록의 `activeSynergies: {player:[],enemy:[]}`에 보존하며 예전 기록은 빈 목록으로 호환한다. 각 런타임 유닛의 `synergySources`에는 sourceType/id/name/단계/효과가 남는다.

`balance/simulator/engine.cjs`가 같은 모듈·유닛 생성 경로를 사용한다. CLI 입력과 Python Job 입력 스냅샷에 `synergies`를 포함하고 개별 전투 결과에 동일 activeSynergies를 기록한다. 예전 입력 스냅샷에 필드가 없으면 빈 배열이다. 저장된 팀의 기존 배율 규칙은 무작위 임시 편성에 부여하지 않는다. 시너지별 승률 집계 UI는 아직 없다.

## 검증

- 관련 Node 회귀는 최종 전체 실행 178개 통과 후 기록 재로딩 테스트를 추가하여 시너지 전용 6개를 다시 통과했다(현재 해당 묶음 총 179개). 명령: `node --test tests/synergy.test.cjs tests/team-rules.test.cjs tests/equipment-rules.test.cjs tests/balance-simulator.test.cjs tests/skill-engine.test.cjs`.
- 조건 미달/활성, highest/cumulative, 대상 필터, 복수 효과, 유효성, 원본/반복 보호, 세트/장비·시너지 독립 무효화/만료, 실제 사망·부활·예비대와 두 소환 종류, headless 기록, 정의 삭제 후 기록 재로딩을 검증했다.
- `python tests/test_synergy_ui.py`: 격리 Python API + 실제 Chrome 3개 통과. 진영/계열 생성, 저장/새로고침/재열기, 이름 수정과 ID 유지, 삭제, 1/2↔2/2 즉시 갱신, 동시 적용, 실제 startBattle와 120틱 실행의 속도 +10/HP +250, 사망·소환 후 활성 기록 유지, 재실행, 잘못된 빈 효과 거부, HTTP 500 저장 실패 시 초안/기존 데이터 유지 및 재시도.
- 1920/1440/640px 모달 넘침 검사, 데스크톱 편집기·팀 시너지·모바일 오류 화면 캡처 검수. 검수용 임시 이미지는 소스에 포함하지 않는다.
- `python tests/test_synergy_jobs.py`: 실제 Python Job→Node worker 1개 통과. 격리 정의를 입력 스냅샷에 보존하고 두 전투의 양측 활성 기록을 확인했다.
- Python/JavaScript 문법과 `git diff --check` 통과. 기존 사용자 데이터 대신 복사된 임시 데이터 서버/Job으로 테스트했다.

## 미정·후속 범위

실제 밸런스 수치, 같은 조건의 중복 정의 제한, 활성 시너지 최대 수, % 효과, 복합 AND/OR, 특정 진영/계열을 별도로 지정하는 효과 대상, 적군 약화, 캐릭터 전용·소환수 전용 시너지, 해제 효과, 시너지별 통계는 미정이다. V1에서 임의의 밸런스 데이터나 별도 클래스 체계를 만들지 않는다.
