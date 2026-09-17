package com.doezip.challenge.repository;
import com.doezip.challenge.entity.ChallengeRun;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChallengeRunRepository extends JpaRepository<ChallengeRun,UUID>{
    Optional<ChallengeRun> findBySessionId(UUID sessionId);
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select r from ChallengeRun r where r.id=:id")
 java.util.Optional<ChallengeRun> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
 @org.springframework.data.jpa.repository.Query("select r.sessionId from ChallengeRun r where r.id=:id")
 java.util.Optional<UUID> sessionId(@org.springframework.data.repository.query.Param("id") UUID id);
}
