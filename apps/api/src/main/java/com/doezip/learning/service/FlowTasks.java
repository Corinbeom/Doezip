package com.doezip.learning.service;

import com.doezip.learning.dto.FlowDtos.Task;
import com.doezip.learning.dto.FlowDtos.Kind;
import com.doezip.task.service.TaskNotFoundException;
import java.util.List;
import java.util.UUID;

public final class FlowTasks {
 private FlowTasks() {}

 public static final String LEGACY_VERSION="learning-flow-v1";
 public static final String CURRENT_VERSION="learning-flow-v2";
 public static final String LEGACY_CODING_VERSION="duplicate-items-v1";
 public static final String CURRENT_CODING_VERSION="duplicate-items-v2";
 public static final String ACTIVATION_VERSION="activation-drop-v1";
 public static final String RETRY_VERSION="retry-policy-v1";
 public static final String REPORT_CATALOG_ID="payment-delay-report";
 public static final String CODING_CATALOG_ID="item-identity-coding";
 public static final String ACTIVATION_CATALOG_ID="activation-drop-report";
 public static final String RETRY_CATALOG_ID="retry-policy-coding";
 public static final UUID REPORT_ID=UUID.fromString("71111111-1111-4111-8111-111111111111");
 public static final UUID REPORT_V2_ID=UUID.fromString("72222222-2222-4222-8222-222222222222");
 public static final UUID ACTIVATION_ID=UUID.fromString("73333333-3333-4333-8333-333333333333");

 public static List<Task> catalog(boolean hints){return List.of(get(REPORT_CATALOG_ID,CURRENT_VERSION,hints),get(ACTIVATION_CATALOG_ID,ACTIVATION_VERSION,hints),get(CODING_CATALOG_ID,CURRENT_VERSION,hints),get(RETRY_CATALOG_ID,RETRY_VERSION,hints));}

 public static Task get(String catalogId,String version,boolean hints){
  return switch(catalogId){
   case REPORT_CATALOG_ID -> {if(!version.equals(LEGACY_VERSION)&&!version.equals(CURRENT_VERSION))throw new TaskNotFoundException();yield report(version,hints);}
   case CODING_CATALOG_ID -> {if(!version.equals(LEGACY_VERSION)&&!version.equals(CURRENT_VERSION))throw new TaskNotFoundException();yield coding(version,hints);}
   case ACTIVATION_CATALOG_ID -> {if(!version.equals(ACTIVATION_VERSION))throw new TaskNotFoundException();yield activation(hints);}
   case RETRY_CATALOG_ID -> {if(!version.equals(RETRY_VERSION))throw new TaskNotFoundException();yield retry(hints);}
   default -> throw new TaskNotFoundException();
  };
 }

 public static Kind kind(String catalogId,String version){return Kind.valueOf(get(catalogId,version,false).kind());}
 public static UUID reportTaskId(String catalogId,String version){if(kind(catalogId,version)!=Kind.REPORT)throw new TaskNotFoundException();return catalogId.equals(ACTIVATION_CATALOG_ID)?ACTIVATION_ID:version.equals(LEGACY_VERSION)?REPORT_ID:REPORT_V2_ID;}
 public static String codingTaskVersion(String catalogId,String version){if(kind(catalogId,version)!=Kind.CODING)throw new TaskNotFoundException();return catalogId.equals(RETRY_CATALOG_ID)?RETRY_VERSION:version.equals(LEGACY_VERSION)?LEGACY_CODING_VERSION:CURRENT_CODING_VERSION;}

