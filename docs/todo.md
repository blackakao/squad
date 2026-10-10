# TODO

## 2026-10-10 블랭크 헤어 20종 연속 surface 전환

- [x] 승인된 남성 01 숏컷의 형상과 수치를 기준선으로 고정
- [x] 남성 02~10에 스타일별 front/side/back 경계와 crown 굴곡 적용
- [x] 여성 01~10에 스타일별 연속 crown surface와 기존 장발·묶음 파츠 연결
- [x] 20종의 공통 `InternalScalpCover`와 타원형 `Hairline` 외부 렌더 제거
- [x] 남녀 각 10종을 정면·45도·측면·후방 45도·후면·상단 실제 WebGL 렌더로 검수
- [x] 머리 색상 유지, 투구 partial 숨김·복원, 무작위 조합의 현재 성별 유지 확인
- [x] CharacterViewer 기본 모델 버튼을 남성/여성 블랭크 2종으로 정리
- [ ] 현재 절차형 hair surface를 최종 아트 GLB 파츠로 교체할 때 동일 역할명과 anchor 계약 유지

## 2026-10-10 남성 01 단정한 숏컷 시각 정상화

- [x] 최신 영상에서 대머리 두상 위 덮개처럼 보이는 남성 01 실루엣 재정의
- [x] m1의 공통 `InternalScalpCover`, Crown strand, `Hairline`, 분리형 FrontHair 사용 제거
- [x] 헤어라인·정수리·측두부·후두부를 잇는 `CrownHair_ShortSurface` 제작
- [x] 좌우 `TempleHair`와 후면 `BackHair`로 귀 주변과 목 위 종료선 보강
- [x] 정면·좌측 45도·좌측·후방 45도·후면·상단 실제 WebGL 렌더 확인
- [x] 머리 색상 변경 시 geometry 유지 및 Material 색상만 변경 확인
- [x] 투구 장착 시 Crown 숨김, Temple/Back 유지, 해제 시 Crown 복원 확인
- [x] 남성 나머지 9종과 여성 10종을 스타일별 surface profile과 추가 파츠로 제작

## 2026-10-10 공주 반묶음 대표 헤어 정수리 정합성

- [x] 첨부 화면의 갈색 타원형 원인을 공통 `Hairline` SphereGeometry로 특정하고 f10에서 제거
- [x] f10 전용 `CrownHairSurface`를 얇은 연속 외피로 구성하고 `SideHair`/`BackHair`와 연결
- [x] cap 꼭짓점 triangle fan winding을 수정해 정수리 원형 누락 제거
- [x] 정면·좌우 45도·측면·후면·상단 실제 WebGL 렌더 확인
- [x] f10↔f1 20회 반복 교체, 색상 변경, 투구 부분 숨김·복원 확인
- [ ] 나머지 여성/남성 헤어는 공통 둥근 Crown을 복사하지 말고 스타일별 Crown/Front/Side/Back 실루엣으로 순차 전환

- [x] CharacterViewer 공통 HairCap을 내부 scalp cover로 축소하고 스타일별 Crown/Side/Back 실루엣으로 분리 (2026-10-10)
- [x] 원통형 골반 하의를 체형별 fitted hip shell로 교체하고 로브 하단을 UpperLeg 추적 패널로 분리 (2026-10-10)
- [x] 복장 8색 팔레트, material role, geometry 재생성 없는 색상 변경, 저장/복원 구현 (2026-10-10)
- [x] CharacterViewer 동적 UI의 손상된 한글 문자열 복구 (2026-10-10)
- [ ] 남성 숏컷·여성 단발·긴 머리·포니테일을 정면/45도/측면/후면/상단에서 최종 시각 검수
- [ ] Walking/Running 전체 주기에서 로브와 다리 clipping을 캡처 가능한 브라우저 환경으로 최종 시각 검수

## 최근 완료

