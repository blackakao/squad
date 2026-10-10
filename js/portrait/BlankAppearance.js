import * as THREE from 'three';
import { createIndependentHair, setIndependentHairColor } from './IndependentHair.js?v=20261010-visual20';
import { disposeObject } from '../character-viewer/CharacterViewer.js?v=20261010-visual7';
import { capturePartSpace, rootPointToPartLocal } from './PartSpace.js?v=20261007-parts2';

const EYES=[
  {w:1.12,h:.76,tilt:.18,iris:.82,lid:'angry'},{w:1,h:1,tilt:0,iris:1},{w:1.04,h:.72,closed:'smile'},
  {w:1.08,h:.72,tilt:.02,iris:.92,lid:'sleepy'},{w:1.08,h:.78,iris:.88,lid:'flat'},{w:.96,h:1.28,iris:1.08},
  {w:1.02,h:.9,tilt:-.15,iris:.95,lid:'sad'},{w:1.27,h:.62,iris:.8},{w:1.02,h:.92,iris:.95,wink:true},
  {w:1.04,h:1.06,iris:1.02,cat:true}
];
const hairTone=id=>globalThis.HairColorCatalog?.find(color=>color.id===id)||globalThis.HairColorCatalog?.[0];

export class BlankAppearance {
  constructor(profile){this.profile=profile;this.supportedFields=['hair','hairColor','eyes','eyeColor','eyebrows','nose','mouth'];}
  filterOptions(field,entries){return ['nose','mouth'].includes(field)?entries.slice(0,5):entries;}
  setModel(root){
    this.clear();this.root=root;const head=root?.getObjectByName('mixamorigHead');
    if(!head||!root?.getObjectByName('headfront'))return false;
    this.head=head;this.partSpace=capturePartSpace(root,head);this.hairProfile={...this.profile,partSpace:this.partSpace};this.radial=this.profile.headScale||1;
    const centerY=this.profile.eyeY-.08;this.faceAnchor=new THREE.Group();this.faceAnchor.name='Face_Anchor';head.add(this.faceAnchor);this.faceAnchor.position.copy(this.toHead([0,centerY,0]));
    this.eyeAnchor=this.makeAnchor('Eye_Anchor',[0,this.profile.eyeY,this.profile.eyeFront]);
    this.eyebrowAnchor=this.makeAnchor('Eyebrow_Anchor',[0,this.profile.eyeY+.092,this.profile.eyeFront+.002]);
    this.noseAnchor=this.makeAnchor('Nose_Anchor',[0,this.profile.eyeY-.105,this.profile.noseFront??this.profile.eyeFront+.018]);
    this.mouthAnchor=this.makeAnchor('Mouth_Anchor',[0,this.profile.mouthY??this.profile.eyeY-.205,this.profile.mouthFront??this.profile.eyeFront+.018]);return true;
  }
  toHead(point){return rootPointToPartLocal(this.partSpace,point);}
  makeAnchor(name,point){const anchor=new THREE.Group();anchor.name=name;anchor.position.copy(this.toHead(point).sub(this.faceAnchor.position));this.faceAnchor.add(anchor);return anchor;}
  replace(property,anchor,group){const previous=this[property];previous?.removeFromParent();if(previous)disposeObject(previous);anchor.add(group);this[property]=group;}
  material(name,color,roughness=.5){return new THREE.MeshStandardMaterial({name,color,roughness});}
  sphere(group,name,material,position,scale,rotation=0,segments=16){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,segments,12),material);mesh.name=name;mesh.position.set(...position.map(v=>v*this.radial));mesh.scale.set(...scale.map(v=>v*this.radial));mesh.rotation.z=rotation;group.add(mesh);return mesh;}
  tube(group,name,material,points,radius=.006){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p.map(v=>v*this.radial))));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,12,radius*this.radial,6,false),material);mesh.name=name;group.add(mesh);return mesh;}
  applyHair(style){this.hair?.userData.dispose();this.hair=createIndependentHair(this.root,this.hairProfile,style.hair,style.hairColor);}
  applyHairColor(style){if(!setIndependentHairColor(this.hair,style.hairColor))this.applyHair(style);const tone=hairTone(style.hairColor);this.eyebrows?.traverse(node=>{for(const material of [].concat(node.material||[]))if(material.name==='Eyebrow_Hair')material.color.set(tone.dark);});}
  applyEyes(style){
    const group=new THREE.Group();group.name='Independent_Eyes';const index=Math.max(0,Number(style.eyes.slice(3))-1),shape=EYES[index]||EYES[1];
    const color=globalThis.ImportedPortraitCatalog.eyeColors.find(entry=>entry.id===style.eyeColor)?.color||'#5077a5';
    const liner=this.material('Eye_Liner_Material','#251a19',.48),white=this.material('Eye_White_Material','#fffaf4',.38),iris=this.material('Eye_Iris_Material',color,.32),pupil=this.material('Eye_Pupil_Material','#171214',.42),glint=new THREE.MeshBasicMaterial({name:'Eye_Glint_Material',color:'#ffffff'});
    const closedEye=(x,side,kind)=>{const arc=kind==='smile'?[[x-.065,.002,0],[x,.035,.004],[x+.065,.002,0]]:[[x-.065,.015,0],[x,0,.003],[x+.065,.015,0]];this.tube(group,'Eye_Closed',liner,arc,.007);};
    for(const side of [-1,1]){
      const x=side*this.profile.eyeSpacing,isWink=shape.wink&&side===1;if(shape.closed||isWink){closedEye(x,side,shape.closed);continue;}
      const y=(shape.tilt||0)*side*.014,rotation=-side*(shape.tilt||0),w=shape.w,h=shape.h;
      this.sphere(group,'Eye_Liner',liner,[x,y,0],[.081*w,.063*h,.006],rotation,20);this.sphere(group,'Eye_White',white,[x,y,.003],[.072*w,.053*h,.0045],rotation,20);
      const irisScale=shape.iris||1;this.sphere(group,'Eye_Iris',iris,[x,y,.006],[.034*irisScale,.039*irisScale,.003],0,20);
      this.sphere(group,'Eye_Pupil',pupil,[x,y,.009],[shape.cat?.006:.014,shape.cat?.027:.022,.002],0,20);this.sphere(group,'Eye_Glint',glint,[x-side*.011,y+.016,.011],[.008,.009,.0015],0,12);
      if(shape.lid){const outer=x+side*.067,inner=x-side*.067,centerY=shape.lid==='sleepy'?y+.026:shape.lid==='angry'?y+.034:y+.02;const outerY=shape.lid==='sad'?centerY+.016:shape.lid==='angry'?centerY-.018:centerY;this.tube(group,'Eye_UpperLid',liner,[[inner,centerY-.004,.013],[x,centerY+.012,.014],[outer,outerY,.013]],.006);}
    }
    this.replace('eyes',this.eyeAnchor,group);
  }
  applyEyebrows(style){
    const group=new THREE.Group();group.name='Independent_Eyebrows';const tone=hairTone(style.hairColor),material=this.material('Eyebrow_Hair',tone?.dark||'#35170d',.68),id=Math.max(1,Math.min(5,Number(style.eyebrows?.slice(4))||1));
    for(const side of [-1,1]){const x=side*this.profile.eyeSpacing,w=.058;let points;if(id===2)points=[[-w,0,0],[0,0,0],[w,0,0]];else if(id===3)points=[[-w,-.004,0],[0,.014,.004],[w,-.004,0]];else if(id===4)points=[[-w,-side*.014,0],[0,0,.002],[w,side*.014,0]];else if(id===5)points=[[-w,side*.013,0],[0,0,.002],[w,-side*.013,0]];else points=[[-w,-.003,0],[0,.009,.003],[w,.002,0]];this.tube(group,'Eyebrow',material,points.map(p=>[x+p[0],p[1],p[2]]),.0075);}
    this.replace('eyebrows',this.eyebrowAnchor,group);
  }
  applyNose(style){
    const group=new THREE.Group();group.name='Independent_Nose';const skin=ImportedPortraitCatalog.skins.find(s=>s.id===style.skin)?.color||'#f4d5c1',material=this.material('Nose_Skin',new THREE.Color(skin).multiplyScalar(.94),.72),id=Math.max(1,Math.min(5,Number(style.nose.slice(4))||1)),scales=[[.015,.019,.013],[.020,.017,.014],[.014,.024,.017],[.012,.014,.010],[.013,.027,.013]][id-1];
    if(id===3){const mesh=new THREE.Mesh(new THREE.ConeGeometry(.014*this.radial,.036*this.radial,7),material);mesh.name='Nose';mesh.rotation.x=Math.PI/2;mesh.position.z=.010*this.radial;group.add(mesh);}else this.sphere(group,'Nose',material,[0,0,.008],scales);this.replace('nose',this.noseAnchor,group);
  }
  applyMouth(style){
    const group=new THREE.Group();group.name='Independent_Mouth';const lip=this.material('Mouth_Lip','#7b3f48',.58),inside=this.material('Mouth_Inside','#421f2a',.62),id=Math.max(1,Math.min(5,Number(style.mouth.slice(5))||1));
    if(id===5){this.sphere(group,'Mouth',inside,[0,0,.002],[.037,.018,.0035]);this.tube(group,'Lip',lip,[[-.034,.004,.004],[0,.010,.005],[.034,.004,.004]],.0025);}else{const width=id===2?.032:.052,curve=id===3?.018:id===4?0:.008,points=[];for(let i=0;i<=8;i++){const t=i/8;points.push([-width+width*2*t,-curve*Math.sin(Math.PI*t),.003]);}this.tube(group,'Mouth',lip,points,id===2?.0022:.0028);}this.replace('mouth',this.mouthAnchor,group);
  }
  apply(style,fields=null){if(!this.root)return;const requested=new Set(fields||this.supportedFields);if(requested.has('hair'))this.applyHair(style);else if(requested.has('hairColor'))this.applyHairColor(style);if(requested.has('eyes')||requested.has('eyeColor'))this.applyEyes(style);if(requested.has('eyebrows'))this.applyEyebrows(style);if(requested.has('nose'))this.applyNose(style);if(requested.has('mouth'))this.applyMouth(style);}
  clear(){this.hair?.userData.dispose();this.hair=null;this.faceAnchor?.removeFromParent();if(this.faceAnchor)disposeObject(this.faceAnchor);this.faceAnchor=null;this.eyeAnchor=null;this.eyebrowAnchor=null;this.noseAnchor=null;this.mouthAnchor=null;this.eyes=null;this.eyebrows=null;this.nose=null;this.mouth=null;this.head=null;this.root=null;this.partSpace=null;this.hairProfile=null;}
}

