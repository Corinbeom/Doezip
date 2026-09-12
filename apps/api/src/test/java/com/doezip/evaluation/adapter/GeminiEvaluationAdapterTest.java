package com.doezip.evaluation.adapter;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class GeminiEvaluationAdapterTest {
    final ObjectMapper mapper=new ObjectMapper();
    final GeminiEvaluationAdapter adapter=new GeminiEvaluationAdapter(new EvaluationSettings(true,"test-key-not-real","gemini-3.8-flash",10,50),mapper);
    @Test void actualSdkUsesSchemaAndOneRequestWithoutToolsOrThoughts()throws Exception{
        var requests=new AtomicInteger();var body=new AtomicReference<String>();var key=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",e->{requests.incrementAndGet();body.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));key.set(e.getRequestHeaders().getFirst("x-goog-api-key"));byte[] response="{\"modelVersion\":\"gemini-3.8-flash\",\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"{\\\"summary\\\":\\\"test\\\"}\"}]},\"finishReason\":\"STOP\",\"index\":0}]}".getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(200,response.length);e.getResponseBody().write(response);e.close();});server.start();
        try{
            assertThat(adapter.call(mapper.createObjectNode().put("test","synthetic"),"gemini-3.8-flash","http://127.0.0.1:"+server.getAddress().getPort(),2000).get("summary").asText()).isEqualTo("test");
            assertThat(requests.get()).isEqualTo(1);assertThat(key.get()).isEqualTo("test-key-not-real");var request=mapper.readTree(body.get());assertThat(request.path("generationConfig").path("responseMimeType").asText()).isEqualTo("application/json");assertThat(request.path("generationConfig").path("responseSchema").isObject()).isTrue();assertThat(request.path("generationConfig").has("responseJsonSchema")).isFalse();assertThat(request.path("generationConfig").path("responseSchema").path("properties").path("nextPracticeText").path("nullable").asBoolean()).isTrue();assertThat(request.path("generationConfig").path("thinkingConfig").path("thinkingLevel").asText()).isEqualTo("MEDIUM");assertThat(request.path("generationConfig").path("thinkingConfig").has("thinkingBudget")).isFalse();assertThat(request.path("generationConfig").path("temperature").asDouble()).isEqualTo(1.0);assertThat(request.has("tools")).isFalse();assertThat(request.toString()).doesNotContain("test-key-not-real");
        }finally{server.stop(0);}
    }
    @Test void providerErrorsAreSanitizedAndNeverRetriedInsideSdk()throws Exception{
        for(int status:new int[]{401,429,503}){
            var calls=new AtomicInteger();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/",e->{calls.incrementAndGet();e.getRequestBody().readAllBytes();byte[] response=("{\"error\":{\"code\":"+status+",\"message\":\"SECRET_INPUT_AND_KEY\",\"status\":\"UNKNOWN\"}}").getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","application/json");e.getResponseHeaders().set("Retry-After","90");e.sendResponseHeaders(status,response.length);e.getResponseBody().write(response);e.close();});server.start();
            try{assertThatThrownBy(()->adapter.call(mapper.createObjectNode(),"gemini-3.8-flash","http://127.0.0.1:"+server.getAddress().getPort(),2000)).isInstanceOf(EvaluationFailure.class).hasMessage(status==401?"AI_AUTH_FAILED":status==429?"AI_RATE_LIMITED":"AI_PROVIDER_UNAVAILABLE").hasNoCause();assertThat(calls.get()).isEqualTo(1);}
            finally{server.stop(0);}
        }
    }
    @Test void httpTimeoutIsBounded()throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",e->{try{Thread.sleep(300);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}e.close();});server.start();
        try{assertThatThrownBy(()->adapter.call(mapper.createObjectNode(),"gemini-3.8-flash","http://127.0.0.1:"+server.getAddress().getPort(),50)).isInstanceOf(EvaluationFailure.class).hasMessage("AI_TIMEOUT");}finally{server.stop(0);}
    }
    @Test void outputProjectionExcludesCredentialsAndPrivateSnapshotMetadata()throws Exception{
        var snapshot=mapper.readTree("{\"document\":{\"id\":\"x\",\"markdown\":\"learner\",\"private\":\"secret\"},\"task\":{\"title\":\"public\",\"rubrics\":[],\"answerKey\":\"secret\"},\"challenge\":{\"statements\":[],\"reviews\":[],\"sessionId\":\"secret\"},\"materials\":[],\"llmConfig\":{\"apiKey\":\"secret\"}}");
        assertThat(adapter.publicInput(snapshot).toString()).contains("learner","public").doesNotContain("secret","sessionId","apiKey");
    }

    @Test void malformedDuplicateAndTruncatedOutputNeverBecomesASuccess()throws Exception{
        for(String text:new String[]{"not JSON","{\"summary\":\"a\",\"summary\":\"b\"}","TRUNCATED"}){
            var response=mapper.createObjectNode().put("modelVersion","gemini-3.8-flash");var candidate=response.putArray("candidates").addObject();candidate.put("finishReason",text.equals("TRUNCATED")?"MAX_TOKENS":"STOP");candidate.putObject("content").put("role","model").putArray("parts").addObject().put("text",text);
            var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",e->{e.getRequestBody().readAllBytes();byte[] payload=response.toString().getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(200,payload.length);e.getResponseBody().write(payload);e.close();});server.start();
            try{assertThatThrownBy(()->adapter.call(mapper.createObjectNode(),"gemini-3.8-flash","http://127.0.0.1:"+server.getAddress().getPort(),2000)).isInstanceOf(EvaluationFailure.class).hasMessage(text.equals("TRUNCATED")?"AI_RESPONSE_INCOMPLETE":"INVALID_EVALUATION_RESULT");}finally{server.stop(0);}
        }
    }
}
