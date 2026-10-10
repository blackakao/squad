import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from './CharacterViewer.js?v=20261010-visual8';

export const EQUIPMENT_SLOTS=Object.freeze(['head','body','hands','feet','mainHand','offHand']);
export const EMPTY_EQUIPMENT=Object.freeze(Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,null])));
export const OUTFIT_PALETTE=Object.freeze([
  {id:'default',name:'01 기본색',primary:null,secondary:null,trim:null},
  {id:'black',name:'02 검정',primary:'#20242b',secondary:'#343a43',trim:'#aeb4bb'},
  {id:'white',name:'03 흰색',primary:'#e7e4dc',secondary:'#c8c4ba',trim:'#777b82'},
  {id:'gray',name:'04 회색',primary:'#69717a',secondary:'#9299a0',trim:'#c4c8cc'},
  {id:'brown',name:'05 갈색',primary:'#70462f',secondary:'#a36a42',trim:'#d0a66e'},
  {id:'navy',name:'06 네이비',primary:'#263f62',secondary:'#42688e',trim:'#b3c5d8'},
  {id:'red',name:'07 빨강',primary:'#873a3a',secondary:'#b45a50',trim:'#e1b098'},
  {id:'green',name:'08 초록',primary:'#3f654f',secondary:'#67876c',trim:'#c0c99b'}
]);
export const WEAPON_VISUALS=Object.freeze({oneHandSword:'oneHandSword',twoHandSword:'twoHandSword',oneHandMace:'oneHandMace',twoHandMace:'twoHandMace',staff:'staff',bow:'bow',gun:'gun','방패':'shield','치유서':'healingBook'});
export const ARMOR_VISUALS=Object.freeze({plate:'armor_plate',chain:'armor_chain',leather:'armor_leather',cloth:'armor_cloth'});

