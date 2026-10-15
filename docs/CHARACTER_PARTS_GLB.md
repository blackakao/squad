# CharacterViewer 외부 GLB 파츠 제작·등록 규격

## 목적

CharacterViewer는 동일한 남성/여성 Base Character 위에서 기존 JavaScript 절차형 파츠와 Blender 등에서 제작한 외부 GLB 파츠를 비교한다. GLB 모드는 개발용 미리보기이며 게임 캐릭터 데이터나 전투 표현을 변경하지 않는다.

## 폴더

| Category | GLB 폴더 | Attachment |
|---|---|---|
| Hair | `assets/characters/hair/imported/` | Head Bone 아래, 캐릭터 루트 좌표 보존 |
| Eyes | `assets/characters/parts/eyes/` | Head Bone 아래, 캐릭터 루트 좌표 보존 |
| Mouth | `assets/characters/parts/mouth/` | Head Bone 아래, 캐릭터 루트 좌표 보존 |
| Nose | `assets/characters/parts/nose/` | Head Bone 아래, 캐릭터 루트 좌표 보존 |
| Clothes | `assets/characters/parts/clothes/` | Character Root |

각 폴더 바로 아래의 `.glb`만 검색한다. README, PNG, JSON, blend 등은 무시한다. 파일을 복사한 뒤 CharacterViewer의 **GLB 폴더 목록 새로고침**을 누르면 파일명에서 확장자를 제거한 이름으로 표시된다. 파일명 등록을 위한 코드 수정은 필요 없다. 같은 파일명으로 덮어쓴 경우 변경 시간이 캐시 키가 되며 새로고침 시 현재 장착 인스턴스도 다시 로드된다.

## Blender 제작 기준

- 남성 또는 여성 블랭크 Base GLB를 Blender에 참조로 불러오고 원점, 단위, 축, T-pose를 유지한다.
- 파츠 geometry는 Base Character의 루트 좌표에 맞춰 제작한다. 런타임에서 카테고리별 임의 Y offset을 더하지 않는다.
- Export 전 `Ctrl+A > Rotation & Scale` 적용을 권장한다.
- GLB에는 필요한 파츠만 포함한다. Base Body를 함께 Export하면 CharacterViewer에서 Body가 중복 표시될 수 있다.
- Hair/Eyes/Mouth/Nose는 rigid 파츠로 제작하며 Base의 Head 움직임을 따라간다.
- Mesh 이름은 역할을 드러내도록 한다. Hair 권장 이름은 `CrownHair`, `FrontHair`, `SideHair`, `BackHair`, `StyleParts`다.
- GLB 내부 텍스처를 포함하는 self-contained GLB를 권장한다. Draco, Meshopt, KTX2 압축은 현재 지원하지 않는다.

## Static과 Skinned 파츠

Static Mesh는 현재 V1에서 지원한다. Hair/Eyes/Mouth/Nose는 Head에, Clothes는 Character Root에 장착한다.

SkinnedMesh와 Armature는 로드시 감지해 UI에 개수를 표시한다. Clothes GLB는 모든 Skin Joint 이름이 Base Character에 존재하면 해당 Base Bone으로 자동 재바인딩한다. 본이 누락되거나 이름이 다르면 자체 Skeleton 상태를 유지하고 UI에 연결 실패 원인을 표시한다. 정식 의상은 Base와 동일한 origin, scale, T-pose, bone naming, bind matrix와 weight 규격으로 제작해야 한다.

## 수명주기

- 카테고리마다 활성 GLB는 하나다.
- 새 GLB는 먼저 완전히 로드하고 검증한 후 기존 인스턴스와 교체한다.
- 로딩 실패 시 기존 인스턴스와 다른 카테고리는 유지한다.
- **없음**은 해당 카테고리 인스턴스만 제거하고 GPU 리소스를 dispose한다.
- 각 GLB는 GLTFLoader가 새로 만든 독립 scene/geometry/material을 소유한다. catalog 원본 Object3D를 공유하거나 dispose하지 않는다.
- JS 모드에서는 GLB 인스턴스를 숨기고 JS 파츠를 복원한다. GLB 모드에서는 GLB 인스턴스를 표시하고 대응 JS 파츠를 숨긴다. 각 모드의 선택 상태는 유지한다.
- GLB 모드에서는 선택하지 않았거나 로딩에 실패한 카테고리를 JS 파츠로 자동 대체하지 않는다. 실패한 교체 요청은 해당 카테고리의 직전 정상 GLB 인스턴스를 유지한다.

