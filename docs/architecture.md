# 아키텍처

## 캐릭터 1:1 전투

[team.js](../js/team.js)는 duel 모드의 양측 단일 선택·별도 선택 스킬을 관리하며 기존 createSquadFromCharacterIds로 각각 한 명을 생성한다. [battle.js](../js/battle.js)는 시작 시 양측을 다시 구성하고 미선택을 차단한다. 팀 모드의 선택/배율은 적용하지 않으며 전투 루프·저장된 캐릭터·팀 스키마는 유지한다. 검증은 [duel.test.cjs](../tests/duel.test.cjs)에 있다.

## 스킬·시너지 그림 편집

[record-images.js](../js/record-images.js)는 개별 그림 미리보기·보관함·업로드 UI를 공유한다. 스킬/시너지 편집기는 선택 경로만 각 레코드의 icon에 저장하고 [api.js](../js/api.js)의 업로드 함수를 재사용한다. [server.py](../server.py)는 허용된 skills/synergies 이미지 보관함의 읽기 전용 목록을 제공하며 공통 단어 아이콘 매핑과 분리한다. [상세](RECORD_IMAGES.md).

## 팀 편성 UI

[team.js](../js/team.js)는 편성 초안과 클릭/native drag의 공통 추가 검사를 담당하고 viewport 가용 높이를 CSS 변수로 전달합니다. [synergy-ui.js](../js/synergy-ui.js)는 공용 평가기의 활성 결과를 표시합니다. 개인 CP는 기존 공통 계산기를 호출하며 팀 집계 공식은 추가하지 않습니다. 기존 팀 정규화·저장·전투 함수의 계약을 유지합니다. [상세](TEAM_UI.md).

## 종합전투력

[combat-power.js](../js/combat-power.js)는 순수 최종 스탯 계산기와 기존 applyCharacterStatAbilities를 호출하는 빌드 어댑터, 중앙 설정·버전·기여도를 제공합니다. [combat-power-ui.js](../js/combat-power-ui.js)는 포맷과 툴팁·비교 표시만 담당합니다. character/stats/equipment 화면은 같은 어댑터를 사용합니다. [보고서 CLI](../balance/simulator/combat-power-report.cjs)는 [공통 진단 로더](../balance/simulator/build-context.cjs)로 실제 엔진의 정규화 함수를 불러오며 현재 데이터·과거 입력 스냅샷의 CP를 분석합니다. 전투 실행이나 게임 저장 경로에는 CP를 삽입하지 않습니다. [상세](balance/COMBAT_POWER.md).

## 공용 스탯 시너지 연결

`js/synergy.js`는 정의 로드·검증과 DOM 독립 평가를 담당하고 `js/synergy-ui.js`는 관리 모달/표와 팀 미리보기를 담당합니다. `team.js`의 편성 유닛 생성에서 평가 결과를 `character.js`로 전달하며 `ui.js`/`equipment.js`의 기존 스탯 계산을 재사용합니다. `skill.js`의 장비 loadout은 시너지/장비 무효화 조합을 복원합니다. `battle.js`/`record.js`는 활성 시너지 스냅샷을 기록합니다. Node 엔진은 동일 모듈을 로드하고 Python Job과 CLI 모두 정의를 입력 스냅샷에 포함합니다. [상세 흐름](synergy/SYNERGY_SYSTEM.md).

아이템 관리의 10열 정렬·편집·삭제와 장비 보정 수집은 `js/equipment.js`가 담당합니다. 표의 카테고리 열만 숨기고 편집·필터·데이터는 유지합니다. `ui.js`는 유효 스탯을 기존 공식으로 계산하고, `character.js`는 세트별 전투 스냅샷을 만듭니다. `skill.js`의 허용 대상 열거·런타임 복사를 활성/기본/독립 무기/패시브가 공유합니다. [구조·제한](ITEM_MANAGEMENT.md).

기능 범위는 [프로젝트 개요](project_overview.md), 저장 필드는 [데이터 구조](data_structure.md)를 참고합니다. 독립 3D 도구는 [CharacterViewer](CHARACTER_VIEWER.md)와 [환경 시스템](ENVIRONMENT_SYSTEM.md)에 상세히 기록합니다.

## 폴더 구조

