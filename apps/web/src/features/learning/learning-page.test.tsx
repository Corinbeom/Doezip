import {render,screen} from '@testing-library/react';
import {QueryProvider} from '@/shared/api/query-provider';
import {beforeEach,expect,it,vi} from 'vitest';
import {LearningPage} from './learning-page';
import {catalog,listFlows} from './api';

vi.mock('next/navigation',()=>({usePathname:()=>'/learn',useRouter:()=>({push:vi.fn()})}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:()=>({status:'connected',user:{id:'user-1',displayName:'은범',email:null},logout:vi.fn(),reconnect:vi.fn()})}));
vi.mock('./api',async(importOriginal)=>({...await importOriginal<typeof import('./api')>(),catalog:vi.fn(),listFlows:vi.fn()}));

beforeEach(()=>{
  vi.mocked(catalog).mockResolvedValue([{kind:'REPORT',title:'장애 원인 분석 보고서',situation:'운영 자료를 읽고 원인과 다음 확인을 정리합니다.',requirements:['자료의 사실을 구분합니다.','주장에 근거를 연결합니다.'],deliverable:'근거가 연결된 보고서',questions:['어떤 판단을 했나요?','무엇을 바꾸겠나요?'],hints:[]}]);
  vi.mocked(listFlows).mockResolvedValue([]);
});

it('prioritizes the current learning status before starting a new task',async()=>{
  render(<QueryProvider><LearningPage/></QueryProvider>);
  expect(screen.getByRole('heading',{name:'은범님, 오늘은 어떤 판단을 연습할까요?'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'진행 중인 학습'})).toBeInTheDocument();
  expect(await screen.findByText('진행 중인 과제가 없습니다.')).toBeInTheDocument();
  expect(await screen.findByRole('button',{name:'보고서 과제 시작하기'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'완료한 과제'})).toBeInTheDocument();
});
