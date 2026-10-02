# 테스트 캐릭터 모델

이 폴더에 테스트할 `.glb` 또는 `.gltf`와 참조 리소스를 추가합니다. 기본 모델은 포함되어 있지 않습니다.

예시 파일명: `human_sd_test.glb` (직접 추가해야 합니다).

1. 프로젝트 루트에서 `python server.py`를 실행합니다.
2. `http://127.0.0.1:8000/character-viewer.html`을 엽니다.
3. 서버 경로에 `assets/characters/models/human_sd_test.glb`를 입력해 불러옵니다.

다른 이름·하위 폴더도 가능하며 glTF의 BIN·텍스처는 원래 상대 경로를 유지합니다. 로컬 GLB 파일 선택은 이 폴더에 복사하지 않고도 가능합니다.

자세한 제작 규약과 지원 범위: [CharacterViewer 문서](../../../docs/CHARACTER_VIEWER.md).
