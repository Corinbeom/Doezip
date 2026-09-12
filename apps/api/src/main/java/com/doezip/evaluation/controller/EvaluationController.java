package com.doezip.evaluation.controller;
import com.doezip.evaluation.dto.EvaluationDtos;
import com.doezip.evaluation.dto.EvaluationDtos.*;
import com.doezip.evaluation.service.EvaluationService;
import com.doezip.user.service.CurrentUser;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1")
public class EvaluationController {
 private final EvaluationService service;private final CurrentUser user;
 public EvaluationController(EvaluationService service,CurrentUser user){this.service=service;this.user=user;}
 @PostMapping("/sessions/{id}/evaluations") public ResponseEntity<Evaluation> request(Authentication auth,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@RequestBody Request request){return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(service.request(user.id(auth),id,EvaluationDtos.uuid(key),request));}
 @GetMapping("/evaluations/{id}") public ResponseEntity<Evaluation> get(Authentication auth,@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(user.id(auth),id));}
 @PostMapping("/evaluations/{id}/retry") public ResponseEntity<Evaluation> retry(Authentication auth,@PathVariable UUID id){return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(service.retry(user.id(auth),id));}
}
