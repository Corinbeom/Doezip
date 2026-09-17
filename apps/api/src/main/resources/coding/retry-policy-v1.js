// input: { status, errorCode, attempt, idempotencyKey }
// 안전하게 같은 결제 요청을 다시 보내도 되는 경우만 true를 반환하세요.
function shouldRetry(input) {
  return input.status >= 500 && input.attempt < 3;
}
