import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryProvider} from '@/shared/api/query-provider';
import {beforeEach,expect,it,vi} from 'vitest';
import {LearningPage} from './learning-page';
import {listFlows,type Flow} from './api';

const {deleteAccount,replace}=vi.hoisted(()=>({deleteAccount:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>'/learn',useRouter:()=>({push:vi.fn(),replace})}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:()=>({status:'connected',user:{id:'user-1',displayName:'은범',email:null,legalAccepted:true},logout:vi.fn(),reconnect:vi.fn(),acceptPolicies:vi.fn(),deleteAccount})}));
vi.mock('./api',async(importOriginal)=>({...await importOriginal<typeof import('./api')>(),listFlows:vi.fn()}));

beforeEach(()=>{
  vi.mocked(listFlows).mockResolvedValue([]);
  deleteAccount.mockReset();replace.mockReset();
});

it('requires an explicit irreversible confirmation before deleting the account',async()=>{
  deleteAccount.mockResolvedValue(undefined);render(<QueryProvider><LearningPage/></QueryProvider>);
  fireEvent.click(screen.getByRole('button',{name:'회원 탈퇴 및 데이터 삭제'}));
  const remove=screen.getByRole('button',{name:'계정과 데이터 영구 삭제'});expect(remove).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:/삭제 범위/}));fireEvent.change(screen.getByLabelText(/확인을 위해/),{target:{value:'탈퇴'}});
  expect(remove).toBeEnabled();fireEvent.click(remove);await waitFor(()=>expect(deleteAccount).toHaveBeenCalledOnce());expect(replace).toHaveBeenCalledWith('/');
});

it('keeps task selection in the catalog and focuses my learning on saved records',async()=>{
  render(<QueryProvider><LearningPage/></QueryProvider>);
  expect(screen.getByRole('heading',{name:'은범님, 지난 판단을 돌아보고 이어가세요.'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'진행 중인 학습'})).toBeInTheDocument();
  expect(await screen.findByText('진행 중인 과제가 없습니다.')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'완료한 학습과 리포트'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/과제 시작하기/})).not.toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:/과제 둘러보기/}).every(link=>link.getAttribute('href')==='/tasks')).toBe(true);
});

it('previews the focus of a completed learning report',async()=>{
  vi.mocked(listFlows).mockResolvedValue([{id:'flow-1',mode:'TRAINING',kind:'REPORT',parentId:null,stage:'FEEDBACK',feedbackStatus:'SUCCEEDED',task:{title:'활성화 하락 원인 분석'},feedback:{practiceArea:'VERIFY',items:[{area:'VERIFY',observation:'AI의 결론을 원자료와 대조했습니다.',nextAction:'반대 자료도 함께 확인하세요.',recordIds:[],sources:[]}]}} as unknown as Flow]);
  render(<QueryProvider><LearningPage/></QueryProvider>);
  expect(await screen.findByRole('heading',{name:'활성화 하락 원인 분석'})).toBeInTheDocument();
  expect(screen.getByText('제안 검증을 다음 연습으로')).toBeInTheDocument();
  expect(screen.getByText('AI의 결론을 원자료와 대조했습니다.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/피드백 다시 보기/})).toHaveAttribute('href','/learn/flow-1');
});
