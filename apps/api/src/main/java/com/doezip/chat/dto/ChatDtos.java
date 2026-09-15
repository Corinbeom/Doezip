package com.doezip.chat.dto;
import java.util.*;
import java.time.Instant;
import jakarta.validation.constraints.*;
public final class ChatDtos {
 private ChatDtos(){}
 public record Request(@NotNull UUID clientMessageKey,@NotBlank @Size(max=8000) String contentText,boolean includeCurrentDraft){
  @com.fasterxml.jackson.annotation.JsonCreator(mode=com.fasterxml.jackson.annotation.JsonCreator.Mode.DELEGATING)
  public static Request from(com.fasterxml.jackson.databind.JsonNode n){
   if(n==null||!n.isObject()||!n.path("clientMessageKey").isTextual()||!n.path("contentText").isTextual()||n.size()!=(n.has("includeCurrentDraft")?3:2)||(n.has("includeCurrentDraft")&&!n.get("includeCurrentDraft").isBoolean()))throw com.doezip.session.service.SessionFailure.invalid();
   try{String key=n.get("clientMessageKey").asText();UUID id=UUID.fromString(key);if(!id.toString().equalsIgnoreCase(key))throw com.doezip.session.service.SessionFailure.invalid();return new Request(id,n.get("contentText").asText(),n.path("includeCurrentDraft").asBoolean(false));}catch(IllegalArgumentException error){throw com.doezip.session.service.SessionFailure.invalid();}
  }
 }
 public record Message(UUID id,long seqNo,String role,String contentText,String status,UUID replyToMessageId,Instant createdAt,Instant completedAt){}
 public record Messages(List<Message> items,Long nextAfterSeq){}
 public record Begin(Message user,Message assistant,String context,boolean replay){}
}
