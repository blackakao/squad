# SD 환경 및 BattleStage

## 현재 프로젝트 분석

현재 체크아웃은 정적 HTML/CSS/JavaScript와 Python 서버로 구성된다. 전투는 `js/ui.js`의 2D Canvas와 `js/battle.js`의 자동 전투 루프를 사용한다. 작업 중 추가된 [CharacterViewer](../js/character-viewer/CharacterViewer.js)는 로컬 Three.js 0.180.0, Renderer, Perspective Camera, OrbitControls, GLTFLoader, AnimationMixer, 리소스 해제를 제공한다. GLB 캐시는 없으며 캐릭터 GLB도 포함되어 있지 않다.

기존 서버와 CharacterViewer의 렌더링 기반 및 `disposeObject`를 재사용한다. 게임 초기화, 캐릭터 데이터, 전투, 스킬, 이미지 API와 CharacterViewer 파일은 변경하지 않는다. 기존 사용자 변경이 있는 README는 안내만 덧붙인다.

## 실행과 검증

`python server.py` 실행 후 <http://127.0.0.1:8000/environment-viewer.html>을 연다. 별도 빌드나 패키지 설치는 없다. CharacterViewer와 같은 로컬 Three.js 0.180.0을 사용하며 WebGL2가 필요하다. 환경에 필요한 동일 버전의 RoundedBoxGeometry와 SkeletonUtils만 기존 vendor 폴더에 추가했다. Three.js MIT 라이선스는 기존 vendor LICENSE를 따른다.

- 드래그 회전, 휠 확대/축소, 오른쪽 드래그 이동, 기본 카메라 복원.
- Stage 재로드, 낮/저녁 조명, SpawnPoint·Grid·Wireframe·그림자·나뭇잎 표시.
- SpawnPoint 선택 후 임시 캐릭터 또는 같은 서버의 GLB 배치. 같은 위치는 교체한다.
- FPS, DrawCall, 삼각형은 실제 Renderer 통계다. FPS는 기기와 브라우저 환경에 따라 달라진다.
- GLB 경로 예: `assets/characters/test.glb`. 파일 업로드나 사용자 데이터 저장 기능은 없다.
- GLB 캐릭터는 높이 1.8로 정규화하고 발밑을 맞춘다. 첫 AnimationClip을 재생하며 스켈레톤은 개체마다 복제한다. 루트 이동 애니메이션은 SpawnPoint를 벗어날 수 있으므로 제자리 대기 클립을 권장한다.

## 구성과 소유권

| 파일 | 역할 |
| --- | --- |
| [environment-viewer.html](../environment-viewer.html) | 독립 개발 화면, import map |
| [environment-viewer.css](../css/environment-viewer.css) | 반응형 Viewer 화면 |
| [core.js](../js/three/core.js) | CharacterViewer 렌더링 어댑터, 환경 조명, GLB Promise Cache, 캐릭터 정규화와 AnimationMixer |
| [assets.js](../js/environment/assets.js) | 재사용 가능한 절차적 Asset 원형과 Instancing |
| [stage.js](../js/environment/stage.js) | Stage 검증, 정적 GLB 등록, 배치, SpawnPoint, 환경 효과 |
| [viewer.js](../js/environment/viewer.js) | UI, 임시 캐릭터, 통계, 수명 관리 |
| [stage.json](../assets/environments/stages/forest/stage.json) | 첫 초원/숲 구성 |

공통 모듈은 게임 DOM과 전투 상태를 참조하지 않는다. `createView`는 CharacterViewer를 생성해 Renderer, Scene, Camera, OrbitControls, ResizeObserver를 그대로 사용하고 전장용 설정을 덧붙인다. 기존 인물용 Grid는 숨기고 보조광은 제거하며 갱신 루프만 환경용으로 교체한다. 단일 모델을 교체하는 CharacterViewer.load와 달리 환경에서는 다중 개체 복제와 Promise Cache가 필요해 별도 AssetCache를 제공한다. 향후 CharacterViewer의 캐시 통합은 별도 리팩터링으로 진행한다.

환경 원형은 Geometry/Material을 공유하며 같은 Asset의 각 Mesh는 InstancedMesh로 배치한다. Stage는 인스턴스 버퍼와 디버그/효과 리소스만 소유한다. 절차적 Asset은 EnvironmentAssets, GLB 원본은 AssetCache가 소유한다. 재로드는 이전 Stage를 해제하고 페이지 종료는 캐시와 Renderer까지 해제한다. GLB 로딩 Promise를 URL별로 공유하고 실패 항목은 제거해 재시도할 수 있다. 캐시는 Viewer 수명 동안 유지한다.

