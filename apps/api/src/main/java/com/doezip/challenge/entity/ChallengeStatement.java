package com.doezip.challenge.entity;
import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
@Entity @Immutable @Table(name="challenge_statements")
public class ChallengeStatement {
    @Id private UUID id;
    @Column(name="challenge_template_id",nullable=false) private UUID templateId;
    @Column(name="statement_key",nullable=false,length=50) private String statementKey;
    @Column(name="sort_order",nullable=false) private int sortOrder;
    @Column(name="content_text",nullable=false,columnDefinition="text") private String text;
    protected ChallengeStatement() {}
    public UUID getId(){return id;} public String getStatementKey(){return statementKey;}
    public int getSortOrder(){return sortOrder;} public String getText(){return text;}
}
