# CharacterViewer / SD 인간형 3D 기반

## 블랭크 헤어 20종 제작 규칙 (2026-10-10)

- 외부 실루엣은 `CrownHair`, `FrontHair`, `SideHair`, `BackHair`, `StyleParts`가 담당합니다.
- 블랭크 20종은 외부 실루엣용 `InternalScalpCover`와 공통 `Hairline` 타원체를 사용하지 않습니다.
- 각 스타일은 전용 `CrownHair_<id>`가 Head 곡면을 얇게 따라가며, front/side/back 종료각과 crown 굴곡·평탄도·방향성을 catalog profile로 가집니다.
- 단발·장발·포니테일·트윈테일·번·땋은 머리 등은 연속 Crown 위에 필요한 `FrontHair`/`SideHair`/`BackHair`/style part만 추가합니다.
- 투구 partial 모드에서는 Crown 역할만 숨기고 Side/Back/포니테일 계열은 유지합니다.
- 생성 코드는 공유하지만 20종 profile은 모두 별도이며, 실제 WebGL 6방향 렌더로 각각 검증합니다.

## 현재 프로젝트와 변경 범위

이 프로젝트는 HTML/CSS/일반 JavaScript와 Python `SimpleHTTPRequestHandler` 기반 앱이다. `package.json`, npm dependency, `src/`, `public/`, 빌드·lint·typecheck 설정은 없다. 기존 UI는 Bootstrap 5.3.3, 이미지 생성 화면은 Puter.js를 외부 스크립트로 사용한다. 현재 로컬 Three.js와 SD GLB 모델을 포함하며 [공통 베이스](SD_BASE_MODEL.md), [외형 조합](PORTRAIT_COMPOSER.md), [외부 모델](IMPORTED_SD_MODELS.md) 문서가 후속 확장을 설명한다.

- [캐릭터 데이터](../data/characters.json): 이름, role, faction, portrait, hp/mp/st/bp, 전투 능력치, attributes, skillIds, equipment. 외형 조합을 적용하면 선택적 `appearance`를 저장하며 상세 필드는 [데이터 구조](data_structure.md)를 참고한다. 전투 유닛을 3D 리그로 렌더링하는 구조는 아니다.
- [캐릭터 모듈](../js/character.js): 데이터 CRUD, 관리 UI, 전투 유닛 생성이 함께 있다.
- [전투 모듈](../js/battle.js): Canvas 2D 원형 초상화(없으면 색상 원), HP, 이름, 스킬 말풍선을 그린다. 계산과 draw 함수가 같은 전역 상태를 공유한다. 실제 `gameLoop()`는 `setTimeout`을 사용한다.
- 향후 3D 전투 전환 시 렌더러, 캐릭터 외형 정의, 애셋 캐시, 게임 상태→애니메이션 연결, 장비 표시가 필요하다. 이번 단계는 이 연결을 구현하지 않는다.

뷰어는 [독립 HTML](../character-viewer.html), [전용 CSS](../css/character-viewer.css), [UI 진입점](../js/character-viewer/main.js), [표현 클래스](../js/character-viewer/CharacterViewer.js)로 구성한다. 기존 게임 스크립트·로그 저장·JSON API를 호출하지 않는다. 기존 전투, 아이콘, 스킬, 사용자 데이터와 서버 동작을 변경하지 않는다.

Three.js **0.180.0**과 공식 GLTFLoader, OrbitControls를 사용한다. 의존 모듈을 포함한 최소 배포 파일과 MIT 라이선스는 [assets/vendor/three](../assets/vendor/three/)에 고정하여 보관한다. npm·React·빌드 도구 없이 import map과 ES modules로 실행하고, 실행 중 CDN 접속은 필요 없다. 출처와 SHA-256은 [vendor 안내](../assets/vendor/three/README.md)를 참고한다.

## 실행 / 모델 선택

프로젝트 루트에서:

```powershell
python server.py
```

브라우저에서 `http://127.0.0.1:8000/character-viewer.html`을 연다. 사용자 지정 `PORT`를 사용하면 주소의 포트도 바꾼다. `file://`로 직접 열지 않는다. WebGL2와 import map을 지원하는 최신 브라우저가 필요하다.

