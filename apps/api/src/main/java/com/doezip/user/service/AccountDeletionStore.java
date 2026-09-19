package com.doezip.user.service;

import java.time.Duration;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AccountDeletionStore {
    private static final Duration BLOCK_DURATION = Duration.ofHours(24);
    private final JdbcTemplate database;

    public AccountDeletionStore(JdbcTemplate database) { this.database = database; }

    @Transactional
    public boolean begin(String provider, String subject) {
        var requested = database.query("""
            SELECT deletion_requested_at FROM users
            WHERE auth_provider=? AND auth_subject=? FOR UPDATE
            """, (row, index) -> row.getTimestamp(1), provider, subject);
        if (requested.isEmpty()) throw new UserNotFoundException();
        boolean alreadyPending = requested.getFirst() != null;
        if (!alreadyPending) database.update("""
            UPDATE users SET deletion_requested_at=now(), updated_at=now()
            WHERE auth_provider=? AND auth_subject=?
            """, provider, subject);
        return alreadyPending;
    }

    @Transactional
    public void cancel(String provider, String subject) {
        database.update("""
            UPDATE users SET deletion_requested_at=NULL, updated_at=now()
            WHERE auth_provider=? AND auth_subject=?
            """, provider, subject);
    }

    @Transactional
    public void finish(String provider, String subject, String subjectHash) {
        database.update("""
            INSERT INTO account_deletion_blocks(subject_hash,expires_at)
            VALUES (?,?) ON CONFLICT(subject_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at
            """, subjectHash, java.sql.Timestamp.from(Instant.now().plus(BLOCK_DURATION)));
        int deleted = database.update("DELETE FROM users WHERE auth_provider=? AND auth_subject=?", provider, subject);
        if (deleted != 1) throw new UserNotFoundException();
    }

    @Transactional
    public boolean isBlocked(String subjectHash) {
        database.update("DELETE FROM account_deletion_blocks WHERE expires_at <= now()");
        Boolean blocked = database.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM account_deletion_blocks WHERE subject_hash=? AND expires_at>now())",
            Boolean.class, subjectHash);
        return Boolean.TRUE.equals(blocked);
    }
}
