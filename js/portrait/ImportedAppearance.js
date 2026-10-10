import * as THREE from 'three';
import { createIndependentHair, setIndependentHairColor } from './IndependentHair.js?v=20261010-visual20';
import { capturePartSpace } from './PartSpace.js?v=20261007-parts2';

// Face variants deform the imported surface; hair is a replaceable mesh set.
const EYES = [[1,1,0],[1.09,1.10,0],[1.10,.88,0],[.92,1,0],[1,.90,.14],[1,.90,-.14],[1,.80,0],[1.04,1.16,0],[.94,.90,.07],[1.12,.96,-.05]];
const NOSES = [[1,1,1],[.8,.8,.85],[1,1.2,1.1],[.8,1.1,1.25],[1.25,1,.95],[1.1,.85,1],[.95,.95,.7],[.9,1.15,1.05],[1.15,1.1,1.15],[.85,.9,1.15]];
const EARS = [[1,1,0],[.82,.85,0],[1.15,1.15,0],[.9,1.25,.01],[1.1,.85,0],[1,1,.018],[1,1,-.012],[1.2,1,.01],[.85,1.1,-.005],[1,1.32,.023]];
const MOUTHS = [[1,1,0],[.82,1,0],[1.12,1,.004],[1,.8,-.002],[1.15,1.2,.007],[.9,.9,-.005],[.7,1.25,0],[.85,1.1,.003],[1,.95,.009],[1.07,.8,-.003]];
const clamp = (x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const bell = (x,y,z,cx,cy,cz,rx,ry,rz)=>Math.exp(-2*((x-cx)**2/rx**2+(y-cy)**2/ry**2+(z-cz)**2/rz**2));

export class ImportedAppearance {
  constructor(){this.supportedFields=['hair','hairColor','eyes','nose','ears','mouth','skin'];}
  setModel(root) {
    this.clear();
    this.root=root;
    this.profile=root?.userData.sdAppearance;
    this.meshes=[];
    if(!this.profile)return false;
    const head=root.getObjectByName('mixamorigHead')||root.getObjectByName('Head');
    this.hairProfile={...this.profile,partSpace:capturePartSpace(root,head)};
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||!mesh.geometry.attributes._sd_mask)return;
      const originalGeometry=mesh.geometry,originalMaterial=mesh.material;
      mesh.geometry=originalGeometry.clone();mesh.material=originalMaterial.clone();
      const geometry=mesh.geometry;
      const tint={value:new THREE.Color(1,1,1)};
      mesh.material.onBeforeCompile=shader=>{
        shader.uniforms.sdTint=tint;
        shader.fragmentShader='uniform vec3 sdTint;\n'+shader.fragmentShader;
        // Per-pixel chroma mask avoids triangular skin-tone seams at eyes/hair.
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 sdColor=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2));
          float sdSkin=smoothstep(.025,.065,sdColor.r-sdColor.g)
            * (1.0-smoothstep(.12,.18,sdColor.g-sdColor.b))*smoothstep(.3,.5,sdColor.r);
          float sdHair=${this.profile.base==='female'
            ? "smoothstep(.08,.18,sdColor.g-sdColor.b)*(1.0-smoothstep(.22,.36,sdColor.r-sdColor.g))*smoothstep(.36,.58,sdColor.r)"
            : "smoothstep(.018,.055,sdColor.r-sdColor.g)*smoothstep(.012,.045,sdColor.g-sdColor.b)*(1.0-smoothstep(.52,.72,sdColor.r))"};
          if(sdHair>.48)discard;
          diffuseColor.rgb *= mix(vec3(1.0),sdTint,sdSkin);`);
      };
      mesh.material.customProgramCacheKey=()=> `sd-independent-hair-${this.profile.base}`;
      this.meshes.push({mesh,originalGeometry,originalMaterial,positions:geometry.attributes.position.array.slice(),tint});
    });
    return this.meshes.length>0;
  }
  apply(style,fields=null) {
    if(!this.meshes?.length)return;
    const requested=new Set(fields||['hair','hairColor','eyes','nose','ears','mouth','skin']);
    if(requested.has('hair')){this.hair?.userData.dispose();this.hair=createIndependentHair(this.root,this.hairProfile,style.hair,style.hairColor);}
    else if(requested.has('hairColor')&&!setIndependentHairColor(this.hair,style.hairColor)){this.hair=createIndependentHair(this.root,this.hairProfile,style.hair,style.hairColor);}
    const updateFace=['eyes','nose','ears','mouth'].some(field=>requested.has(field));
    if(!updateFace&&!requested.has('skin'))return;
    const eye=EYES[Number(style.eyes.slice(3))-1];
    const nose=NOSES[Number(style.nose.slice(4))-1],ear=EARS[Number(style.ears.slice(3))-1],mouth=MOUTHS[Number(style.mouth.slice(5))-1];
    const color=new THREE.Color(ImportedPortraitCatalog.skins.find(s=>s.id===style.skin).color);
    const baseline=new THREE.Color('#f4d5c1');color.r/=baseline.r;color.g/=baseline.g;color.b/=baseline.b;
    for(const entry of this.meshes){
      const {mesh,positions,tint}=entry,p=mesh.geometry.attributes.position,mask=mesh.geometry.attributes._sd_mask;
      if(requested.has('skin'))tint.value.copy(color);
      if(!updateFace)continue;
      for(let i=0;i<p.count;i++){
        const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2],sign=x<0?-1:1;
        let dx=0,dy=0,dz=0;
        const hairWeight=mask.getX(i);
        if(hairWeight<=.5){
          const ew=bell(x,y,z,sign*.095,1.295,.225,.079,.079,.13);
          dx+=(x-sign*.095)*(eye[0]-1)*ew;dy+=((y-1.295)*(eye[1]-1)+(x-sign*.095)*sign*eye[2])*ew;
          const nw=bell(x,y,z,0,1.225,.253,.039,.044,.075);
          dx+=x*(nose[0]-1)*nw;dy+=(y-1.225)*(nose[1]-1)*nw;dz+=(z-.20)*(nose[2]-1)*nw;
          const aw=bell(x,y,z,sign*.211,1.265,.045,.050,.075,.11);
          dx+=(x-sign*.174)*(ear[0]-1)*aw;dy+=((y-1.265)*(ear[1]-1)+ear[2])*aw;dz+=ear[2]*aw;
          const mw=bell(x,y,z,0,1.184,.225,.065,.031,.09);
          dx+=x*(mouth[0]-1)*mw;dy+=((y-1.184)*(mouth[1]-1)+mouth[2]*clamp(Math.abs(x)/.035))*mw;
        }
        p.setXYZ(i,x+dx,y+dy,z+dz);
      }
      p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      mesh.boundingBox=null;mesh.boundingSphere=null;
    }
  }
  clear(){
    this.hair?.userData.dispose();this.hair=null;
    for(const {mesh,originalGeometry,originalMaterial} of this.meshes||[]){mesh.geometry.dispose();mesh.material.dispose();mesh.geometry=originalGeometry;mesh.material=originalMaterial;}
    this.meshes=[];this.root=null;this.hairProfile=null;
  }
}