## 아트 규격

- 오른손 좌표, Y-up, 바닥은 XZ, 전방은 +Z, 발밑 중심 원점. 회전은 라디안이다.
- 캐릭터 높이는 1.8 단위, 약 2.5~3등신. 제공된 2.7등신 더미는 비율 확인용이며 최종 캐릭터 Asset이 아니다.
- 낮은 채도 초록과 흙색, 큰 면, 둥근 모서리, 덩어리형 수관과 굵은 줄기를 사용한다. 나무 높이는 기본 약 3.5 단위다.
- MeshStandardMaterial의 높은 roughness, metalness 0을 기본으로 한다. 광택·미세 노멀·스캔 재질은 지양한다. GLB 제작자는 같은 재질 규격을 적용한다. 로더가 원본 재질을 강제 변환하지 않는다.
- sRGB 출력과 ACES tone mapping은 CharacterViewer 기반을 공유한다. 환경은 노출 1.15, Hemisphere Light와 Directional Light 각 1개를 적용한다. 인물 단독 Viewer의 보조광과 자유 배율은 유지되므로 최종 GLB 도입 시 양쪽 프리셋을 비교해야 한다.
- 기본 카메라는 FOV 32도의 약한 원근 3/4 시점이다. 얼굴과 전장을 함께 보도록 약 28도의 고도에서 시작하고 회전 고도를 제한한다. 순수 등각보다 앞뒤 위치와 캐릭터 입체감이 드러난다.
- 외곽 배경은 캐릭터보다 낮은 대비를 유지한다. 실제 캐릭터가 들어오면 색, 비율, 얼굴 가림과 공격 효과 가독성을 다시 확인한다.

## BattleStage 선택 이유와 데이터

현재 게임은 관전형 소규모 전투이고 탐험 지형이나 타일 이동 시스템이 없다. 무한 타일/청크보다 작은 전장 바닥과 반복 Props의 조합을 우선한다. 초원은 20×14, 중앙 전투 영역은 X -6~6, Z -3~3이다. 장식은 그 밖에 배치한다. 전투 영역과 SpawnPoint는 현재 표시 및 설계 정보일 뿐 충돌·이동·전투 규칙을 바꾸지 않는다.

Stage 데이터의 `version`은 1이다. `id`, `name`, `theme`, `battleArea`, `camera`, `lighting`, `effects`, `assetDescriptions`, `placements`, `spawnPoints`로 구성된다. 배치는 `asset`, `position`, 선택적 `rotationY`, `scale`을 가진다. SpawnPoint는 고유 `id`, `position`, `rotationY`를 가진다. Player_01~03, Enemy_01~03, Boss를 제공한다.

GLB로 원형을 교체하려면 Stage에 다음 필드를 추가한다. 현재 파일은 절차적 Mesh만으로 실행되며 외부 환경 GLB가 필수는 아니다.

```json
"assetSources": {
  "Tree": "assets/environments/vegetation/trees/tree.glb",
  "Rock": "assets/environments/props/rocks/rock.glb"
}
```

환경 GLB는 바닥 중심 원점, 실제 단위, 적용된 변환, 불투명 재질을 권장한다. 현재 Instancing 경로는 정적 Mesh 전용으로, 스켈레톤·모프·애니메이션·중첩 InstancedMesh는 거부한다. DRACO/KTX2 디코더는 아직 설치하지 않았다. 기본 비압축 GLB를 사용한다. standalone glTF 다중 파일 로딩 UI는 제공하지 않는다.

## Asset 및 지역 확장

첫 Stage는 잔디 바닥, 흙길, 나무, 바위, 덤불, 풀, 꽃, 울타리, 언덕으로 구성한다. 절차적 원형은 개발용 기반이며 최종 아트 GLB 제작은 별도다. 필요해질 때만 다음 경로에 Asset을 추가한다. 빈 폴더나 사용하지 않는 더미 파일을 미리 만들지 않는다.

