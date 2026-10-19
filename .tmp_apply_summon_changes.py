from pathlib import Path

path = Path("js/entity.js")
text = path.read_text(encoding="utf-8")
replacements = [
    ('role:"melee",ai:"melee",summonType:', 'role:"melee",ai:"melee",attackType:"physical",summonType:'),
    ('role:entity.role,ai:entity.ai,\n', 'role:entity.role,ai:entity.ai,attackType:entity.attackType === "magic" ? "magic" : "physical",\n'),
    ('      <label>AI<select name="ai">${options(ENTITY_AI)}</select></label>\n', '      <label>AI<select name="ai">${options(ENTITY_AI)}</select></label>\n      <label>공격 타입<select name="attackType"><option value="physical">물리</option><option value="magic">마법</option></select></label>\n'),
    ("  form.elements.summonType.value = entity.summonType ?? 'temporary';\n", "  form.elements.summonType.value = entity.summonType ?? 'temporary';\n  form.elements.attackType.value = entity.attackType === 'magic' ? 'magic' : 'physical';\n"),
    ('icon:form.elements.icon.value.trim(),role:form.elements.role.value,ai:form.elements.ai.value,tags:', 'icon:form.elements.icon.value.trim(),role:form.elements.role.value,ai:form.elements.ai.value,attackType:form.elements.attackType.value,tags:')
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f"missing entity fragment: {old!r}")
    text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8", newline="\n")
