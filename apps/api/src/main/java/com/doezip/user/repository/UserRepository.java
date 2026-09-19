package com.doezip.user.repository;
import com.doezip.user.entity.UserEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByAuthProviderAndAuthSubject(String provider, String subject);
    Optional<UserEntity> findByAuthProviderAndAuthSubjectAndDeletionRequestedAtIsNull(String provider, String subject);
    @Modifying(clearAutomatically=true, flushAutomatically=true)
    @Query(value = """
        INSERT INTO users(id, auth_provider, auth_subject, display_name, email)
        VALUES (:id, :provider, :subject, :name, :email)
        ON CONFLICT (auth_provider, auth_subject) DO NOTHING
        """, nativeQuery=true)
    void insertIfAbsent(@Param("id") UUID id, @Param("provider") String provider,
        @Param("subject") String subject, @Param("name") String name, @Param("email") String email);
    @Modifying
    @Query("""
        UPDATE UserEntity user SET user.termsVersion=:terms, user.privacyVersion=:privacy,
            user.aiNoticeVersion=:ai, user.legalAcceptedAt=CURRENT_TIMESTAMP, user.updatedAt=CURRENT_TIMESTAMP
        WHERE user.authProvider=:provider AND user.authSubject=:subject
        """)
    int acceptLegal(@Param("provider") String provider, @Param("subject") String subject,
        @Param("terms") String terms, @Param("privacy") String privacy, @Param("ai") String ai);
}
