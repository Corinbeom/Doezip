function describeValue(value:unknown) {
  if(Array.isArray(value)) {
    const items=value.slice(0,5).map(item=>{
      if(item&&typeof item==='object'&&!Array.isArray(item)&&'id' in item&&'title' in item) {
        return `${String(item.id)} · ${String(item.title)}`;
      }
      return typeof item==='string'?item:'확인할 수 없는 항목';
    });
    return `항목 ${value.length}개${items.length>0?` (${items.join(', ')})`:''}`;
  }
  if(value===null)return '값 없음';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  return '형식을 확인할 수 없는 값';
}

export function formatTestResultDetail(detail:string) {
  const matched=detail.match(/^기대 결과:\s*([\s\S]*?)\s*\/\s*실제 결과:\s*([\s\S]*)$/);
  if(!matched)return detail;
  try {
    const expected:unknown=JSON.parse(matched[1]);
    const actual:unknown=JSON.parse(matched[2]);
    return `예상: ${describeValue(expected)}\n실제: ${describeValue(actual)}`;
  } catch {
    return '예상한 항목과 실제 반환된 항목이 다릅니다.';
  }
}
