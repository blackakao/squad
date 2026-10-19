import json
from pathlib import Path


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def summon_action(entity_id, condition, protect):
    return {
        "type": "summon_entity", "target": "self", "rangeMode": "custom", "rangeValue": 0,
        "minRange": 0, "ownedSummonCondition": condition, "ownedSummonEntityId": entity_id,
        "entityId": entity_id, "summonCenter": "self", "count": 1, "limit": 1, "duration": 0,
        "protectOwnerPercent": protect, "protectOwnerScope": "all", "protectOwnerPriority": protect,
        "inheritStats": {key: 0 for key in ("hp", "mp", "st", "atk", "magic", "defense", "resistance", "speed")},
    }


def buff_action(target, entity_id, condition, effect_id, name, stat, value, duration):
    return {
        "type": "add_buff", "target": target, "rangeMode": "custom", "rangeValue": 100 if target == "summon" else 0, "minRange": 0,
        "ownedSummonCondition": condition, "ownedSummonEntityId": entity_id,
        "targetSummonEntityId": entity_id if target == "summon" else "", "duration": duration,
        "effect": {
            "id": effect_id, "name": name, "state": "buff", "category": "magic", "polarity": "beneficial",
            "dispellable": True, "stat": stat, "sourceStat": "atk", "mode": "percent", "value": value,
            "requiredOwnedSummonEntityId": entity_id, "maxStacks": 1, "stackMode": "refresh",
        },
    }


entities = [
    {
        "entityId": "knight_magic_horse", "name": "마법말", "role": "tank",
        "description": "기사에게 연결되어 피해의 20%를 대신 받는 마법 말.", "icon": "",
        "summonType": "temporary", "attackType": "physical", "tags": ["summon", "knight", "mount"],
        "ai": "stationary",
        "stats": {"hp": 1000, "mp": 0, "st": 0, "atk": 0, "magic": 0, "defense": 0,
                  "resistance": 0, "speed": 0, "attackSpeed": 2, "castTime": 0, "attackRange": 1},
    },
    {
        "entityId": "demon_brute", "name": "덩치", "role": "melee",
        "description": "악마에게 연결되어 피해의 60%를 대신 받는 마법 근접 소환수.", "icon": "",
        "summonType": "temporary", "attackType": "magic", "tags": ["summon", "demon", "brute"],
        "ai": "melee",
        "stats": {"hp": 1000, "mp": 100, "st": 100, "atk": 10, "magic": 60, "defense": 10,
                  "resistance": 10, "speed": 1.2, "attackSpeed": 2, "castTime": 0, "attackRange": 1},
    },
]
for entity in entities:
    write_json(Path("data/entities") / f"{entity['entityId']}.json", entity)

horse_passive = {
    "id": "skill_class_knight_magic_horse", "name": "기사 · 마법말", "className": "기사", "icon": "",
    "description": "전투 시작 시 마법말을 소환합니다. 마법말이 생존하는 동안 이동속도가 50% 증가하며, 받는 피해의 20%를 마법말이 대신 받습니다.",
    "slot": "passive", "cooldown": 0, "castTime": 0,
    "passiveTrigger": {"event": "battle_entry", "chance": 100, "includePeriodic": False, "allowMultiplePerTick": False},
    "resourceCosts": [],
    "actions": [
        summon_action("knight_magic_horse", "absent", 20),
        buff_action("self", "knight_magic_horse", "any", "knight_magic_horse_speed", "마법말 탑승", "speed", 50, 0),
    ],
}

horse_active = {
    "id": "skill_class_knight_haste_horse", "name": "기사 · 가속/마법말소환", "className": "기사", "icon": "",
    "description": "마법말이 없으면 다시 소환합니다. 마법말이 생존 중이면 5초 동안 공격력 25% 증가, 공격 간격 25% 감소 효과를 얻습니다.",
    "slot": "active", "cooldown": 15, "castTime": 0,
    "channel": {"duration": 0, "interval": 1, "interruptOnDamage": True},
    "resourceCosts": [{"resource": "ST", "mode": "fixed", "value": 30}],
    "actions": [
        summon_action("knight_magic_horse", "absent", 20),
        buff_action("self", "knight_magic_horse", "alive", "knight_horse_haste_atk", "마법말 가속 · 공격력", "atk", 25, 5),
        buff_action("self", "knight_magic_horse", "alive", "knight_horse_haste_speed", "마법말 가속 · 공격속도", "attackSpeed", -25, 5),
    ],
}

brute_active = {
    "id": "skill_class_demon_brute", "name": "악마 · 덩치소환/덩치공격", "className": "악마", "icon": "",
    "description": "덩치가 없으면 소환합니다. 덩치는 악마가 받는 피해의 60%를 대신 받습니다. 덩치가 생존 중이면 5초 동안 덩치의 마력이 25% 증가합니다.",
    "slot": "active", "cooldown": 10, "castTime": 0,
    "channel": {"duration": 0, "interval": 1, "interruptOnDamage": True},
    "resourceCosts": [{"resource": "MP", "mode": "fixed", "value": 30}],
    "actions": [
        summon_action("demon_brute", "absent", 60),
        buff_action("summon", "demon_brute", "alive", "demon_brute_magic", "덩치 공격명령", "magic", 25, 5),
    ],
}

skills_path = Path("data/skills.json")
skills = json.loads(skills_path.read_text(encoding="utf-8"))
new_skills = [horse_passive, horse_active, brute_active]
ids = {skill["id"] for skill in new_skills}
skills = [skill for skill in skills if skill.get("id") not in ids] + new_skills
write_json(skills_path, skills)

characters_path = Path("data/characters.json")
characters = json.loads(characters_path.read_text(encoding="utf-8"))
assignments = {
    "기사": ["skill_class_knight_magic_horse", "skill_class_knight_haste_horse"],
    "악마": ["skill_class_demon_brute"],
}
for character in characters:
    additions = assignments.get(character.get("name"))
    if not additions:
        continue
    current = character.setdefault("skillIds", [])
    for skill_id in additions:
        if skill_id not in current:
            current.append(skill_id)
write_json(characters_path, characters)
