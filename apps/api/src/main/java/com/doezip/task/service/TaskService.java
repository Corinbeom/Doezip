package com.doezip.task.service;

import com.doezip.task.dto.*;
import com.doezip.task.dto.TaskResponse.RubricResponse;
import com.doezip.task.entity.*;
import com.doezip.task.repository.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TaskService {
    private final TaskRepository tasks;
    private final RubricRepository rubrics;
    public TaskService(TaskRepository tasks, RubricRepository rubrics) {
        this.tasks = tasks; this.rubrics = rubrics;
    }
    public TaskListResponse list() {
        var published = tasks.findByStatusOrderByPublishedAtDescIdAsc("PUBLISHED");
        return new TaskListResponse(map(published));
    }
    public TaskResponse get(UUID id) {
        var task = tasks.findByIdAndStatusIn(id, List.of("PUBLISHED", "ARCHIVED"))
            .orElseThrow(TaskNotFoundException::new);
        return map(List.of(task)).getFirst();
    }
    private List<TaskResponse> map(List<TaskEntity> selected) {
        if (selected.isEmpty()) return List.of();
        var byTask = rubrics.findByTaskIdInOrderBySortOrderAscIdAsc(selected.stream().map(TaskEntity::getId).toList())
            .stream().collect(Collectors.groupingBy(RubricEntity::getTaskId));
        return selected.stream().map(task -> new TaskResponse(task.getId(), task.getTaskCode(),
            task.getVersionNo(), task.getTitle(), task.getDescriptionMarkdown(), task.getStatus(),
            byTask.getOrDefault(task.getId(), List.of()).stream().map(r -> new RubricResponse(
                r.getCode(), r.getArea(), r.getTitle(), r.getPublicDescription())).toList())).toList();
    }
}
