# 설정 템플릿 사용 주의

F00 실제 실행 설정은 루트 `compose.local.yml`, `.env.example`, `apps/api/src/main/resources/application.yml`이다.
아래 템플릿은 원본 참고 자료로 보존한다. 실행은 루트 README의 `npm run db:up`, `npm run dev`를 따른다.

`compose.local.yml`은 로컬 DB만 만든다. Next.js·Spring 앱과 전체 Flyway migration은 포함하지 않는다.
로컬 DB 비밀번호는 개발용 공개 예시이며 운영에서 사용하면 안 된다.
`postgres:17`은 major 태그 예시다. 실제 도입 시 minor/digest를 기록해 개발·CI를 일치시킨다.
`docker compose down -v`는 로컬 데이터를 지우므로 여기서는 자동 실행하지 않는다.

`.env.example`의 서버 비밀은 웹 환경 파일의 NEXT_PUBLIC 값으로 옮기지 않는다.
Spring Boot는 .env 파일명을 자동 인식한다고 가정하지 않는다. 환경변수 전달은 실제 실행 구성에서 정한다.

`application.example.yml`의 표준 Spring 설정과 사용자 정의 `app.*`는 다르다.
**app.*는 설정 클래스와 사용 코드를 직접 작성해야 동작한다.**
JWT issuer/JWK URI 설정 외에 ES256 허용 decoder, audience validator, stateless Bearer security filter,
CORS allowlist, method/ownership checks를 구현해야 한다. 이 YAML만으로 인증·인가 구현이 완료되지 않는다.

평가용 모델/JSON Schema 옵션은 AiGateway의 평가 호출에서 지정한다.
일반 채팅 전체를 application/json 응답으로 설정하지 않는다.
worker 설정도 실제 scheduler/lease/timeout 코드를 작성하기 전에는 동작하지 않는다.