## 무작위 조합과 초상화

- **무작위 조합 생성**은 서버가 반환한 카테고리 레지스트리와 각 폴더의 현재 파일 목록만 사용한다. 파일명을 코드 배열에 중복 등록하지 않는다.
- 현재 Base가 남성이면 `male`로 시작하는 파일과 성별 접두사가 없는 공용 파일만, 여성이면 `female`로 시작하는 파일과 공용 파일만 무작위 후보에 포함한다. 이 제한은 무작위 조합에만 적용하며 개발자가 다른 체형의 파츠를 비교할 수 있도록 수동 목록은 유지한다.
- 파일이 없는 카테고리는 `null`, 파일이 하나뿐인 카테고리는 그 파일을 선택한다. 둘 이상이면 가능한 경우 현재 선택과 다른 파일을 고른다.
- `randomAllowNone`이 `true`인 카테고리만 무작위 결과에 **없음**을 포함할 수 있다. 현재 Hair, Eyes, Mouth, Nose, Clothes는 모두 파일이 있으면 GLB를 선택한다.
- 파츠 색상은 GLB 재질의 일부이므로 V1 무작위 조합에서 별도로 변경하지 않는다.
- 빠르게 여러 번 실행하면 카테고리별 load token과 조합 generation으로 이전 응답을 폐기하고 마지막 요청만 상태에 반영한다.
- 공통 초상화는 현재 렌더링 장면을 512×512 PNG로 다시 캡처한다. GLB 로딩 중에는 다운로드를 막고, 모든 파츠 요청이 끝난 뒤 미리보기를 갱신한다.

## 개발 흐름

1. `python server.py`를 실행한다.
2. CharacterViewer에서 남성 또는 여성 Base를 선택한다.
3. **GLB 파츠** 모드를 선택한다.
4. 지정 폴더에 GLB를 복사한다.
5. **GLB 폴더 목록 새로고침**을 누른다.
6. 각 Category에서 파일을 선택한다.
7. OrbitControls와 AnimationClip으로 정면·측면·후면 및 동작 추적을 확인한다.

서버 API 코드를 변경한 최초 1회에는 `server.py` 재시작이 필요하다. 이후 GLB 추가·교체에는 서버 재시작이나 페이지 이동이 필요 없다.

## V1 제한

- GLB 파츠 조합을 게임 캐릭터 데이터에 저장
- 성별/직업 장착 제한과 metadata 파일
- Hair/Eyes/Mouth/Nose의 SkinnedMesh 재바인딩
- glTF 외부 BIN/texture 묶음의 폴더 업로드
- Draco, Meshopt, KTX2 압축

## Base Skeleton 조립 (2026-10-14)

- Clothes GLB의 `SkinnedMesh`는 GLB 내부 Armature를 그대로 재생하지 않고, 본 이름을 기준으로 현재 Base Character의 Bone에 다시 연결한다.
- 모든 Skin Joint가 Base Character에서 발견될 때만 재바인딩한다. 누락된 본이 있으면 해당 파일의 상태 줄에 실패한 본 이름을 표시한다.
- 재바인딩 뒤에는 Clothes GLB의 중복 Armature를 scene에서 분리하며, 의상은 Base Character의 현재 AnimationClip을 그대로 따라간다.
- `Mesh_0`이라는 베이스 본체가 포함된 preview GLB는 중복 본체를 렌더링하지 않는다. 실제 배포용 파츠 GLB에는 의상 Mesh만 넣는 것을 권장한다.
- GLB 모드는 JS 파츠와 혼합하지 않는다. 선택하지 않은 카테고리는 비어 있으며 JS 모드로 돌아가면 이전 JS 조합이 그대로 복원된다.
- 의상 제작 시 베이스와 동일한 원점, 단위, bind pose, 28개 본 이름과 Skin Joint 순서를 사용해야 한다. 남성용과 여성용 의상은 각 체형 베이스에 맞춰 별도로 export한다.
# 현재 제작 흐름 (2026-10-16)

외부 제작 → GLB Export → 지정 폴더 복사 → CharacterViewer 카탈로그 새로고침 → 신체/장비 조합 → 무작위 조합 → 초상화 → 저장 순서가 현재 표준이다. JavaScript 절차형 파츠는 Legacy 회귀 도구이며 GLB 무작위 후보나 기본 UI에 포함되지 않는다.
