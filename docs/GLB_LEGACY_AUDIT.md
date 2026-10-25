# GLB / Legacy 캐릭터 시스템 의존성 조사

## 1. 조사 개요

2026-10-25 작업 트리 기준 정적 조사다. HTML 진입점, JS import·전역 함수·문자열 경로, Python 카탈로그 API, JSON 설정, GLB JSON 청크를 읽었다. 게임·브라우저·자동 테스트·Blender를 실행하지 않았다. 자산 구조를 읽었다는 사실은 GLTFLoader 로딩 성공이나 화면 품질 검증을 뜻하지 않는다.

결론: **게임 전투는 Canvas 2D 초상화, 메인 제작 화면은 GLB 조립기, Legacy 화면은 절차형 외형과 GLB 비교 도구**다. GLB 조립 저장은 게임 캐릭터 저장과 연결되지 않았다. Legacy 관련 파일 전체를 제거하면 공통 로더·좌표 변환·게임 외형 정규화까지 손상될 수 있다.

조사 시작 때 이미 수정된 [저장 자료 보고서](balance/STORAGE_AUDIT.md), [변경 이력](changelog.md), [TODO](todo.md)는 별도 작업 변경으로 취급했다. 이번 변경은 이 보고서와 TODO의 조사 링크에 한정한다. 기존 코드·데이터·에셋·Git 인덱스를 수정하지 않는다.

## 2. 현재 캐릭터 시스템 구조

| 영역 | 실제 구현과 근거 | 판단 |
| --- | --- | --- |
| 게임 캐릭터 로딩 | [api.js](../js/api.js)의 `loadJsonFile`, [ui.js](../js/ui.js)의 캐릭터 정규화, [characters.json](../data/characters.json) | 게임 JSON 및 portrait 사용 |
| 전투 유닛 | [character.js](../js/character.js)의 `createCharacter`가 원본 배열 index를 런타임 `id`로 사용하고 portrait 전달 | GLB assetId와 별도 식별자 |
| 전투 렌더링 | [battle.js](../js/battle.js)의 `drawUnit`: 초상화 `drawImage`, 없으면 색상 원 | GLB·Skeleton·절차형 외형을 직접 그리지 않음 |
| 메인 제작 | [main-assembler.js](../js/character-viewer/main-assembler.js)의 `loadGender`, [assembler.js](../js/character-viewer/assembler.js)의 `setupAssembler` | GLB 전용, JS 파츠 fallback 없음 |
| Legacy 제작 | [main-legacy.js](../js/character-viewer/main-legacy.js): composer·JS 장비·GLB 파츠·GLB 장비 초기화 | 독립 비교·회귀 도구로 현재 참조됨 |
| 환경 뷰어 | [viewer.js](../js/environment/viewer.js) → [core.js](../js/three/core.js)의 `createView`, `AssetCache`, `createCharacter` | 공통 CharacterViewer와 SkeletonUtils.clone 사용. 게임 전투와 별도 |

## 3. 페이지별 실행 경로

### 게임

[index.html](../index.html)은 hair-colors → imported-catalog → catalog → bridge와 게임 스크립트를 일반 script로 읽는다. 캐릭터 제작 메뉴는 [character-viewer.html](../character-viewer.html)로 이동한다. 게임 페이지에는 Three.js 모델 조립 진입점이 없다. Legacy 스키마 정규화는 게임에 남아 있지만 Legacy 3D 외형 생성기를 전투에서 호출하지 않는다.

### 메인 GLB 조립기

[character-viewer.html](../character-viewer.html)의 동적 import는 `main-assembler.js`다. 로컬 Three.js import map을 사용한다. `loadGender`는 [남성 베이스](../assets/characters/base/대머리%20블랭크%20얼굴%20남자.glb) 또는 [여성 베이스](../assets/characters/base/대머리%20블랭크%20얼굴%20여자.glb)를 고정 선택한다. 시작 시 카탈로그를 읽고 로컬 프리셋 성별을 선택한 뒤 복원을 요청한다.

