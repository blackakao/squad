# 대형 JavaScript 구조 개선 — 6단계 사전 분석 (2026-11-04)

> 상태: **분석·설계 완료 / 실제 함수 이동·파일 분리 미실행**. 현재 동작과 저장 스키마를 보존하는 점진적 리팩터링 계획이다. 실제 수정 전 해당 브랜치의 최신 호출부·테스트를 다시 확인한다.

## 현재 구조와 위험

- `index.html`은 `js/ui.js` → 스킬 보조 모듈 → `js/skill.js` → `js/equipment.js` → `js/character.js`·`js/team.js` → `js/battle.js` → `js/main.js` 순서의 **일반 script** 로딩을 사용한다. ES module import/export로 일괄 변경하면 전역 이름, inline HTML 이벤트, Node VM 기반 시뮬레이터가 영향을 받는다.
- `js/skill.js` 약 **2,928줄**, `js/battle.js` 약 **1,721줄**, `js/ui.js` 약 **1,231줄**, `js/equipment.js` 약 **1,049줄**(조사 시점). 파일 길이는 개선 필요성의 단독 근거가 아니다.
- 전투 수식·스킬 스키마·장비 보정·시너지·소환·기록은 브라우저와 headless 엔진의 공유 계약이다. 데이터 구조 변경, 복제 계산기 도입, 전역 이름 변경은 이번 단계에서 제외한다.

## 파일별 책임·안전한 분리 후보

| 파일 | 확인된 책임·시작 함수 | 후보 경계 | 주요 위험 | 권장 순서 |
| --- | --- | --- | --- | --- |
| `js/skill.js` | 정규화 `normalizeSkillAction`·`normalizeSkillJson`, 저장 `loadSkillJson`·`saveSkillJson`, UI `renderSkillPage`·`openSkillModal`·`renderSkillActionRow`, 런타임 `getResolvedSkillCooldownTicks`·`applyActionDamage` | **스킬 편집기 DOM/UI**를 기존 스킬 런타임과 분리할 수 있는지 우선 조사. UI 관련 함수가 1,275줄 이후에 집중되지만 2,282줄 이후 UI·런타임이 섞여 있으므로 단순 줄 범위 이동 금지 | UI 함수의 런타임 헬퍼 참조, inline 핸들러, headless 로더, 함수 호이스팅 | 1 |
| `js/equipment.js` | 아이템 정규화 `normalizeItemJson`, 보정 `getCharacterEquipmentBonus`, 착용 판정 `canEquipItemToSlot`, 관리 UI `renderEquipmentPage`·`openItemModal` | 장비 관리 **DOM 편집/UI**와 데이터·장착 규칙 분리 검토 | 저장 배열 인덱스, 장비 세트·스킬 보정, UI의 전역 상태 | 2 |
| `js/ui.js` | 전역 상태/상수, 공통 계산 `applyCharacterStatAbilities`·`getReducedDamage`, 화면 전환 `showPage`, 전투 로그 `recordBattleActionLog` | 계산·상태·화면 책임의 **의존성 지도 작성 후** 순차 분리 | 다른 모든 일반 script의 전역 참조, 초기화 순서 | 3 |
| `js/battle.js` | 전투 세션 `prepareBattleSession`, 루프 `runBattleTick`·`gameLoop`, 소환 `summonBattleUnits`, 시전 `startCast`·`updateCast`, 이동 `moveUnit`, 표시 `drawUnit` | 우선 **렌더링 전용 함수**와 전투 규칙의 경계 검토. 실제 이동은 headless 검증 확보 후 | 시뮬레이터 VM 로딩, Canvas/DOM 조건부 접근, 전투 이벤트·seed 재현성 | 4 |

## 단계별 구현 게이트

1. **기준선 확보:** 현행 테스트 경로와 성공/실패 상태를 기록한다. 스킬 엔진·장비·전투·시뮬레이터 관련 테스트의 실제 파일 존재, 실행 명령, Node VM 로더의 파일 목록을 확인한다. 이미 실패하는 테스트는 변경 후 회귀로 오판하지 않는다.
2. **UI 경계 추출:** `skill.js`에서 DOM/UI만 사용하는 함수군의 정적 참조·inline 이벤트·공유 상태를 확인한다. 런타임이 UI 함수를 참조하지 않는 것이 확인되면 별도 일반 script 파일로 좁게 이동하고, 원래 전역 함수명·동작·로딩 순서를 유지한다. 복잡한 상호 참조가 있으면 분리를 보류한다.
3. **장비 편집 UI:** 동일 방식으로 `equipment.js`의 UI 경계를 검토한다. 장착·스탯·아이템 저장 규칙은 유지한다.
4. **공통 UI와 전투:** 2~3의 검증 결과를 바탕으로 전역 의존성 감소를 먼저 설계한다. `battle.js`의 전투 틱·수식·소환 생명주기는 별도 승인과 회귀 검증 없이 이동하지 않는다.
5. **각 변경 단위 검증:** 일반 script 로딩, 화면 초기화, 관련 편집기 저장/재로드, Node VM 시뮬레이션 로드 및 영향 범위 테스트를 확인한다. 실패하면 해당 변경만 되돌린다.

## 절대 유지할 계약

- `index.html`의 전역 심볼 노출과 의존 파일 로딩 순서.
- `server.py`의 기존 JSON API 및 `data/*.json` 저장 형식.
- `js/skill.js`의 스킬 정규화·액션·선택 스킬·쿨다운 규칙.
- `js/equipment.js`의 장비 세트, 착용 판정, 아이템 스킬 보정.
- `js/battle.js`의 tick/seed 재현성, 소환·부활·예비대, 기록 및 headless 결과 수신.
- GLB/Legacy 독립 뷰어와 공통 3D 로더.

## 완료 기준

- 변경 대상 함수의 호출부·전역 참조·DOM 이벤트와 headless 로더를 확인하고, 변경 전후 동일 동작을 관련 테스트로 입증한다.
- 분리 후 중복 로직이나 새 계산 공식을 만들지 않는다.
- 소스 이동과 기능 변경을 동일 커밋에 섞지 않는다.
- 테스트를 수행하지 못하면 정적 확인과 실행 미검증을 명시한다.

**결론:** 현 시점에는 `skill.js`의 UI 경계가 첫 번째 검토 후보지만, 함수 간 실제 의존성과 Node VM 로더 확인 전에는 안전한 분리로 확정할 수 없다. 이번 단계는 구조 분석 문서만 작성하며 실행 코드는 변경하지 않는다.
