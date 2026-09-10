package com.doezip.task.controller;
import com.doezip.task.dto.*;
import com.doezip.task.service.TaskService;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }
    @GetMapping public TaskListResponse list() { return service.list(); }
    @GetMapping("/{taskId}") public TaskResponse get(@PathVariable UUID taskId) { return service.get(taskId); }
}
