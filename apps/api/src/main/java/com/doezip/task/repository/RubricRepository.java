package com.doezip.task.repository;
import com.doezip.task.entity.RubricEntity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface RubricRepository extends JpaRepository<RubricEntity, UUID> {
    List<RubricEntity> findByTaskIdInOrderBySortOrderAscIdAsc(Collection<UUID> taskIds);
}