[server.py](../server.py)의 `list_character_parts` → `GET /api/character-assets/parts`가 폴더 바로 아래 GLB만 열거한다. 서버를 import하거나 API를 호출하지 않고 소스와 디스크를 조사했다(API는 폴더 생성도 수행한다). 파일 stem이 ID, 상대 경로가 로딩 위치, mtime이 로딩 캐시 키다. 서버는 `female`/`여성`, `male`/`남성`으로 **시작하는 문자열**을 성별로 분류한다(밑줄 필수 아님). 메인 `render`는 현재 성별 또는 공용 파일만 남긴다.

`CharacterPartPreview` 두 개가 신체와 장비를 분리 관리한다. 의류는 서버 신체 분류에서 UI 장비 `clothes` 슬롯으로 옮긴다. 장착·해제·무작위·색상·로컬 저장은 이미 구현됐다. 저장·PNG 버튼은 파츠 로딩 중 비활성화된다. `downloadPortrait`는 현재 renderer canvas를 PNG로 저장하며 게임 JSON에 적용하지 않는다.

### Legacy

[character-viewer-legacy.html](../character-viewer-legacy.html)은 세 catalog 스크립트와 `main-legacy.js`를 읽는다. `setupComposer` → `Appearance` → Imported/Bald/BlankAppearance 및 IndependentHair가 절차형 파츠를 만든다. `setupEquipment`는 테스트 장비와 Anchor를, `setupCharacterParts`·`setupGlbEquipment`는 외부 GLB 비교를 담당한다. URL `model`과 로컬 파일 선택은 이 경로에 있다. 메인 GLB 페이지는 이 URL 계약을 처리하지 않는다.

게임의 [bridge.js](../js/portrait/bridge.js) `openPortraitComposer`는 여전히 메인 페이지에 `model`·`compose`를 전달한다. 수신 준비 메시지는 Legacy `setupComposer`에만 있다. 조사한 HTML·JS·테스트·도구에서 `openPortraitComposer` 호출부는 발견되지 않았다. 따라서 **현재 메뉴 클릭이 실패한다고 단정할 수는 없지만, 이 함수를 다시 연결하면 기존 통신 계약이 맞지 않는다**. `resetPortraitAppearance`는 캐릭터 편집에서 실제 사용하므로 bridge 파일 전체를 미사용으로 분류하지 않는다. 함수에 남은 영문 베이스 경로도 현재 파일 목록과 맞지 않는다.

## 4. 모듈 의존성 목록

계수 범위는 [character-viewer](../js/character-viewer/) 12개와 [portrait](../js/portrait/) 11개의 JS 파일, 총 **23개**다. 파일 단위로 중복 없이 분류했다. GLB 전용 **3**, Legacy 실행 전용 **9**, 두 뷰어 공통 **5**, 게임·Legacy 공통 스키마 **3**, 게임 브리지 **1**, 활성 진입 참조 미확인 **2**다. HTML·서버·vendor·환경·게임 모듈은 이 수에 포함하지 않는다. ‘Legacy 전용’은 현재 호출 페이지 기준이며 파일 안의 모든 기능이 절차형이라는 뜻은 아니다.

