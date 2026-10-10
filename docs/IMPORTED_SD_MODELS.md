# 외부 SD 모델 외형 편집과 무기 연결

## 대머리 블랭크 남녀 모델 (현재 머리·얼굴 파츠 지원)

사용자가 추가한 [남성 블랭크](../assets/characters/base/대머리%20블랭크%20얼굴%20남자.glb)와 [여성 블랭크](../assets/characters/base/대머리%20블랭크%20얼굴%20여자.glb)는 원본 파일을 그대로 사용한다. 두 모델 모두 하나의 skinned mesh, Mixamo 계열 28본, 내장 텍스처 3개를 가지며 남성은 AnimationClip 4개, 여성은 6개를 포함한다.

CharacterViewer의 **남성 블랭크 · 머리/눈**, **여성 블랭크 · 머리/눈** 버튼으로 불러온다. [BlankAppearance.js](../js/portrait/BlankAppearance.js)가 독립 눈 10종과 눈썹·코·입 각 5종을 만들고, [IndependentHair.js](../js/portrait/IndependentHair.js)가 가발을 `mixamorigHead`에 장착한다. 얼굴 파츠는 `Face_Anchor` 아래의 개별 Anchor/그룹으로 분리되고 머리는 별도 `Hair_Anchor`를 사용한다. 머리색은 눈썹의 `Eyebrow_Hair` 재질에도 적용된다.

블랭크 모델의 귀와 피부색은 아직 변경하지 않으며 해당 선택 UI도 숨긴다. 런타임 메시를 원본에 굽는 GLB 내보내기는 아직 지원하지 않는다.

파츠 생성은 모델 로드 직후의 고정된 루트→Head 좌표 변환을 사용한다. 이전에는 선택 순간의 애니메이션 Head 월드 행렬을 역변환해 Running 같은 재생 중 파츠를 고르면 눈이 머리 안으로 들어가거나 머리 위치가 선택 시점마다 달라졌다. 현재 눈은 Head 바로 아래 `Independent_Eyes`, 머리는 `Independent_Hair`로 분리하며 각 교체 인스턴스가 새 geometry와 material을 소유한다.

머리 정합성은 공통 `Hair_Anchor` 아래 비대칭 `Hair_Cap`과 기존 스타일 파츠를 조합하는 방식으로 보정한다. 기존 구형 Cap은 정수리에서 약 83도까지만 면이 있어 측면과 후두부 geometry가 부족했다. 새 Cap은 앞쪽 종료각 1.34 rad, 측면 2.35 rad, 후면 2.90 rad이며 블랭크 기준 중심 `[0, 1.37, 0.06]`, 기본 반경 `[0.27, 0.26, 0.27]`을 사용한다. 실제 모델의 `headScale`과 스타일 transform을 추가 적용한다. 단정한 숏컷 `m1` 보정은 position `[0, 0.004, -0.006]`, rotation `[0, 0, 0]`, scale `[1.02, 1.01, 1.03]`이다.

남성 블랭크 측정에서 머리 정점 범위는 대략 X `-0.328~0.319`, Y `1.050~1.665`, Z `-0.276~0.396`이었고, 단정한 숏컷 Cap 범위는 X `-0.384~0.391`, Y `0.944~1.725`, Z `-0.343~0.469`였다. Cap이 두상 바깥에 작은 간격을 두고 위치하며 앞면은 geometry 종료각으로 얼굴을 가리지 않는다. 정면·좌우 90도·후면·좌우 후방 45도 실제 WebGL 캡처에서 두피 노출과 z-fighting이 없고 기존 앞머리 위치가 유지되는 것을 확인했다.

2026-10-07 브라우저 재검증: Running 재생 중 눈 10종이 모두 Head hierarchy에 연결되고 유효한 geometry로 서로 다른 WebGL 캡처를 생성했다. 머리 01↔02를 20회 왕복한 뒤 머리 01의 mesh 수, vertex/index 수, bounding box, material 수, position/scale/quaternion이 최초와 일치했다. 매 교체의 geometry/material UUID가 이전 인스턴스와 겹치지 않고 머리 A·눈 A 조합의 최종 캡처가 최초 캡처와 일치함을 확인했다.

