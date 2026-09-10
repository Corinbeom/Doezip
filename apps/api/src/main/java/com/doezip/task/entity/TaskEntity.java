package com.doezip.task.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class TaskEntity {
    @Id private UUID id;
    @Column(name = "task_code", nullable = false, length = 80) private String taskCode;
    @Column(name = "version_no", nullable = false) private int versionNo;
    @Column(nullable = false, length = 200) private String title;
    @Column(name = "description_markdown", nullable = false, columnDefinition = "text") private String descriptionMarkdown;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "published_at") private Instant publishedAt;
    protected TaskEntity() {}
    public UUID getId() { return id; }
    public String getTaskCode() { return taskCode; }
    public int getVersionNo() { return versionNo; }
    public String getTitle() { return title; }
    public String getDescriptionMarkdown() { return descriptionMarkdown; }
    public String getStatus() { return status; }
}
