import * as THREE from 'three';
import { ImportedAppearance } from './ImportedAppearance.js?v=20261010-visual20';
import { BaldAppearance } from './BaldAppearance.js?v=20261010-visual20';
import { BlankAppearance } from './BlankAppearance.js?v=20261010-visual20';
import { disposeObject } from '../character-viewer/CharacterViewer.js?v=20261010-visual7';

const ORIGINAL_PARTS = ['Hair_Cap','Hair_Fringe','Hair_SideLocks','Hair_Braid','Hair_Tie','Hair_Tail',
  'Eye_Liner','Eye_Whites','Eye_Iris','Eye_Pupils','Eye_Glint','Brows','Nose','Smile','Cheeks'];

function createParts(style) {
  const root = new THREE.Group(); root.name = 'Portrait_Appearance';
  // Meshes are authored in the base model's bind coordinates; Head is at Y=1.91.
  root.position.y = -1.91;
  const mat = (color,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness});
  const skin = mat(PortraitCatalog.skins.find(s=>s.id===style.skin).color);
  const hairTone=globalThis.HairColorCatalog?.find(c=>c.id===style.hairColor)||globalThis.HairColorCatalog?.[0];
  const hair = mat(hairTone?.dark||'#794425'), highlight = mat(hairTone?.light||'#965b34'), dark = mat('#342016');
  hair.name='Hair_Dark';highlight.name='Hair_Light';
  const white = mat('#fff4de',.4), iris = mat('#9f612d',.4), pupil=mat('#21120d',.4);
  const pink = mat('#d4817c'), mouth = mat('#713a35'), teeth = white, ribbon=mat('#448779');
  const materials = [skin,hair,highlight,dark,white,iris,pupil,pink,mouth,ribbon];
  function ellipsoid(name,material,position,scale,angle=0) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,16,12),material);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.z=angle;
    root.add(mesh); return mesh;
  }
  function line(name,material,points,radius=.008) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,20,radius,6,false),material);
    mesh.name=name;root.add(mesh);return mesh;
  }
  function lock(start,end,width=.085,depth=.055,material=highlight) {
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
    const center=a.clone().add(b).multiplyScalar(.5);
    const mesh=ellipsoid('Hair_Lock',material,center.toArray(),[width,a.distanceTo(b)/2+.04,depth]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),a.sub(b).normalize());
    return mesh;
  }
  function cap(front=1.13,back=2.1) {
    const vertices=[],normals=[],indices=[],cols=32,rows=18;
    for(let y=0;y<=rows;y++) for(let x=0;x<=cols;x++) {
      const theta=x/cols*Math.PI*2;
      const end=1.65+(Math.sin(theta)>0?(front-1.65)*Math.sin(theta):(back-1.65)*-Math.sin(theta));
      const phi=y/rows*end;
      const dx=Math.sin(phi)*Math.cos(theta),dy=Math.cos(phi),dz=Math.sin(phi)*Math.sin(theta);
      vertices.push(dx*.476,2.35+dy*.505,-.025+dz*.411);
      const n=new THREE.Vector3(dx/.476,dy/.505,dz/.411).normalize();normals.push(...n.toArray());
      if(y<rows&&x<cols){const a=y*(cols+1)+x,b=a+cols+1;if(y>0)indices.push(a,a+1,b);indices.push(a+1,b+1,b);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,hair);mesh.name='Hair_Cap';root.add(mesh);
  }
  function fringe(type='straight') {
    for(let i=0;i<5;i++) {
      const x=(i-2)*.145;
      if(type==='part'&&i===2)continue;
      const start=[x*.65,2.78-.05*Math.abs(i-2),.23];
      const end=[type==='side'?x+.09:x, type==='short'?2.61:type==='part'?2.46:2.49+.06*Math.abs(i-2),.37-.2*x*x];
      lock(start,end,type==='short'?.065:.085,.064);
    }
  }
  function braid(x,top=2.23,count=6) {
    for(let i=0;i<count;i++)ellipsoid('Hair_Braid',i%2?highlight:hair,[x+(i%2?.026:-.026),top-i*.11,-.255],[.089-i*.004,.084,.087],i%2?.3:-.3);
    ellipsoid('Hair_Tie',ribbon,[x,top-count*.11+.02,-.255],[.063,.032,.065]);
    ellipsoid('Hair_Tail',hair,[x,top-count*.11-.07,-.255],[.051,.084,.056]);
  }
  const male=style.hair.startsWith('m'),id=Number(style.hair.slice(1));
  cap(male&&id===8?.95:male&&id===3?.95:1.13,male?1.95:2.25);
  if(male) {
    if(id===1)fringe('short');
    if(id===2){fringe('side');lock([-.34,2.64,.27],[-.42,2.31,.13],.072,.065);}
    if(id===3)for(let i=0;i<7;i++){const x=(i-3)*.115;lock([x*.85,2.7,.11],[x*1.3,2.94+.10*Math.cos(i),.15],.077,.08);}
    if(id===4)fringe('part');
    if(id===5)for(let i=0;i<6;i++)line('Hair_Swept',highlight,[[(i-2.5)*.13,2.57,.32],[(i-2.5)*.12,2.86,.02],[(i-2.5)*.11,2.6,-.33]],.045);
    if(id===6){for(let i=0;i<7;i++)lock([(i-3)*.11,2.69,.24],[(i-3)*.11,2.47,.35],.075,.07);}
    if(id===7){fringe('part');for(const s of [-1,1])for(let i=0;i<4;i++)ellipsoid('Hair_Wave',highlight,[s*(.37+.025*(i%2)),2.55-i*.1,.02],[.095,.11,.14]);}
    if(id===8){for(let i=0;i<4;i++)lock([-.2+i*.11,2.65,.31],[.02+i*.08,2.99,.08],.095,.09);}
    if(id===9){lock([-.25,2.77,.05],[.34,2.67,.30],.13,.11);lock([-.22,2.82,-.06],[.29,2.74,.12],.11,.09);}
    if(id===10){fringe('side');for(const s of [-1,1])for(let i=0;i<4;i++)lock([s*.37,2.53-i*.09,-.04],[s*(.49+.025*(i%2)),2.30-i*.10,-.02],.078,.1);}
  } else {
    fringe(id===8||id===3?'side':id===10||id===2?'part':'straight');
    if([1,7].includes(id))for(const s of [-1,1])for(let i=0;i<4;i++)lock([s*(.38+.025*i),2.58-i*.05,-.08],[s*(id===7?.45+.045*Math.sin(i):.43),1.99-i*.025,-.06-i*.07],.085,.13);
    if([2,10].includes(id))for(let i=0;i<7;i++)lock([(i-3)*.13,2.45,-.31],[(i-3)*.145,1.30+.06*Math.abs(i-3),-.35],.105,.12,hair);
    if(id===3){ellipsoid('Hair_Tie',ribbon,[0,2.62,-.44],[.13,.08,.065]);lock([0,2.66,-.46],[.06,1.62,-.52],.19,.16);}
    if(id===4)for(const s of [-1,1]){ellipsoid('Hair_Tie',ribbon,[s*.46,2.46,-.14],[.06,.10,.08]);lock([s*.50,2.54,-.12],[s*.61,1.65,-.17],.13,.15);}
    if(id===5){ellipsoid('Hair_Bun',hair,[0,2.91,-.12],[.22,.22,.19]);ellipsoid('Hair_BunBand',ribbon,[0,2.78,-.12],[.19,.035,.18]);}
    if(id===6){braid(-.43);braid(.43);}
    if(id===8)braid(.43);
    if(id===9)for(const s of [-1,1]){ellipsoid('Hair_Bun',highlight,[s*.45,2.70,-.09],[.17,.17,.16]);ellipsoid('Hair_Band',ribbon,[s*.40,2.66,-.06],[.07,.12,.10]);}
    if(id===10){ellipsoid('Hair_HalfTie',ribbon,[0,2.48,-.43],[.12,.04,.06]);for(const s of [-1,1])lock([s*.36,2.59,.12],[s*.41,2.03,.07],.075,.085);}
  }
  const eyeId=Number(style.eyes.slice(3));
  const settings=[[.106,.125,0],[.12,.095,0],[.129,.057,0],[.11,.093,-.20],[.11,.10,.20],[.115,.069,-.07],[.104,.125,0],[.124,.146,0]];
  for(const s of [-1,1]) {
    const x=s*.175,y=2.29,z=.357;
    if(eyeId<=8) {
      const [w,h,tilt]=settings[eyeId-1];
      ellipsoid('Eye_Liner',dark,[x,y,z-.014],[w+.011,h+.012,.033],s*tilt);
      ellipsoid('Eye_Whites',white,[x,y,z],[w,h,.029],s*tilt);
      ellipsoid('Eye_Iris',iris,[x,y-.003,z+.023],[w*.66,h*.79,.021],s*tilt);
      ellipsoid('Eye_Pupil',pupil,[x,y+.003,z+.040],[w*.34,h*.5,.010]);
      ellipsoid('Eye_Glint',white,[x-.024,y+h*.37,z+.051],[.02,.024,.006]);
      if(eyeId===7){line('Eye_Sparkle',white,[[x+.025,y-.043,z+.052],[x+.025,y+.001,z+.052]],.006);line('Eye_Sparkle',white,[[x+.008,y-.021,z+.052],[x+.044,y-.021,z+.052]],.006);}
    } else {
      const points=[];for(let i=0;i<=8;i++){const t=i/8;points.push([x-.095+t*.19,y+(eyeId===9?1:-1)*.045*Math.sin(Math.PI*t),z+.013]);}
      line('Eye_Closed',dark,points,.012);
    }
    const browId=Math.max(1,Math.min(5,Number(style.eyebrows?.slice(4))||1)),browY=2.472;
    const browPoints=browId===2?[[-.071,0,0],[0,0,.006],[.072,0,0]]
      :browId===3?[[-.071,-.006,0],[0,.020,.012],[.072,-.006,0]]
      :browId===4?[[-.071,-s*.018,0],[0,0,.008],[.072,s*.018,0]]
      :browId===5?[[-.071,s*.018,0],[0,0,.008],[.072,-s*.018,0]]
      :[[-.071,-.006,0],[0,.010,.010],[.072,0,0]];
    line('Brow',hair,browPoints.map(p=>[x+p[0],browY+p[1],.337+p[2]]),.013);
    ellipsoid('Cheek',pink,[s*.276,2.15,.298],[.039,.015,.006]);
  }
  const noseId=Number(style.nose.slice(4));
  const sizes=[[.038,.043,.034],[.024,.026,.022],[.029,.064,.036],[.036,.042,.058],[.060,.030,.029]];
  if(noseId===4){const mesh=new THREE.Mesh(new THREE.ConeGeometry(.04,.10,5),skin);mesh.name='Nose';mesh.rotation.x=Math.PI/2;mesh.position.set(0,2.188,.389);root.add(mesh);}
  else ellipsoid('Nose',skin,[0,2.191,.37],sizes[noseId-1]);
  const mouthId=Number(style.mouth.slice(5));
  if([4,5,7,8].includes(mouthId)) {
    const scales={4:[.06,.032,.012],5:[.083,.045,.012],7:[.031,.048,.012],8:[.034,.020,.013]};
    ellipsoid('Mouth',mouth,[0,2.087,.348],scales[mouthId]);
    if(mouthId===5)ellipsoid('Teeth',teeth,[0,2.103,.358],[.066,.016,.005]);
    if(mouthId===8)ellipsoid('Lip',pink,[0,2.075,.359],[.022,.008,.004]);
  } else {
    const points=[];const width=mouthId===2?.065:.115;
    for(let i=0;i<=10;i++){const x=-width/2+width*i/10,t=i/10;
      const offset=mouthId===1||mouthId===2?-.025*Math.sin(Math.PI*t):mouthId===6?.022*Math.sin(Math.PI*t):mouthId===9?.022*t:mouthId===10?.012*Math.sin(t*Math.PI*3):0;
      points.push([x,2.097+offset,.347]);}
    line('Mouth',mouth,points,.007);
  }
  // Dispose materials which were allocated for optional features but never used.
  const used=new Set();root.traverse(n=>{if(n.material)used.add(n.material);});
  materials.filter(m=>!used.has(m)).forEach(m=>m.dispose());
  return root;
}