2026-10-08 브라우저 검증: 단정한 숏컷을 6개 방향에서 확인하고 Running 중 머리 반복 교체·눈 조합·머리색을 재검증했다. 남녀 머리 20종 모두 `Hair_Anchor`와 유효한 `Hair_Cap`을 생성한다. 나머지 19종은 공통 두상 덮개를 사용하지만 스타일별 실루엣 미세 조정은 별도 아트 검수 대상으로 남긴다.

얼굴 이마가 좁았던 원인은 눈 중심보다 앞머리 하단과 Hairline이 낮았기 때문이다. 남성은 `foreheadLift 0.075`, 여성은 `0.105`를 사용하며 가닥 윗점은 25%, 아랫점은 100%를 올려 정수리 볼륨과 눈 위치를 유지한다. 여성 머리는 공통 transform `position [0, 0.005, -0.004]`, `scale [1.05, 1.03, 1.06]`을 적용하고 대표 웨이브 단발 `f7`은 `position [0, 0.008, -0.008]`, `scale [1.07, 1.04, 1.08]`을 사용한다.

2026-10-09 깊이 측정에서 기존 눈은 여러 타원체 레이어의 Z 두께와 누적 offset 때문에 측면 돌출이 커졌고, 입은 anchor와 tube 자체가 Head 표면보다 앞에 있었다. 정면 크기는 유지하면서 눈 각 레이어의 Z 두께와 간격만 줄였고, 입의 anchor와 geometry 두께를 표면 가까이 조정했다. 남성 눈·코·입 Y 값과 코의 Z 위치는 유지했으며 여성 입만 `mouthY 1.160`으로 분리 보정했다.

2026-10-10 눈매는 화난형·보통형·웃음형·졸림형·무표정형·놀람형·슬픔형·장음형·장난형·이종형으로 다시 정의했다. 눈 폭/높이, 기울기, eyelid, 닫힌 곡선, 좌우 비대칭, 세로 동공을 실제 geometry로 구분한다. 눈 색상은 별도 `eyeColor` 8종으로 저장하며 눈매 교체와 독립적으로 유지된다.

HairCap은 정수리·측두부·후두부의 피부 틈만 막는 내부 scalp cover로 축소했다. 스타일별 `crown` profile은 위치·규모·가닥 수·spread·sweep를 정의하고, Crown 가닥이 앞뒤 끝점의 실제 Z를 사용하도록 수정했다. 따라서 공통 구형 cap이 외형을 결정하지 않고 Short/Bob/Ponytail 등의 스타일 파츠가 정수리 실루엣을 만든다.

여성 정수리의 원형 피부 노출은 HairCap에 의도적인 구멍이 있어서가 아니라 중복된 crown pole과 첫 ring 사이가 성겨 Head 곡면이 chord를 관통했기 때문이다. Cap을 단일 crown pole로 만들고 `pow(t, 1.35)` ring 분포로 정수리 주변 vertex를 집중시켰으며, 여성 profile에 `crownBulge 0.055`를 적용했다. 별도 덮개 파츠 없이 HairCap 자체를 연속 곡면으로 수정했다. 여성 f1~f10은 정면·45도·측면·후면·상단 WebGL 캡처에서 정수리와 후두부 두피 노출이 없음을 확인했다.

`f7`은 Hair Cap 위에 `FrontHair` 5개, 좌우 `Wave` 각 3개, `BackHair` 3개의 큰 덩어리를 조합한다. 런타임 측정은 총 16 meshes, 6,444 triangles이다. 단일 뷰어에서는 합리적인 시제품 비용이지만 대규모 전투에 그대로 쓰면 캐릭터당 draw call이 늘므로, 실전 도입 시 스타일별 정적 geometry 병합 또는 GLB 베이크가 필요하다. 여성 f1~f10의 정면·45도·측면·후면·상단 검수를 완료했으며, 남성은 m1 외 9종의 개별 실루엣 검수가 남아 있다.

## 대머리 베이스 v1 (권장)

