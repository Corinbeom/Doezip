import {fireEvent,render,screen,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {FeedbackReview} from './feedback-review';

const feedback={practiceArea:'VERIFY' as const,items:[
 {area:'REQUEST' as const,observation:'문제를 설명했습니다.',nextAction:'맥락을 더 적으세요.',recordIds:['r1'],sources:[{id:'r1',label:'나의 요청',text:'원인을 찾아줘'}]},
 {area:'VERIFY' as const,observation:'원문을 대조했습니다.',nextAction:'반대 근거도 확인하세요.',recordIds:['r2'],sources:[{id:'r2',label:'사용자가 선택한 원문',text:'{"materialId":"m1","lineStart":1,"lineEnd":1,"quote":"로그 1행을 확인함"}'}]},
 {area:'IMPROVE' as const,observation:'결과물을 수정했습니다.',nextAction:'변경 이유를 남기세요.',recordIds:['r3'],sources:[{id:'r3',label:'제출물',text:'수정한 결과'}]},
 {area:'EXPLAIN' as const,observation:'한계를 설명했습니다.',nextAction:'대안을 비교하세요.',recordIds:['r4'],sources:[{id:'r4',label:'PUBLIC_TEST',text:'브라우저 보고 {"results":[{"name":"중복 방지","passed":true,"detail":"기대 결과와 일치합니다."}]}'}]},
]};

it('moves through focused feedback while keeping the complete archive available but collapsed',()=>{
 render(<FeedbackReview feedback={feedback} busy={false} onPractice={vi.fn()}/>);
 const focused=screen.getByText('집중해서 보기 · 1 / 4').closest('section')!;
 expect(within(focused).getByRole('heading',{name:'문제와 요청 구체화'})).toBeVisible();
 const archive=screen.getByRole('heading',{name:'전체 피드백'}).closest('details')!;
 expect(archive).not.toHaveAttribute('open');
 expect(screen.getAllByText('원문을 대조했습니다.')).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'다음 피드백'}));
 expect(within(focused).getByRole('heading',{name:'제안 검증'})).toBeVisible();
 expect(screen.getAllByText('원문을 대조했습니다.')).toHaveLength(2);
 expect(screen.getAllByText('로그 1행을 확인함')).toHaveLength(2);
 expect(screen.queryByText(/materialId/)).not.toBeInTheDocument();
 expect(screen.getByText('가장 먼저 다시 연습할 부분').closest('section')).toHaveTextContent('제안 검증');
 fireEvent.click(screen.getByRole('button',{name:'4. 판단 설명'}));
 expect(screen.getAllByText('공개 테스트 기록')).toHaveLength(2);
 expect(screen.queryByText(/"results"/)).not.toBeInTheDocument();
 fireEvent.click(within(focused).getByText('공개 테스트 기록'));
 expect(within(focused).getByText(/통과 · 중복 방지/)).toBeVisible();
});
