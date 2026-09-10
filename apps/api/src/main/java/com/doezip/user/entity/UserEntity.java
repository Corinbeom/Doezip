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
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
    protected UserEntity() {}
    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
}