사용자가 추가한 `빡빡이 캐릭터.glb`는 완전한 두피를 가진 177,438 triangle 정적 모델이다. 원본은 보존하고 [변환 도구](../tools/prepare_bald_sd.py)로 [외형·리깅 파생 모델](../assets/characters/base/human_sd_bald_v1.glb)을 생성한다. CharacterViewer의 **대머리 SD · 외형 기준** 버튼과 캐릭터 편집창의 조합 팝업은 이 모델을 기본으로 사용한다.

파생 모델에는 공통 이름의 20개 본, 전체 정점의 skin joint/weight, `Weapon_R`, `Weapon_L`, `Head_Attachment`, `Back_Attachment`가 들어간다. 현재 웨이트는 부위별 단일 본 기반의 자동 초안이다. 애니메이션을 추가하기 전 어깨·팔꿈치·골반·무릎의 실제 변형을 Blender 등에서 확인하고 혼합 웨이트를 다듬어야 한다. 클립은 아직 없으므로 사용자는 이 Skeleton을 유지한 채 애니메이션을 추가할 수 있다.

[BaldAppearance.js](../js/portrait/BaldAppearance.js)는 완성형 두피에 독립 머리 메시를 씌운다. 원본 텍스처의 눈 위를 피부색 패치로 가리고 흰자·홍채·동공·하이라이트·눈썹 메시를 앞에 배치하므로 눈 10종이 실제 geometry로 교체된다. 원본 속눈썹 일부는 아이라인처럼 남긴다. 코·귀·입은 원본 정점 변형이고 피부색은 원본 재질 tint다.

2026-09-29 브라우저 검증: 같은 대머리 모델을 유지한 채 여성 머리 10종과 남성 머리 10종이 각각 서로 다른 PNG를 생성했다. 눈 10종도 서로 다른 PNG를 생성했으며 가느다란 눈에서 독립 흰자·홍채·동공이 원본 눈 위치에 표시되는 것을 확인했다. 파생 GLB에서 20개 Skeleton joint, 98,916개 정점의 joint/weight, 4개 attachment를 확인했다.

## 사용

`python server.py` 실행 후 CharacterViewer의 **남성 SD · 외형/무기** 또는 **여성 SD · 외형/무기** 버튼을 누른다.

- [남성 뷰어](../character-viewer.html?model=assets/characters/base/human_sd_male_v2.glb)
- [여성 뷰어](../character-viewer.html?model=assets/characters/base/human_sd_female_v2.glb)

05번 패널에서 머리, 피부색, 눈, 코, 귀, 입을 각각 10종 중 선택한다. 머리는 남녀별 10종이며 분류 전환 시 베이스 모델도 바뀐다. 무작위 생성, 부품 잠금, 조합 저장, PNG 다운로드를 사용할 수 있다. 캐릭터 편집창에서 조합 창을 열면 새 여성 베이스가 기본이며, 남성으로 바꿀 수 있다. 기존 v1 조합은 기존 모델로 복원한다.

04번 패널에서 한손검·지팡이·활·방패 등 기존 무기 시제품을 장착한다. 02번 패널의 실제 애니메이션을 선택해 손에 따라 움직이는지 확인할 수 있다. 기존 방어구 시제품은 v1 체형 전용이며 이 모델에 맞는 의상 교체는 아직 지원하지 않는다.

## 원본 분석

원본 [남성](../assets/characters/base/남성SD캐릭터.glb), [여성](../assets/characters/base/여성SD캐릭터.glb)은 각각 하나의 skinned mesh, 하나의 재질, 세 개의 내장 텍스처를 사용한다. 모두 Mixamo 계열의 28개 관절과 스킨 웨이트를 가지고 있다. 남성은 21,056 triangles와 8개 클립, 여성은 20,006 triangles와 5개 클립이다. 기존 손 리그는 존재하지만 프로젝트가 사용하는 무기 소켓은 없다.

원본은 수정하지 않고 [변환 도구](../tools/prepare_imported_sd.py)로 파생 GLB를 만든다. 원본 메시, UV, 스킨, 애니메이션, 텍스처 바이너리는 그대로 보존한다. 파생 파일은 약 26.3MB / 23.8MB로, 대규모 배포 전 텍스처 크기 최적화가 필요하다.

