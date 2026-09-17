// items는 { id: string, title: string } 배열입니다.
// 항목의 동일 여부는 id로 판단하며 원본 배열을 변경하지 마세요.
function addItem(items, item) {
  if (items.some(existing => existing.title === item.title)) {
    return items;
  }
  return [...items, item];
}
