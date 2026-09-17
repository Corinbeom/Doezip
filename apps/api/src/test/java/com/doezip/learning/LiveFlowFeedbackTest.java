package com.doezip.learning;
import com.doezip.learning.adapter.*;
import com.doezip.learning.service.FlowTasks;
import com.doezip.evaluation.adapter.EvaluationSettings;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
@Tag("live-flow")
class LiveFlowFeedbackTest {
 @Test void fourBoundedPublicSyntheticCases()throws Exception {
  String key=System.getenv("GEMINI_API_KEY");assertThat(key).isNotBlank();String model=System.getenv().getOrDefault("AI_EVALUATION_MODEL","gemini-3.5-flash-lite");var settings=new EvaluationSettings(true,key,model,10,50);var json=new ObjectMapper();var ai=new FlowFeedbackAi(settings,json);
  Path output=Path.of("build/learning-quality",java.time.Instant.now().toString().replace(":","-"));Files.createDirectories(output);var assertions=new org.assertj.core.api.SoftAssertions();
  for(String name:List.of("report-grounded","report-unobserved","coding-verified","coding-unfinished")){
   boolean coding=name.startsWith("coding"),limited=name.endsWith("unobserved")||name.endsWith("unfinished");var input=json.createObjectNode();input.put("promptVersion","learning-feedback-v1");input.set("task",json.valueToTree(FlowTasks.get(coding?FlowTasks.CODING_CATALOG_ID:FlowTasks.REPORT_CATALOG_ID,FlowTasks.CURRENT_VERSION,false)));input.put("mode","TRAINING");input.putArray("hints");var records=input.putArray("records");
   String artifact=coding?(limited?"function addItem(items,item){items.push(item);return items;}":"function addItem(items,item){return items.some(x=>x.id===item.id)?items.slice():[...items,item];}"):(limited?"테스트용":"10:00 결제 API 지연이 관찰됐고 10:05 원인은 미확인이다. 연결 대기와 외부 응답 시간을 추가 확인해야 한다.");
   input.put("artifact",artifact);records.addObject().put("id","artifact").put("label","제출 결과물").put("text",artifact);
   if(!coding)records.addObject().put("id","material-1").put("label","공개 가상 자료").put("text","10:00 결제 API 지연 관찰\n10:05 원인 미확인. 연결 대기와 외부 응답 시간은 아직 수집하지 못함");
   records.addObject().put("id","explanation").put("label","사용자 자기 보고").put("text",limited?"아직 확인하지 못했습니다.":"원인 또는 수정안을 바로 확정하지 않고 자료와 테스트로 확인했습니다.");
   records.addObject().put("id","verification").put("label","검증 설명 · 자기 보고").put("text",limited?"추가 확인이 필요합니다.":coding?"중복 id와 입력 보존 테스트를 실행했습니다.":"로그 1~2행을 대조하고 원인 미확인 상태를 보고서에 반영했습니다.");
   if(coding)records.addObject().put("id","public-run").put("label","브라우저 보고 공개 테스트 · 독립 채점 아님").put("text",limited?"중복 id 실패, 입력 보존 실패":"중복 id 통과, 입력 보존 통과");
   if(!limited){records.addObject().put("id","request-1").put("label","사용자 요청").put("text",coding?"중복을 막고 입력 배열을 바꾸지 않게 수정하고 테스트 방법을 제안해 줘.":"자료에서 확인된 사실과 미확인 원인을 구분해 줘.");records.addObject().put("id","decision").put("label","직접 설명").put("text",coding?"입력 배열 보존을 위해 복사본을 반환했습니다. 공개 테스트 이외 입력은 검증하지 못했습니다.":"원인을 확인할 지표가 없어서 확정하지 않았습니다.");}
   else records.addObject().put("id","decision").put("label","직접 설명").put("text","아직 설명하기 어렵습니다.");
   records.addObject().put("id","change").put("label","조건 변경 답변").put("text",limited?"다시 확인해야 하지만 방법을 설명하기 어렵습니다.":coding?"title 갱신 요구가 생기면 같은 id의 갱신과 입력 보존 테스트를 추가해야 합니다.":"다른 API의 지연 시각과 공통 의존성을 확인해야 합니다.");
   var raw=ai.evaluate(model,input);var saved=json.createObjectNode().put("case",name).put("model",model);saved.set("input",input);saved.set("candidate",raw);json.writerWithDefaultPrettyPrinter().writeValue(output.resolve(name+".json").toFile(),saved);
   assertions.assertThatCode(()->new FlowFeedbackValidator().validate(raw,input)).as(name+" structure and evidence").doesNotThrowAnyException();
   assertions.assertThat(raw.toString()).as(name+" user terminology").doesNotContain("NOT_OBSERVED","PROMPT","DEFENSE");
  }assertions.assertAll();
 }
}