const material=(name,color,metalness=.15,role='primary')=>{const value=new THREE.MeshStandardMaterial({name,color,roughness:.55,metalness});value.userData.materialRole=role;value.userData.baseColor=color;return value;};
const add=(group,name,geometry,mat,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>{
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.scale.set(...scale);group.add(mesh);return mesh;
};
const group=name=>{const value=new THREE.Group();value.name=name;return value;};

function fittedShellGeometry(rings,segments=18){
  const vertices=[],indices=[];
  for(const ring of rings)for(let i=0;i<segments;i++){
    const angle=i/segments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),front=(ring.front||0)*Math.max(0,s);
    vertices.push(c*ring.x,ring.y,s*ring.z+front);
  }
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<segments;i++){
    const next=(i+1)%segments,a=row*segments+i,b=row*segments+next,c=(row+1)*segments+i,d=(row+1)*segments+next;
    indices.push(a,b,c,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function torsoRings(bodyType,outer=.012){
  const female=bodyType==='female',shape=female
    ?[{y:.13,x:.13,z:.105},{y:.075,x:.205,z:.13},{y:-.035,x:.195,z:.155,front:.035},{y:-.19,x:.16,z:.125},{y:-.33,x:.185,z:.135}]
    :[{y:.13,x:.14,z:.10},{y:.075,x:.22,z:.12},{y:-.045,x:.205,z:.135,front:.012},{y:-.19,x:.17,z:.11},{y:-.31,x:.18,z:.12}];
  return shape.map(r=>({...r,x:r.x+outer,z:r.z+outer}));
}
function taperedPanelGeometry(top,bottom,height,depth=.018){
  const y0=.02,y1=-height,verts=[-top/2,y0,0,top/2,y0,0,-bottom/2,y1,0,bottom/2,y1,0,-top/2,y0,-depth,top/2,y0,-depth,-bottom/2,y1,-depth,bottom/2,y1,-depth];
  const idx=[0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(idx);geometry.computeVertexNormals();return geometry;
}
function hipRings(bodyType,outer=.014){
  const female=bodyType==='female';
  return (female
    ?[{y:.07,x:.172,z:.125},{y:0,x:.198,z:.15},{y:-.09,x:.205,z:.16},{y:-.16,x:.178,z:.135}]
    :[{y:.07,x:.178,z:.118},{y:0,x:.194,z:.138},{y:-.09,x:.198,z:.145},{y:-.16,x:.17,z:.124}])
    .map(r=>({...r,x:r.x+outer,z:r.z+outer}));
}

function sword(){
  const root=group('Test_Sword_01'),steel=material('Test_Steel','#cbd5df',.75),leather=material('Test_Grip','#50301f'),gold=material('Test_Guard','#c89b3c',.65);
  add(root,'Sword_Grip',new THREE.CylinderGeometry(.018,.021,.16,10),leather,[0,0,0]);
  add(root,'Sword_Guard',new THREE.BoxGeometry(.18,.025,.035),gold,[0,.09,0]);
  add(root,'Sword_Blade',new THREE.BoxGeometry(.055,.48,.018),steel,[0,.34,0]);
  add(root,'Sword_Tip',new THREE.ConeGeometry(.039,.10,4),steel,[0,.63,0],[0,Math.PI/4,0]);return root;
}
function spear(){
  const root=group('Test_Spear_01'),wood=material('Test_Shaft','#6d4328'),steel=material('Test_Steel','#d4dde5',.75);
  add(root,'Spear_Shaft',new THREE.CylinderGeometry(.012,.014,1.15,10),wood,[0,.15,0]);
  add(root,'Spear_Head',new THREE.ConeGeometry(.045,.22,5),steel,[0,.835,0]);return root;
}
function shield(){
  const root=group('Test_Shield_01'),face=material('Test_Shield','#426a88',.3),rim=material('Test_Rim','#b9c3c9',.7);
  add(root,'Shield_Face',new THREE.CylinderGeometry(.24,.24,.045,20),face,[0,0,.075],[Math.PI/2,0,0],[.82,1,1]);
  add(root,'Shield_Rim',new THREE.TorusGeometry(.24,.018,8,24),rim,[0,0,.102],[0,0,0],[.82,1,1]);return root;
}
function helmet(){
  const root=group('Test_Helmet_01'),steel=material('Test_Armor','#66798b',.65),rim=material('Test_Trim','#b7c1c8',.75);
  add(root,'Helmet_Cap',new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.58),steel,[0,.03,0],[0,0,0],[.37,.34,.37]);
  add(root,'Helmet_Rim',new THREE.TorusGeometry(1,.07,8,28),rim,[0,-.015,0],[Math.PI/2,0,0],[.36,.35,.34]);return root;
}
function armor({fit={},bodyType='male'}={}){
  const root=group('Test_Armor_01'),steel=material('Test_Armor','#596d7f',.6,'primary'),trim=material('Test_Trim','#aeb9bf',.7,'trim');
  const rings=torsoRings(bodyType,.026);add(root,'Armor_TorsoShell',fittedShellGeometry(rings),steel);
  add(root,'Armor_ChestBand',new THREE.TorusGeometry(1,.045,6,20),trim,[0,-.02,.015],[Math.PI/2,0,0],[rings[2].x,rings[2].z,rings[2].z]);
  add(root,'Armor_WaistBand',new THREE.TorusGeometry(1,.05,6,20),trim,[0,-.255,.005],[Math.PI/2,0,0],[rings[4].x*.93,rings[4].z*.93,rings[4].z*.93]);
  const shoulderX=fit.shoulderX??.22,shoulder=fit.shoulder||[.075,.065,.095];
  for(const side of [-1,1])add(root,'Armor_Shoulder',new THREE.SphereGeometry(1,14,9),steel,[side*shoulderX,.075,.005],[0,0,side*.18],shoulder);return root;
}
function glove(side){
  const root=group(`Test_Glove_${side}`),steel=material('Test_Armor','#596d7f',.55);
  add(root,'Glove',new THREE.SphereGeometry(1,14,9),steel,[0,0,0],[0,0,0],[.075,.095,.065]);return root;
}
function boot(side,fit={}){
  const root=group(`Test_Boot_${side}`),leather=material('Test_Leather','#4a3026');
  const ankle=fit.ankle||[.082,.098,.22],toe=fit.toe||[.094,.082,.19],heel=fit.heel||[.088,.086,.085];
  add(root,'Boot_Ankle',new THREE.CylinderGeometry(ankle[0],ankle[1],ankle[2],12),leather,[0,.03,.015]);
  add(root,'Boot_Instep',new THREE.SphereGeometry(1,14,9),leather,[0,-.055,.075],[0,0,0],[toe[0],toe[1]*1.12,toe[2]*.72]);
  add(root,'Boot_Toe',new THREE.SphereGeometry(1,14,9),leather,[0,-.085,.145],[0,0,0],toe);
  add(root,'Boot_Heel',new THREE.SphereGeometry(1,12,8),leather,[0,-.08,-.025],[0,0,0],heel);return root;
}

const ARMOR_FIT=Object.freeze({male:{chest:[.21,.235,.13],waist:[.175,.12,.12],back:[.19,.22,.07],side:[.048,.185,.1],shoulder:[.06,.052,.078],shoulderX:.205},female:{chest:[.18,.22,.115],waist:[.15,.115,.105],back:[.165,.205,.065],side:[.043,.17,.09],shoulder:[.048,.045,.068],shoulderX:.19}});
const BOOT_FIT=Object.freeze({male:{ankle:[.084,.1,.225],toe:[.096,.084,.195],heel:[.09,.088,.088]},female:{ankle:[.078,.093,.212],toe:[.09,.079,.182],heel:[.084,.082,.082]}});

const OUTFIT_STYLES=Object.freeze({
  plate:{name:'플레이트 갑옷',color:'#596d7f',accent:'#aeb9bf',metalness:.6,torso:'plate',upperSleeve:.58,lowerSleeve:0,upperLeg:.54,lowerLeg:0},
  chain:{name:'사슬갑옷',color:'#59636b',accent:'#aab1b5',metalness:.5,torso:'tunic',upperSleeve:.72,lowerSleeve:.25,upperLeg:.42,lowerLeg:0},
  leather:{name:'가죽갑옷',color:'#6a4028',accent:'#b57a42',metalness:.08,torso:'vest',upperSleeve:.48,lowerSleeve:.42,upperLeg:.5,lowerLeg:0},
  cloth:{name:'판타지 천옷',color:'#345f87',accent:'#d7c28c',metalness:0,torso:'robe',upperSleeve:.96,lowerSleeve:.92,upperLeg:.94,lowerLeg:.92},
  tuxedo:{name:'턱시도',color:'#20242b',accent:'#f1eee8',metalness:.05,torso:'jacket',upperSleeve:.96,lowerSleeve:.94,upperLeg:.96,lowerLeg:.94},
  casual:{name:'셔츠 + 청바지',color:'#d5e2e8',accent:'#35638d',metalness:0,torso:'shirt',upperSleeve:.42,lowerSleeve:0,upperLeg:.96,lowerLeg:.94}
});
const OUTFIT_MOUNTS=Object.freeze([
  {anchor:'body',role:'torso'},{anchor:'hips',role:'hips'},
  {anchor:'leftUpperArm',role:'upperArm',side:'L'},{anchor:'rightUpperArm',role:'upperArm',side:'R'},
  {anchor:'leftLowerArm',role:'lowerArm',side:'L'},{anchor:'rightLowerArm',role:'lowerArm',side:'R'},
  {anchor:'leftUpperLeg',role:'upperLeg',side:'L'},{anchor:'rightUpperLeg',role:'upperLeg',side:'R'},
  {anchor:'leftLowerLeg',role:'lowerLeg',side:'L'},{anchor:'rightLowerLeg',role:'lowerLeg',side:'R'}
]);

function segmentPart({role,side,segment,bodyType},style){
  const root=group(`${style.name}_${role}_${side||''}`),ratio=bodyType==='female'?.9:1;
  const coverage=style[role==='upperArm'?'upperSleeve':role==='lowerArm'?'lowerSleeve':role==='upperLeg'?'upperLeg':'lowerLeg'];
  if(!coverage||!segment?.length)return root;
  const leg=/Leg/.test(role),upper=/^upper/.test(role),radius=(leg?(upper?.118:.092):(upper?.074:.062))*ratio;
  const secondary=leg&&style.torso==='shirt';const mat=material(`Outfit_${style.torso}`,secondary?style.accent:style.color,style.metalness,secondary?'secondary':'primary');
  const direction=new THREE.Vector3(...segment.direction),length=segment.length*coverage;
  if(style.torso==='robe'&&leg&&upper){
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),direction.clone().normalize());
    for(const z of [-.075,.075]){const panel=add(root,`Robe_${side}_${z<0?'Back':'Front'}`,taperedPanelGeometry(.16,.205,length,.018),mat,[0,0,z]);panel.quaternion.copy(q);}
    return root;
  }
  const mesh=add(root,`${role}_${side}`,new THREE.CylinderGeometry(radius*(upper?1.08:1),radius,length,12),mat);
  mesh.position.copy(direction.clone().normalize().multiplyScalar(length*.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  add(root,`${role}_JointCover_${side}`,new THREE.SphereGeometry(radius*1.04,10,7),mat,[0,0,0]);
  return root;
}

function torsoPart({bodyType},style){
  if(style.torso==='plate')return armor({fit:ARMOR_FIT[bodyType]||ARMOR_FIT.male,bodyType});
  const root=group(`${style.name}_Torso`),ratio=bodyType==='female'?.9:1,main=material(`Outfit_${style.torso}`,style.color,style.metalness,'primary'),accent=material(`Outfit_${style.torso}_Accent`,style.accent,style.metalness*.5,'secondary');
  const rings=torsoRings(bodyType,['jacket','shirt','robe'].includes(style.torso)?.022:.014),front=rings[2].z;
  if(style.torso==='jacket'){
    add(root,'Tuxedo_Jacket',fittedShellGeometry(rings),main);
    add(root,'Tuxedo_Shirt',taperedPanelGeometry(.10,.072,.20,.012),accent,[0,.065,front+.026],[0,Math.PI,0]);
    for(const side of [-1,1])add(root,'Tuxedo_Lapel',taperedPanelGeometry(.06,.022,.17,.012),accent,[side*.035,.07,front+.04],[0,Math.PI,side*.18]);
    add(root,'Tuxedo_Bow',new THREE.OctahedronGeometry(.04,0),main,[0,.105,front+.055],[0,0,Math.PI/4],[1.5,.7,.45]);
  }else{
    add(root,`${style.torso}_Torso`,fittedShellGeometry(rings),main);
    if(style.torso==='vest')add(root,'Leather_Belt',new THREE.TorusGeometry(1,.055,7,18),accent,[0,-.27,.01],[Math.PI/2,0,0],[rings[4].x*.92,rings[4].z*.92,rings[4].z*.92]);
    if(style.torso==='robe')add(root,'Robe_Belt',new THREE.TorusGeometry(1,.045,7,18),accent,[0,-.265,.01],[Math.PI/2,0,0],[rings[4].x*.94,rings[4].z*.94,rings[4].z*.94]);
    if(style.torso==='shirt')add(root,'Shirt_Collar',new THREE.TorusGeometry(.075,.018,6,16,Math.PI),accent,[0,.105,.105],[Math.PI/2,0,0]);
  }
  return root;
}

function hipPart({bodyType},style){
  const root=group(`${style.name}_Hips`),ratio=bodyType==='female'?.92:1,main=material(`Outfit_${style.torso}_Hip`,style.torso==='shirt'?style.accent:style.color,style.metalness,'primary');
  if(style.torso==='robe'){
    add(root,'Robe_WaistFront',taperedPanelGeometry(.34*ratio,.40*ratio,.27,.025),main,[0,.04,.135]);
    add(root,'Robe_WaistBack',taperedPanelGeometry(.34*ratio,.40*ratio,.27,.025),main,[0,.04,-.135],[0,Math.PI,0]);
    for(const side of [-1,1])add(root,'Robe_WaistSide',taperedPanelGeometry(.25*ratio,.29*ratio,.25,.025),main,[side*.155,.03,0],[0,side*Math.PI/2,0]);
  }else{
    add(root,'Outfit_HipShell',fittedShellGeometry(hipRings(bodyType,style.torso==='plate'?.024:.012)),main,[0,0,0]);
  }
  return root;
}

function outfitPart(context,key){const style=OUTFIT_STYLES[key];if(context.role==='torso')return torsoPart(context,style);if(context.role==='hips')return hipPart(context,style);return segmentPart(context,style);}
const outfitDescriptor=(id,key)=>({id,name:OUTFIT_STYLES[key].name,slot:'body',mounts:OUTFIT_MOUNTS,fitProfile:{male:{},female:{}},outfit:key,rigidSegmented:true,create:context=>outfitPart(context,key)});

export const TEST_EQUIPMENT=Object.freeze([
  {id:'testHelmet01',name:'테스트 투구',slot:'head',mounts:[{anchor:'head'}],appearanceOverride:{hairMode:'partial',hairVisibility:{cap:false,front:false,side:true,back:true,style:true}},transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},create:helmet},
  outfitDescriptor('testArmor01','plate'),
  outfitDescriptor('testChainmail01','chain'),
  outfitDescriptor('testLeather01','leather'),
  outfitDescriptor('testCloth01','cloth'),
  outfitDescriptor('testTuxedo01','tuxedo'),
  outfitDescriptor('testCasual01','casual'),
  {id:'testGloves01',name:'테스트 장갑',slot:'hands',mounts:[{anchor:'leftHand',side:'L'},{anchor:'rightHand',side:'R'}],transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},create:({side})=>glove(side)},
  {id:'testBoots01',name:'테스트 부츠',slot:'feet',mounts:[{anchor:'leftFoot',side:'L'},{anchor:'rightFoot',side:'R'}],fitProfile:BOOT_FIT,appearanceOverride:{hideBodyParts:['feet'],fallback:'fittedShell'},transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},create:({side,fit})=>boot(side,fit)},
  {id:'testSword01',name:'테스트 검',slot:'mainHand',mounts:[{anchor:'mainHand'}],poseProfile:{grip:'oneHandGrip'},transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},create:sword},
  {id:'testSpear01',name:'테스트 창',slot:'mainHand',mounts:[{anchor:'mainHand'}],poseProfile:{grip:'oneHandGrip'},transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},create:spear},
  {id:'testShield01',name:'테스트 방패',slot:'offHand',mounts:[{anchor:'shieldGrip'}],transform:{position:[.11,0,.035],rotation:[0,.18,0],scale:[1,1,1]},create:shield}
]);

