"""Rebuild the original procedural SD rig sample using Python's standard library.

Coordinates: meters, Y up, +Z forward; character-left is +X.
This is a prototype with smooth limb weights, not production retopology.
"""
from pathlib import Path
import json
import math
import struct

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/characters/base/human_sd_base_v1.glb'
TAU = math.tau


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def normalize(v):
    n = math.sqrt(sum(x * x for x in v)) or 1
    return tuple(x / n for x in v)


def quaternion(x=0, y=0, z=0):
    x, y, z = (math.radians(v) / 2 for v in (x, y, z))
    a, b, c, d, e, f = math.sin(x), math.cos(x), math.sin(y), math.cos(y), math.sin(z), math.cos(z)
    return [a*d*f+b*c*e, b*c*f-a*d*e, b*d*e+a*c*f, b*d*f-a*c*e]


def qmul(a, b):
    x,y,z,w = a
    i,j,k,l = b
    return (w*i+x*l+y*k-z*j, w*j-x*k+y*l+z*i, w*k+x*j-y*i+z*l, w*l-x*i-y*j-z*k)


def rotate(q, point):
    return qmul(qmul(q, (*point,0)), (-q[0],-q[1],-q[2],q[3]))[:3]


class Model:
    def __init__(self):
        self.doc = {'asset': {'version': '2.0', 'generator': 'Project SD Base Generator v1'},
                    'scene': 0, 'scenes': [{'name': 'SD Human Base v1', 'nodes': []}],
                    'nodes': [], 'meshes': [], 'skins': [], 'materials': [],
                    'buffers': [], 'bufferViews': [], 'accessors': [], 'animations': []}
        self.binary = bytearray()
        self.nodes = {}
        self.world = {}
        self.joints = []
        self.joint_index = {}
        self.parts = {}
        self.parents = {}

    def bone(self, name, world, parent=None):
        index = len(self.doc['nodes'])
        local = sub(world, self.world[parent]) if parent else world
        self.doc['nodes'].append({'name': name, 'translation': list(local)})
        self.nodes[name] = index
        self.world[name] = world
        self.parents[name] = parent
        self.joint_index[name] = len(self.joints)
        self.joints.append(index)
        if parent:
            self.doc['nodes'][self.nodes[parent]].setdefault('children', []).append(index)
        else:
            self.doc['scenes'][0]['nodes'].append(index)

    def material(self, name, color, roughness=0.7, metallic=0):
        index = len(self.doc['materials'])
        self.doc['materials'].append({'name': name, 'pbrMetallicRoughness': {
            'baseColorFactor': [*color, 1], 'roughnessFactor': roughness, 'metallicFactor': metallic}})
        return index

    def vertex(self, part, position, normal, influences):
        data = self.parts.setdefault(part, {'p': [], 'n': [], 'j': [], 'w': [], 'i': []})
        index = len(data['p'])
        data['p'].append(position)
        data['n'].append(normalize(normal))
        weights = [(self.joint_index[bone], weight) for bone, weight in influences if weight > 0]
        total = sum(w for _, w in weights)
        data['j'].append([j for j, _ in weights] + [0] * (4-len(weights)))
        data['w'].append([w/total for _, w in weights] + [0] * (4-len(weights)))
        return index

    def ellipsoid(self, part, bone, center, radius, segments=12, rings=8, tilt=0, cap=None):
        # Optional per-azimuth hairline makes the cap open around the face.
        angle = math.radians(tilt)
        ca, sa = math.cos(angle), math.sin(angle)
        def rotate(v):
            return (v[0]*ca-v[1]*sa, v[0]*sa+v[1]*ca, v[2])
        start = len(self.parts.get(part, {}).get('p', []))
        for row in range(rings+1):
            for col in range(segments+1):
                theta = col/segments*TAU
                phi = row/rings * (cap(theta) if cap else math.pi)
                direction = (math.sin(phi)*math.cos(theta), math.cos(phi), math.sin(phi)*math.sin(theta))
                offset = rotate(tuple(v*r for v, r in zip(direction, radius)))
                normal = rotate(tuple(v/r for v, r in zip(direction, radius)))
                self.vertex(part, add(center, offset), normal, [(bone, 1)])
        indices = self.parts[part]['i']
        for row in range(rings):
            for col in range(segments):
                a = start+row*(segments+1)+col
                b = a+segments+1
                # Winding follows outward-facing surface normals.
                if row > 0:
                    indices.extend([a, a+1, b])
                if cap or row < rings-1:
                    indices.extend([a+1, b+1, b])

    def limb(self, part, upper, lower, end, r_top, r_joint, r_end, segments=10, rings=16):
        a, b, c = self.world[upper], self.world[lower], self.world[end]
        start = len(self.parts.get(part, {}).get('p', []))
        for row in range(rings+1):
            t = row/rings
            first = t <= 0.5
            u = t*2 if first else (t-0.5)*2
            p, q = (a, b) if first else (b, c)
            center = tuple(x*(1-u)+y*u for x, y in zip(p, q))
            radius = (r_top*(1-u)+r_joint*u) if first else (r_joint*(1-u)+r_end*u)
            # Gentle cap at each end; hands/feet conceal seam.
            radius *= 0.65 if row in (0, rings) else 1
            tangent = normalize(sub(q, p))
            axis = normalize((tangent[1], -tangent[0], 0))
            depth = normalize((-tangent[2]*axis[1], tangent[2]*axis[0], tangent[0]*axis[1]-tangent[1]*axis[0]))
            blend = max(0, min(1, (t-0.38)/0.24))
            blend = blend*blend*(3-2*blend)
            for col in range(segments+1):
                theta = col/segments*TAU
                normal = tuple(axis[k]*math.cos(theta)+depth[k]*math.sin(theta) for k in range(3))
                self.vertex(part, add(center, tuple(x*radius for x in normal)), normal, [(upper, 1-blend), (lower, blend)])
        indices = self.parts[part]['i']
        for row in range(rings):
            for col in range(segments):
                a = start+row*(segments+1)+col
                b = a+segments+1
                indices.extend([a, a+1, b, a+1, b+1, b])

    def accessor(self, values, kind, component=5126, bounds=False, target=None):
        dimensions = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[kind]
        while len(self.binary) % 4:
            self.binary.append(0)
        offset = len(self.binary)
        flat = values if dimensions == 1 else [v for row in values for v in row]
        fmt = {5126: 'f', 5123: 'H', 5125: 'I'}[component]
        self.binary.extend(struct.pack('<'+str(len(flat))+fmt, *flat))
        view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(self.binary)-offset}
        if target:
            view['target'] = target
        self.doc['bufferViews'].append(view)
        accessor = {'bufferView': len(self.doc['bufferViews'])-1, 'componentType': component,
                    'count': len(values), 'type': kind}
        if bounds:
            rows = [[v] for v in values] if dimensions == 1 else values
            accessor['min'] = [min(row[i] for row in rows) for i in range(dimensions)]
            accessor['max'] = [max(row[i] for row in rows) for i in range(dimensions)]
        self.doc['accessors'].append(accessor)
        return len(self.doc['accessors'])-1

    def animation(self, name, duration, pose):
        frames = math.ceil(duration*30)
        times = [duration*i/frames for i in range(frames+1)]
        states = [pose(t/duration) for t in times]
        # Keep the lowest sole on the floor for grounded clips. This is root-height
        # compensation, not foot-lock IK; horizontal foot sliding still needs refinement.
        for state in states:
            if name in ('Knockdown', 'Death', 'Victory'):
                continue
            positions, rotations = {}, {}
            for bone in self.nodes:
                parent = self.parents[bone]
                local = self.doc['nodes'][self.nodes[bone]]['translation']
                local = add(local, state.get('_'+bone.lower(), (0,0,0)))
                q = quaternion(*state.get(bone, (0,0,0)))
                rotations[bone] = qmul(rotations[parent], q) if parent else q
                positions[bone] = add(positions[parent], rotate(rotations[parent],local)) if parent else local
            lowest = math.inf
            for side in ('L','R'):
                bone = 'Foot_'+side
                center = add(positions[bone],rotate(rotations[bone],(0,-.017,.057)))
                axes = [(0.12,0,0),(0,0.12,0),(0,0,0.209)]
                extent = math.sqrt(sum(rotate(rotations[bone],axis)[1]**2 for axis in axes))
                lowest = min(lowest,center[1]-extent)
            # 1 cm margin covers interpolation between the sampled poses.
            state['_root'] = add(state.get('_root',(0,0,0)),(0,.01-lowest,0))
        time_accessor = self.accessor(times, 'SCALAR', bounds=True)
        samplers, channels = [], []
        for bone in self.nodes:
            if bone.startswith('Weapon_') or bone.endswith('_Attachment'):
                continue
            rotations = [quaternion(*state.get(bone, (0, 0, 0))) for state in states]
            channels.append({'sampler': len(samplers), 'target': {'node': self.nodes[bone], 'path': 'rotation'}})
            samplers.append({'input': time_accessor, 'output': self.accessor(rotations, 'VEC4'), 'interpolation': 'LINEAR'})
        for bone, key in [('Root', '_root'), ('Hips', '_hips')]:
            rest = self.doc['nodes'][self.nodes[bone]]['translation']
            positions = [add(rest, state.get(key, (0, 0, 0))) for state in states]
            channels.append({'sampler': len(samplers), 'target': {'node': self.nodes[bone], 'path': 'translation'}})
            samplers.append({'input': time_accessor, 'output': self.accessor(positions, 'VEC3'), 'interpolation': 'LINEAR'})
        self.doc['animations'].append({'name': name, 'samplers': samplers, 'channels': channels})

    def write(self, output=OUTPUT, skinned=True, metadata=None):
        inverse = []
        for name in self.nodes:
            x, y, z = self.world[name]
            inverse.append([1,0,0,0, 0,1,0,0, 0,0,1,0, -x,-y,-z,1])
        if skinned:
            self.doc['skins'].append({'name': 'SD_Humanoid_v1', 'joints': self.joints,
                                      'skeleton': self.nodes['Root'], 'inverseBindMatrices': self.accessor(inverse, 'MAT4')})
        for (name, material), data in self.parts.items():
            attributes = {'POSITION': self.accessor(data['p'], 'VEC3', bounds=True, target=34962),
                          'NORMAL': self.accessor(data['n'], 'VEC3', target=34962)}
            if skinned:
                attributes.update({'JOINTS_0': self.accessor(data['j'], 'VEC4', 5123, target=34962),
                                   'WEIGHTS_0': self.accessor(data['w'], 'VEC4', target=34962)})
            mesh = len(self.doc['meshes'])
            self.doc['meshes'].append({'name': name, 'primitives': [{'attributes': attributes,
                'indices': self.accessor(data['i'], 'SCALAR', 5125, target=34963), 'material': material}]})
            self.doc['scenes'][0]['nodes'].append(len(self.doc['nodes']))
            self.doc['nodes'].append({'name': name, 'mesh': mesh, **({'skin': 0} if skinned else {})})
        self.doc['extras'] = metadata or {'rigVersion': 'SD_Humanoid_v1', 'forward': '+Z', 'up': '+Y',
                              'heightMeters': 2.87, 'style': '2.8-head SD procedural prototype',
                              'animationMotion': 'in-place except Knockdown; Death holds fallen pose',
                              'authoringSource': 'tools/generate_sd_base.py'}
        self.doc['buffers'] = [{'byteLength': len(self.binary)}]
        clip_count = len(self.doc['animations'])
        for key in ('skins', 'animations'):
            if not self.doc[key]:
                del self.doc[key]
        json_bytes = json.dumps(self.doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        json_bytes += b' ' * (-len(json_bytes) % 4)
        self.binary.extend(b'\0' * (-len(self.binary) % 4))
        body = struct.pack('<II', len(json_bytes), 0x4E4F534A)+json_bytes
        body += struct.pack('<II', len(self.binary), 0x004E4942)+self.binary
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(struct.pack('<III', 0x46546C67, 2, len(body)+12)+body)
        print(f'{output.relative_to(ROOT)}: {output.stat().st_size:,} bytes; '
              f'{sum(len(d["i"])//3 for d in self.parts.values()):,} triangles; '
              f'{len(self.joints) if skinned else 0} joints; {clip_count} clips')


def smooth(x):
    x = max(0, min(1, x))
    return x*x*(3-2*x)


def keyed(t, keys):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if t <= b:
            return va+(vb-va)*smooth((t-a)/(b-a))
    return keys[-1][1]


def locomotion(t, running=False):
    # +Z is forward. Reverse the cycle so knee flexion happens on the forward
    # recovery stroke, not while the planted foot sweeps backwards.
    phase = -TAU*t
    swing = 31 if running else 19
    state = {'Chest': (8 if running else 2, 0, 2*math.sin(phase)),
             'Head': (-4 if running else -1, 0, -math.sin(phase)),
             '_hips': (0.018*math.sin(phase), (0.035 if running else 0.015)*(1-math.cos(2*phase)), 0)}
    for side, offset in [('L', 0), ('R', math.pi)]:
        p = phase+offset
        state['UpperLeg_'+side] = (swing*math.sin(p), 0, 0)
        state['LowerLeg_'+side] = ((48 if running else 25)*max(0, math.cos(p)), 0, 0)
        state['Foot_'+side] = (-swing*math.sin(p)*0.4-8*max(0, math.cos(p)), 0, 0)
        state['UpperArm_'+side] = (-swing*math.sin(p)*0.75, 0, 0)
        state['LowerArm_'+side] = (-40 if running else -12, 0, 0)
    return state


def action_pose(name, t):
    if name == 'Idle':
        breath = math.sin(TAU*t)
        return {'Chest': (breath*1.2, 0, 0), 'Head': (-breath*0.8, breath, 0),
                'UpperArm_L': (0, 0, breath*1.5), 'UpperArm_R': (0, 0, -breath*1.5), '_hips': (0, breath*0.008, 0)}
    if name in ('Walk', 'Run'):
        return locomotion(t, name == 'Run')
    if name == 'Attack_01':
        wind = keyed(t, [(0,0),(.3,1),(.47,-.55),(.68,-.35),(1,0)])
        strike = keyed(t, [(0,0),(.28,.25),(.47,1),(.7,.7),(1,0)])
        return {'Chest': (strike*7, -wind*23, 0), 'Head': (-strike*4, wind*10, 0),
                'UpperArm_R': (-wind*80-strike*40, -wind*18, -wind*16),
                'LowerArm_R': (-30*abs(wind), 0, 0), 'UpperArm_L': (-15*strike, 0, -12*strike),
                'UpperLeg_L': (-strike*10, 0, 0), 'LowerLeg_L': (strike*13, 0, 0), '_hips': (0,-.035*strike,0)}
    if name == 'Cast':
        lift = keyed(t, [(0,0),(.3,1),(.75,1),(1,0)])
        pulse = math.sin(TAU*2*t)*lift
        return {'UpperArm_L': (-62*lift, -15*lift, -18*lift), 'UpperArm_R': (-62*lift, 15*lift, 18*lift),
                'LowerArm_L': (-26*lift, 0, 0), 'LowerArm_R': (-26*lift, 0, 0),
                'Hand_L': (0, 0, -12*lift), 'Hand_R': (0, 0, 12*lift),
                'Head': (8*lift, 0, 0), 'Chest': (-4*lift, 0, 0), '_hips': (0,.012*pulse,0)}
    if name == 'Hit':
        hit = keyed(t, [(0,0),(.18,1),(.5,.45),(1,0)])
        return {'Chest': (-14*hit, -8*hit, 3*hit), 'Head': (-9*hit, 0, 0),
                'UpperArm_L': (15*hit, 0, -10*hit), 'UpperArm_R': (15*hit, 0, 10*hit), '_hips': (0,-.025*hit,0)}
    if name == 'Death':
        return action_pose('Knockdown', 1)
    if name == 'Knockdown':
        fall = keyed(t, [(0,0),(.2,.04),(.65,1),(1,1)])
        settle = keyed(t, [(0,0),(.55,0),(.75,1),(1,1)])
        return {'Root': (-90*fall, 0, 0), '_root': (0,.46*fall,-.18*fall),
                'UpperArm_L': (0, 0, -22*fall), 'UpperArm_R': (0, 0, 22*fall),
                'LowerArm_L': (-8*settle, 0, 0), 'LowerArm_R': (-8*settle, 0, 0), 'Head': (5*settle, 0, 0)}
    if name == 'Victory':
        lift = keyed(t, [(0,0),(.2,1),(.75,1),(1,0)])
        wave = math.sin(TAU*3*t)*lift
        return {'UpperArm_R': (-140*lift, 0, 18*lift), 'LowerArm_R': (-12*lift, 0, 18*wave),
                'UpperArm_L': (-10*lift, 0, -12*lift), 'Head': (0, 5*wave, -5*lift),
                '_hips': (0,.035*(1-math.cos(TAU*2*t))*lift,0)}
    return {}


def build():
    m = Model()
    for name, pos, parent in [('Root',(0,0,0),None), ('Hips',(0,1.07,0),'Root'),
                              ('Spine',(0,1.28,0),'Hips'), ('Chest',(0,1.55,0),'Spine'),
                              ('Neck',(0,1.79,0),'Chest'), ('Head',(0,1.91,0),'Neck')]:
        m.bone(name, pos, parent)
    for side, s in [('L',1),('R',-1)]:
        for name, pos, parent in [
            ('Shoulder',(s*.29,1.61,0),'Chest'), ('UpperArm',(s*.36,1.58,0),'Shoulder_'+side),
            ('LowerArm',(s*.52,1.28,.01),'UpperArm_'+side), ('Hand',(s*.62,1.04,.04),'LowerArm_'+side),
            ('UpperLeg',(s*.16,1.03,0),'Hips'), ('LowerLeg',(s*.17,.57,.02),'UpperLeg_'+side),
            ('Foot',(s*.17,.14,.06),'LowerLeg_'+side)]:
            m.bone(name+'_'+side, pos, parent)
        m.bone('Weapon_'+side, (s*.62,.995,.105), 'Hand_'+side)
    m.bone('Head_Attachment', (0,2.86,0), 'Head')
    m.bone('Back_Attachment', (0,1.57,-.23), 'Chest')

    skin = m.material('Skin_Peach', (.73,.43,.28), .82)
    hair = m.material('Hair_Chestnut', (.21,.086,.038), .66)
    hair_light = m.material('Hair_WarmHighlights', (.31,.14,.065), .65)
    ivory = m.material('Clothes_Ivory', (.88,.79,.61), .92)
    teal = m.material('Trim_Sage', (.085,.25,.22), .85)
    leather = m.material('Boots_Leather', (.12,.058,.03), .9)
    dark = m.material('Face_Dark', (.024,.008,.006), .55)
    white = m.material('Eyes_White', (.98,.95,.86), .42)
    iris = m.material('Eyes_Honey', (.24,.085,.018), .45)
    blush = m.material('Face_Blush', (.62,.19,.14), .88)
    gold = m.material('Buckle_Gold', (.72,.38,.08), .4, .55)
    def sphere(part, material, bone, center, radius, **kwargs):
        m.ellipsoid((part, material), bone, center, radius, **kwargs)

    sphere('Body',skin,'Hips',(0,1.13,0),(.275,.255,.19))
    sphere('Shorts_Waist',ivory,'Hips',(0,1.075,0),(.284,.202,.203))
    sphere('Top',ivory,'Chest',(0,1.48,0),(.285,.285,.205))
    sphere('Waist',teal,'Spine',(0,1.25,.005),(.283,.064,.211))
    sphere('Buckle',gold,'Spine',(0,1.25,.217),(.044,.041,.018),segments=12,rings=8)
    sphere('Neck',skin,'Neck',(0,1.79,0),(.112,.14,.105))
    sphere('Head_Face',skin,'Head',(0,2.28,0),(.45,.49,.375),segments=24,rings=18)
    def hairline(theta):
        front = math.sin(theta)
        return 1.72-.6*front if front >= 0 else 1.72-.65*front
    sphere('Hair_Cap',hair,'Head',(0,2.35,-.025),(.473,.51,.404),segments=24,rings=14,cap=hairline)
    for x, y, z, tilt in [(-.32,2.51,.28,-22),(-.19,2.57,.34,-18),(-.055,2.59,.37,-14),(.10,2.60,.365,15),(.25,2.55,.32,23)]:
        sphere('Hair_Fringe',hair_light,'Head',(x,y,z),(.106,.235,.077),tilt=tilt,segments=14,rings=10)
    for side, s in [('L',1),('R',-1)]:
        sphere('Ears',skin,'Head',(s*.437,2.25,-.005),(.075,.115,.075))
        sphere('Hair_SideLocks',hair,'Head',(s*.422,2.32,-.025),(.085,.245,.13),tilt=s*7)
        sphere('Eye_Liner',dark,'Head',(s*.175,2.29,.340),(.119,.145,.037),segments=20,rings=14)
        sphere('Eye_Whites',white,'Head',(s*.175,2.288,.357),(.108,.128,.032),segments=20,rings=14)
        sphere('Eye_Iris',iris,'Head',(s*.171,2.283,.383),(.075,.102,.022),segments=20,rings=14)
        sphere('Eye_Pupils',dark,'Head',(s*.171,2.292,.401),(.039,.065,.012),segments=16,rings=12)
        sphere('Eye_Glint',white,'Head',(s*.171-.023,2.334,.413),(.024,.030,.007),segments=12,rings=8)
        sphere('Eye_Glint',white,'Head',(s*.171+.027,2.257,.407),(.009,.012,.005),segments=10,rings=6)
        sphere('Brows',hair,'Head',(s*.174,2.473,.344),(.085,.017,.017),tilt=-s*8,segments=12,rings=8)
        sphere('Cheeks',blush,'Head',(s*.275,2.159,.297),(.043,.018,.009),segments=12,rings=8)
        m.limb(('Arms',skin),'UpperArm_'+side,'LowerArm_'+side,'Hand_'+side,.100,.082,.061)
        sphere('Shoulders',skin,'Shoulder_'+side,(s*.292,1.588,0),(.124,.113,.121))
        sphere('Sleeves',ivory,'UpperArm_'+side,(s*.364,1.526,0),(.118,.135,.116),tilt=-s*22)
        sphere('Hands',skin,'Hand_'+side,(s*.644,.997,.045),(.077,.106,.072))
        sphere('Thumbs',skin,'Hand_'+side,(s*.590,.999,.095),(.038,.056,.035),segments=12,rings=8)
        sphere('Shorts',ivory,'UpperLeg_'+side,(s*.158,.98,0),(.151,.18,.198))
        m.limb(('Legs',skin),'UpperLeg_'+side,'LowerLeg_'+side,'Foot_'+side,.134,.105,.077)
        sphere('Boots',leather,'Foot_'+side,(s*.17,.123,.117),(.12,.12,.209),segments=18,rings=12)
        sphere('Boot_Cuffs',teal,'LowerLeg_'+side,(s*.17,.275,.027),(.103,.105,.102))
    sphere('Nose',skin,'Head',(0,2.192,.375),(.040,.044,.034),segments=12,rings=8)
    # A curved row of small pieces forms a restrained smile, rather than a flat black bar.
    for i in range(9):
        x = (i-4)*.012
        sphere('Smile',dark,'Head',(x,2.095+10*x*x,.348),(.010,.008,.008),segments=8,rings=6)
    for i in range(6):
        y = 2.21-i*.107
        x = .402+(.022 if i%2 else -.022)
        sphere('Hair_Braid',hair_light if i%2 else hair,'Head',(x,y,-.246),(.092-i*.004,.088,.091),tilt=(-1 if i%2 else 1)*22,segments=14,rings=10)
    sphere('Hair_Tie',teal,'Head',(.407,1.605,-.245),(.063,.035,.066),segments=12,rings=8)
    sphere('Hair_Tail',hair,'Head',(.412,1.52,-.25),(.052,.083,.051),segments=12,rings=8)

    for name, duration in [('Idle',2.4),('Walk',1.1),('Run',.72),('Attack_01',.95),('Cast',1.8),
                           ('Hit',.5),('Knockdown',1.5),('Death',1.0),('Victory',2.2)]:
        m.animation(name,duration,lambda t,n=name: action_pose(n,t))
    m.write()


if __name__ == '__main__':
    build()