아이템 생성의 날짜별 배치 도구는 [generate_sample_items_20261010.py](../tools/generate_sample_items_20261010.py), 생성 원칙·결과는 [data-generation](data-generation/DATA_GENERATION_RULES.md)에 있습니다. 게임 런타임은 기존 `data/items.json` → `loadItemJson` → 아이템/장비 화면 흐름을 그대로 사용합니다. [생성 데이터 검증](../tests/test_generated_items.py)은 기존 장비 UI 테스트의 격리 서버를 재사용합니다.

```text
.
├── index.html
├── character-viewer.html
├── environment-viewer.html
├── server.py
├── entity_store.py
├── css/
├── js/
├── data/
├── assets/
├── docs/
├── tests/
└── tools/
```

## 파일 역할

- 소환 생명주기: `js/entity.js`/`entity_store.py`가 종류 편집·검증을 맡고, `js/battle.js`가 소유 관계·저장/활성 개체 조회·사망/제거/재활성화·종료 정리를 담당합니다. `js/battle-events.js`의 이벤트 큐 전달 완료 후 사망 소환수를 정리합니다. `js/ui.js`/`js/record.js`/headless 어댑터는 캐릭터 집계에서 소환수를 제외합니다. [상세 계약](ENTITIES.md#소환수-생명주기-2026-10-11).

- `balance/simulator/engine.cjs`: Node VM에서 실제 전투 모듈을 로드하고 가상 시계·seed·출력 어댑터·전체 이벤트 누적을 연결합니다. 전투 수식은 복제하지 않습니다.
- `balance/simulator/runner.cjs`, `report.cjs`: 균형 무작위 팀 편성·순차 실행·집계·목표 비교·JSON/Markdown 저장·재현 CLI입니다. [전투 재사용 경로](balance/SIMULATION_GUIDE.md)를 참고합니다.
- `js/simulation.js`: 전투 테스트의 설정·1초 polling·진행률·중단·숫자 정렬·대시보드·목표 편집·이력 조회입니다. 브라우저는 반복 전투를 계산하지 않습니다.
- `simulation_jobs.py`: 단일 실행 잠금, 입력 스냅샷, Node 자식 프로세스, 영속 Job/진행 상태·이력·실패 복구를 관리합니다. `server.py`가 `/api/simulations` 및 `/api/simulation-targets`를 연결합니다.
- `balance/simulator/service.cjs`, `worker.cjs`: CLI와 서버의 공통 실행 서비스 및 stdout 진행 이벤트·전투별 journal·부분 결과 저장 어댑터입니다. 취소는 전투 사이에서 처리하며 실제 전투 틱/규칙은 유지합니다.
- `js/battle.js`의 선택적 `battleResultSink`: headless 결과 수신 경로입니다. 기본값 null에서는 기존 화면과 전투 기록 저장을 유지합니다.

- `index.html`: 단일 페이지 앱의 DOM 구조, 모달, 페이지 섹션, 주요 입력 요소와 독립 CharacterViewer 직접 진입 메뉴를 정의합니다.
- `character-viewer.html`, `environment-viewer.html`: 게임과 독립된 3D 캐릭터·환경 개발용 화면입니다.
- `css/style.css`: 공통 UI, 관리 화면, 전투 화면, 반응형 레이아웃 스타일을 담당합니다.
- `server.py`: 정적 파일 서버, JSON API, Entity API 라우팅, 이미지 업로드/생성 API를 제공합니다.
- `entity_store.py`: `data/entities/*.json` 저장소와 소환 Entity 참조 무결성을 관리합니다.
- `js/main.js`: 앱 초기화 순서, 데이터 로드, 첫 렌더링, 전투 루프 시작점입니다.
- `js/api.js`: `/api/*` fetch 로드/저장 공통 함수와 이미지 업로드 유틸리티입니다.
- `js/ui.js`: 전역 DOM 참조, 상수, 기본 데이터, 전역 상태, 공통 정규화/렌더 유틸리티를 포함합니다.
- `js/battle.js`: 자동 전투 세션 준비, 이동, 충돌, 공격, 스킬 실행, 소환, 예비대, 부활, 전투 종료를 담당합니다.
- `js/battle-events.js`: 상세 개체 이벤트와 독립된 전투 전체 소유자 기여도 누적을 담당합니다. 기록과 headless가 공통 집계를 사용합니다. [집계 구조](BATTLE_CONTRIBUTIONS.md).
- `js/character.js`: 캐릭터 데이터 로드/저장, CRUD, 전투 유닛 생성, 선택 UI를 담당합니다. 관리 표는 원본 인덱스를 보존한 복사 목록만 정렬하고, 수정 창의 개별 삭제는 기존 팀 참조 정리 함수를 재사용합니다. [관리 UI](CHARACTER_UI.md).
- `js/monster.js`: 몬스터 데이터 로드/저장, CRUD, 적 전투 유닛 생성을 담당합니다.
- `js/team.js`: 팀 편성, 전투 참가 팀 선택, 팀 전투 규칙과 시너지 계산을 담당합니다.
- `js/equipment.js`: 아이템 데이터, 장비 착용, 장비 세트, 장비 능력치 합산을 담당합니다. 인벤토리 선택·검색·아이콘 드래그 미리보기·슬롯 강조는 UI 상태로만 유지하며 기존 판정/저장 함수를 호출합니다. `equipmentItemTableBody` ID는 호환을 유지하지만 현재는 표 본문이 아닌 그리드 컨테이너입니다. [장비 UI](EQUIPMENT_UI.md)를 참고하세요.
- `js/category.js`: 무기/방어구 카테고리 관리와 카테고리 기반 무기 전투 속성을 담당합니다.
- `js/stats.js`: 캐릭터 기본 스탯 배분과 파생 능력치 계산을 담당합니다.
- `js/skill.js`: 스킬 데이터, 액션·선택지 편집, 스킬 정규화, 선택 스킬 치환, 선택지 기반 런타임 보정, 스킬 실행 대상/계수 계산을 담당합니다. 팀편성 선택값은 `team.js`가 저장하고 전투 직전 선택값은 전투 준비 상태에서 관리합니다.
- `js/skill-effects.js`: 상태와 버프 계열의 지속 효과를 담당합니다.
- `js/skill-passives.js`: 패시브 스킬 발동 조건과 트리거를 담당합니다.
- `js/skill-channel.js`: 채널링 스킬의 지속 시전 처리를 담당합니다.
- `js/record.js`: 전투 기록 저장, 정규화, 목록, 페이지네이션, 상세 이벤트 표시를 담당합니다.
- `js/layout.js`: 화면별 레이아웃 크기와 위치 설정을 담당합니다.
- `js/image-generator.js`: 이미지 생성 화면, Provider 설정, 생성 이미지 저장을 담당합니다.
- 같은 모듈의 내 스타일 관리 UI는 범용 `/api/image-styles` 배열 API로 이름·스타일 문장의 CRUD를 처리합니다. 별도 서버 라우트나 외부 AI 호출 없이 동작합니다.
- `js/entity.js`: 소환 Entity 관리 UI와 API 연동을 담당합니다.
- `js/portrait/*`: 캐릭터 초상/외형 조합과 카탈로그 로직을 담당합니다. `PartSpace.js`는 모델 로드 시 루트→Head 좌표계를 고정합니다. `BlankAppearance.js`는 `Face_Anchor` 아래 눈·눈썹·코·입 Anchor와 독립 그룹을 관리합니다. `IndependentHair.js`는 별도 `Hair_Anchor` 아래 공통 `Hair_Cap`과 스타일 파츠를 구성합니다. 선택 상태, 파츠 수명주기, 스타일 transform과 머리색을 카테고리별로 관리합니다.
- `js/character-viewer/equipment.js`: 게임 장비 로직과 분리된 3D 개발용 장비 슬롯, 본 Attachment Anchor, 테스트 장비 인스턴스의 생성·해제를 담당합니다. 외형 프리셋에는 장비 ID만 저장하며 게임 캐릭터의 `equipment` 필드는 변경하지 않습니다.
- `js/character-viewer/*`, `js/environment/*`, `js/three/*`: Three.js 기반 3D 뷰어와 환경 미리보기를 담당합니다.
- `data/*.json`: 앱에서 실제로 읽고 쓰는 콘텐츠 데이터입니다.
- `assets/`: 이미지, 캐릭터 GLB, 장비 GLB, Three.js vendor 파일을 보관합니다.
- `tests/`: Node/Python 기반 회귀 테스트를 보관합니다.
- `tools/`: SD 캐릭터/장비/모델 준비 스크립트를 보관합니다.

## 모듈 관계

앱 초기화는 `js/main.js`에서 시작됩니다. 초기화 순서는 몬스터, 진영, 전투 기록, 카테고리, 아이템, Entity, 스킬, 캐릭터, 팀 순서입니다. 이 순서는 참조 관계 때문에 중요합니다.

주요 참조 흐름은 다음과 같습니다.

- `server.py`는 `data/*.json`, `data/entities/*.json`, `assets/images/*`를 읽고 씁니다.
- `js/api.js`는 프론트엔드의 공통 저장/로드 경로입니다.
- `js/ui.js`의 전역 상태를 각 도메인 모듈이 공유합니다.
- `character.js`, `monster.js`, `team.js`는 전투용 유닛 배열인 `playerSquad`, `enemySquad`를 구성합니다.
- `equipment.js`, `stats.js`, `category.js`는 캐릭터 능력치와 공격 속성 계산에 관여합니다.
- `skill.js`와 관련 스킬 모듈은 `battle.js`에서 호출되어 전투 액션을 처리합니다.
- `battle-events.js`는 전투 중 이벤트를 모으고, `record.js`는 전투 종료 시 해당 이벤트를 기록으로 저장합니다.
- `entity_store.py`는 소환 액션이 참조하는 Entity 파일과 `skills.json` 사이의 무결성을 보장합니다.

## 실행 흐름

1. `python server.py`로 서버를 실행합니다.
2. 브라우저에서 `http://127.0.0.1:8000/`을 엽니다.
3. `index.html`이 CSS/JS를 직접 로드합니다.
4. `main.js`가 JSON 데이터를 불러오고 각 화면을 렌더링합니다.
5. 전투 시작 시 선택된 캐릭터/팀/몬스터를 전투 유닛으로 변환합니다.
6. `setTimeout` 기반 `gameLoop()`가 경과 시간에 맞춰 제한된 수의 전투 틱을 실행하고 Canvas 2D와 상태 UI를 갱신합니다. 브라우저의 타이머 제한으로 백그라운드 진행 속도는 달라질 수 있습니다.
7. 전투 종료 시 `data/battle-records.json`에 결과를 저장합니다.

## 아이콘 표시 모듈 (2026-10-05)

- `js/icons.js`: 아이콘 설정 조회·저장, 업로드·미리보기, 공통 HTML 렌더링과 이미지 실패 대체 표시.
- `js/icon-background.js`: 가장자리 연결 배경색 제거, 알파 보존, 최대 384px Canvas 변환과 경로·강도별 64개 Promise 캐시. `icons.js`보다 먼저 로드하고 목록 이미지 로드 이벤트와 편집 미리보기에서 공통 사용합니다.
- `js/main.js`에서 초기 설정을 조회하고 `js/ui.js`에서 아이콘 관리 화면을 전환합니다. 각 도메인의 목록 렌더러가 공통 표시 함수를 호출합니다.
- 저장은 기존 범용 JSON API와 이미지 업로드 API를 사용합니다. 상세 범위는 [아이콘 관리](ICONS.md)를 참고합니다.
# GLB Character Assembler (2026-10-16)

- `character-viewer.html`은 현재 GLB 전용 조립 UI다.
- `js/character-viewer/main-assembler.js`가 Base, 애니메이션, 상단 작업을 연결한다.
- `js/character-viewer/assembler.js`가 성별로 필터링한 레지스트리 기반 신체/장비 선택 상태, 파츠 색상, 무작위 조합, 저장/복원을 관리한다. `part-colors.js`는 머리·눈·의류·발 장비·머리 장비별 팔레트와 색상 변경 대상 머티리얼을 분리한다.
- `CharacterPartPreview`는 신체와 장비가 공유하는 GLTFLoader, attachment, Skeleton 재바인딩, token 경쟁 방지, dispose 계층이다.
- `js/character-viewer/equipment-visibility.js`는 GLB `hideHair`/`bodyHide` 메타데이터를 읽어 Hair 렌더링과 기본 신체 triangle mask를 적용한다. 선택 상태는 바꾸지 않으며 의류 해제 시 원본 Geometry를 복원한다.
- `character-viewer-legacy.html`과 `main-legacy.js`는 이전 JS 절차형 제작 환경을 보존한다.
