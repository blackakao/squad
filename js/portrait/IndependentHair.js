import * as THREE from 'three';
import { disposeObject } from '../character-viewer/CharacterViewer.js?v=20260926-equipment1';
import { capturePartSpace, rootPointToPartLocal } from './PartSpace.js?v=20261007-parts2';

function getHairColors(id){
  const entry=globalThis.HairColorCatalog?.find(color=>color.id===id)||globalThis.HairColorCatalog?.[0];
  return entry?[entry.dark,entry.light]:['#35170d','#572717'];
}

export function createIndependentHair(root,baseOrProfile,id,colorId='hc1'){
  const profile=typeof baseOrProfile==='string'?{base:baseOrProfile}:baseOrProfile;
  const base=profile.base==='male'?'male':'female';
  const head=root.getObjectByName('mixamorigHead')||root.getObjectByName('Head');
  if(!head)throw new Error('머리 본을 찾지 못했습니다.');
  const partSpace=profile.partSpace||capturePartSpace(root,head);
  const anchor=new THREE.Group();anchor.name='Hair_Anchor';head.add(anchor);
  const group=new THREE.Group();group.name='Independent_Hair';anchor.add(group);
  const [darkColor,lightColor]=getHairColors(colorId);
  const dark=new THREE.MeshStandardMaterial({name:'Hair_Dark',color:darkColor,roughness:.7}),light=new THREE.MeshStandardMaterial({name:'Hair_Light',color:lightColor,roughness:.68});
  const mats=[dark,light];
  const headScale=profile.headScale||(profile.bald?1.55:1),hairDepth=profile.hairDepth||0;
  const rootToHead=(p)=>{
    const mapped=profile.bald?[p[0]*headScale,.545+(p[1]-1.35)*headScale,p[2]*headScale+hairDepth]
      :profile.blank?[p[0]*headScale,1.4+(p[1]-1.4)*headScale,p[2]*headScale+hairDepth]:p;
    return rootPointToPartLocal(partSpace,mapped);
  };
  anchor.position.copy(rootToHead(profile.hairAnchor||[0,1.405,.04]));
  const worldToLocal=p=>rootToHead(p).sub(anchor.position);
  const style=globalThis.ImportedPortraitCatalog?.hair?.find(entry=>entry.id===id);
  const foreheadLift=(profile.foreheadLift??profile.fringeLift??0)+(style?.frontLift||0);
  const transform=style?.transform||{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  group.position.set(...transform.position);group.rotation.set(...transform.rotation);group.scale.set(...transform.scale);
  const mapScale=s=>(profile.bald||profile.blank)?s.map(v=>v*headScale):s;
  function ellipsoid(name,pos,scale,material=dark,rotation=[0,0,0]){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),material);mesh.name=name;
    const placed=profile.blank&&name==='Hairline'?[pos[0],pos[1]+foreheadLift,pos[2]+.075]:pos;
    mesh.position.copy(worldToLocal(placed));mesh.scale.set(...mapScale(scale));mesh.rotation.set(...rotation);group.add(mesh);return mesh;
  }
  function strand(a,b,width=.045,depth=.035,material=light,bend=0,name='Hair_Strand'){
    const frontOffset=profile.blank&&(a[2]>.08||b[2]>.08)?.075:0;
    const strandLift=frontOffset?foreheadLift:0;
    const start=worldToLocal([a[0],a[1]+strandLift*.25,a[2]+frontOffset]),end=worldToLocal([b[0],b[1]+strandLift,b[2]+frontOffset]),direction=end.clone().sub(start),middle=start.clone().lerp(end,.5);middle.z+=bend;
    const geometry=new THREE.SphereGeometry(1,16,12),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const y=positions.getY(i),taper=.34+.66*(1-(y+1)/2);
      positions.setX(i,positions.getX(i)*taper);positions.setZ(i,positions.getZ(i)*taper);
    }
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
    const radial=(profile.bald||profile.blank)?headScale:1;mesh.position.copy(middle);mesh.scale.set(width*radial,direction.length()/2+.025*radial,depth*radial);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);return mesh;
  }
  function braid(x,top,bottom){
    const count=Math.max(3,Math.round((top-bottom)/.075));
    for(let i=0;i<count;i++)ellipsoid('Hair_Braid',[x+(i%2?.018:-.018),top-i*(top-bottom)/count,-.08],[.055,.05,.055],i%2?light:dark,[0,0,i%2?.25:-.25]);
  }
  function capGeometry(frontEnd=1.34,sideEnd=2.35,backEnd=2.90,crownBulge=0,frontWave=0){
    const vertices=[],normals=[],indices=[],cols=32,rows=18;
    // A single crown vertex avoids raster cracks caused by a ring of duplicate
    // pole vertices. Remaining rows keep a duplicated seam vertex for UV-like continuity.
    vertices.push(0,1+crownBulge,0);normals.push(0,1,0);
    for(let y=1;y<=rows;y++)for(let x=0;x<=cols;x++){
      const theta=x/cols*Math.PI*2,s=Math.sin(theta);
      const frontEdge=frontEnd+frontWave*(.5+.5*Math.cos(theta*7))*Math.max(0,s);
      const end=s>=0?sideEnd+(frontEdge-sideEnd)*s:sideEnd+(backEnd-sideEnd)*-s;
      // Concentrate rings around the crown so curved Head vertices cannot poke
      // through the long chord between the pole and the former first ring.
      const phi=Math.pow(y/rows,1.35)*end,crownWeight=Math.max(0,1-phi/.9),radius=1+crownBulge*crownWeight*crownWeight;
      const dx=Math.sin(phi)*Math.cos(theta)*radius,dy=Math.cos(phi)*radius,dz=Math.sin(phi)*s*radius,length=Math.hypot(dx,dy,dz)||1;
      vertices.push(dx,dy,dz);normals.push(dx/length,dy/length,dz/length);
    }
    const firstRing=1;
    // Keep the pole fan's winding consistent with the following rings.  The
    // reversed order used here previously made the crown triangles back faces,
    // leaving a circular hole when THREE.FrontSide culling was enabled.
    for(let x=0;x<cols;x++)indices.push(0,firstRing+x,firstRing+x+1);
    for(let y=1;y<rows;y++)for(let x=0;x<cols;x++){
      const a=1+(y-1)*(cols+1)+x,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }
  function styleHairGeometry(surface){
    const geometry=capGeometry(surface.frontEnd,surface.sideEnd,surface.backEnd,surface.bulge,surface.wave),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const flattened=y>.48?.48+(y-.48)*surface.flatten:y;
      const theta=Math.atan2(z,x),crownWeight=Math.max(0,flattened);
      const flow=1+surface.flow*Math.cos(theta*surface.flowCount)*(1-crownWeight*.62);
      const asymmetry=(surface.skew||0)*Math.max(0,z)*(.35+.65*crownWeight);
      positions.setXYZ(i,x*flow+asymmetry,flattened+surface.lift,z*flow+(surface.lean||0)*crownWeight);
    }
    positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }
  if(profile.blank){
    const surface=style?.surface;
    if(!surface)throw new Error(`머리 surface profile이 없습니다: ${id}`);
    const crownSurface=new THREE.Mesh(styleHairGeometry(surface),dark);
    crownSurface.name=`CrownHair_${id}`;
    crownSurface.position.copy(worldToLocal(surface.position));
    crownSurface.scale.set(...mapScale(surface.scale));group.add(crownSurface);
  }else ellipsoid('Hair_Scalp',[0,1.405,.005],[.218,.218,.205],dark);
  const n=Number(id.slice(1));
  if(base==='female'){
    if(n===1){ // bob
      for(const s of [-1,1])strand([s*.19,1.46,.12],[s*.22,1.17,.10],.075,.05,light,s*.01,'SideHair');
      for(let i=-2;i<=2;i++)strand([i*.075,1.50,.19],[i*.07,1.32,.245],.048,.04,light,0,'FrontHair');
    }else if(n===2){ // long straight
      for(const s of [-1,1])for(let i=0;i<3;i++)strand([s*(.12+i*.055),1.48,.02],[s*(.18+i*.035),.91,-.03],.064,.055,i%2?light:dark,0,'SideHair');
    }else if(n===3){ // ponytail
      ellipsoid('Hair_Tie',[0,1.47,-.19],[.075,.06,.055],light);strand([0,1.45,-.2],[.05,.84,-.2],.11,.09,dark,-.08,'BackHair');
    }else if(n===4){ // twin tails
      for(const s of [-1,1]){ellipsoid('Hair_Tie',[s*.22,1.42,-.06],[.055,.065,.055],light);strand([s*.23,1.41,-.07],[s*.34,.92,-.08],.085,.07,dark,-.03,'SideHair');}
    }else if(n===5){ // high bun
      ellipsoid('Hair_Bun',[0,1.64,-.015],[.16,.15,.14],dark);ellipsoid('Hair_Band',[0,1.53,-.015],[.145,.035,.13],light);
    }else if(n===6){ // twin braids
      for(const s of [-1,1])braid(s*.23,1.34,.87);
    }else if(n===7){ // shoulder-length natural wave: cap + large silhouette chunks
      for(let i=-2;i<=2;i++)strand([i*.072,1.51,.18],[i*.068,1.36,.245],.047,.038,i%2?light:dark,0,'FrontHair');
      for(const s of [-1,1]){
        strand([s*.12,1.47,.06],[s*.22,1.02,.08],.080,.060,dark,s*.045,s<0?'LeftWave':'RightWave');
        strand([s*.18,1.43,.01],[s*.29,.94,.02],.088,.070,light,-s*.042,s<0?'LeftWave':'RightWave');
        strand([s*.23,1.38,-.04],[s*.32,1.04,-.08],.074,.068,dark,s*.038,s<0?'LeftWave':'RightWave');
      }
      for(let i=-1;i<=1;i++)strand([i*.13,1.43,-.11],[i*.16,.91,-.13],.105,.082,i===0?dark:light,i*.025,'BackHair');
    }else if(n===8){ // side braid
      for(let i=-2;i<=1;i++)strand([i*.07,1.50,.18],[i*.075,1.31,.245],.045,.035,light,0,'FrontHair');braid(.24,1.34,.78);
    }else if(n===9){ // twin buns
      for(const s of [-1,1]){ellipsoid('Hair_Bun',[s*.22,1.57,-.01],[.13,.13,.12],dark);ellipsoid('Hair_Band',[s*.17,1.50,.0],[.04,.10,.1],light);}
    }else{ // princess half-up
      // The half-up style flows over the crown and gathers behind the head.
      // A former ellipsoid here rendered as a detached oval sitting on top.
      ellipsoid('Hair_Tie',[0,1.45,-.215],[.05,.035,.03],light);
      for(const s of [-1,1])for(let i=0;i<2;i++)strand([s*(.12+i*.07),1.47,-.02],[s*(.18+i*.04),.87,-.08],.075,.06,i?light:dark,0,'BackHair');
      for(const s of [-1,1])strand([s*.17,1.47,.1],[s*.21,1.18,.16],.05,.04,light,0,'SideHair');
    }
  }else{
    const bangs=(count=5,lift=0)=>{for(let i=0;i<count;i++){const x=(i-(count-1)/2)*.075;strand([x,1.53,.11],[x+(i%2?.02:-.015),1.34+lift,.245],.048,.035,i%2?light:dark);}};
    if(n===1){
      // The front fringe is the scalloped boundary of the continuous surface;
      // separate ellipsoids here produced a visible scalp seam and bead-like bangs.
      // These narrow pieces sit on top of the continuous side/back shell and
      // give the silhouette a deliberate temple and nape termination.
      for(const side of [-1,1])strand([side*.205,1.43,.07],[side*.225,1.22,.015],.052,.036,side<0?dark:light,side*.008,side<0?'LeftTempleHair':'RightTempleHair');
      for(const x of [-.12,0,.12])strand([x,1.43,-.17],[x*.88,1.20,-.19],.062,.040,x===0?dark:light,x*.025,'BackHair');
    }
    else if(n===2){bangs(4,.035);ellipsoid('Hair_Side',[.18,1.42,.02],[.08,.15,.15],dark);}
    else if(n===3){bangs(7,.02);for(const x of [-.18,-.09,0,.09,.18])strand([x,1.51,.02],[x*1.25,1.62,-.01],.05,.04,light);}
    else if(n===4){for(let i=0;i<6;i++)strand([-.18+i*.07,1.54,.08],[-.22+i*.04,1.34,.24],.052,.04,i%2?light:dark);}
    else if(n===5){for(let i=0;i<6;i++)strand([.18-i*.07,1.54,.08],[.22-i*.04,1.34,.24],.052,.04,i%2?light:dark);}
    else if(n===6){for(let i=-2;i<=2;i++)strand([i*.075,1.49,.08],[i*.10,1.55,-.12],.06,.045,i%2?light:dark);}
    else if(n===7){bangs(6);for(const s of [-1,1])strand([s*.13,1.50,.01],[s*.21,1.58,-.04],.07,.05,light,s*.04);}
    else if(n===8){bangs(4,.07);for(const x of [-.14,-.07,0,.07,.14])strand([x,1.51,.04],[x*.7,1.69,-.02],.055,.04,light);}
    else if(n===9){bangs(4,.02);for(const s of [-1,1])ellipsoid('Hair_Undercut',[s*.20,1.39,.01],[.045,.11,.15],dark);}
    else{bangs(7);for(let i=0;i<5;i++)strand([-.16+i*.08,1.48,.01],[-.20+i*.1,1.61+(i%2)*.04,-.03],.06,.045,i%2?light:dark,(i%2?.03:-.03));}
  }
  group.userData.dispose=()=>{anchor.removeFromParent();disposeObject(anchor);};
  return group;
}

export function setIndependentHairColor(group,colorId){
  if(!group)return false;
  const [dark,light]=getHairColors(colorId);let changed=false;
  group.traverse(node=>{for(const material of [].concat(node.material||[])){
    if(material.name==='Hair_Dark'){material.color.set(dark);material.needsUpdate=true;changed=true;}
    if(material.name==='Hair_Light'){material.color.set(light);material.needsUpdate=true;changed=true;}
  }});
  return changed;
}
