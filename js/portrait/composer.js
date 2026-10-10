import * as THREE from 'three';
import { Appearance } from './Appearance.js?v=20261010-visual20';

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

export function setupComposer(viewer,equipment=null) {
  let catalog=globalThis.PortraitCatalog;
  const appearance=new Appearance();
  const el=id=>document.getElementById(id),status=el('portrait-status');
  let selectedParts={...catalog.defaults},enabled=false,presets=[],baldModel=false,blankModel=false,pendingEquipment=null;
  const buttons=new Map();
  const token=new URLSearchParams(location.search).get('compose');
  const labels={hair:'머리',hairColor:'머리 색상',eyes:'눈매',eyeColor:'눈 색상',eyebrows:'눈썹',nose:'코',ears:'귀',mouth:'입',skin:'피부색'};
  const locks={};
  const availableEntries=(field,group)=>{
    const entries=catalog[group];
    return appearance.filterOptions?appearance.filterOptions(field,entries):entries;
  };
  function buildParts(){
  buttons.clear();el('portrait-parts').replaceChildren();
  for(const [field,group] of Object.entries(catalog.fields)){
    if(appearance.supportedFields&&!appearance.supportedFields.includes(field))continue;
    const section=document.createElement('details');section.open=field==='hair';
    const entries=availableEntries(field,group);
    const title=document.createElement('summary');title.textContent=`${labels[field]} · ${entries.length}종`;
    const lockLabel=document.createElement('label');lockLabel.className='check';
    const lock=document.createElement('input');lock.type='checkbox';lock.setAttribute('aria-label',`${labels[field]} 무작위 변경 잠금`);
    lock.addEventListener('change',()=>{locks[field]=lock.checked;});lockLabel.append(lock,document.createTextNode('무작위 변경 잠금'));
    const grid=document.createElement('div');grid.className='portrait-options';
    entries.forEach((entry,index)=>{
      const button=document.createElement('button');button.type='button';button.dataset.field=field;button.dataset.partId=entry.id;button.dataset.group=entry.group||'';
      button.textContent=field==='skin'?entry.name:`${String(entry.group?index%10+1:index+1).padStart(2,'0')} ${entry.name}`;
      button.setAttribute('aria-pressed','false');const swatch=entry.color||entry.light;if(swatch)button.style.borderLeft=`12px solid ${swatch}`;
      button.addEventListener('click',()=>{selectedParts={...selectedParts,[field]:entry.id};el('portrait-presets').value='';apply([field]);});
      buttons.set(`${field}:${entry.id}`,button);grid.append(button);
    });
    section.append(title,lockLabel,grid);el('portrait-parts').append(section);
  }
  }
  buildParts();
  function refresh(){
    buttons.forEach((button,key)=>{
      const [field,id]=key.split(':');button.setAttribute('aria-pressed',String(selectedParts[field]===id));
      button.hidden=field==='hair'&&button.dataset.group!==el('hair-group').value;
    });
    el('portrait-selection').textContent=Object.entries(catalog.fields).filter(([field])=>!appearance.supportedFields||appearance.supportedFields.includes(field)).map(([field,group])=>catalog[group].find(x=>x.id===selectedParts[field])?.name).filter(Boolean).join(' · ');
  }
  function apply(fields=null){
    refresh();if(!enabled)return;
    try{appearance.apply(selectedParts,fields);equipment?.refreshOverrides?.();el('portrait-preview').src=capturePortrait(viewer);status.textContent='조합을 반영했습니다.';}
    catch(error){status.textContent=error.message;}
  }
  function choose(value){
    const normalized=PortraitCatalog.normalize(value);if(!normalized)throw new Error('지원하지 않는 외형 조합입니다.');
    const changed=normalized.version!==selectedParts.version||normalized.base!==selectedParts.base;
    if(changed){selectedParts=normalized;loadBase(normalized.version===2?(blankModel?`blank-${normalized.base}`:normalized.base):'legacy');return;}
    const changedFields=Object.keys(catalog.fields).filter(field=>normalized[field]!==selectedParts[field]);
    selectedParts=normalized;el('hair-group').value=catalog.hair.find(h=>h.id===selectedParts.hair).group;apply(changedFields);
  }
  el('hair-group').addEventListener('change',()=>{
    el('portrait-presets').value='';
    if(selectedParts.version===2){const base=el('hair-group').value;selectedParts={...selectedParts,base,hair:base==='male'?'m1':'f1'};if(baldModel)apply(['hair']);else loadBase(blankModel?`blank-${base}`:base);return;}
    if(!catalog.hair.some(h=>h.id===selectedParts.hair&&h.group===el('hair-group').value))selectedParts={...selectedParts,hair:catalog.hair.find(h=>h.group===el('hair-group').value).id};
    apply(['hair']);
  });
  el('portrait-random').addEventListener('click',()=>{const previous=selectedParts;selectedParts=catalog.randomize(selectedParts,{group:el('hair-group').value,locks});
    for(const [field,group] of Object.entries(catalog.fields)){const entries=availableEntries(field,group);if(entries.length&&!entries.some(x=>x.id===selectedParts[field]))selectedParts[field]=entries[Math.floor(Math.random()*entries.length)].id;}
    el('portrait-presets').value='';apply(Object.keys(catalog.fields).filter(field=>previous[field]!==selectedParts[field]));});
  el('portrait-default').addEventListener('click',()=>{el('portrait-presets').value='';choose(selectedParts.version===2?{...catalog.defaults,base:selectedParts.base,hair:selectedParts.base==='male'?'m1':'f1'}:catalog.defaults);});
  el('portrait-download').addEventListener('click',()=>{
    try{const link=document.createElement('a');link.href=capturePortrait(viewer);link.download=`sd-portrait-${selectedParts.hair}-${selectedParts.eyes}.png`;link.click();status.textContent='512×512 PNG를 다운로드했습니다.';}
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
    const next=[...presets,{name:name.slice(0,60),style:{...selectedParts},equipment:equipment?.getState?.()||{}}];
    try{localStorage.setItem(STORAGE,JSON.stringify(next));presets=next;updatePresets();el('portrait-presets').value=String(presets.length-1);status.textContent='이 브라우저에 조합을 저장했습니다.';}
    catch{status.textContent='브라우저 저장 공간을 사용할 수 없습니다. PNG 다운로드를 이용하세요.';}
  });
  el('portrait-presets').addEventListener('change',()=>{const value=el('portrait-presets').value;if(value==='')return;const preset=presets[Number(value)];pendingEquipment=preset.equipment||{};choose(preset.style);equipment?.setState?.(pendingEquipment);});
  el('portrait-delete-preset').addEventListener('click',()=>{
    const value=el('portrait-presets').value;if(value==='')return;
    const next=presets.filter((_,i)=>i!==Number(value));try{localStorage.setItem(STORAGE,JSON.stringify(next));presets=next;updatePresets();status.textContent='저장한 조합을 삭제했습니다.';}catch{status.textContent='조합 삭제를 저장하지 못했습니다.';}
  });
  el('portrait-apply-character').hidden=!token||!window.opener;
  el('portrait-apply-character').addEventListener('click',()=>{
    if(!window.opener||window.opener.closed){status.textContent='캐릭터 편집 창을 찾지 못했습니다. PNG 다운로드를 이용하세요.';return;}
    try{window.opener.postMessage({type:'sd-portrait-result',token,style:selectedParts,dataUrl:capturePortrait(viewer)},location.origin);status.textContent='캐릭터 편집 창으로 보냈습니다. 적용 후 이 창을 닫아도 됩니다.';}
    catch(error){status.textContent=error.message;}
  });
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.opener||event.data?.token!==token)return;
    if(event.data.type==='sd-portrait-init'&&PortraitCatalog.normalize(event.data.style))choose(event.data.style);
    if(event.data.type==='sd-portrait-accepted')status.textContent='캐릭터 편집기에 적용했습니다. 캐릭터를 저장해 주세요.';
    if(event.data.type==='sd-portrait-rejected')status.textContent='현재 캐릭터 편집기에 적용하지 못했습니다. 다른 캐릭터에서 조합 저장 후 다시 시도하세요.';
  });
  if(token&&window.opener)window.opener.postMessage({type:'sd-portrait-ready',token},location.origin);
  refresh();
  function loadBase(base){
    const blankPaths={'blank-male':'assets/characters/base/대머리 블랭크 얼굴 남자.glb','blank-female':'assets/characters/base/대머리 블랭크 얼굴 여자.glb'};
    const path=blankPaths[base]||(base==='legacy'?'assets/characters/base/human_sd_base_v1.glb':`assets/characters/base/human_sd_${base}_v2.glb`);
    el('model-url').value=path;
    viewer.load(path,path.split('/').pop());
  }
  return {
    getSelectedParts(){return {...selectedParts};},
    setModel(root){enabled=appearance.setModel(root);el('portrait-controls').disabled=!enabled;
      catalog=root?.userData.sdAppearance?ImportedPortraitCatalog:PortraitCatalog;
      baldModel=Boolean(root?.userData.sdAppearance?.bald);blankModel=Boolean(root?.userData.sdAppearance?.blank);
      const base=baldModel?(['male','female'].includes(selectedParts.base)?selectedParts.base:'female'):root?.userData.sdAppearance?.base;
      if(base){if(selectedParts.version!==2||selectedParts.base!==base)selectedParts={...catalog.defaults,base,hair:base==='male'?'m1':'f1'};}
      else if(selectedParts.version===2)selectedParts={...catalog.defaults};
      Object.keys(locks).forEach(k=>delete locks[k]);buildParts();
      el('hair-group').value=base||catalog.hair.find(h=>h.id===selectedParts.hair).group;
      if(enabled)apply();else status.textContent='외형 조합을 지원하는 SD 모델에서만 사용할 수 있습니다.';
      if(pendingEquipment){const restore=pendingEquipment;pendingEquipment=null;queueMicrotask(()=>equipment?.setState?.(restore));}},
    clear(){appearance.clear();enabled=false;baldModel=false;blankModel=false;el('portrait-controls').disabled=true;el('portrait-preview').removeAttribute('src');}
  };
}
