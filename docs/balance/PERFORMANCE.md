# 전투 테스트 V1.1 성능·검증 기록

2026-10-11, Windows / Node 24 / Chrome. 아래 수치는 실제 측정값이며 PC 부하·JIT·전투 구성에 따라 달라집니다.

## 동일 입력 최적화 전후

38개 캐릭터 입력 스냅샷, 3v3, seed 12345, 400×300, 제한 600초, 100회. Node inspector CPU sampling을 켜고 초기화·전투·집계·직렬화를 각각 측정했습니다.

| 단계 | 기존 VM (ms) | 직접 VM 전역 (ms) |
| --- | ---: | ---: |
| 초기화 | 125.70 | 239.31 |
| 실제 전투 | 100,933.52 | 36,338.09 |
| 집계 | 3.17 | 3.49 |
| JSON 직렬화 | 4.63 | 5.16 |
| 전체 | **101.067초** | **36.586초** |

동일 입력 100회 기준 63.8% 감소, 약 2.76배입니다. [기존 profile 요약](../../balance/profiles/baseline.json), [변경 후 요약](../../balance/profiles/direct-global.json), [입력 스냅샷](../../balance/profiles/input.json)을 보존했습니다. `.cpuprofile`도 같은 폴더에 있으며 Chrome DevTools Performance에서 가져올 수 있습니다.

- 입력 SHA-256: `943307d84e5f2ec59bc94d5828a5959adcf75e274c4d052f6414e2201eea4136`
- 두 실행의 전체 전투 결과 SHA-256: `1b38273f96795ca5b4c77bf01f650a7124b52372be601e2d85422666263e369c` (완전히 일치)
- 실제 UI 100회 결과도 같은 해시입니다. UI 1,000회 중 첫 100회 결과도 동일합니다.

기존 self time 상위는 자원 갱신 내부 함수 6.82초, moveUnit 5.06초, runBattleTick 5.01초, takeAction 4.41초, tryUseReadySkill 3.84초, 자원 참조 정규화 3.80초였습니다. 초기화/복제·집계·직렬화가 지배적인 병목이 아니었습니다. 전투 함수들이 전역 함수를 자주 조회하는 현재 구조에서 VM의 전역 proxy 비용을 줄이는 실험으로 실제 개선을 확인했습니다.

변경은 `vm.createContext(vm.constants.DONT_CONTEXTIFY)`와 초기 전역 주입입니다. 별도 JS realm·가상 시계·seed를 유지하며 틱 생략, AI·피해·스킬 단순화, 전투 함수 교체는 하지 않았습니다. 동일 입력 결과 해시와 실제 Chrome의 gameLoop 이벤트 일치로 검증했습니다. Node 22.8 이상이 필요합니다.

기존에도 UI 출력은 비활성이고 통계 이벤트는 전체 누적하며, 전체 이벤트 배열은 `runBattle({trace:true})` 때만 추가합니다. 일반 Job은 summary 모드입니다. 완료 전투 JSON journal은 전투당 한 번, 진행 이벤트는 최대 초당 4회 저장하며 UI는 1초 polling입니다. 통계 수집을 줄여 정확성을 희생하지 않았습니다.

전투별 독립 seed/상태이므로 프로세스 병렬화는 가능하지만, 이번에는 단일 프로세스의 VM 비용 개선만 적용했습니다. 다중 엔진 메모리·PC 점유·안정된 순서/취소/부분 집계를 복잡하게 만들기 전에 현재 비용을 측정했습니다. 동시 Job은 1개입니다.

## 실제 페이지 버튼 실행

Selenium Chrome에서 앱의 **전투 테스트 → 시작** 버튼을 클릭했습니다. 서버 데이터는 원본의 격리 복사본이며 테스트용 목표 수정과 일반 앱 API 쓰기는 복사본에서만 수행했습니다. 완료된 두 결과는 실제 앱의 실행 기록에도 등록했습니다.