모델 경로 없이 열면 빈 공간과 그리드가 정상 초기 상태이다. 빠른 선택에는 외형 제작 기준인 남성 블랭크와 여성 블랭크만 표시한다. 기존 공통/대머리/외형 기준 GLB는 테스트와 이전 직접 링크 호환 때문에 파일을 유지하며, 필요한 경우 URL 입력란에서 경로로 직접 불러올 수 있다. [제작·보정 안내](SD_BASE_MODEL.md)를 참고한다.

**서버 경로:** 예를 들어 직접 제작한 `human_sd_test.glb`를 [assets/characters/models](../assets/characters/models/)에 추가하고 입력란에 `assets/characters/models/human_sd_test.glb`를 입력한 뒤 불러온다. 이 파일명은 예시이며 실제 파일이 포함되어 있지 않다. 임의의 GLB/glTF 경로를 사용할 수 있다.

**로컬 GLB:** 파일 선택에서 한 개 또는 여러 GLB를 선택하고 아래 목록에서 전환한다. 브라우저 안에서만 읽으며 서버로 업로드하거나 저장하지 않는다. 모델마다 별도의 Object URL을 생성하고 로딩 완료·실패 후 해제한다. 자체 포함형 GLB를 권장한다.

**외부 리소스가 있는 glTF/GLB:** `.gltf`, `.bin`, 텍스처를 원래 상대 경로 그대로 프로젝트 애셋 폴더에 복사한 후 서버 경로로 불러온다. 예: `assets/characters/models/knight/scene.gltf`. 로컬 파일 선택으로 BIN·텍스처 묶음을 재구성하는 기능은 없다. 외부 HTTP(S) URL도 가능하지만 상대 리소스 접근 및 CORS를 제공해야 한다.

**직접 링크:** `http://127.0.0.1:8000/character-viewer.html?model=assets%2Fcharacters%2Fmodels%2Fhuman_sd_test.glb`. 명시한 경로만 요청하며, 자동으로 존재하지 않는 예제 파일을 요청하지 않는다.

## 조작과 정보

- 자동으로 모델 전체를 카메라에 맞춘다. 왼쪽 드래그 회전, 휠 줌, 오른쪽 드래그 이동. `캐릭터 전체 보기`는 현재 포즈에 다시 맞춘다. 창 크기 변경 시에도 다시 프레이밍한다.
- 파일에 실제로 포함된 클립만 duration과 함께 나열한다. 첫 클립은 자동 재생하며 이름 없는 클립에도 표시 이름을 부여한다. 중복 이름은 인덱스로 구분한다. 클립이 없는 모델은 정적으로 표시하고 애니메이션 조작은 비활성화한다.
- 클립 선택, 재생, 일시정지, 정지(선택 클립 첫 프레임), 반복 여부, 0.1~3배 속도를 조절한다. 반복을 끄면 마지막 프레임을 유지하며 재생 버튼으로 다시 시작한다.
- 길이가 0초인 단일 포즈 클립은 반복 계산을 하지 않고 해당 포즈에서 완료한다.
- 표시 배율은 0.001~1000이며 원본 계층 바깥의 그룹에 적용한다. 원본 애니메이션과 root scale을 덮어쓰지 않는다. 기본 단위 변환·키 정규화는 하지 않는다.
- 모델명, scene 내 mesh instance 기준 triangle 수, mesh/material/texture/bone 수, 원본 루트 scale, 표시 배율, 현재 클립, 모든 클립 duration/tracks를 확인할 수 있다.
- 삼각형 수는 geometry의 index 또는 position 개수를 기준으로 한다. 원본 DCC의 quad/poly 수나 매 프레임 실제 draw call 수가 아니며 모든 LOD의 mesh가 합산될 수 있다.
- 텍스처는 재질에서 참조하는 고유 Texture 객체별 이름, 크기, colorSpace를 표시한다. 압축률·GPU 메모리 사용량 추정 기능은 없다.
- Skeleton 표시와 본 목록, `Weapon_R`, `Weapon_L`, `Head_Attachment`, `Back_Attachment`의 존재 여부를 확인한다. 이 이름이나 본이 없어도 오류로 취급하지 않는다.
- 로딩 진행 상태, HTTP/파싱 실패, 참조 텍스처 실패, WebGL 초기화·컨텍스트 손실을 화면에 표시한다. 연속 선택 시 이전 응답은 폐기한다.

