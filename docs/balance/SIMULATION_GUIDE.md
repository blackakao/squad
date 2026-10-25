# 전투 테스트 V1.1

## 게임 페이지에서 사용

Node.js 22.8 이상(검증: Node 24)과 Python이 필요합니다. `python server.py`로 게임을 실행하고 **전투 테스트**를 엽니다. 서버가 이미 실행 중이었다면 새 코드 적용을 위해 한 번 재시작합니다.

1. 100/1,000/10,000회 또는 직접 횟수(1~10,000), 1v1/2v2/3v3, Seed를 선택합니다. 상세 설정에서 전투별 제한시간·평가 최소 표본을 바꿀 수 있습니다.
2. **시뮬레이션 시작**을 누르면 서버가 Job ID를 즉시 반환하고 별도 Node 프로세스에서 실제 전투를 계산합니다. 화면은 1초마다 완료 횟수·진행률·측정 경과시간·예상 잔여시간을 조회합니다. 예상치는 완료 전투 기준이며 전투 길이에 따라 변합니다.
3. 다른 메뉴 이동·새로고침 후에도 작업은 계속됩니다. 전투 테스트로 돌아오면 진행 중 작업을 찾습니다. 브라우저의 전투 렌더링과 독립적이며 한 번에 하나만 실행합니다.
4. **중단**은 현재 전투 종료 후 CANCELLED로 저장합니다. 완료된 전투의 대시보드와 원본을 보존하며 COMPLETED와 구분합니다.
5. 완료 후 평균 시간·시간 초과·최고 승률/DPS/HPS, 캐릭터별 표, 조합 결과를 페이지에서 확인합니다. 숫자 헤더는 내림/오름차순, 순위 버튼은 해당 지표 내림차순입니다. 표본 부족은 표시하고 목표 평가는 보류합니다.
6. 실행 기록에서 과거 결과를 열면 재실행 없이 당시 스냅샷의 결과를 표시합니다. 기존 CLI 원본도 이력에 포함됩니다. 날짜·데이터/엔진 해시·Git·JSON/Markdown은 결과의 **실행 데이터·원본**에서 확인합니다.
7. **목표 밸런스 편집**에서 빈칸은 미정이며 판정하지 않습니다. 저장은 [목표 문서](BALANCE_TARGETS.md) 표 하나를 갱신합니다. 다음 실행부터 적용하며 과거 기록의 목표 스냅샷은 유지합니다.

서버 자체를 종료하면 계속 실행을 보장하지 않습니다. 실행기는 부모 연결 종료를 감지해 현재 전투 후 멈춥니다. 서버 재시작 시 남은 활성 기록은 결과 파일이 있으면 복구하고, 없으면 FAILED로 표시해 완료 전투 journal을 제공합니다. 실패 시 종료시각·완료 수·오류·개발 로그를 확인하고 다시 시작할 수 있습니다. 게임 데이터와 일반 전투 기록은 쓰지 않습니다.

## 서버 API와 파일

| 요청 | 응답/동작 |
| --- | --- |
| GET `/api/simulations` | jobs, activeId; 기존 CLI 이력 포함 |
| POST `/api/simulations` | count/teamSize/seed/maxSeconds/minSamples 설정 → Job; 중복 409 |
| GET `/api/simulations/<id>` | status, completed/total, elapsedSeconds, 메타데이터 |
| POST `/api/simulations/<id>/cancel` | CANCELLING 요청, 완료 결과는 보존 |
| GET `/api/simulations/<id>/result` | summary·목표·실행 정보, 무거운 원본 제외 |
| GET `/api/simulations/<id>/json`, `/markdown` | 보조 원본·보고서 |
| GET `/api/simulations/<id>/log`, `/journal` | 웹 작업 개발 로그·완료 전투 원본 |
| GET/PUT `/api/simulation-targets` | `{targets: {winRate: [최소, 최대], ...}}`; null=미정 |

웹 작업 파일은 `balance/jobs/<simulationId>/`의 request.json/job.json/result.json/report.md/battles.ndjson/error.log입니다. 완료 기록은 덮어쓰지 않습니다. Web UI → Python API/Job → Node worker → 공통 service → 실제 engine → aggregate → 저장 결과 순으로 연결합니다. CLI도 같은 service를 호출합니다. 프레임워크·큐 서버·npm 의존성은 추가하지 않았습니다.

## 결과 보존과 Git 관리

