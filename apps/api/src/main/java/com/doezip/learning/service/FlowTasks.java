package com.doezip.learning.service;
import com.doezip.learning.dto.FlowDtos.Task;
import java.util.*;
public final class FlowTasks {
 private FlowTasks() {}
 public static final UUID REPORT_ID=UUID.fromString("71111111-1111-4111-8111-111111111111");
 public static Task get(String kind,boolean hints) {
  boolean code=kind.equals("CODING");
  return new Task(kind,code?"중복 없이 항목 추가하기":"결제 지연 상황을 동료에게 설명하기",
   code?"목록에 항목을 추가하면 같은 id가 중복되고 원래 배열도 변경됩니다. AI와 원인을 분석하고 addItem 함수를 수정하세요.":"당신은 서비스 운영 담당자입니다. 결제 지연 알림과 제한된 관측 자료를 받았습니다. 동료가 다음 조치를 결정할 수 있도록 현재 상황을 보고하세요. 원인을 확정할 자료가 충분한지도 판단해야 합니다.",
   code?List.of("유효한 id·title 문자열을 가진 항목을 처리합니다.","같은 id는 기존 항목과 순서를 유지하고 새 id만 뒤에 추가합니다.","입력 배열과 기존 항목을 변경하지 않습니다.","JavaScript 단일 함수만 지원하며 DOM·네트워크·패키지는 사용할 수 없습니다."):
    List.of("시간대별로 확인된 사실을 자료의 줄과 연결합니다.","가능한 원인과 확인되지 않은 사항을 구분합니다.","다음 확인 방법과 대응 방안, 판단의 한계를 설명합니다.","자료에 없는 수치나 확정 원인을 만들어 넣지 않습니다."),
   code?"코드, 현재 코드의 공개 테스트 기록, 변경 이유와 남은 한계":"보고서, 핵심 주장에 연결한 자료 인용, 검증 설명과 남은 한계",
   List.of("핵심 선택 하나를 왜 채택했고 어떻게 확인했나요? 설명하기 어렵다면 그 부분을 적어도 됩니다.",code?"같은 id의 새 title로 기존 항목을 갱신해야 한다면 어떤 코드와 테스트를 다시 확인하겠나요?":"추가 확인에서 결제 외 API에도 지연이 있었다면 어떤 가설과 대응을 다시 확인하겠나요?"),
   !hints?List.of():code?List.of("먼저 시작 코드를 실행하고 어떤 요구사항이 실패하는지 확인해 보세요.","AI에게 입력 보존과 중복 처리라는 제약을 함께 전달해 보세요.","수정안을 적용한 뒤 같은 테스트를 다시 실행하고 남은 한계를 적어 보세요."):List.of("자료에서 확인된 사실과 아직 모르는 것을 먼저 나눠 보세요.","AI가 제안한 원인에 직접적인 근거가 있는지 자료의 줄과 대조해 보세요.","보고서의 핵심 주장 하나에 자료를 연결하고, 추가로 확인할 방법을 적어 보세요."));
 }
}
