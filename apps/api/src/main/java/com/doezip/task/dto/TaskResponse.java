package com.doezip.task.dto;
import java.util.List;
import java.util.UUID;
public record TaskResponse(UUID id, String taskCode, int versionNo, String title,
        String descriptionMarkdown, String status, List<RubricResponse> rubrics) {
    public record RubricResponse(String code, String area, String title, String description) {}
}
