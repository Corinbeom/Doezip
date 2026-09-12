import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getReport,reportSchema,type Report} from './api';
import {ReportPanel} from './report-panel';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),getReport:vi.fn()}));
const id='12345678-1234-4234-8234-123456789012';
const report:Report={id,sessionId:id,evaluationId:id,phase:'INITIAL',documentVersionId:id,sample:true,summary:'<script>window.evil=true</script>',strengths:[],improvements:[],areas:([ 'PROMPT','EVIDENCE','DOCUMENT','DEFENSE'] as const).map(area=>({area,dimensions:[{code:area,title:`${area} 기준`,state:'NOT_OBSERVED',rationale:'입력 없음',gap:null,nextAction:null,confidenceLevel:null,evidence:[]}]})),faultSummary:{statements:[],note:'정답 검수 전'},comparison:null,nextPracticeText:null,createdAt:'2026-09-12T00:00:00Z'};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getReport).mockResolvedValue(report);});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...render(<QueryClientProvider client={client}><ReportPanel id={id} userId="owner"/></QueryClientProvider>)};}
it('shows sample warning and four areas while rendering text literally',async()=>{
 const {container,client}=mount();await screen.findByRole('heading',{name:'최초 평가 결과'});expect(screen.getByRole('note')).toHaveTextContent('개발용 예시');expect(screen.getByText(report.summary)).toBeVisible();expect(container.querySelector('script')).toBeNull();expect(screen.getAllByText(/기준 · 관찰되지 않음/)).toHaveLength(4);expect(client.getQueryCache().getAll()[0].meta?.private).toBe(true);
});
it('shows load failure and recovers through explicit retry',async()=>{
 vi.mocked(getReport).mockRejectedValueOnce(new Error('offline'));mount();expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');fireEvent.click(screen.getByRole('button',{name:'결과 다시 불러오기'}));await screen.findByRole('heading',{name:'최초 평가 결과'});
});
it('renders evidence quotes and keeps real results free of the sample banner',async()=>{
 const actual=structuredClone(report);actual.sample=false;const d=actual.areas[2].dimensions[0];d.state='PARTIAL';d.evidence=[{id,kind:'SELF_REPORT',polarity:'SUPPORT',method:'RULE',subjectType:'DOCUMENT_VERSION',subjectId:id,excerpt:'사용자 보고서 인용',explanation:'관찰 설명',source:{materialId:id,lineStart:2,lineEnd:3,quotedText:'자료 인용문'}}];vi.mocked(getReport).mockResolvedValue(actual);mount();await screen.findByRole('heading',{name:'최초 평가 결과'});expect(screen.queryByRole('note')).not.toBeInTheDocument();fireEvent.click(screen.getByText('판단을 뒷받침하는 관찰'));expect(screen.getByText('자료 인용문')).toBeVisible();
});
it('rejects unexpected private fields and unsupported final reports',()=>{
 expect(reportSchema.safeParse(report).success).toBe(true);expect(reportSchema.safeParse({...report,privateAnswer:'forbidden'}).success).toBe(false);expect(reportSchema.safeParse({...report,phase:'FINAL'}).success).toBe(false);
});
