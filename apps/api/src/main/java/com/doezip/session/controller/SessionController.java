package com.doezip.session.controller;
import com.doezip.session.dto.SessionDtos.*;
import com.doezip.session.service.SessionService;
import com.doezip.user.service.CurrentUser;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/sessions")
public class SessionController {
 private final SessionService sessions;private final CurrentUser user;
 public SessionController(SessionService sessions,CurrentUser user){this.sessions=sessions;this.user=user;}
 @PostMapping public ResponseEntity<Workspace> create(Authentication auth,@RequestBody Create body){
  return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(sessions.create(user.id(auth),body));
 }
 @GetMapping("/{id}/workspace") public ResponseEntity<Workspace> get(Authentication auth,@PathVariable UUID id){
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessions.get(user.id(auth),id));
 }
 @GetMapping("/{id}/materials/{materialId}") public ResponseEntity<Material> material(Authentication auth,@PathVariable UUID id,@PathVariable UUID materialId){
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessions.material(user.id(auth),id,materialId));
 }
 @PutMapping("/{id}/draft") public ResponseEntity<Draft> save(Authentication auth,@PathVariable UUID id,@RequestBody Save body){
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessions.save(user.id(auth),id,body));
 }
}