새 Job 디렉터리, UI 검증 실행 사본, 날짜 형식 CLI JSON/Markdown 결과는 로컬에 그대로 저장하되 Git에서는 기본 무시합니다. 기존 추적 중인 결과·테스트 기준·프로파일·화면 증거는 계속 유지합니다. 무시 규칙은 파일 생성·기존 결과 조회·API에 영향을 주지 않으며 로컬 결과를 자동 삭제하지 않습니다.

새 결과를 공식 기준으로 공유할 때는 입력 스냅샷·엔진 버전·목표·관련 로그와 문서 참조를 함께 검토하고 승인된 실행의 정확한 경로만 `git add -f -- <경로>`로 추가합니다. 폴더 전체를 무차별 추가하지 않습니다. 무시된 새 이력은 커밋/다른 환경에 자동 전달되지 않으므로 필요한 기록은 별도 백업하거나 기준 자료로 승격해야 합니다. 기존 추적 파일은 무시 규칙으로 보호되지 않으므로 검증 실행 전 변경 상태를 확인합니다.

UI 테스트의 `--saved-runs`는 현재 `balance/ui-validation/simulation_*/`를 격리 서버에 복사합니다. 동일한 Job 사본이 있어도 참조 전환과 검증 없이 삭제하지 않습니다. 파일별 보존 분류·SHA-256·중복 목록·후속 개선안은 [저장 자료 조사](STORAGE_AUDIT.md)에 기록했습니다.

## 실행

개발/자동화용 CLI는 Node.js 22.8 이상이 필요합니다(검증 환경: Node 24). npm 설치, 빌드, Python 서버, 브라우저 없이 프로젝트 루트에서 실행합니다.

```powershell
node balance/simulator/runner.cjs
node balance/simulator/runner.cjs --preset standard
node balance/simulator/runner.cjs --preset deep --team-size 3 --seed 12345
node balance/simulator/runner.cjs --count 100 --team-size 1 --width 400 --height 300
```

- Quick 100회(기본), Standard 1,000회, Deep 10,000회. `--count`는 프리셋 횟수를 덮어씁니다.
- 팀 인원은 기본 `min(3, floor(캐릭터 수/2))`, 최대 10명입니다. 1 vs 1, 2 vs 2, 3 vs 3 등을 지원하지만 양 진영의 중복 캐릭터를 허용하지 않아 인원의 두 배 이상 캐릭터가 필요합니다. 현재 9명으로는 최대 4 vs 4입니다. 기존 엔진은 최대 10명이며 고정 기본 편성은 없습니다.
- `--seed`: 0–4294967295 정수, 기본 12345. 편성과 전투 난수는 별도 생성기를 사용하며 각 전투 seed를 보존합니다.
- `--max-seconds`: 전투별 가상 시간 제한, 기본 600초. 시간 초과는 `timeout`, 승자 없음으로 기록합니다. 무승부와 패배를 대신 부여하지 않습니다.
- `--width`, `--height`: 전장 크기, 기본 400×300. 이동·충돌·타겟 거리에 영향을 주므로 비교할 때 반드시 동일하게 맞춥니다.
- `--min-samples`: 캐릭터·조합의 표본 부족 표시 기준, 기본 30.
- 5% 간격으로 완료 횟수·진행률·누적 실제 시간을 출력합니다. 각 실행은 전투를 순차 계산합니다. Ctrl+C는 현재 전투 종료 후 CANCELLED 상태로 완료된 결과를 저장합니다.

출력은 `balance/results/<UTC시각>_<횟수>.json`과 같은 이름의 `.md`, 최신 보고서는 [BALANCE_REPORT.md](BALANCE_REPORT.md)입니다. 기존 실행 원본은 보존하고 최신 보고서만 갱신합니다. 결과 JSON에는 입력 데이터 전체와 목표 문서의 실행 당시 스냅샷을 포함합니다. 게임 데이터와 게임 전투 기록은 저장하지 않습니다.

## 재현과 프로그래밍 진입점

```powershell
node balance/simulator/runner.cjs --replay balance/results/<실행파일>.json --battle 1
```

1부터 시작하는 전투 번호를 지정합니다. 현재 데이터 대신 저장된 입력 스냅샷을 사용하고, 현재 공유 엔진 SHA-256이 원본과 다르면 거부합니다. 원본 코드 버전과 시뮬레이터 버전을 함께 보존하세요. 작업 트리 변경분도 엔진 해시에 반영되므로 Git 커밋 ID만으로 코드 동일성을 판단하지 않습니다.

```javascript
const {createEngine} = require('./balance/simulator/engine.cjs');
const engine = createEngine();
const result = engine.runBattle({teamA:[0,3,4], teamB:[1,7,8], seed:12345});
```

