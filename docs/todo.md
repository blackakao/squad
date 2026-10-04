# TODO

## 완료

- [x] 정적 HTML/CSS/JavaScript 기반 자동 전투 RPG 프로토타입 구성
- [x] Python 내장 HTTP 서버와 JSON 저장 API 구현
- [x] 캐릭터, 몬스터, 팀, 진영, 장비, 아이템, 카테고리, 스킬 관리 화면 구현
- [x] 팀 대 몬스터 및 팀 대 팀 자동 전투 구현
- [x] 전투 기록 저장, 목록, 페이지네이션, 상세 이벤트 표시 구현
- [x] 스킬 액션 엔진 확장
- [x] 소환 Entity 파일 저장소와 참조 무결성 검사 구현
- [x] 이미지 생성 설정과 이미지 에셋 저장 API 구현
- [x] SD 캐릭터/환경 뷰어 관련 문서와 도구 추가
- [x] 운영 문서 6종 생성: `project_overview.md`, `architecture.md`, `data_structure.md`, `todo.md`, `changelog.md`, `resume.md`
- [x] README·AGENTS와 운영·기능·설계 문서의 참조 관계 및 갱신 규칙 동기화
- [x] 전투 루프, 기록 저장 필드, 특수 API, 데이터 규모, 3D 뷰어 설명을 현재 코드와 대조하여 정정
- [x] README UTF-8 읽기 확인: 한글 본문 정상, 이전 콘솔 표시만으로 파일 손상을 판단하지 않음

## 진행 중

- [ ] 문서와 코드 변경 사항을 항상 함께 갱신하는 운영 방식 정착
- [ ] 전투/스킬 시스템의 실제 구현과 설계 문서 간 차이 지속 점검

## 예정

- [ ] 데이터 스키마 변경 시 마이그레이션 규칙 문서화
- [ ] 주요 전투 규칙별 최소 회귀 테스트 보강
- [ ] 스킬 액션별 예시 데이터와 테스트 케이스 정리
- [ ] UI 수동 검증 체크리스트를 화면별로 세분화
- [ ] 전투 기록 이벤트 타입 사전 정리
- [ ] 이미지 생성 Provider별 실패/복구 흐름 문서화

## 체크리스트

- [ ] 코드 수정 시 관련 문서 확인
- [ ] 데이터 구조 변경 시 `docs/data_structure.md` 갱신
- [ ] 화면/모듈 구조 변경 시 `docs/architecture.md` 갱신
- [ ] 기능 범위나 방향 변경 시 `docs/project_overview.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/todo.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/changelog.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/resume.md` 갱신
- [ ] 서버 변경 시 `python -m py_compile server.py` 실행
- [ ] 저장 기능 변경 시 `python server.py` 기반 수동 확인
