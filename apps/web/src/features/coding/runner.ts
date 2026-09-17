import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
export type CheckResult = { name: string; passed: boolean; detail: string };
export type CodingSuite = 'duplicate-items-v1'|'duplicate-items-v2'|'retry-policy-v1';
type TestCase={name:string;input:string;expected:unknown};
const v1Cases = [
  { name: '새 항목 추가', input: 'addItem([], {id:"a",title:"첫 항목"})', expected: [{id:'a',title:'첫 항목'}] },
  { name: '같은 id 중복 방지', input: 'addItem([{id:"a",title:"기존"}], {id:"a",title:"다른 제목"})', expected: [{id:'a',title:'기존'}] },
  { name: '다른 항목과 순서 유지', input: 'addItem([{id:"a",title:"기존"}], {id:"b",title:"새 항목"})', expected: [{id:'a',title:'기존'},{id:'b',title:'새 항목'}] },
  { name: '원본 배열 보존', input: '(()=>{const original=[{id:"a",title:"기존"}];addItem(original,{id:"b",title:"새 항목"});return original;})()', expected: [{id:'a',title:'기존'}] },
];
const suites:Record<CodingSuite,TestCase[]>={
 'duplicate-items-v1':v1Cases,
 'duplicate-items-v2':[
  {name:'새 id 추가',input:'addItem([{id:"a",title:"기존"}], {id:"b",title:"새 항목"})',expected:[{id:'a',title:'기존'},{id:'b',title:'새 항목'}]},
  {name:'같은 id는 기존 항목 유지',input:'addItem([{id:"a",title:"기존"}], {id:"a",title:"바뀐 제목"})',expected:[{id:'a',title:'기존'}]},
  {name:'같은 제목이어도 다른 id 추가',input:'addItem([{id:"a",title:"같은 제목"}], {id:"b",title:"같은 제목"})',expected:[{id:'a',title:'같은 제목'},{id:'b',title:'같은 제목'}]},
  {name:'원본 배열 보존',input:'(()=>{const original=[{id:"a",title:"기존"}];addItem(original,{id:"b",title:"새 항목"});return original;})()',expected:[{id:'a',title:'기존'}]},
 ],
 'retry-policy-v1':[
  {name:'503 일시 오류 재시도',input:'shouldRetry({status:503,errorCode:null,attempt:1,idempotencyKey:"pay-1"})',expected:true},
  {name:'429 제한 응답 재시도',input:'shouldRetry({status:429,errorCode:null,attempt:0,idempotencyKey:"pay-2"})',expected:true},
  {name:'일반 500 오류 중단',input:'shouldRetry({status:500,errorCode:null,attempt:1,idempotencyKey:"pay-3"})',expected:false},
  {name:'최대 시도 이후 중단',input:'shouldRetry({status:503,errorCode:null,attempt:3,idempotencyKey:"pay-4"})',expected:false},
  {name:'멱등성 키 없으면 중단',input:'shouldRetry({status:503,errorCode:null,attempt:1,idempotencyKey:""})',expected:false},
  {name:'네트워크 시간 초과 재시도',input:'shouldRetry({status:null,errorCode:"NETWORK_TIMEOUT",attempt:2,idempotencyKey:"pay-5"})',expected:true},
  {name:'입력 객체 보존',input:'(()=>{const x={status:502,errorCode:null,attempt:0,idempotencyKey:"pay-6"};const before=JSON.stringify(x);shouldRetry(x);return JSON.stringify(x)===before;})()',expected:true},
 ],
};
function same(actual:unknown,expected:unknown):boolean{
 if(Object.is(actual,expected))return true;
 if(Array.isArray(actual)&&Array.isArray(expected))return actual.length===expected.length&&actual.every((item,index)=>same(item,expected[index]));
 if(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object'&&!Array.isArray(actual)&&!Array.isArray(expected)){
  const a=actual as Record<string,unknown>,e=expected as Record<string,unknown>;const ak=Object.keys(a).sort(),ek=Object.keys(e).sort();
  return ak.length===ek.length&&ak.every((key,index)=>key===ek[index]&&same(a[key],e[key]));
 }
 return false;
}
export async function runCode(code: string, wasmBinary?: ArrayBuffer, suite:CodingSuite='duplicate-items-v1'): Promise<CheckResult[]> {
  if (code.length > 20000) throw new Error('코드는 20,000자 이하여야 합니다.');
  const engine = await newQuickJSWASMModuleFromVariant(wasmBinary ? newVariant(variant, {wasmBinary}) : variant);
  // No host functions, module loader, DOM, network, credentials or filesystem are exposed.
  return suites[suite].map(({ name, input, expected }) => {
    const runtime = engine.newRuntime();
    runtime.setMemoryLimit(8 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024);
    const deadline = Date.now() + 300;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    const vm = runtime.newContext();
    try {
      const result = vm.evalCode(`${code}\n;${input}`, 'solution.js');
      if (result.error) {
        // Do not dump arbitrary guest objects or invoke attacker-controlled toJSON/getters in the host.
        result.error.dispose(); return { name, passed:false, detail:'구문·실행 오류 또는 시간·메모리 제한 초과' };
      }
      // Serialize inside the guest with its deadline, then read only a bounded primitive string.
      vm.setProp(vm.global, '__doezip_result', result.value); result.value.dispose();
      const serialized = vm.evalCode('JSON.stringify(__doezip_result)');
      if (serialized.error) { serialized.error.dispose(); return {name,passed:false,detail:'반환값을 확인할 수 없습니다.'}; }
      let value: string;
      try { value = vm.typeof(serialized.value) === 'string' ? vm.getString(serialized.value) : ''; }
      finally { serialized.value.dispose(); }
      let actual: unknown;
      try { actual = value.length <= 20000 ? JSON.parse(value) : null; } catch { actual = null; }
      // Compare values, not object key order. JSON.parse produces plain data, never guest getters.
      const passed=same(actual,expected);
      return {name,passed,detail:passed?'기대 결과와 일치합니다.':'기대 결과: '+JSON.stringify(expected)+' / 실제 결과: '+value.slice(0,200)};
    } finally { vm.dispose(); runtime.dispose(); }
  });
}
