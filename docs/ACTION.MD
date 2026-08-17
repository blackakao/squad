# 액션 정의

스킬은 하나 이상의 액션으로 구성된다. 액션은 피해, 회복, 이동, 버프, 상태이상, 필드 생성처럼 전투 중 발생하는 실제 동작을 표현한다.

## 공통 규칙

- 대상은 `자신`, `아군`, `적군` 중 하나를 선택한다. 기존의 포괄적인 `대상` 값은 사용하지 않는다.
- 피해 타입은 `물리`, `마법`, `고정`으로 구분한다.
- 물리 피해는 방어력의 영향을 받고, 마법 피해는 저항력의 영향을 받는다.
- 고정 피해는 방어력이나 저항력으로 감소하지 않는 특정값으로 다룬다.
- BP는 Barrier Point, 즉 보호막 자원이다.
- BP가 1 이상 있으면 HP보다 먼저 피해를 받는다.
- BP가 피해를 받을 때는 방어력과 저항력으로 피해량이 감소하지 않는다.
- BP가 피해량보다 적어도 남은 피해는 HP로 넘어가지 않고 증발한다. 예를 들어 피해 1000, 남은 BP 100이면 BP 100만 소진되고 HP 피해 900은 발생하지 않는다.
- BP가 0인 상태에서 피해를 받으면 기존처럼 HP가 피해를 받기 시작한다.
- 액션 목록에서 제거한 항목은 UI에서 선택할 수 없다.
- 현재 구현이 어려운 액션은 잠금 목록으로만 남겨 추후 확장할 수 있게 한다.

## 스킬 슬롯

- 베이직: 기본 공격, 기본 회복처럼 전투에서 자동으로 사용되는 기본 스킬
- 액티브: 사용 조건이나 선택 입력을 통해 실행될 수 있는 능동 스킬
- 패시브: 직접 시전하지 않고 조건에 따라 적용될 지속 효과 스킬

## 액션 입력 구조

### 거리

거리 값은 라디오로 선택한다.

- 주장비: 주장비의 사정거리를 그대로 따른다.
- 특정값: 주장비 사정거리와 무관하게 별도의 사정거리를 사용한다.

데이터 필드는 다음과 같다.

- `rangeMode`: `mainWeapon` 또는 `custom`
- `rangeValue`: `rangeMode`가 `custom`일 때 사용할 거리 수치

### 계수

계수는 액션의 최종 수치를 계산하는 항목이다. 하나의 액션은 계수를 2개 이상 가질 수 있고, 계수 값은 음수도 허용한다.

계수 유형은 다음과 같다.

- 고정계수: 숫자 입력 필드만 사용한다. 입력한 값이 그대로 최종 계수가 된다.
- 계산계수: 대상 필드값을 가져와 계산한다. 입력 구조는 `필드 / 값계산 / 값입력`이다.

계산계수의 필드는 우선 다음 값만 준비한다.

- 스탯: 힘, 체력, 민첩, 집중, 지능, 지혜
- 자원: HP, MP, ST, BP
- 공격력
- 마력
- 방어력
- 저항력

계산계수의 값계산 방식은 다음과 같다.

- 고정: `필드값 + 값입력`으로 계산한다. 예를 들어 `힘 / 고정 / 0`이면 힘 스탯만큼을 최종 계수로 본다.
- 퍼센트: `필드값 * 값입력 / 100`으로 계산한다. 예를 들어 `공격력 / 퍼센트 / 80`이면 공격력의 80%를 최종 계수로 본다.

데이터 필드는 다음과 같다.

- `coefficients[].type`: `fixed` 또는 `calculated`
- `coefficients[].field`: `str`, `vit`, `agi`, `focus`, `int`, `wis`, `hp`, `mp`, `st`, `bp`, `atk`, `magic`, `defense`, `resistance`
- `coefficients[].calc`: `flat` 또는 `percent`
- `coefficients[].value`: 입력 수치

### 자원 소모

액션의 자원값에는 자원 종류와 소모치가 함께 있어야 한다. UI에서는 계수 아래쪽에 자원 소모 입력 공간을 둔다.
한 액션은 자원 소모값을 2개 이상 가질 수 있다.

자원 종류는 현재 다음 값으로 준비한다.

- HP
- MP
- ST
- BP

자원 소모 방식은 다음과 같다.

- 고정값: 입력한 수치만큼 소모한다.
- 전체의 %: 최대 자원량 기준 비율만큼 소모한다.
- 현재의 %: 현재 자원량 기준 비율만큼 소모한다.

데이터 필드는 다음과 같다.

