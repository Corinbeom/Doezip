'use client';

import {useSyncExternalStore} from 'react';

const changedEvent='doezip:learning-step-changed';
const prefix='doezip:learning-step:';

function readStep(id?:string) {
  if(!id||typeof window==='undefined')return 0;
  const value=Number(window.localStorage.getItem(`${prefix}${id}`));
  return Number.isInteger(value)&&value>=0&&value<3?value:0;
}

function subscribe(onChange:()=>void) {
  window.addEventListener('storage',onChange);
  window.addEventListener(changedEvent,onChange);
  return()=>{window.removeEventListener('storage',onChange);window.removeEventListener(changedEvent,onChange);};
}

export function useLearningStep(id?:string) {
  return useSyncExternalStore(subscribe,()=>readStep(id),()=>0);
}

export function storeLearningStep(id:string,step:number) {
  window.localStorage.setItem(`${prefix}${id}`,String(step));
  window.dispatchEvent(new Event(changedEvent));
}