| 실행 | 실행기 실측 | 평균 가상 전투시간 | 시간 초과 | 무승부 |
| --- | ---: | ---: | ---: | ---: |
| UI 100회 | **44.169초** | 131.365초 | 9 | 0 |
| UI 1,000회 | **216.942초** | 134.975초 | 88 | 0 |

1,000회에서 마법사 승률 98.73%, DPS 231.74, 드루이드 HPS 36.71입니다. 목표는 모두 미정이므로 정상/비정상을 판정하지 않습니다. 캐릭터 38개, 각 157~158회 표본이며 조합은 대부분 표본 부족입니다.

- [UI 100회 원본](../../balance/jobs/simulation_20261011_085434_0d93adb1/result.json)
- [UI 1,000회 원본](../../balance/jobs/simulation_20261011_085531_ebb8e7e0/result.json)
- [최종 화면](../../balance/ui-validation/dashboard-final.png), [640px 화면](../../balance/ui-validation/mobile.png), [검증 메타데이터](../../balance/ui-validation/validation.json)

이전 V1의 1,000회 714.43초는 **9개 캐릭터·이전 데이터/엔진**이고 이번은 **38개 캐릭터 스냅샷**입니다. 216.94초와 직접 비교해 순수 최적화 배율이라고 주장하지 않습니다. 순수 변경 효과는 위의 동일 입력 100회 A/B로 확인했습니다. CPU profile과 UI 실행 시간 차이도 프로파일링·프로세스 시작·파일 출력·동시 작업·JIT 조건의 영향을 받습니다. UI 실행시간은 실행기 내부 초기화~집계 기준이며 프로세스 시작/최종 파일 출력까지의 벽시계와 약간 다릅니다.

검증 도중 별도 작업에서 소환수 생명주기와 브라우저 전투 코드가 변경되었습니다. 저장 결과의 engineHash는 실행 시점을 나타내며 이후 소스와 다를 수 있습니다. 과거 결과는 그대로 보존하고, 현재 엔진의 Chrome/headless 동등성은 별도로 다시 검증했습니다.

## 검증 방법과 범위

```powershell
python tests/test_simulation_jobs.py
python tests/test_simulation_ui.py
# 긴 실측을 다시 하지 않고 보존된 두 결과로 후속 UI 확인
python tests/test_simulation_ui.py --saved-runs
node --test tests/balance-simulator.test.cjs tests/skill-engine.test.cjs tests/team-rules.test.cjs tests/equipment-rules.test.cjs
python tests/test_balance_browser.py
node balance/simulator/profile.cjs current 100
```

Profile 명령은 `.tmp-balance-profile/input.json`이 있으면 같은 입력을 재사용합니다. `current.json/.cpuprofile`에 현재 코드의 측정을 저장합니다. 기준 측정은 최적화 전 코드에서 수행해 별도 보존한 값입니다.

확인한 동작: 실제 100/1,000회 완료·증가하는 progress·메뉴 이동·새로고침 후 동일 Job·중복 POST 409·승률 오름/내림과 DPS 숫자 정렬·과거 결과 무재실행 조회·640px 가로 넘침 없음·현재 전투 후 CANCELLED와 부분 결과·목표 표 저장/과거 목표 스냅샷 유지·실제 자식 프로세스 실패 표시/재시작 버튼·개발 로그. 완료 이력의 불필요한 DOM 재생성을 막았고, MutationObserver가 이미 제거된 table에 접근하는 공통 스타일 처리 오류도 수정했습니다.

서버 단위 검증은 실제 Node worker, 동시 요청 잠금, 파일 지속성, 서버 재시작 중단 복구, 잘못된 입력/없는 Node/알 수 없는 ID, 목표 범위 검증을 포함합니다. 엔진 테스트는 0회/부분 중단·seed 재현·실제 tick/gameLoop·스킬/전투 이벤트·통계·소환 생명주기를 검사합니다. 소스/데이터를 변경하지 않는 브라우저 비교에서는 1v1/2v2/3v3 전체 이벤트·승패·틱과 정상 전투 기록 저장을 확인합니다.
