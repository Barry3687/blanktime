(function(scope){
  'use strict';
  function normalize(value){if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())Object.defineProperty(out,key,{value:normalize(value[key]),enumerable:true,configurable:true,writable:true});return out;}return value;}
  const api={canonical:value=>JSON.stringify(normalize(value)),equal:(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b))};
  scope.BlanktimeValue=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
