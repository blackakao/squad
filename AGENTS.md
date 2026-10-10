# VS Code Agent Guide

이 문서는 VS Code 에이전트가 이 프로젝트를 수정할 때 먼저 참고할 작업 안내서입니다.

## 프로젝트 개요

- 장르/목표: 관전형 자동 전투 RPG 프로토타입.
- 구성: 별도 빌드 과정 없는 정적 HTML/CSS/JavaScript 앱과 Python 내장 HTTP 서버.
- 주요 화면: 캐릭터, 몬스터, 팀, 장비, 스킬, 진영, 전투, 전투 기록, 이미지 생성 설정.
- 데이터 저장: `data/*.json` 파일을 `server.py`가 REST 비슷한 API로 읽고 씁니다.
- 전투: `setTimeout` 기반 `gameLoop()`에서 경과 시간에 따른 틱, 자동 이동, 공격, 스킬, 로그, 결과 저장을 처리합니다.
- 독립 도구: `character-viewer.html`, `environment-viewer.html`은 로컬 Three.js 기반 3D 개발용 뷰어입니다. 실제 전투 화면은 Canvas 2D입니다.

## 실행 방법

```powershell
python server.py
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8000/
```

포트를 바꿀 때:

```powershell
$env:PORT = "8080"
python server.py
```

## 중요한 파일

