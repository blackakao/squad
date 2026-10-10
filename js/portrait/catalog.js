/* Shared, dependency-free appearance schema for the game and the 3D viewer. */
(() => {
  const hair = [
    ...['단정한 숏컷','옆가르마','뾰족 머리','가르마 커튼컷','뒤로 넘긴 머리','둥근 바가지컷','웨이브 숏컷','높은 앞머리','언더컷','덥수룩한 머리'].map((name,i)=>({id:`m${i+1}`,name,group:'male'})),
    ...['단발','긴 생머리','포니테일','트윈테일','높은 올림머리','양갈래 땋은 머리','웨이브 단발','옆으로 땋은 머리','양쪽 둥근 올림머리','공주 반묶음'].map((name,i)=>({id:`f${i+1}`,name,group:'female'}))
  ];
  const eyes = ['동그란 눈','아몬드 눈','가늘고 긴 눈','처진 눈','올라간 눈','나른한 눈','별빛 눈','커다란 눈','웃는 눈','감은 눈'].map((name,i)=>({id:`eye${i+1}`,name}));
  const eyebrows = ['기본 눈썹','일자 눈썹','부드러운 곡선 눈썹','올라간 눈썹','처진 눈썹'].map((name,i)=>({id:`brow${i+1}`,name}));
  const noses = ['작은 둥근 코','아주 작은 코','길쭉한 코','뾰족한 코','넓은 코'].map((name,i)=>({id:`nose${i+1}`,name}));
  const mouths = ['미소','작은 미소','일자 입','벌린 입','활짝 웃음','시무룩한 입','놀란 입','오므린 입','한쪽 미소','장난스러운 입'].map((name,i)=>({id:`mouth${i+1}`,name}));
  const skins = [
    {id:'skin1',name:'밝은 아이보리',color:'#f4d8c3'}, {id:'skin2',name:'복숭아',color:'#e9b89a'},
    {id:'skin3',name:'따뜻한 베이지',color:'#ce9673'}, {id:'skin4',name:'브론즈',color:'#a66b4e'},
    {id:'skin5',name:'짙은 브라운',color:'#704331'}
  ];
  const hairColors=globalThis.HairColorCatalog||[];
  const groups = {hair,hairColors,eyes,eyebrows,noses,mouths,skins};
  const fields = {hair:'hair',hairColor:'hairColors',eyes:'eyes',eyebrows:'eyebrows',nose:'noses',mouth:'mouths',skin:'skins'};
  const defaults = Object.freeze({version:1,hair:'f8',hairColor:'hc1',eyes:'eye1',eyebrows:'brow1',nose:'nose1',mouth:'mouth1',skin:'skin2'});
  function normalize(value) {
    if(value?.version===2)return globalThis.ImportedPortraitCatalog?.normalize(value)||null;
    if (!value || typeof value !== 'object' || value.version !== 1) return null;
    const output = {version:1},source={...value,hairColor:value.hairColor||defaults.hairColor,eyebrows:value.eyebrows||defaults.eyebrows};
    for (const [field,group] of Object.entries(fields)) {
      if (!groups[group].some(entry=>entry.id===source[field])) return null;
      output[field] = source[field];
    }
    return output;
  }
  function randomize(current, {group='all',locks={},random=Math.random}={}) {
    const result = {...(normalize(current)||defaults)};
    for (const [field,list] of Object.entries(fields)) {
      if (locks[field]) continue;
      const pool = groups[list].filter(entry=>field!=='hair'||group==='all'||entry.group===group);
      if (!pool.length) continue;
      // Pick a different option so pressing random visibly changes unlocked parts.
      const alternatives = pool.filter(entry=>entry.id!==result[field]);
      const options = alternatives.length ? alternatives : pool;
      result[field] = options[Math.min(options.length-1,Math.max(0,Math.floor(random()*options.length)))].id;
    }
    return result;
  }
  globalThis.PortraitCatalog = Object.freeze({...groups,fields,defaults,normalize,randomize});
})();
