package com.doezip.session.repository;

import com.doezip.session.entity.DocumentVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<DocumentVersion, UUID> {
    Optional<DocumentVersion> findBySessionIdAndCheckpoint(UUID sessionId, String checkpoint);
    List<DocumentVersion> findBySessionIdOrderByVersionNoAsc(UUID sessionId);
}
