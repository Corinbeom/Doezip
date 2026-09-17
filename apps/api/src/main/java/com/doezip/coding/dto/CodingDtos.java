package com.doezip.coding.dto;
import java.util.*;
import jakarta.validation.constraints.*;
public final class CodingDtos {
 private CodingDtos() {}
 public record Workspace(UUID id,String taskVersion,String code,long version,String submittedAt,String explanation,Run lastRun,List<Turn> turns) {}
 public record Turn(UUID id,UUID requestKey,long baseVersion,String baseCode,String instruction,String status,String explanation,String proposedCode) {}
 public record Save(@NotNull @Size(max=20000) String code,@NotNull @Min(0) Long expectedVersion) {}
 public record Ask(@NotNull UUID requestKey,@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=4000) String instruction) {}
 public record Result(@NotBlank @Size(max=80) String name,@NotNull Boolean passed,@NotNull @Size(max=500) String detail) {}
 public record Run(@NotNull @Min(0) Long version,@NotBlank @Size(max=40) String suite,@NotNull @Size(min=1,max=10) List<@NotNull @jakarta.validation.Valid Result> results) {}
 public record Submit(@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=4000) String explanation) {}
 public record Proposal(String explanation,String code) {}
}
