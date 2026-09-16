import {describe,expect,it} from 'vitest';
import {formatTestResultDetail} from './test-result-copy';

describe('formatTestResultDetail',()=>{
  it('turns stored JSON comparisons into readable item summaries',()=>{
    const detail='기대 결과: [{"id":"a","title":"기존"}] / 실제 결과: [{"id":"a","title":"기존"},{"id":"a","title":"다른 제목"}]';
    expect(formatTestResultDetail(detail)).toBe('예상: 항목 1개 (a · 기존)\n실제: 항목 2개 (a · 기존, a · 다른 제목)');
    expect(formatTestResultDetail(detail)).not.toContain('{');
  });

  it('keeps ordinary explanations unchanged',()=>{
    expect(formatTestResultDetail('기대 결과와 일치합니다.')).toBe('기대 결과와 일치합니다.');
  });
});
