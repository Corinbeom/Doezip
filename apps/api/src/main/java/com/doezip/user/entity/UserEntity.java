package com.doezip.user.entity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = {"auth_provider", "auth_subject"}))
public class UserEntity {
    @Id private UUID id;
    @Column(name="auth_provider", nullable=false, length=50) private String authProvider;
    @Column(name="auth_subject", nullable=false, length=255) private String authSubject;
    @Column(name="display_name", nullable=false, length=80) private String displayName;
    @Column(length=320) private String email;
    @Column(name="terms_version", length=20) private String termsVersion;
    @Column(name="privacy_version", length=20) private String privacyVersion;
    @Column(name="ai_notice_version", length=20) private String aiNoticeVersion;
    @Column(name="legal_accepted_at") private Instant legalAcceptedAt;
    @Column(name="deletion_requested_at") private Instant deletionRequestedAt;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
    protected UserEntity() {}
    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
    public String getTermsVersion() { return termsVersion; }
    public String getPrivacyVersion() { return privacyVersion; }
    public String getAiNoticeVersion() { return aiNoticeVersion; }
    public Instant getLegalAcceptedAt() { return legalAcceptedAt; }
    public Instant getDeletionRequestedAt() { return deletionRequestedAt; }
}
