(() => {
  const list=(prefix,names)=>names.map((name,i)=>({id:`${prefix}${i+1}`,name}));
  const identityTransform=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
  const femaleTransform=()=>({position:[0,.005,-.004],rotation:[0,0,0],scale:[1.05,1.03,1.06]});
  const hairTransforms={
    m1:{position:[0,.004,-.006],rotation:[0,0,0],scale:[1.02,1.01,1.03]},
    f7:{position:[0,.008,-.008],rotation:[0,0,0],scale:[1.07,1.04,1.08]}
  };
  const crownProfiles={
    m1:{position:[0,1.47,.005],scale:[.235,.15,.23],count:6,spread:.72},m2:{position:[-.035,1.47,.0],scale:[.255,.19,.24],sweep:-.18},m3:{position:[0,1.49,-.015],scale:[.265,.215,.245],count:8},m6:{position:[0,1.455,-.035],scale:[.24,.16,.255],sweep:.2},m8:{position:[0,1.50,-.01],scale:[.235,.235,.235],count:7},m9:{position:[0,1.45,-.005],scale:[.235,.15,.23],count:5},
    f1:{position:[0,1.48,.005],scale:[.265,.18,.255],count:8,spread:.9},f2:{position:[0,1.48,-.035],scale:[.255,.19,.285],sweep:.08},f3:{position:[0,1.47,-.06],scale:[.245,.16,.31],count:7,sweep:.24},f4:{position:[0,1.47,-.02],scale:[.265,.19,.26],count:8},f5:{position:[0,1.49,-.03],scale:[.245,.20,.255],count:7},f7:{position:[0,1.49,-.01],scale:[.28,.215,.27],count:9},f8:{position:[-.025,1.47,-.025],scale:[.265,.185,.27],sweep:-.18},f10:{position:[0,1.475,-.045],scale:[.27,.20,.29],count:10,spread:.94,strandWidth:.15,strandDepth:.14,sideWidth:.15,backWidth:.15}
  };
  const frontLift={m2:.025,m4:.02,m5:.02,m6:.06,m8:.045,m10:-.005,f2:.015,f3:.025,f4:.02,f5:.045,f8:.02,f9:.025,f10:.02};
  // Each style owns its scalp-following silhouette. These are generation
  // profiles, not a shared visible HairCap: front/side/back edges and crown
  // shaping remain style-specific while using the same low-poly builder.
  const surfaceProfiles={
    m1:{frontEnd:1.55,sideEnd:2.12,backEnd:2.66,bulge:.012,wave:.14,flatten:.76,lift:.055,flow:.018,flowCount:3,position:[0,1.405,.012],scale:[.260,.274,.268]},
    m2:{frontEnd:1.32,sideEnd:2.18,backEnd:2.67,bulge:.018,wave:.10,flatten:.72,lift:.060,flow:.030,flowCount:2,skew:-.10,position:[-.006,1.407,.010],scale:[.264,.279,.270]},
    m3:{frontEnd:1.47,sideEnd:2.08,backEnd:2.57,bulge:.035,wave:.18,flatten:.66,lift:.075,flow:.055,flowCount:5,position:[0,1.405,.006],scale:[.268,.288,.269]},
    m4:{frontEnd:1.34,sideEnd:2.16,backEnd:2.67,bulge:.018,wave:.12,flatten:.72,lift:.060,flow:.026,flowCount:2,skew:-.14,position:[-.008,1.407,.010],scale:[.264,.280,.270]},
    m5:{frontEnd:1.34,sideEnd:2.16,backEnd:2.67,bulge:.018,wave:.12,flatten:.72,lift:.060,flow:.026,flowCount:2,skew:.14,position:[.008,1.407,.010],scale:[.264,.280,.270]},
    m6:{frontEnd:1.17,sideEnd:2.08,backEnd:2.75,bulge:.012,wave:.04,flatten:.70,lift:.052,flow:.032,flowCount:2,lean:-.055,position:[0,1.410,.002],scale:[.262,.278,.278]},
    m7:{frontEnd:1.48,sideEnd:2.19,backEnd:2.68,bulge:.026,wave:.20,flatten:.69,lift:.068,flow:.050,flowCount:3,position:[0,1.407,.006],scale:[.270,.286,.274]},
    m8:{frontEnd:1.24,sideEnd:2.09,backEnd:2.64,bulge:.040,wave:.12,flatten:.63,lift:.088,flow:.045,flowCount:4,position:[0,1.410,.006],scale:[.266,.294,.270]},
    m9:{frontEnd:1.43,sideEnd:1.84,backEnd:2.46,bulge:.010,wave:.08,flatten:.76,lift:.050,flow:.018,flowCount:2,position:[0,1.405,.010],scale:[.258,.272,.263]},
    m10:{frontEnd:1.62,sideEnd:2.30,backEnd:2.76,bulge:.030,wave:.23,flatten:.68,lift:.070,flow:.058,flowCount:5,position:[0,1.404,.006],scale:[.274,.290,.279]},
    f1:{frontEnd:1.48,sideEnd:2.42,backEnd:2.82,bulge:.018,wave:.13,flatten:.73,lift:.062,flow:.025,flowCount:3,position:[0,1.410,.008],scale:[.270,.286,.279]},
    f2:{frontEnd:1.34,sideEnd:2.38,backEnd:2.88,bulge:.014,wave:.08,flatten:.72,lift:.060,flow:.020,flowCount:2,position:[0,1.410,.004],scale:[.268,.285,.284]},
    f3:{frontEnd:1.28,sideEnd:2.30,backEnd:2.80,bulge:.018,wave:.09,flatten:.70,lift:.064,flow:.030,flowCount:2,lean:-.025,position:[0,1.412,.002],scale:[.267,.286,.282]},
    f4:{frontEnd:1.45,sideEnd:2.34,backEnd:2.80,bulge:.022,wave:.14,flatten:.69,lift:.068,flow:.035,flowCount:3,position:[0,1.410,.005],scale:[.272,.289,.281]},
    f5:{frontEnd:1.18,sideEnd:2.27,backEnd:2.74,bulge:.015,wave:.06,flatten:.70,lift:.060,flow:.020,flowCount:2,position:[0,1.414,.002],scale:[.266,.284,.279]},
    f6:{frontEnd:1.42,sideEnd:2.36,backEnd:2.82,bulge:.020,wave:.12,flatten:.70,lift:.065,flow:.030,flowCount:3,position:[0,1.410,.004],scale:[.271,.288,.282]},
    f7:{frontEnd:1.51,sideEnd:2.43,backEnd:2.84,bulge:.032,wave:.22,flatten:.66,lift:.076,flow:.055,flowCount:4,position:[0,1.409,.003],scale:[.276,.295,.286]},
    f8:{frontEnd:1.31,sideEnd:2.37,backEnd:2.83,bulge:.021,wave:.13,flatten:.69,lift:.066,flow:.034,flowCount:2,skew:-.12,position:[-.005,1.411,.003],scale:[.272,.289,.283]},
    f9:{frontEnd:1.27,sideEnd:2.28,backEnd:2.75,bulge:.016,wave:.08,flatten:.70,lift:.062,flow:.026,flowCount:3,position:[0,1.413,.003],scale:[.268,.286,.279]},
    f10:{frontEnd:1.08,sideEnd:2.30,backEnd:2.82,bulge:.008,wave:.07,flatten:.72,lift:.058,flow:.025,flowCount:2,position:[0,1.412,.012],scale:[.266,.282,.278]}
  };
  const hairEntry=(entry,group)=>({...entry,group,frontLift:frontLift[entry.id]||0,transform:hairTransforms[entry.id]||(group==='female'?femaleTransform():identityTransform()),crown:crownProfiles[entry.id]||{position:[0,group==='female'?1.475:1.46,-.01],scale:group==='female'?[.26,.19,.26]:[.245,.175,.24]},surface:surfaceProfiles[entry.id]});
  const hair=[...list('m',['단정한 숏컷','옆가르마','볼륨 스파이크','왼쪽 가르마','오른쪽 가르마','슬릭백','웨이브 숏컷','높은 앞머리','언더컷','덥수룩한 숏컷']).map(x=>hairEntry(x,'male')),
    ...list('f',['단발','긴 생머리','포니테일','트윈테일','높은 올림머리','양갈래 땋은 머리','웨이브 단발','옆으로 땋은 머리','양쪽 둥근 올림머리','공주 반묶음']).map(x=>hairEntry(x,'female'))];
  const eyes=list('eye',['화난형','보통형','웃음형','졸림형','무표정형','놀람형','슬픔형','장음형','장난형','이종형']);
  const eyeColors=['#8e3329','#6c4938','#5077a5','#537b5f','#76609a','#b37939','#596577','#d09244'].map((color,i)=>({id:`ec${i+1}`,name:['적갈색','갈색','청색','녹색','보라색','호박색','회청색','금색'][i],color}));
  const eyebrows=list('brow',['기본 눈썹','일자 눈썹','부드러운 곡선 눈썹','올라간 눈썹','처진 눈썹']);
  const noses=list('nose',['원본 코','작은 코','긴 코','오똑한 코','넓은 코','낮고 둥근 코','평평한 코','가느다란 코','도톰한 코','작고 오똑한 코']);
  const ears=list('ear',['원본 귀','작은 귀','큰 귀','길쭉한 귀','넓은 귀','높은 귀','낮은 귀','바깥으로 펼친 귀','좁고 긴 귀','길고 높은 귀']);
  const mouths=list('mouth',['원본 입','작은 입','넓은 미소','얇은 입','도톰한 미소','처진 입꼬리','오므린 입','작은 미소','올라간 입꼬리','넓고 얇은 입']);
  const skins=['#f4d5c1','#ffe4d3','#efd1be','#ecc1a8','#dfb095','#d39d7d','#bc8766','#a37152','#84563d','#65412f'].map((color,i)=>({id:`skin${i+1}`,name:['원본 톤','밝은 아이보리','로즈 아이보리','복숭아','웜 베이지','골든 베이지','라이트 브론즈','브론즈','딥 브라운','에보니'][i],color}));
  const hairColors=globalThis.HairColorCatalog||[];
  const fields={hair:'hair',hairColor:'hairColors',eyes:'eyes',eyeColor:'eyeColors',eyebrows:'eyebrows',nose:'noses',ears:'ears',mouth:'mouths',skin:'skins'},groups={hair,hairColors,eyes,eyeColors,eyebrows,noses,ears,mouths,skins};
  const defaults=Object.freeze({version:2,base:'female',hair:'f1',hairColor:'hc1',eyes:'eye2',eyeColor:'ec3',eyebrows:'brow1',nose:'nose1',ears:'ear1',mouth:'mouth1',skin:'skin1'});
  function normalize(value){
    if(value?.version!==2||!['male','female'].includes(value.base))return null;
    const result={version:2,base:value.base},source={...value,hairColor:value.hairColor||defaults.hairColor,eyeColor:value.eyeColor||defaults.eyeColor,eyebrows:value.eyebrows||defaults.eyebrows};
    for(const [field,group] of Object.entries(fields)){if(!groups[group].some(e=>e.id===source[field]))return null;result[field]=source[field];}
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
