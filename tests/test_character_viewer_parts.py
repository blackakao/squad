import base64
import hashlib
import importlib.util
import os
import shutil
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path

SELENIUM_AVAILABLE = importlib.util.find_spec("selenium") is not None
if SELENIUM_AVAILABLE:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
MODEL = "assets%2Fcharacters%2Fbase%2F%EB%8C%80%EB%A8%B8%EB%A6%AC%20%EB%B8%94%EB%9E%AD%ED%81%AC%20%EC%96%BC%EA%B5%B4%20%EB%82%A8%EC%9E%90.glb"


def chrome_available():
    candidates = [
        shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chrome"),
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    return any(path and Path(path).exists() for path in candidates)


@unittest.skipUnless(SELENIUM_AVAILABLE and chrome_available(), "Chrome와 Selenium이 필요한 브라우저 회귀 테스트")
class CharacterViewerPartLifecycleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sock = socket.socket();sock.bind(("127.0.0.1", 0));cls.port = sock.getsockname()[1];sock.close()
        env = {**os.environ, "PORT": str(cls.port)}
        cls.server = subprocess.Popen([sys.executable, "server.py"], cwd=ROOT, env=env,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 10
        while time.time() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", cls.port), timeout=.2):break
            except OSError:time.sleep(.1)
        options = webdriver.ChromeOptions();options.add_argument("--headless=new")
        options.add_argument("--enable-unsafe-swiftshader");options.add_argument("--window-size=1440,1200")
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 30)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit();cls.server.terminate();cls.server.wait(timeout=5)

    def setUp(self):
        self.driver.get(f"http://127.0.0.1:{self.port}/character-viewer.html?model={MODEL}&parts=lifecycle")
        self.wait.until(lambda d: d.find_element(By.ID, "portrait-controls").get_attribute("disabled") is None)
        self.wait.until(lambda d: d.execute_script("return Boolean(characterViewerDebug?.viewer?.model)"))

    def click(self, field, part_id):
        selector = f'[data-field="{field}"][data-part-id="{part_id}"]'
        node = self.driver.find_element(By.CSS_SELECTOR, selector)
        self.driver.execute_script("arguments[0].click()", node)
        self.wait.until(lambda d: node.get_attribute("aria-pressed") == "true")
        self.wait.until(lambda d: d.execute_script("return document.querySelector('#portrait-preview').src.startsWith('data:image/png')"))

    def play_animation(self):
        play=self.driver.find_element(By.ID, "play")
        if play.is_enabled():
            play.click();time.sleep(.2)

    def hair_signature(self):
        return self.driver.execute_script("""
          const root=characterViewerDebug.viewer.model.getObjectByName('Independent_Hair');
          const meshes=[];root.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();const b=n.geometry.boundingBox;
            meshes.push({name:n.name,vertices:n.geometry.attributes.position.count,index:n.geometry.index?.count||0,
              box:[...b.min.toArray(),...b.max.toArray()].map(v=>+v.toFixed(6)),
              position:n.position.toArray().map(v=>+v.toFixed(6)),scale:n.scale.toArray().map(v=>+v.toFixed(6)),
              quaternion:n.quaternion.toArray().map(v=>+v.toFixed(6)),materials:[].concat(n.material||[]).map(m=>m.name)});}});
          return {parent:root.parent.name,visible:root.visible,meshes};
        """)

    def test_all_eye_styles_are_attached_and_rendered(self):
        self.play_animation()
        hashes=[]
        for index in range(1, 11):
            time.sleep(.08)
            self.click("eyes", f"eye{index}")
            state=self.driver.execute_script("""
              const selected=characterViewerDebug.composer.getSelectedParts();
              const eyes=characterViewerDebug.viewer.model.getObjectByName('Independent_Eyes');
              const meshes=[];eyes?.traverse(n=>{if(n.isMesh)meshes.push({visible:n.visible,vertices:n.geometry?.attributes?.position?.count||0,parent:n.parent?.name});});
              return {selected:selected.eyes,parent:eyes?.parent?.name,attached:Boolean(eyes?.parent),visible:eyes?.visible,meshes};
            """)
            self.assertEqual(state["selected"], f"eye{index}")
            self.assertEqual(state["parent"], "Eye_Anchor")
            self.assertTrue(state["attached"] and state["visible"])
            self.assertGreaterEqual(len(state["meshes"]), 2)
            self.assertTrue(all(mesh["visible"] and mesh["vertices"] > 0 for mesh in state["meshes"]))
            payload=self.driver.find_element(By.ID, "portrait-preview").get_attribute("src").split(",", 1)[1]
            hashes.append(hashlib.sha256(base64.b64decode(payload)).hexdigest())
        self.assertEqual(len(set(hashes)), 10, "눈 10종의 실제 WebGL 캡처가 서로 달라야 한다")

    def test_eye_color_is_independent_from_eye_shape(self):
        self.click("eyes","eye10");self.click("eyeColor","ec1")
        first=self.driver.execute_script("return characterViewerDebug.composer.getSelectedParts()")
        self.click("eyeColor","ec4");second=self.driver.execute_script("return characterViewerDebug.composer.getSelectedParts()")
        self.assertEqual(first["eyes"],"eye10");self.assertEqual(second["eyes"],"eye10")
        self.assertEqual(first["eyeColor"],"ec1");self.assertEqual(second["eyeColor"],"ec4")
        pupil=self.driver.execute_script("""const eyes=characterViewerDebug.viewer.model.getObjectByName('Independent_Eyes');return [...eyes.children].filter(x=>x.name==='Eye_Pupil').map(x=>x.scale.x/x.scale.y);""")
        self.assertTrue(pupil and all(value<.35 for value in pupil),"이종형은 세로 동공을 유지해야 한다")

    def test_hair_instances_are_fresh_and_stable_after_twenty_swaps(self):
        self.play_animation()
        self.click("hair", "m1");expected=self.hair_signature()
        previous_ids=self.driver.execute_script("""
          const h=characterViewerDebug.viewer.model.getObjectByName('Independent_Hair'),ids=[];
          h.traverse(n=>{if(n.isMesh)ids.push([n.geometry.uuid,...[].concat(n.material||[]).map(m=>m.uuid)])});return ids.flat();
        """)
        for _ in range(20):
            time.sleep(.08)
            self.click("hair", "m2");self.click("hair", "m1")
            current_ids=self.driver.execute_script("""
              const h=characterViewerDebug.viewer.model.getObjectByName('Independent_Hair'),ids=[];
              h.traverse(n=>{if(n.isMesh)ids.push([n.geometry.uuid,...[].concat(n.material||[]).map(m=>m.uuid)])});return ids.flat();
            """)
            self.assertFalse(set(previous_ids) & set(current_ids), "교체 인스턴스가 geometry/material을 공유함")
            self.assertEqual(self.hair_signature(), expected)
            previous_ids=current_ids

    def test_all_hair_styles_use_the_common_anchor_and_cap(self):
        for prefix in ("m", "f"):
            if prefix == "f":
                select=self.driver.find_element(By.ID, "hair-group")
                self.driver.execute_script("arguments[0].value='female';arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",select)
                self.wait.until(lambda d: d.execute_script("return characterViewerDebug.viewer.model?.userData?.sdAppearance?.base==='female'"))
                self.wait.until(lambda d: d.find_element(By.ID, "portrait-controls").get_attribute("disabled") is None)
            for index in range(1, 11):
                self.click("hair", f"{prefix}{index}")
                state=self.driver.execute_script("""
                  const model=characterViewerDebug.viewer.model,anchor=model.getObjectByName('Hair_Anchor');
                  const hair=model.getObjectByName('Independent_Hair'),cap=hair?.getObjectByName('Hair_Cap');
                  return {anchorParent:anchor?.parent?.name,hairParent:hair?.parent?.name,
                    capVertices:cap?.geometry?.attributes?.position?.count||0,capVisible:cap?.visible};
                """)
                self.assertEqual(state["anchorParent"], "mixamorigHead")
                self.assertEqual(state["hairParent"], "Hair_Anchor")
                self.assertTrue(state["capVisible"])
                self.assertGreater(state["capVertices"], 0)

    def test_hair_eye_combination_returns_to_same_render(self):
        self.play_animation()
        def image_hash():
            payload=self.driver.find_element(By.ID, "portrait-preview").get_attribute("src").split(",", 1)[1]
            return hashlib.sha256(base64.b64decode(payload)).hexdigest()
        self.click("hair", "m1");self.click("eyes", "eye1");expected=image_hash()
        for _ in range(5):
            self.click("hair", "m2");self.click("eyes", "eye2")
            self.click("hair", "m1");self.click("eyes", "eye1")
            self.assertEqual(image_hash(), expected)

    def test_hair_color_updates_the_cap_and_survives_style_change(self):
        self.click("hair", "m1");self.click("hairColor", "hc5")
        self.click("hair", "m2");self.click("hair", "m1")
        state=self.driver.execute_script("""
          const hair=characterViewerDebug.viewer.model.getObjectByName('Independent_Hair');
          const selected=characterViewerDebug.composer.getSelectedParts(),colors=[];
          hair.traverse(n=>{for(const m of [].concat(n.material||[]))if(m.name==='Hair_Dark'||m.name==='Hair_Light')colors.push([m.name,'#'+m.color.getHexString()]);});
          return {selected:selected.hairColor,cap:Boolean(hair.getObjectByName('Hair_Cap')),colors};
        """)
        self.assertEqual(state["selected"], "hc5")
        self.assertTrue(state["cap"])
        self.assertTrue(state["colors"])
        self.assertTrue(all(color in ("#777b87", "#c9ced8") for _,color in state["colors"]))

    def test_face_anchors_and_parts_are_independent_and_presets_restore(self):
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR,'[data-field="eyebrows"]')),5)
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR,'[data-field="nose"]')),5)
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR,'[data-field="mouth"]')),5)
        self.click("eyes", "eye4");self.click("eyebrows", "brow3");self.click("nose", "nose3");self.click("mouth", "mouth5")
        def snapshot():
            return self.driver.execute_script("""
              const m=characterViewerDebug.viewer.model,names=['Independent_Hair','Independent_Eyes','Independent_Eyebrows','Independent_Nose','Independent_Mouth'];
              const groups=Object.fromEntries(names.map(name=>{const n=m.getObjectByName(name),meshes=[];n?.traverse(x=>{if(x.isMesh)meshes.push(x.geometry?.attributes?.position?.count||0)});return [name,{uuid:n?.uuid,parent:n?.parent?.name,visible:n?.visible,meshes}]}));
              return {selected:characterViewerDebug.composer.getSelectedParts(),faceParent:m.getObjectByName('Face_Anchor')?.parent?.name,groups};
            """)
        initial=snapshot();self.assertEqual(initial["faceParent"],"mixamorigHead")
        expected_parents={"Independent_Hair":"Hair_Anchor","Independent_Eyes":"Eye_Anchor","Independent_Eyebrows":"Eyebrow_Anchor","Independent_Nose":"Nose_Anchor","Independent_Mouth":"Mouth_Anchor"}
        for name,parent in expected_parents.items():
            self.assertEqual(initial["groups"][name]["parent"],parent);self.assertTrue(initial["groups"][name]["visible"]);self.assertTrue(all(v>0 for v in initial["groups"][name]["meshes"]))
        self.click("eyes","eye7");after_eye=snapshot()
        for name in ["Independent_Hair","Independent_Eyebrows","Independent_Nose","Independent_Mouth"]:self.assertEqual(after_eye["groups"][name]["uuid"],initial["groups"][name]["uuid"])
        self.click("eyebrows","brow5");after_brow=snapshot();self.assertEqual(after_brow["groups"]["Independent_Eyes"]["uuid"],after_eye["groups"]["Independent_Eyes"]["uuid"])
        self.driver.find_element(By.ID,"portrait-preset-name").send_keys("얼굴 파츠 회귀")
        self.driver.find_element(By.ID,"portrait-save-preset").click();self.click("nose","nose1");self.click("mouth","mouth1")
        select=self.driver.find_element(By.ID,"portrait-presets");self.driver.execute_script("arguments[0].value='0';arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",select)
        self.wait.until(lambda d:d.execute_script("return characterViewerDebug.composer.getSelectedParts().mouth==='mouth5'"))
        restored=snapshot();self.assertEqual(restored["selected"]["eyebrows"],"brow5");self.assertEqual(restored["selected"]["nose"],"nose3");self.assertEqual(restored["selected"]["mouth"],"mouth5")

    def test_five_face_variants_render_and_wave_hair_uses_large_chunks(self):
        for field,prefix in (("eyebrows","brow"),("nose","nose"),("mouth","mouth")):
            hashes=[]
            for index in range(1,6):
                self.click(field,f"{prefix}{index}");payload=self.driver.find_element(By.ID,"portrait-preview").get_attribute("src").split(",",1)[1];hashes.append(hashlib.sha256(base64.b64decode(payload)).hexdigest())
            self.assertEqual(len(set(hashes)),5,f"{field} 5종이 서로 다른 실제 렌더여야 한다")
        select=self.driver.find_element(By.ID,"hair-group");self.driver.execute_script("arguments[0].value='female';arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",select)
        self.wait.until(lambda d:d.execute_script("return characterViewerDebug.viewer.model?.userData?.sdAppearance?.base==='female'"));self.click("hair","f7")
        metrics=self.driver.execute_script("""
          const h=characterViewerDebug.viewer.model.getObjectByName('Independent_Hair');let triangles=0,meshes=0;const names={};
          h.traverse(n=>{if(!n.isMesh)return;meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;names[n.name]=(names[n.name]||0)+1;});
          return {triangles,meshes,names,transform:{position:h.position.toArray(),scale:h.scale.toArray()}};
        """)
        self.assertGreaterEqual(metrics["names"].get("FrontHair",0),5);self.assertGreaterEqual(metrics["names"].get("LeftWave",0),3);self.assertGreaterEqual(metrics["names"].get("RightWave",0),3);self.assertGreaterEqual(metrics["names"].get("BackHair",0),3)
        self.assertLess(metrics["triangles"],7000);self.assertLess(metrics["meshes"],20)

    def face_depth_metrics(self):
        return self.driver.execute_script("""
          const model=characterViewerDebug.viewer.model;let body;model.traverse(n=>{if(!body&&n.isSkinnedMesh)body=n});
          body.skeleton?.pose();model.updateMatrixWorld(true);
          const bodySurface=(x,y,r=.025)=>{let z=-Infinity,p=body.position.clone();for(let i=0;i<body.geometry.attributes.position.count;i++){
            body.getVertexPosition(i,p);body.localToWorld(p);model.worldToLocal(p);if((p.x-x)**2+(p.y-y)**2<r*r)z=Math.max(z,p.z);
          }return z;};
          const extent=(name,axis='z')=>{const root=model.getObjectByName(name);let value=-Infinity,p=root.position.clone();root.traverse(n=>{if(!n.isMesh)return;const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i);n.localToWorld(p);model.worldToLocal(p);value=Math.max(value,p[axis]);}});return value;};
          const anchor=name=>{const n=model.getObjectByName(name),p=n.position.clone().set(0,0,0);n.localToWorld(p);model.worldToLocal(p);return p.toArray();};
          const profile=model.userData.sdAppearance,eyeX=profile.eyeSpacing,eyeY=profile.eyeY,mouthY=profile.mouthY??eyeY-.205,noseY=eyeY-.105;
          return {base:profile.base,anchors:{eye:anchor('Eye_Anchor'),nose:anchor('Nose_Anchor'),mouth:anchor('Mouth_Anchor')},
            gaps:{eye:extent('Independent_Eyes')-Math.max(bodySurface(-eyeX,eyeY),bodySurface(eyeX,eyeY)),nose:extent('Independent_Nose')-bodySurface(0,noseY,.02),mouth:extent('Independent_Mouth')-bodySurface(0,mouthY)},
            crown:{head:extent('Mesh_0','y'),cap:extent('Hair_Cap','y')}};
        """)

    def test_face_depth_and_all_female_caps_clear_the_head(self):
        self.driver.find_element(By.ID,"stop").click();male=self.face_depth_metrics()
        self.assertEqual(male["base"],"male");self.assertAlmostEqual(male["anchors"]["eye"][1],1.30,places=3);self.assertAlmostEqual(male["anchors"]["nose"][1],1.195,places=3);self.assertAlmostEqual(male["anchors"]["mouth"][1],1.095,places=3)
        self.assertGreater(male["gaps"]["eye"],.006);self.assertLess(male["gaps"]["eye"],.025);self.assertGreater(male["gaps"]["mouth"],.002);self.assertLess(male["gaps"]["mouth"],.016);self.assertGreater(male["gaps"]["nose"],male["gaps"]["mouth"])
        select=self.driver.find_element(By.ID,"hair-group");self.driver.execute_script("arguments[0].value='female';arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",select)
        self.wait.until(lambda d:d.execute_script("return characterViewerDebug.viewer.model?.userData?.sdAppearance?.base==='female'"));self.driver.find_element(By.ID,"stop").click()
        clearances=[]
        for index in range(1,11):
            self.click("hair",f"f{index}");metrics=self.face_depth_metrics();clearances.append(metrics["crown"]["cap"]-metrics["crown"]["head"])
        self.assertAlmostEqual(metrics["anchors"]["mouth"][1],1.160,places=3);self.assertGreater(metrics["gaps"]["eye"],.006);self.assertLess(metrics["gaps"]["eye"],.025);self.assertGreater(metrics["gaps"]["mouth"],.001);self.assertLess(metrics["gaps"]["mouth"],.016);self.assertGreater(metrics["gaps"]["nose"],metrics["gaps"]["mouth"])
        self.assertTrue(all(clearance>.01 for clearance in clearances),clearances)

    def test_equipment_slots_are_independent_follow_bones_and_restore(self):
        full={"head":"testHelmet01","body":"testArmor01","hands":"testGloves01","feet":"testBoots01","mainHand":"testSword01","offHand":"testShield01"}
        appearance=self.driver.execute_script("""
          const m=characterViewerDebug.viewer.model;return ['Independent_Hair','Independent_Eyes','Independent_Eyebrows','Independent_Nose','Independent_Mouth'].map(name=>m.getObjectByName(name)?.uuid);
        """)
        self.driver.execute_async_script("const done=arguments[arguments.length-1];characterViewerDebug.equipment.setState(arguments[0]).then(done)",full)
        state=self.driver.execute_script("""
          const e=characterViewerDebug.equipment,p=e.preview;
          return {state:e.getState(),anchors:Object.fromEntries(Object.entries(p.anchors).map(([k,a])=>[k,[a?.name,a?.parent?.name]])),
            hairVisible:characterViewerDebug.viewer.model.getObjectByName('Hair_Anchor')?.visible,
            hairParts:Object.fromEntries(characterViewerDebug.viewer.model.getObjectByName('Independent_Hair').children.map((n,i)=>[`${n.name}:${i}`,n.visible])),
            poses:p.poseBones.map(x=>x.bone.name),
            attached:Object.fromEntries([...p.attached].map(([k,v])=>[k,v.map(x=>[x.name,x.parent?.name])]))};
        """)
        self.assertEqual(state["state"],full)
        self.assertTrue(state["hairVisible"])
        self.assertTrue(any(name.startswith("Hair_Cap:") and not visible for name,visible in state["hairParts"].items()))
        self.assertEqual(state["attached"]["offHand"][0][1],"ShieldGripAnchor")
        self.assertEqual(state["anchors"]["mainHand"][1],"mixamorigRightHand");self.assertEqual(state["anchors"]["offHand"][1],"mixamorigLeftHand")
        self.assertEqual(state["anchors"]["head"][1],"mixamorigHead");self.assertEqual(state["anchors"]["body"][1],"mixamorigSpine2")
        self.assertEqual(len(state["attached"]["hands"]),2);self.assertEqual(len(state["attached"]["feet"]),2)
        self.driver.execute_async_script("const done=arguments[arguments.length-1];characterViewerDebug.equipment.setState({...characterViewerDebug.equipment.getState(),mainHand:'testSpear01',head:null}).then(done)")
        changed=self.driver.execute_script("""
          const d=characterViewerDebug,m=d.viewer.model,h=m.getObjectByName('Independent_Hair');return {state:d.equipment.getState(),hairVisible:m.getObjectByName('Hair_Anchor')?.visible,hairParts:h.children.map(n=>n.visible),appearance:['Independent_Hair','Independent_Eyes','Independent_Eyebrows','Independent_Nose','Independent_Mouth'].map(name=>m.getObjectByName(name)?.uuid)};
        """)
        self.assertEqual(changed["state"]["mainHand"],"testSpear01");self.assertIsNone(changed["state"]["head"]);self.assertEqual(changed["state"]["offHand"],"testShield01");self.assertEqual(changed["appearance"],appearance)
        self.assertTrue(changed["hairVisible"])
        self.assertTrue(all(changed["hairParts"]))
        self.driver.execute_script("localStorage.removeItem('sd-portrait-presets-v1')")

        self.driver.find_element(By.ID,"portrait-preset-name").send_keys("장비 조합 회귀");self.driver.find_element(By.ID,"portrait-save-preset").click()
        self.driver.find_element(By.ID,"equip-clear").click();self.wait.until(lambda d: all(v is None for v in d.execute_script("return characterViewerDebug.equipment.getState() ").values()))
        select=self.driver.find_element(By.ID,"portrait-presets");self.driver.execute_script("arguments[0].value='0';arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",select)
        self.wait.until(lambda d:d.execute_script("return characterViewerDebug.equipment.getState().mainHand==='testSpear01'"))
        restored=self.driver.execute_script("return characterViewerDebug.equipment.getState()")
        self.assertEqual(restored["offHand"],"testShield01");self.assertEqual(restored["body"],"testArmor01");self.assertEqual(restored["feet"],"testBoots01")
        self.driver.get(f"http://127.0.0.1:{self.port}/character-viewer.html?model=assets%2Fcharacters%2Fbase%2Fhuman_sd_base_v1.glb&equipment=animation")
        self.wait.until(lambda d:d.execute_script("return Boolean(globalThis.characterViewerDebug?.equipment?.preview?.root)"))
        self.driver.execute_async_script("const done=arguments[arguments.length-1];characterViewerDebug.equipment.setState(arguments[0]).then(done)",full)
        samples=[]
        for clip in ("Idle","Walk","Run","Attack_01","Cast","Hit","Death"):
            sample=self.driver.execute_script("""
              const d=characterViewerDebug,v=d.viewer,i=v.clips.findIndex(c=>c.name===arguments[0]);v.selectClip(i);v.action.time=v.clips[i].duration*.55;v.mixer.update(0);v.model.updateMatrixWorld(true);
              const item=d.equipment.preview.attached.get('mainHand')[0],e=item.matrixWorld.elements;
              return {clip:v.clips[i].name,parent:item.parent?.name,position:[e[12],e[13],e[14]],slots:d.equipment.preview.attached.size};
            """,clip)
            self.assertEqual(sample["clip"],clip);self.assertEqual(sample["parent"],"MainHandEquipmentAnchor");self.assertEqual(sample["slots"],6);self.assertTrue(all(abs(value)<100 for value in sample["position"]));samples.append(tuple(round(v,4) for v in sample["position"]))
        self.assertGreater(len(set(samples)),3,"애니메이션 중 주무기 장착점이 손 본을 따라 이동해야 한다")
        self.driver.execute_async_script("const done=arguments[arguments.length-1];characterViewerDebug.equipment.setState({}).then(done)")
        self.assertEqual(self.driver.execute_script("return characterViewerDebug.equipment.preview.attached.size"),0)
        self.driver.execute_script("localStorage.removeItem('sd-portrait-presets-v1')")

    def test_outfit_presets_follow_limb_bones_without_resetting_weapons(self):
        outfit_ids=["testArmor01","testChainmail01","testLeather01","testCloth01","testTuxedo01","testCasual01"]
        options=self.driver.execute_script("return [...document.querySelector('#equip-body').options].map(option=>option.value).filter(Boolean)")
        self.assertEqual(options,outfit_ids)
        self.driver.execute_async_script("const done=arguments[arguments.length-1];characterViewerDebug.equipment.setState({mainHand:'testSword01',offHand:'testShield01'}).then(done)")
        for outfit_id in outfit_ids:
            result=self.driver.execute_async_script("""
              const done=arguments[arguments.length-1],id=arguments[0],d=characterViewerDebug,p=d.equipment.preview;
              p.equip('body',id).then(()=>{
                const parts=p.attached.get('body')||[],parents=parts.map(part=>part.parent?.name),meshes=parts.reduce((count,part)=>{part.traverse(node=>{if(node.isMesh)count++});return count},0);
                done({state:p.getState(),parents,meshes,finite:parts.every(part=>Array.from(part.matrixWorld.elements).every(Number.isFinite)),names:parts.flatMap(part=>{const value=[];part.traverse(node=>value.push(node.name));return value})});
              });
            """,outfit_id)
            self.assertEqual(result["state"]["body"],outfit_id)
            self.assertEqual(result["state"]["mainHand"],"testSword01");self.assertEqual(result["state"]["offHand"],"testShield01")
            self.assertEqual(len(result["parents"]),10);self.assertTrue(result["finite"]);self.assertGreater(result["meshes"],10)
            for anchor in ("BodyEquipmentAnchor","HipEquipmentAnchor","LeftUpperArmEquipmentAnchor","RightUpperArmEquipmentAnchor","LeftLowerArmEquipmentAnchor","RightLowerArmEquipmentAnchor","LeftUpperLegEquipmentAnchor","RightUpperLegEquipmentAnchor","LeftLowerLegEquipmentAnchor","RightLowerLegEquipmentAnchor"):
                self.assertIn(anchor,result["parents"])
            if outfit_id=="testArmor01":self.assertIn("Plate_Skirt",result["names"])


if __name__ == "__main__":unittest.main()
