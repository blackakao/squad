"""Exercise storage/recovery/deletion via python server.py with isolated data."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]


class StorageApiTest(unittest.TestCase):
    def test_recovery_download_and_selected_deletion(self):
        with tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-storage-api-') as temp:
            root = Path(temp)
            for name in ('server.py', 'simulation_jobs.py', 'entity_store.py', 'rune_store.py'):
                shutil.copyfile(ROOT / name, root / name)
            for name in ('data', 'js', 'balance/simulator'):
                shutil.copytree(ROOT / name, root / name)
            (root / 'docs/balance').mkdir(parents=True)
            shutil.copyfile(ROOT / 'docs/balance/BALANCE_TARGETS.md', root / 'docs/balance/BALANCE_TARGETS.md')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            def request(path='', method='GET', body=None):
                req = urllib.request.Request(f'http://127.0.0.1:{port}/api/simulations{path}',
                    data=json.dumps(body).encode() if body is not None else None, method=method,
                    headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as response:
                    return json.load(response)
            def finish(job):
                for _ in range(300):
                    result = request('/' + job['simulationId'])
                    if result['status'] not in ('RUNNING', 'CANCELLING'):
                        return result
                    time.sleep(.1)
                self.fail('Worker did not finish')
            with (root / 'server-test.log').open('w') as log:
                server = subprocess.Popen([sys.executable, 'server.py'], cwd=root,
                    env={**os.environ, 'PORT': str(port)}, stdout=log, stderr=log)
                try:
                    for _ in range(100):
                        try:
                            request()
                            break
                        except OSError:
                            time.sleep(.1)
                    focus_settings = {'count': 3, 'maxSeconds': 1, 'minSamples': 1, 'workers': 2,
                        'focus': {'characterId': 0, 'candidateLimit': 1, 'repeats': 1, 'teamSize': 3, 'varyStats': False,
                                  'varySkills': True, 'varyEquipment': True}}
                    preview_request = urllib.request.Request(f'http://127.0.0.1:{port}/api/simulation-focus-plan',
                        data=json.dumps(focus_settings).encode(), headers={'Content-Type': 'application/json'})
                    with urllib.request.urlopen(preview_request, timeout=30) as response:
                        preview = json.load(response)
                    self.assertEqual(preview['stages'], [{'teamSize': 3, 'planned': 3}])
                    self.assertEqual(preview['statAllocation'], '현재 스탯 고정')
                    focus_job = request(method='POST', body=focus_settings)
                    self.assertEqual(finish(focus_job)['status'], 'COMPLETED')
                    focus_result = request('/' + focus_job['simulationId'] + '/result')
                    self.assertEqual(focus_result['focusPlan'], preview)
                    self.assertEqual([s['completed'] for s in focus_result['focusSummary']['stages']], [3])
                    self.assertNotIn('results', focus_result)
                    self.assertTrue((root / 'balance/jobs' / focus_job['simulationId'] / 'focus-plan.json').exists())
                    focus_directory = root / 'balance/jobs' / focus_job['simulationId']
                    for name in ('result.json', 'summary.json', 'report.md'):
                        (focus_directory / name).unlink()
                    focus_meta = json.loads((focus_directory / 'job.json').read_text(encoding='utf-8'))
                    focus_meta.update(status='FAILED', error='simulated focus storage failure')
                    (focus_directory / 'job.json').write_text(json.dumps(focus_meta), encoding='utf-8')
                    subprocess.run(['node', str(root / 'balance/simulator/recover.cjs'), str(focus_directory)],
                        cwd=root, check=True, capture_output=True, timeout=30)
                    recovered_focus = request('/' + focus_job['simulationId'] + '/result')
                    self.assertEqual(recovered_focus['focusSummary'], focus_result['focusSummary'])
                    self.assertEqual(recovered_focus['focusPlan'], focus_result['focusPlan'])
                    request('/' + focus_job['simulationId'], 'DELETE')
                    job = request(method='POST', body={'count': 2, 'teamSize': 10, 'maxSeconds': 1})
                    self.assertEqual(finish(job)['status'], 'COMPLETED')
                    job_id = job['simulationId']
                    original = request('/' + job_id + '/json')
                    self.assertEqual(len(original['results']), 2)
                    directory = root / 'balance/jobs' / job_id
                    # Simulate a final-serialization failure, preserving the journal.
                    for name in ('result.json', 'summary.json', 'report.md'):
                        (directory / name).unlink()
                    meta = json.loads((directory / 'job.json').read_text(encoding='utf-8'))
                    meta.update(status='FAILED', error='simulated serialization failure')
                    (directory / 'job.json').write_text(json.dumps(meta), encoding='utf-8')
                    subprocess.run(['node', str(root / 'balance/simulator/recover.cjs'), str(directory)],
                        cwd=root, check=True, capture_output=True, timeout=30)
                    recovered = request('/' + job_id + '/json')
                    self.assertEqual(recovered['results'], original['results'])
                    self.assertEqual(recovered['summary'], original['summary'])
                    self.assertEqual(request('/' + job_id + '/result')['status'], 'COMPLETED')
                    self.assertTrue((directory / 'job.before-recovery.json').exists())
                    active = request(method='POST', body={'count': 10000, 'teamSize': 10, 'maxSeconds': 1})
                    with self.assertRaises(urllib.error.HTTPError) as caught:
                        request('/' + active['simulationId'], 'DELETE')
                    self.assertEqual(caught.exception.code, 409)
                    request('/' + active['simulationId'] + '/cancel', 'POST', {})
                    finish(active)
                    request('/' + active['simulationId'], 'DELETE')
                    self.assertTrue(directory.exists())
                    request('/' + job_id, 'DELETE')
                    self.assertFalse(directory.exists())
                    self.assertEqual(request()['jobs'], [])
                    self.assertEqual((root / 'data/characters.json').read_bytes(), (ROOT / 'data/characters.json').read_bytes())
                finally:
                    server.terminate()
                    server.wait(timeout=10)


if __name__ == '__main__':
    unittest.main()
