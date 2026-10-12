"""Real Chrome -> HTTP job -> real engine, including 100/1000 battle runs.

Game data and targets are copied. Evidence is retained in balance/ui-validation.
"""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select

ROOT = Path(__file__).resolve().parents[1]
SAVED_RUNS = '--saved-runs' in sys.argv
if SAVED_RUNS:
    sys.argv.remove('--saved-runs')
sys.path.insert(0, str(ROOT))
from simulation_jobs import SimulationJobs


class SimulationUI(unittest.TestCase):
    maxDiff = None
    def test_full_user_workflow(self):
        spec = importlib.util.spec_from_file_location('simulation_test_server', ROOT / 'server.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        evidence = ROOT / 'balance/ui-validation'
        evidence.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-simulation-ui-') as temporary:
            folder = Path(temporary)
            shutil.copytree(ROOT / 'data', folder / 'data')
            shutil.copyfile(ROOT / 'docs/balance/BALANCE_TARGETS.md', folder / 'targets.md')
            module.DATA_DIR = folder / 'data'
            module.ENTITY_STORE = module.EntityStore(module.DATA_DIR)
            module.IMAGE_SETTINGS_PATH = module.DATA_DIR / 'image-generator-settings.json'
            if SAVED_RUNS:
                for previous in evidence.glob('simulation_*/job.json'):
                    shutil.copytree(previous.parent, folder / 'jobs' / previous.parent.name)
            jobs = SimulationJobs(ROOT, module.DATA_DIR, folder / 'jobs', folder / 'targets.md')
            module.SIMULATION_JOBS = jobs
            module.server_log = lambda *args: None
            module.BattleHandler.log_message = lambda *args: None

            class TestServer(ThreadingHTTPServer):
                request_queue_size = 64

            server = TestServer(('127.0.0.1', 0), module.BattleHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            options = webdriver.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--window-size=1440,1100')
            driver = None
            try:
                driver = webdriver.Chrome(options=options)
                driver.execute_cdp_cmd('Network.enable', {})
                driver.execute_cdp_cmd('Network.setBlockedURLs', {'urls': ['*js.puter.com*', '*cdn.jsdelivr.net*']})
                driver.get(f'http://127.0.0.1:{server.server_port}/')
                wait = WebDriverWait(driver, 30)
                wait.until(lambda d: d.execute_script("return typeof SimulationPage !== 'undefined' && characterJson.length > 0"))
                driver.find_element(By.CSS_SELECTOR, '.nav button[onclick="showPage(\'simulation\')"]').click()
                wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '#simulationTargetRows input'))
                self.assertFalse(driver.find_element(By.ID, 'simulationError').text)

                completed = sorted([job for job in jobs.jobs.values() if job['status'] == 'COMPLETED'], key=lambda job: job['total']) if SAVED_RUNS else []
                for count in (() if SAVED_RUNS else (100, 1000)):
                    Select(driver.find_element(By.ID, 'simulationPreset')).select_by_value(str(count))
                    driver.find_element(By.ID, 'simulationStart').click()
                    wait.until(lambda d: jobs.list()['activeId'])
                    job_id = jobs.list()['activeId']
                    self.assertFalse(driver.find_element(By.ID, 'simulationStart').is_enabled())
                    wait.until(lambda d: jobs.get(job_id)['completed'] > 0)
                    first = jobs.get(job_id)['completed']
                    # Backend guards independent clients as well as the disabled button.
                    status = driver.execute_async_script("""
const done=arguments[0];fetch('/api/simulations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>done(r.status));
""")
                    self.assertEqual(status, 409)
                    driver.find_element(By.CSS_SELECTOR, '.nav button[onclick="showPage(\'log\')"]').click()
                    self.assertTrue(driver.find_element(By.ID, 'logPage').is_displayed())
                    driver.find_element(By.CSS_SELECTOR, '.nav button[onclick="showPage(\'simulation\')"]').click()
                    driver.refresh()
                    wait.until(lambda d: d.execute_script("return typeof SimulationPage !== 'undefined'"))
                    driver.find_element(By.CSS_SELECTOR, '.nav button[onclick="showPage(\'simulation\')"]').click()
                    wait.until(lambda d: d.find_element(By.ID, 'simulationProgress').get_attribute('data-status') == 'RUNNING')
                    self.assertEqual(jobs.list()['activeId'], job_id)
                    self.assertGreaterEqual(jobs.get(job_id)['completed'], first)
                    start = time.monotonic()
                    while jobs.get(job_id)['status'] in ('RUNNING', 'CANCELLING'):
                        self.assertLess(time.monotonic() - start, 1200)
                        time.sleep(1)
                    done = jobs.get(job_id)
                    self.assertEqual(done['status'], 'COMPLETED', done)
                    self.assertEqual(done['completed'], count)
                    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '#simulationCharacterRows tr')) > 0)
                    self.assertIn(f'{count:,}', driver.find_element(By.ID, 'simulationResult').text)
                    driver.find_element(By.CSS_SELECTOR, '#simulationResult [data-rank="dps"]').click()
                    dps = [float(row.find_elements(By.TAG_NAME, 'td')[6].text.replace(',', ''))
                           for row in driver.find_elements(By.CSS_SELECTOR, '#simulationCharacterRows tr')]
                    self.assertEqual(dps, sorted(dps, reverse=True))
                    driver.find_element(By.CSS_SELECTOR, '#simulationResult [data-sort="winRate"]').click()
                    rates = [float(row.find_elements(By.TAG_NAME, 'td')[5].text.replace('%', '').replace(',', ''))
                             for row in driver.find_elements(By.CSS_SELECTOR, '#simulationCharacterRows tr')]
                    self.assertEqual(rates, sorted(rates, reverse=True))
                    driver.find_element(By.CSS_SELECTOR, '#simulationResult [data-sort="winRate"]').click()
                    rates2 = [float(row.find_elements(By.TAG_NAME, 'td')[5].text.replace('%', '').replace(',', ''))
                              for row in driver.find_elements(By.CSS_SELECTOR, '#simulationCharacterRows tr')]
                    self.assertEqual(rates2, sorted(rates))
                    driver.save_screenshot(str(evidence / f'completed-{count}.png'))
                    shutil.copytree(folder / 'jobs' / job_id, evidence / job_id)
                    completed.append(done)
                    print(f'UI {count}: {done["elapsedSeconds"]:.3f}s; average battle {done["averageDuration"]:.3f}s', flush=True)

                # Reopen 100-run statistics without creating another worker.
                before = len(jobs.jobs)
                driver.find_element(By.CSS_SELECTOR, f'[data-job="{completed[0]["simulationId"]}"]').click()
                wait.until(lambda d: '100 / 100회' in d.find_element(By.ID, 'simulationResult').text)
                self.assertEqual(len(jobs.jobs), before)
                self.assertIsNone(jobs.process)
                driver.execute_script('window.scrollTo(0,0)')
                driver.save_screenshot(str(evidence / 'dashboard-final.png'))
                driver.set_window_size(640, 1000)
                self.assertTrue(driver.execute_script('return document.documentElement.scrollWidth <= innerWidth'))
                driver.save_screenshot(str(evidence / 'mobile.png'))
                driver.set_window_size(1440, 1100)

                # Cancel a real long run after at least one completed battle.
                Select(driver.find_element(By.ID, 'simulationPreset')).select_by_value('10000')
                driver.find_element(By.ID, 'simulationStart').click()
                wait.until(lambda d: jobs.list()['activeId'])
                cancelled_id = jobs.list()['activeId']
                wait.until(lambda d: jobs.get(cancelled_id)['completed'] > 0)
                driver.find_element(By.ID, 'simulationCancel').click()
                wait.until(lambda d: jobs.get(cancelled_id)['status'] == 'CANCELLED')
                wait.until(lambda d: '중단됨' in d.find_element(By.ID, 'simulationResult').text)
                cancelled = jobs.get(cancelled_id)
                self.assertGreater(cancelled['completed'], 0)
                self.assertEqual(jobs.result(cancelled_id)['summary']['battles'], cancelled['completed'])

                # Edit the sole target document through the page, then refresh it.
                driver.find_element(By.CSS_SELECTOR, '#simulationTargets summary').click()
                fields = driver.find_elements(By.CSS_SELECTOR, '[data-metric="winRate"] input')
                for field, value in zip(fields, ('40', '60')):
                    field.clear(); field.send_keys(value)
                driver.find_element(By.CSS_SELECTOR, '#simulationTargets button[type="submit"]').click()
                wait.until(lambda d: '저장했습니다' in d.find_element(By.ID, 'simulationTargetStatus').text)
                self.assertEqual(jobs.targets()['targets']['winRate'], [40, 60])
                self.assertEqual(jobs.result(completed[0]['simulationId'])['targets']['winRate'], [None, None])

                # A real child-process failure must be visible and release the start button.
                jobs.root = folder
                Select(driver.find_element(By.ID, 'simulationPreset')).select_by_value('100')
                driver.find_element(By.ID, 'simulationStart').click()
                wait.until(lambda d: any(j['status'] == 'FAILED' for j in jobs.jobs.values()))
                wait.until(lambda d: '개발 로그' in d.find_element(By.ID, 'simulationResult').text)
                self.assertTrue(driver.find_element(By.ID, 'simulationStart').is_enabled())
                driver.save_screenshot(str(evidence / 'failed.png'))
                jobs.root = ROOT
                severe = [item for item in driver.get_log('browser') if item['level'] == 'SEVERE'
                          and 'net::ERR_BLOCKED_BY_CLIENT' not in item['message']
                          and '409 (Conflict)' not in item['message'] and '404 (Not Found)' not in item['message']
                          and '/favicon.ico' not in item['message']]
                self.assertEqual(severe, [])
                (evidence / 'validation.json').write_text(json.dumps({'completed': completed,
                    'cancelled': cancelled, 'checks': ['progress', 'navigation', 'refresh', 'duplicate 409',
                    'numeric sorts', 'history', '640px overflow', 'cancel partial', 'target snapshot', 'worker failure']},
                    ensure_ascii=False, indent=2), encoding='utf-8')
            finally:
                if driver:
                    driver.quit()
                jobs.close()
                deadline = time.monotonic() + 30
                while jobs.process and time.monotonic() < deadline:
                    time.sleep(.1)
                server.shutdown()
                server.server_close()


if __name__ == '__main__':
    unittest.main()
