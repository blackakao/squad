# 아키텍처

기능 범위는 [프로젝트 개요](project_overview.md), 저장 필드는 [데이터 구조](data_structure.md)를 참고합니다. 독립 3D 도구는 [CharacterViewer](CHARACTER_VIEWER.md)와 [환경 시스템](ENVIRONMENT_SYSTEM.md)에 상세히 기록합니다.

## 폴더 구조

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

- `index.html`: 단일 페이지 앱의 DOM 구조, 모달, 페이지 섹션, 주요 입력 요소와 독립 CharacterViewer 직접 진입 메뉴를 정의합니다.
- `character-viewer.html`, `environment-viewer.html`: 게임과 독립된 3D 캐릭터·환경 개발용 화면입니다.
- `css/style.css`: 공통 UI, 관리 화면, 전투 화면, 반응형 레이아웃 스타일을 담당합니다.
- `server.py`: 정적 파일 서버, JSON API, Entity API 라우팅, 이미지 업로드/생성 API를 제공합니다.
- `entity_store.py`: `data/entities/*.json` 저장소와 소환 Entity 참조 무결성을 관리합니다.
- `js/main.js`: 앱 초기화 순서, 데이터 로드, 첫 렌더링, 전투 루프 시작점입니다.
- `js/api.js`: `/api/*` fetch 로드/저장 공통 함수와 이미지 업로드 유틸리티입니다.
- `js/ui.js`: 전역 DOM 참조, 상수, 기본 데이터, 전역 상태, 공통 정규화/렌더 유틸리티를 포함합니다.
- `js/battle.js`: 자동 전투 세션 준비, 이동, 충돌, 공격, 스킬 실행, 소환, 예비대, 부활, 전투 종료를 담당합니다.
- `js/battle-events.js`: 전투 중 발생한 상세 이벤트를 기록하고 전투 기록으로 전달합니다.
- `js/character.js`: 캐릭터 데이터 로드/저장, CRUD, 전투 유닛 생성, 선택 UI를 담당합니다.
- `js/monster.js`: 몬스터 데이터 로드/저장, CRUD, 적 전투 유닛 생성을 담당합니다.
- `js/team.js`: 팀 편성, 전투 참가 팀 선택, 팀 전투 규칙과 시너지 계산을 담당합니다.
- `js/equipment.js`: 아이템 데이터, 장비 착용, 장비 세트, 장비 능력치 합산을 담당합니다.
- `js/category.js`: 무기/방어구 카테고리 관리와 카테고리 기반 무기 전투 속성을 담당합니다.
- `js/stats.js`: 캐릭터 기본 스탯 배분과 파생 능력치 계산을 담당합니다.
- `js/skill.js`: 스킬 데이터, 액션 편집, 스킬 정규화, 스킬 실행 대상/계수 계산을 담당합니다.
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
