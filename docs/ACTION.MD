deal_damage

설명:
피해를 입힌다

파라미터:
target
range
value
damage_type
area
critical
penetration

heal
설명:
수치를 회복한다

파라미터:
target
range
value
resource
area

resource:
HP
MP
ST
Energy
...

move
설명:
위치에 대한 이동을 한다

파라미터:
target
move_type
direction
distance
position
speed

move_type:
Walk
Dash
Teleport
Knockback
Pull
Push

transform
설명:
형태를 변경한다

파라미터:
target
form_id
duration

cast_skill
설명:
스킬을 바꾼다, 한 스킬을 2번 이상 사용하게 되야할때 사용하고, 하나의 스킬로 2가지 이상의 스킬을 사용한다

파라미터:
skill_id
target

add_state
설명:
상태를 추가한다. 상태는 기본적으로 지속시간동안 유지된다

파라미터:
target
state_id
duration

ex>
Stun(기절)
Stealth(은신)
Silence(침묵)
Mounted(탑승)

delete_state
설명:
상태를 제거한다

파라미터:
target
state_id
tag

ex>
Stun 제거
Movement 태그 제거
모든 CrowdControl 제거

add_buff
설명: 
지속시간동안 버프를 가진다 버프는 지워질수 있다

파라미터:
target
buff_id
duration
stack
source

delete_buff
설명: 
대상의 버프를 지운다

파라미터:
target
buff_id
tag

summon_entity

설명:
개체를 소환한다

파라미터:
entity_id
owner
position
count
duration

override_rule
설명:
규칙을 변경한다

파라미터:
rule_id
operation
value
duration

copy_skill
설명:
스킬을 복사해온다

파라미터:
source
filter
count
duration

