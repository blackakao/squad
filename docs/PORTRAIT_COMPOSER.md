# SD 외형·초상화 조합

**2026-10-08 갱신:** 대머리 블랭크 남녀 GLB에서는 독립 가발 머리 10종씩, 머리 색상 8종, 눈 10종, 눈썹·코·입 각 5종을 조합한다. 남녀 머리 분류를 바꾸면 대응하는 블랭크 GLB로 전환되며 모든 런타임 파츠는 원본 `mixamorigHead` 본을 따라간다. 귀와 피부색 교체는 아직 적용하지 않는다. 파츠별 적용 수명주기를 분리해 한 카테고리 선택이 다른 그룹을 재생성하지 않는다. 세부 모델 정보와 검증 결과는 [외부 SD 모델 문서](IMPORTED_SD_MODELS.md)를 참고한다.

**2026-10-09 갱신:** 눈과 입은 Head 표면 측정값을 기준으로 깊이를 줄였고, 여성 입 위치와 남녀 앞머리 하단은 profile override로 분리했다. 여성 HairCap은 단일 crown pole과 정수리 집중 ring 분포를 사용하며 f1~f10 다각도 WebGL 검수를 완료했다.

**2026-10-10 갱신:** 블랭크 눈은 색상 차이만 주는 변형이 아니라 닫힘·반쯤 감김·윙크·세로 동공을 포함한 10개 geometry profile을 사용한다. `eyeColor` 8종은 `eyes`와 별도 상태이며 눈매를 바꿔도 유지된다. 기존 v2 저장값에 `eyeColor`가 없으면 기본 청색을 적용한다. HairCap은 두피 틈을 막는 내부층이며, 보이는 정수리 실루엣은 catalog의 스타일별 Crown 가닥이 담당한다.

**2026-10-09 장비 갱신:** 저장 조합은 기존 `style` 외에 선택적 `equipment` 객체를 포함한다. 이전 조합처럼 `equipment`가 없으면 여섯 슬롯을 모두 `null`로 복원한다. 장비 변경은 외형 파츠를 재생성하지 않으며 외형 변경도 장비 Anchor를 제거하지 않는다.

파츠의 제작 좌표는 모델을 불러온 직후 캡처한 모델 루트→Head 기준 행렬로 변환한다. 얼굴은 `Face_Anchor` 아래 `Eye_Anchor`, `Eyebrow_Anchor`, `Nose_Anchor`, `Mouth_Anchor`를 두며 각 파츠가 자기 그룹만 소유·교체한다. 머리는 별도 `Hair_Anchor`에 붙는다.

머리는 `mixamorigHead → Hair_Anchor → Independent_Hair` 구조를 사용한다. `Independent_Hair`에는 공통 비대칭 `Hair_Cap`과 기존 스타일별 앞머리·옆머리·뒷머리 파츠가 들어간다. Cap은 앞쪽 헤어라인은 짧게 유지하고 측면과 후두부만 아래로 연장한다. 스타일별 `position`·`rotation`·`scale`은 [imported-catalog.js](../js/portrait/imported-catalog.js)의 `transform`에 저장한다.

**2026-09-29 추가:** 외부 남녀 SD 모델용 v2 조합을 지원한다. 머리(남녀 각각), 피부색, 눈, 코, 귀, 입 각각 10종을 선택할 수 있다. [외부 모델 사용법·변형 범위·무기 리깅](IMPORTED_SD_MODELS.md)을 참고한다. 아래는 기존 v1 도형 베이스의 기록이다.

공통 SD 베이스의 머리와 얼굴을 런타임 3D 부품으로 교체하고 512×512 PNG 초상화를 만든다. 별도 dependency는 없다. 기존 전투 렌더링과 전투 로직은 변경하지 않는다.

## 사용 방법

1. `python server.py`로 실행한다.
2. 메인 메뉴의 **3D 캐릭터 제작**을 누른다.
3. 남성형/여성형 머리를 선택하고 머리·머리 색상·눈·코·입·피부색을 조합한다. 모델이 지원하는 항목만 표시되며 얼굴 부품은 어느 머리 분류에도 사용할 수 있다.
4. **무작위 조합 생성**은 현재 머리 분류 안에서 조합한다. 유지할 부품의 **무작위 변경 잠금**을 체크할 수 있다.
5. **조합 저장**으로 현재 선택을 브라우저에 저장하거나 PNG를 다운로드한다.

