package com.doezip.session.repository;
import com.doezip.session.entity.MaterialEntity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MaterialRepository extends JpaRepository<MaterialEntity,UUID> {
 List<MaterialEntity> findByTaskIdAndReleaseStageInOrderBySortOrderAscIdAsc(UUID taskId,List<String> stages);
 Optional<MaterialEntity> findByIdAndTaskIdAndReleaseStageIn(UUID id,UUID taskId,List<String> stages);
}
