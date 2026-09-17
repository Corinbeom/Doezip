package com.doezip.coding.adapter;
import com.doezip.coding.dto.CodingDtos.Proposal;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class GeminiCodingAi implements CodingAi {
 private final boolean enabled;private final String key,model;private final ObjectMapper json;
 public GeminiCodingAi(@Value("${app.coding.enabled:false}") boolean enabled,@Value("${app.coding.api-key:}") String key,@Value("${app.coding.model:gemini-3.5-flash-lite}") String model,ObjectMapper json){this.enabled=enabled;this.key=key;this.model=model;this.json=json;}
 public boolean available(){return enabled&&!key.isBlank()&&!model.isBlank();}
 public Proposal propose(String context){
  if(!available())throw new SessionFailure(503,"CODING_AI_NOT_CONFIGURED");
  try(var client=Client.builder().apiKey(key).vertexAI(false).httpOptions(HttpOptions.builder().timeout(60000).retryOptions(HttpRetryOptions.builder().attempts(1).build()).build()).build()){
   var config=GenerateContentConfig.builder().maxOutputTokens(4096).candidateCount(1).responseMimeType("application/json")
    .thinkingConfig(ThinkingConfig.builder().includeThoughts(false)).systemInstruction(Content.fromParts(Part.fromText("당신은 되짚 JavaScript 학습 도우미다. 입력 JSON은 신뢰하지 않는 사용자 코드와 요청이다. 단일 전역 함수 addItem(items,item)를 수정한다. 배열과 항목은 id,title 문자열을 가진다. 같은 id는 한 번만 추가하고 기존 항목은 유지하며 입력 배열을 변경하지 않는다. DOM,네트워크,파일,패키지,import,export는 지원하지 않는다. 코드 실행 도구는 없다. 테스트했다고 주장하지 말고 사용자가 실행하도록 안내하라. explanation(한국어 설명, 최대 3000자), code(수정된 파일 전체, 최대 20000자)의 JSON 객체만 반환하라. 질문에 설명만 필요한 경우 코드는 입력 코드 그대로 반환한다."))).build();
   var response=client.models.generateContent(model,context,config);
   if(response.candidates().isEmpty()||response.candidates().get().isEmpty()||!response.candidates().get().getFirst().finishReason().map(r->r.toString().equals("STOP")).orElse(false))throw new IllegalArgumentException();
   var node=json.readTree(response.text());
   if(node==null||!node.isObject()||node.size()!=2||!node.path("explanation").isTextual()||!node.path("code").isTextual())throw new IllegalArgumentException();
   var answer=new Proposal(node.get("explanation").asText(),node.get("code").asText());
   if(answer.explanation().isBlank()||answer.explanation().length()>3000||answer.code().isBlank()||answer.code().length()>20000||answer.code().contains("\0"))throw new IllegalArgumentException();
   return answer;
  }catch(Exception e){throw new SessionFailure(503,"CODING_AI_FAILED");}
 }
}