export class Appearance {
  constructor(){this.root=null;this.parts=null;this.hidden=[];this.colors=new Map();}
  setModel(root){
    this.clear();this.root=root;
    if(!root?.userData.sdAppearance&&root?.getObjectByName('mixamorigHead')&&root?.getObjectByName('headfront')){
      const box=new THREE.Box3().setFromObject(root),base=box.max.x-box.min.x>1.29?'male':'female';
      const faceLayout=base==='male'
        ?{foreheadLift:.095,eyeY:1.30,eyeFront:.320,eyeSpacing:.105,noseFront:.328,mouthY:1.095,mouthFront:.298,crownBulge:0}
        :{foreheadLift:.125,eyeY:1.34,eyeFront:.249,eyeSpacing:.098,noseFront:.270,mouthY:1.160,mouthFront:.232,crownBulge:.055};
      root.userData.sdAppearance={version:3,blank:true,base,headScale:base==='male'?1.32:1.24,hairDepth:base==='male'?-.070:-.050,...faceLayout};
    }
    if(root?.userData.sdAppearance?.blank){this.imported=new BlankAppearance(root.userData.sdAppearance);return this.imported.setModel(root);}
    if(root?.userData.sdAppearance?.bald){this.imported=new BaldAppearance();return this.imported.setModel(root);}
    if(root?.userData.sdAppearance){this.imported=new ImportedAppearance();return this.imported.setModel(root);}
    return Boolean(root?.getObjectByName('Head_Face')&&root?.getObjectByName('Head'));
  }
  get supportedFields(){return this.imported?.supportedFields||null;}
  filterOptions(field,entries){return this.imported?.filterOptions?this.imported.filterOptions(field,entries):entries;}
  apply(value,fields=null){
    if(this.imported){this.imported.apply(value,fields);return;}
    const style=PortraitCatalog.normalize(value);
    if(!style||!this.root?.getObjectByName('Head_Face'))throw new Error('怨듯넻 SD 踰좎씠?ㅼ뿉???명삎 議고빀???ъ슜?????덉뒿?덈떎.');
    const requested=new Set(fields||Object.keys(PortraitCatalog.fields));
    if(requested.size===1&&requested.has('hairColor')&&this.parts){
      const tone=globalThis.HairColorCatalog?.find(c=>c.id===style.hairColor)||globalThis.HairColorCatalog?.[0];
      this.parts.traverse(node=>{for(const material of [].concat(node.material||[])){
        if(material.name==='Hair_Dark')material.color.set(tone.dark);
        if(material.name==='Hair_Light')material.color.set(tone.light);
      }});this.style=style;return;
    }
    if(this.parts){this.parts.removeFromParent();disposeObject(this.parts);}
    if(!this.hidden.length)for(const name of ORIGINAL_PARTS){const node=this.root.getObjectByName(name);if(node){this.hidden.push([node,node.visible]);node.visible=false;}}
    const color=PortraitCatalog.skins.find(s=>s.id===style.skin).color;
    this.root.traverse(node=>{for(const material of [].concat(node.material||[]))if(material.name==='Skin_Peach'){if(!this.colors.has(material))this.colors.set(material,material.color.clone());material.color.set(color);}});
    this.parts=createParts(style);this.root.getObjectByName('Head').add(this.parts);this.style=style;
  }
  clear(){
    this.imported?.clear();this.imported=null;
    if(this.parts){this.parts.removeFromParent();disposeObject(this.parts);}
    this.hidden.forEach(([node,visible])=>{node.visible=visible;});this.colors.forEach((color,material)=>material.color.copy(color));
    this.root=null;this.parts=null;this.hidden=[];this.colors.clear();
  }
}
