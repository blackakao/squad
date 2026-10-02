import json
from pathlib import Path
import struct
import unittest

ROOT=Path(__file__).resolve().parents[1]/'assets/characters/base'
def read(path):
    raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+size])

class BaldSDTest(unittest.TestCase):
    def test_rig_and_appearance_contract(self):
        source=read(ROOT/'빡빡이 캐릭터.glb');model=read(ROOT/'human_sd_bald_v1.glb')
        self.assertNotIn('skins',source);self.assertEqual(len(model['skins']),1)
        primitive=model['meshes'][0]['primitives'][0];self.assertIn('JOINTS_0',primitive['attributes']);self.assertIn('WEIGHTS_0',primitive['attributes'])
        position_count=model['accessors'][primitive['attributes']['POSITION']]['count']
        self.assertEqual(model['accessors'][primitive['attributes']['JOINTS_0']]['count'],position_count)
        self.assertEqual(model['accessors'][primitive['attributes']['WEIGHTS_0']]['count'],position_count)
        names={node.get('name'):i for i,node in enumerate(model['nodes'])}
        expected=['Root','Hips','Spine','Chest','Neck','Head','Shoulder_L','UpperArm_L','LowerArm_L','Hand_L','Shoulder_R','UpperArm_R','LowerArm_R','Hand_R','UpperLeg_L','LowerLeg_L','Foot_L','UpperLeg_R','LowerLeg_R','Foot_R']
        self.assertEqual([model['nodes'][i]['name'] for i in model['skins'][0]['joints']],expected)
        for name,parent in [('Weapon_R','Hand_R'),('Weapon_L','Hand_L'),('Head_Attachment','Head'),('Back_Attachment','Chest')]:self.assertIn(names[name],model['nodes'][names[parent]]['children'])
        profile=model['scenes'][0]['extras']['sdAppearance'];self.assertTrue(profile['bald']);self.assertEqual(profile['version'],3)

if __name__=='__main__':unittest.main()
