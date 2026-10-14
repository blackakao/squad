# CharacterViewer 외부 머리 GLB 규격

- 파일은 `imported/` 아래에 보관합니다. CharacterViewer의 **GLB 파츠** 모드가 이 폴더의 `.glb`를 자동 조회하므로 **GLB 폴더 목록 새로고침** 후 Hair에서 파일을 선택합니다. 파일별 코드 등록이나 페이지 URL 변경은 필요하지 않습니다.
- 폴더 목록 API는 이 디렉터리 바로 아래의 `.glb`만 공개합니다. 하위 폴더, 다른 확장자, 임의의 서버 경로는 목록에 포함하지 않습니다.
- 권장 Mesh 역할명은 `CrownHair`, `FrontHair`, `SideHair`, `BackHair`, `StyleParts`입니다. 접미사는 자유롭게 붙일 수 있습니다.
- 블랭크 캐릭터와 같은 원점, 단위, 정면 방향으로 제작합니다. 캐릭터 루트 공간에서 머리가 약 `Y=1.1~1.75`에 오도록 내보냅니다.
- 머리는 `mixamorigHead`에 rigid attachment됩니다. 머리 자체 Skeleton이나 Animation은 필요하지 않습니다.
- 재질은 GLB 안에 포함할 수 있습니다. 현재 샘플은 `Hair_Dark`, `Hair_Light` 두 재질을 사용하며 텍스처는 없습니다.
- Blender에서 모든 최상위 Mesh에 같은 축 변환이 중복 저장된 경우 뷰어가 그 공통 transform을 자동 상쇄합니다. 가능하면 내보내기 전에 `Ctrl+A > Rotation & Scale`을 적용해 원본부터 정리합니다.
- Draco, Meshopt, KTX2 압축은 현재 외부 파츠 로더에서 지원하지 않습니다.
