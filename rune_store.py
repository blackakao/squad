"""Validation for independent rune definitions and their reusable skill effects."""
import math
import re

RUNE_EFFECT_TYPES = {'deal_damage', 'heal', 'drain_resource', 'add_buff', 'add_state', 'delete_buff', 'delete_state'}


def validate_runes(runes, skills):
    if not isinstance(runes, list):
        raise ValueError('룬 데이터는 배열이어야 합니다.')
    catalog = {skill.get('id'): skill for skill in skills}
    seen = set()
    for rune in runes:
        if not isinstance(rune, dict):
            raise ValueError('룬 정의는 객체여야 합니다.')
        rune_id = rune.get('id', '')
        if not isinstance(rune_id, str) or not re.fullmatch(r'[a-z0-9_-]{1,80}', rune_id) or rune_id in seen:
            raise ValueError('룬 ID가 잘못되었거나 중복되었습니다.')
        seen.add(rune_id)
        if not isinstance(rune.get('name'), str) or not rune['name'].strip():
            raise ValueError('룬 이름이 필요합니다.')
        for key, minimum in [('radius', 0.001), ('interval', 1 / 60)]:
            value = rune.get(key)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= 100000:
                raise ValueError(f'{key}: 잘못된 룬 수치입니다.')
        if rune.get('installationSide') not in ('ally', 'enemy'):
            raise ValueError('설치 대상은 ally 또는 enemy여야 합니다.')
        if not isinstance(rune.get('color'), str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', rune['color']):
            raise ValueError('룬 색상은 6자리 HEX여야 합니다.')
        skill = catalog.get(rune.get('effectSkillId'))
        if not skill or skill.get('slot') not in ('active', 'basic') or not skill.get('actions'):
            raise ValueError('룬 발동효과 스킬이 필요합니다.')
        if any(action.get('type') not in RUNE_EFFECT_TYPES or action.get('target') not in ('self', 'ally', 'enemy') for action in skill['actions']):
            raise ValueError('룬 효과는 피해·회복·자원 감소·지속 효과 액션을 사용해야 합니다.')
    return runes