| 파일 | 사용 시스템 / 참조 위치 | 역할·판단 |
| --- | --- | --- |
| [main-assembler.js](../js/character-viewer/main-assembler.js) | GLB / 메인 HTML | 성별·로딩·재생·PNG·저장 UI, 유지 |
| [assembler.js](../js/character-viewer/assembler.js) | GLB / main-assembler | 조합·ID 복원·색상·성별 필터, 유지 |
| [equipment-visibility.js](../js/character-viewer/equipment-visibility.js) | GLB / assembler | `applyOutfitVisibility`·복원, 유지 |
| [main-legacy.js](../js/character-viewer/main-legacy.js) | Legacy / Legacy HTML | 현재 독립 진입점, 유지 |
| [equipment.js](../js/character-viewer/equipment.js) | Legacy / main-legacy | `EquipmentPreview`, 절차형 장비·Anchor·pose, 독립 보존 |
| [glb-equipment.js](../js/character-viewer/glb-equipment.js) | Legacy / main-legacy | Legacy 화면 GLB 장비 UI 어댑터, 독립 보존 |
| [composer.js](../js/portrait/composer.js) | Legacy / main-legacy | 조합·초상화·프리셋·postMessage, 독립 보존 |
| [Appearance.js](../js/portrait/Appearance.js) | Legacy / composer | 외형 구현 선택·기본 절차형 파츠, 독립 보존 |
| [ImportedAppearance.js](../js/portrait/ImportedAppearance.js) | Legacy / Appearance | 수입 베이스 외형 조립, 독립 보존 |
| [BaldAppearance.js](../js/portrait/BaldAppearance.js) | Legacy / Appearance | 대머리 베이스 외형 조립, 독립 보존 |
| [BlankAppearance.js](../js/portrait/BlankAppearance.js) | Legacy / Appearance | 블랭크 외형 조립, 독립 보존 |
| [IndependentHair.js](../js/portrait/IndependentHair.js) | Legacy / 위 세 외형 구현 | 독립 스타일 geometry·색상, 독립 보존 |
| [CharacterViewer.js](../js/character-viewer/CharacterViewer.js) | 공통 / 두 진입점·여러 외형 모듈·three/core | 로더·렌더러·Mixer·dispose, 반드시 유지 |
| [character-parts.js](../js/character-viewer/character-parts.js) | 공통 / assembler·main-legacy·glb-equipment | `CharacterPartPreview`, 재바인딩·비동기 수명, 반드시 유지. Legacy UI 함수도 같은 파일에 있음 |
| [part-randomizer.js](../js/character-viewer/part-randomizer.js) | 공통 / character-parts | `createRandomPartPlan`, 후보 선택, 유지 |
| [part-colors.js](../js/character-viewer/part-colors.js) | 공통 / character-parts·assembler | 머티리얼 팔레트, 유지 |
| [PartSpace.js](../js/portrait/PartSpace.js) | 공통 / character-parts·Legacy 외형 | `capturePartSpace`, 루트→Head 좌표, 반드시 유지 |
| [hair-colors.js](../js/portrait/hair-colors.js) | 게임·Legacy / 두 HTML script | Legacy 색상 ID 정의, 유지 |
| [imported-catalog.js](../js/portrait/imported-catalog.js) | 게임·Legacy / 두 HTML script | 외형 v2·성별·정규화, 유지 |
| [catalog.js](../js/portrait/catalog.js) | 게임·Legacy / 두 HTML script·ui·bridge·composer | `PortraitCatalog.normalize` v1/v2, 반드시 유지 |
| [bridge.js](../js/portrait/bridge.js) | 게임 / index·character | 편집 draft 정규화와 과거 popup 계약, 부분 경로 재검토 |
| [main.js](../js/character-viewer/main.js) | 참조 미확인 / 문서에는 구 진입점으로 남음 | main-legacy와 바이트 동일. 현재 HTML은 호출하지 않음; 외부 직접 import 여부 미확인 |
| [external-hair.js](../js/character-viewer/external-hair.js) | 참조 미확인 | CharacterPartPreview/setupCharacterParts의 호환 re-export. 외부 소비자 미확인 |

추가 필수 의존성: [server.py](../server.py)의 카탈로그·이미지·게임 JSON API, [별칭 JSON](../assets/characters/asset-id-aliases.json), [Three.js 배포](../assets/vendor/three/), [환경 core](../js/three/core.js), [게임 캐릭터](../js/character.js)·[ui](../js/ui.js)·[api](../js/api.js)·[전투](../js/battle.js). import의 `?v=`가 서로 달라 같은 파일의 여러 모듈 인스턴스가 생성될 수 있으므로 향후 공통 코드 이동 시 URL까지 대조해야 한다. 이번에는 수정하지 않았다.

## 5. 저장 데이터 호환성

