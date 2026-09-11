import { act, renderHook } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { useDraft } from './use-draft';
import { getWorkspace,saveDraft } from './api';
vi.mock('./api',()=>({saveDraft:vi.fn(),getWorkspace:vi.fn()}));
const initial={markdown:'initial',lockVersion:2,contentHash:'hash'};
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('serializes saves and retains newer typing when an older response arrives',async()=>{
 let finish!:(v:typeof initial)=>void;
 vi.mocked(saveDraft).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({...initial,markdown:'newer',lockVersion:4});
 const {result}=renderHook(()=>useDraft('id',initial));
 act(()=>result.current.change('first'));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 act(()=>result.current.change('newer'));await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(saveDraft).toHaveBeenCalledTimes(1);
 await act(async()=>finish({...initial,markdown:'first',lockVersion:3}));expect(result.current.text).toBe('newer');
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveDraft).toHaveBeenLastCalledWith('id','newer',3,expect.any(AbortSignal));expect(result.current.status).toBe('saved');
});
it('pauses after conflict, retains buffer, and only loads server data after confirmation',async()=>{
 vi.mocked(saveDraft).mockRejectedValue(new ApiError(409,'CONFLICT','conflict'));
 const {result}=renderHook(()=>useDraft('id',initial));act(()=>result.current.change('mine'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(result.current.status).toBe('conflict');
 act(()=>result.current.change('still mine'));await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(saveDraft).toHaveBeenCalledTimes(1);expect(result.current.text).toBe('still mine');
 vi.spyOn(window,'confirm').mockReturnValue(false);await act(async()=>result.current.reload());expect(getWorkspace).not.toHaveBeenCalled();
 vi.mocked(window.confirm).mockReturnValue(true);vi.mocked(getWorkspace).mockResolvedValue({draft:{...initial,markdown:'server',lockVersion:8}} as Awaited<ReturnType<typeof getWorkspace>>);
 await act(async()=>result.current.reload());expect(result.current.text).toBe('server');expect(result.current.status).toBe('saved');
});
it('keeps network failures dirty and retries explicitly without a hot autosave loop',async()=>{
 vi.mocked(saveDraft).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({...initial,markdown:'mine',lockVersion:3});
 const {result}=renderHook(()=>useDraft('id',initial));act(()=>result.current.change('mine'));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(result.current.status).toBe('error');
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(saveDraft).toHaveBeenCalledTimes(1);expect(result.current.dirty).toBe(true);
 await act(async()=>result.current.retry());expect(result.current.status).toBe('saved');
});
it('cancels pending debounce and in-flight request on account editor unmount',async()=>{
 vi.mocked(saveDraft).mockImplementation(()=>new Promise(()=>{}));
 const first=renderHook(()=>useDraft('id',initial));act(()=>first.result.current.change('private'));first.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveDraft).not.toHaveBeenCalled();
 const second=renderHook(()=>useDraft('id',initial));act(()=>second.result.current.change('private'));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});const signal=vi.mocked(saveDraft).mock.calls[0][3];second.unmount();expect(signal?.aborted).toBe(true);
});
it('counts Unicode code points and normalizes line endings before saving',async()=>{
 vi.mocked(saveDraft).mockResolvedValue({...initial,markdown:'😀'.repeat(20000),lockVersion:3});
 const {result}=renderHook(()=>useDraft('id',initial));act(()=>result.current.change('😀'.repeat(20001)));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveDraft).not.toHaveBeenCalled();
 act(()=>result.current.change('😀'.repeat(20000)));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveDraft).toHaveBeenCalledTimes(1);
 act(()=>result.current.change('a\r\nb\rc'));expect(result.current.text).toBe('a\nb\nc');
});
it('distinguishes a server stage lock from concurrent edits',async()=>{
 vi.mocked(saveDraft).mockRejectedValue(new ApiError(409,'INVALID_SESSION_STATE','locked'));
 const {result}=renderHook(()=>useDraft('id',initial));act(()=>result.current.change('mine'));await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(result.current.status).toBe('locked');expect(result.current.text).toBe('mine');
});
it('reports failed reload without losing local edits',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);vi.mocked(getWorkspace).mockRejectedValue(new Error('offline'));
 const {result}=renderHook(()=>useDraft('id',initial));act(()=>result.current.change('mine'));await act(async()=>result.current.reload());expect(result.current.status).toBe('reload-error');expect(result.current.text).toBe('mine');
});
