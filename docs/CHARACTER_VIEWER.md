# CharacterViewer / SD 인간형 3D 기반

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

모델 경로 없이 열면 빈 공간과 그리드가 정상 초기 상태이다. 이후 제작한 [공통 SD 베이스 v1](../assets/characters/base/human_sd_base_v1.glb)은 `?model=assets/characters/base/human_sd_base_v1.glb`를 붙여 확인한다. [제작·보정 안내](SD_BASE_MODEL.md)를 참고한다. 레퍼런스 PNG 자체를 자동으로 3D 변환한 모델은 아니다.

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

`Weapon_R` → `Hand_R`, `Weapon_L` → `Hand_L`, `Head_Attachment` → `Head`, `Back_Attachment` → `Chest` 아래의 export되는 Bone/Node로 제작하는 방향을 권장한다. 장착 노드의 로컬 축과 원점을 통일한다. `CharacterViewer.getAttachmentPoint(name)`은 실제 모델의 노드 또는 `null`을 반환한다. [장비 미리보기](SD_BASE_MODEL.md#장착-장비-미리보기)는 이 노드에 무기 GLB를 장착하며 장비 리소스를 별도로 소유한다. 모델의 unloading 알림에서 먼저 장비를 해제한 뒤 본체를 정리한다.

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

무기·상의 교체는 [공통 베이스 장비 미리보기](SD_BASE_MODEL.md#장착-장비-미리보기)로 지원한다. 현재 미지원: 자동 retargeting, 외부 공통 애니메이션 적용, 얼굴·범용 skinned 의상 교체, morph target 편집 UI, root-motion 추출, 애니메이션 블렌드·전투 연동, 뷰어 안에서 모델 제작/변환/저장, 폴더 모델 자동 검색, Draco/Meshopt/KTX2 디코더. 압축 모델은 비압축 glTF 2.0으로 export해서 확인한다.

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
