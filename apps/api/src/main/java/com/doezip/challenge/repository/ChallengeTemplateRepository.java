package com.doezip.challenge.repository;
import com.doezip.challenge.entity.ChallengeTemplate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChallengeTemplateRepository extends JpaRepository<ChallengeTemplate,UUID>{
    Optional<ChallengeTemplate> findFirstByTaskIdOrderByIdAsc(UUID taskId);
    boolean existsByTaskId(UUID taskId);
}
