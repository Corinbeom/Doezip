package com.doezip.challenge.entity;
import jakarta.persistence.*;
import java.sql.Types;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
@Entity @Immutable @Table(name="challenge_templates")
public class ChallengeTemplate {
    @Id private UUID id;
    @Column(name="task_id",nullable=false) private UUID taskId;
    @Column(nullable=false,length=200) private String title;
    @Column(name="instructions_markdown",nullable=false,columnDefinition="text") private String instructions;
    @JdbcTypeCode(Types.CHAR) @Column(name="content_hash",nullable=false,length=64) private String contentHash;
    protected ChallengeTemplate() {}
    public UUID getId(){return id;} public String getTitle(){return title;}
    public String getInstructions(){return instructions;} public String getContentHash(){return contentHash;}
}
