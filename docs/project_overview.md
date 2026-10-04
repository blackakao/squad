# 프로젝트 개요

[README](../README.MD)는 실행·문서 탐색의 진입점입니다. 이 문서는 현재 기능 범위를 요약하고, [아키텍처](architecture.md)는 모듈 관계, [데이터 구조](data_structure.md)는 저장 필드, [TODO](todo.md)는 후속 작업을 관리합니다. 기존 설계 원안과 기능별 상세 문서의 관계는 [문서 안내](../README.MD#문서-안내)를 참고합니다.

## 프로젝트 목적

이 프로젝트는 별도 빌드 과정 없이 실행되는 관전형 자동 전투 RPG 프로토타입입니다. 플레이어는 캐릭터, 팀, 장비, 스킬, 진영, 몬스터 데이터를 구성하고, 전투 중 직접 조작하지 않는 자동 전투 결과를 관찰합니다.

핵심 목표는 다음과 같습니다.

- 10명 이하 스쿼드 기반 자동 전투 규칙 검증
- 캐릭터 성장, 장비, 스킬 액션, 팀 시너지의 상호작용 실험
- 전투 결과와 상세 이벤트 기록을 통한 밸런스 확인
- 이미지 생성과 3D 캐릭터 뷰어를 포함한 콘텐츠 제작 흐름 실험

## 현재 구현 기능

- 정적 단일 페이지 앱: `index.html`, `css/style.css`, `js/*.js`
- Python 내장 HTTP 서버: `server.py`
- JSON 파일 기반 데이터 로드/저장 API
- 캐릭터 CRUD, 스탯 배분, 진영 지정, 초상화 저장
- 몬스터 CRUD, 스킬 지정, 초상화 저장
- 팀 편성, 활성 인원 수, 팀 전투 규칙, 진영/역할 시너지
- 아이템 관리, 장비 카테고리 관리, 캐릭터 장비 착용
- 장비 세트 최대 3개 관리와 전투 중 장비 세트 교체 액션
- 스킬 관리, 자원 비용, 시전 시간, 채널링, 패시브, 다중 액션
- 피해, 회복, 자원 감소, 이동, 상태/버프, 필드, 소환 Entity, 변신, 부활, 예비대, 규칙 변경 액션
- 팀 대 몬스터, 팀 대 팀 자동 전투
- setTimeout 기반 전투 틱·Canvas 2D 렌더링과 즉시 결과 계산
- 전투 이벤트 로그와 전투 기록 저장/조회/삭제
- 이미지 생성 설정 저장, 외부 이미지 생성 Provider 연동, 이미지 에셋 업로드
- SD 캐릭터/환경 뷰어와 Three.js 기반 GLB 확인 도구

## 주요 시스템

- 데이터 API: `/api/<name>` 요청을 `data/<name>.json`에 매핑합니다. `/api/records`는 `data/battle-records.json`에 매핑됩니다.
- Entity API: `/api/entities` 계열은 `data/entities/*.json`을 읽고 쓰며, 스킬의 소환 Entity 참조 무결성을 검사합니다.
- 이미지 API: `assets/images/portraits`, `skills`, `items`, `icons`, `generated` 하위 폴더만 저장 대상으로 허용합니다.
- 전투 시스템: `js/battle.js`, `js/skill.js`, `js/skill-effects.js`, `js/skill-passives.js`, `js/skill-channel.js`, `js/battle-events.js`가 전투 실행과 이벤트를 담당합니다.
- 콘텐츠 관리 UI: 캐릭터, 몬스터, 팀, 장비, 스킬, 진영, 기록, 이미지 설정 화면이 하나의 SPA 안에서 탭처럼 전환됩니다.

## 개발 방향

- 코드와 문서의 동기화를 유지합니다.
- 전투 규칙은 먼저 현재 구현을 기준으로 확인한 뒤 확장합니다.
- 데이터 스키마 변경 시 `data_structure.md`, 관련 JS, `README.MD`를 함께 점검합니다.
- 작업 완료 또는 중단 가능성이 있을 때 `todo.md`, `changelog.md`, `resume.md`를 최신 상태로 갱신합니다.
- 사용자 데이터인 `data/*.json`과 `assets/images/*`는 요청 범위 안에서만 수정합니다.