export function normalizeEquipment(value={}){
  const source=value&&typeof value==='object'?value:{};const output={...EMPTY_EQUIPMENT};
  for(const slot of EQUIPMENT_SLOTS){const id=source[slot];output[slot]=TEST_EQUIPMENT.some(item=>item.slot===slot&&item.id===id)?id:null;}
  output.outfitColor=OUTFIT_PALETTE.some(entry=>entry.id===source.outfitColor)?source.outfitColor:'default';
  return output;
}

function first(root,names){for(const name of names){const node=root.getObjectByName(name);if(node)return node;}return null;}
function alignedAnchor(root,bone,name,point=null){
  if(!bone)return null;const anchor=new THREE.Group();anchor.name=name;root.updateMatrixWorld(true);
  if(point)anchor.position.set(...point);else{const e=bone.matrixWorld.elements;const world=new THREE.Vector3(e[12],e[13],e[14]);anchor.position.copy(root.worldToLocal(world));}
  root.add(anchor);root.updateMatrixWorld(true);bone.attach(anchor);return anchor;
}
function segmentAnchor(root,bone,next,name){
  const anchor=alignedAnchor(root,bone,name);if(!anchor||!next)return anchor;
  root.updateMatrixWorld(true);const start=root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())),end=root.worldToLocal(next.getWorldPosition(new THREE.Vector3()));
  const direction=end.sub(start);anchor.userData.segment={direction:direction.toArray(),length:direction.length()};return anchor;
}
function childAnchor(parent,name){if(!parent)return null;const anchor=new THREE.Group();anchor.name=name;parent.add(anchor);return anchor;}
function applyTransform(instance,transform={}){instance.position.set(...(transform.position||[0,0,0]));instance.rotation.set(...(transform.rotation||[0,0,0]));instance.scale.set(...(transform.scale||[1,1,1]));}
async function createInstance(item,mount,bodyType){
  if(item.url)return (await new GLTFLoader().loadAsync(item.url)).scene;
  return item.create({...mount,bodyType,fit:item.fitProfile?.[bodyType]||item.fitProfile?.male||{}});
}

