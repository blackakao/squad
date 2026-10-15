# CharacterViewer GLB 장비 제작·등록 안내

현재 메인 CharacterViewer는 GLB 조립이 기본 제작 경로다. 장비는 오른쪽 **장비 조합**에 자동 표시되고 의류 GLB도 같은 제작 흐름에서 관리한다.

CharacterViewer의 **외부 GLB 장비 파츠**는 게임 아이템, 능력치, 인벤토리와 분리된 개발용 미리보기 계층이다. 기존 JavaScript 장비와 동시에 사용할 수 있으며 어느 쪽을 바꿔도 다른 쪽 상태를 초기화하지 않는다.

## 자동 등록 폴더

| 슬롯 | 폴더 | 현재 샘플 |
| --- | --- | ---: |
| 머리 | `assets/characters/equipment/head/` | 12 |
| 발 | `assets/characters/equipment/feet/` | 8 |
| 주무기 | `assets/characters/equipment/mainHand/` | 22 |
| 보조무기 | `assets/characters/equipment/offHand/` | 16 |

GLB를 해당 폴더 바로 아래에 복사하고 뷰어의 **GLB 장비 목록 새로고침**을 누르면 코드 등록 없이 나타난다. 하위 폴더는 검색하지 않는다. 각 슬롯의 **없음**은 그 슬롯 인스턴스만 제거한다.

## 현재 v6 샘플 규격

- 원점, 축, 배율, bind pose는 Base Character와 같아야 한다.
- 장비는 Base Character의 28개 Bone 이름과 일치하는 `SkinnedMesh`다.
- 파일 안의 자체 Armature는 로딩 후 제거되고 장비 Skin은 현재 Base Character Bone에 이름으로 다시 연결된다.
- 전체 캐릭터 좌표로 제작된 장비이므로 파일별 위치 보정이나 손 Pivot 추측을 적용하지 않는다.
- 애니메이션은 장비 파일에 넣지 않는다. Base Character의 AnimationClip이 공유 Bone을 움직인다.
- 현재 v6 파일은 텍스처 없이 재질과 geometry만 포함한다.

필수 Bone 이름이 하나라도 없으면 해당 파일 상태에 bind 실패가 표시된다. 이름이 같은 것만으로 체형 적합성이 보장되지는 않으므로 남성/여성 Base에서 직접 확인한다. 파일명 접두사는 표시와 수동 선택을 제한하지 않는다.

## Blender 내보내기

1. 공식 Base GLB를 Blender로 가져온다.
2. Armature 이름과 Bone 이름을 변경하지 않는다.
3. 장비 geometry를 Base의 현재 위치와 크기에 맞춘다.
4. 장비 Armature modifier가 Base Armature를 가리키도록 하고 필요한 Bone에 weight를 준다.
5. 변형 확인 후 별도 애니메이션 없이 GLB로 내보낸다.
6. 슬롯 폴더에 넣고 목록 새로고침 후 Running, Walking과 공격 클립에서 확인한다.

Rigid 장비를 추가할 경우에는 향후 별도 metadata로 attachment Bone과 local transform을 명시해야 한다. 현재 로더는 이름이나 모양으로 Pivot을 추측하지 않는다.

## 수명과 제한

카탈로그는 경로와 파일 정보만 보관한다. 선택할 때 새 GLB 인스턴스를 만들고 같은 슬롯을 교체하거나 해제할 때 그 인스턴스의 geometry, material, texture, skeleton만 정리한다. 비동기 요청에는 슬롯별 token을 사용해 늦게 끝난 이전 요청이 최신 선택을 덮지 못하게 한다.

현재 지원하지 않는 항목:

- 투구의 머리 파츠 부분 숨김 같은 파일별 appearance override metadata
- 통합 Body의 부위별 마스킹
- 장비 능력치, 강화, 인벤토리, 게임 전투 데이터 연동
- 장비 GLB 자체 AnimationClip
- 자동 성별/체형 호환 판정
