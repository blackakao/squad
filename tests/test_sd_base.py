"""Dependency-free structural regression checks for the generated GLB."""
from pathlib import Path
import json
import math
import struct
import unittest


class SDBaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[1] / 'assets/characters/base/human_sd_base_v1.glb'
        content = path.read_bytes()
        assert struct.unpack_from('<III', content) == (0x46546C67, 2, len(content))
        size, kind = struct.unpack_from('<II', content, 12)
        assert kind == 0x4E4F534A
        cls.doc = json.loads(content[20:20+size])
        binary_size, kind = struct.unpack_from('<II', content, 20+size)
        assert kind == 0x004E4942
        cls.binary = content[28+size:]
        assert len(cls.binary) == binary_size

    def read(self, index):
        accessor = self.doc['accessors'][index]
        view = self.doc['bufferViews'][accessor['bufferView']]
        width = {'SCALAR':1, 'VEC3':3, 'VEC4':4, 'MAT4':16}[accessor['type']]
        fmt = {5126:'f',5123:'H',5125:'I'}[accessor['componentType']]
        length = accessor['count']*width
        self.assertEqual(view['byteLength'], struct.calcsize('<'+str(length)+fmt))
        self.assertLessEqual(view['byteOffset']+view['byteLength'],len(self.binary))
        values = struct.unpack_from('<'+str(length)+fmt,self.binary,view['byteOffset'])
        self.assertTrue(all(math.isfinite(v) for v in values))
        return [values[i:i+width] for i in range(0,length,width)]

    def test_rig(self):
        skin = self.doc['skins'][0]
        names = {n['name'] for n in self.doc['nodes']}
        self.assertEqual(len(skin['joints']),24)
        self.assertEqual(len(self.read(skin['inverseBindMatrices'])),24)
        self.assertTrue({'Weapon_R','Weapon_L','Head_Attachment','Back_Attachment'} <= names)

    def test_geometry_and_weights(self):
        for mesh in self.doc['meshes']:
            p = mesh['primitives'][0]
            attrs = p['attributes']
            positions, normals = self.read(attrs['POSITION']),self.read(attrs['NORMAL'])
            joints, weights = self.read(attrs['JOINTS_0']),self.read(attrs['WEIGHTS_0'])
            self.assertEqual(len(positions),len(joints))
            for js, ws in zip(joints,weights):
                self.assertAlmostEqual(sum(ws),1,places=5)
                self.assertTrue(all(0 <= j < 24 for j in js))
                self.assertTrue(all(0 <= w <= 1 for w in ws))
            indices = [v[0] for v in self.read(p['indices'])]
            self.assertEqual(len(indices)%3,0)
            for i in range(0,len(indices),3):
                ids = indices[i:i+3]
                self.assertTrue(all(k < len(positions) for k in ids))
                a,b,c = [positions[k] for k in ids]
                u,v = [b[k]-a[k] for k in range(3)],[c[k]-a[k] for k in range(3)]
                cross = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
                self.assertGreaterEqual(sum(cross[k]*normals[ids[0]][k] for k in range(3)),-1e-8,mesh['name'])

    def test_animations(self):
        clips = self.doc['animations']
        self.assertEqual({a['name'] for a in clips},{'Idle','Walk','Run','Attack_01','Cast','Hit','Knockdown','Death','Victory'})
        for clip in clips:
            for channel in clip['channels']:
                sampler = clip['samplers'][channel['sampler']]
                times,values = self.read(sampler['input']),self.read(sampler['output'])
                self.assertEqual(len(times),len(values))
                self.assertEqual(times[0][0],0)
                self.assertTrue(all(a[0] < b[0] for a,b in zip(times,times[1:])))
                if channel['target']['path'] == 'rotation':
                    for q in values:
                        self.assertAlmostEqual(sum(x*x for x in q),1,places=5)

    def test_death_holds_knockdown_end(self):
        clips = {a['name']:a for a in self.doc['animations']}
        def channels(clip):
            return {(c['target']['node'],c['target']['path']): self.read(clip['samplers'][c['sampler']]['output']) for c in clip['channels']}
        death,fall = channels(clips['Death']),channels(clips['Knockdown'])
        for key,values in death.items():
            self.assertTrue(all(row == values[0] for row in values),str(key))
            self.assertEqual(values[0],fall[key][-1])

    def test_forward_recovery_phase(self):
        # Knee bends on forward (+Z) recovery, remains extended on backward stance.
        clips = {a['name']:a for a in self.doc['animations']}
        names = {i:n['name'] for i,n in enumerate(self.doc['nodes'])}
        for name in ('Walk','Run'):
            tracks = {names[c['target']['node']]:self.read(clips[name]['samplers'][c['sampler']]['output'])
                      for c in clips[name]['channels'] if c['target']['path']=='rotation'}
            upper = tracks['UpperLeg_L']
            lower = tracks['LowerLeg_L']
            self.assertLess(upper[1][0],upper[0][0],name+' forward recovery')
            middle = len(upper)//2
            self.assertGreater(upper[middle+1][0],upper[middle][0],name+' backward stance')
            self.assertGreater(lower[0][0],.1,name+' bent recovery knee')
            self.assertAlmostEqual(lower[middle][0],0,places=4)


if __name__ == '__main__':
    unittest.main()
