"""Rig the user's bald SD mesh and add appearance/equipment anchors."""
import json
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'assets/characters/base/빡빡이 캐릭터.glb';OUTPUT=ROOT/'assets/characters/base/human_sd_bald_v1.glb'
raw=SOURCE.read_bytes();json_size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+json_size]);binary=bytearray(raw[28+json_size:])

def read_accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];code={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']]
    fmt='<'+code*dims;stride=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from(fmt,binary,start+i*stride) for i in range(a['count'])]

def append(values,kind,component=5126,target=None):
    dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[kind];code={5126:'f',5123:'H',5125:'I'}[component]
    while len(binary)%4:binary.append(0)
    offset=len(binary)
    for row in values:binary.extend(struct.pack('<'+code*dims,*row))
    view={'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset}
    if target:view['target']=target
    doc['bufferViews'].append(view);doc['accessors'].append({'bufferView':len(doc['bufferViews'])-1,'componentType':component,'count':len(values),'type':kind});return len(doc['accessors'])-1

nodes=doc['nodes'];scene=doc['scenes'][doc.get('scene',0)];world={};indices={}
def bone(name,position,parent=None):
    index=len(nodes);world[name]=position;indices[name]=index;local=position if parent is None else tuple(position[i]-world[parent][i] for i in range(3));nodes.append({'name':name,'translation':list(local)})
    (scene.setdefault('nodes',[]) if parent is None else nodes[indices[parent]].setdefault('children',[])).append(index)
bone('Root',(0,-.95,0));bone('Hips',(0,-.08,0),'Root');bone('Spine',(0,.08,0),'Hips');bone('Chest',(0,.22,0),'Spine');bone('Neck',(0,.34,0),'Chest');bone('Head',(0,.545,0),'Neck')
for side,sign in [('L',1),('R',-1)]:
    bone('Shoulder_'+side,(sign*.18,.245,0),'Chest');bone('UpperArm_'+side,(sign*.27,.22,0),'Shoulder_'+side);bone('LowerArm_'+side,(sign*.46,.20,0),'UpperArm_'+side);bone('Hand_'+side,(sign*.62,.19,0),'LowerArm_'+side)
    bone('UpperLeg_'+side,(sign*.105,-.12,0),'Hips');bone('LowerLeg_'+side,(sign*.105,-.52,.015),'UpperLeg_'+side);bone('Foot_'+side,(sign*.105,-.84,.045),'LowerLeg_'+side)
def attachment(name,parent,local):
    index=len(nodes);nodes.append({'name':name,'translation':list(local),'extras':{'attachment':True}});nodes[indices[parent]].setdefault('children',[]).append(index)
attachment('Weapon_L','Hand_L',(.055,-.005,.025));attachment('Weapon_R','Hand_R',(-.055,-.005,.025));attachment('Head_Attachment','Head',(0,.33,0));attachment('Back_Attachment','Chest',(0,.02,-.11))

joint_names=list(indices);joint_map={name:i for i,name in enumerate(joint_names)};positions=read_accessor(doc['meshes'][0]['primitives'][0]['attributes']['POSITION']);joint_rows=[];weight_rows=[]
def assign(x,y,z):
    ax=abs(x);side='L' if x>=0 else 'R'
    if y>.31:return 'Head'
    if ax>.19 and y>0:return ('Hand_' if ax>.57 else 'LowerArm_' if ax>.40 else 'UpperArm_' if ax>.22 else 'Shoulder_')+side
    if y<-.05:return ('Foot_' if y<-.78 else 'LowerLeg_' if y<-.47 else 'UpperLeg_')+side
    return 'Chest' if y>.18 else 'Spine' if y>.04 else 'Hips'
for p in positions:
    joint_rows.append((joint_map[assign(*p)],0,0,0));weight_rows.append((1,0,0,0))
primitive=doc['meshes'][0]['primitives'][0];primitive['attributes']['JOINTS_0']=append(joint_rows,'VEC4',5123,34962);primitive['attributes']['WEIGHTS_0']=append(weight_rows,'VEC4',5126,34962)
inverse=[]
for name in joint_names:
    x,y,z=world[name];inverse.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
doc['skins']=[{'name':'SD_Humanoid_Bald_v1','joints':[indices[n] for n in joint_names],'skeleton':indices['Root'],'inverseBindMatrices':append(inverse,'MAT4')}];nodes[0]['skin']=0
scene['extras']={'sdAppearance':{'version':3,'base':'bald','bald':True,'headCenter':[0,.545,0],'headScale':1.55,'hairDepth':.055,'source':SOURCE.name},'rigVersion':'SD_Humanoid_Bald_v1'}
doc['asset']['generator']=doc['asset'].get('generator','')+' + Project Bald SD Rig Adapter v1';doc['buffers'][0]['byteLength']=len(binary)
encoded=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8');encoded+=b' '*(-len(encoded)%4);binary+=b'\0'*(-len(binary)%4)
OUTPUT.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+encoded[:0]+binary)
print(OUTPUT,OUTPUT.stat().st_size,'vertices',len(positions),'joints',len(joint_names))
