package com.doezip.chat.adapter;
import com.doezip.chat.dto.ChatDtos.*;
import com.doezip.chat.service.*;
import com.doezip.session.service.SessionService;
import com.doezip.session.dto.SessionDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
@Tag("live-chat") @Testcontainers
@SpringBootTest(properties={"app.chat.enabled=true","app.evaluation.worker-enabled=false"})
class LiveChatFlowTest {
 @Container static final PostgreSQLContainer<?> pg=new PostgreSQLContainer<>("postgres:17.11");
 @DynamicPropertySource static void settings(DynamicPropertyRegistry r){r.add("spring.datasource.url",pg::getJdbcUrl);r.add("spring.datasource.username",pg::getUsername);r.add("spring.datasource.password",pg::getPassword);r.add("app.chat.api-key",()->System.getenv("GEMINI_API_KEY"));}
 @Autowired ChatService chat;@Autowired ChatStream stream;@Autowired SessionService sessions;@Autowired JdbcTemplate db;@Autowired ObjectMapper json;
 @Test void actualGeminiStreamPersistsRestoresAndReplaysWithoutNewGeneration()throws Exception{
  assertThat(System.getenv("GEMINI_API_KEY")).isNotBlank();
  UUID user=UUID.randomUUID(),task=UUID.randomUUID(),material=UUID.randomUUID();
  db.update("INSERT INTO users(id,auth_provider,auth_subject,display_name) VALUES (?,'live-chat-test',?,'가상 학습자')",user,user.toString());
  db.update("INSERT INTO tasks(id,task_code,title,description_markdown,status,published_at) VALUES (?,?,'가상 장애 분석','공개 로그의 사실과 미확인을 구분해 보고서를 작성하세요.','PUBLISHED',now())",task,task.toString());
  String log="10:00 결제 API 응답 지연 알림 발생\n10:05 원인은 아직 확인되지 않음";
  db.update("INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage) VALUES (?,?,?,'공개 가상 로그','LOG',?,?,'INITIAL')",material,task,material.toString(),log,SessionService.hash(log));
  var workspace=sessions.create(user,new SessionDtos.Create(task));UUID session=workspace.session().id();
  sessions.save(user,session,new SessionDtos.Save("내가 작성한 보고서 초안",0));
  var request=new Request(UUID.randomUUID(),"로그에서 확인된 사실과 미확인을 두 문장으로 구분해 줘.",false);
  var begin=chat.begin(user,session,request);var events=new ArrayList<String>();stream.write(begin,(event,data)->events.add(event),"live-chat-synthetic");
  var stored=chat.list(user,session,0,50).items();assertThat(stored).hasSize(2);assertThat(stored.get(1).status()).isEqualTo("COMPLETED");assertThat(stored.get(1).contentText()).isNotBlank();assertThat(events).contains("start","delta","done").doesNotContain("stream_error");
  var replay=chat.begin(user,session,request);assertThat(replay.replay()).isTrue();assertThat(replay.assistant()).isEqualTo(stored.get(1));
  assertThat(sessions.get(user,session).draft().markdown()).isEqualTo("내가 작성한 보고서 초안");
  System.out.println("LIVE_CHAT_SUCCESS: persisted messages=2; reply chars="+stored.get(1).contentText().length()+"; replay=true; draft preserved=true");
 }
}
