# SD 공통 베이스 v1

[공통 베이스 GLB](../assets/characters/base/human_sd_base_v1.glb)는 레퍼런스의 큰 머리, 짧은 팔다리, 갈색 머리와 땋은 머리를 참고해 코드로 제작한 인간형 프로토타입이다. 기존 [초기 샘플](../assets/characters/models/human_sd_sample.glb)은 보존했다. 이 모델은 레퍼런스 이미지를 3D로 자동 변환한 결과가 아니며, 완성된 게임 아트도 아니다.

## 보기 / 다시 생성

`python server.py` 실행 후 다음 주소를 연다.

<http://127.0.0.1:8000/character-viewer.html?model=assets/characters/base/human_sd_base_v1.glb>

뷰어에서 클립을 선택하면 재생된다. `Knockdown`은 반복을 끄면 넘어지는 동작 후 누운 자세를 유지한다. `Death`는 첫 프레임부터 같은 누운 자세이며 넘어지는 과정이 없다. 기본 샘플은 무기를 들지 않은 상태이며, `장착 장비 미리보기`에서 장비를 선택한다.

```powershell
python tools/generate_sd_base.py
python tools/generate_sd_equipment.py
python tests/test_sd_base.py
```

[생성 코드](../tools/generate_sd_base.py)는 Python 표준 라이브러리만 사용하며 지정된 베이스 GLB 한 파일만 다시 생성한다. 모델을 외부 편집기에서 수정하려면 다른 이름으로 저장해야 재생성 시 보존된다. Blender·npm·외부 모델 서비스는 필요 없다.

## 포함 내용

- 약 2.8등신, 전체 높이 약 2.86 모델 단위. Y-up, +Z 정면, 캐릭터 기준 왼쪽은 +X. 월드 게임 크기에 맞추는 배율은 표현 계층에서 적용한다.
- 실제 glTF skin과 inverse bind matrices. 20개 몸체 본과 4개 attachment가 동일한 skin에 포함되어 뷰어에는 24개 본으로 표시된다.
- `SD_Humanoid_v1` 리그. Shoulder_L/R는 Chest의 자식이다. 초기 설계의 Hips 직속 어깨 대신 상체 회전을 따라가도록 이 계층을 선택했다. 버전이 다른 계층의 클립을 이름만 맞춰 재사용하면 안 된다.
- 팔꿈치·무릎 주변 두 본 혼합 웨이트. 얼굴·머리·의상 부품은 각각 해당 관절을 따라가는 단순 가중치로 시작한다.
- `Weapon_R`, `Weapon_L`, `Head_Attachment`, `Back_Attachment`. 무기 위치는 손 앞쪽의 기준점이며 실제 무기별 그립 보정은 아직 필요하다.
- 몸체·머리·얼굴·의상 등을 구분한 33개 mesh와 11개 재질. 외부 텍스처 없는 자체 포함형 GLB.
- 16,260 triangles, 약 0.87 MiB. 레퍼런스의 5,000~8,000 폴리곤 표기와 다른 삼각형 기준이며, 다수 캐릭터용 최종 최적화는 아직 아니다.

| 클립 | 길이 | 현재 동작 |
| --- | ---: | --- |
| Idle | 2.40초 | 호흡과 작은 머리 움직임 |
| Walk | 1.10초 | +Z 정면 기준 제자리 걷기, 좌우 팔·다리 교차 |
| Run | 0.72초 | +Z 정면 기준 달리기, 더 큰 보폭과 무릎 굽힘 |
| Attack_01 | 0.95초 | 오른팔 공격 준비·타격·복귀 |
| Cast | 1.80초 | 두 손을 앞으로 올리는 시전 |
| Hit | 0.50초 | 상체 피격 반응과 복귀 |
| Knockdown | 1.50초 | 기존 Death의 뒤로 넘어지는 동작 |
| Death | 1.00초 | Knockdown 마지막 누운 자세를 처음부터 끝까지 유지 |
| Victory | 2.20초 | 팔을 들고 작은 환호 |

기본 동작은 30fps로 샘플링한다. 무릎 굽힘 방향을 수정했고, 접지 동작에는 신발 바닥의 높이를 계산한 Root 높이 보정과 보간 여유 1cm를 적용했다. 이는 발 고정 IK가 아니므로 발 미끄러짐·정확한 지면 접촉을 해결한 것으로 간주하면 안 된다.

Walk/Run은 얼굴 방향을 돌리지 않고 주기의 시간 진행 방향을 반전했다. 굽힌 무릎이 발을 +Z 앞으로 회수하는 구간에 오고, 다리를 편 상태에서는 발이 뒤로 이동하는 지지 구간이 되도록 수정했다. `Knockback`은 이 베이스의 클립 목록에서 제거했다. 뷰어는 임의 모델의 실제 클립을 나열하므로 다른 파일의 같은 이름에는 영향을 주지 않는다.

## 장착 장비 미리보기

[장비 모듈](../js/character-viewer/equipment.js)은 게임 장비 데이터와 분리된 개발용 `EquipmentPreview`를 제공한다. `head`, `body`, `hands`, `feet`, `mainHand`, `offHand` 슬롯을 독립적으로 바꾸며 외형 조합 프리셋의 `equipment`에 선택 ID를 저장한다. 예전 프리셋처럼 이 필드가 없으면 모든 슬롯을 비운다.

