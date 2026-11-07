import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rune_store import validate_runes
from entity_store import EntityStore, EntityError
from simulation_jobs import SimulationJobs


class RuneTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1] / 'data'
        self.runes = json.loads((root / 'runes.json').read_text(encoding='utf-8'))
        self.skills = json.loads((root / 'skills.json').read_text(encoding='utf-8'))

    def test_registered_definitions_and_extension(self):
        self.assertEqual(len(validate_runes(self.runes, self.skills)), 4)
        new = dict(self.runes[0], id='future_rune', name='Future')
        self.assertEqual(len(validate_runes(self.runes + [new], self.skills)), 5)

    def test_simulation_snapshot_includes_registry(self):
        root = Path(__file__).resolve().parents[1]
        jobs = object.__new__(SimulationJobs)
        jobs.data_dir = root / 'data'
        self.assertEqual(jobs._snapshot()['runes'], self.runes)

    def test_invalid_numbers_duplicate_ids_and_effect_references(self):
        for key, invalid in [('radius', 0), ('radius', True), ('interval', float('inf')),
                             ('interval', 0), ('installationSide', 'other'), ('color', 'red'),
                             ('effectSkillId', 'missing')]:
            data = copy.deepcopy(self.runes)
            data[0][key] = invalid
            with self.assertRaises(ValueError):
                validate_runes(data, self.skills)
        with self.assertRaises(ValueError):
            validate_runes(self.runes + [self.runes[0]], self.skills)

    def test_skill_save_protects_linked_effects(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'runes.json').write_text(json.dumps(self.runes), encoding='utf-8')
            store = EntityStore(directory)
            effects = [skill for skill in self.skills if skill['id'].startswith('skill_rune_effect_')]
            store.save_skills(effects)
            with self.assertRaises(ValueError):
                store.save_skills(effects[1:])
            self.assertEqual(len(json.loads((path / 'skills.json').read_text(encoding='utf-8'))), 4)


if __name__ == '__main__':
    unittest.main()
