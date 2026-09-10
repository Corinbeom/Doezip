# 가상 개발 데이터

모든 데이터는 기획의 예시를 구체화해 만든 **가상 fixture**다. 모델을 호출하거나 교육 효과를 검증한 데이터가 아니다.
원본 기획과 ERD의 시간 예시를 12:00~12:10으로 정리한 새 seed이므로, 실제 학습용 발행 전에 사실·정답 일관성을 검수하고 결과를 기록해야 한다. 1인 개발 규칙은 ../CONTRIBUTING.md를 따른다.

## 폴더 경계

- `public/`: 공개 API 형태를 맞추는 개발용 JSON. **실서비스에서 폴더를 정적으로 공개하라는 뜻은 아니다.**
- `private/task-pack.json`: 발행 콘텐츠의 DB seed 원재료. 정답 키와 단계 미공개 자료를 포함한다. 서버 전용.
- `contracts/fixture-schema-map.json`: 각 공개 fixture와 OpenAPI schema 대응.

public 안에서도 stage를 지킨다. `condition-revealed.json`은 공개 액션 이후에만, 리포트와 검토 예시는 제출·평가 이후의 mock에만 쓴다.
실사용자에게 개발 fixture 파일을 내려주는 라우트나 public asset은 만들지 않는다. production build에서 mock 모드를 제거한다.
리포트 `sample: true`는 반드시 “개발용 예시” 배너로 렌더링한다. UI 예시의 관찰과 상태는 평가기 정답 데이터로 재사용하지 않는다.

`task-pack.json`은 SQL이 아니다. Flyway INSERT 또는 검증된 seed importer로 변환해야 한다.
해시는 UTF-8 / LF 정규화 기준이며 ID는 안정적인 개발용 UUID다. 발행 후 같은 버전의 본문을 수정하지 않는다.

비공개 seed의 task는 DRAFT로 시작한다. 공개 API 예시는 화면 개발을 위해 PUBLISHED 상태를 가정했다. 콘텐츠 검수 기록과 발행 검증 후에만 실제 DB 상태를 PUBLISHED로 전환한다.

F02a의 `apps/api/src/main/resources/db/local`은 별도 UUID를 가진 **로컬 조회용 예시**다. 원본 task-pack을 발행하지 않으며, 공개 설명과 루브릭만 검증한다. 자료·정답·평가기 구현 및 학습용 발행 검수 완료를 뜻하지 않는다.