 private static Task report(String version,boolean hints){
  if(version.equals(LEGACY_VERSION))return new Task(REPORT_CATALOG_ID,version,"REPORT","입문",25,List.of("자료 분석","보고서","근거 검증"),"결제 지연 상황을 동료에게 설명하기",
   "당신은 서비스 운영 담당자입니다. 결제 지연 알림과 제한된 관측 자료를 받았습니다. 동료가 다음 조치를 결정할 수 있도록 현재 상황을 보고하세요. 원인을 확정할 자료가 충분한지도 판단해야 합니다.",
   List.of("시간대별로 확인된 사실을 자료의 줄과 연결합니다.","가능한 원인과 확인되지 않은 사항을 구분합니다.","다음 확인 방법과 대응 방안, 판단의 한계를 설명합니다.","자료에 없는 수치나 확정 원인을 만들어 넣지 않습니다."),
   "보고서, 핵심 주장에 연결한 자료 인용, 검증 설명과 남은 한계",
   List.of("핵심 선택 하나를 왜 채택했고 어떻게 확인했나요? 설명하기 어렵다면 그 부분을 적어도 됩니다.","추가 확인에서 결제 외 API에도 지연이 있었다면 어떤 가설과 대응을 다시 확인하겠나요?"),
   hints?List.of("자료에서 확인된 사실과 아직 모르는 것을 먼저 나눠 보세요.","AI가 제안한 원인에 직접적인 근거가 있는지 자료의 줄과 대조해 보세요.","보고서의 핵심 주장 하나에 자료를 연결하고, 추가로 확인할 방법을 적어 보세요."):List.of());
  return new Task(REPORT_CATALOG_ID,version,"REPORT","중급",35,List.of("운영 분석","보고서","상충 근거","의사결정"),"결제 지연 대응안을 운영 리드에게 제안하기",
   "당신은 결제 서비스 운영 담당자입니다. 지연 지표, 배포 기록, 외부 사업자와 고객 문의 자료가 서로 다른 가능성을 가리킵니다. 운영 리드가 공지와 다음 조사를 결정할 수 있도록 확인된 사실, 가설, 미확인 사항을 구분해 보고하세요. 특정 원인을 단정해 달라는 요청도 근거에 맞게 다뤄야 합니다.",
   List.of("서로 다른 자료에서 일치하거나 충돌하는 내용을 구분합니다.","원인 가설마다 직접 근거와 반대 근거 또는 빈틈을 함께 적습니다.","지금 실행할 대응과 추가 확인 순서를 제안합니다.","자료에 없는 원인·수치·확정 표현을 만들지 않습니다."),
   "운영 리드용 보고서, 핵심 주장에 연결한 자료 인용, 검증 설명과 남은 한계",
   List.of("가장 중요한 결론을 어떤 근거로 채택했고, 반대 자료는 어떻게 해석했나요?","외부 사업자가 뒤늦게 일부 지역 장애를 인정한다면 공지와 조사 순서를 어떻게 바꾸겠나요?"),
   hints?List.of("세 자료에서 직접 확인된 사실, 이해관계자의 요청, 아직 모르는 내용을 먼저 분리해 보세요.","배포와 지연의 시간적 연관성이 원인 증명인지, 다른 자료가 무엇을 반박하는지 확인해 보세요.","공지에 쓸 핵심 문장 하나를 고르고 근거와 반대 근거를 연결한 뒤 다음 확인 행동을 적어 보세요."):List.of());
 }

 private static Task coding(String version,boolean hints){
  if(version.equals(LEGACY_VERSION))return new Task(CODING_CATALOG_ID,version,"CODING","입문",20,List.of("JavaScript","버그 수정","테스트"),"중복 없이 항목 추가하기",
   "목록에 항목을 추가하면 같은 id가 중복되고 원래 배열도 변경됩니다. AI와 원인을 분석하고 addItem 함수를 수정하세요.",
   List.of("유효한 id·title 문자열을 가진 항목을 처리합니다.","같은 id는 기존 항목과 순서를 유지하고 새 id만 뒤에 추가합니다.","입력 배열과 기존 항목을 변경하지 않습니다.","JavaScript 단일 함수만 지원하며 DOM·네트워크·패키지는 사용할 수 없습니다."),
   "코드, 현재 코드의 공개 테스트 기록, 변경 이유와 남은 한계",
   List.of("핵심 선택 하나를 왜 채택했고 어떻게 확인했나요? 설명하기 어렵다면 그 부분을 적어도 됩니다.","같은 id의 새 title로 기존 항목을 갱신해야 한다면 어떤 코드와 테스트를 다시 확인하겠나요?"),
   hints?List.of("먼저 시작 코드를 실행하고 어떤 요구사항이 실패하는지 확인해 보세요.","AI에게 입력 보존과 중복 처리라는 제약을 함께 전달해 보세요.","수정안을 적용한 뒤 같은 테스트를 다시 실행하고 남은 한계를 적어 보세요."):List.of());
  return new Task(CODING_CATALOG_ID,version,"CODING","중급",30,List.of("JavaScript","디버깅","경계 조건","AI 제안 검증"),"항목의 식별 기준을 바로잡기",
   "목록의 중복을 막는 코드가 제목을 식별 기준으로 사용합니다. 그 결과 같은 제목의 새 항목은 빠지고, 같은 id의 제목 변경은 중복으로 추가됩니다. AI 제안을 그대로 적용하지 말고 요구사항과 공개 테스트를 대조해 addItem 함수를 수정하세요.",
   List.of("항목의 동일 여부는 title이 아니라 id로 판단합니다.","같은 id가 있으면 기존 항목과 순서를 유지합니다.","서로 다른 id는 title이 같아도 뒤에 추가합니다.","입력 배열과 기존 항목을 변경하지 않습니다.","JavaScript 단일 함수만 지원하며 DOM·네트워크·패키지는 사용할 수 없습니다."),
   "코드, 경계 조건을 포함한 공개 테스트 기록, AI 제안 중 채택·거절한 이유와 남은 한계",
   List.of("제목 대신 id를 기준으로 삼은 이유와 확인한 경계 조건을 설명해 보세요.","요구사항이 같은 id의 제목을 갱신하도록 바뀐다면 어떤 구현과 테스트를 다시 검토하겠나요?"),
   hints?List.of("시작 코드를 실행해 같은 id·다른 제목과 다른 id·같은 제목이 각각 어떻게 처리되는지 비교해 보세요.","AI에게 항목의 식별 기준과 입력 불변 조건을 명시하고, 제안이 두 조건을 모두 지키는지 따로 확인해 보세요.","통과한 테스트만 적지 말고 채택하지 않은 접근과 숨은 입력에서 남을 수 있는 한계도 설명해 보세요."):List.of());
 }

