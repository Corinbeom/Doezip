package com.doezip.evaluation.dto;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;
public final class EvaluationDtos {
 private EvaluationDtos(){}
 public record Request(String phase,UUID documentVersionId){
  @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Request from(JsonNode n){
   if(n==null||!n.isObject()||n.size()!=2||!n.hasNonNull("phase")||!n.get("phase").isTextual()||!java.util.Set.of("INITIAL","FINAL").contains(n.get("phase").textValue())||!n.hasNonNull("documentVersionId")||!n.get("documentVersionId").isTextual())throw SessionFailure.invalid();
   return new Request(n.get("phase").textValue(),uuid(n.get("documentVersionId").textValue()));
  }
 }
 public static UUID uuid(String value){try{UUID id=UUID.fromString(value);if(!id.toString().equalsIgnoreCase(value))throw SessionFailure.invalid();return id;}catch(Exception e){throw SessionFailure.invalid();}}
 public record Evaluation(UUID id,UUID sessionId,String phase,String status,UUID reportId,String errorCode,boolean retryable,int pollAfterMs,Instant createdAt){}
}
