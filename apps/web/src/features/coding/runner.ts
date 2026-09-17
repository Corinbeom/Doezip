import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
export type CheckResult = { name: string; passed: boolean; detail: string };
export type CodingSuite = 'duplicate-items-v1'|'duplicate-items-v2';
const v1Cases = [
  { name: '새 항목 추가', input: 'addItem([], {id:"a",title:"첫 항목"})', expected: [{id:'a',title:'첫 항목'}] },
  { name: '같은 id 중복 방지', input: 'addItem([{id:"a",title:"기존"}], {id:"a",title:"다른 제목"})', expected: [{id:'a',title:'기존'}] },
  { name: '다른 항목과 순서 유지', input: 'addItem([{id:"a",title:"기존"}], {id:"b",title:"새 항목"})', expected: [{id:'a',title:'기존'},{id:'b',title:'새 항목'}] },
  { name: '원본 배열 보존', input: '(()=>{const original=[{id:"a",title:"기존"}];addItem(original,{id:"b",title:"새 항목"});return original;})()', expected: [{id:'a',title:'기존'}] },
];
const suites:Record<CodingSuite,typeof v1Cases>={
 'duplicate-items-v1':v1Cases,
 'duplicate-items-v2':[
  {name:'새 id 추가',input:'addItem([{id:"a",title:"기존"}], {id:"b",title:"새 항목"})',expected:[{id:'a',title:'기존'},{id:'b',title:'새 항목'}]},
  {name:'같은 id는 기존 항목 유지',input:'addItem([{id:"a",title:"기존"}], {id:"a",title:"바뀐 제목"})',expected:[{id:'a',title:'기존'}]},
  {name:'같은 제목이어도 다른 id 추가',input:'addItem([{id:"a",title:"같은 제목"}], {id:"b",title:"같은 제목"})',expected:[{id:'a',title:'같은 제목'},{id:'b',title:'같은 제목'}]},
  {name:'원본 배열 보존',input:'(()=>{const original=[{id:"a",title:"기존"}];addItem(original,{id:"b",title:"새 항목"});return original;})()',expected:[{id:'a',title:'기존'}]},
 ],
};
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
      const passed = Array.isArray(actual) && actual.length === expected.length && actual.every((item,i) =>
        item !== null && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 2 &&
        item.id === expected[i].id && item.title === expected[i].title);
      return {name,passed,detail:passed?'기대 결과와 일치합니다.':'기대 결과: '+JSON.stringify(expected)+' / 실제 결과: '+value.slice(0,200)};
    } finally { vm.dispose(); runtime.dispose(); }
  });
}
