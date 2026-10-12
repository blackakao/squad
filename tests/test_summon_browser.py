"""Summon lifecycle and editor checks against an isolated server.py data store."""
import importlib.util
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class SummonBrowser(unittest.TestCase):
    def test_editor_roster_lifecycle_and_cleanup(self):
        spec = importlib.util.spec_from_file_location('summon_server', ROOT / 'server.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(dir=ROOT, prefix='.tmp-summon-browser-') as temporary:
            module.DATA_DIR = Path(temporary) / 'data'
            shutil.copytree(ROOT / 'data', module.DATA_DIR)
            module.ENTITY_STORE = module.EntityStore(module.DATA_DIR)
            module.BattleHandler.log_message = lambda *args: None
            module.server_log = lambda *args: None

            class TestServer(ThreadingHTTPServer):
                request_queue_size = 64

            server = TestServer(('127.0.0.1', 0), module.BattleHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            options = webdriver.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--window-size=1440,1000')
            driver = webdriver.Chrome(options=options)
            self.addCleanup(driver.quit)
            driver.set_script_timeout(30)
            driver.execute_cdp_cmd('Network.enable', {})
            driver.execute_cdp_cmd('Network.setBlockedURLs', {'urls': ['*js.puter.com*']})
            driver.get(f'http://127.0.0.1:{server.server_port}/')
            WebDriverWait(driver, 30).until(lambda d: d.execute_script(
                "return typeof entitiesJson !== 'undefined' && entitiesJson.length && characterJson.length >= 6"))
            driver.execute_script("""
const i=skillsJson.findIndex(s=>s.actions.some(a=>a.type==='summon_entity'));
openSkillModal(i);
const row=Array.from(document.querySelectorAll('#skillActions .skill-action-row'))
  .find(r=>r.querySelector('.skill-action-entity-id')?.value);
openEntityEditor(row.querySelector('.entity-toolbar button'),true);
document.querySelector('#entityEditorForm [name=summonType]').value='persistent';
""")
            driver.find_element('css selector', '#entityEditorForm button[type=submit]').click()
            WebDriverWait(driver, 30).until(lambda d: d.execute_script(
                "return document.getElementById('entityEditorModal').classList.contains('hidden')"))
            saved = driver.execute_async_script("""
const done=arguments[0];loadEntityJson().then(()=>done(entitiesJson.some(e=>e.summonType==='persistent'))).catch(e=>done(String(e)));
""")
            self.assertIs(saved, True)
            result = driver.execute_script("""
closeSkillModal();
selectedBattleTeamIds.clear();selectedBattleCharacterIds=new Set([0,1,2]);
battleMode='team';selectedEnemyTeamIndex='';enemySquad=createSquadFromCharacterIds([3,4,5],'enemy');
prepareBattleSession({openScreen:true});
const owner=playerSquad[0], entity=entitiesJson.find(e=>e.summonType==='persistent');
const temporary={...structuredClone(entity),entityId:'browser_temporary',summonType:'temporary'};
battleEntitySnapshot.push(temporary);
const action={type:'summon_entity',target:'self',entityId:entity.entityId,count:1,limit:3,duration:0};
summonBattleUnits(owner,action,{id:'wolf'});const wolf=owner.summons[0];
summonBattleUnits(owner,{...action,entityId:temporary.entityId,count:2},{id:'spirits'});
updateStatusUI();draw();
const counts=[getBattleCharacters(playerSquad).length,getActiveBattleEntities(playerSquad).length,
document.querySelectorAll('#playerStatus .unit-status').length];
wolf.hp=0;syncAliveState(wolf);
const persistent=[owner.summons.includes(wolf),getActiveBattleEntities(playerSquad).length];
const spirit=owner.summons[1];spirit.hp=0;syncAliveState(spirit);
const removed=!playerSquad.includes(spirit)&&!owner.summons.includes(spirit);
const revived=reactivatePersistentSummon(wolf,30)&&owner.summons[0]===wolf;
updateStatusUI();draw();
const records=createBattleRecord('test');
abortBattle();
return {counts,persistent,removed,revived,records:records.playerMembers.length,
remaining:playerSquad.filter(u=>u.isSummon).length,owned:owner.summons.length};
""")
            self.assertEqual(result, dict(counts=[3, 6, 3], persistent=[True, 5], removed=True,
                                         revived=True, records=3, remaining=0, owned=0))


if __name__ == '__main__':
    unittest.main()
