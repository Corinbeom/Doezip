import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AiResponseProgress} from './ai-response-progress';

afterEach(()=>vi.useRealTimers());

it('shows honest elapsed time and advances the report preparation stage',()=>{
 vi.useFakeTimers();
 render(<AiResponseProgress context="report"/>);
 expect(screen.getByText('자료와 대화 맥락을 확인하고 있어요.')).toBeVisible();
 expect(screen.getByText('0초')).toBeVisible();
 act(()=>vi.advanceTimersByTime(4500));
 expect(screen.getByText('질문에 필요한 근거를 정리하고 있어요.')).toBeVisible();
 expect(screen.getByText('4초')).toBeVisible();
 act(()=>vi.advanceTimersByTime(4000));
 expect(screen.getByText('답변을 구성하고 있어요.')).toBeVisible();
 expect(screen.getByText('8초')).toBeVisible();
});
