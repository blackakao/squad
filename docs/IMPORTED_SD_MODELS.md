# 외부 SD 모델 외형 편집과 무기 연결

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

선택 정보는 `appearance.version: 2`, `base: male/female`, `hair/eyes/nose/ears/mouth/skin` ID로 저장한다. v1 ID의 뜻을 바꾸지 않도록 별도 [카탈로그](../js/portrait/imported-catalog.js)를 사용한다. 파생 GLB에는 원본 형상과 편집용 마스크가 들어가며, 선택한 조합은 앱에서 적용한다. 조합을 반영한 GLB 내보내기는 아직 없다.

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