독립 뷰어에서도 [공통 베이스](../character-viewer.html?model=assets/characters/base/human_sd_base_v1.glb)를 열어 **05 / 외형·초상화 조합**을 사용할 수 있다. 독립 실행에서는 PNG 다운로드를 이용한다.

## 부품과 저장

| 항목 | 개수 |
|---|---:|
| 남성형 머리 | 10 |
| 여성형 머리 | 10 |
| 머리 색상 | 8 |
| 눈 | 10 |
| 눈썹 | 5 |
| 코 | 5 |
| 입 | 5 (블랭크) / 10 (기존 베이스) |
| 피부색 | 5 |

머리 색상은 [hair-colors.js](../js/portrait/hair-colors.js)의 `dark`/`light` 팔레트로 관리한다. [catalog.js](../js/portrait/catalog.js)는 안정적인 부품 ID와 검증 규칙, [Appearance.js](../js/portrait/Appearance.js)는 공통 Head 본에 붙는 형상을 정의한다. 이는 코드로 생성하는 시제품이며, 개별 GLB나 그려진 이미지를 파츠마다 추가하는 방식은 아니다.

**조합 저장**은 현재 브라우저의 localStorage에 이름과 부품 ID를 최대 40개 저장한다. 다른 브라우저로 자동 동기화되지 않는다. 캐릭터 저장 시 PNG는 기존 이미지 API를 통해 `assets/images/portraits/`에 저장하고, 캐릭터에는 이미지 경로와 선택적 `appearance` 필드를 저장한다.

```json
{"version":1,"hair":"f8","hairColor":"hc1","eyes":"eye1","eyebrows":"brow1","nose":"nose1","mouth":"mouth1","skin":"skin2"}
```

기존 조합처럼 `hairColor` 또는 `eyebrows`가 없으면 각각 `hc1`, `brow1`을 기본값으로 보완한다. 저장한 조합을 불러오면 얼굴 파츠와 머리 색상을 함께 복원한다.

## 범위와 한계

- 외형 교체는 `Head_Face`와 `Head`를 가진 공통 SD 베이스 전용이다. 임의 GLB의 자동 얼굴 인식·리타기팅은 지원하지 않는다.
- 얼굴·머리는 Head 본을 따라 움직인다. 머리카락 물리, 표정 애니메이션, 조합된 GLB 내보내기는 지원하지 않는다.
- PNG는 애니메이션과 무관하게 기본 자세의 정면을 촬영하며 촬영 후 뷰어 자세와 표시 상태를 복원한다.
- 뷰어 모델 통계는 원본 GLB 기준이며 런타임 부품과 추가 장비를 포함하지 않는다.
- 다음 단계는 실제 아트 검수, 부품 GLB화 및 공유 리소스 캐시, 조합 썸네일 선택 UI다.

## 검증

`node --test tests/portrait-catalog.test.cjs tests/imported-portrait.test.cjs`로 개수, ID 검증, 무작위 분류와 이전 조합 호환성을 확인한다. `python -B tests/test_portrait_storage.py`는 임시 HTTP 서버에서 PNG와 조합 메타데이터 저장/재로딩을 검증한다. `python -m unittest tests.test_character_viewer_parts`는 Chrome/WebGL에서 눈 10종, 눈썹·코·입 각 5종의 실제 렌더, 독립 hierarchy, 저장·복원, 머리 20회 왕복과 여성 웨이브 geometry 비용을 검증한다.

2026-09-27 검증: 카탈로그 테스트 3개와 HTTP 저장 테스트 1개 통과. 수정한 JS 문법 검사와 Python 서버 AST 문법 검사, diff 공백 검사 통과. 브라우저에서 50개 부품 각각의 PNG가 생성되고 같은 항목 안에서 모두 다른 결과임을 확인했다. Death 재생 중 촬영한 PNG가 기본 자세 촬영과 일치하며 촬영 후 모든 모델 노드의 위치·회전·배율·표시 상태가 복원됨을 확인했다. 조합 저장/복원/삭제, 실제 팝업에서 편집창으로 PNG 전달, 대상 편집창 변경 시 거부를 확인했다. 캐릭터 저장 요청의 이미지 경로·조합 정보와 다시 편집 시 복원은 쓰기 API를 가로채 확인했고, 실제 디스크 저장은 위 임시 HTTP 서버에서 별도로 확인했다.
