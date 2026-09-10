package com.doezip.task.repository;
import com.doezip.task.entity.TaskEntity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TaskRepository extends JpaRepository<TaskEntity, UUID> {
    List<TaskEntity> findByStatusOrderByPublishedAtDescIdAsc(String status);
    Optional<TaskEntity> findByIdAndStatusIn(UUID id, Collection<String> statuses);
}