| 구분 | 현재 계약·근거 | 위험 / 유지 조건 |
| --- | --- | --- |
| 게임 캐릭터 ID | `createCharacter(character, index)`의 index, 현재 원본 38행에 `id` 필드 없음 | GLB assetId로 대체하거나 배열 재정렬 금지. 팀 참조와 별도 계약 필요 |
| 게임 외형 | 선택적 `appearance`를 `PortraitCatalog.normalize`로 정규화. 현재 38행에는 appearance·assetId 없음 | 과거/외부 저장이 없다는 증거는 아님. 기존 portrait와 v1/v2 해석 보존 |
| Legacy ID | v1 `m1/f1`, `eye1`, `hc1` 등; v2는 `base: male/female`, 추가 눈색·귀 등 | GLB 파일 stem과 자동 대응 없음. 같은 version=2라도 GLB payload와 스키마가 다름 |
| Legacy 프리셋 | `sd-portrait-presets-v1`, 최대 40개 `{name,style,equipment}`; composer 저장 코드 | JS 테스트 장비 ID 저장. 외부 GLB 경로·transform의 정식 프리셋 계약과 다름 |
| GLB 프리셋 | `sdCharacterAssembler.v1` 키에 payload `version:2,name,gender,bodyParts,equipment,savedAt` 하나 저장 | 이름별 여러 저장이나 서버 저장 아님. origin/브라우저 변경·로컬 저장소 삭제 시 유지 보장 없음 |
| 파츠·색상 | `{assetId,name,color}` 또는 null. bodyParts: hair/eyes/eyebrows/mouth/nose; equipment: clothes/head/body/hands/feet/mainHand/offHand | 게임 아이템 equipment와 이름이 유사해도 아이템·능력치 계약 아님. 색상은 지원 머티리얼의 hex이며 Legacy 색상 ID와 다름 |
| 경로·별칭 | `apply`: 현재 ID → aliases 또는 과거 path/name 일치로 탐색 | 현재 저장 name은 displayName(stem), fallback은 file.name(확장자 포함)을 비교하므로 rename 복구를 name에 의존하면 안 됨 |
| 애니메이션·transform | GLB 프리셋에 선택 클립·재생시각·카메라·파일별 transform 저장 없음 | 새로고침 후 외형 복원과 같은 포즈 복원은 별개 |

별칭 JSON 146개 키 중 현재 자동 목록의 stem과 일치하는 것은 104개, 일치하지 않는 것은 42개다. 별칭은 **현재 파일 키에 연결된 배열**만 API로 반환되며, 다른 별칭을 재귀 탐색하지 않는다. 예를 들어 `female_underwear_skinned_v3`는 `여성_속옷` 키에 있으나 그 파일은 현재 [legacy 의류 폴더](../assets/characters/parts/clothes/legacy/)에 있고 자동 목록의 [여성_의류_속옷.glb](../assets/characters/parts/clothes/여성_의류_속옷.glb)와 stem이 다르다. 별칭 파일이 존재한다는 사실만으로 모든 구 프리셋 복원을 보장하지 못한다.

상황별 동작:

- 과거 Legacy appearance: 게임 정규화와 Legacy composer 경로는 남아 있다. 메인 조립기에서 Legacy 파츠를 GLB로 변환하는 코드가 없으므로 자동 전환 가능으로 판단하지 않는다.
- GLB rename/누락: aliases가 현 파일에 연결되면 복원 가능. 없으면 `apply`가 해당 카테고리를 제거한다. 복원 후 다시 저장하면 해제 상태가 저장될 수 있어 원본 프리셋 보관이 선행돼야 한다.
- GLB 파츠 로딩 실패: `CharacterPartPreview.load`는 새 인스턴스 성공 전 기존 정상 인스턴스를 유지한다. 복원 `apply`는 오류를 catch하고 선택 UI를 비운 뒤 진행하므로 ‘복원 완료’ 문구만으로 전체 성공 판정 금지.
- 베이스 로딩 실패: `CharacterViewer.load`는 먼저 `clearModel`한다. 따라서 파츠 교체 실패와 달리 이전 베이스 보존을 보장하지 않는다.
- 재바인딩 실패: 파일 로딩 자체는 계속될 수 있다. 일부 SkinnedMesh만 성공하면 원본 Bone root 제거도 수행하므로 혼합 성공 자산의 안전성을 별도 확인해야 한다.
- 새로고침: 메인 시작 코드에 로컬 성별·조합 복원이 있다. 실제 저장→새로고침 외형 동일성, 실패·빠른 성별 전환 경합, 저장소 오류는 이번에 미검증이다. 게임 편집 저장은 명시 필드로 객체를 재구성하므로 미래 GLB 필드를 추가할 때 정규화·편집 저장 양쪽을 함께 연결해야 한다.

