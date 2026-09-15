package com.doezip.coding;
import com.doezip.coding.adapter.GeminiCodingAi;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;
@Tag("live-ai")
class LiveCodingAiTest {
 @Test void returnsRealBoundedCodeProposal() throws Exception {
  String key=System.getenv("GEMINI_API_KEY");assertThat(key).isNotBlank();
  var ai=new GeminiCodingAi(true,key,System.getenv().getOrDefault("AI_CODING_MODEL","gemini-3.5-flash-lite"),new ObjectMapper());
  var proposal=ai.propose("{\"code\":\"function addItem(items,item){items.push(item);return items;}\",\"request\":\"같은 id의 중복 추가와 원본 배열 변경을 고쳐 줘.\"}");
  assertThat(proposal.explanation()).isNotBlank();assertThat(proposal.code()).contains("addItem");
  java.nio.file.Files.createDirectories(java.nio.file.Path.of("build"));
  new ObjectMapper().writeValue(java.nio.file.Path.of("build/coding-live-proposal.json").toFile(),proposal);
  System.out.println("LIVE_CODING_SUCCESS: bounded code proposal received; code execution is verified separately.");
 }
}