캐릭터 ID는 게임과 동일하게 캐릭터 배열의 0 기반 인덱스입니다. 데이터 재정렬 후의 동일 ID는 같은 캐릭터를 보장하지 않으므로 원본 스냅샷과 함께 해석합니다. 직접 호출에서는 서로 다른 진영에 같은 캐릭터를 넣는 미러 테스트도 가능하지만 자동 편성기는 이를 사용하지 않습니다.

## 기존 구조 조사와 재사용 경로

| 단계 | 실제 코드 | 시뮬레이터 사용 |
| --- | --- | --- |
| 상수·정규화·피해 감소 | `js/ui.js` | 기존 상수, `normalizeCombatJson`, `getReducedDamage` |
| 능력치·장비 | `js/equipment.js`, `js/stats.js`, `js/category.js` | `applyCharacterStatAbilities`, 장비 세트·독립 무기 계산 |
| 캐릭터·편성 | `js/character.js`, `js/team.js` | `createCharacter`, `createSquadFromCharacterIds` |
| 전투 초기화 | `js/battle.js` | `prepareBattleSession`, `resetUnitForBattle`, `placeSquadForBattle` |
| AI·이동·타겟·시전 | `js/battle.js`, `js/skill.js` | `moveUnit`, `takeAction`, `tryUseReadySkill`, 액션별 대상 선택·조건 검사 |
| 스킬·피해·회복 | `js/skill.js` | 액션 dispatch, `applyActionDamage`, `applyActionHeal`, 실제 자원 비용·쿨다운 |
| Trigger·상태·버프 | `js/battle-events.js`, `js/skill-passives.js`, `js/skill-effects.js` | 기존 이벤트 dispatch·패시브·지속/주기 효과 |
| 채널링·Entity·필드 | `js/skill-channel.js`, `js/entity.js`, `js/battle.js` | 실제 주기, 소환 AI·수명, 필드 효과 |
| 사망·부활·승패 | `js/battle.js` | `syncAliveState`, `updateBattleReentries`, `canSquadContinueBattle`, `updateCombat` |
| 통계 | `balance/simulator/engine.cjs` | 전투 이벤트 구독으로 전체 누적; UI의 1,000건 history 제한과 독립 |
| 반복·집계·출력 | `balance/simulator/runner.cjs`, `report.cjs` | 균형 편성, JSON, Markdown, 목표 비교 |

실제 화면의 `gameLoop`와 CLI가 같은 `runBattleTick`을 실행합니다. 별도 피해 공식이나 승패 난수 판정은 없습니다. `finishBattle`에는 선택적인 `battleResultSink`만 추가했으며, 미설정인 기존 게임에서는 종전 UI·기록 저장 경로가 그대로 실행됩니다.

현재 브라우저 코드가 전역 스크립트 구조여서 Node `vm` 격리 컨텍스트에 실제 소스를 그대로 로드합니다. `ui.js` 로드 시 요소 바인딩에는 전장 크기를 가진 일반 객체와 null을 제공하고 즉시 document 바인딩을 제거합니다. 전투 중에는 DOM, Canvas renderer, 이미지, 타이머, API를 사용하지 않습니다. 출력 전용 로그·버튼·말풍선·범위 표시만 무동작 함수로 연결하며 전투 규칙 함수는 교체하지 않습니다. 투사체는 명중 시점에 영향을 주므로 실제 이동·명중 계산을 유지합니다.

입력은 API 대신 로컬 JSON을 읽습니다. API의 자동 Entity 마이그레이션이 사용자 파일을 변경할 수 있기 때문입니다. 기존 inline summon 형식이면 조용히 생략하지 않고 오류로 중단합니다. 없는 Entity 참조는 기존 초기화 검사를 따릅니다.

## 시간·난수·편성

가상 Date/performance 시계는 매 틱 1/60초 진행하며 배속은 1입니다. 시뮬레이터 컨텍스트 안에서만 Math.random을 Mulberry32 seed 생성기로 대체합니다. 캐릭터 생성 위치, 초기 배치, 확률 패시브에 동일하게 적용됩니다. 매 전투 캐릭터와 런타임 상태를 재생성하고 이벤트·소환·효과 식별자를 초기화합니다.

자동 편성기는 누적 출전 수가 낮은 캐릭터부터 선택하고 동률을 난수로 섞습니다. 선택 후 Fisher–Yates로 양 진영을 배분하므로 각 시점의 출전 수 차이는 최대 1입니다. 진영·상대·조합별 출전 수까지 균등하게 만드는 최적화는 하지 않습니다. A진영과 B진영 승리를 별도 보고합니다.