- `resourceCosts[].resource`: 자원 종류
- `resourceCosts[].mode`: `fixed`, `maxPercent`, `currentPercent`
- `resourceCosts[].value`: 소모 수치 또는 비율

### 회복대상값

회복 액션은 계수와 함께 묶이는 회복대상값을 선택한다. 계수만큼 회복대상값을 회복한다.

- HP: 계수만큼 대상 HP를 회복한다.
- MP: 계수만큼 대상 MP를 회복한다.
- ST: 계수만큼 대상 ST를 회복한다.
- BP: 계수만큼 대상에게 보호막을 부여한다. BP는 최대치 제한 없이 현재 BP에 더해지며, 상태창의 BP 기준값도 함께 갱신한다.

데이터 필드는 다음과 같다.

- `healResource`: `HP`, `MP`, `ST`, `BP`

## 액션 목록

### 피해

- 코드: `deal_damage`
- UI 표시명: 피해
- 설명: 대상에게 피해를 입힌다.
- 주요 필드: `target`, `rangeMode`, `rangeValue`, `coefficients`, `damageType`, `area`, `critical`, `penetration`, `resourceCosts`
- UI 숨김 필드: `moveType`, `distance`, `fieldRadius`

### 회복

- 코드: `heal`
- 설명: 대상의 회복대상값을 계수만큼 회복한다. 회복대상값이 BP이면 보호막을 부여한다.
- 주요 필드: `target`, `rangeMode`, `rangeValue`, `coefficients`, `healResource`, `area`, `resourceCosts`
- UI 숨김 필드: `damageType`, `moveType`, `distance`, `fieldRadius`

### 이동

- 코드: `move`
- 설명: 시전자가 선택 대상 방향으로 이동한다.
- 대상: `아군`, `적군`만 선택할 수 있다.
- 주요 필드: `target`, `moveType`, `distance`, `moveSpeed`, `resourceCosts`
- 이동 방식: `Dash`, `Teleport`
- 돌진(`Dash`): 현재 위치에서 대상까지 빠른 속도로 이동한다. `moveSpeed`로 증가한 이동속도를 입력한다.
- 순간이동(`Teleport`): 현재 위치에서 대상 방향의 지정 거리 위치에 즉시 등장한다.
- 이동거리(`distance`): 1~10 범위의 값이며 기본값은 10이다. 현재 위치에서 대상까지의 거리 중 `distance * 10%`만큼 이동한다. 10이면 보통 대상 위치까지 이동한다.
- UI 숨김 필드: `damageType`, `healResource`, `range`, `coefficients`, `fieldRadius`

### 변신

- 코드: `transform`
- 설명: 대상의 형태를 변경한다.
- 주요 필드: `target`, `duration`, `resourceCosts`

### 상태 추가

- 코드: `add_state`
- 설명: 대상에게 상태이상을 추가한다.
- 주요 필드: `target`, `duration`, `resourceCosts`

예시 상태는 기절, 은신, 침묵, 탑승 등이 있다.

### 상태 제거

- 코드: `delete_state`
- 설명: 대상의 상태이상을 제거한다.
- 주요 필드: `target`, `resourceCosts`

### 버프 추가

- 코드: `add_buff`
- 설명: 대상에게 지속 효과를 추가한다.
- 주요 필드: `target`, `duration`, `resourceCosts`

### 버프 제거

- 코드: `delete_buff`
- 설명: 대상의 버프를 제거한다.
- 주요 필드: `target`, `resourceCosts`

### 소환

- 코드: `summon_entity`
- 설명: 전투 필드에 개체를 소환한다.
- 주요 필드: `target`, `duration`, `resourceCosts`

### 필드 생성

- 코드: `create_field`
- 설명: 특정 지역에 액션이 이루어지는 필드를 생성한다. 필드 안에서 피해, 회복, 버프, 상태이상 등의 동작이 이루어진다.
- 주요 필드: `target`, `rangeMode`, `rangeValue`, `fieldShape`, `fieldRadius`, `duration`, `coefficients`, `resourceCosts`

## UI 목록 처리

- `cast_skill`: 액션 목록에서 제거한다. 스킬 시전 값은 액션 내부가 아니라 스킬 실행 구조에서 다룬다.
- `override_rule`, `copy_skill`: 현재 구현 난이도가 높아 UI 목록에서는 잠금 처리한다. 추후 확장 가능하도록 코드에는 잠금 목록으로 남긴다.

앞으로 스킬 관리 UI에서 액션 입력 항목, 슬롯 종류, 액션 의미가 바뀌면 이 문서에도 같은 내용을 반영한다.
