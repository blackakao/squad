"""Exercise the real Node worker with isolated files and a short battle limit."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from simulation_jobs import SimulationJobs, SimulationError, parse_targets


class SimulationJobTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-jobs-')
        self.folder = Path(self.temp.name)
        shutil.copytree(ROOT / 'data', self.folder / 'data')
        self.targets = self.folder / 'targets.md'
        shutil.copyfile(ROOT / 'docs/balance/BALANCE_TARGETS.md', self.targets)
        self.jobs = self.manager()

    def manager(self):
        return SimulationJobs(ROOT, self.folder / 'data', self.folder / 'jobs', self.targets, self.folder / 'legacy')

    def tearDown(self):
        self.jobs.close()
        deadline = time.monotonic() + 20
        while self.jobs.process and time.monotonic() < deadline:
            time.sleep(.05)
        self.temp.cleanup()

    def finish(self, job_id):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            job = self.jobs.get(job_id)
            if job['status'] not in ('RUNNING', 'CANCELLING'):
                return job
            time.sleep(.05)
        self.fail('worker did not finish')

    def test_real_worker_persists_summary_and_history_across_restart(self):
        original = (self.folder / 'data/characters.json').read_bytes()
        job = self.jobs.start({'count': 3, 'teamSize': 1, 'maxSeconds': 1})
        done = self.finish(job['simulationId'])
        self.assertEqual((done['status'], done['completed']), ('COMPLETED', 3))
        result = self.jobs.result(job['simulationId'])
        self.assertEqual(result['summary']['timeouts'], 3)
        self.assertNotIn('inputSnapshot', result)
        raw = json.loads(self.jobs.file(job['simulationId'], 'json').read_text(encoding='utf-8'))
        self.assertEqual(len(raw['results']), 3)
        self.assertEqual(self.manager().result(job['simulationId']), result)
        self.assertEqual((self.folder / 'data/characters.json').read_bytes(), original)

    def test_duplicate_requests_and_cancel_preserve_finished_battles(self):
        def start():
            try:
                return self.jobs.start({'count': 10000, 'maxSeconds': 1})
            except SimulationError as exc:
                return exc.status
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: start(), range(2)))
        self.assertIn(409, results)
        job = next(value for value in results if isinstance(value, dict))
        deadline = time.monotonic() + 10
        while not self.jobs.get(job['simulationId'])['completed'] and time.monotonic() < deadline:
            time.sleep(.05)
        self.jobs.cancel(job['simulationId'])
        done = self.finish(job['simulationId'])
        self.assertEqual(done['status'], 'CANCELLED')
        self.assertGreater(done['completed'], 0)
        self.assertLess(done['completed'], 10000)
        self.assertEqual(self.jobs.result(job['simulationId'])['summary']['battles'], done['completed'])

    def test_targets_single_source_validation_and_snapshot(self):
        targets = self.jobs.targets()['targets']
        targets['winRate'] = [45, 55]
        self.jobs.targets(targets)
        self.assertEqual(parse_targets(self.targets.read_text(encoding='utf-8'))['winRate'], [45, 55])
        job = self.jobs.start({'count': 1, 'maxSeconds': 1})
        targets['winRate'] = [None, None]
        self.jobs.targets(targets)
        self.finish(job['simulationId'])
        self.assertEqual(self.jobs.result(job['simulationId'])['targets']['winRate'], [45, 55])
        for value in ([90, 20], [0, 101], [False, 3], [float('nan'), None]):
            targets['winRate'] = value
            with self.assertRaises(SimulationError):
                self.jobs.targets(targets)

    def test_failures_invalid_input_missing_node_and_unknown_paths(self):
        for value in ({'count': 0}, {'count': True}, {'teamSize': 4}, {'seed': -1}, []):
            with self.assertRaises(SimulationError):
                self.jobs.start(value)
        with patch('simulation_jobs.shutil.which', return_value=None):
            with self.assertRaises(SimulationError) as caught:
                self.jobs.start({})
            self.assertEqual(caught.exception.status, 503)
        with self.assertRaises(SimulationError):
            self.jobs.file('../server.py', 'json')
        self.jobs.root = self.folder  # Real Node exits because the worker is absent.
        job = self.jobs.start({'count': 1})
        done = self.finish(job['simulationId'])
        self.assertEqual(done['status'], 'FAILED')
        self.assertTrue(done['finishedAt'])
        self.assertIn('MODULE_NOT_FOUND', self.jobs.file(job['simulationId'], 'log').read_text(encoding='utf-8'))

    def test_recovery_marks_interrupted_job_failed_and_preserves_journal(self):
        directory = self.folder / 'jobs/simulation_interrupted'
        directory.mkdir()
        (directory / 'job.json').write_text(json.dumps({'simulationId': directory.name,
            'status': 'RUNNING', 'startedAt': '2026-10-11', 'completed': 0}), encoding='utf-8')
        (directory / 'battles.ndjson').write_text('{"battleId":"battle-1"}\n', encoding='utf-8')
        job = self.manager().get(directory.name)
        self.assertEqual((job['status'], job['completed']), ('FAILED', 1))


if __name__ == '__main__':
    unittest.main()
