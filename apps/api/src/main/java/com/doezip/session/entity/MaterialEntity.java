package com.doezip.session.entity;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="materials")
public class MaterialEntity {
 @Id private UUID id;
 @Column(name="task_id",nullable=false) private UUID taskId;
 @Column(nullable=false,length=200) private String title;
 @Column(name="material_type",nullable=false,length=30) private String type;
 @Column(name="content_markdown",nullable=false,columnDefinition="text") private String contentMarkdown;
 @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
 @Column(name="content_hash",nullable=false,columnDefinition="char(64)") private String contentHash;
 @Column(name="release_stage",nullable=false,length=30) private String releaseStage;
 @Column(name="sort_order",nullable=false) private int sortOrder;
 protected MaterialEntity() {}
 public UUID getId(){return id;} public String getTitle(){return title;} public String getType(){return type;}
 public int getSortOrder(){return sortOrder;} public String getContentMarkdown(){return contentMarkdown;}
 public String getContentHash(){return contentHash;}
}
