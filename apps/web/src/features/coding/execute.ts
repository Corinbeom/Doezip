import type { CheckResult } from './runner';
import type { CodingSuite } from './runner';
export function execute(code: string, suite:CodingSuite, signal: AbortSignal): Promise<CheckResult[]> {
  return new Promise((resolve,reject) => {
    if(signal.aborted){reject(new Error('실행이 취소되었습니다.'));return;}
    const worker = new Worker(new URL('./execution.worker.ts', import.meta.url), {type:'module'});
    const finish = (error?:string,results?:CheckResult[]) => {
      clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();
      if(error)reject(new Error(error));else resolve(results!);
    };
    const abort=()=>finish('실행이 취소되었습니다.');
    const timer=setTimeout(()=>finish('실행 제한 시간을 초과했습니다.'),8000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=(event)=>finish(event.data.error,event.data.results);
    worker.onerror=()=>finish('실행기를 불러오지 못했습니다.');
    worker.postMessage({code,suite});
  });
}