## 6. GLB 및 애니메이션 호환성

### 현재 자산과 자동 목록

서버 레지스트리 폴더 직하 GLB를 정적으로 센 결과는 **234개**다. 성별 필터 전 전체 수이며 사용자 화면에는 일부만 표시된다.

| 분류 | 수 | 구조 확인 |
| --- | ---: | --- |
| Hair / Eyes / Eyebrows / Mouth / Nose | 36 / 20 / 0 / 10 / 10 | Head rigid 부착 코드 경로. Eyebrows 자산 없음 |
| Clothes | 42 | 모두 skin 포함, 자체 animation 없음, bodyHide metadata 4개 |
| Head / Body / Hands | 40 / 0 / 0 | Head 모두 skin 포함, hideHair=true metadata 32개. Body·Hands 빈 목록 |
| Feet / MainHand / OffHand | 36 / 22 / 18 | 모두 skin 포함, 자체 animation 없음 |

별도 [legacy 의류](../assets/characters/parts/clothes/legacy/) 12개는 모두 skin 포함, 자체 animation 없음이며 직하 검색에서 제외된다. 이는 삭제 가능 판정이 아니다.

### Skeleton·장착

메인 남녀 베이스 GLB의 skin은 각각 28 joint이며 **joint 이름·순서가 동일**하다. 예: 원본 `mixamorig:Hips`, `mixamorig:Head`, `mixamorig:RightHandMiddle4`, `headfront`. [GLTFLoader](../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js)의 `createUniqueName`과 [Three core](../assets/vendor/three/build/three.core.js)의 `PropertyBinding.sanitizeNodeName`이 이름의 예약 문자를 제거하므로 런타임 코드의 `mixamorigHead`와 원본 이름 표기는 다르다.

[character-parts.js](../js/character-viewer/character-parts.js)의 `rebindSkinnedMeshes`는 모든 source joint 이름을 base Bone에 대응시키고 source inverse bind matrix와 bind matrix를 사용한다. 공통 Bone 객체를 참조하는 새 Skeleton을 만들며, 모든 자산이 하나의 Skeleton 객체를 공유하는 것은 아니다. 이름 일치는 남녀 체형·축·rest pose·weight·inverse bind 호환성을 보장하지 않는다. 이번에는 행렬·weight의 전수 수치 대조나 동작 변형 검증을 하지 않았다.

Hair/Eyes/Mouth/Nose/Eyebrows는 `head-root-space`와 `capturePartSpace`로 Head에 부착한다. 해당 분류는 SkinnedMesh 재바인딩 대상으로 지정되지 않았다. Clothes·장비는 character-root에 붙고 Clothes 또는 `rebindSkeleton` 설정일 때 본을 재연결한다. GLB 주무기·보조무기는 별도 Weapon Anchor로 옮기는 구조가 아니며 스킨 weight가 손 추종을 결정한다. rigid 장비를 이 폴더에 넣는 것만으로 손 Anchor 부착이 생기지 않는다.

Legacy `EquipmentPreview.buildAnchors`는 손·전완·발 등으로 Anchor를 만들고 검/창/방패를 부착한다. CharacterViewer 모듈의 `inspectModel`이 표시하는 Weapon_R/Weapon_L 존재 여부와 실제 Legacy 생성 Anchor, GLB 스킨 장착을 구분해야 한다.

### 클립·grip·마스킹·색상

