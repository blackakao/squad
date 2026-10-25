# VS Code Agent Guide

## 1. 프로젝트 개요

- 관전형 자동 전투 RPG 프로토타입. 별도 빌드 없는 정적 HTML/CSS/JavaScript 앱과 Python 내장 HTTP 서버로 구성합니다.
- 주요 화면: 캐릭터, 몬스터, 팀, 장비, 스킬, 진영, 전투, 전투 기록, 이미지 생성 설정.
- 전투는 Canvas 2D와 `setTimeout` 기반 `gameLoop()`로 틱, 이동, 공격, 스킬, 로그, 결과 저장을 처리합니다. `character-viewer.html`, `environment-viewer.html`은 별도의 로컬 Three.js 개발용 뷰어입니다.
- 실행: `python server.py` → `http://127.0.0.1:8000/`. 포트 변경 등은 [실행 방법](README.MD#실행-방법)을 참고합니다.

## 2. 핵심 파일 및 구조

| 영역 | 파일 및 역할 |
| --- | --- |
| 화면·스타일 | `index.html`: 화면·모달·DOM, `css/style.css`: 스타일·반응형 |
| 서버·저장 | `server.py`: 정적 서버·JSON/이미지 API, `entity_store.py`: Entity 저장·이전·스킬 참조 무결성 |
| 초기화·공통 | `js/main.js`: 초기화, `js/api.js`: 로드·저장, `js/ui.js`: 상태·상수·UI 유틸리티, `js/layout.js`: 페이지 크기 |
| 전투·기록 | `js/battle.js`: 루프·타겟팅·이동·공격·렌더링, `js/battle-events.js`: 상세 이벤트, `js/record.js`: 기록 저장·목록·페이지네이션 |
| 캐릭터·팀·장비 | `js/character.js`, `js/monster.js`: CRUD·전투 유닛 생성, `js/team.js`: 편성·참가 선택, `js/equipment.js`: 장착·능력치 합산 |
| 스킬·Entity | `js/skill.js`: 액션 편집·적용, `js/skill-effects.js`, `js/skill-passives.js`, `js/skill-channel.js`: 지속 효과·패시브·채널링, `js/entity.js`: Entity 관리·저장 전 미리보기 |
| 이미지 | `js/image-generator.js`: Provider 설정·생성·저장 |
| 데이터·문서 | `data/`: 실제 사용자 데이터, `docs/`: 현재 구현·설계 원안·이력 |

상세 모듈 관계는 [아키텍처](docs/architecture.md), 문서 위치는 [README 문서 안내](README.MD#문서-안내)를 참고합니다. 기존 파일명과 확장자 대소문자를 유지합니다.

## 3. 작업 시작 및 문서 탐색 원칙

- 이 문서(`AGENTS.md`)를 기본 작업 지침으로 사용합니다. 매 작업마다 [README.MD](README.MD) 전체를 읽지 않습니다.
- 이전 작업을 이어받거나 진행 상태 확인이 필요할 때만 [재개 메모](docs/resume.md)와 [TODO](docs/todo.md)의 관련 부분을 확인합니다. 재개 작업은 재개 메모부터 확인합니다.
- 작업 관련 기능 문서만 선택적으로 읽고, 필요한 정보가 일부에 있으면 해당 절만 확인합니다. 같은 작업에서 이미 확인한 동일 문서를 불필요하게 반복해서 읽지 않습니다.
- 프로젝트 구조를 이해해야 하는 신규 작업이나 대규모 변경은 필요한 문서를 충분히 확인합니다.
- 현재 구현과 설계 원안을 구분합니다. 설계와 구현이 충돌하면 현재 동작을 먼저 확인하고 변경 의도를 기록합니다. 설계 참고: [엔진 방향](docs/ENGINE_ARCHITECTURE.md), [전체 규칙 초안](docs/TOTAL.MD), [액션](docs/ACTION.MD), [전장](docs/BATTLEGROUND.MD), [직업 아이디어](docs/CLASS.MD).

## 4. 코드·데이터 변경 규칙

- 기존 아키텍처와 모듈 경계를 우선하며 프레임워크·빌드 도구를 새로 도입하지 않습니다. 새 기능은 관련 모듈에 좁게 추가하고 요청 범위 밖의 정리·변경을 피합니다.
- 사용자 데이터(`data/*.json`, Entity 개별 파일 포함)와 에셋(`assets/images/*`, GLB 등)은 요청 범위에서만 수정합니다. 게임 데이터·에셋을 임의로 삭제하거나 재생성하지 않습니다. JSON의 불필요한 재정렬·대량 포맷팅을 피합니다.
- DOM ID·필드명·JSON 스키마 변경 시 `index.html`, 관련 JS, 대상 데이터, README의 관련 설명을 확인합니다. 기존 데이터 호환성과 렌더링·저장·선택자 연동을 함께 검토합니다.
- 변경 영역에 따라 필요한 코드를 확인합니다: 화면 구조는 HTML/CSS, 저장은 `server.py`·`js/api.js`·대상 데이터, 전투 결과는 `js/battle.js`·`js/skill.js`·`js/equipment.js`·기록 저장 형식·관련 문서, 관리 UI는 도메인별 렌더·폼 초기화·저장 함수.
- 콘솔 로그는 기존 `log`, `logWarn`, `logError` 패턴을 사용합니다. 한국어 UI를 포함한 텍스트는 UTF-8을 유지합니다. 실행 부산물인 `__pycache__`는 기능 변경에 포함하지 않습니다.

### API 주의사항

- 일반 `GET /api/<name>`은 `data/<name>.json`을 반환하고, `PUT/POST`는 JSON 배열을 저장합니다.
- 예외: `/api/records` → `data/battle-records.json`; `GET/PUT /api/image-settings` → 객체 형태의 `data/image-generator-settings.json`.
- `/api/entities/`, `/api/entities/<id>`는 `data/entities/<id>.json`을 관리하며 생성 POST·수정 PUT·삭제 DELETE를 사용합니다. [Entity API](docs/ENTITIES.md)와 [데이터 구조](docs/data_structure.md)를 따릅니다.
- Entity 및 스킬 조회는 기존 소환 정의를 자동 이전할 수 있습니다. API 조회가 항상 파일을 변경하지 않는다고 가정하지 않습니다.
- 이미지 API는 `server.py`의 `ASSET_IMAGE_DIRS`에 정의된 폴더만 사용합니다.

## 5. 문서 갱신 규칙

변경과 관련된 문서만 다음 기준으로 갱신하여 코드와 문서의 일치를 유지합니다. 단순 문구 수정이나 사소한 내부 정리만으로 모든 문서를 일괄 수정하지 않습니다.

| 문서 | 갱신 조건과 내용 |
| --- | --- |
| [todo.md](docs/todo.md) | 작업 상태가 실제로 바뀔 때 예정·진행 중·완료 체크리스트 갱신 |
| [changelog.md](docs/changelog.md) | 의미 있는 기능·동작·데이터 구조 변경 시 날짜별 변경·검증 기록 |
| [resume.md](docs/resume.md) | 미완료·중단 작업 또는 다음 작업에 중요한 주의사항이 있을 때 갱신. 기존 미완료 상태가 해소되면 정정 |
| 기능별 문서 | 해당 기능의 계약·동작 변경 시 갱신. 기능 범위는 [project_overview.md](docs/project_overview.md), 모듈 관계는 [architecture.md](docs/architecture.md), 저장 필드는 [data_structure.md](docs/data_structure.md)에 반영 |
| [README.MD](README.MD) | 실행 방법·주요 사용법·프로젝트 진입 정보 변경 시 갱신. API 안내가 영향을 받으면 해당 부분 반영 |
| [AGENTS.md](AGENTS.md) | 작업 규칙 변경 시 갱신 |

- 완료·중단 시에도 위 조건에 해당하는 문서만 갱신합니다. 이력이 필요하면 적절한 한 곳에 기록하고 다른 문서에서는 링크로 참조합니다.
- [ideas.MD](docs/ideas.MD)의 아이디어를 구현하기로 정하면 TODO의 예정·진행 중 항목으로 옮깁니다. 원래 아이디어에는 상태와 TODO 링크를 남기고, 완료 체크리스트에는 구현 범위·검증 결과 또는 상세 기록 링크를 반영합니다.
- 구현되지 않은 기능을 현재 구현으로 쓰지 않습니다. 기존 설계 원안과 과거 기록은 상태를 명시해 보존하고 실행 예정 작업은 TODO에서 관리합니다.
- 재개 메모는 `마지막 완료 작업`, `현재 진행 중 작업`, `다음 작업`, `작업 중 주의사항` 네 섹션을 유지합니다. 갱신 시 진행 중 작업이 없으면 없다고 명시합니다.
- 전체 이력은 changelog, 스킬 엔진 상세 이력은 [SKILL_ENGINE_CHANGELOG.md](docs/SKILL_ENGINE_CHANGELOG.md)에 기록합니다. 엔진 변경은 전체 이력에 요약하고 상세 기록을 연결합니다.

## 6. 검증 및 테스트 규칙 (Validation Rules)

- 기본적으로 코드 수정 후 자동 테스트를 실행하지 않습니다. 다음 경우에만 테스트를 수행합니다: 사용자의 명시적 요청, 핵심 로직 변경, 배포 직전 검증 필요.
- UI·문구·CSS·문서 수정은 정적 분석만 수행하고 테스트를 실행하지 않습니다.
- 같은 테스트를 반복 실행하지 않습니다. 실패 원인이 인코딩·로그 출력 등의 환경 문제라면 재시도하지 않고 사용자에게 보고합니다.
- 허용된 검증은 변경 범위에 맞춰 수행합니다. 서버 문법 확인이 필요하면 `python -m py_compile server.py`를 사용합니다.
- 저장 기능 검증은 반드시 `python server.py`로 실행합니다. HTML 파일을 직접 열면 저장 API가 동작하지 않습니다.
- 동작 검증이 필요한 경우 관련 항목을 확인합니다: 초기화·치명적 오류·관리 목록, 저장 후 새로고침 유지, 전투 시작·중단·결과·기록 저장, 이미지 경로·설정 저장.

## 7. 작업 완료 보고 규칙

- 변경 파일·목적·주요 동작, 수행한 검증과 결과, 미검증 사항이나 남은 작업을 간략히 보고합니다.
- 테스트를 실행하지 않았다면 정적 검토와 구분하여 명시합니다. 측정하지 않은 성능·토큰 절감 수치를 제시하지 않습니다.
- 완료·중단 기록은 위 문서 갱신 조건을 적용하며, 보고만을 위해 여러 문서에 같은 내용을 복제하지 않습니다.
