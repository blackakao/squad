"""Fixed, reviewed sample batch. Dry run by default; --write appends once."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'item_gen_20261010_'
STATS = 'hp mp st atk magic speed attackSpeed castSpeed defense resistance attackRange'.split()
# Missing categories use conservative editorial baselines, not a game conversion formula.
WEAPONS = {
    'oneHandSword': ('atk', 30, '한손검'),
    'twoHandSword': ('atk', 60, '대검'),
    'oneHandMace': ('atk', 36, '철퇴'),
    'twoHandMace': ('atk', 72, '대형망치'),
    'staff': ('magic', 500, '지팡이'),
    'bow': ('atk', 151, '활'),
    'gun': ('atk', 45, '권총'),
    '방패': ('defense', 10, '방패'),
    '치유서': ('magic', 100, '치유서'),
    '주먹구': ('atk', 50, '권투장갑'),
}
ARMORS = {
    'plate': {'hp': 250, 'defense': 8, 'resistance': 2},
    'chain': {'hp': 220, 'defense': 6, 'resistance': 3},
    'leather': {'hp': 180, 'defense': 4, 'resistance': 2},
    'cloth': {'hp': 150, 'defense': 1, 'resistance': 6},
}
NAMES = ['정련', '묵직한', '호위', '결의', '수비', '경량', '인내', '명상', '순찰', '기민한']
RATIOS = [1, 1.15, .95, .94, .9, .88, .9, .9, .84, .82]
BONUSES = [
    {'st': 5}, {}, {'hp': 50}, {'st': 10}, {'resistance': 1},
    {'speed': .06}, {'st': 15}, {'mp': 15}, {'hp': 30, 'st': 8},
    {'speed': .08, 'mp': 5},
]


def read(name):
    return json.loads((ROOT / 'data' / (name + '.json')).read_text(encoding='utf-8'))


def build(categories):
    assert {(c['type'], c['key']) for c in categories} == (
        {('weapon', k) for k in WEAPONS} | {('armor', k) for k in ARMORS}
    ), 'Category catalog changed: review this dated batch before generation.'
    rows = []
    for ci, cat in enumerate(categories):
        for i, (prefix, ratio, bonuses) in enumerate(zip(NAMES, RATIOS, BONUSES)):
            weapon = cat['type'] == 'weapon'
            row = dict(id=f'{PREFIX}{ci + 1:02d}_{i + 1:02d}', name='',
                       slot=('subWeapon' if cat.get('slotType') == 'subOnly' else 'mainWeapon')
                       if weapon else ('top' if i < 5 else 'bottom'),
                       weaponCategory=cat['key'] if weapon else '',
                       handType=cat.get('handType', ''), attackType=cat.get('attackType', ''),
                       attackSkillId='skill_basic_heal' if cat['key'] == '치유서' else '',
                       armorCategory='' if weapon else cat['key'],
                       **dict.fromkeys(STATS, 0))
            if weapon:
                primary, base, noun = WEAPONS[cat['key']]
                row[primary] = round(base * ratio)
                row['name'] = f'{prefix} {noun}'
                for k in ('attackSpeed', 'castSpeed', 'attackRange'):
                    row[k] = cat[k]
                extra = dict(bonuses)
                if i == 3:
                    extra = {'atk': 4} if primary == 'defense' else {'mp': 10} if primary == 'magic' else {'st': 10}
                for k, value in extra.items():
                    row[k] += value
            else:
                row.update({k: round(v * ratio, 1) if k != 'hp' else round(v * ratio)
                            for k, v in ARMORS[cat['key']].items()})
                row['name'] = f'{prefix} {cat["label"]} {"상의" if i < 5 else "하의"}'
                extra = dict(bonuses)
                if i == 2:
                    extra = {'hp': 30}
                if i == 3:
                    extra = {'magic': 4} if cat['key'] == 'cloth' else {'atk': 3}
                if i == 4:
                    extra = {'defense': 1} if cat['key'] == 'cloth' else {'resistance': 1}
                for k, value in extra.items():
                    row[k] = round(row[k] + value, 2)
            rows.append(row)
    return rows


def validate(rows, existing, categories, skills):
    assert len(rows) == 140
    assert len({r['id'] for r in existing + rows}) == len(existing + rows), 'Duplicate ID'
    assert len({r['name'] for r in existing + rows}) == len(existing + rows), 'Duplicate name'
    skill_ids = {s['id'] for s in skills}
    for cat in categories:
        field = 'weaponCategory' if cat['type'] == 'weapon' else 'armorCategory'
        group = [r for r in rows if r[field] == cat['key']]
        assert len(group) == 10
        assert len({tuple(r[k] for k in STATS) for r in group}) == 10
    for r in rows:
        assert set(r) == set(existing[0]), 'Schema drift'
        assert all(isinstance(r[k], (int, float)) and 0 <= r[k] < float('inf') for k in STATS)
        assert not r['attackSkillId'] or r['attackSkillId'] in skill_ids


def report(rows, categories):
    labels = dict(zip(STATS, ['HP', 'MP', 'ST', '공격', '마력', '이동속도', '공격주기', '시전시간', '방어', '저항', '사거리']))
    lines = ['# 아이템 생성 기록 · 2026-10-10', '',
             '기존 6개를 보존하고 무기 10종·방어구 4종에 각 10개, 총 140개를 추가했습니다. 등록 후 146개입니다.', '',
             '실제 저장소: [items.json](../../data/items.json). 고정형이며 기존 필드만 사용합니다. '
             '장신구·특수장비는 카테고리가 아닌 슬롯으로 이번 배치에서 제외했습니다. 방어구는 각 상의 5개·하의 5개입니다.', '',
             '[생성 기준과 한계](DATA_GENERATION_RULES.md). 아래 값은 생성 배열에서 직접 산출합니다. '
             '공격주기·시전시간은 초, 방어·저항은 피해 감소율의 %p, 이동속도는 기존 단위입니다.', '',
             '## 검증', '', '검증 실행 결과는 작업 완료 시 아래에 기록합니다.', '',
             '## 카테고리별 실제 아이템', '']
    for cat in categories:
        weapon = cat['type'] == 'weapon'
        field = 'weaponCategory' if weapon else 'armorCategory'
        main_keys = [WEAPONS[cat['key']][0]] if weapon else list(ARMORS[cat['key']])
        lines += [f'### {cat["label"]} (`{cat["key"]}`) · 10개', '']
        if weapon:
            lines += [f'공통: {cat["handType"]}, {cat["slotType"]}, 사거리 {cat["attackRange"]}, '
                      f'공격주기 {cat["attackSpeed"]}초, 시전시간 {cat["castSpeed"]}초. '
                      + ('공격 스킬: `skill_basic_heal`.' if cat['key'] == '치유서' else '기본 공격 사용.'), '']
        lines += ['| 아이템 | 슬롯 | 주 능력치 | 보조 능력치 | ID |', '| --- | --- | --- | --- | --- |']
        for r in [r for r in rows if r[field] == cat['key']]:
            primary = ', '.join(f'{labels[k]} {r[k]:g}' for k in main_keys)
            extra = ', '.join(f'{labels[k]} +{r[k]:g}' for k in STATS
                              if k not in main_keys + ['attackSpeed', 'castSpeed', 'attackRange'] and r[k]) or '없음'
            lines.append(f'| {r["name"]} | {r["slot"]} | {primary} | {extra} | `{r["id"]}` |')
        lines.append('')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'data/items.json'
    original = target.read_bytes()
    existing = json.loads(original)
    categories = read('categories')
    rows = build(categories)
    validate(rows, existing, categories, read('skills'))
    if args.write:
        log = ROOT / 'docs/data-generation/DATA_GENERATION_LOG.md'
        assert not log.exists(), 'Batch report exists; do not overwrite history.'
        assert target.read_bytes() == original, 'Items changed during generation.'
        # Append without reformatting any existing item bytes.
        end = original.rfind(b']')
        newline = b'\r\n' if b'\r\n' in original else b'\n'
        addition = json.dumps(rows, ensure_ascii=False, indent=2)[2:-2].encode('utf-8').replace(b'\n', newline)
        target.write_bytes(original[:end].rstrip() + b',' + newline + addition + newline + original[end:])
        assert json.loads(target.read_bytes()) == existing + rows
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_text(report(rows, categories), encoding='utf-8')
    print(f'Validated {len(rows)} new items / {len(categories)} categories; write={args.write}')


if __name__ == '__main__':
    main()