무작위 임시 편성은 저장된 팀의 배율·기존 배율 시너지·선봉/예비대를 부여하지 않습니다. 공용 스탯 시너지는 `synergies` 입력 스냅샷과 실제 편성으로 자동 적용하고, 개별 전투 결과의 `activeSynergies`에 양측 활성 ID·이름·단계를 보존합니다. 캐릭터 데이터의 장비, 스킬, 진입 지연·부활 설정은 그대로 적용합니다. 저장된 팀을 비교하는 모드는 후속 범위입니다. [공용 시너지](../synergy/SYNERGY_SYSTEM.md).

## 지표와 저장 형식

- 각 전투: battleId, seed, teamA/teamB, winner(A/B/null), termination(victory/draw/timeout), duration(초), ticks, characters, summonTotals.
- 캐릭터: characterId, name, role, team, outcome, damageDealt, healingDone, damageTaken, kills, deaths, survivalTime(실제 활성 생존 틱 합계), dps, hps. 부활 대기·예비대 시간은 survivalTime에서 제외합니다.
- 확장 정보: skillUsage(시전 완료 이벤트 수), damageBySkill, healingBySkill, resourceRecovery(HP 이외 자원별 실제 회복). 기본/패시브 공격 횟수를 모두 나타내는 사용률은 아닙니다.
- 피해: `hit` 이벤트의 실제 HP+BP 차감. 받은 피해는 `damaged`에서 수집하여 대리 수신을 중복 집계하지 않습니다. 자원 감소 액션의 HP drain은 기존 엔진이 damage로 분류하지 않아 Damage/DPS에서 제외됩니다.
- 회복: `heal` 이벤트 중 HP만 사용하며 과잉 회복은 기존 엔진에서 제외됩니다. 자동 MP/ST 재생은 Healing으로 세지 않습니다. Overheal은 현재 수집하지 않습니다.
- `contributionVersion:1`부터 소환수 피해·치유·처치와 행동량을 소유자에게 합산합니다. `contribution.direct/summon/total/groups`로 분리하며 `summonTotals`는 이미 포함된 진단 부분합입니다. 팀 합계에는 다시 더하지 않습니다. 받은 피해·사망·생존시간은 본체만 계산합니다. [공통 집계 규칙](../BATTLE_CONTRIBUTIONS.md).
- DPS/HPS: 각 전투에서 누적량/전투 전체시간, 캐릭터 표에는 그 산술평균. `pooledDps`/`pooledHps`는 모든 누적량/모든 전투시간으로 별도 저장합니다.
- 승률: wins/battles×100. 무승부·시간 초과도 분모에 포함하며 losses와는 분리합니다.
- 조합: ID를 정렬한 멤버 집합으로 합산합니다. 캐릭터별 승률은 함께 배치된 아군과 상대의 영향이 있으므로 개인 능력의 인과 평가가 아닙니다.
- 실행 메타데이터: schemaVersion, startedAt(UTC), elapsedSeconds, nodeVersion, gitRevision, engineHash, dataHash, settings, inputSnapshot, targetMarkdown, summary, results.

## 목표 비교

[BALANCE_TARGETS.md](BALANCE_TARGETS.md)의 표만 수정하면 다음 실행에서 비교합니다. 미정인 지표는 평가하지 않습니다. 잘못된 숫자·빠진 행·중복 행·역전 범위는 실행 전에 오류로 알려 주며 이전 보고서를 덮어쓰지 않습니다. 자동 문장은 ‘측정 결과’와 구분된 ‘밸런스 평가’에 표시합니다.

## 검증

```powershell
node --test tests/balance-simulator.test.cjs tests/skill-engine.test.cjs tests/team-rules.test.cjs tests/equipment-rules.test.cjs
python tests/test_balance_browser.py
python tests/test_simulation_jobs.py
python tests/test_simulation_ui.py
```

Node 테스트는 실데이터 전투 재현, 서로 다른 실행 순서의 격리, UI 스케줄러와 틱 비교, 1,000건 이상 이벤트 누적, timeout, 균형 편성, 집계 산식, 목표 문서 변경을 검증합니다. 기존 스킬 테스트는 패시브·주기효과·쿨다운·채널링·대리 피해·반사·부활·장비·Entity 등 규칙을 확인합니다.

