package com.doezip.challenge.entity;
import com.doezip.session.entity.LearningSession;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="challenge_runs")
public class ChallengeRun {
    @Id private UUID id;
    @Column(name="session_id",nullable=false) private UUID sessionId;
    @Column(name="task_id",nullable=false) private UUID taskId;
    @Column(name="challenge_template_id",nullable=false) private UUID templateId;
    @Column(nullable=false,length=20) private String status="IN_PROGRESS";
    @Column(name="notice_version",nullable=false,length=40) private String noticeVersion;
    @Column(name="notice_acknowledged_at",nullable=false) private Instant acknowledgedAt;
    @Column(name="submitted_at") private Instant submittedAt;
    @Column(name="lock_version",nullable=false) private long lockVersion;
    public void saved(){lockVersion++;}
    public void submit(){status="SUBMITTED";submittedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);lockVersion++;}
    protected ChallengeRun() {}
    public ChallengeRun(LearningSession session,UUID template,String notice){
        id=UUID.randomUUID();sessionId=session.getId();taskId=session.getTaskId();templateId=template;
        noticeVersion=notice;acknowledgedAt=Instant.now();
    }
    public UUID getId(){return id;} public UUID getSessionId(){return sessionId;} public UUID getTemplateId(){return templateId;}
    public String getStatus(){return status;} public String getNoticeVersion(){return noticeVersion;}
    public long getLockVersion(){return lockVersion;} public Instant getSubmittedAt(){return submittedAt;}
}
