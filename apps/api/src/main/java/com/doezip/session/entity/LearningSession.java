package com.doezip.session.entity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="learning_sessions")
public class LearningSession {
 @Id private UUID id;
 @Column(name="user_id",nullable=false) private UUID userId;
 @Column(name="task_id",nullable=false) private UUID taskId;
 @Column(nullable=false,length=20) private String mode="PRACTICE";
 @Column(nullable=false,length=20) private String status="ACTIVE";
 @Column(name="current_step",nullable=false,length=30) private String currentStep="WRITING";
 @Column(name="draft_markdown",nullable=false,columnDefinition="text") private String markdown="";
 @Column(name="draft_lock_version",nullable=false) private long lockVersion;
 @Column(name="condition_released_at") private Instant conditionReleasedAt;
 @Column(name="updated_at",nullable=false) private Instant updatedAt=Instant.now();
 protected LearningSession() {}
 public LearningSession(UUID userId, UUID taskId) {this.id=UUID.randomUUID();this.userId=userId;this.taskId=taskId;}
 public UUID getId(){return id;} public UUID getTaskId(){return taskId;}
 public String getMode(){return mode;} public String getStatus(){return status;} public String getCurrentStep(){return currentStep;}
 public String getMarkdown(){return markdown;} public long getLockVersion(){return lockVersion;}
 public Instant getConditionReleasedAt(){return conditionReleasedAt;}
 public boolean writable(){return status.equals("ACTIVE") && currentStep.equals("WRITING");}
 public void submitInitial(){currentStep="CHALLENGE";updatedAt=Instant.now();}
 public void saveDraft(String text){markdown=text;lockVersion++;updatedAt=Instant.now();}
}
