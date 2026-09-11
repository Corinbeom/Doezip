package com.doezip.challenge.repository;
import com.doezip.challenge.entity.ChallengeRun;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChallengeRunRepository extends JpaRepository<ChallengeRun,UUID>{
    Optional<ChallengeRun> findBySessionId(UUID sessionId);
}
