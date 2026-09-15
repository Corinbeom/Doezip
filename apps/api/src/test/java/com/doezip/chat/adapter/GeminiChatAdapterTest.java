package com.doezip.chat.adapter;
import static org.assertj.core.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.Test;
class GeminiChatAdapterTest {
 final GeminiChatAdapter adapter=new GeminiChatAdapter(new ChatSettings(true,"test-key","gemini-3.5-flash-lite",20,100));
 @Test void sdkStreamsRealChunksWithoutToolsAndWithoutKeyInBody()throws Exception{
  var request=new AtomicReference<String>();var calls=new AtomicInteger();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/",e->{calls.incrementAndGet();request.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));e.getResponseHeaders().set("Content-Type","text/event-stream");e.sendResponseHeaders(200,0);for(String part:new String[]{"자료 ","확인"}){String finish=part.equals("확인")?",\"finishReason\":\"STOP\"":"";var data=("data: {\"candidates\":[{\"index\":0,\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\""+part+"\"}]}"+finish+"}]}\n\n").getBytes(StandardCharsets.UTF_8);e.getResponseBody().write(data);e.getResponseBody().flush();}e.close();});server.start();
  try{var text=new StringBuilder();adapter.call("PUBLIC_CONTEXT",text::append,"http://127.0.0.1:"+server.getAddress().getPort(),3000);assertThat(text.toString()).isEqualTo("자료 확인");assertThat(calls.get()).isEqualTo(1);assertThat(request.get()).contains("PUBLIC_CONTEXT").doesNotContain("test-key");assertThat(new ObjectMapper().readTree(request.get()).has("tools")).isFalse();}finally{server.stop(0);}
 }
 @Test void providerFailureNeverLeaksRawErrorOrRetries()throws Exception{
  var calls=new AtomicInteger();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",e->{calls.incrementAndGet();e.getRequestBody().readAllBytes();var bytes="{\"error\":{\"code\":429,\"message\":\"SECRET_PROVIDER_MESSAGE\",\"status\":\"RESOURCE_EXHAUSTED\"}}".getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(429,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
  try{assertThatThrownBy(()->adapter.call("PUBLIC",x->{},"http://127.0.0.1:"+server.getAddress().getPort(),3000)).isInstanceOf(com.doezip.chat.service.ChatFailure.class).hasMessage("CHAT_PROVIDER_FAILED");assertThat(calls.get()).isEqualTo(1);}finally{server.stop(0);}
 }

 @Test void missingFinishReasonNeverBecomesCompleted()throws Exception{
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",e->{e.getRequestBody().readAllBytes();byte[] data="data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"partial\"}]}}]}\n\n".getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","text/event-stream");e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});server.start();
  try{assertThatThrownBy(()->adapter.call("PUBLIC",x->{},"http://127.0.0.1:"+server.getAddress().getPort(),3000)).isInstanceOf(com.doezip.chat.service.ChatFailure.class).hasMessage("CHAT_RESPONSE_INCOMPLETE");}finally{server.stop(0);}
 }
}
