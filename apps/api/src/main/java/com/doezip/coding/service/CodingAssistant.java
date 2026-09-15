package com.doezip.coding.service;
import com.doezip.coding.dto.CodingDtos.*;
import com.doezip.coding.adapter.CodingAi;
import com.doezip.session.service.SessionFailure;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
/** Orchestrates calls without holding a database transaction over network I/O. */
@Service
public class CodingAssistant {
 private final CodingService service;private final CodingAi ai;
 public CodingAssistant(CodingService service,CodingAi ai){this.service=service;this.ai=ai;}
 public Workspace ask(UUID user,UUID id,Ask body){
  var reservation=service.reserve(user,id,body,ai.available());var turn=reservation.turn();
  if(!reservation.created())return service.get(user,id);
  try{
   String context=service.context(user,id,turn);
   if(context.getBytes(StandardCharsets.UTF_8).length>256*1024)throw new SessionFailure(400,"CODING_CONTEXT_TOO_LARGE");
   return service.finish(user,id,turn.id(),ai.propose(context));
  }catch(Exception e){service.finish(user,id,turn.id(),null);throw e;}
 }
}