- 남성 베이스 **23개**, 여성 **25개** animation이 이미 있다. 대기·걷기·달리기뿐 아니라 한손/양손/활/석궁/주문 등 이름의 클립이 포함됐다. `CharacterViewer.load`는 베이스 animation을 Mixer에 연결하고 대기/idle이 있으면 선택한다. 파츠 GLB의 클립을 별도 Mixer에 병합하지 않는다. 클립 존재는 무기별 게임 행동 연결·적절한 타이밍·시각 품질 검증 완료가 아니다. G6를 ‘공격 클립이 하나도 없음’으로 해석하면 안 된다.
- Legacy `EquipmentPreview.applyPose`에는 `oneHandGrip`에 대한 RightHandMiddle4 회전 보정이 있다. 완전한 손가락 리그 제어·양손 보조 손 IK solver는 조사한 실행 모듈에서 확인되지 않았다. 이를 GLB 조립기가 자동 상속하지 않는다.
- 메인 `applyOutfitVisibility`는 headwear의 `hideHair:true`로 **선택한 외부 Hair owner 전체**를 숨긴다. 선택·저장 값은 유지한다. Legacy의 `hairMode:partial`·Crown/Front/Side/Back 역할별 숨김은 별도 구현이다. GLB geometry 구간별 helmet mask가 구현됐다는 뜻이 아니다.
- 메인 bodyHide는 의류 source metadata만 읽고 base `Mesh_0` SkinnedMesh에 적용한다. Y 구간과 지정 본 weight 합 >0.35인 정점으로 구성된 triangle을 제거한 복제 geometry를 사용하고 해제 때 복원한다. 현재 body 장비·발 장비의 일반 마스크 처리로 확장되어 있지 않다. 일부 의류 4개의 metadata를 전체 의상 지원으로 확대 해석하지 않는다.
- `part-colors.js`는 머리·눈·의류·발·머리장비의 역할별 머티리얼을 선택적으로 변경한다. 형태와 색상 저장이 분리돼 있다. 새 재질명·중복 재질·색상 복원 품질은 실물 검증 필요다.
- 긴 머리/어깨·겨드랑이·허리·무릎·로브 극단 자세 clipping, 남녀 fit, 발 가림, 방패 strap, 양손 무기 손 위치는 정적 구조만으로 합격 처리하지 않는다.

### 과거 preview 오류 자산

[resume](resume.md)의 `female_underwear_preview.glb`·`male_underwear_preview.glb` 오류 기록은 유지한다. 현재 캐릭터 자산 트리에서 `*preview*.glb`와 `*_skinned_new.glb` 이름을 찾지 못했다. 원래 파일과 현재 한글 파일의 동일성을 입증할 과거 파일 해시 대조는 하지 않았으므로 ‘수정 완료’ 또는 ‘삭제됨’으로 단정하지 않는다.

현재 자동 목록에는 기존 영문 preview 이름도, legacy 하위 폴더의 12개도 나오지 않는다. 그러나 서버는 직하 `.glb`의 유효성·오류 이력을 검사하지 않으므로 잘못된 GLB가 직하에 들어오면 정상 파일과 함께 노출된다. Legacy의 직접 경로/로컬 파일 로딩은 자동 목록 제외와 별개다. `Invalid typed array length: 20`의 재현·원인·해소 여부는 미검증이다.

## 7. Legacy 코드 분류

| 분류 | 대상과 근거 | 처리 조건 |
| --- | --- | --- |
| A 반드시 유지 | 공통 5개, 게임·Legacy 스키마 3개, bridge의 `resetPortraitAppearance`, 서버·별칭·vendor·기존 데이터 | 현재 GLB/게임/환경 실행 또는 저장 해석에 사용. 폴더명으로 일괄 제거 금지 |
| B 전환 후 제거 후보 | bridge의 구 popup URL/메시지 계약, character-parts의 Legacy 전용 UI `setupCharacterParts` 부분 | 새로운 편집 연결과 구 저장 복원 대체, Legacy 유지 방침 확정 이후 부분 분리·제거 검토. 파일 전체 삭제 대상 아님 |
| C 미사용 가능성 | character-viewer/main.js, external-hair.js | 현재 실행 import 미발견, 전자는 문서 참조와 main-legacy의 동일 사본, 후자는 호환 re-export. 직접 URL·외부 호출·회귀 도구까지 추가 확인 필요 |
| D 독립 보존 | Legacy 전용 9개·Legacy HTML·관련 스타일·베이스·의류·헤어 profile | 독립 뷰어와 과거 외형 재현 목적. GLB 기본 전환만으로 삭제 사유가 되지 않음 |

**즉시 안전하게 삭제 가능하다고 확정한 코드는 없다.** B/C는 검토 목록이며 이번에는 한 줄도 삭제하지 않는다.

