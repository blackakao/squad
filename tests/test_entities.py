import copy
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from entity_store import EntityStore, EntityError
import server


def entity(entity_id="wolf"):
    return dict(entityId=entity_id, name="늑대", description="야수", icon="", role="melee", ai="melee", tags=["beast"],
                stats=dict(hp=500, mp=100, st=100, atk=80, magic=0, defense=25, resistance=10, speed=4.5, attackRange=1.5, attackSpeed=1.2, castTime=0))


class EntityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = EntityStore(self.temp.name)

    def test_shared_edits_copy_and_delete_integrity(self):
        self.store.save(entity(), create=True)
        skills = [dict(id=f"skill_{i}", name=f"소환 {i}", actions=[dict(type="summon_entity", entityId="wolf", count=1, duration=20)]) for i in range(3)]
        self.store.save_skills(skills)
        changed = entity()
        changed["stats"]["atk"] = 200
        self.store.save(changed)
        self.assertEqual(len(self.store.usages("wolf")), 3)
        with self.assertRaisesRegex(EntityError, "3개의 Skill"):
            self.store.delete("wolf")
        clone = copy.deepcopy(changed)
        clone["entityId"] = "wolf_copy"
        self.store.save(clone, create=True)
        clone["stats"]["atk"] = 1
        self.store.save(clone)
        self.assertEqual(self.store.get("wolf")["stats"]["atk"], 200)
        self.store.delete("wolf_copy")
        with self.assertRaises(EntityError):
            self.store.save_skills([dict(actions=[dict(type="summon_entity", entityId="wolf_copy")])])
        self.assertEqual(len(self.store.usages("wolf")), 3)

    def test_validation_and_create_collision(self):
        for bad in ("../wolf", "Wolf", "con", "a/b", "", "x" * 81):
            with self.assertRaises(EntityError):
                self.store.path(bad)
        self.store.save(entity(), create=True)
        with self.assertRaises(EntityError):
            self.store.save(entity(), create=True)
        for bad in (-1, float("inf"), True):
            value = entity()
            value["stats"]["hp"] = bad
            with self.assertRaises(EntityError):
                self.store.save(value)
        auto = entity()
        auto["entityId"] = ""
        self.assertTrue(self.store.save(auto, create=True)["entityId"].startswith("entity_"))

    def test_migration_idempotent_and_preserves_tuning(self):
        skills = [dict(id="old", name="기존", castTime=0, actions=[dict(type="summon_entity", summon=dict(name="노포", hp=321, speed=0, role="ranged", count=2, limit=4, lifetime=30))])]
        self.store.write(self.store.data_dir / "skills.json", skills)
        self.store.migrate()
        saved = self.store.read(self.store.data_dir / "skills.json")
        action = saved[0]["actions"][0]
        self.assertNotIn("summon", action)
        self.assertEqual(action["count"], 2)
        self.assertEqual(action["duration"], 30)
        definition = self.store.get(action["entityId"])
        self.assertEqual(definition["stats"]["hp"], 321)
        self.assertEqual(definition["ai"], "stationary")
        self.store.migrate()
        self.assertEqual(len(self.store.list()), 1)
        self.assertEqual(saved, self.store.read(self.store.data_dir / "skills.json"))

    def test_concurrent_delete_and_skill_save_never_dangle(self):
        self.store.save(entity(), create=True)
        barrier = threading.Barrier(2)
        def operation(delete):
            barrier.wait()
            try:
                if delete:
                    self.store.delete("wolf")
                else:
                    self.store.save_skills([dict(id="s", actions=[dict(type="summon_entity", entityId="wolf")])])
            except EntityError:
                pass
        threads = [threading.Thread(target=operation, args=(value,)) for value in (True, False)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertFalse(self.store.usages("wolf") and not self.store.path("wolf").exists())

    def test_http_crud_and_skill_write(self):
        old_dir, old_store = server.DATA_DIR, server.ENTITY_STORE
        server.DATA_DIR, server.ENTITY_STORE = Path(self.temp.name), self.store
        http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BattleHandler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        def request(path, method="GET", body=None):
            req = urllib.request.Request(f"http://127.0.0.1:{http.server_port}/api/{path}", method=method,
                                         data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req) as response:
                    return response.status, json.load(response)
            except urllib.error.HTTPError as error:
                return error.code, json.load(error)
        try:
            self.assertEqual(request("entities/", "POST", entity())[0], 200)
            self.assertEqual(request("entities/wolf.json")[1]["name"], "늑대")
            self.assertEqual(request("entities/")[1][0]["entityId"], "wolf")
            skill = dict(id="s", name="야수", actions=[dict(type="summon_entity", entityId="wolf")])
            self.assertEqual(request("skills", "PUT", [skill])[0], 200)
            self.assertEqual(len(request("entities/wolf/usages")[1]), 1)
            self.assertEqual(request("entities/wolf", "DELETE")[0], 409)
            self.assertEqual(request("skills", "PUT", [dict(actions=[dict(type="summon_entity", entityId="missing")])])[0], 400)
            self.assertEqual(request("skills", "PUT", [dict(actions=[dict(type="summon_entity", summon={})])])[0], 400)
            changed = entity()
            changed["stats"]["atk"] = 99
            self.assertEqual(request("entities/wolf", "PUT", changed)[0], 200)
            self.assertEqual(self.store.get("wolf")["stats"]["atk"], 99)
            self.assertEqual(request("skills", "PUT", [])[0], 200)
            self.assertEqual(request("entities/wolf", "DELETE")[0], 200)
            self.assertEqual(request("entities/wolf")[0], 404)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()
            server.DATA_DIR, server.ENTITY_STORE = old_dir, old_store


if __name__ == "__main__":
    unittest.main()