## 기본 스타일과 제작 계약

[SD 레퍼런스](art/ChatGPT%20Image%202026년%209월%2024일%20오후%2011_19_42.png)를 기준으로 약 **2.5~3등신**, 큰 머리·눈, 둥근 얼굴과 실루엣, 짧은 팔다리의 귀여운 인간형을 기본 스타일로 한다. 이미지의 5,000~8,000 폴리곤 예시는 제작 참고치이며, glTF 삼각형 수와 동일한 기준으로 단정하지 않는다. 최종 예산은 목표 기기의 다수 캐릭터 측정으로 결정한다.

가능하면 인간형은 동일한 기본 Skeleton/Rig를 공유한다. 이름만 같아서는 애니메이션 호환이 보장되지 않는다. **계층, 로컬 축, rest/bind pose, 뼈 길이 기준, inverse bind matrices, 단위, export 규칙과 리그 버전**을 함께 고정해야 한다. 다른 체형·다른 리그의 자동 retargeting은 이번 범위에 없다.

초기 Skeleton 방향은 아래와 같다. 제작 전 어깨의 부모를 포함한 최종 계층을 확정하고 공통 애니메이션 제작 후에는 임의로 변경하지 않는다.

```text
Root
└ Hips
  ├ Spine
  │ └ Chest
  │   └ Neck
  │     └ Head
  ├ Shoulder_L
  │ └ UpperArm_L
  │   └ LowerArm_L
  │     └ Hand_L
  ├ Shoulder_R
  │ └ UpperArm_R
  │   └ LowerArm_R
  │     └ Hand_R
  ├ UpperLeg_L
  │ └ LowerLeg_L
  │   └ Foot_L
  └ UpperLeg_R
    └ LowerLeg_R
      └ Foot_R
```