## 8. 알려진 오류와 미검증 항목

| 항목 | 정적 확인 / 남은 검증 |
| --- | --- |
| 구 문서의 메인 진입점·URL·빈 초기화 | [뷰어 문서](CHARACTER_VIEWER.md)의 main.js·model 쿼리 설명은 현재 메인과 불일치. Legacy 설명과 분리 필요 |
| 새로고침·PNG 설명 | [파츠 문서](CHARACTER_PARTS_GLB.md)의 목록 새로고침 시 장착 파일 재로딩, 공통 512×512 캡처 설명을 메인에 그대로 적용할 수 없음. 메인 `refresh`는 목록 재렌더만 수행, `downloadPortrait`는 현재 canvas 캡처 |
| 장비 제한 설명 | [장비 문서](GLB_EQUIPMENT_GUIDE.md)의 예전 자산 수·성별 수동 선택·마스크 제한은 현재 메인 범위와 다름. 전체 hideHair와 일부 bodyHide는 구현됨 |
| 구 회귀 테스트 진입 | [test_character_viewer_parts.py](../tests/test_character_viewer_parts.py)는 메인 URL에 model을 전달하고 portrait-preview, debug.equipment 등 Legacy UI를 기대함. 현재 메인은 debug.viewer/assembler와 다른 DOM 사용. 테스트를 실행하지 않았으며 현 상태 통과를 주장하지 않음 |
| 오래된 베이스 경로 | bridge와 위 테스트에 human_sd_base_v1 등 현재 베이스 목록에 없는 이름이 남음. 페이지 경로만 바꾸면 충분하다고 가정 금지 |
| 별칭 공백·복원 부분 실패 | 5절의 42개 비활성 alias 키, 누락 ID 해제, 오류 catch와 완료 문구, 잘못된 saved.gender/version 입력 검증 부족 검토 |
| 성별·비동기·메모리 | 연속 성별 변경/복원/무작위 시 최종 외형 일치, 자산 실패 후 GPU 리소스 정리와 공통 Bone 영향은 화면·수명 검증 필요 |
| Q1·Q3·V13 | 과거 헤어 완료 범위 충돌, preview 오류, 로브·다리 전체 주기 및 clipping 검증은 유지. 이번 정적 조사로 완료 처리하지 않음 |

## 9. 단계별 안전한 전환 계획

다음은 실행 승인이 아닌 후속 설계다. 이미 구현된 GLB 조립·팔레트·로컬 저장·본 재바인딩·일부 마스크·클립을 다시 만들지 않는다. 데이터 변경 전에는 사용자 저장과 로컬 프리셋을 별도로 보존하고 격리 복사본에서 검증한다. 실패 시 다른 작업의 변경을 포함한 저장소 전체 reset을 사용하지 않는다.

