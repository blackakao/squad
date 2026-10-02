import json
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1] / 'assets/characters/base'

def read(path):
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+length]), raw[28+length:]

class ImportedModelTest(unittest.TestCase):
    def test_sources_preserved_in_derived_models(self):
        for gender, source in [('male', '남성SD캐릭터.glb'), ('female', '여성SD캐릭터.glb')]:
            original, binary = read(ROOT / source)
            derived, output = read(ROOT / f'human_sd_{gender}_v2.glb')
            self.assertEqual(output[:len(binary)], binary)
            for key in ['skins', 'animations', 'materials', 'images']:
                self.assertEqual(original[key], derived[key], key)
            self.assertEqual(derived['scenes'][0]['extras']['sdAppearance']['base'], gender)
            names = {n.get('name'): i for i, n in enumerate(derived['nodes'])}
            for socket, parent in [('Weapon_R','mixamorig:RightHand'), ('Weapon_L','mixamorig:LeftHand'), ('Head_Attachment','mixamorig:Head'), ('Back_Attachment','mixamorig:Spine2')]:
                self.assertIn(names[socket], derived['nodes'][names[parent]]['children'])
                self.assertEqual(len(derived['nodes'][names[socket]]['matrix']), 16)
            attributes=derived['meshes'][0]['primitives'][0]['attributes']
            self.assertEqual(derived['accessors'][attributes['_SD_MASK']]['count'],derived['accessors'][attributes['POSITION']]['count'])

if __name__ == '__main__':
    unittest.main()