## 외형 변형의 범위

[ImportedAppearance.js](../js/portrait/ImportedAppearance.js)는 눈·코·귀·입의 원본 정점을 부위별로 변형한다. 머리는 [IndependentHair.js](../js/portrait/IndependentHair.js)가 원본 머리 픽셀을 숨기고 Head 본에 별도 메시를 장착한다. 여성은 단발·긴 생머리·포니테일·트윈테일·올림머리·양갈래 땋은 머리 등 10종, 남성은 숏컷·가르마·스파이크·슬릭백·언더컷 등 10종이다. 각 스타일은 자체 두피 캡과 가닥 메시를 가지며 원본 머리 정점을 늘여 만든 변형이 아니다. 눈·코·귀·입은 새 텍스처나 표정 리그가 아닌 원본 얼굴 윤곽 변형이다.

피부색과 원본 머리 제거 영역은 원본 텍스처 색상으로 구분한다. 원본 텍스처에 종속된 마스크이므로 다른 모델에 자동 적용하지 않는다. 머리카락 물리와 가닥별 보조 본은 없으며 전체 스타일이 Head 본을 따라간다. 색상 경계와 머리·귀의 간섭은 아트 검수가 필요하다. 모델 해제 시 복제 geometry/material과 선택한 머리 메시를 해제하고 원본을 복원한다.

선택 정보는 `appearance.version: 2`, `base: male/female`, `hair/hairColor/eyes/eyebrows/nose/ears/mouth/skin` ID로 저장한다. v1 ID의 뜻을 바꾸지 않도록 별도 [카탈로그](../js/portrait/imported-catalog.js)를 사용한다. 기존 저장값에 `hairColor`나 `eyebrows`가 없으면 각각 자연 흑갈색과 기본 눈썹을 사용한다. 파생 GLB에는 원본 형상과 편집용 마스크가 들어가며, 선택한 조합은 앱에서 적용한다. 조합을 반영한 GLB 내보내기는 아직 없다.

## 무기 리깅

- `Weapon_R`: 오른손 본의 자식, 손목에서 손끝으로 36% 지점.
- `Weapon_L`: 왼손 본의 자식, 같은 기준.
- `Head_Attachment`: 머리 본의 자식.
- `Back_Attachment`: 가슴 본의 자식.

소켓은 GLB에 저장된 attachment transform node이며 새 스킨 관절은 아니다. 기존 본을 통해 움직이고 정점 웨이트를 변경하지 않는다. 기존 무기 시제품을 체형에 맞게 0.6배로 연결한다. 손가락 쥐기, 무기별 손목 자세 보정, 양손 IK, 무기와 얼굴/몸의 충돌 방지는 지원하지 않는다. 기본 달리기처럼 원래 무기 전용이 아닌 클립에서는 간섭이 있을 수 있다.

## 재생성 및 검증

```powershell
python -B tools/prepare_imported_sd.py
python -B tests/test_imported_sd.py
node --test tests/portrait-catalog.test.cjs tests/imported-portrait.test.cjs
```

변환 도구는 Pillow를 사용한다. 브라우저 실행에는 추가 dependency가 없다. 테스트는 원본 바이너리 보존, 기존 스킨·클립·재질 보존, 소켓 부모, 편집 마스크 길이, 카탈로그 개수, 잘못된 조합 거부, 잠금 및 이전 조합 호환성을 확인한다.

2026-09-29 브라우저 검증: 독립 메시로 교체한 남녀 머리 각각 10종이 모두 서로 다른 PNG를 생성했다. 남성 달리기에서 한손검이 오른손에 연결되어 움직이는 것을 확인했다. 남성 8개·여성 5개 클립 각각의 시작·중간·끝 부근에서 4개 소켓 변환이 유효했다. 저장 조합의 남성 베이스·머리·귀 복원과 무작위 생성 후 원래 캐릭터 편집창으로 v2 조합/PNG 전달도 확인했다. 피부 변경 중 발견한 정점 마스크 경계 얼룩은 픽셀 마스크로 수정했다.
