package com.doezip.challenge.repository;
import com.doezip.challenge.entity.ChallengeStatement;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChallengeStatementRepository extends JpaRepository<ChallengeStatement,UUID>{
    List<ChallengeStatement> findByTemplateIdOrderBySortOrderAsc(UUID templateId);
}
