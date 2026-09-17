# AI 평가 연결

AI 평가는 웹이 아닌 Spring API에서 Gemini Developer API를 호출한다. Supabase 로그인 설정과 별개이며 Google OAuth Client Secret을 사용하지 않는다.

## 설정

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 본인 프로젝트의 Gemini API 키를 발급한다. [공식 키 안내](https://ai.google.dev/gemini-api/docs/api-key)를 참고한다.
2. **현재 실행할 worktree의 루트 `.env`**에 아래 값을 저장한다. `apps/web/.env`나 `NEXT_PUBLIC_` 변수에 넣지 않는다. 실제 키를 커밋·채팅·스크린샷에 포함하지 않는다.

```dotenv
AI_EVALUATION_ENABLED=true
GEMINI_API_KEY=여기에_본인_API_키
AI_EVALUATION_MODEL=gemini-3.5-flash-lite
AI_EVALUATION_DAILY_CALL_LIMIT=10
AI_EVALUATION_GLOBAL_DAILY_CALL_LIMIT=50
```

통합 후에는 `develop` 또는 여기서 분기한 현재 작업 공간을 사용한다. 예시 설정은 비활성화이며, 실제 로컬 설정은 이 파일에서 관리한다. 루트 실행기가 값을 Spring에 명시적으로 전달한다. 변경 후 API를 재시작한다. 기존 다른 worktree의 `.env`를 수정해도 이 실행기에 반영되지 않는다.

3. 같은 worktree에서 `npm run test:ai`를 실행한다. 가상 공개 입력으로 실제 Gemini를 **1회 호출**하고 결과의 구조·루브릭·근거를 검증한다. DB나 OAuth는 필요하지 않다. 키가 없으면 실패하며 성공으로 건너뛰지 않는다. 호출 비용·quota를 사용할 수 있다. 이 명령은 테스트/CI 기본 검사에 포함되지 않는다.
4. `npm run db:up` 후 `npm run dev`로 실행한다. 이미 실행 중인 같은 앱은 종료하고 시작한다. 과제 시작 → 보고서 최초 제출 → 검산 제출 → 평가 요청 → 결과 표시 → 새로고침 복원을 확인한다.

키 없이 생성된 기존 평가는 provider=unconfigured로 고정되어 있다. 설정 후에는 새 과제 세션에서 요청한다. 기존 제출 내용과 실패 기록을 다른 설정으로 덮어쓰지 않는다.

기본 모델은 `gemini-3.5-flash-lite`다. 실제 가상 평가의 구조·근거 검증과 사용자 화면의 평가 응답·새로고침 복원을 확인했다. 모델 간 의미적 품질 비교는 별도 검증이다.

## 모델·입력·한도

- Spring AI 1.1.8 Google GenAI starter, 해석된 Google SDK 1.37.0을 사용한다. [Spring AI 1.1 문서](https://docs.spring.io/spring-ai/reference/1.1/api/chat/google-genai-chat.html)를 기준으로 연결했다.
- 기본 모델은 `gemini-3.5-flash-lite`다. [공식 모델 문서](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)의 구조화 출력 지원을 확인하고 실제 호출했다. temperature=1.0, thinkingLevel=MEDIUM, maxOutputTokens=8192를 사용한다. 다른 모델은 옵션 호환성과 계정 한도를 확인한 뒤 사용한다.
- 입력은 해당 평가 snapshot에 고정된 제출 보고서·제출 검토·공개 자료·공개 루브릭이다. 다른 사용자·비공개 정답·미공개 조건 자료·인증/lease/키는 보내지 않는다. 평가 버튼에서 외부 전송 사실을 안내한다.
- 입력 100,000 UTF-8 bytes, 출력 8,192 tokens, HTTP 요청 60초를 상한으로 둔다. 문자 수를 토큰 수나 요금으로 환산해 보장하지 않는다.
- 일일 한도는 UTC 날짜별 계정 10회/서버 전체 50회이며 환경변수로 조절한다. DB에 호출 예약을 저장하므로 재시작으로 초기화되지 않는다. 실패·자동 재시도도 횟수를 사용한다. 명시적 test:ai는 DB worker 밖의 1회 검사이므로 이 DB 한도에 포함되지 않는다.

## 실패 처리

키 누락/비활성화는 평가기 미설정 실패다. 잘못된 인증, 제공자 호출 제한, 입력 크기 초과, 불완전 응답, 출력 검증 실패를 구분하고 원문 오류·키를 응답에 표시하지 않는다.
네트워크 timeout과 결과 검증 실패는 5초·20초 + jitter로 자동 최대 3회, 이후 명시 재시도 1회로 총 4회다. SDK/Spring AI의 내부 재시도는 각각 1회로 제한한다.
Google SDK 1.37.0 오류 객체가 Retry-After 헤더를 보존하지 않으므로 **429와 제공자 5xx는 자동 재호출하지 않는다**. 제공자 상태 확인 후 5xx는 사용자가 제한된 재시도를 할 수 있다. 429는 현재 재시도 버튼을 제공하지 않는다. 응답 헤더를 보존하는 전송 계층을 도입하기 전까지 원래 명세의 모든 429/5xx 자동 재시도가 구현됐다고 표시하지 않는다.

## 결과 해석과 남은 검수

실제 모델 응답이어도 근거 검증을 통과해야 발행한다. 정답 키를 연결하지 않았으므로 문장별 정답·오답 확정은 REVIEW_REQUIRED로 남긴다. 채팅/되묻기 미구현 영역은 NOT_OBSERVED다. AI 피드백의 의미적 정확도, 8개 기준 사례의 품질 비교, 학습용 콘텐츠 발행 검수는 별도 작업이다.

## 전체 흐름 검사
`npm run db:up` 후 `npm run check`로 기본 검사를 통과시키고, AI 설정이 있는 로컬에서 `npm run test:flow:ai`를 명시적으로 실행한다. 별도 Playwright 설정이 로그인 후 과제 시작부터 실제 worker 결과·새로고침 복원까지 검사한다. 인증은 로컬 테스트 JWT이며 실제 Google 로그인 검사는 아니다. 가상 개발 과제만 사용하고 기존 사용자 세션을 재사용하지 않는다. 실제 AI 요청 1건과 워커의 제한 재시도가 발생할 수 있고 DB 호출 한도가 적용된다. 기본 CI에는 포함하지 않는다. 기존 dev 서버는 종료해야 하며 DB/볼륨을 삭제하지 않는다.
