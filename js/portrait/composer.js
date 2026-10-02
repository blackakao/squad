import * as THREE from 'three';
import { Appearance } from './Appearance.js?v=20260929-bald7';

const STORAGE='sd-portrait-presets-v1';

// Capture a deterministic front portrait without changing the user's pose/camera.
export function capturePortrait(viewer) {
  const imported=viewer.model?.userData.sdAppearance;
  if(!imported&&!viewer.model?.getObjectByName('Head_Face'))throw new Error('외형 편집을 지원하는 SD 베이스를 먼저 불러오세요.');
  const snapshots=[];viewer.model.traverse(n=>snapshots.push([n,n.position.clone(),n.quaternion.clone(),n.scale.clone(),n.visible]));
  const renderer=viewer.renderer,size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
  const background=viewer.scene.background,grid=viewer.grid.visible,helper=viewer.skeletonHelper?.visible;
  try {
    const skeletons=new Set();viewer.model.traverse(n=>{if(n.skeleton)skeletons.add(n.skeleton);});skeletons.forEach(s=>s.pose());
    for(const name of ['Weapon_R','Weapon_L']){const node=viewer.model.getObjectByName(name);if(node)node.visible=false;}
    viewer.model.updateMatrixWorld(true);
    const head=viewer.model.getObjectByName(imported&&!imported.bald?'mixamorigHead':'Head');
    const center=imported?.bald?viewer.model.localToWorld(new THREE.Vector3(0,.56,.03))
      :imported?viewer.model.localToWorld(new THREE.Vector3(0,1.36,.03)):head.localToWorld(new THREE.Vector3(0,.35,0));
    const scale=head.getWorldScale(new THREE.Vector3()).y;
    const camera=new THREE.PerspectiveCamera(32,1,.001,10000);
    camera.position.copy(center).add(new THREE.Vector3(0,0,(imported?1.65:3.5)*scale));camera.lookAt(center);
    viewer.grid.visible=false;if(viewer.skeletonHelper)viewer.skeletonHelper.visible=false;
    viewer.scene.background=new THREE.Color('#e8dccb');renderer.setPixelRatio(1);renderer.setSize(512,512,false);
    renderer.render(viewer.scene,camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    snapshots.forEach(([n,p,q,s,visible])=>{n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);n.visible=visible;});
    viewer.model.updateMatrixWorld(true);viewer.scene.background=background;viewer.grid.visible=grid;
    if(viewer.skeletonHelper)viewer.skeletonHelper.visible=helper;
    renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);renderer.render(viewer.scene,viewer.camera);
  }
}

