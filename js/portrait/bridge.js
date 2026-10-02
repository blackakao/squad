// A generated portrait is a form draft until the user saves the character.
let portraitAppearanceDraft = null;
let portraitEditorRevision = 0;
let portraitComposerSession = null;

function resetPortraitAppearance(value = null) {
  portraitAppearanceDraft = PortraitCatalog.normalize(value);
  portraitEditorRevision++;
}

function openPortraitComposer() {
  const token = crypto.randomUUID();
  const url = new URL('character-viewer.html', location.href);
  url.searchParams.set('model',portraitAppearanceDraft?.version===1?'assets/characters/base/human_sd_base_v1.glb':'assets/characters/base/human_sd_bald_v1.glb');
  url.searchParams.set('compose',token);
  const popup = window.open(url.href,'sd-portrait-composer');
  if(!popup){alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용해주세요.');return;}
  portraitComposerSession = {token,popup,revision:portraitEditorRevision};
}

window.addEventListener('message',event=>{
  const session=portraitComposerSession;
  if(!session||event.origin!==location.origin||event.source!==session.popup||event.data?.token!==session.token)return;
  const valid=session.revision===portraitEditorRevision&&!characterModalEl.classList.contains('hidden');
  if(event.data.type==='sd-portrait-ready'){
    if(valid)session.popup.postMessage({type:'sd-portrait-init',token:session.token,style:portraitAppearanceDraft},location.origin);
    return;
  }
  if(event.data.type!=='sd-portrait-result')return;
  const style=PortraitCatalog.normalize(event.data.style),dataUrl=event.data.dataUrl;
  if(!valid||!style||typeof dataUrl!=='string'||dataUrl.length>5*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)){
    session.popup.postMessage({type:'sd-portrait-rejected',token:session.token},location.origin);return;
  }
  characterPortraitEl.value='';
  portraitDrafts.character={dataUrl,cleared:false};
  portraitAppearanceDraft=style;
  setPortraitPreview('character',dataUrl);
  session.popup.postMessage({type:'sd-portrait-accepted',token:session.token},location.origin);
});
