(() => {
  const colors = [
    {id:'hc1',name:'자연 흑갈색',dark:'#35170d',light:'#572717'},
    {id:'hc2',name:'애쉬 블랙',dark:'#17181d',light:'#343842'},
    {id:'hc3',name:'초콜릿 브라운',dark:'#4a2418',light:'#7a432d'},
    {id:'hc4',name:'허니 블론드',dark:'#9c7130',light:'#e1bd69'},
    {id:'hc5',name:'실버',dark:'#777b87',light:'#c9ced8'},
    {id:'hc6',name:'로즈 레드',dark:'#702a32',light:'#b95660'},
    {id:'hc7',name:'네이비 블루',dark:'#202b50',light:'#42588c'},
    {id:'hc8',name:'포레스트 그린',dark:'#254438',light:'#4d7560'}
  ];
  globalThis.HairColorCatalog=Object.freeze(colors.map(Object.freeze));
})();