export function setupComposer(viewer) {
  let catalog=globalThis.PortraitCatalog;
  const appearance=new Appearance();
  const el=id=>document.getElementById(id),status=el('portrait-status');
  let style={...catalog.defaults},enabled=false,presets=[],baldModel=false;
  const buttons=new Map();
  const token=new URLSearchParams(location.search).get('compose');
  const labels={hair:'머리',eyes:'눈',nose:'코',ears:'귀',mouth:'입',skin:'피부색'};
  const locks={};
  function buildParts(){
  buttons.clear();el('portrait-parts').replaceChildren();
  for(const [field,group] of Object.entries(catalog.fields)){
    const section=document.createElement('details');section.open=field==='hair';
    const title=document.createElement('summary');title.textContent=`${labels[field]} · ${catalog[group].length}종`;
    const lockLabel=document.createElement('label');lockLabel.className='check';
    const lock=document.createElement('input');lock.type='checkbox';lock.setAttribute('aria-label',`${labels[field]} 무작위 변경 잠금`);
    lock.addEventListener('change',()=>{locks[field]=lock.checked;});lockLabel.append(lock,document.createTextNode('무작위 변경 잠금'));
    const grid=document.createElement('div');grid.className='portrait-options';
    catalog[group].forEach((entry,index)=>{
      const button=document.createElement('button');button.type='button';button.dataset.group=entry.group||'';
      button.textContent=field==='skin'?entry.name:`${String(entry.group?index%10+1:index+1).padStart(2,'0')} ${entry.name}`;
      button.setAttribute('aria-pressed','false');if(entry.color)button.style.borderLeft=`12px solid ${entry.color}`;
      button.addEventListener('click',()=>{style={...style,[field]:entry.id};apply();});
      buttons.set(`${field}:${entry.id}`,button);grid.append(button);
    });
    section.append(title,lockLabel,grid);el('portrait-parts').append(section);
  }
  }
  buildParts();
  function refresh(){
    buttons.forEach((button,key)=>{
      const [field,id]=key.split(':');button.setAttribute('aria-pressed',String(style[field]===id));
      button.hidden=field==='hair'&&button.dataset.group!==el('hair-group').value;
    });
    el('portrait-selection').textContent=Object.entries(catalog.fields).map(([field,group])=>catalog[group].find(x=>x.id===style[field]).name).join(' · ');
  }
  function apply(){
    refresh();if(!enabled)return;
    try{appearance.apply(style);el('portrait-preview').src=capturePortrait(viewer);status.textContent='조합이 반영되었습니다.';}
    catch(error){status.textContent=error.message;}
  }
  function choose(value){
    const normalized=PortraitCatalog.normalize(value);if(!normalized)throw new Error('지원하지 않는 외형 조합입니다.');
    const changed=normalized.version!==style.version||normalized.base!==style.base;
    if(changed){style=normalized;loadBase(normalized.version===2?normalized.base:'legacy');return;}
    style=normalized;el('hair-group').value=catalog.hair.find(h=>h.id===style.hair).group;apply();
  }
  el('hair-group').addEventListener('change',()=>{
    if(style.version===2){const base=el('hair-group').value;style={...style,base,hair:base==='male'?'m1':'f1'};if(baldModel)apply();else loadBase(base);return;}
    if(!catalog.hair.some(h=>h.id===style.hair&&h.group===el('hair-group').value))style={...style,hair:catalog.hair.find(h=>h.group===el('hair-group').value).id};
    apply();
  });
  el('portrait-random').addEventListener('click',()=>{style=catalog.randomize(style,{group:el('hair-group').value,locks});apply();});
  el('portrait-default').addEventListener('click',()=>choose(style.version===2?{...catalog.defaults,base:style.base,hair:style.base==='male'?'m1':'f1'}:catalog.defaults));
  el('portrait-download').addEventListener('click',()=>{
    try{const link=document.createElement('a');link.href=capturePortrait(viewer);link.download=`sd-portrait-${style.hair}-${style.eyes}.png`;link.click();status.textContent='512×512 PNG를 다운로드했습니다.';}
    catch(error){status.textContent=error.message;}
  });
  function updatePresets(){
    el('portrait-presets').replaceChildren(new Option('저장한 조합 선택',''),...presets.map((p,i)=>new Option(p.name,String(i))));
  }
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(parsed))presets=parsed.filter(p=>typeof p?.name==='string'&&PortraitCatalog.normalize(p.style)).slice(0,40);}catch{}
  updatePresets();
  el('portrait-save-preset').addEventListener('click',()=>{
    const name=el('portrait-preset-name').value.trim();if(!name){status.textContent='조합 이름을 입력하세요.';return;}
    if(presets.length>=40){status.textContent='조합은 최대 40개까지 저장할 수 있습니다. 기존 조합을 먼저 삭제하세요.';return;}
    const next=[...presets,{name:name.slice(0,60),style:{...style}}];
    try{localStorage.setItem(STORAGE,JSON.stringify(next));presets=next;updatePresets();el('portrait-presets').value=String(presets.length-1);status.textContent='이 브라우저에 조합을 저장했습니다.';}
    catch{status.textContent='브라우저 저장 공간을 사용할 수 없습니다. PNG 다운로드를 이용하세요.';}
  });
  el('portrait-presets').addEventListener('change',()=>{const value=el('portrait-presets').value;if(value!=='')choose(presets[Number(value)].style);});
  el('portrait-delete-preset').addEventListener('click',()=>{
    const value=el('portrait-presets').value;if(value==='')return;
    const next=presets.filter((_,i)=>i!==Number(value));try{localStorage.setItem(STORAGE,JSON.stringify(next));presets=next;updatePresets();status.textContent='저장한 조합을 삭제했습니다.';}catch{status.textContent='조합 삭제를 저장하지 못했습니다.';}
  });
  el('portrait-apply-character').hidden=!token||!window.opener;
  el('portrait-apply-character').addEventListener('click',()=>{
    if(!window.opener||window.opener.closed){status.textContent='캐릭터 편집창이 닫혔습니다. PNG 다운로드를 이용하세요.';return;}
    try{window.opener.postMessage({type:'sd-portrait-result',token,style,dataUrl:capturePortrait(viewer)},location.origin);status.textContent='캐릭터 편집창으로 전달했습니다. 적용 확인을 기다리는 중입니다.';}
    catch(error){status.textContent=error.message;}
  });
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.opener||event.data?.token!==token)return;
    if(event.data.type==='sd-portrait-init'&&PortraitCatalog.normalize(event.data.style))choose(event.data.style);
    if(event.data.type==='sd-portrait-accepted')status.textContent='초상화가 편집창에 적용되었습니다. 캐릭터 저장을 눌러 완료하세요.';
    if(event.data.type==='sd-portrait-rejected')status.textContent='대상 캐릭터 편집창이 변경되었습니다. 해당 캐릭터에서 조합 창을 다시 여세요.';
  });
  if(token&&window.opener)window.opener.postMessage({type:'sd-portrait-ready',token},location.origin);
  refresh();
  function loadBase(base){
    const path=base==='legacy'?'assets/characters/base/human_sd_base_v1.glb':`assets/characters/base/human_sd_${base}_v2.glb`;
    el('model-url').value=path;
    viewer.load(path,path.split('/').pop());
  }
  return {
    setModel(root){enabled=appearance.setModel(root);el('portrait-controls').disabled=!enabled;
      catalog=root?.userData.sdAppearance?ImportedPortraitCatalog:PortraitCatalog;
      baldModel=Boolean(root?.userData.sdAppearance?.bald);
      const base=baldModel?(['male','female'].includes(style.base)?style.base:'female'):root?.userData.sdAppearance?.base;
      if(base){if(style.version!==2||style.base!==base)style={...catalog.defaults,base,hair:base==='male'?'m1':'f1'};}
      else if(style.version===2)style={...catalog.defaults};
      Object.keys(locks).forEach(k=>delete locks[k]);buildParts();
      el('hair-group').value=base||catalog.hair.find(h=>h.id===style.hair).group;
      if(enabled)apply();else status.textContent='외형 조합은 공통 SD 베이스 모델에서 지원합니다.';},
    clear(){appearance.clear();enabled=false;baldModel=false;el('portrait-controls').disabled=true;el('portrait-preview').removeAttribute('src');}
  };
}
