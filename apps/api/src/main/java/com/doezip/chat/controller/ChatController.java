package com.doezip.chat.controller;
import com.doezip.chat.dto.ChatDtos.*;
import com.doezip.chat.service.*;
import com.doezip.user.service.CurrentUser;
import com.doezip.shared.RequestIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/sessions/{id}/messages")
public class ChatController {
 private final ChatService service;private final ChatStream stream;private final CurrentUser user;private final ObjectMapper json;
 public ChatController(ChatService service,ChatStream stream,CurrentUser user,ObjectMapper json){this.service=service;this.stream=stream;this.user=user;this.json=json;}
 @GetMapping public ResponseEntity<Messages> list(Authentication auth,@PathVariable UUID id,@RequestParam(defaultValue="0") long afterSeq,@RequestParam(defaultValue="50") int limit){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(user.id(auth),id,afterSeq,limit));}
 @PostMapping public void send(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Request body,HttpServletRequest request,HttpServletResponse response)throws java.io.IOException{
  var begun=service.begin(user.id(auth),id,body); // Auth, ownership, state and input failures remain JSON before headers.
  response.setContentType("text/event-stream;charset=UTF-8");response.setHeader("Cache-Control","no-store");response.setHeader("X-Accel-Buffering","no");
  var output=response.getOutputStream();
  stream.write(begun,(event,data)->{try{output.write(("event: "+event+"\ndata: "+json.writeValueAsString(data)+"\n\n").getBytes(StandardCharsets.UTF_8));output.flush();}catch(java.io.IOException e){throw new java.io.UncheckedIOException(e);}},RequestIdFilter.id(request));
 }
 @PostMapping("/{messageId}/cancel") public ResponseEntity<Message> cancel(Authentication auth,@PathVariable UUID id,@PathVariable UUID messageId){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.cancel(user.id(auth),id,messageId));}
}
