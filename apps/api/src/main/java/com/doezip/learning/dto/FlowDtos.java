package com.doezip.learning.dto;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.databind.JsonNode;
public final class FlowDtos {
 private FlowDtos() {}
 public record Create(@NotNull UUID requestKey,@NotNull Kind kind,@NotNull Mode mode) {}
 public enum Kind {REPORT,CODING} public enum Mode {TRAINING,SIMULATION}
 public record Citation(@NotNull UUID materialId,@Min(1) int lineStart,@Min(1) int lineEnd) {}
 public record Notes(@NotNull @Size(max=4000) String explanation,@NotNull @Size(max=4000) String verification,@NotNull @Size(max=8) List<@NotNull @Valid Citation> citations) {}
 public record Save(@NotNull @Min(0) Long version,@NotNull @Valid Notes notes) {}
 public record Submit(@NotNull @Min(0) Long version,@NotNull @Min(0) Long artifactVersion,@NotBlank @Pattern(regexp="[0-9a-f]{64}") String artifactHash) {}
 public record Answers(@NotBlank @Size(max=4000) String decision,@NotBlank @Size(max=4000) String change) {}
 public record Hint(@NotNull @Min(0) @Max(2) Integer index) {}
 public record Task(String kind,String title,String situation,List<String> requirements,String deliverable,List<String> questions,List<String> hints) {}
 public record View(UUID id,String kind,String mode,String flowVersion,UUID sessionId,UUID codingId,UUID parentId,String stage,long version,JsonNode notes,JsonNode hints,JsonNode snapshot,JsonNode answers,JsonNode feedback,String feedbackStatus,Task task,List<JsonNode> comparison) {}
}
