package com.doezip.learning.adapter;
import com.doezip.evaluation.adapter.EvaluationSettings;
import com.fasterxml.jackson.databind.*;
import com.google.genai.Client;
import com.google.genai.types.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
@Component
public class FlowFeedbackAi {
 private final EvaluationSettings settings;private final ObjectMapper json;
 public FlowFeedbackAi(EvaluationSettings settings,ObjectMapper json){this.settings=settings;this.json=json;}
 public JsonNode evaluate(String model,JsonNode input){
  String version=input.path("promptVersion").asText();if(!version.equals("learning-feedback-v1")&&!version.equals("learning-feedback-v2"))throw new IllegalArgumentException("unsupported prompt");
  try(var in=new ClassPathResource("learning/"+(version.equals("learning-feedback-v2")?"feedback-v2.txt":"feedback-v1.txt")).getInputStream();var client=Client.builder().apiKey(settings.apiKey()).vertexAI(false).httpOptions(HttpOptions.builder().timeout(60000).retryOptions(HttpRetryOptions.builder().attempts(1).build()).build()).build()){
   String prompt=new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
   var config=GenerateContentConfig.builder().maxOutputTokens(8192).candidateCount(1).responseMimeType("application/json").thinkingConfig(ThinkingConfig.builder().includeThoughts(false)).systemInstruction(Content.fromParts(Part.fromText(prompt))).build();
   var response=client.models.generateContent(model,input.toString(),config);
   if(response.candidates().isEmpty()||response.candidates().get().isEmpty()||!response.candidates().get().getFirst().finishReason().map(r->r.toString().equals("STOP")).orElse(false))throw new IllegalArgumentException("incomplete response");
   return json.readTree(response.text());
  }catch(Exception e){throw new IllegalStateException("FLOW_FEEDBACK_FAILED");}
 }
}
