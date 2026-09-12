package com.doezip.evaluation.service;
import com.fasterxml.jackson.databind.JsonNode;
import com.doezip.session.service.SessionService;
import java.util.*;
import org.springframework.stereotype.Component;
@Component
public class ResultValidator {
 public JsonNode validate(JsonNode result,JsonNode snapshot){
  fields(result,"summary strengths improvements areas faultSummary nextPracticeText");text(result.get("summary"),false);texts(result.get("strengths"));texts(result.get("improvements"));text(result.get("nextPracticeText"),true);
  Map<String,JsonNode> rubrics=new HashMap<>();snapshot.path("task").path("rubrics").forEach(r->rubrics.put(r.path("code").asText(),r));
  Map<String,JsonNode> reviews=new HashMap<>();snapshot.path("challenge").path("reviews").forEach(r->reviews.put(r.path("id").asText(),r));
  Map<String,JsonNode> sources=new HashMap<>();snapshot.path("materials").forEach(m->sources.put(m.path("id").asText(),m));
  Set<String> areas=new HashSet<>(),codes=new HashSet<>(),observationIds=new HashSet<>();array(result.get("areas"),4);
  if(result.get("areas").size()!=4||rubrics.isEmpty())bad();
  for(var area:result.get("areas")){
   fields(area,"area dimensions");String name=choice(area.get("area"),"PROMPT EVIDENCE DOCUMENT DEFENSE");if(!areas.add(name))bad();array(area.get("dimensions"),30);if(area.get("dimensions").isEmpty())bad();
   for(var dimension:area.get("dimensions")){
    fields(dimension,"code title state rationale gap nextAction confidenceLevel evidence");text(dimension.get("code"),false);text(dimension.get("title"),false);String code=dimension.path("code").asText();var rubric=rubrics.get(code);
    if(rubric==null||!codes.add(code)||!rubric.path("area").asText().equals(name)||!rubric.path("title").equals(dimension.get("title")))bad();
    String state=choice(dimension.get("state"),"SUFFICIENT PARTIAL NEEDS_REVIEW NOT_OBSERVED");text(dimension.get("rationale"),false);text(dimension.get("gap"),true);text(dimension.get("nextAction"),true);if(!dimension.get("confidenceLevel").isNull())choice(dimension.get("confidenceLevel"),"LOW MEDIUM HIGH");
    array(dimension.get("evidence"),30);
    if((name.equals("DEFENSE")||name.equals("PROMPT"))&&!state.equals("NOT_OBSERVED"))bad();
    if(state.equals("NOT_OBSERVED")&&!dimension.get("evidence").isEmpty())bad();
    if(!state.equals("NOT_OBSERVED")&&dimension.get("evidence").isEmpty())bad();
    for(var observation:dimension.get("evidence")){
     fields(observation,"id kind polarity method subjectType subjectId excerpt explanation source");String oid=uuid(observation.get("id"));if(!observationIds.add(oid))bad();
     String kind=choice(observation.get("kind"),"SOURCE_CHECK FAULT_REPAIR COUNTEREVIDENCE EXPLANATION SELF_REPORT");
     if(Set.of("SOURCE_CHECK","COUNTEREVIDENCE").contains(kind)&&observation.get("source").isNull())bad();choice(observation.get("polarity"),"SUPPORT CONTRADICT");choice(observation.get("method"),"RULE LLM");text(observation.get("explanation"),false);text(observation.get("excerpt"),true);
     String subject=choice(observation.get("subjectType"),"DOCUMENT_VERSION FAULT_ATTEMPT"),sid=uuid(observation.get("subjectId"));String content;
     if(subject.equals("DOCUMENT_VERSION")){if(!sid.equals(snapshot.path("document").path("id").asText()))bad();content=snapshot.path("document").path("markdown").asText();}
     else {var review=reviews.get(sid);if(review==null)throw new InvalidEvaluationResult();content=review.path("reasonText").asText()+"\n"+review.path("replacementText").asText("");}
     if(kind.equals("FAULT_REPAIR")&&(!subject.equals("FAULT_ATTEMPT")||reviews.get(sid).path("replacementText").asText("").isBlank()))bad();
     if(!observation.get("excerpt").isNull()&&!content.contains(observation.get("excerpt").asText()))bad();
     if(!observation.get("source").isNull()){
      var source=observation.get("source");fields(source,"materialId lineStart lineEnd quotedText");text(source.get("quotedText"),false);var material=sources.get(uuid(source.get("materialId")));if(material==null)throw new InvalidEvaluationResult();
      int first=positive(source.get("lineStart")),last=positive(source.get("lineEnd"));var lines=material.path("lines");if(last<first||last>lines.size())bad();
      List<String> quote=new ArrayList<>();for(int i=first-1;i<last;i++)quote.add(lines.get(i).path("text").asText());if(!source.path("quotedText").asText().equals(String.join("\n",quote)))bad();
      if(!SessionService.hash(material.path("contentMarkdown").asText()).equals(material.path("contentHash").asText()))bad();
     }
    }
   }
  }
  if(!codes.equals(rubrics.keySet()))bad();
  var faults=result.get("faultSummary");fields(faults,"statements note");text(faults.get("note"),false);array(faults.get("statements"),20);
  Set<String> expected=new HashSet<>(),found=new HashSet<>();snapshot.path("challenge").path("statements").forEach(s->expected.add(s.path("id").asText()));
  for(var fault:faults.get("statements")){
   fields(fault,"statementId reviewId detectionResult evidenceResult repairResult recheckResult feedback");String sid=uuid(fault.get("statementId"));if(!expected.contains(sid)||!found.add(sid))bad();
   var review=reviews.values().stream().filter(r->r.path("statementId").asText().equals(sid)).findFirst();
   if(review.isEmpty()){
    if(!fault.get("reviewId").isNull()||!fault.path("detectionResult").asText().equals("UNREVIEWED")||!fault.path("evidenceResult").asText().equals("NOT_OBSERVED")||!fault.path("repairResult").asText().equals("NOT_OBSERVED")||!fault.path("recheckResult").asText().equals("NOT_OBSERVED"))bad();
   }else{
    if(!uuid(fault.get("reviewId")).equals(review.get().path("id").asText()))bad();
    // No vetted answer-key policy is connected yet; do not certify correctness.
    choice(fault.get("detectionResult"),"REVIEW_REQUIRED");choice(fault.get("evidenceResult"),"REVIEW_REQUIRED INSUFFICIENT NOT_OBSERVED");choice(fault.get("repairResult"),"REVIEW_REQUIRED NOT_APPLICABLE NOT_OBSERVED");choice(fault.get("recheckResult"),"NOT_OBSERVED REVIEW_REQUIRED");
   }
   text(fault.get("feedback"),false);
  }
  if(!found.equals(expected))bad();return result.deepCopy();
 }
 private static void fields(JsonNode n,String names){if(n==null||!n.isObject())bad();Set<String> keys=new HashSet<>(List.of(names.split(" ")));if(n.size()!=keys.size())bad();for(String key:keys)if(!n.has(key))bad();}
 private static void array(JsonNode n,int max){if(n==null||!n.isArray()||n.size()>max)bad();}
 private static void texts(JsonNode n){array(n,20);n.forEach(v->text(v,false));}
 private static void text(JsonNode n,boolean nullable){if(n==null)bad();if(nullable&&n.isNull())return;if(!n.isTextual()||n.asText().codePointCount(0,n.asText().length())>8000||n.asText().codePoints().anyMatch(c->c==0||(c>=0xD800&&c<=0xDFFF))||n.asText().codePoints().allMatch(c->Character.isWhitespace(c)||Character.isSpaceChar(c)))bad();}
 private static String choice(JsonNode n,String values){text(n,false);if(!Set.of(values.split(" ")).contains(n.asText()))bad();return n.asText();}
 private static String uuid(JsonNode n){text(n,false);try{String s=UUID.fromString(n.asText()).toString();if(!s.equalsIgnoreCase(n.asText()))bad();return s;}catch(Exception e){throw new InvalidEvaluationResult();}}
 private static int positive(JsonNode n){if(n==null||!n.isIntegralNumber()||!n.canConvertToInt()||n.intValue()<1)bad();return n.intValue();}
 private static void bad(){throw new InvalidEvaluationResult();}
}
