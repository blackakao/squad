"""Real browser + Python API checks using an isolated data/image directory."""
import importlib.util
import json
import os
import shutil
import tempfile
import threading
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]


class IconBackgroundBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("icon_test_server", ROOT / "server.py")
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.temp = tempfile.TemporaryDirectory(prefix="icon-background-test-")
        root = Path(cls.temp.name)
        (root / "data").mkdir()
        (root / "js").mkdir()
        (root / "css").mkdir()
        icons = root / "assets/images/icons"
        icons.mkdir(parents=True)
        cls.module.ROOT = root
        cls.module.DATA_DIR = root / "data"
        cls.module.ASSET_IMAGE_DIRS = {"icons": icons}
        for name in ["api", "icon-background", "icons"]:
            shutil.copyfile(ROOT / f"js/{name}.js", root / f"js/{name}.js")
        shutil.copyfile(ROOT / "css/style.css", root / "css/style.css")
        cls.mappings = []
        for key, name in [("tank", "role-tank-20261005225208415794.png"), ("melee", "weapon-onehandsword-20261005233551760994.png")]:
            shutil.copyfile(ROOT / "assets/images/icons" / name, icons / name)
            cls.mappings.append({"group": "role", "key": key, "label": key, "icon": f"assets/images/icons/{name}"})
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        form = html[html.index('<div id="iconPage"'):html.index('<div id="root"')].replace('class="page hidden"', 'class="page"')
        setup = '''<script>
        const API_URLS = {iconMappings:'/api/icon-mappings'};
        const ROLES=['tank','melee']; const getRoleLabel = key => key;
        const EQUIPMENT_SLOTS=[], SKILL_SLOT_OPTIONS=[], factionsJson=[];
        const getWeaponCategories=()=>[], getArmorCategories=()=>[];
        const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const log=()=>{},logWarn=()=>{},logError=()=>{};
        </script><script src="js/api.js"></script><script src="js/icon-background.js"></script><script src="js/icons.js"></script>
        <script>loadIconMappings().then(renderIconPage);</script>'''
        (root / "index.html").write_text('<meta charset="utf-8"><link rel="stylesheet" href="css/style.css">' + form + setup, encoding="utf-8")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.module.BattleHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        options = webdriver.ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1400,1000")
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 15)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/"

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.temp.cleanup()

    def setUp(self):
        (Path(self.temp.name) / "data/icon-mappings.json").write_text(json.dumps(self.mappings), encoding="utf-8")
        self.driver.get(self.url)
        self.wait.until(lambda d: d.execute_script("return typeof iconMappingsReady !== 'undefined' && iconMappingsReady && document.querySelector('#iconMappingRows img') !== null"))

    def test_existing_icons_have_transparent_corners_and_visible_subjects(self):
        self.wait.until(lambda d: d.execute_script("return [...document.querySelectorAll('#iconMappingRows img')].every(i=>!i.hasAttribute('data-icon-background') && !i.hasAttribute('data-icon-processing') && i.complete && i.naturalWidth>0)"))
        results = self.driver.execute_script('''return [...document.querySelectorAll('#iconMappingRows img')].map(img=>{
          const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
          const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;
          let transparent=0,opaque=0;for(let i=3;i<p.length;i+=4){if(p[i]===0)transparent++;if(p[i]===255)opaque++;}
          return {corner:p[3],transparent,opaque};});''')
        for result in results:
            self.assertEqual(result["corner"], 0)
            self.assertGreater(result["transparent"], 1000)
            self.assertGreater(result["opaque"], 1000)
        if os.environ.get("ICON_TEST_SCREENSHOT"):
            self.driver.execute_script('''const gallery=document.createElement('div');gallery.style='display:flex;gap:20px;background:#667788;padding:20px';
              document.querySelectorAll('#iconMappingRows img').forEach(img=>{const copy=img.cloneNode();copy.style='width:180px;height:180px';gallery.append(copy);});document.body.prepend(gallery);''')
            self.driver.save_screenshot(os.environ["ICON_TEST_SCREENSHOT"])

    def test_options_save_and_reload_without_changing_original_image(self):
        original = (Path(self.temp.name) / self.mappings[0]["icon"]).read_bytes()
        self.driver.execute_script("const f=document.getElementById('iconMappingForm');f.elements.removeBackground.checked=false;f.elements.backgroundTolerance.value=26;f.requestSubmit();")
        self.wait.until(lambda d: d.find_element(By.ID, "iconMappingStatus").text == "저장했습니다.")
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return typeof iconMappingsReady !== 'undefined' && iconMappingsReady"))
        row = self.driver.execute_script("return iconMappings.find(r=>r.key==='tank')")
        self.assertFalse(row["removeBackground"])
        self.assertEqual(row["backgroundTolerance"], 26)
        self.assertEqual((Path(self.temp.name) / row["icon"]).read_bytes(), original)
        self.assertNotIn("data:image", self.driver.find_element(By.CSS_SELECTOR, '#iconMappingRows [data-icon-key="tank"] img').get_attribute("src"))

    def test_uploaded_file_preview_and_application_use_same_processing(self):
        source = Path(self.temp.name) / self.mappings[1]["icon"]
        self.driver.find_element(By.CSS_SELECTOR, '[name="file"]').send_keys(str(source))
        self.wait.until(lambda d: d.execute_script("return document.querySelector('#iconMappingPreview img')?.src.startsWith('data:image/png')"))
        preview = self.driver.find_element(By.CSS_SELECTOR, '#iconMappingPreview img').get_attribute('src')
        self.driver.find_element(By.CSS_SELECTOR, '#iconMappingForm button[type="submit"]').click()
        self.wait.until(lambda d: d.find_element(By.ID, 'iconMappingStatus').text == '저장했습니다.')
        self.wait.until(lambda d: d.execute_script("return document.querySelector('#iconMappingRows [data-icon-key=\"tank\"] img')?.src.startsWith('data:image/png')"))
        applied = self.driver.find_element(By.CSS_SELECTOR, '#iconMappingRows [data-icon-key="tank"] img').get_attribute('src')
        self.assertEqual(preview, applied)
        row = self.driver.execute_script("return iconMappings.find(r=>r.key==='tank')")
        self.assertNotEqual(row['icon'], self.mappings[0]['icon'])
        self.assertTrue((Path(self.temp.name) / row['icon']).is_file())

    def test_rapid_preview_change_keeps_latest_selection(self):
        self.driver.execute_script("const f=document.getElementById('iconMappingForm');f.elements.key.value='melee';selectIconMapping();f.elements.key.value='tank';selectIconMapping();f.elements.removeBackground.checked=false;previewIconMapping();")
        self.wait.until(lambda d: d.execute_script("return document.querySelector('#iconMappingPreview img')?.complete"))
        img = self.driver.find_element(By.CSS_SELECTOR, '#iconMappingPreview img')
        self.assertIn(self.mappings[0]['icon'], img.get_attribute('src'))


if __name__ == '__main__':
    unittest.main()
