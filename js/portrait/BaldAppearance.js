import * as THREE from 'three';
import { createIndependentHair, setIndependentHairColor } from './IndependentHair.js?v=20261010-visual20';
import { disposeObject } from '../character-viewer/CharacterViewer.js?v=20261010-visual7';
import { capturePartSpace, rootPointToPartLocal } from './PartSpace.js?v=20261007-parts2';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const bell=(x,y,z,cx,cy,cz,rx,ry,rz)=>Math.exp(-2*((x-cx)**2/rx**2+(y-cy)**2/ry**2+(z-cz)**2/rz**2));
const EYES=[[1,1,0],[1.12,1.12,0],[1.15,.82,0],[.88,.92,0],[1,.86,.16],[1,.86,-.16],[1,.66,0],[1.05,1.22,0],[.92,.83,.08],[1.16,.93,-.06]];
const NOSES=[[1,1,1],[.8,.8,.85],[1,1.2,1.1],[.8,1.1,1.25],[1.25,1,.95],[1.1,.85,1],[.95,.95,.7],[.9,1.15,1.05],[1.15,1.1,1.15],[.85,.9,1.15]];
const EARS=[[1,1,0],[.82,.85,0],[1.15,1.15,0],[.9,1.25,.01],[1.1,.85,0],[1,1,.018],[1,1,-.012],[1.2,1,.01],[.85,1.1,-.005],[1,1.32,.023]];
const MOUTHS=[[1,1,0],[.82,1,0],[1.12,1,.004],[1,.8,-.002],[1.15,1.2,.007],[.9,.9,-.005],[.7,1.25,0],[.85,1.1,.003],[1,.95,.009],[1.07,.8,-.003]];

export class BaldAppearance{
  constructor(){this.supportedFields=['hair','hairColor','eyes','nose','ears','mouth','skin'];}
  setModel(root){
    this.clear();this.root=root;this.meshes=[];
    root.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry,position=geometry.attributes.position;if(!position)return;
      const originalGeometry=geometry,originalMaterial=mesh.material;mesh.geometry=geometry.clone();mesh.material=originalMaterial.clone();
      this.meshes.push({mesh,originalGeometry,originalMaterial,positions:position.array.slice()});
    });
    const head=root.getObjectByName('Head');
    if(!head)return false;
    this.hairProfile={...root.userData.sdAppearance,partSpace:capturePartSpace(root,head)};
    return this.meshes.length>0;
  }
  makeEyes(style,color){
    this.eyes?.removeFromParent();if(this.eyes)disposeObject(this.eyes);
    const group=new THREE.Group();group.name='Independent_Eyes';this.root.getObjectByName('Head').add(group);
    const toLocal=p=>rootPointToPartLocal(this.hairProfile.partSpace,p);
    const coverColor=color.clone().multiplyScalar(.45);
    const skin=new THREE.MeshStandardMaterial({color:coverColor,roughness:.78}),white=new THREE.MeshStandardMaterial({color:'#fffaf2',roughness:.35});
    const irisColors=['#69788e','#795134','#3e735c','#735c89','#4c79a9','#93643c','#587f82','#8b7442','#556178','#754b59'];
    const iris=new THREE.MeshStandardMaterial({color:irisColors[Number(style.eyes.slice(3))-1],roughness:.32});
    const dark=new THREE.MeshStandardMaterial({color:'#1b1515',roughness:.4});
    const spec=new THREE.MeshBasicMaterial({color:'#ffffff'}),shape=EYES[Number(style.eyes.slice(3))-1];
    const add=(name,material,pos,scale)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),material);m.name=name;m.position.copy(toLocal(pos));m.scale.set(...scale);group.add(m);return m;};
    for(const s of [-1,1]){
      const cx=s*.112,cy=.425+shape[2]*s*.014;
      add('Eye_Cover',skin,[cx,cy,.415],[.087,.062,.017]);
      add('Eye_White',white,[cx,cy,.438],[.070*shape[0],.052*shape[1],.014]);
      add('Eye_Iris',iris,[cx,cy,.452],[.033*shape[0],.038*shape[1],.009]);
      add('Eye_Pupil',dark,[cx,cy,.460],[.014*shape[0],.022*shape[1],.006]);
      add('Eye_Glint',spec,[cx-s*.011,cy+.016,.466],[.008,.009,.004]);
      const brow=add('Eyebrow',dark,[cx,cy+.074,.420],[.060,.009,.007]);brow.rotation.z=-s*shape[2]*.35;
    }
    this.eyes=group;
  }
  apply(style,fields=null){
    const requested=new Set(fields||['hair','hairColor','eyes','nose','ears','mouth','skin']);
    const skinHex=ImportedPortraitCatalog.skins.find(s=>s.id===style.skin).color,color=new THREE.Color(skinHex);
    const hairProfile={...this.hairProfile,base:style.base};
    if(requested.has('hair')){this.hair?.userData.dispose();this.hair=createIndependentHair(this.root,hairProfile,style.hair,style.hairColor);}
    else if(requested.has('hairColor')&&!setIndependentHairColor(this.hair,style.hairColor)){this.hair=createIndependentHair(this.root,hairProfile,style.hair,style.hairColor);}
    if(requested.has('eyes')||requested.has('skin'))this.makeEyes(style,color);
    const updateFace=['nose','ears','mouth'].some(field=>requested.has(field));
    if(!updateFace&&!requested.has('skin'))return;
    const nose=NOSES[Number(style.nose.slice(4))-1],ear=EARS[Number(style.ears.slice(3))-1],mouth=MOUTHS[Number(style.mouth.slice(5))-1];
    for(const entry of this.meshes){
      const p=entry.mesh.geometry.attributes.position,src=entry.positions;
      if(updateFace)for(let i=0;i<p.count;i++){
        const x=src[i*3],y=src[i*3+1],z=src[i*3+2],sign=x<0?-1:1;let dx=0,dy=0,dz=0;
        const nw=bell(x,y,z,0,.505,.302,.05,.052,.07);dx+=x*(nose[0]-1)*nw;dy+=(y-.505)*(nose[1]-1)*nw;dz+=(z-.25)*(nose[2]-1)*nw;
        const ew=bell(x,y,z,sign*.257,.535,.025,.06,.085,.12);dx+=(x-sign*.22)*(ear[0]-1)*ew;dy+=((y-.535)*(ear[1]-1)+ear[2])*ew;dz+=ear[2]*ew;
        const mw=bell(x,y,z,0,.42,.285,.078,.035,.08);dx+=x*(mouth[0]-1)*mw;dy+=((y-.42)*(mouth[1]-1)+mouth[2]*clamp(Math.abs(x)/.04))*mw;
        p.setXYZ(i,x+dx,y+dy,z+dz);
      }
      if(updateFace){p.needsUpdate=true;entry.mesh.geometry.computeVertexNormals();entry.mesh.geometry.computeBoundingSphere();}
      if(requested.has('skin')){const mat=entry.mesh.material;mat.color?.set(color);mat.needsUpdate=true;}
    }
  }
  clear(){
    this.hair?.userData.dispose();this.hair=null;this.eyes?.removeFromParent();if(this.eyes)disposeObject(this.eyes);this.eyes=null;
    for(const {mesh,originalGeometry,originalMaterial} of this.meshes||[]){mesh.geometry.dispose();mesh.material.dispose();mesh.geometry=originalGeometry;mesh.material=originalMaterial;}
    this.meshes=[];this.root=null;this.hairProfile=null;
  }
}
