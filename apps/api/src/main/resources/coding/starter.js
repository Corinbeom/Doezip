// items는 { id: string, title: string } 배열입니다.
// 원본 배열을 변경하지 않고, 같은 id가 이미 있으면 중복 추가하지 마세요.
function addItem(items, item) {
  items.push(item);
  return items;
}
