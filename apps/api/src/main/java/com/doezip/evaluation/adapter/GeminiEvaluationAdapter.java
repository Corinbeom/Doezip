package com.doezip.evaluation.adapter;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.HttpRetryOptions;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.core.io.ClassPathResource;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Component;

@Component
public class GeminiEvaluationAdapter implements EvaluationAdapter {
    private final EvaluationSettings settings;
    private final ObjectMapper mapper;
    private final String system;
    private final JsonNode schema;
    public GeminiEvaluationAdapter(EvaluationSettings settings,ObjectMapper mapper) {
        this.settings=settings;this.mapper=mapper;
        system=resource("evaluation/prompt-v1.txt");
        try{schema=mapper.readTree(resource("evaluation/result-schema-v1.json"));}
        catch(java.io.IOException e){throw new IllegalStateException("Invalid evaluation schema");}
    }
    private String resource(String path) {
        try(var in=new ClassPathResource(path).getInputStream()){return new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        catch(java.io.IOException e){throw new IllegalStateException("Evaluation resource unavailable");}
    }
    @Override public JsonNode evaluate(JsonNode snapshot) {
        if(!settings.available() || !snapshot.path("llmConfig").path("provider").asText().equals("gemini"))throw new EvaluationFailure("EVALUATOR_NOT_CONFIGURED",false);
        if(!snapshot.path("evaluatorVersion").asText().equals(EvaluationSettings.VERSION))throw new EvaluationFailure("INVALID_EVALUATION_INPUT",false);
        // Only fixed content fields cross the provider boundary. Credentials and worker/session metadata never do.
        var input=publicInput(snapshot);
        if(input.toString().getBytes(StandardCharsets.UTF_8).length>100_000)throw new EvaluationFailure("EVALUATION_INPUT_TOO_LARGE",false);
        return call(input,snapshot.path("llmConfig").path("model").asText(),null,60_000);
    }
    JsonNode publicInput(JsonNode snapshot) {
        ObjectNode input=mapper.createObjectNode();
        input.set("document",pick(snapshot.path("document"),"id","markdown"));
        var task=pick(snapshot.path("task"),"title","descriptionMarkdown");
        task.set("rubrics",list(snapshot.path("task").path("rubrics"),"code","area","title","description"));input.set("task",task);
        var materials=mapper.createArrayNode();for(var original:snapshot.path("materials")){
            var material=pick(original,"id","title","type","contentMarkdown","contentHash");material.set("lines",list(original.path("lines"),"number","text"));materials.add(material);
        }input.set("materials",materials);
        input.set("statements",list(snapshot.path("challenge").path("statements"),"id","text","order"));
        var reviews=mapper.createArrayNode();for(var original:snapshot.path("challenge").path("reviews")){
            var review=pick(original,"id","statementId","decision","reasonText","replacementText");
            review.set("evidence",list(original.path("evidence"),"id","materialId","lineStart","lineEnd","quotedText","relation","reviewStatus","userNote"));reviews.add(review);
        }input.set("reviews",reviews);
        return input;
    }
    private com.fasterxml.jackson.databind.node.ArrayNode list(JsonNode nodes,String... names){var out=mapper.createArrayNode();for(var node:nodes)out.add(pick(node,names));return out;}
    private ObjectNode pick(JsonNode node,String... names) {var out=mapper.createObjectNode();for(String n:names)out.set(n,node.path(n).deepCopy());return out;}
    // Package-private endpoint override is for an in-process HTTP test server only, never environment/config input.
    JsonNode call(JsonNode input,String model,String testBaseUrl,int timeoutMillis) {
        var http=HttpOptions.builder().timeout(timeoutMillis).retryOptions(HttpRetryOptions.builder().attempts(1).build());
        // Spring AI 1.1.8 sends its Schema as responseJsonSchema. Use the SDK's explicit
        // native responseSchema field so uppercase types and nullable retain their API meaning.
        http.extraBody(java.util.Map.of("generationConfig",java.util.Map.of("responseSchema",schema,"thinkingConfig",java.util.Map.of("thinkingLevel","MEDIUM","includeThoughts",false))));
        http.baseUrl(testBaseUrl==null?"https://generativelanguage.googleapis.com":testBaseUrl);
        try(var client=Client.builder().apiKey(settings.apiKey()).vertexAI(false).httpOptions(http.build()).build()) {
            var options=GoogleGenAiChatOptions.builder().model(model).temperature(1.0).maxOutputTokens(8192)
                    .includeThoughts(false).responseMimeType("application/json")
                    .internalToolExecutionEnabled(false).googleSearchRetrieval(false).build();
            var chat=GoogleGenAiChatModel.builder().genAiClient(client).defaultOptions(options).retryTemplate(RetryTemplate.builder().maxAttempts(1).build()).build();
            var result=chat.call(new Prompt(List.of(new SystemMessage(system),new UserMessage(input.toString()))));
            if(result==null||result.getResult()==null||!"STOP".equalsIgnoreCase(result.getResult().getMetadata().getFinishReason()))throw new EvaluationFailure("AI_RESPONSE_INCOMPLETE",false);
            String text=result.getResult().getOutput().getText();
            if(text==null||text.length()>100_000)throw new EvaluationFailure("INVALID_EVALUATION_RESULT",true);
            var output=mapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).with(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readTree(text);
            if(output==null||!output.isObject())throw new EvaluationFailure("INVALID_EVALUATION_RESULT",true);
            return output;
        } catch(EvaluationFailure safe){throw safe;}
        catch(Exception failure){
            for(Throwable cause=failure;cause!=null;cause=cause.getCause()){
                if(cause instanceof ApiException api){
                    // SDK discards Retry-After headers: do not schedule automatic retries that could ignore them.
                    if(api.code()==429)throw new EvaluationFailure("AI_RATE_LIMITED",false);
                    if(api.code()==401||api.code()==403)throw new EvaluationFailure("AI_AUTH_FAILED",false);
                    if(api.code()>=500)throw new EvaluationFailure("AI_PROVIDER_UNAVAILABLE",false);
                    throw new EvaluationFailure("AI_REQUEST_REJECTED",false);
                }
                if(cause instanceof java.io.InterruptedIOException || cause instanceof java.net.http.HttpTimeoutException)throw new EvaluationFailure("AI_TIMEOUT",true);
                if(cause instanceof com.fasterxml.jackson.core.JsonProcessingException)throw new EvaluationFailure("INVALID_EVALUATION_RESULT",true);
            }
            throw new EvaluationFailure("WORKER_TEMPORARY_FAILURE",true);
        }
    }
}