브라우저 테스트는 복사한 데이터의 Python 서버에서 실제 페이지 소스를 로드하고, 동일 입력/seed/시계를 사용하여 실제 `gameLoop`의 draw와 상태 UI를 포함해 진행합니다. 1v1·2v2·3v3의 모든 스킬·피해·치유·사망 이벤트, 틱 수와 승자를 Node와 비교합니다. 이어서 sink를 해제한 기본 `finishBattle` 경로의 UI/API 기록 저장도 격리 파일에서 확인합니다. 정상 벽시계로 오래 관전하는 경우의 프레임 지연까지 같다는 뜻은 아닙니다.

2026-10-10 검증: Node 시뮬레이터 8개와 기존 전투·팀·장비 148개, 총 156개 통과. Chrome 비교 및 기본 기록 저장 테스트 통과. 초기 Chrome 드라이버 조회는 샌드박스 네트워크 제한으로 실패했으며, 허용된 실행에서 검증을 완료했습니다.

2026-10-11 V1.1 검증·실측은 [성능 및 검증 기록](PERFORMANCE.md)에 별도로 정리했습니다. 실제 UI 버튼 100/1,000회, 새로고침·중단·이력·정렬·목표·실패, 공통 서비스/서버 worker와 현재 엔진 Chrome 동등성을 확인했습니다.

## 전투 엔진 관찰 사항과 한계

### 2026-10-10 실측, 2026-10-11 결과 확정

공통 조건은 9개 실제 캐릭터, 3 vs 3, seed 12345, 400×300, 전투별 제한 600초입니다.

| 실행 | 실제 소요 시간 | 평균 전투시간 | 시간 초과 |
| --- | --- | --- | --- |
| 100회 | 41.41초 | 70.00초 | 1회 |
| 1,000회 | 714.43초 (11분 54초) | 70.91초 | 7회 |

1,000회 실행의 첫 100회는 별도 100회 실행과 모든 전투 결과가 같습니다. 실행 중 브라우저 검증과 다른 작업도 진행됐으므로 성능값은 해당 환경의 관측치입니다. 1,000회 기준 10,000회 선형 예상은 7,144.34초(약 119분)이며 실제 실행값이 아닙니다. 대규모 반복 분석 시 우선 VM 경계 호출·출력 처리 비용을 프로파일링하고 이후 독립 컨텍스트 병렬화를 검토할 수 있습니다.

원본은 [100회](../../balance/results/2026-10-10T13-09-19-471Z_100.json), [1,000회](../../balance/results/2026-10-10T13-12-05-837Z_1000.json)에 보존했습니다. 두 실행은 같은 입력 스냅샷을 사용합니다. 그 이후 추가·변경된 아이템·진영·캐릭터 설정을 측정하려면 새로 실행해야 합니다. [최신 저장 보고서](BALANCE_REPORT.md)는 이 1,000회 결과입니다.

### 해석 범위

- **전투 엔진 버그 후보 — 시간 기준 불일치:** `updateResources`는 Date.now 경과량, 스킬·이동은 틱을 사용합니다. 기존 `showImmediateBattleResult`는 틱만 빠르게 반복하므로 자원 회복이 가상 전투시간만큼 진행되지 않으며 기록 시간도 계산 실행시간입니다. 배속·백그라운드 catch-up에서도 차이가 날 수 있습니다. 이 작업에서는 규칙 변경 금지에 따라 수정하지 않았습니다. 시뮬레이터는 정상 60Hz·1배속 기준 시간을 명시적으로 진행합니다.
- 화면 크기가 전장 크기를 결정합니다. 같은 seed만으로 서로 다른 화면 크기의 결과 동일성을 주장할 수 없습니다.
- 기존 이벤트 dispatch의 중첩 깊이/큐 제한도 그대로 유지합니다. 시뮬레이터는 별도 이벤트를 만들어 누락을 보정하지 않습니다. 이벤트 처리 오류는 실행 실패로 처리합니다.
- 측정 결과의 극단적인 승률이 버그라는 뜻은 아닙니다. 목표·상대·조합·장비·진영 편향을 먼저 확인하고 별도로 조사해야 합니다.
- V1.1은 Web 대시보드와 서버 작업 관리를 추가했고, 2026-10-13부터 소환 기여도 소유자 합산과 분리 분석을 지원합니다. 스킬 사용률, CC·버프 기여도, matchup·synergy 통계와 여러 전투의 병렬 계산은 포함하지 않습니다. VM 전역 접근 비용을 줄이는 최적화를 적용했고, 병렬화는 후속 범위입니다. [실측 profile](PERFORMANCE.md)을 참고합니다.
