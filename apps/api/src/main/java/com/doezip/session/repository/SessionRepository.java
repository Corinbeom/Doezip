package com.doezip.session.repository;
import com.doezip.session.entity.LearningSession;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface SessionRepository extends JpaRepository<LearningSession,UUID> {
 Optional<LearningSession> findByIdAndUserId(UUID id,UUID userId);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select s from LearningSession s where s.id=:id and s.userId=:userId")
 Optional<LearningSession> lockOwned(UUID id,UUID userId);
}
