import * as THREE from 'three';
import { disposeObject } from '../character-viewer/CharacterViewer.js?v=20260926-equipment1';

const COLORS={male:['#35170d','#572717'],female:['#d6b66e','#f0d994']};

export function createIndependentHair(root,baseOrProfile,id){
  const profile=typeof baseOrProfile==='string'?{base:baseOrProfile}:baseOrProfile;
  const base=profile.base==='male'?'male':'female';
  const head=root.getObjectByName('mixamorigHead')||root.getObjectByName('Head');
  if(!head)throw new Error('머리 본을 찾지 못했습니다.');
  root.updateMatrixWorld(true);
  const group=new THREE.Group();group.name='Independent_Hair';head.add(group);
  const [darkColor,lightColor]=COLORS[base];
  const dark=new THREE.MeshStandardMaterial({color:darkColor,roughness:.7}),light=new THREE.MeshStandardMaterial({color:lightColor,roughness:.68});
  const mats=[dark,light];
  const baldScale=profile.headScale||1.55,baldDepth=profile.hairDepth||.055;
  const worldToLocal=(p)=>{const mapped=profile.bald?[p[0]*baldScale,.545+(p[1]-1.35)*baldScale,p[2]*baldScale+baldDepth]:p;return head.worldToLocal(root.localToWorld(new THREE.Vector3(...mapped)));};
  const mapScale=s=>profile.bald?s.map(v=>v*baldScale):s;
  function ellipsoid(name,pos,scale,material=dark,rotation=[0,0,0]){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),material);mesh.name=name;
    mesh.position.copy(worldToLocal(pos));mesh.scale.set(...mapScale(scale));mesh.rotation.set(...rotation);group.add(mesh);return mesh;
  }
  function strand(a,b,width=.045,depth=.035,material=light,bend=0){
    const start=worldToLocal(a),end=worldToLocal(b),direction=end.clone().sub(start),middle=start.clone().lerp(end,.5);middle.z+=bend;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),material);mesh.name='Hair_Strand';
    const radial=profile.bald?baldScale:1;mesh.position.copy(middle);mesh.scale.set(width*radial,direction.length()/2+.025*radial,depth*radial);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);return mesh;
  }
  function braid(x,top,bottom){
    const count=Math.max(3,Math.round((top-bottom)/.075));
    for(let i=0;i<count;i++)ellipsoid('Hair_Braid',[x+(i%2?.018:-.018),top-i*(top-bottom)/count,-.08],[.055,.05,.055],i%2?light:dark,[0,0,i%2?.25:-.25]);
  }
  // All styles own their scalp cap; none uses the imported hair topology.
  ellipsoid('Hair_Scalp',[0,1.405,.005],[.218,.218,.205],dark);
  ellipsoid('Hairline',[0,1.43,.185],[.19,.105,.065],dark);
  const n=Number(id.slice(1));
  if(base==='female'){
    if(n===1){ // bob
      for(const s of [-1,1])strand([s*.19,1.46,.12],[s*.22,1.17,.10],.075,.05,light,s*.01);
      for(let i=-2;i<=2;i++)strand([i*.075,1.50,.19],[i*.07,1.32,.245],.048,.04,light);
    }else if(n===2){ // long straight
      for(const s of [-1,1])for(let i=0;i<3;i++)strand([s*(.12+i*.055),1.48,.02],[s*(.18+i*.035),.91,-.03],.064,.055,i%2?light:dark);
    }else if(n===3){ // ponytail
      ellipsoid('Hair_Tie',[0,1.47,-.19],[.075,.06,.055],light);strand([0,1.45,-.2],[.05,.84,-.2],.11,.09,dark,-.08);
    }else if(n===4){ // twin tails
      for(const s of [-1,1]){ellipsoid('Hair_Tie',[s*.22,1.42,-.06],[.055,.065,.055],light);strand([s*.23,1.41,-.07],[s*.34,.92,-.08],.085,.07,dark,-.03);}
    }else if(n===5){ // high bun
      ellipsoid('Hair_Bun',[0,1.64,-.015],[.16,.15,.14],dark);ellipsoid('Hair_Band',[0,1.53,-.015],[.145,.035,.13],light);
    }else if(n===6){ // twin braids
      for(const s of [-1,1])braid(s*.23,1.34,.87);
    }else if(n===7){ // wavy bob
      for(const s of [-1,1])for(let i=0;i<3;i++)strand([s*(.09+i*.065),1.48,.06],[s*(.15+i*.045),1.13,.08],.063,.05,i%2?light:dark,s*(i%2?.04:-.035));
    }else if(n===8){ // side braid
      for(let i=-2;i<=1;i++)strand([i*.07,1.50,.18],[i*.075,1.31,.245],.045,.035,light);braid(.24,1.34,.78);
    }else if(n===9){ // twin buns
      for(const s of [-1,1]){ellipsoid('Hair_Bun',[s*.22,1.57,-.01],[.13,.13,.12],dark);ellipsoid('Hair_Band',[s*.17,1.50,.0],[.04,.10,.1],light);}
    }else{ // princess half-up
      ellipsoid('Hair_HalfBun',[0,1.57,-.13],[.12,.105,.09],dark);
      for(const s of [-1,1])for(let i=0;i<2;i++)strand([s*(.12+i*.07),1.47,-.02],[s*(.18+i*.04),.87,-.08],.075,.06,i?light:dark);
      for(const s of [-1,1])strand([s*.17,1.47,.1],[s*.21,1.18,.16],.05,.04,light);
    }
  }else{
    const bangs=(count=5,lift=0)=>{for(let i=0;i<count;i++){const x=(i-(count-1)/2)*.075;strand([x,1.53,.11],[x+(i%2?.02:-.015),1.34+lift,.245],.048,.035,i%2?light:dark);}};
    if(n===1)bangs(5);
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
  group.userData.dispose=()=>{group.removeFromParent();disposeObject(group);};
  return group;
}