```text
assets/environments/
  terrain/{grass,dirt,sand,snow,stone,water,cliff,road}/
  vegetation/{trees,bushes,grass,flowers}/
  props/{rocks,crates,barrels,fences,signs}/
  structures/{houses,ruins,bridges,castle}/
  stages/{forest,desert,snowfield,dungeon}/
  effects/{leaves,snow,fog,dust}/
```

지역은 Terrain + Props + Vegetation + Lighting + Effects 구성이다. Forest, Plains, Desert, Snowfield, Swamp, Cave, Dungeon, Ruins, Village, Castle, Volcanic, MagicForest는 별도 엔진을 만들지 않고 Stage 데이터를 추가한다. 현재 Viewer 선택지는 초원/숲 하나이며 새 Stage 등록 시 선택 목록과 로딩 경로 매핑을 추가해야 한다.

후속 Terrain 후보는 Ground, Grass, Dirt, Sand, Stone, Snow, Water, Cliff, Road, Bridge다. Flat/Edge/Corner/Slope 모듈은 연속 지형이 필요해질 때 도입한다. 물 투명도, 경사 이동, 절벽 충돌은 이번 범위에 없다. 통나무, 버섯, 표지판, 가로등, 우물, 상자, 배럴, 천막, 문, 기둥, 집, 상점, 여관, 성벽, 탑, 폐허, 횃불, 깃발, 밧줄, 천, 수정, 마법석, 조각상은 같은 등록/배치 구조의 후속 Asset이다.

## 웹 성능과 후속 순서

픽셀 비율은 1.5까지 제한하고 실시간 그림자는 기본으로 끈다. 켜면 Directional Light의 1024px 그림자 하나를 사용한다. 반복 Mesh/Material은 공유하고 나뭇잎은 불투명 Points 24개다. 숨겨진 탭은 갱신과 렌더링을 건너뛴다. Stage 재로드 시 인스턴스를 해제한다.

초기 예산은 기본 화면 100 DrawCall 이하, 환경 10만 삼각형 이하를 목표로 하되, 실제 대상 모바일에서 측정 후 조정한다. 최종 소품은 대략 300~2,000 삼각형, 나무 1,000~3,000 삼각형부터 시작한다. 텍스처는 가능하면 단색/공유 팔레트, 필요 시 512~1024px Atlas를 검토한다. 현재 절차적 Asset은 텍스처가 없다. LOD·Atlas·압축 텍스처는 측정으로 필요성이 확인되면 추가한다.

구현 순서는 렌더링 기반 재사용 → Asset 원형 → Stage JSON/로더 → Viewer/UI/통계 → 캐릭터 로더 → 브라우저 검증이다. 이후 SD GLB 확보 → 양쪽 Viewer의 재질·크기·프리셋 비교 → 최종 환경 GLB 교체 → 대상 기기 성능 측정 순으로 진행한다. 실제 전투 연결은 별도 작업으로 남긴다.

## 검증 결과 (2026-09-25)

- 로컬 서버에서 Stage 로드와 실제 WebGL 렌더링을 확인했다. 기본 화면은 임시 캐릭터 2개, SpawnPoint 표시, 그림자 끔 기준 51 DrawCall / 25,000 삼각형이며 테스트 기기에서 약 60 FPS였다. 모든 기기의 성능을 보장하는 수치는 아니다.
- 합성 GLB를 동시 요청해 네트워크 로드 1회, 독립 Object3D 복제, Geometry 공유를 확인했다. 캐릭터 높이는 1.8, 발밑은 Y=0으로 정규화되었다. 캐시 해제 후 항목은 0개였다.
- Stage 생성·렌더링·해제를 5회 반복했을 때 Geometry 수는 매회 7개로 일정했고, Asset 해제 후 0개로 돌아왔다. 테스트에서는 Grid를 포함하고 캐릭터는 제외했다.
- 빈 SpawnPoint, 역전된 Fog 거리, 잘못된 좌표, 중복 SpawnPoint ID, 잘못된 GLB 경로 자료형을 모두 거부했다.
- 표시 옵션, 조명 변경, 임시 캐릭터 배치/제거, 재로드, GLB 경로 오류 처리를 확인했다. JavaScript 문법, Python 서버 문법, README 공백 검사를 통과했다.
- 실제 SD 캐릭터 GLB의 외형·리깅·애니메이션 호환성은 모델이 없어 미검증이다. 새 Stage나 최종 Asset을 추가할 때 모바일 화면 가독성과 성능을 다시 확인한다.