export class EquipmentPreview{
  constructor(viewer=null){
    this.viewer=viewer;this.root=null;this.anchors={};this.attached=new Map();this.state={...EMPTY_EQUIPMENT,outfitColor:'default'};this.tokens={};
    this.poseBones=[];this.hiddenParts=new Map();
    this.removeAnimationModifier=viewer?.addAnimationModifier({before:()=>this.restorePose(),after:()=>this.applyPose()});
  }
  setModel(root){this.clearModel();this.root=root;if(root)this.buildAnchors();}
  buildAnchors(){
    const root=this.root,head=first(root,['mixamorigHead','Head']),chest=first(root,['mixamorigSpine2','Chest','Spine']);
    const leftHand=first(root,['mixamorigLeftHand','Hand_L']),rightHand=first(root,['mixamorigRightHand','Hand_R']);
    const leftFoot=first(root,['mixamorigLeftFoot','Foot_L']),rightFoot=first(root,['mixamorigRightFoot','Foot_R']);
    const hips=first(root,['mixamorigHips','Hips']),leftUpperArm=first(root,['mixamorigLeftArm','UpperArm_L']),rightUpperArm=first(root,['mixamorigRightArm','UpperArm_R']);
    const leftLowerArm=first(root,['mixamorigLeftForeArm','LowerArm_L']),rightLowerArm=first(root,['mixamorigRightForeArm','LowerArm_R']);
    const leftUpperLeg=first(root,['mixamorigLeftUpLeg','UpperLeg_L']),rightUpperLeg=first(root,['mixamorigRightUpLeg','UpperLeg_R']);
    const leftLowerLeg=first(root,['mixamorigLeftLeg','LowerLeg_L']),rightLowerLeg=first(root,['mixamorigRightLeg','LowerLeg_R']);
    const profile=root.userData.sdAppearance||{};let headPoint=profile.blank?[0,profile.base==='male'?1.405:1.43,.025]:null;
    if(!headPoint){const headMesh=first(root,['Head_Face','headfront']);if(headMesh){root.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(headMesh,true).getCenter(new THREE.Vector3());headPoint=root.worldToLocal(center);}}
    this.anchors={
      head:alignedAnchor(root,head,'HeadEquipmentAnchor',headPoint),body:alignedAnchor(root,chest,'BodyEquipmentAnchor'),
      leftHand:alignedAnchor(root,leftHand,'LeftHandEquipmentAnchor'),rightHand:alignedAnchor(root,rightHand,'RightHandEquipmentAnchor'),
      leftFoot:alignedAnchor(root,leftFoot,'LeftFootEquipmentAnchor'),rightFoot:alignedAnchor(root,rightFoot,'RightFootEquipmentAnchor'),
      hips:alignedAnchor(root,hips,'HipEquipmentAnchor'),
      leftUpperArm:segmentAnchor(root,leftUpperArm,leftLowerArm,'LeftUpperArmEquipmentAnchor'),rightUpperArm:segmentAnchor(root,rightUpperArm,rightLowerArm,'RightUpperArmEquipmentAnchor'),
      leftLowerArm:segmentAnchor(root,leftLowerArm,leftHand,'LeftLowerArmEquipmentAnchor'),rightLowerArm:segmentAnchor(root,rightLowerArm,rightHand,'RightLowerArmEquipmentAnchor'),
      leftUpperLeg:segmentAnchor(root,leftUpperLeg,leftLowerLeg,'LeftUpperLegEquipmentAnchor'),rightUpperLeg:segmentAnchor(root,rightUpperLeg,rightLowerLeg,'RightUpperLegEquipmentAnchor'),
      leftLowerLeg:segmentAnchor(root,leftLowerLeg,leftFoot,'LeftLowerLegEquipmentAnchor'),rightLowerLeg:segmentAnchor(root,rightLowerLeg,rightFoot,'RightLowerLegEquipmentAnchor'),
      mainHand:root.getObjectByName('Weapon_R')?childAnchor(root.getObjectByName('Weapon_R'),'MainHandEquipmentAnchor'):alignedAnchor(root,rightHand,'MainHandEquipmentAnchor'),
      offHand:root.getObjectByName('Weapon_L')?childAnchor(root.getObjectByName('Weapon_L'),'OffHandEquipmentAnchor'):alignedAnchor(root,leftHand,'OffHandEquipmentAnchor')
    };
    this.anchors.shieldGrip=childAnchor(this.anchors.offHand,'ShieldGripAnchor');
  }
  remove(slot){
    for(const instance of this.attached.get(slot)||[]){instance.removeFromParent();disposeObject(instance);}
    this.attached.delete(slot);
  }
  descriptor(slot){const id=this.state[slot];return TEST_EQUIPMENT.find(item=>item.slot===slot&&item.id===id)||null;}
  bodyType(){return this.root?.userData.sdAppearance?.base||'male';}
  refreshOverrides(){
    if(!this.root)return;
    const hairOverride=this.descriptor('head')?.appearanceOverride;
    const hair=this.root.getObjectByName('Hair_Anchor')||this.root.getObjectByName('Independent_Hair');
    for(const [node,visible] of this.hiddenParts)node.visible=visible;
    this.hiddenParts.clear();
    if(hair){
      hair.visible=true;
      if(hairOverride?.hairMode==='hide'){this.hiddenParts.set(hair,true);hair.visible=false;}
      if(hairOverride?.hairMode==='partial')hair.traverse(node=>{
        if(!node.isMesh)return;
        const role=/(InternalScalpCover|CrownHair|Hair_(Cap|Scalp|Crown|Bun|HalfBun|Band))/.test(node.name)?'cap':/(Hairline|FrontHair)/.test(node.name)?'front':/(SideHair|LeftWave|RightWave)/.test(node.name)?'side':/BackHair/.test(node.name)?'back':'style';
        if(hairOverride.hairVisibility?.[role]===false){this.hiddenParts.set(node,node.visible);node.visible=false;}
      });
    }
    const hideFeet=this.descriptor('feet')?.appearanceOverride?.hideBodyParts?.includes('feet');
    if(hideFeet)this.root.traverse(node=>{
      if(!node.isMesh||node.name==='Mesh_0'||!/(^|_)(foot|feet)(_|$)/i.test(node.name))return;
      this.hiddenParts.set(node,node.visible);node.visible=false;
    });
  }
  restorePose(){for(const entry of this.poseBones)if(entry.applied)entry.bone.quaternion.copy(entry.animation);}
  applyPose(){
    if(!this.root)return;this.poseBones=[];
    const add=(names,euler)=>{const bone=first(this.root,names);if(!bone)return;const animation=bone.quaternion.clone();bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)));this.poseBones.push({bone,animation,applied:true});};
    if(this.descriptor('mainHand')?.poseProfile?.grip==='oneHandGrip')add(['mixamorigRightHandMiddle4','RightHandMiddle4'],[1.05,0,0]);
  }
  async equip(slot,id){
    const token=this.tokens[slot]=(this.tokens[slot]||0)+1;this.remove(slot);this.state[slot]=id||null;
    if(!id||!this.root){this.refreshOverrides();return;}const item=TEST_EQUIPMENT.find(entry=>entry.slot===slot&&entry.id===id);if(!item)throw new Error(`${slot}: 지원하지 않는 테스트 장비입니다.`);
    const instances=[];
    for(const mount of item.mounts){const anchor=this.anchors[mount.anchor];if(!anchor)throw new Error(`${item.name}: ${mount.anchor} 장착 본을 찾지 못했습니다.`);
      const instance=await createInstance(item,{...mount,segment:anchor.userData.segment},this.bodyType());if(token!==this.tokens[slot]||!this.root){disposeObject(instance);continue;}applyTransform(instance,{...item.transform,...mount.transform});anchor.add(instance);instances.push(instance);}
    if(instances.length)this.attached.set(slot,instances);if(slot==='body')this.setOutfitColor(this.state.outfitColor);
    this.refreshOverrides();
  }
  setOutfitColor(id='default'){
    const palette=OUTFIT_PALETTE.find(entry=>entry.id===id)||OUTFIT_PALETTE[0];this.state.outfitColor=palette.id;
    for(const root of this.attached.get('body')||[])root.traverse(node=>{for(const mat of [].concat(node.material||[])){
      if(!mat?.color)continue;const role=mat.userData.materialRole||(/Trim|Accent|Shirt/.test(mat.name)?'trim':'primary');
      const color=palette.id==='default'?mat.userData.baseColor:palette[role];if(color){mat.color.set(color);mat.needsUpdate=true;}
    }});
  }
  async apply(state){const normalized=normalizeEquipment(state);this.state.outfitColor=normalized.outfitColor;await Promise.all(EQUIPMENT_SLOTS.map(slot=>this.equip(slot,normalized[slot])));this.setOutfitColor(normalized.outfitColor);return this.getState();}
  getState(){return {...this.state};}
  clearEquipment(){return this.apply(EMPTY_EQUIPMENT);}
  clearModel(){this.restorePose();for(const [node,visible] of this.hiddenParts)node.visible=visible;this.hiddenParts.clear();for(const slot of EQUIPMENT_SLOTS){this.tokens[slot]=(this.tokens[slot]||0)+1;this.remove(slot);}for(const anchor of Object.values(this.anchors))anchor?.removeFromParent();this.anchors={};this.poseBones=[];this.root=null;}
}

