package com.doezip.session.dto;
import com.doezip.task.dto.TaskResponse;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;
public final class SessionDtos {
 private SessionDtos() {}
 public record Create(UUID taskId) {
  @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Create from(JsonNode n) {
   if(n==null || !n.isObject() || n.size()!=1 || !n.hasNonNull("taskId") || !n.get("taskId").isTextual()) throw SessionFailure.invalid();
   String value=n.get("taskId").textValue();
   try {UUID id=UUID.fromString(value);if(!id.toString().equalsIgnoreCase(value))throw SessionFailure.invalid();return new Create(id);}
   catch(IllegalArgumentException e){throw SessionFailure.invalid();}
  }
 }
 public record Save(String markdown,long expectedLockVersion) {
  @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Save from(JsonNode n) {
   if(n==null || !n.isObject() || n.size()!=2 || !n.hasNonNull("markdown") || !n.get("markdown").isTextual()
    || !n.hasNonNull("expectedLockVersion") || !n.get("expectedLockVersion").isIntegralNumber()
    || !n.get("expectedLockVersion").canConvertToLong() || n.get("expectedLockVersion").longValue()<0) throw SessionFailure.invalid();
   return new Save(n.get("markdown").textValue(),n.get("expectedLockVersion").longValue());
  }
 }
 public record Draft(String markdown,long lockVersion,String contentHash) {}
 public record Session(UUID id,UUID taskId,String status,String currentStep,String mode,Instant conditionReleasedAt,List<String> allowedActions) {}
 public record MaterialSummary(UUID id,String title,String type,int sortOrder) {}
 public record Line(int number,String text) {}
 public record Material(UUID id,String title,String type,int sortOrder,String contentMarkdown,String contentHash,List<Line> lines) {}
 public record Workspace(Session session,TaskResponse task,List<MaterialSummary> materials,Draft draft,
  UUID challengeRunId,UUID initialReportId,UUID finalReportId,UUID activeEvaluationId) {}
}