 private static Task activation(boolean hints){return new Task(ACTIVATION_CATALOG_ID,ACTIVATION_VERSION,"REPORT","중급",40,List.of("퍼널 분석","CSV·JSON","VOC","제품 의사결정"),"가입 후 활성화 하락 원인을 제품 리드에게 보고하기",
  "신규 가입자의 첫 주 활성화율이 하락했습니다. 퍼널 CSV, 실험 배정 JSON, 고객 문의 표본과 빠른 결론을 원하는 요청을 함께 검토해 제품 리드가 오늘 할 조치와 다음 분석을 결정할 수 있는 보고서를 작성하세요.",
  List.of("전체 평균과 세그먼트 차이를 구분하고 비교 기준을 명시합니다.","실험군·대조군과 VOC가 뒷받침하는 범위 및 대표성 한계를 함께 적습니다.","경쟁하는 원인 가설을 최소 두 개 비교하고 성급한 단정을 피합니다.","오늘 실행할 조치, 다음에 확인할 데이터와 판단을 바꿀 조건을 제시합니다."),
  "제품 리드용 의사결정 보고서, 수치 주장에 연결한 원자료, AI 제안 중 채택·보류한 판단과 검증 기록",
  List.of("AI 제안 중 채택하거나 보류한 결론은 무엇이며, 어떤 수치와 한계 때문에 그렇게 판단했나요?","실험군과 대조군의 격차가 다음 주에도 없지만 모바일 웹만 회복되지 않는다면 원인 가설과 다음 조치를 어떻게 바꾸겠나요?"),
  hints?List.of("각 자료가 전체 사용자, 특정 세그먼트, 자발적 문의 중 무엇을 대표하는지 먼저 표시해 보세요.","평균 하락과 모바일 웹 하락, 실험 배정 결과를 한 원인으로 묶기 전에 비교군과 표본 범위를 대조해 보세요.","결론마다 근거 수치와 반대 관찰을 붙이고, 오늘 할 조치와 결론을 바꿀 조건을 분리해 보세요."):List.of());}

 private static Task retry(boolean hints){return new Task(RETRY_CATALOG_ID,RETRY_VERSION,"CODING","중급",35,List.of("JavaScript","재시도 정책","예외 처리","AI 제안 검증"),"결제 요청의 안전한 재시도 조건 구현하기",
  "결제 요청 실패를 재시도할지 판단하는 함수가 모든 5xx를 다시 보내고 멱등성 키를 확인하지 않습니다. AI가 제안하는 일반적인 재시도 로직을 그대로 적용하지 말고 상태 코드, 네트워크 오류, 시도 횟수와 멱등성 조건을 함께 검증하세요.",
  List.of("429·502·503·504 또는 NETWORK_TIMEOUT만 일시 오류로 재시도합니다.","attempt가 0~2일 때만 재시도하고 3 이상이면 중단합니다.","비어 있지 않은 idempotencyKey가 없으면 재시도하지 않습니다.","400·401·500·501과 알 수 없는 오류는 재시도하지 않습니다.","입력 객체를 변경하지 않는 JavaScript 단일 함수로 작성합니다."),
  "shouldRetry 코드, 공개 경계 테스트 기록, AI 제안 중 채택·거절한 규칙과 남은 한계",
  List.of("AI 제안에서 그대로 채택하지 않은 재시도 조건은 무엇이며 어떤 테스트로 확인했나요?","정책이 최대 5회와 지수 백오프를 요구하도록 바뀐다면 함수의 책임과 테스트를 어떻게 나누겠나요?"),
  hints?List.of("시작 코드를 실행해 503, 일반 5xx, 최대 시도와 멱등성 키가 각각 어떻게 처리되는지 나눠 보세요.","AI에게 재시도 가능한 상태를 열거하고, 모든 5xx 재시도 같은 넓은 조건을 반례로 검토해 달라고 요청해 보세요.","통과 결과와 함께 입력 불변 여부, 시간 기반 백오프처럼 이 함수가 아직 검증하지 않는 범위를 적어 보세요."):List.of());}
}