- 테스트 장비: 투구, 장갑, 부츠, 검, 창, 방패와 플레이트·사슬갑옷·가죽갑옷·판타지 천옷·턱시도·셔츠+청바지 복장 세트. 모두 런타임 저폴리 강체 Mesh이며 매 장착 때 독립 geometry/material을 생성한다.
- 공통 베이스는 기존 `Weapon_R/L`을 사용한다. 블랭크 Mixamo 모델은 Head·Spine2·Hips·양손·양발과 좌우 Arm/ForeArm/UpLeg/Leg 아래에 장비 Anchor를 생성한다.
- 검·창은 오른손 `MainHandEquipmentAnchor`, 방패는 왼손 `OffHandEquipmentAnchor`를 사용한다. 투구·갑옷·장갑·부츠는 각 Head·Spine2·양손·양발 Anchor를 사용한다.
- 장비 카탈로그의 `transform`이 위치·회전·배율을 소유한다. 향후 항목에 `url`을 주면 동일 생명주기로 rigid GLB를 불러올 수 있다.
- 슬롯 교체 시 해당 인스턴스만 detach/dispose하며 카탈로그 정의와 다른 장비·외형 파츠는 유지한다. 모델 교체 시 모든 장비와 Anchor를 본체보다 먼저 정리한다.

복장은 몸통·골반·좌우 상완/전완·상퇴/하퇴로 분할되어 각 캐릭터 본을 따라가는 rigid segmented mesh다. 플레이트의 하의도 Hips와 좌우 UpLeg를 따르며, 긴 소매와 바지는 Upper/Lower 구간을 각각 추적한다. 관절 커버가 틈을 줄이지만 팔꿈치·무릎 vertex가 두 본 사이에서 연속 변형되는 정식 skinning은 아니다. 동일 Skeleton을 공유하는 SkinnedMesh 장비, 양손 그립 IK, 무기별 공격/시전 클립, 게임 캐릭터 장비 자동 적용은 아직 구현하지 않았다.

실제 복장 GLB는 캐릭터와 동일한 origin·scale·T-pose·bone naming 및 inverse bind matrices를 사용한다. 상완/전완과 상퇴/하퇴의 관절 vertex에는 두 인접 본의 혼합 weight를 적용하고, 남녀 체형은 같은 슬롯·리그 정의 아래 fit profile 또는 geometry variant로 제공한다. 몸 clipping을 완전히 제거하려면 몸체도 의상이 덮는 부위를 material group 또는 분리 mesh로 숨길 수 있어야 한다.

## 현재 한계와 보정 순서

2026-09-27: 뷰어에 런타임 머리·얼굴 부품 교체와 초상화 촬영을 추가했다. [외형 조합 안내](PORTRAIT_COMPOSER.md)를 참고한다. 원본 GLB는 유지하며 부품은 Head 본에 붙이는 코드 기반 형상이다.

이 베이스는 리그·클립·attachment 실험을 위한 둥근 도형 조합이다. 레퍼런스처럼 섬세한 얼굴, 머리카락 가닥, 손가락, 표정 morph, 연결된 인체 토폴로지는 없다. 옷과 몸체가 일부 겹치며 큰 관절 회전 시 틈·간섭이 생길 수 있다. 공격은 무기별 실전 모션이 아니고 Knockdown도 물리 시뮬레이션이 아니다.

1. 얼굴과 머리 실루엣을 조형하고 어깨·골반·옷의 연결 토폴로지를 정리한다.
2. 발 고정 IK와 이동 속도에 맞춘 보폭, 공격 궤적과 타격 타이밍을 보정한다.
3. 머리·손·의상·무기 간섭을 점검하고 관절 웨이트를 다듬는다.
4. 동일 리그의 두 번째 외형으로 공통 클립 재사용을 검증한다.
5. 재질/mesh 병합·텍스처 atlas·LOD로 draw call과 삼각형 수를 줄인다.

## 검증

Python 검사는 GLB 청크·accessor 길이, 스킨 웨이트, 인덱스, 면 방향, 유한 좌표, 정규화 quaternion, 9개 클립과 4개 attachment를 확인한다. CharacterViewer에서 로딩과 실제 렌더링, 9개 클립 각각 61개 시점의 스킨 변형 경계를 검사했다. 외형과 Idle/Walk/Run/Attack_01/Cast/Death 포즈도 렌더링해 확인했다. 기존 게임과 데이터는 수정하지 않는다.

추가 회귀 검사는 Walk/Run의 전방 회수·후방 지지 순서, Death 전 프레임의 정지 상태와 Knockdown 마지막 프레임 일치를 확인한다. 브라우저에서 장비 13종의 로딩·장착 위치, 판금 해제 시 원본 상의 복원, 마지막 선택 우선, geometry 해제, 활 선택 시 보조 슬롯 제한을 확인했다.

장비 착용 중 초기 샘플로 모델을 교체하면 상의 체형 호환 안내가 표시되고, 공통 베이스로 돌아오면 기존 검·방패·판금 선택이 다시 적용되는 것도 확인했다. Python 회귀 테스트 5개와 뷰어 JavaScript 문법 검사를 통과했다.
