package com.doezip.chat.service;
import com.doezip.chat.dto.ChatDtos.*;
import com.doezip.chat.repository.ChatRepository;
import com.doezip.chat.adapter.ChatSettings;
import com.doezip.session.repository.*;
import com.doezip.session.service.SessionFailure;
import com.doezip.task.service.TaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class ChatService {
 private final SessionRepository sessions;private final MaterialRepository materials;private final TaskService tasks;private final ChatRepository messages;private final ChatSettings settings;private final ObjectMapper json;
 public ChatService(SessionRepository sessions,MaterialRepository materials,TaskService tasks,ChatRepository messages,ChatSettings settings,ObjectMapper json){this.sessions=sessions;this.materials=materials;this.tasks=tasks;this.messages=messages;this.settings=settings;this.json=json;}
 @Transactional public Messages list(UUID user,UUID session,long after,int limit){
  sessions.lockOwned(session,user).orElseThrow(SessionFailure::missing);if(after<0||limit<1||limit>50)throw SessionFailure.invalid();messages.expire(session);
  var rows=messages.list(session,after,limit+1);boolean more=rows.size()>limit;var page=rows.subList(0,Math.min(rows.size(),limit));return new Messages(page,more?page.getLast().seqNo():null);
 }
 @Transactional public Begin begin(UUID user,UUID session,Request request){
  var s=sessions.lockOwned(session,user).orElseThrow(SessionFailure::missing);messages.expire(session);
  String text=request.contentText().replace("\r\n","\n").replace('\r','\n');
  if(text.isBlank()||text.codePointCount(0,text.length())>4000||text.codePoints().anyMatch(c->c==0||c>=0xD800&&c<=0xDFFF))throw SessionFailure.invalid();
  var existing=messages.byKey(session,request.clientMessageKey());
  if(existing.isPresent()){
   var old=existing.get();if(!old.contentText().equals(text)||messages.includesDraft(old.id())!=request.includeCurrentDraft())throw new ChatFailure(409,"MESSAGE_KEY_CONFLICT");
   var reply=messages.reply(old.id());if(reply.status().equals("STREAMING"))throw inProgress(reply);return new Begin(old,reply,"",true);
  }
  if(!s.writable())throw new ChatFailure(409,"INVALID_SESSION_STATE");
  messages.active(session).ifPresent(m->{throw inProgress(m);});
  if(!settings.available())throw new ChatFailure(503,"CHAT_NOT_CONFIGURED");
  var history=messages.list(session,0,41);if(history.size()>=40)throw new ChatFailure(429,"CHAT_SESSION_LIMIT_REACHED");
  var completedReplies=history.stream().filter(m->m.role().equals("ASSISTANT")&&m.status().equals("COMPLETED")).map(Message::replyToMessageId).collect(java.util.stream.Collectors.toSet());
  var conversation=new ArrayList<Map<String,String>>();for(var m:history)if(m.status().equals("COMPLETED")&&(m.role().equals("ASSISTANT")||completedReplies.contains(m.id())))conversation.add(Map.of("role",m.role(),"text",m.contentText()));conversation.add(Map.of("role","USER","text",text));
  var context=new LinkedHashMap<String,Object>();context.put("task",tasks.get(s.getTaskId()));
  // Explicit allowlist: never load challenge templates, private answers, evaluations or unreleased materials.
  context.put("materials",materials.findByTaskIdAndReleaseStageInOrderBySortOrderAscIdAsc(s.getTaskId(),List.of("INITIAL")).stream().map(m->Map.of("title",m.getTitle(),"text",m.getContentMarkdown())).toList());context.put("conversation",conversation);
  if(request.includeCurrentDraft())context.put("savedDraft",s.getMarkdown());
  String serialized;try{serialized=json.writeValueAsString(context);}catch(Exception e){throw new IllegalStateException("Cannot encode chat context");}
  if(serialized.getBytes(StandardCharsets.UTF_8).length>100000)throw new ChatFailure(422,"CHAT_CONTEXT_TOO_LARGE");
  messages.reserve(user,settings.dailyLimit(),settings.globalLimit());
  long seq=history.isEmpty()?1:history.getLast().seqNo()+1;var userId=UUID.randomUUID();var assistantId=UUID.randomUUID();
  messages.insert(session,userId,seq,"USER",text,"COMPLETED",null,request.clientMessageKey(),request.includeCurrentDraft(),null);
  messages.insert(session,assistantId,seq+1,"ASSISTANT","","STREAMING",userId,UUID.randomUUID(),false,settings.model());
  return new Begin(messages.get(userId),messages.get(assistantId),serialized,false);
 }
 private ChatFailure inProgress(Message message){return new ChatFailure(409,"MESSAGE_IN_PROGRESS",Map.of("assistantMessageId",message.id()));}
 @Transactional public Message cancel(UUID user,UUID session,UUID id){sessions.lockOwned(session,user).orElseThrow(SessionFailure::missing);var target=messages.list(session,0,50).stream().filter(m->m.id().equals(id)&&m.role().equals("ASSISTANT")).findFirst().orElseThrow(SessionFailure::missing);return messages.finish(target.id(),"CANCELLED");}
}
