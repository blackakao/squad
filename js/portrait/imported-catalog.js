(() => {
  const list=(prefix,names)=>names.map((name,i)=>({id:`${prefix}${i+1}`,name}));
  const hair=[...list('m',['단정한 숏컷','옆가르마','볼륨 스파이크','왼쪽 가르마','오른쪽 가르마','슬릭백','웨이브 숏컷','높은 앞머리','언더컷','덥수룩한 숏컷']).map(x=>({...x,group:'male'})),
    ...list('f',['단발','긴 생머리','포니테일','트윈테일','높은 올림머리','양갈래 땋은 머리','웨이브 단발','옆으로 땋은 머리','양쪽 둥근 올림머리','공주 반묶음']).map(x=>({...x,group:'female'}))];
  const eyes=list('eye',['원본 눈','크고 둥근 눈','넓고 긴 눈','아담한 눈','올라간 눈매','처진 눈매','가느다란 눈','세로로 큰 눈','부드러운 눈매','넓은 처진 눈']);
  const noses=list('nose',['원본 코','작은 코','긴 코','오똑한 코','넓은 코','낮고 둥근 코','평평한 코','가느다란 코','도톰한 코','작고 오똑한 코']);
  const ears=list('ear',['원본 귀','작은 귀','큰 귀','길쭉한 귀','넓은 귀','높은 귀','낮은 귀','바깥으로 펼친 귀','좁고 긴 귀','길고 높은 귀']);
  const mouths=list('mouth',['원본 입','작은 입','넓은 미소','얇은 입','도톰한 미소','처진 입꼬리','오므린 입','작은 미소','올라간 입꼬리','넓고 얇은 입']);
  const skins=['#f4d5c1','#ffe4d3','#efd1be','#ecc1a8','#dfb095','#d39d7d','#bc8766','#a37152','#84563d','#65412f'].map((color,i)=>({id:`skin${i+1}`,name:['원본 톤','밝은 아이보리','로즈 아이보리','복숭아','웜 베이지','골든 베이지','라이트 브론즈','브론즈','딥 브라운','에보니'][i],color}));
  const fields={hair:'hair',eyes:'eyes',nose:'noses',ears:'ears',mouth:'mouths',skin:'skins'},groups={hair,eyes,noses,ears,mouths,skins};
  const defaults=Object.freeze({version:2,base:'female',hair:'f1',eyes:'eye1',nose:'nose1',ears:'ear1',mouth:'mouth1',skin:'skin1'});
  function normalize(value){
    if(value?.version!==2||!['male','female'].includes(value.base))return null;
    const result={version:2,base:value.base};
    for(const [field,group] of Object.entries(fields)){if(!groups[group].some(e=>e.id===value[field]))return null;result[field]=value[field];}
    if(hair.find(h=>h.id===result.hair).group!==result.base)return null;
    return result;
  }
  function randomize(current,{locks={},random=Math.random}={}){
    const result={...(normalize(current)||defaults)};
    for(const [field,group] of Object.entries(fields)){
      if(locks[field])continue;
      const pool=groups[group].filter(e=>(field!=='hair'||e.group===result.base)&&e.id!==result[field]);
      result[field]=pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))].id;
    }
    return result;
  }
  globalThis.ImportedPortraitCatalog=Object.freeze({...groups,fields,defaults,normalize,randomize});
})();
