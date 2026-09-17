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
 it('retry policy rejects broad 5xx logic and accepts the explicit safe policy',async()=>{
  const broad='function shouldRetry(x){return x.status>=500&&x.attempt<3;}';
  expect((await runCode(broad,undefined,'retry-policy-v1')).map(x=>x.passed)).toEqual([true,false,false,true,false,false,true]);
  const safe='function shouldRetry(x){const temporary=[429,502,503,504].includes(x.status)||x.errorCode==="NETWORK_TIMEOUT";return temporary&&Number.isInteger(x.attempt)&&x.attempt>=0&&x.attempt<3&&typeof x.idempotencyKey==="string"&&x.idempotencyKey.trim().length>0;}';
  expect((await runCode(safe,undefined,'retry-policy-v1')).every(result=>result.passed)).toBe(true);
 });
 it('accepts semantically equal objects with a different key order',async()=>{expect((await runCode('function addItem(items,item){return (items.some(x=>x.id===item.id)?items:[...items,item]).map(x=>({title:x.title,id:x.id}));}')).every(r=>r.passed)).toBe(true);});
 it('limits infinite loops and reports syntax errors without hanging',async()=>{expect((await runCode('while(true){}')).every(r=>!r.passed)).toBe(true);expect((await runCode('function {')).every(r=>!r.passed)).toBe(true);});
 it('does not expose host globals or carry state across tests/runs',async()=>{expect((await runCode('fetch("https://example.com");'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode('process.exit();'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode('localStorage.clear();'+correct)).every(r=>!r.passed)).toBe(true);expect((await runCode(correct)).every(r=>r.passed)).toBe(true);});
});
