import { runCode } from './runner';
self.onmessage = async (event: MessageEvent<string>) => {
  try {
    // Keep WASM binary out of JS minification; this is a same-origin, versioned static asset.
    const response = await fetch('/coding-runtime/quickjs-0.32.0.wasm', {credentials:'omit'});
    if(!response.ok) throw new Error('WASM asset unavailable');
    self.postMessage({ results: await runCode(event.data, await response.arrayBuffer()) });
  } catch (error) {
    console.error('CODING_WORKER_INIT', error instanceof Error ? error.message : 'unknown');
    self.postMessage({ error:'실행기를 시작하지 못했습니다. 다시 시도하세요.' });
  }
};
