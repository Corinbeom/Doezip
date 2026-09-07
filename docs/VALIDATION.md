> 이 문서는 전달받은 문서 패키지의 과거 기록이다. 현재 checkout에는 tools/validate_pack.py가 없으므로 이번 실행 결과로 재사용하지 않는다. 앱 검증은 [F00_VALIDATION.md](F00_VALIDATION.md)를 따른다.

# 문서 패키지 검증 기록

**실행일:** 2026-09-06

## 실제 수행한 검사

`python tools/validate_pack.py`를 실행했다. 확인 범위는 다음과 같다.

- OpenAPI YAML 파싱, 로컬 schema 참조와 경로 파라미터, operation ID 중복 검사.
- 패키지에서 사용하는 OpenAPI schema를 검증용 JSON Schema로 변환하고 공개 fixture 20개를 검사.
- 24개 경로, 27개 operation, 48개 schema의 내부 연결 확인.
- 가상 seed의 5개 초기 자료·1개 조건 자료, 자료 해시·인용문·같은 과제 관계 확인.
- 검산 문장 5개 중 오류 키 2개, 문장당 오류 하나, 모든 오류 근거 키의 유효성 확인.
- 초기 workspace에서 조건 자료 제외, 새 검산 화면에 응답이 미리 채워져 있지 않음 확인.
- 공개 fixture에 raw 정답/변형 코드/내부 평가 설정이 없음을 필드 기준으로 검사.
- INITIAL Defense는 NOT_OBSERVED, 같은 검산 결과는 FINAL에서 새 향상으로 표시하지 않음 확인.
- 원본 기획안과 ERD 복사본의 checksum, ERD 22개 테이블 보존 확인.
- Markdown 코드 블록과 로컬 파일 링크 확인.

검사 스크립트 출력의 개수는 반복되는 필드·참조 확인을 포함한다. 서비스 테스트 케이스 수나 학습 평가 정확도가 아니다.

## 수행하지 않은 검사

표준 OpenAPI 전용 validator는 이 실행 환경에 없었고, 네트워크 제약으로 설치하지 못했다.
따라서 **OpenAPI 전체 메타스키마 검증 완료를 주장하지 않는다.** 프로젝트 CI에서 추가로 실행해야 한다.

Java/Node 애플리케이션은 생성하지 않았으므로 빌드, 실제 DB migration, JWT 로그인,
실제 모델 호출, 브라우저 E2E, 배포 부하, 사용자 검증은 수행하지 않았다.
이 자료는 개발 계약·설계 패키지이며 실행 검증이 끝난 제품 소스가 아니다.

가상 seed와 리포트는 모델이 측정한 결과가 아니다. seed는 DRAFT로 시작하고 인간 검수가 필요하다.
공개 응답 예시의 PUBLISHED 상태는 화면 개발용 가정이다.
