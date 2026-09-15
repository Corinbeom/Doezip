package com.doezip.learning.controller;
import com.doezip.learning.dto.FlowDtos.*;
import com.doezip.learning.service.*;
import com.doezip.user.service.CurrentUser;
import java.util.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/learning-flows")
public class FlowController {
 private final FlowService flows;private final FlowFeedback feedback;private final CurrentUser user;
 public FlowController(FlowService flows,FlowFeedback feedback,CurrentUser user){this.flows=flows;this.feedback=feedback;this.user=user;}
 private <T> ResponseEntity<T> ok(T body){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);}
 @GetMapping("/catalog") public ResponseEntity<List<Task>> catalog(){return ok(List.of(FlowTasks.get("REPORT",false),FlowTasks.get("CODING",false)));}
 @GetMapping public ResponseEntity<List<View>> list(Authentication a){return ok(flows.list(user.id(a)));}
 @PostMapping public ResponseEntity<View> create(Authentication a,@Valid @RequestBody Create b){return ok(flows.create(user.id(a),b));}
 @GetMapping("/{id}") public ResponseEntity<View> get(Authentication a,@PathVariable UUID id){return ok(flows.get(user.id(a),id));}
 @PutMapping("/{id}/notes") public ResponseEntity<View> save(Authentication a,@PathVariable UUID id,@Valid @RequestBody Save b){return ok(flows.save(user.id(a),id,b));}
 @PostMapping("/{id}/hints") public ResponseEntity<View> hint(Authentication a,@PathVariable UUID id,@Valid @RequestBody Hint b){return ok(flows.hint(user.id(a),id,b));}
 @PostMapping("/{id}/submit") public ResponseEntity<View> submit(Authentication a,@PathVariable UUID id,@Valid @RequestBody Submit b){return ok(flows.submit(user.id(a),id,b));}
 @PostMapping("/{id}/answers") public ResponseEntity<View> answers(Authentication a,@PathVariable UUID id,@Valid @RequestBody Answers b){return ok(flows.answer(user.id(a),id,b));}
 @PostMapping("/{id}/feedback") public ResponseEntity<View> feedback(Authentication a,@PathVariable UUID id){return ok(feedback.request(user.id(a),id));}
 @PostMapping("/{id}/practice") public ResponseEntity<View> practice(Authentication a,@PathVariable UUID id){return ok(flows.practice(user.id(a),id));}
}