`Weapon_R` → `Hand_R`, `Weapon_L` → `Hand_L`, `Head_Attachment` → `Head`, `Back_Attachment` → `Chest` 아래의 export되는 Bone/Node로 제작하는 방향을 권장한다. 장착 노드의 로컬 축과 원점을 통일한다. `CharacterViewer.getAttachmentPoint(name)`은 실제 모델의 노드 또는 `null`을 반환한다. [장비 테스트](SD_BASE_MODEL.md#장착-장비-미리보기)는 모델에 소켓이 있으면 이를 사용하고, 블랭크 Mixamo 모델처럼 소켓이 없으면 Head·Spine2·양손·양발 본 아래에 모델 축 기준 Anchor를 생성한다. 모델의 unloading 알림에서 장비 인스턴스를 먼저 해제한 뒤 본체를 정리한다.

장비 상태는 `head`, `body`, `hands`, `feet`, `mainHand`, `offHand` 여섯 슬롯이다. 카탈로그 항목은 `id`, `slot`, `mounts`, `transform`, 그리고 코드 생성용 `create` 또는 향후 GLB용 `url`을 가진다. rigid GLB는 Y-up, 캐릭터 정면 +Z, 무기 손잡이 중심을 원점으로 export하고 길이 방향은 +Y를 기준으로 한다. 장비별 위치·회전·배율은 카탈로그 `transform`에 기록하며 모델을 직접 변형하지 않는다.

얼굴·피부는 재질/텍스처 variant, 머리·의상은 같은 rig에 맞춘 교체 가능한 skinned mesh, 무기·장식은 attachment node를 중심으로 설계한다. 임의의 mesh를 붙이는 것만으로 의상의 skin binding이 자동 호환되지는 않는다.

권장 export 규칙: glTF 2.0, Y-up, 일관된 미터 단위, 발바닥 기준 원점, 동일한 A/T bind pose 중 하나, 고정된 정면 방향(예: +Z), 정리된 transform. 이동 애니메이션은 우선 in-place를 권장한다. 뷰어는 임의 모델을 보려고 이 규약을 강제하거나 원본을 수정하지 않는다.

공통 클립 이름 규격:

```text
Idle Walk Run Attack_01 Cast Hit Knockdown Death Victory
```

레퍼런스 이미지의 `Attack_1` 표기보다 위 `Attack_01`을 제작 규격으로 우선한다. 뷰어는 어느 이름도 필수로 요구하거나 자동 변환하지 않는다. 직업별 `Sword`, `GreatSword`, `Spear`, `Bow`, `Staff`, `Dagger`, `Shield`, `Unarmed` 세트는 향후 외형 정의와 분리된 animation set 메타데이터로 관리한다. 공통 클립 파일을 여러 모델에 적용하는 기능은 다음 단계이다.

## 애셋 배치와 확장

기존 [assets/images](../assets/images/)는 유지한다. 이번에는 모델을 넣을 [assets/characters/models](../assets/characters/models/)만 생성한다. 실제 제작물이 생길 때 아래 구조를 확장한다.

```text
assets/
  characters/
    base/        # 공통 리그, 기본 몸체, rig version
    models/      # 개별 테스트 GLB/glTF
    equipment/   # 교체 의상 등 skinned mesh
    weapons/     # attachment에 장착하는 rigid mesh
  animations/
    common/
    sword/       # 이후 greatsword/spear/staff/dagger/shield/unarmed 등 추가
    bow/
    magic/       # 캐스팅 계열; 직업 세트와의 매핑은 메타데이터로 정의
  effects/
    physical/
    magic/
    status/
```

다수 캐릭터 단계에서는 게임 데이터에 큰 모델/클립 객체를 저장하지 않고 `visualId`만 연결하는 별도 외형 카탈로그를 검토한다. 카탈로그에는 model URL, rig version, material/mesh variants, animation set, attachment 정의를 둔다. 모델 geometry/material/texture/clip을 재사용하고, 개별 캐릭터의 Skeleton 및 AnimationMixer 상태만 분리한다. SkinnedMesh 복제는 향후 Three.js `SkeletonUtils.clone` 등을 사용한다. 공유 애셋 캐시 도입 시 현재 단일 모델 dispose 정책을 참조 횟수 기반으로 바꿔야 한다.

현재는 단일 모델 표시, device pixel ratio 최대 2, 비활성 탭 렌더 생략, 모델 교체 및 뷰어 종료 시 geometry/material/texture/skeleton/mixer/control 정리를 적용한다. 스트리밍·캐시·LOD·다수 인스턴스 성능 최적화는 아직 구현하지 않았다.

## 지원 범위와 다음 단계

저폴리 rigid 장비 조합은 [공통 베이스 장비 미리보기](SD_BASE_MODEL.md#장착-장비-미리보기)로 지원한다. 현재 미지원: 정식 skinned 갑옷/신발, 양손 IK, 자동 retargeting, 외부 공통 애니메이션 적용, morph target 편집 UI, root-motion 추출, 애니메이션 블렌드·전투 연동, 뷰어 안에서 모델 제작/변환/저장, 폴더 모델 자동 검색, Draco/Meshopt/KTX2 디코더. 압축 모델은 비압축 glTF 2.0으로 export해서 확인한다.

다음 순서 권장:

1. 레퍼런스 기반 실제 인간형 1종과 표준 rig, attachment를 제작하고 피부·의상 변형 검증.
2. 두 번째 캐릭터로 공통 9개 클립의 재사용을 검증하고 rig/animation set 버전 규격 확정.
3. 외부 애니메이션 로더, rig 검증기, 양손 그립 IK와 무기별 동작 보정.
4. 외형 카탈로그, 애셋 캐시, 공유 리소스 수명 관리, 목표 기기에서 10 vs 10 렌더 성능 측정.
5. 별도 작업으로 전투 상태를 표현 계층에 전달하는 adapter 설계.

## 검증 방법
공통 베이스의 외형 조합은 05번 패널에서 사용한다. 머리 20종, 눈 10종, 코 5종, 입 10종, 피부색 5종과 무작위 생성, 부품 잠금, 조합 저장, 정면 PNG 촬영을 지원한다. [사용법과 저장 범위](PORTRAIT_COMPOSER.md)를 참고한다. 아래 최초 검증 기록은 초기 뷰어 구현 시점의 기록이다.

기존 프로젝트에는 build/lint/typecheck 명령이 없다. Python 서버 문법과 자체 JS 모듈 문법을 확인한다.

```powershell
python -m py_compile server.py
node --check js/character-viewer/CharacterViewer.js
node --check js/character-viewer/main.js
git diff --check
```

실행한 서버에서 뷰어 초기화, 정적 모델, 임의 이름/복수 클립, 클립 전환, 반복 해제 후 완료·재시작, 일시정지/정지, 속도, 배율, 모델 교체, 잘못된 URL, 복구, 작은 화면을 확인한다. 실제 SD GLB가 아직 없으므로 제작된 skinned 모델의 변형 품질·공통 클립 호환성·장비 간섭·최종 성능은 해당 애셋 추가 후 검증해야 한다.

### 이번 구현의 검증 결과 (2026-09-25)

- Python 서버 문법 검사, 두 뷰어 JS 모듈의 `node --check`, diff 공백 검사 통과. Three.js 배포 파일 6개의 SHA-256 일치 확인.
- Python 서버와 Chromium에서 빈 초기 화면, 로컬 바이너리 GLB 복수 선택·전환, 정적 GLB, 임의 이름의 두 클립을 가진 skinned glTF 로딩 확인.
- 클립 선택, 재생/일시정지/정지, LoopOnce 완료·재시작, LoopRepeat, 속도, 표시 배율, 카메라 경계 내 모델 포함, attachment 존재·부재, material 해제 확인.
- 손상된 GLB, HTTP 404, 텍스처 로딩 실패의 오류 표시 및 정상 모델로 복구 확인. 2×2 임시 텍스처의 크기와 색 공간 표시 확인.
- 응답 순서가 뒤바뀌는 로딩에서 마지막 모델 유지와 Object URL release 확인. 0초 클립 반복 시 NaN이 발생할 수 있는 경계 조건을 수정한 뒤 재검증.
- 390px 폭에서 가로 넘침 없음 확인.
- 기존 게임 페이지의 Canvas 2D 초기화, 캐릭터 9개·몬스터 6개 로딩 및 오류 로그 없음 확인. 기존 게임에서 CharacterViewer 스크립트가 로드되지 않음을 확인. 전투 결과 저장처럼 사용자 데이터를 변경하는 동작은 이번 검증에서 실행하지 않았다.

모든 테스트 모델은 브라우저 메모리에 생성한 최소 형상·본·클립을 사용했다. 실제 SD 캐릭터 파일이나 사용자 데이터에 테스트 애셋을 저장하지 않았다. 실제 인간형 변형 품질과 최종 성능 검증을 대체하지 않는다. 별도 npm build/lint/typecheck 설정은 추가하지 않았다.


## 장비 외형 override와 pose profile

테스트 장비 catalog는 `fitProfile`, `appearanceOverride`, `poseProfile`을 지원합니다. 테스트 투구는 `hairMode: partial`로 두상 안쪽 cap/front만 숨기고 아래쪽 side/back/style 파츠를 유지합니다. 선택 머리 상태는 바꾸지 않으므로 해제하면 전체 머리가 복원됩니다. 갑옷과 부츠는 남녀 체형별 치수를 사용합니다.

장비 pose는 AnimationMixer 결과 뒤에 합성하고 다음 프레임 전에 이전 보정을 되돌립니다. 검/창에는 제한적 grip만 적용합니다. 방패는 팔을 강제로 꺾지 않고 왼손 아래 `ShieldGripAnchor`의 외측 transform을 사용합니다. 현재 블랭크 GLB는 몸과 발이 하나의 SkinnedMesh이고 완전한 손가락 체인이 없으므로, 발의 실제 body mask와 완전한 grip은 지원하지 않습니다. 정식 장비는 공통 Skeleton, 분리 가능한 body material/mesh 영역, finger bone chain을 포함해야 합니다.

### 장비 피복 단위

테스트 투구는 `partial` hair override를 사용합니다. HairCap·Hairline·FrontHair와 상단 bun은 숨기고 SideHair·BackHair·wave·braid·ponytail은 유지합니다. 투구 해제 시 저장한 외형을 재생성하지 않고 각 파츠의 기존 visibility를 복원합니다.

테스트 갑옷은 Front/Side/Back과 허리·어깨의 rigid part로 구성되며, 테스트 부츠는 ankle/instep/toe/heel 외피로 발 전체를 덮습니다. 방패는 팔 animation을 변경하지 않고 LeftHand 아래 `ShieldGripAnchor`에 장착합니다. 이 구조는 장착 표현 검증용이며, 실제 게임용 갑옷은 공통 Skeleton에 skinning된 GLB가 필요합니다.

### 복장 세트와 분절 본 추적

`body` 슬롯은 플레이트, 사슬갑옷, 가죽갑옷, 판타지 천옷, 턱시도, 셔츠+청바지 여섯 세트를 선택합니다. 플레이트에는 허리와 좌우 상부 다리 보호대를 추가했고, 신규 다섯 세트는 몸통·허리·소매·바지를 서로 다른 저폴리 실루엣과 재질로 구성합니다. 복장 교체는 `body` 슬롯만 바꾸므로 투구·장갑·부츠·주무기·보조무기를 유지합니다.

현재 런타임 프로토타입은 캐릭터 Skeleton의 `Spine2`, `Hips`, 좌우 `Arm/ForeArm`, 좌우 `UpLeg/Leg`에 개별 복장 구간을 rigid attach합니다. 소매와 바지는 각 본을 직접 따라가며 팔꿈치·무릎 시작부에 작은 관절 커버를 겹칩니다. 이는 고정 몸통 한 개보다 애니메이션 추적이 정확하지만 연속적으로 휘는 SkinnedMesh는 아닙니다. 실제 GLB 복장은 동일 origin·scale·T-pose·bone naming·bind matrices를 사용하고, 팔꿈치와 무릎 vertex에 인접한 두 본의 혼합 weight를 주어야 합니다. 남녀는 공통 정의와 별도 fit profile 또는 체형별 geometry variant를 사용합니다.

2026-10-10부터 몸통은 단순 Box/Sphere 대신 목·어깨·가슴·허리·골반의 타원 ring을 연결한 fitted shell을 사용합니다. 턱시도는 shell 위에 셔츠·lapel·bow를, 플레이트는 shell 위에 흉부/허리 band를 둡니다. 로브 하단은 Front/Back/Left/Right 네 패널로 종아리까지 내려오며 cloth simulation은 하지 않습니다. 이 런타임 geometry는 조합·리깅 검증용이고 실제 게임용 복장은 SkinnedMesh GLB로 교체해야 합니다.
# HairCap, 하의 및 복장 팔레트 보정 (2026-10-10)

공통 두피 가림 Mesh는 `InternalScalpCover`라는 내부 레이어로만 사용합니다. 외부 실루엣은 각 헤어 스타일의 FrontHair, Crown, SideHair, BackHair, StyleParts가 담당합니다. 투구의 부분 숨김 규칙도 이 이름을 cap 영역으로 인식합니다.

복장 하의는 남녀 체형별 waist/hip ring을 연결한 fitted shell을 사용합니다. 로브는 Hips에 붙는 짧은 Front/Back/Side 허리 패널과 좌우 UpperLeg에 붙는 Front/Back 패널로 나뉩니다. 현재 구현은 개발용 rigid segmented 방식이며 cloth simulation이나 연속 bone weight skinning은 지원하지 않습니다.

복장 색상은 스타일과 별도인 `outfitColor`로 저장됩니다. 기본색, 검정, 흰색, 회색, 갈색, 네이비, 빨강, 초록의 8개 팔레트를 제공하며 `primary`, `secondary`, `trim` material role에 적용합니다. 색상 변경 시 기존 Mesh와 BufferGeometry를 유지하고 Material 색상만 바꿉니다. 이전 저장 데이터에 `outfitColor`가 없으면 기본색을 사용합니다.

기술 검증에서 여성 단발·긴 머리·포니테일의 모든 파츠가 유효한 geometry와 matrix를 유지했고, 8색 연속 변경 전후 Mesh/Geometry UUID가 동일했습니다. Walking/Running은 각 8구간에서 로브 22개 파츠의 행렬이 유효했습니다. WebGL 캔버스 캡처 제약으로 다각도 외관과 실제 clipping에 대한 최종 시각 판정은 별도 검수가 필요합니다.