- `index.html`: 단일 페이지 앱의 화면 구조, 모달, 탭, 주요 DOM 요소.
- `css/style.css`: 전체 스타일, 전투 화면, 관리 화면, 반응형 레이아웃.
- `server.py`: 정적 파일 서버, JSON API, 이미지 업로드/생성 API.
- `entity_store.py`: 소환 Entity 파일 저장소, 기존 소환 데이터 이전, 스킬 참조 무결성 검사.
- `js/main.js`: 앱 초기화 순서와 첫 렌더링 진입점.
- `js/api.js`: `/api/*` fetch 로드/저장 공통 함수.
- `js/ui.js`: 전역 상태, 상수, 공통 UI 유틸리티.
- `js/battle.js`: 자동 전투 루프, 타겟팅, 이동, 공격, 스킬, 렌더링.
- `js/character.js`: 캐릭터 CRUD와 캐릭터 전투 유닛 생성.
- `js/monster.js`: 몬스터 CRUD와 몬스터 전투 유닛 생성.
- `js/team.js`: 팀 편성, 전투 참가 팀 선택.
- `js/equipment.js`: 아이템/장비 착용, 능력치 합산.
- `js/skill.js`: 스킬 데이터, 액션 편집, 스킬 적용.
- `js/skill-effects.js`, `js/skill-passives.js`, `js/skill-channel.js`: 지속 효과, 패시브, 채널링 처리.
- `js/battle-events.js`: 상세 전투 이벤트 수집과 전달.
- `js/entity.js`: 스킬 편집 내 Entity 관리와 저장 전 미리보기.
- `js/record.js`: 전투 기록 저장, 목록, 페이지네이션.
- `js/layout.js`: 페이지별 레이아웃 크기 설정.
- `js/image-generator.js`: 이미지 생성 화면, Provider 설정, 생성 이미지 저장.
- `data/*.json`: 앱의 실제 데이터. 스키마 변경 시 관련 JS와 README도 같이 확인합니다.
- `docs/`: 현재 구현 요약, 기능별 상세 문서, 설계 원안, 작업 이력. 전체 관계는 [README 문서 안내](README.MD#문서-안내)를 참고합니다. 확장자 대소문자와 기존 파일명을 유지합니다.

## API와 데이터

- `GET /api/<name>`은 `data/<name>.json`을 반환합니다.
- `PUT /api/<name>` 또는 `POST /api/<name>`은 JSON 배열을 해당 파일에 저장합니다.
- 예외: `/api/records`는 `data/battle-records.json`에 매핑됩니다.
- 예외: `GET/PUT /api/image-settings`는 객체 형태의 `data/image-generator-settings.json`을 읽고 저장합니다.
- 예외: `/api/entities/`와 `/api/entities/<id>`는 `data/entities/<id>.json`을 관리합니다. 생성은 POST, 수정은 PUT, 삭제는 DELETE이며 [Entity API](docs/ENTITIES.md)를 따릅니다.
- Entity 및 스킬 조회 시 기존 소환 정의가 자동 이전될 수 있습니다. API 조회도 항상 파일 변경이 없는 동작이라고 가정하지 않습니다.
- 이미지 관련 API는 `server.py`의 `ASSET_IMAGE_DIRS`에 정의된 폴더만 사용합니다.
- JSON 데이터는 사용자가 직접 만든 중요한 콘텐츠일 수 있으므로, 불필요한 재정렬/대량 포맷팅을 피합니다.

## 작업 규칙

- 매 작업 시작 시 이 문서(`AGENTS.md`)와 [README.MD](README.MD)를 먼저 읽고, [작업 재개 메모](docs/resume.md)와 [TODO](docs/todo.md)를 확인한 뒤 작업합니다.
- 아이디어를 구현하기로 정하면 [ideas.MD](docs/ideas.MD)의 해당 내용을 [TODO](docs/todo.md)의 예정·진행 중 항목으로 옮기고, 완료 후 구현 범위와 검증 결과를 완료 체크리스트에 반영합니다. 원래 아이디어에는 상태와 TODO 링크를 남깁니다.
- 기존 구조를 우선합니다. 프레임워크나 빌드 도구를 새로 도입하지 않습니다.
- 새 기능은 관련 모듈에 좁게 추가합니다. 예: 전투 규칙은 `js/battle.js`, 데이터 저장은 `js/api.js`/`server.py`.
- DOM ID, 데이터 필드명, JSON 스키마를 바꿀 때는 `index.html`, 관련 `js/*`, `data/*.json`, `README.MD`를 함께 확인합니다.
- 브라우저에서 직접 `index.html`을 열면 저장 API가 동작하지 않습니다. 저장 기능 확인은 항상 `python server.py`로 실행합니다.
- 사용자 데이터 파일(`data/*.json`, `assets/images/*`)은 요청받은 범위 안에서만 수정합니다.
- 콘솔 로그는 기존 `log`, `logWarn`, `logError` 패턴을 사용합니다.
- 한국어 UI 문구를 수정할 때는 UTF-8 인코딩을 유지합니다.
- `__pycache__`는 실행 부산물이므로 기능 변경에 포함하지 않습니다.

## 변경 전 확인 체크리스트

- 기능이 화면 구조 변경을 필요로 하는가? 그렇다면 `index.html`과 `css/style.css`를 같이 확인합니다.
- 저장되는 데이터인가? 그렇다면 `server.py`, `js/api.js`, 대상 `data/*.json`을 확인합니다.
- 전투 결과에 영향을 주는가? 그렇다면 `js/battle.js`, `js/skill.js`, `js/equipment.js`, 관련 docs를 확인합니다.
- 목록/관리 UI인가? 그렇다면 해당 도메인 JS와 렌더 함수, 폼 초기화 함수, 저장 함수를 함께 확인합니다.
- README 또는 docs와 구현이 어긋나는가? 변경 범위에 맞는 문서를 반드시 함께 갱신합니다.

## 검증 방법

기본 문법 확인:

```powershell
python -m py_compile server.py
```

서버 실행:

```powershell
python server.py
```

수동 확인 포인트:

- 앱 초기화가 완료되고 로그 페이지에 치명적인 오류가 없는지.
- 각 관리 화면의 목록이 로드되는지.
- 데이터를 수정한 뒤 새로고침해도 저장값이 유지되는지.
- 전투 시작, 중단, 결과 보기, 전투 기록 저장이 정상 동작하는지.
- 이미지 저장/생성 기능을 만졌다면 `assets/images/*` 경로와 설정 저장을 확인합니다.

## 자주 생기는 실수

- `data/*.json` 스키마만 바꾸고 렌더링/저장 코드를 놓치는 것.
- `index.html`의 DOM ID를 바꾸고 JS 선택자를 갱신하지 않는 것.
- 전투 로직 수정 후 기록 저장 형식을 확인하지 않는 것.
- API 저장 확인 없이 브라우저 파일 열기만으로 테스트하는 것.
- 큰 JSON 파일을 의미 없이 재포맷해 변경 diff를 키우는 것.

## 기존 설계 문서

- `docs/ENGINE_ARCHITECTURE.md`: 자동 전투 RPG의 핵심 방향.
- `docs/TOTAL.MD`: 전체 게임 규칙 초안.
- `docs/ACTION.MD`: 스킬 액션 구조와 효과 계산.
- `docs/BATTLEGROUND.MD`: 전장/전투 환경 규칙.
- `docs/CLASS.MD`: 직업과 스킬 아이디어.

작업 중 설계와 구현이 충돌하면, 구현된 현재 동작을 먼저 확인한 뒤 변경 의도를 명확히 남깁니다.


## 문서 관리 규칙

작업 시작 시 `AGENTS.md`와 [README.MD](README.MD)를 먼저 읽은 다음 [resume.md](docs/resume.md)와 [todo.md](docs/todo.md)를 확인하고, 코드를 수정하거나 기능을 추가·삭제할 경우 관련 문서를 반드시 함께 최신 상태로 갱신합니다.

반드시 업데이트할 문서

- [docs/todo.md](docs/todo.md): 완료·진행 중·예정 작업을 체크리스트로 관리합니다.
- [docs/changelog.md](docs/changelog.md): 날짜별 실제 변경과 검증 내용을 기록합니다.
- [docs/resume.md](docs/resume.md): 재개할 작업과 주의사항을 기록합니다.

규칙

- 코드와 문서의 내용이 항상 일치하도록 유지한다.
- 구현되지 않은 기능을 현재 구현으로 작성하지 않습니다. 기존 설계 원안과 과거 기록은 상태를 명시하여 보존하며, 실행할 예정 작업은 `todo.md`에서 관리합니다.
- 기능 범위는 `project_overview.md`, 파일 역할·모듈 관계는 `architecture.md`, 저장 필드는 `data_structure.md`, 세부 동작은 관련 기능 문서에 반영합니다. 실행·API·사용 안내가 바뀌면 `README.MD`, 작업 규칙이 바뀌면 `AGENTS.md`도 갱신합니다.
- 작업이 완료되거나 중단될 가능성이 있을 때 `todo.md`, `changelog.md`, `resume.md`를 모두 최신 상태로 갱신합니다.
- `resume.md`는 `마지막 완료 작업`, `현재 진행 중 작업`, `다음 작업`, `작업 중 주의사항`의 네 섹션을 유지합니다. 진행 중 작업이 없으면 없다고 명시합니다.
- `changelog.md`는 프로젝트 전체 이력이며 `SKILL_ENGINE_CHANGELOG.md`는 스킬 엔진 상세 이력입니다. 엔진 변경은 전체 기록에 요약하고 세부 기록을 연결합니다.
- 다음 작업을 시작할 때는 docs/resume.md를 먼저 확인한 후 이어서 진행한다.