- [x] CharacterViewer 외형 실루엣 개선 (2026-10-10): Box/Sphere 중심 복장 몸통을 남녀 체형 ring 기반 fitted shell로 교체하고, 턱시도 lapel·셔츠 panel, 플레이트 shell/band, 종아리까지 내려오는 4면 로브를 구현했다. 눈매 10종을 실제 geometry 차이로 재설계하고 눈 색상 8종을 독립 저장 필드로 분리했다. HairCap은 두피 노출 방지용 내부층으로 축소하고 스타일별 Crown 가닥과 앞뒤 좌표를 보정했다.

- [x] 스킬 관리 UI/UX 재구성 (2026-10-09): 목록 헤더와 편집기를 분리하고 기본 정보·발동 설정·비용·액션의 4개 Section으로 정리. 공통 입력 2열 Grid, 번호형 Action Card, 대상 조건 분리, 채널링 접기, 상단 Sticky 저장, 900px/620px 반응형 적용. 데이터·JSON·전투 로직은 유지했으며 스킬 엔진 141개와 브라우저 기존/신규 스킬 회귀 검증 완료.

- [x] CharacterViewer 복장 세트·팔다리 추적 프로토타입 (2026-10-09): 플레이트 하의와 사슬갑옷·가죽갑옷·판타지 천옷·턱시도·셔츠+청바지를 추가하고, 몸통/골반/좌우 상완·전완/상퇴·하퇴의 10개 Anchor에 분절 외피를 연결했다. 여성 블랭크 6개 클립, 남성 블랭크, 공통 베이스 Idle/Walk/Run/Attack_01/Cast/Hit/Death에서 추적과 무기·방패 상태 유지를 확인했다. 연속 팔꿈치·무릎 변형은 정식 SkinnedMesh 작업으로 남긴다.

## 완료

