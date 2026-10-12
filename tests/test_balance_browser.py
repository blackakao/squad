"""Compare the real browser gameLoop (including drawing) with Node headless ticks.

Uses server.py against a temporary copy; never writes game data or battle records.
Requires the existing Selenium/Chrome test environment.
"""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class BalanceBrowser(unittest.TestCase):
    def test_real_game_loop_matches_headless_events(self):
        spec = importlib.util.spec_from_file_location('balance_test_server', ROOT / 'server.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-balance-') as temporary:
            data_dir = Path(temporary) / 'data'
            shutil.copytree(ROOT / 'data', data_dir)
            module.DATA_DIR = data_dir
            module.ENTITY_STORE = module.EntityStore(data_dir)
            module.BattleHandler.log_message = lambda *args: None
            module.server_log = lambda *args: None

            class TestServer(ThreadingHTTPServer):
                request_queue_size = 64

            server = TestServer(('127.0.0.1', 0), module.BattleHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            options = webdriver.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--window-size=1440,1000')
            driver = webdriver.Chrome(options=options)
            self.addCleanup(driver.quit)
            driver.set_script_timeout(120)
            # Suppress automatic app initialization; initialize from precisely the
            # same read-only snapshot as Node, then run the actual browser scheduler.
            driver.execute_cdp_cmd('Network.enable', {})
            driver.execute_cdp_cmd('Network.setBlockedURLs', {'urls': [
                '*js/main.js*', '*js.puter.com*', '*cdn.jsdelivr.net*']})
            driver.get(f'http://127.0.0.1:{server.server_port}/')
            WebDriverWait(driver, 30).until(lambda d: d.execute_script(
                "return typeof gameLoop === 'function' && typeof PortraitCatalog !== 'undefined'"))
            fixtures = json.loads(subprocess.check_output([
                'node', '-e', """
const {loadData,createEngine,seededRandom}=require('./balance/simulator/engine.cjs');
const data=loadData(), engine=createEngine(data);
const configs=[
  {teamA:[0],teamB:[1],seed:12345,maxSeconds:120},
  {teamA:[0,3,4],teamB:[1,7,8],seed:42,maxSeconds:120},
  {teamA:[2,5],teamB:[6,8],seed:91,maxSeconds:120}
];
console.log(JSON.stringify({data,randomSource:seededRandom.toString(),
  cases:configs.map(config=>({config,result:engine.runBattle({...config,trace:true})}))}));
"""], cwd=ROOT, encoding='utf-8'))
            for case in fixtures['cases']:
                with self.subTest(config=case['config']):
                    actual = driver.execute_script("""
const data=arguments[0], config=arguments[1];
const randomFactory=eval('('+arguments[2]+')');
const originalRandom=Math.random, originalNow=Date.now, originalTimeout=window.setTimeout;
let virtualTime=1700000000000;
Math.random=randomFactory(config.seed);
Date.now=()=>virtualTime;
window.setTimeout=()=>{};
const events=[];
const unsubscribe=subscribeBattleEvent('*',event=>events.push(JSON.parse(JSON.stringify(event))));
try {
  canvas.width=400;canvas.height=300;
  categoriesJson=normalizeCategoryJson(data.categories);
  itemsJson=normalizeItemJson(data.items);
  factionsJson=normalizeFactionJson(data.factions);
  entitiesJson=structuredClone(data.entities);
  skillsJson=normalizeSkillJson(data.skills);
  characterJson=normalizeCombatJson(data.characters,[],'name');
  teamsJson=normalizeTeamJson(data.teams);
  nextSummonId=1;nextEffectCasterId=1;actionTargetCooldowns=new WeakMap();
  selectedBattleTeamIds.clear();selectedBattleCharacterIds=new Set(config.teamA);
  selectedEnemyTeamIndex='';battleMode='team';gameSpeed=1;
  enemySquad=createSquadFromCharacterIds(config.teamB,'enemy');
  let winner=null;
  battleResultSink=result=>{winner=result;};
  if (!prepareBattleSession({openScreen:false})) throw new Error('Preparation failed');
  let ticks=0;
  while(isBattleRunning && ticks<Math.ceil(config.maxSeconds*60)) {
    virtualTime=1700000000000+(++ticks*1000/60);
    // Control one scheduler interval, retaining the real draw/status functions.
    lastGameLoopAt=performance.now();
    gameLoop();
  }
  return {ticks,winner,events,contributions:[...playerSquad,...enemySquad].filter(u=>!u.isSummon).map(u=>getBattleContribution(u,ticks/60))};
} finally {
  unsubscribe();isBattleRunning=false;battleResultSink=null;
  Math.random=originalRandom;Date.now=originalNow;window.setTimeout=originalTimeout;
}
""", fixtures['data'], case['config'], fixtures['randomSource'])
                    expected = case['result']
                    for actual_contribution, character in zip(actual['contributions'], expected['characters']):
                        self.assertAlmostEqual(actual_contribution['total']['damageDealt'], character['damageDealt'], places=7)
                        self.assertAlmostEqual(actual_contribution['total']['healingDone'], character['healingDone'], places=7)
                    self.assertEqual(actual['ticks'], expected['ticks'])
                    self.assertEqual(actual['winner'], {'A': '승리', 'B': '패배', None: None}[expected['winner']])
                    # Compare every skill/damage/heal/death event, not just winner.
                    self.assertEqual(len(actual['events']), len(expected['events']))
                    for browser_event, node_event in zip(actual['events'], expected['events']):
                        for key in ['amount', 'hpDamage', 'barrierDamage']:
                            self.assertAlmostEqual(browser_event.pop(key), node_event.pop(key), places=7)
                        self.assertEqual(browser_event, node_event)
            self.assertEqual(
                (data_dir / 'battle-records.json').read_bytes(),
                (ROOT / 'data/battle-records.json').read_bytes())
            # The optional sink must not alter the normal UI/API completion path.
            saved = driver.execute_async_script("""
const done=arguments[arguments.length-1];
battleResultSink=null;battleRecordsJson=[];
battleStartedAt=Date.now()-1000;lastResourceUpdateAt=Date.now();
finishBattle(lastResolvedBattleResult).then(()=>done(battleRecordsJson.length))
  .catch(error=>done({error:String(error)}));
""")
            self.assertEqual(saved, 1)
            self.assertEqual(len(json.loads((data_dir / 'battle-records.json').read_text(encoding='utf-8'))), 1)


if __name__ == '__main__':
    unittest.main()
