"""Check saved synergy definitions through the real Python Job -> Node worker."""
import json
import unittest
import test_simulation_jobs as harness


class SynergyJobTests(unittest.TestCase):
    setUp = harness.SimulationJobTests.setUp
    tearDown = harness.SimulationJobTests.tearDown
    manager = harness.SimulationJobTests.manager
    finish = harness.SimulationJobTests.finish

    def test_job_snapshots_and_applies_saved_synergy(self):
        file = self.folder / 'data/characters.json'
        characters = json.loads(file.read_text(encoding='utf-8'))
        faction = characters[0]['faction']
        for character in characters:
            character['faction'] = faction
        file.write_text(json.dumps(characters), encoding='utf-8')
        definitions = [{'id':'job-fixture', 'name':'Job fixture', 'condition':{'type':'faction','value':faction},
                        'stacking':'highest','thresholds':[{'count':1,'effects':[{'type':'stat','stat':'vit','value':5,'target':'team'}]}]}]
        (self.folder/'data/synergies.json').write_text(json.dumps(definitions), encoding='utf-8')
        job = self.jobs.start({'count':2, 'teamSize':1, 'maxSeconds':1})
        self.assertEqual(self.finish(job['simulationId'])['status'], 'COMPLETED')
        raw = json.loads(self.jobs.file(job['simulationId'], 'json').read_text(encoding='utf-8'))
        self.assertEqual(raw['inputSnapshot']['synergies'], definitions)
        for battle in raw['results']:
            for side in ['player','enemy']:
                self.assertEqual(battle['activeSynergies'][side][0]['id'],'job-fixture')


if __name__ == '__main__':
    unittest.main()