- [x] 아이콘 배경 자동 제거 (2026-10-09): 기존·신규 아이콘 공통 적용, 원본·기존 알파 보존, 체크무늬 미리보기, 강도·끄기 저장, 캐시와 실패 시 원본 표시. Node 7개·격리된 Python API/Chrome 테스트 4개 통과. [사용법과 한계](ICONS.md#배경-자동-제거-2026-10-09)
- [x] CharacterViewer 장비 피복 표현 2차 개선 (2026-10-09): 갑옷을 Front/Side/Back 구조로 확장하고, 투구는 HairCap/앞머리만 숨기는 partial override로 변경. 방패 팔 강제 pose를 제거하고 ShieldGripAnchor 외측 장착으로 교체했으며, 부츠를 발등·발가락·뒤꿈치 외피로 확장. 여성 블랭크와 공통 베이스 애니메이션 브라우저 검증 완료.


- [x] CharacterViewer 장비 착용 정합성 1차 개선 (2026-10-09): 투구 hairMode 숨김/복원, 남녀 armor/boot fit profile, 비누적 grip/shield pose modifier, 장비·외형 독립 상태 및 저장 복원 검증. 통합 SkinnedMesh 발의 실제 마스킹과 완전한 손가락 grip은 모델 규격 작업으로 남김.

- [x] CharacterViewer 이마/장비 테스트 시스템 (2026-10-09): HairCap의 전면 종료각과 앞머리/Hairline lift만 조정해 남녀 얼굴 파츠 Y 배치를 유지하면서 이마 공간과 스타일별 노출 차이를 확대했다. 외형과 분리된 6개 장비 슬롯, Mixamo/공통 리그 Anchor, 저폴리 투구·갑옷·장갑·부츠·검·창·방패, 슬롯별 제거, 조합 저장·복원과 rigid GLB 확장 경로를 구현했다. 공통 베이스 Idle/Walk/Run/Attack_01/Cast/Hit/Death WebGL 추종 및 분할 브라우저 회귀 9개, Node 6개 통과.

- [x] CharacterViewer 얼굴 깊이·여성 HairCap 정합성 보정 (2026-10-09): 실제 Head 표면을 기준으로 눈 레이어와 입의 Z 깊이를 줄이고, 남성 얼굴 Y 비율과 코 돌출은 유지했다. 앞머리 하단을 추가로 올리고 여성 입 위치를 별도 보정했다. 여성 HairCap은 단일 crown pole과 정수리 집중 ring 분포로 바꿔 10종의 정면·45도·측면·후면·상단 렌더에서 원형 두피 노출을 제거했다. Chrome/WebGL 회귀 테스트 6개와 Node 테스트 6개 통과.

- [x] CharacterViewer 블랭크 얼굴 비율·여성 헤어·얼굴 파츠 확장 (2026-10-08): 앞머리 하단을 올려 이마 공간 확보, 여성 공통 transform, 독립 Face/파츠 Anchor, 눈썹·코·입 각 5종과 저장 호환, 저비용 웨이브 단발 f7 구현. Node 6개 및 Chrome/WebGL 7개 통과, m1/f1/f7 6방향 확인. [구조와 비용](IMPORTED_SD_MODELS.md#대머리-블랭크-남녀-모델-현재-머리얼굴-파츠-지원)

- [x] CharacterViewer 단정한 숏컷 Hair/Head 정합성 보정 (2026-10-08): 정수리만 존재하던 Cap을 앞 헤어라인·측면·후두부 종료각이 다른 공통 비대칭 Hair Cap으로 교체하고 Hair Anchor 및 카탈로그형 스타일 transform 도입. 6방향 WebGL 검증, 남녀 20종 공통 구조, 머리색·기존 생명주기 회귀 5개 통과. [측정과 보정값](IMPORTED_SD_MODELS.md#대머리-블랭크-남녀-모델-현재-머리눈-지원)

- [x] CharacterViewer 블랭크 눈 실제 렌더 누락 및 머리 반복 교체 형상 손상 수정 (2026-10-07): 애니메이션 중 Head 행렬에 의존하던 파츠 좌표를 로드 시 고정 좌표계로 교체하고 눈/머리 그룹 수명주기를 분리. Running 중 눈 10종 WebGL 캡처와 머리 01↔02 20회 왕복 구조 서명·독립 리소스 검증 통과. [재검증](IMPORTED_SD_MODELS.md#대머리-블랭크-남녀-모델-현재-머리눈-지원)

- [x] CharacterViewer 파츠 적용 수명주기 분리, 독립 머리 색상 8종과 저장·복원, 메인 메뉴 직접 진입 추가 (2026-10-07). 카탈로그 Node 테스트 6개, JavaScript/Python 문법 검사와 실제 Chrome 선택 순서·색상 유지·저장 복원·메뉴 회귀 검증 통과. [외형 조합 안내](PORTRAIT_COMPOSER.md)

- [x] 대머리 블랭크 남녀 GLB 머리·눈 조합 (2026-10-07): 모델별 두상/얼굴 좌표 보정, 독립 가발 남녀 각 10종, 독립 눈 10종, 지원 항목만 표시, 블랭크 남녀 전환, Head 본 추종. JS 문법 검사와 브라우저 고유 렌더·본 추종 검증 완료. [지원 범위](IMPORTED_SD_MODELS.md#대머리-블랭크-남녀-모델-현재-머리눈-지원)

- [x] 이미지 버튼 입력 검증·상태 표시·중복 실행 방지 및 한글 저장 이름 보존 수정. 2026-10-07 재개 후 Node 8개 통과. [상세 및 검증 한계](IMAGE_GENERATION.md)

- [x] 이미지 생성 내 스타일 관리: 이름·스타일 문장 여러 개 저장, 불러오기, 수정·삭제, 중복/빈 입력 방지, 실패 시 보존. Node 총 6개 통과 및 실제 서버 브라우저 저장·새로고침·수정·삭제 확인. [안내](IMAGE_GENERATION.md)

- [x] 이미지 생성 오류 점검 (2026-10-05): Puter 제공 종료 기본 모델 교체, 모델별 제공자 자동 선택, 중첩 오류/HTML 응답 안내, 불필요한 Puter 조회 제거. Node 회귀 테스트 4개·문법 검사 통과. [검증 범위](IMAGE_GENERATION.md)

- [x] [ideas.MD](ideas.MD)의 동일 카테고리 아이콘 관리 구현 (2026-10-05): 클래스·장비 슬롯·무기/방어구 카테고리·스킬 유형·진영별 공통 매핑, 대체 표시명, 이미지 업로드·미리보기, 관리 목록 적용, 저장·수정·해제. [구현 범위](ICONS.md)
- [x] 아이콘 기능 검증: 관련 Node 테스트 10개 통과, 실제 서버에서 업로드·저장·새로고침 유지·공통 적용·해제 복원 확인
- [x] 작업 시작 시 AGENTS·README 필수 확인 및 아이디어의 TODO 이관 규칙 명시

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

- [ ] 브라우저 연결 복구 후 생성/저장 첫 클릭 및 스크롤 위치 확인. 저장 첫 클릭 누락의 원인은 아직 재현되지 않음.

- [ ] 문서와 코드 변경 사항을 항상 함께 갱신하는 운영 방식 정착
- [ ] 전투/스킬 시스템의 실제 구현과 설계 문서 간 차이 지속 점검

## 예정

- [ ] rigid segmented 로브의 달리기·공격 극단 자세 틈과 fitted 복장의 겨드랑이/허리 clipping을 정식 공통 Skeleton SkinnedMesh GLB로 교체
- [ ] HairCap 내부층 축소 후 남녀 20종을 상단·후면 포함 6방향으로 최종 아트 검수하고 스타일별 Crown 폭/흐름 미세 조정

- [ ] 정식 SkinnedMesh 갑옷에서 겨드랑이·허리 극단 자세 clipping 보정 및 헤어 geometry 구간 단위 helmet mask 규격 확정


- [ ] 실제 게임용 갑옷/의상 GLB를 공통 Skeleton·bind pose에 맞춘 SkinnedMesh로 제작하고 Skeleton 공유/복제 규격 확정
- [ ] 무기별 공격·시전 클립, 양손 무기 보조 손 IK, 방패 전완 strap 및 장비별 충돌 보정

- [ ] 공통 Hair Cap을 적용한 나머지 남성 머리 9종(m1 제외)의 6방향 아트 검수와 필요 시 카탈로그 `transform` 미세 보정. 여성 10종은 2026-10-09 정면·45도·측면·후면·상단 검수를 완료했다.
- [ ] 전투용 3D 도입 전에 다중 Mesh 헤어를 스타일별 단일 geometry/GLB로 병합해 캐릭터당 draw call 절감

- [ ] 실제 Puter 계정으로 수정 후 생성·저장 확인 및 Pollinations/Hugging Face 기존 엔드포인트 지원 여부 점검

- [ ] 데이터 스키마 변경 시 마이그레이션 규칙 문서화
- [ ] 주요 전투 규칙별 최소 회귀 테스트 보강
- [ ] 스킬 액션별 예시 데이터와 테스트 케이스 정리
- [ ] UI 수동 검증 체크리스트를 화면별로 세분화
- [ ] 전투 기록 이벤트 타입 사전 정리
- [ ] 이미지 생성 Provider별 실패/복구 흐름 문서화

## 체크리스트

- [ ] 작업 시작 시 `AGENTS.md`, `README.MD`, `docs/resume.md`, `docs/todo.md` 읽기
- [ ] 구현할 아이디어를 TODO로 옮기고 완료 시 구현 범위·검증 결과 반영
- [ ] 코드 수정 시 관련 문서 확인
- [ ] 데이터 구조 변경 시 `docs/data_structure.md` 갱신
- [ ] 화면/모듈 구조 변경 시 `docs/architecture.md` 갱신
- [ ] 기능 범위나 방향 변경 시 `docs/project_overview.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/todo.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/changelog.md` 갱신
- [ ] 완료/중단 가능성이 있는 작업 후 `docs/resume.md` 갱신
- [ ] 서버 변경 시 `python -m py_compile server.py` 실행
- [ ] 저장 기능 변경 시 `python server.py` 기반 수동 확인
