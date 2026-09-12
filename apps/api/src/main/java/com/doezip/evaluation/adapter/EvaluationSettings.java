package com.doezip.evaluation.adapter;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class EvaluationSettings {
    public static final String VERSION = "gemini-evaluation-v1";
    private final boolean enabled;
    private final String key;
    private final String model;
    private final int dailyLimit;
    private final int globalLimit;
    public EvaluationSettings(@Value("${app.evaluation.enabled:false}") boolean enabled,
            @Value("${app.evaluation.api-key:}") String key,
            @Value("${app.evaluation.model:gemini-3.5-flash-lite}") String model,
            @Value("${app.evaluation.daily-call-limit:10}") int dailyLimit,
            @Value("${app.evaluation.global-daily-call-limit:50}") int globalLimit) {
        if (!model.matches("gemini-[a-zA-Z0-9.-]{1,80}") || dailyLimit < 1 || dailyLimit > 100 || globalLimit < 1 || globalLimit > 1000)
            throw new IllegalArgumentException("Invalid evaluation configuration");
        this.enabled=enabled; this.key=key; this.model=model; this.dailyLimit=dailyLimit; this.globalLimit=globalLimit;
    }
    public boolean available() { return enabled && !key.isBlank(); }
    public String apiKey() { return key; }
    public String model() { return model; }
    public int dailyLimit() { return dailyLimit; }
    public int globalLimit() { return globalLimit; }
    public String version() { return available() ? VERSION : "lifecycle-v1"; }
    public Map<String,Object> frozenConfig() {
        return available() ? Map.of("provider","gemini","model",model,"promptVersion",VERSION,"temperature",1.0,"thinkingLevel","medium","maxOutputTokens",8192,"timeoutSeconds",60)
                : Map.of("provider","unconfigured");
    }
}