export function setupEquipment(viewer){
  const byId=id=>document.getElementById(id),preview=new EquipmentPreview(viewer);
  const selects=Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,byId(`equip-${slot}`)]));
  const status=byId('equipment-status');let operation=0;
  const colorSelect=byId('equip-outfit-color');colorSelect.replaceChildren(...OUTFIT_PALETTE.map(entry=>new Option(entry.name,entry.id)));
  colorSelect.addEventListener('change',()=>{preview.setOutfitColor(colorSelect.value);status.textContent='복장 색상을 변경했습니다.';});
  for(const [slot,select] of Object.entries(selects)){
    select.replaceChildren(new Option('없음',''),...TEST_EQUIPMENT.filter(item=>item.slot===slot).map(item=>new Option(item.name,item.id)));
    select.addEventListener('change',async()=>{const ticket=++operation;status.textContent='장비 교체 중…';try{await preview.equip(slot,select.value||null);if(ticket===operation)status.textContent='장착 완료 · 외형 상태와 독립된 개발용 장비입니다.';}catch(error){if(ticket===operation)status.textContent=error.message;}});
  }
  byId('equip-clear').addEventListener('click',async()=>{Object.values(selects).forEach(select=>select.value='');++operation;await preview.clearEquipment();status.textContent='모든 테스트 장비를 해제했습니다.';});
  const syncControls=()=>{for(const select of Object.values(selects))select.disabled=!preview.root;byId('equipment-controls').disabled=!preview.root;};
  syncControls();
  return {
    preview,getState:()=>preview.getState(),refreshOverrides:()=>preview.refreshOverrides(),
    async setState(value){const state=normalizeEquipment(value);for(const [slot,select] of Object.entries(selects))select.value=state[slot]||'';colorSelect.value=state.outfitColor;++operation;await preview.apply(state);status.textContent='저장한 장비 조합을 복원했습니다.';},
    async setModel(root){preview.setModel(root);syncControls();if(root){await preview.apply({...Object.fromEntries(Object.entries(selects).map(([slot,select])=>[slot,select.value||null])),outfitColor:colorSelect.value});status.textContent='장비 테스트 준비 완료';}},
    clear(){preview.clearModel();syncControls();status.textContent='모델을 불러오면 장비를 장착할 수 있습니다.';}
  };
}
