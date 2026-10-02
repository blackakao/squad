"""Add grip sockets and appearance masks without changing source skin/animation data.

Requires Pillow (already used locally); no runtime package dependency.
"""
import io
import json
import math
from pathlib import Path
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def prepare(gender, source):
    raw = source.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    binary = bytearray(raw[28 + size:])

    def read(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        code = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
        fmt = '<' + code * count
        stride = v.get('byteStride', struct.calcsize(fmt))
        start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(a['count'])]

    def append(values, kind):
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        for row in values:
            binary.extend(struct.pack('<' + 'f' * len(row), *row))
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset})
        doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(values), 'type': kind})
        return len(doc['accessors']) - 1

    # Inverse bind matrices place world-space grip centers into each hand's bind frame.
    skin = doc['skins'][0]
    inverses = dict(zip(skin['joints'], read(skin['inverseBindMatrices'])))
    nodes = doc['nodes']
    names = {n.get('name'): i for i, n in enumerate(nodes)}
    def world(index):
        m = inverses[index]
        return [-sum(m[r * 4 + c] * m[12 + c] for c in range(3)) for r in range(3)]

    def socket(name, parent, position, weapon=False):
        p = names[parent]
        m = inverses[p]
        # Desired world axes: blade +Z, transverse +X, local +Z points -Y.
        axes = [(1, 0, 0), (0, 0, 1), (0, -1, 0)] if weapon else [(1, 0, 0), (0, 1, 0), (0, 0, 1)]
        matrix = []
        for axis in axes:
            matrix.extend([sum(m[k * 4 + r] * axis[k] for k in range(3)) * (0.60 if weapon else 1) for r in range(3)] + [0])
        matrix.extend([sum(m[k * 4 + r] * position[k] for k in range(3)) + m[12 + r] for r in range(3)] + [1])
        nodes[p].setdefault('children', []).append(len(nodes))
        nodes.append({'name': name, 'matrix': matrix, 'extras': {'attachment': True, 'purpose': 'weapon grip' if weapon else 'accessory'}})

    for side in ('Left', 'Right'):
        hand = world(names['mixamorig:' + side + 'Hand'])
        tip = world(names['mixamorig:' + side + 'HandMiddle4'])
        grip = [a + (b - a) * .36 for a, b in zip(hand, tip)]
        socket('Weapon_' + ('L' if side == 'Left' else 'R'), 'mixamorig:' + side + 'Hand', grip, True)
    socket('Head_Attachment', 'mixamorig:Head', world(names['mixamorig:HeadTop_End']))
    back = world(names['mixamorig:Spine2']); back[2] -= .12
    socket('Back_Attachment', 'mixamorig:Spine2', back)

    primitive = doc['meshes'][0]['primitives'][0]
    pos = read(primitive['attributes']['POSITION'])
    uv = read(primitive['attributes']['TEXCOORD_0'])
    material = doc['materials'][primitive['material']]
    tex = material['pbrMetallicRoughness']['baseColorTexture']['index']
    image = doc['images'][doc['textures'][tex]['source']]
    view = doc['bufferViews'][image['bufferView']]
    im = Image.open(io.BytesIO(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])).convert('RGB')
    masks = []
    for (x, y, z), (u, v) in zip(pos, uv):
        r, g, b = im.getpixel((min(im.width - 1, max(0, int(u * im.width))), min(im.height - 1, max(0, int(v * im.height)))))
        # Texture-derived labels preserve the original hair silhouette and clothing.
        hair = y > .80 and ((r > g * 1.05 and g > b * 1.18 and r < 175) if gender == 'male' else (g - b > 36 and r - g < 40 and r < 245))
        skin_pixel = r > g + 12 and r > b + 15 and g - b < 38 and r > 110
        masks.append((float(hair), float(skin_pixel and not hair)))
    primitive['attributes']['_SD_MASK'] = append(masks, 'VEC2')
    doc['scenes'][doc.get('scene', 0)].setdefault('extras', {})['sdAppearance'] = {'version': 2, 'base': gender, 'source': source.name}
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    output = ROOT / 'assets/characters/base' / ('human_sd_' + gender + '_v2.glb')
    output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary)
    print(gender, 'vertices', len(pos), 'hair', sum(m[0] for m in masks), 'skin', sum(m[1] for m in masks), 'bytes', output.stat().st_size)


if __name__ == '__main__':
    prepare('male', ROOT / 'assets/characters/base/남성SD캐릭터.glb')
    prepare('female', ROOT / 'assets/characters/base/여성SD캐릭터.glb')
