package com.doezip.task.entity;

import jakarta.persistence.*;
import java.util.UUID;

/** Only the public fields are mapped. criteria_json stays in PostgreSQL. */
@Entity
@Table(name = "rubric_dimensions")
public class RubricEntity {
    @Id private UUID id;
    @Column(name = "task_id", nullable = false) private UUID taskId;
    @Column(nullable = false, length = 80) private String code;
    @Column(nullable = false, length = 20) private String area;
    @Column(nullable = false, length = 160) private String title;
    @Column(name = "public_description", nullable = false, columnDefinition = "text") private String publicDescription;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    protected RubricEntity() {}
    public UUID getTaskId() { return taskId; }
    public String getCode() { return code; }
    public String getArea() { return area; }
    public String getTitle() { return title; }
    public String getPublicDescription() { return publicDescription; }
}
