package com.doezip.session.entity;

import jakarta.persistence.*;
import java.sql.Types;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;

@Entity
@Immutable
@Table(name = "document_versions")
public class DocumentVersion {
    @Id private UUID id;
    @Column(name = "session_id", nullable = false) private UUID sessionId;
    @Column(name = "version_no", nullable = false) private int versionNo;
    @Column(nullable = false, length = 30) private String checkpoint;
    @Column(name = "content_markdown", nullable = false, columnDefinition = "text") private String contentMarkdown;
    @JdbcTypeCode(Types.CHAR)
    @Column(name = "content_hash", nullable = false, length = 64) private String contentHash;
    @Column(name = "source_draft_lock_version", nullable = false) private long sourceDraftLockVersion;
    @Column(name = "sealed_at", nullable = false) private Instant sealedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected DocumentVersion() {}
    public DocumentVersion(LearningSession session, String hash) { this(session, hash, Instant.now()); }
    public DocumentVersion(LearningSession session, String hash, Instant timestamp) {
        id = UUID.randomUUID(); sessionId = session.getId(); versionNo = 1; checkpoint = "INITIAL";
        contentMarkdown = session.getMarkdown(); contentHash = hash;
        sourceDraftLockVersion = session.getLockVersion(); sealedAt = timestamp.truncatedTo(java.time.temporal.ChronoUnit.MICROS); createdAt = sealedAt;
    }
    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public int getVersionNo() { return versionNo; }
    public String getCheckpoint() { return checkpoint; }
    public String getContentMarkdown() { return contentMarkdown; }
    public String getContentHash() { return contentHash; }
    public long getSourceDraftLockVersion() { return sourceDraftLockVersion; }
    public Instant getSealedAt() { return sealedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
