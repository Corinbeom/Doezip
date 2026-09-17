import {describe,it,expect} from 'vitest';
import {runCode} from './runner';
const correct='function addItem(items,item){return items.some(x=>x.id===item.id)?items.slice():[...items,item];}';
describe('isolated JavaScript practice runner',()=>{
 it('runs the real starter and catches duplication and mutation',async()=>{const r=await runCode('function addItem(items,item){items.push(item);return items;}');expect(r.map(x=>x.passed)).toEqual([true,false,true,false]);});
 it('executes a corrected function',async()=>{expect((await runCode(correct)).every(r=>r.passed)).toBe(true);});
 it('v2 catches title-based identity and accepts id-based identity',async()=>{
  const flawed='function addItem(items,item){return items.some(x=>x.title===item.title)?items:[...items,item];}';
  expect((await runCode(flawed,undefined,'duplicate-items-v2')).map(x=>x.passed)).toEqual([true,false,false,true]);
  expect((await runCode(correct,undefined,'duplicate-items-v2')).every(r=>r.passed)).toBe(true);
 });
 it('accepts semantically equal objects with a different key order',async()=>{expect((await runCode('function addItem(items,item){return (items.some(x=>x.id===item.id)?items:[...items,item]).map(x=>({title:x.title,id:x.id}));}')).every(r=>r.passed)).toBe(true);});
 it('limits infinite loops and reports syntax errors without hanging',async()=>{expect((await runCode('while(true){}')).every(r=>!r.passed)).toBe(true);expect((await runCode('function {')).every(r=>!r.passed)).toBe(true);});
 it('does not expose host globals or carry state across tests/runs',async()=>{expect((await runCode('fetch("https://example.com");'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode('process.exit();'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode('localStorage.clear();'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode(correct)).every(r=>r.passed)).toBe(true);});
});
