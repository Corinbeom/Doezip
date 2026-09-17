package com.doezip.chat.service;
import com.doezip.chat.adapter.ChatAdapter;
import com.doezip.chat.repository.ChatRepository;
import com.doezip.chat.dto.ChatDtos.*;
import java.util.Map;
import java.util.function.BiConsumer;
import org.springframework.stereotype.Service;
@Service
public class ChatStream {
 private final ChatAdapter adapter;private final ChatRepository messages;
 public ChatStream(ChatAdapter adapter,ChatRepository messages){this.adapter=adapter;this.messages=messages;}
 public void write(Begin begun,BiConsumer<String,Object> emit,String requestId){
  var id=begun.assistant().id();
  try{
   emit.accept("start",Map.of("userMessageId",begun.user().id(),"assistantMessageId",id));
   if(begun.replay()){emit.accept("done",Map.of("message",begun.assistant()));return;}
   StringBuilder text=new StringBuilder();
   adapter.stream(begun.context(),chunk->{
    if(text.length()+chunk.length()>20000)throw new ChatFailure(503,"CHAT_RESPONSE_TOO_LARGE");text.append(chunk);
    if(!messages.progress(id,text.toString()))throw new ChatFailure(409,"CHAT_STOPPED");
    emit.accept("delta",Map.of("assistantMessageId",id,"delta",chunk));
   });
   if(text.isEmpty())throw new ChatFailure(503,"CHAT_EMPTY_RESPONSE");
   emit.accept("done",Map.of("message",messages.finish(id,"COMPLETED")));
  }catch(Exception error){
   var terminal=messages.finish(id,"FAILED");
   // Never expose upstream exceptions, credentials, prompt text, or traces.
   try{if(!terminal.status().equals("CANCELLED"))emit.accept("stream_error",Map.of("code","CHAT_PROVIDER_FAILED","message","AI 응답을 완료하지 못했습니다. 저장된 대화를 확인한 뒤 다시 시도하세요.","requestId",requestId));emit.accept("done",Map.of("message",terminal));}catch(Exception disconnected){/* Terminal state is persisted; restore with GET. */}
  }
 }
}
