package com.doezip.chat.adapter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public record ChatSettings(@Value("${app.chat.enabled:false}") boolean enabled,
 @Value("${app.chat.api-key:}") String apiKey,@Value("${app.chat.model:gemini-3.5-flash-lite}") String model,
 @Value("${app.chat.daily-call-limit:20}") int dailyLimit,@Value("${app.chat.global-daily-call-limit:100}") int globalLimit) {
 public boolean available(){return enabled&&!apiKey.isBlank()&&!model.isBlank()&&dailyLimit>0&&globalLimit>0;}
}
