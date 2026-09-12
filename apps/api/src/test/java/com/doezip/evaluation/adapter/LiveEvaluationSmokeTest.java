package com.doezip.evaluation.adapter;

import static org.assertj.core.api.Assertions.*;
import com.doezip.evaluation.service.ResultValidator;
import com.doezip.session.service.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Explicit opt-in, one real provider call using invented public content only. */
@Tag("live-ai")
class LiveEvaluationSmokeTest {
    @Test void realGeminiReturnsAValidSyntheticEvaluation()throws Exception{
        String key=System.getenv("GEMINI_API_KEY");assertThat(key!=null&&!key.isBlank()).as("GEMINI_API_KEY must be configured for explicit AI smoke").isTrue();
        var mapper=new ObjectMapper();var settings=new EvaluationSettings(true,key,System.getenv().getOrDefault("AI_EVALUATION_MODEL","gemini-3.5-flash-lite"),10,50);
        var snapshot=mapper.createObjectNode();snapshot.put("schemaVersion",1);snapshot.put("evaluatorVersion",EvaluationSettings.VERSION);snapshot.set("llmConfig",mapper.valueToTree(settings.frozenConfig()));
        String doc=UUID.randomUUID().toString(),material=UUID.randomUUID().toString();
        snapshot.putObject("document").put("id",doc).put("markdown","가상 로그에는 10:00 응답 지연 알림이 있습니다. 원인은 아직 확인되지 않았습니다. 추가 로그를 대조해야 합니다.");
        var task=snapshot.putObject("task");task.put("title","가상 공개 로그 검토");task.put("descriptionMarkdown","실제 개인/회사 자료가 아닌 호출 확인용 가상 과제입니다.");var rubrics=task.putArray("rubrics");
        for(String area:new String[]{"PROMPT","EVIDENCE","DOCUMENT","DEFENSE"}){var d=rubrics.addObject();d.put("code",area.toLowerCase()+".smoke");d.put("area",area);d.put("title",area+" 관찰");d.put("description","제공된 입력에서 판단과 근거를 확인합니다.");}
        String content="10:00 응답 지연 알림 발생\n10:05 원인은 아직 확인되지 않음";var source=snapshot.putArray("materials").addObject();source.put("id",material);source.put("title","가상 공개 로그");source.put("contentMarkdown",content);source.put("contentHash",SessionService.hash(content));var lines=source.putArray("lines");lines.addObject().put("number",1).put("text","10:00 응답 지연 알림 발생");lines.addObject().put("number",2).put("text","10:05 원인은 아직 확인되지 않음");
        var challenge=snapshot.putObject("challenge");challenge.putArray("reviews");challenge.putArray("statements").addObject().put("id",UUID.randomUUID().toString()).put("text","10:05에 원인이 확정되었다.");
        var candidate=new GeminiEvaluationAdapter(settings,mapper).evaluate(snapshot);
        assertThat(new ResultValidator().validate(candidate,snapshot).path("areas").size()).isEqualTo(4);
    }
}
