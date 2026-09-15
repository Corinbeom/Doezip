package com.doezip.coding.controller;
import com.doezip.coding.dto.CodingDtos.*;
import com.doezip.coding.service.CodingService;
import com.doezip.coding.service.CodingAssistant;
import com.doezip.user.service.CurrentUser;
import java.util.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/coding-workspaces")
public class CodingController {
 private final CodingService service;private final CodingAssistant assistant;private final CurrentUser current;
 public CodingController(CodingService service,CodingAssistant assistant,CurrentUser current){this.service=service;this.assistant=assistant;this.current=current;}
 private <T> ResponseEntity<T> ok(T body){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);}
 @PostMapping public ResponseEntity<Workspace> create(Authentication auth){return ok(service.create(current.id(auth)));}
 @GetMapping public ResponseEntity<List<UUID>> list(Authentication auth){return ok(service.list(current.id(auth)));}
 @GetMapping("/{id}") public ResponseEntity<Workspace> get(Authentication auth,@PathVariable UUID id){return ok(service.get(current.id(auth),id));}
 @PutMapping("/{id}") public ResponseEntity<Workspace> save(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Save body){return ok(service.save(current.id(auth),id,body));}
 @PostMapping("/{id}/runs") public ResponseEntity<Workspace> run(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Run body){return ok(service.run(current.id(auth),id,body));}
 @PostMapping("/{id}/submit") public ResponseEntity<Workspace> submit(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Submit body){return ok(service.submit(current.id(auth),id,body));}
 @PostMapping("/{id}/turns") public ResponseEntity<Workspace> ask(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Ask body){
  return ok(assistant.ask(current.id(auth),id,body));
 }
}
