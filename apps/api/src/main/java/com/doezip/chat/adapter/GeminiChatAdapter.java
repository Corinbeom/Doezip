package com.doezip.chat.adapter;
import com.google.genai.Client;
import com.google.genai.ResponseStream;
import com.google.genai.types.*;
import com.doezip.chat.service.ChatFailure;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Consumer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
@Component
public class GeminiChatAdapter implements ChatAdapter {
 private final ChatSettings settings;private final String system;
 private final ScheduledThreadPoolExecutor deadlines=new ScheduledThreadPoolExecutor(1,r->{var t=new Thread(r,"chat-deadline");t.setDaemon(true);return t;});
 public GeminiChatAdapter(ChatSettings settings){this.settings=settings;deadlines.setRemoveOnCancelPolicy(true);try(var in=new ClassPathResource("chat/prompt-v1.txt").getInputStream()){system=new String(in.readAllBytes(),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException("Chat prompt unavailable");}}
 @jakarta.annotation.PreDestroy public void close(){deadlines.shutdownNow();}
 @Override public void stream(String context,Consumer<String> delta){call(context,delta,null,60000);}
 void call(String context,Consumer<String> delta,String endpoint,int timeout){
  if(!settings.available())throw new ChatFailure(503,"CHAT_NOT_CONFIGURED");
  var http=HttpOptions.builder().timeout(timeout).baseUrl(endpoint==null?"https://generativelanguage.googleapis.com":endpoint).retryOptions(HttpRetryOptions.builder().attempts(1).build());
  try(var client=Client.builder().apiKey(settings.apiKey()).vertexAI(false).httpOptions(http.build()).build()){
   var config=GenerateContentConfig.builder().maxOutputTokens(4096).candidateCount(1).thinkingConfig(ThinkingConfig.builder().includeThoughts(false)).systemInstruction(Content.fromParts(Part.fromText(system))).build();
   var active=new AtomicReference<ResponseStream<GenerateContentResponse>>();var expired=new AtomicBoolean();
   var timer=deadlines.schedule(()->{expired.set(true);var stream=active.get();if(stream!=null)stream.close();client.close();},timeout,TimeUnit.MILLISECONDS);
   try(var responses=client.models.generateContentStream(settings.model(),context,config)){
    active.set(responses);boolean stopped=false;
    // Read raw provider finishReason: a wrapper defaulting absent reasons to STOP cannot detect truncated streams.
    for(var response:responses){
     if(expired.get())throw new ChatFailure(503,"CHAT_TIMEOUT");
     for(var candidate:response.candidates().orElse(List.of())){
      for(var part:candidate.content().map(c->c.parts().orElse(List.of())).orElse(List.of())){
       if(part.functionCall().isPresent())throw new ChatFailure(503,"CHAT_UNEXPECTED_TOOL");
       if(!part.thought().orElse(false)&&part.text().isPresent())delta.accept(part.text().get());
      }
      if(candidate.finishReason().isPresent()){
       if(!candidate.finishReason().get().toString().equals("STOP"))throw new ChatFailure(503,"CHAT_RESPONSE_INCOMPLETE");stopped=true;
      }
     }
    }
    if(expired.get())throw new ChatFailure(503,"CHAT_TIMEOUT");if(!stopped)throw new ChatFailure(503,"CHAT_RESPONSE_INCOMPLETE");
   }finally{timer.cancel(false);}
  }catch(ChatFailure safe){throw safe;}catch(Exception failure){throw new ChatFailure(503,"CHAT_PROVIDER_FAILED");}
 }
}