| 단계 / 수정 대상 | 선행 조건·예상 위험 | 검증 방법·완료 기준 | 실패 시 복구 |
| --- | --- | --- | --- |
| 1 의존성 기준 확정: 본 보고서, 뷰어 문서, 기존 viewer 회귀 경로 | Legacy 독립 유지 범위 결정. 구 테스트가 잘못된 페이지를 검사할 위험 | 승인 후 테스트 페이지·DOM·베이스 경로를 현재 계약과 대조. GLB/Legacy/환경의 실행 목록과 검증 대상이 각각 확정되면 완료 | 문서/테스트의 해당 변경만 취소하고 기존 파일 보존 |
| 2 저장 계약: data_structure·catalog·ui·character의 설계 | 배열 index와 GLB ID 분리, appearance v1/v2 보존. 같은 version=2 혼동·편집 시 필드 유실 위험 | 선택적인 GLB 외형 정의와 기존 portrait의 관계를 명시. 구 JSON round-trip·알 수 없는 버전 정책을 복사 데이터로 검증할 명세 확정 | 기존 스키마·정규화 경로 유지, 변환본 별도 보관 |
| 3 안정 ID/경로: aliases·server catalog·assembler.apply | 누락 alias 42개와 의류 후속 파일의 실제 대응을 사람이 확정. 임의 시각 대응 금지 | 구 ID/rename/누락/성별/중복 ID에 대해 명시 매핑 또는 미지원 상태 확인. 기존 104개 활성 alias의 회귀도 확인 | 기존 ID·파일·alias 유지, 추가 매핑만 되돌림 |
| 4 제작 저장·복원: assembler/main-assembler 및 좁은 회귀 검사 | 2~3 계약 확정. 현재 로컬 저장 재사용. 오류를 성공으로 표시·성별 경합 위험 | 복사 프리셋으로 저장→새로고침, 색상·해제·누락·손상 GLB·저장소 실패·빠른 전환 확인. 부분 실패가 명시되고 정상 외형 일치 시 완료 | 원본 프리셋 재적용, 신규 포맷을 기존 키에 파괴적으로 덮어쓰지 않음 |
| 5 게임 연결: character·ui·api·bridge와 명시적 저장 UI | 사용자 선택: 2D 초상화 연결만 또는 이후 3D 전투 별도 프로젝트. 실제 ID/장비 계약 승인 필요 | 전자라면 기존 2D drawUnit 유지하면서 승인된 외형 정의+PNG만 저장. 저장·재로드·기존 캐릭터·팀 index·기록 호환 통과 시 완료 | 기존 portrait/appearance 읽기 경로 및 원본 데이터로 복원, 새 필드는 비활성화 |
| 6 동작·장비 품질: 현재 베이스 클립·장비·마스크 규격 | 이미 있는 23/25개 클립 우선 평가. 남녀 rig 수치·fit 차이, IK/손가락 한계 | 남녀·대표 장비·정면/후면/측면·전체 동작 주기·극단 자세·색상·hair/body 복원 검증. 클립별 허용 범위와 결함 목록 확정 | 기존 자산 유지, 승인된 개선 자산만 교체하며 이전 버전 즉시 선택 가능 |
| 7 제거 후보 재조사: B/C 부분 및 테스트·문서·외부 호출 | 4~6의 필요한 범위 통과, Legacy 보존 결정. 숨은 직접 링크 위험 | 정적·동적 실행 및 외부 도구 목록 대조. 공통/게임/환경에 영향 없는 후보 파일·함수 목록과 대체 경로 확정 | 실제 제거 전 유지, 후보를 별도 목록으로만 관리 |
| 8 승인 후 정리: 확정 후보만 | 삭제·이동·추적 해제 대상별 사용자 승인 필수 | 좁은 변경 후 GLB/Legacy 유지 범위·환경·구 데이터 호환 검증. 승인 범위 밖 수정 없음 | 해당 정리 변경만 복구; 자산·저장 원본과 공통 모듈 유지 |

서버/API를 바꾸는 단계는 실행 서버 재시작이 필요하다. 단순 자산 추가와 코드/API 변경의 재개 조건을 구분한다. 대규모 전투 시뮬레이션은 이 전환 검증의 대체 수단이 아니다.

## 10. 사용자 결정이 필요한 사항

- 게임 연결 범위: 우선 GLB 조합에서 생성한 2D portrait와 외형 정의를 저장할지, 실시간 3D 전투는 별도 범위로 추진할지.
- Legacy 독립 뷰어·외형 프리셋·옛 직접 링크의 지원 기간과 보존 수준.
- 비활성 alias의 실제 후속 자산 대응, 누락 ID의 복원 정책(경고·미해결 보존 등), 파일명과 독립된 안정 ID 도입 범위.
- 개발용 단일 로컬 프리셋을 어느 범위까지 게임/서버 저장으로 확장할지. 기존 스키마 변경은 별도 승인 대상이다.
- 검증할 기기·클립·장비 조합과 clipping 허용 기준, 완전한 grip/IK가 필요한 무기 범위.
- 7단계에서 확정될 실제 삭제·이동·추적 해제 목록. 현재 승인 요청 가능한 안전한 삭제 목록은 확정하지 않았다.

이번에는 조사와 계획만 작성했다. 정적 참조·GLB 메타데이터 확인을 실제 실행 검증으로 표시하지 않으며, 과거 미검증 상태를 완료로 변경하지 않는다.
