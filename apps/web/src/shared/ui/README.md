# 공통 UI

`LearningShell`은 승인된 학습 플랫폼 v0.1의 로고·탐색 헤더·푸터·본문 바로가기를 제공한다.
`Arrow`는 링크와 버튼에서 사용하는 장식 아이콘이다. CSS Module의 토큰은 shell 내부에만 적용된다.
현재 `/tasks`와 `/tasks/[taskId]`에서 사용하며 운영 health 화면은 별도 최소 스타일을 유지한다.

원본 기준: `feature/design-prototype`의 고정 커밋 `966d6e6`, `docs/design/prototypes/learning-platform/`.
현재 제품 브랜치에는 원본 전체를 복사하지 않는다. 승인 기록과 고정 원본 링크는 `docs/design/README.md`를 따른다.
`public/design/` SVG는 시안의 장식 일러스트를 옮긴 것이다. 과제 그림의 예시 수치·문구를 제거했다.
시안의 데이터, mock AI, localStorage 런타임은 이식하지 않는다.

추가 공통 컴포넌트는 실제 기능에서 반복되는 필요에 따라 추출한다. shadcn/ui는 필요할 때 도입한다.
