"""Entity files and skill references share a lock to prevent dangling references."""
import copy
import json
import math
import re
import threading
import uuid
from pathlib import Path


class EntityError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class EntityStore:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.directory = self.data_dir / "entities"
        self.lock = threading.RLock()

    def path(self, entity_id):
        if not isinstance(entity_id, str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}", entity_id):
            raise EntityError("Entity ID는 영문, 숫자, _, -로 1~80자여야 합니다.")
        # Canonical lowercase IDs also avoid case aliases on Windows.
        if entity_id != entity_id.lower() or entity_id in {"con", "prn", "aux", "nul", *[f"com{i}" for i in range(10)], *[f"lpt{i}" for i in range(10)]}:
            raise EntityError("Entity ID는 소문자를 사용하며 시스템 예약어는 사용할 수 없습니다.")
        return self.directory / f"{entity_id}.json"

    @staticmethod
    def read(path, default=None):
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else copy.deepcopy(default)

    @staticmethod
    def write(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)

    def validate(self, entity):
        if not isinstance(entity, dict):
            raise EntityError("Entity는 JSON 객체여야 합니다.")
        self.path(entity.get("entityId"))
        if not isinstance(entity.get("name"), str) or not entity["name"].strip():
            raise EntityError("Entity 이름이 필요합니다.")
        if entity.get("role") not in {"melee", "ranged", "healer", "tank", "special"}:
            raise EntityError("잘못된 역할입니다.")
        if entity.get("ai") not in {"melee", "ranged", "healer", "stationary"}:
            raise EntityError("잘못된 AI입니다.")
        if not isinstance(entity.get("tags"), list) or not all(isinstance(t, str) for t in entity["tags"]):
            raise EntityError("태그는 문자열 배열이어야 합니다.")
        if not all(isinstance(entity.get(key, ""), str) for key in ("description", "icon")):
            raise EntityError("설명과 아이콘은 문자열이어야 합니다.")
        stats = entity.get("stats", {})
        if not isinstance(stats, dict):
            raise EntityError("능력치는 객체여야 합니다.")
        for key in ("hp", "mp", "st", "atk", "magic", "defense", "resistance", "speed", "attackSpeed", "castTime", "attackRange"):
            value = stats.get(key)
            minimum = 1 if key == "hp" else 0.1 if key in {"attackSpeed", "attackRange"} else 0
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= 100000:
                raise EntityError(f"{key}: {minimum}~100000 범위의 숫자가 필요합니다.")
        return entity

    def usages(self, entity_id):
        return [{"id": s.get("id"), "name": s.get("name", "")} for s in self.read(self.data_dir / "skills.json", [])
                if any(a.get("type") == "summon_entity" and a.get("entityId") == entity_id for a in s.get("actions", []))]

    def list(self):
        with self.lock:
            self.migrate()
            return [self.read(p) for p in sorted(self.directory.glob("*.json"))]

    def get(self, entity_id):
        path = self.path(entity_id)
        if not path.exists():
            raise EntityError("Entity를 찾을 수 없습니다.", 404)
        return self.read(path)

    def save(self, entity, create=False):
        with self.lock:
            entity = copy.deepcopy(entity)
            if create and not entity.get("entityId"):
                entity["entityId"] = "entity_" + uuid.uuid4().hex[:12]
            entity.setdefault("description", "")
            entity.setdefault("icon", "")
            entity.setdefault("tags", [])
            entity.setdefault("ai", entity.get("role") if entity.get("role") in {"melee", "ranged", "healer"} else "melee")
            self.validate(entity)
            path = self.path(entity["entityId"])
            if create and path.exists():
                raise EntityError("이미 사용 중인 Entity ID입니다.", 409)
            if not create and not path.exists():
                raise EntityError("Entity를 찾을 수 없습니다.", 404)
            self.write(path, entity)
            return entity

    def delete(self, entity_id):
        with self.lock:
            self.get(entity_id)
            used = self.usages(entity_id)
            if used:
                raise EntityError(f"이 Entity는 {len(used)}개의 Skill에서 사용 중입니다.\n\n" + "\n".join("- " + s["name"] for s in used), 409)
            self.path(entity_id).unlink()

    def save_skills(self, skills):
        with self.lock:
            for skill in skills:
                for action in skill.get("actions", []):
                    if action.get("type") == "summon_entity":
                        if "summon" in action:
                            raise EntityError("소환 액션은 Entity 전체 대신 entityId를 저장해야 합니다.")
                        self.get(action.get("entityId"))
            self.write(self.data_dir / "skills.json", skills)

    def migrate(self):
        """Idempotent conversion; entity files are committed before skill references."""
        with self.lock:
            path = self.data_dir / "skills.json"
            skills = self.read(path, [])
            changed = False
            for skill in skills:
                for index, action in enumerate(skill.get("actions", [])):
                    if action.get("type") != "summon_entity" or action.get("entityId") or "summon" not in action:
                        continue
                    old = action["summon"]
                    entity_id = "legacy_" + uuid.uuid5(uuid.NAMESPACE_URL, str(skill.get("id")) + ":" + str(index)).hex[:16]
                    stats = {key: old.get(key, default) for key, default in dict(hp=100, mp=100, st=100, atk=10, magic=10, defense=0, resistance=0, speed=1, attackSpeed=1, castTime=0, attackRange=1).items()}
                    entity = dict(entityId=entity_id, name=old.get("name", "소환수"), role=old.get("role", "melee"), description="", icon="", tags=["summon"], ai="stationary" if stats["speed"] == 0 else old.get("role", "melee"), stats=stats)
                    if not self.path(entity_id).exists():
                        self.save(entity, create=True)
                    action.update(entityId=entity_id, count=old.get("count", 1), limit=old.get("limit", 3), duration=old.get("lifetime", 20))
                    del action["summon"]
                    changed = True
            if changed:
                self.write(path, skills)
