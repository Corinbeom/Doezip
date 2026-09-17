package com.doezip;

import com.doezip.user.service.CurrentUser;
import com.doezip.user.service.UserNotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.*;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ActiveProfiles("test")
@Testcontainers
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="app.evaluation.worker-enabled=false")
class SessionIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11");
    static final RSAKey rsa;
    static final ECKey ec;
    static final HttpServer jwks;
    static final String issuer;
    static {
        try {
            rsa = new RSAKeyGenerator(2048).keyID("rsa-test").generate();
            ec = new ECKeyGenerator(Curve.P_256).keyID("ec-test").generate();
            jwks = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            jwks.createContext("/jwks", exchange -> {
                byte[] body = new JWKSet(List.of(rsa.toPublicJWK(), ec.toPublicJWK())).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                try (var out = exchange.getResponseBody()) { out.write(body); }
            });
            jwks.start(); issuer = "http://127.0.0.1:" + jwks.getAddress().getPort();
        } catch (Exception exception) { throw new ExceptionInInitializerError(exception); }
    }
    @AfterAll static void stopJwks() { jwks.stop(0); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.auth.enabled", () -> true);
        registry.add("app.auth.issuer", () -> issuer);
        registry.add("app.auth.jwk-set-uri", () -> issuer + "/jwks");
        registry.add("app.auth.audience", () -> "authenticated");
        registry.add("app.auth.provider-id", () -> "doezip-supabase");
        registry.add("app.cors-allowed-origin", () -> "http://localhost:3000");
    }
    @org.springframework.test.context.bean.override.mockito.MockitoBean com.doezip.chat.adapter.ChatSettings chatSettings;
    @org.springframework.test.context.bean.override.mockito.MockitoBean com.doezip.chat.adapter.ChatAdapter chatAdapter;
    @Autowired com.doezip.chat.service.ChatService chatService;
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate database;
    @Autowired JwtDecoder decoder;
    @Autowired CurrentUser currentUser;
    @org.springframework.test.context.bean.override.mockito.MockitoBean com.doezip.coding.adapter.CodingAi codingAi;
    @BeforeEach void codingMock(){org.mockito.Mockito.when(codingAi.available()).thenReturn(true);}
    String codingStart(String jwt) throws Exception {var response=request("/api/v1/coding-workspaces",HttpMethod.POST,jwt,"{}");assertThat(response.getStatusCode().value()).as(response.getBody()).isEqualTo(200);return json(response).get("id").asText();}
    @Test void codingOwnershipCasRunAndImmutableSubmission() throws Exception {
      String id=codingStart(alice),p="/api/v1/coding-workspaces/"+id;
      assertThat(request(p,HttpMethod.GET,bob,null).getStatusCode().value()).isEqualTo(404);
      assertThat(request(p,HttpMethod.GET,null,null).getStatusCode().value()).isEqualTo(401);
      assertThat(request(p,HttpMethod.PUT,alice,"{}").getStatusCode().value()).isEqualTo(400);
      String save=mapper.writeValueAsString(Map.of("code","function addItem(items,item){return items;}","expectedVersion",0));
      assertThat(request(p,HttpMethod.PUT,alice,save).getStatusCode().value()).isEqualTo(200);
      assertThat(request(p,HttpMethod.PUT,alice,save).getStatusCode().value()).isEqualTo(409);
      String submit=mapper.writeValueAsString(Map.of("expectedVersion",1,"explanation","테스트의 한계를 확인했습니다."));
      assertThat(request(p+"/submit",HttpMethod.POST,alice,submit).getStatusCode().value()).isEqualTo(409);
      String run=mapper.writeValueAsString(Map.of("version",1,"suite","duplicate-items-v1","results",List.of(Map.of("name","중복 확인","passed",false,"detail","실패"))));
      assertThat(request(p+"/runs",HttpMethod.POST,alice,run).getStatusCode().value()).isEqualTo(200);
      assertThat(request(p+"/submit",HttpMethod.POST,alice,submit).getStatusCode().value()).isEqualTo(200);
      assertThat(request(p+"/submit",HttpMethod.POST,alice,submit).getStatusCode().value()).isEqualTo(200);
      assertThat(request(p+"/runs",HttpMethod.POST,alice,run).getStatusCode().value()).isEqualTo(409);
      assertThat(request(p,HttpMethod.PUT,alice,save).getStatusCode().value()).isEqualTo(409);
      assertThat(json(request(p,HttpMethod.GET,alice,null)).get("submittedAt").isNull()).isFalse();
    }
    @Test void codingAiProposalIsStoredWithoutOverwritingAndReplaysOnce() throws Exception {
      String id=codingStart(alice),p="/api/v1/coding-workspaces/"+id;
      String original=json(request(p,HttpMethod.GET,alice,null)).get("code").asText();
      org.mockito.Mockito.when(codingAi.propose(org.mockito.ArgumentMatchers.anyString())).thenReturn(new com.doezip.coding.dto.CodingDtos.Proposal("직접 테스트하세요.","function addItem(items,item){return items;}"));
      String ask=mapper.writeValueAsString(Map.of("requestKey",UUID.randomUUID(),"expectedVersion",0,"instruction","중복 버그 수정"));
      var first=request(p+"/turns",HttpMethod.POST,alice,ask);
      assertThat(first.getStatusCode().value()).isEqualTo(200);
      assertThat(json(first).get("code").asText()).isEqualTo(original);
      assertThat(json(first).get("turns").get(0).get("status").asText()).isEqualTo("SUCCEEDED");
      assertThat(request(p+"/turns",HttpMethod.POST,alice,ask).getStatusCode().value()).isEqualTo(200);
      assertThat(request(p+"/turns",HttpMethod.POST,alice,ask.replace("중복 버그 수정","다른 요청")).getStatusCode().value()).isEqualTo(409);
      var context=org.mockito.ArgumentCaptor.forClass(String.class);org.mockito.Mockito.verify(codingAi).propose(context.capture());
      assertThat(context.getValue()).contains(original.replace("\n","\\n")).doesNotContain("Never leak","private/task-pack","GEMINI_API_KEY");
    }
    @Test void codingAiFailureStaleReservationAndBudgetAreNotSuccess() throws Exception {
      String id=codingStart(alice),p="/api/v1/coding-workspaces/"+id;
      org.mockito.Mockito.when(codingAi.propose(org.mockito.ArgumentMatchers.anyString())).thenThrow(new com.doezip.session.service.SessionFailure(503,"CODING_AI_FAILED"));
      String ask=mapper.writeValueAsString(Map.of("requestKey",UUID.randomUUID(),"expectedVersion",0,"instruction","수정"));
      assertThat(request(p+"/turns",HttpMethod.POST,alice,ask).getStatusCode().value()).isEqualTo(503);
      assertThat(json(request(p,HttpMethod.GET,alice,null)).get("turns").get(0).get("status").asText()).isEqualTo("FAILED");
      assertThat(request(p+"/turns",HttpMethod.POST,alice,ask).getStatusCode().value()).isEqualTo(200);
      database.update("UPDATE coding_turns SET status='RUNNING',created_at=now()-interval '2 minutes' WHERE workspace_id=?",UUID.fromString(id));
      assertThat(json(request(p,HttpMethod.GET,alice,null)).get("turns").get(0).get("status").asText()).isEqualTo("FAILED");
      for(int i=0;i<19;i++)database.update("INSERT INTO coding_turns(id,workspace_id,request_key,base_version,base_code,instruction,status) VALUES (?,?,?,0,'code','request','FAILED')",UUID.randomUUID(),UUID.fromString(id),UUID.randomUUID());
      ask=mapper.writeValueAsString(Map.of("requestKey",UUID.randomUUID(),"expectedVersion",0,"instruction","수정"));
      assertThat(request(p+"/turns",HttpMethod.POST,alice,ask).getStatusCode().value()).isEqualTo(429);
    }
    @Test void codingConcurrentRetryDoesNotCallAiTwiceAndLateReplyCannotReviveExpiredTurn() throws Exception {
      String id=codingStart(alice),p="/api/v1/coding-workspaces/"+id;
      var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
      org.mockito.Mockito.when(codingAi.propose(org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation->{
        assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        entered.countDown();if(!release.await(15,TimeUnit.SECONDS))throw new IllegalStateException("test timeout");
        return new com.doezip.coding.dto.CodingDtos.Proposal("테스트하세요.","function addItem(items,item){return items;}");
      });
      String ask=mapper.writeValueAsString(Map.of("requestKey",UUID.randomUUID(),"expectedVersion",0,"instruction","수정"));
      try(var executor=Executors.newVirtualThreadPerTaskExecutor()){
        var first=executor.submit(()->request(p+"/turns",HttpMethod.POST,alice,ask));
        try{
          assertThat(entered.await(15,TimeUnit.SECONDS)).isTrue();
          var replay=request(p+"/turns",HttpMethod.POST,alice,ask);
          assertThat(replay.getStatusCode().value()).isEqualTo(200);
          assertThat(json(replay).get("turns").get(0).get("status").asText()).isEqualTo("RUNNING");
          assertThat(request(p,HttpMethod.PUT,alice,mapper.writeValueAsString(Map.of("code","changed","expectedVersion",0))).getStatusCode().value()).isEqualTo(409);
          database.update("UPDATE coding_turns SET created_at=now()-interval '2 minutes' WHERE workspace_id=?",UUID.fromString(id));
          assertThat(json(request(p,HttpMethod.GET,alice,null)).get("turns").get(0).get("status").asText()).isEqualTo("FAILED");
        }finally{release.countDown();}
        assertThat(json(first.get(15,TimeUnit.SECONDS)).get("turns").get(0).get("status").asText()).isEqualTo("FAILED");
        org.mockito.Mockito.verify(codingAi).propose(org.mockito.ArgumentMatchers.anyString());
      }
    }
    @BeforeEach void setup() throws Exception {
        database.update("DELETE FROM learning_flow_events");database.update("DELETE FROM learning_flows");database.update("DELETE FROM evaluation_call_budgets"); database.update("DELETE FROM feedback_reports"); database.update("DELETE FROM evaluation_evidence"); database.update("DELETE FROM dimension_evaluations"); database.update("DELETE FROM evaluation_runs"); database.update("DELETE FROM evidence_links"); database.update("DELETE FROM fault_attempts"); database.update("DELETE FROM challenge_runs"); database.update("DELETE FROM challenge_statements"); database.update("DELETE FROM challenge_templates"); database.update("DELETE FROM document_versions"); database.update("DELETE FROM chat_messages"); database.update("DELETE FROM learning_sessions"); database.update("DELETE FROM materials");
        database.update("DELETE FROM rubric_dimensions"); database.update("DELETE FROM tasks"); database.update("DELETE FROM users");
        database.update("INSERT INTO tasks(id,task_code,title,description_markdown,status,published_at) VALUES (?,'test-writing','Test','Public task','PUBLISHED',now())", taskId);
        alice=token("alice",c->{}); bob=token("bob",c->{});bootstrap(alice,"{}");bootstrap(bob,"{}");
        material(initialId, taskId,"INITIAL","Public initial", "line one\nline two\n");
        material(hiddenId, taskId,"CONDITION_CHANGE","Never leak title", "Never leak body");
    }
    final UUID taskId=UUID.randomUUID(),initialId=UUID.randomUUID(),hiddenId=UUID.randomUUID();
    String alice,bob;
    void material(UUID id,UUID task,String stage,String title,String text){
      database.update("INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage) VALUES (?,?,?,?,'LOG',?,?,?)",
        id,task,id.toString(),title,text,com.doezip.session.service.SessionService.hash(text),stage);
    }
    ResponseEntity<String> create(String jwt,UUID task){return request("/api/v1/sessions",HttpMethod.POST,jwt,"{\"taskId\":\""+task+"\"}");}
    String start() throws Exception {return json(create(alice,taskId)).get("session").get("id").asText();}
    String path(String id){return "/api/v1/sessions/"+id;}
    ResponseEntity<String> save(String id,String jwt,String text,long version) throws Exception {
      return request(path(id)+"/draft",HttpMethod.PUT,jwt,mapper.writeValueAsString(Map.of("markdown",text,"expectedLockVersion",version)));
    }


    String token(String subject, Consumer<JWTClaimsSet.Builder> change) throws Exception {
        return signed(subject, change, rsa, JWSAlgorithm.RS256);
    }
    String signed(String subject, Consumer<JWTClaimsSet.Builder> change, JWK key, JWSAlgorithm algorithm) throws Exception {
        var claims = new JWTClaimsSet.Builder().issuer(issuer).audience("authenticated").subject(subject)
            .issueTime(Date.from(Instant.now())).expirationTime(Date.from(Instant.now().plusSeconds(300)))
            .claim("role", "authenticated").claim("is_anonymous", false)
            .claim("email", "learner@example.com").claim("user_metadata", Map.of("full_name", "학습자 예시"));
        change.accept(claims);
        var rawClaims = new HashMap<String, Object>(claims.build().getClaims());
        rawClaims.replaceAll((name, value) -> value instanceof Date date ? date.toInstant().getEpochSecond() : value);
        var jwt = new JWSObject(new JWSHeader.Builder(algorithm).keyID(key.getKeyID()).build(), new Payload(rawClaims));
        jwt.sign(key instanceof RSAKey r ? new RSASSASigner(r) : new ECDSASigner((ECKey)key));
        return jwt.serialize();
    }
    ResponseEntity<String> request(String path, HttpMethod method, String token, String body) {
        HttpHeaders headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return http.exchange(path, method, new HttpEntity<>(body, headers), String.class);
    }
    ResponseEntity<String> bootstrap(String token, String body) { return request("/api/v1/me/bootstrap", HttpMethod.POST, token, body); }
    JsonNode json(ResponseEntity<String> response) throws Exception { return mapper.readTree(response.getBody()); }
    void assertError(ResponseEntity<String> response, HttpStatus status, String code) throws Exception {
        assertThat(response.getStatusCode()).isEqualTo(status);
        JsonNode body = json(response);
        assertThat(body.size()).isEqualTo(3);
        assertThat(body.get("code").asText()).isEqualTo(code);
        assertThat(body.get("requestId").asText()).isEqualTo(response.getHeaders().getFirst("X-Request-Id"));
        assertThat(response.getBody()).doesNotContain("jwt", "Exception", "jwks", "jdbc", "eyJ");
        assertThat(response.getHeaders().getCacheControl()).contains("no-store");
    }

    @Test void startsDistinctAttemptsAndRestoresNormalizedDraft() throws Exception {
      var first=create(alice,taskId); assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
      var workspace=json(first);String id=workspace.get("session").get("id").asText();
      assertThat(json(create(alice,taskId)).get("session").get("id").asText()).isNotEqualTo(id);
      assertThat(workspace.get("session").get("allowedActions").toString()).isEqualTo("[\"READ_MATERIALS\",\"WRITE_DRAFT\",\"SNAPSHOT_INITIAL\",\"SEND_MESSAGE\"]");
      assertThat(workspace.get("draft").get("lockVersion").asLong()).isZero();
      assertThat(workspace.get("draft").get("contentHash").asText()).isEqualTo(com.doezip.session.service.SessionService.hash(""));
      for(String field:List.of("challengeRunId","initialReportId","finalReportId","activeEvaluationId"))assertThat(workspace.get(field).isNull()).isTrue();
      var saved=save(id,alice,"가설\r\n근거\r미확인 😀",0);assertThat(saved.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(json(saved).get("markdown").asText()).isEqualTo("가설\n근거\n미확인 😀");
      assertThat(json(saved).get("contentHash").asText()).isEqualTo(com.doezip.session.service.SessionService.hash("가설\n근거\n미확인 😀"));
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft")).isEqualTo(json(saved));
      assertThat(save(id,alice,"",1).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
    @Test void onlyOwnerCanReadMaterialsOrWrite() throws Exception {
      String id=start();
      for(String jwt:Arrays.asList(null,bob)) {
        HttpStatus status=jwt==null?HttpStatus.UNAUTHORIZED:HttpStatus.NOT_FOUND;
        assertThat(request(path(id)+"/workspace",HttpMethod.GET,jwt,null).getStatusCode()).isEqualTo(status);
        assertThat(request(path(id)+"/materials/"+initialId,HttpMethod.GET,jwt,null).getStatusCode()).isEqualTo(status);
        assertThat(save(id,jwt,"intrusion",0).getStatusCode()).isEqualTo(status);
      }
      assertThat(create(null,taskId).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertError(request(path(UUID.randomUUID().toString())+"/workspace",HttpMethod.GET,alice,null),HttpStatus.NOT_FOUND,"SESSION_NOT_FOUND");
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft").get("markdown").asText()).isEmpty();
      assertThat(request(path(id)+"/evaluations",HttpMethod.POST,alice,"{}").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
    @Test void staleAndConcurrentWritesNeverOverwrite() throws Exception {
      String id=start();
      try(var pool=Executors.newFixedThreadPool(2)) {
        var gate=new CountDownLatch(1);
        var a=pool.submit(()->{gate.await();return save(id,alice,"A",0);});
        var b=pool.submit(()->{gate.await();return save(id,alice,"B",0);});gate.countDown();
        var results=List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        assertThat(results.stream().map(r->r.getStatusCode().value()).sorted().toList()).containsExactly(200,409);
        var winner=results.stream().filter(r->r.getStatusCode().is2xxSuccessful()).findFirst().orElseThrow();
        assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft")).isEqualTo(json(winner));
      }
      assertError(save(id,alice,"stale",0),HttpStatus.CONFLICT,"DRAFT_VERSION_CONFLICT");
    }
    @Test void stateBlocksDraftAndArchivedTaskStillRestores() throws Exception {
      String id=start();
      database.update("UPDATE tasks SET status='ARCHIVED' WHERE id=?",taskId);
      assertError(create(alice,taskId),HttpStatus.NOT_FOUND,"TASK_NOT_FOUND");
      assertThat(request(path(id)+"/workspace",HttpMethod.GET,alice,null).getStatusCode()).isEqualTo(HttpStatus.OK);
      for(String step:List.of("CHALLENGE","FEEDBACK","FOLLOW_UP","CONDITION_CHANGE","FINAL_REVIEW","DONE")) {
        database.update("UPDATE learning_sessions SET current_step=? WHERE id=?",step,UUID.fromString(id));
        assertError(save(id,alice,"late",0),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      }
      database.update("UPDATE learning_sessions SET current_step='WRITING',status='ABANDONED' WHERE id=?",UUID.fromString(id));
      assertError(save(id,alice,"late",0),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("session").get("allowedActions").toString()).isEqualTo("[\"READ_MATERIALS\"]");
      database.update("UPDATE tasks SET status='DRAFT' WHERE id=?",taskId);
      assertError(create(alice,taskId),HttpStatus.NOT_FOUND,"TASK_NOT_FOUND");
    }
    @Test void materialReleaseAndTaskScopePreventLeaks() throws Exception {
      String id=start();
      var workspace=request(path(id)+"/workspace",HttpMethod.GET,alice,null);
      assertThat(workspace.getBody()).doesNotContain("Never leak",hiddenId.toString());
      assertThat(json(workspace).get("materials")).hasSize(1);
      var initial=request(path(id)+"/materials/"+initialId,HttpMethod.GET,alice,null);
      assertThat(json(initial).get("lines").get(2).get("text").asText()).isEmpty();
      assertThat(json(initial).get("lines").get(1).get("number").asInt()).isEqualTo(2);
      assertError(request(path(id)+"/materials/"+hiddenId,HttpMethod.GET,alice,null),HttpStatus.NOT_FOUND,"MATERIAL_NOT_FOUND");
      UUID otherTask=UUID.randomUUID(),otherMaterial=UUID.randomUUID();
      database.update("INSERT INTO tasks(id,task_code,title,description_markdown,status) VALUES (?,'other','Other','Other','PUBLISHED')",otherTask);
      material(otherMaterial,otherTask,"INITIAL","Cross task","Cross task body");
      assertError(request(path(id)+"/materials/"+otherMaterial,HttpMethod.GET,alice,null),HttpStatus.NOT_FOUND,"MATERIAL_NOT_FOUND");
      database.update("UPDATE learning_sessions SET condition_released_at=now() WHERE id=?",UUID.fromString(id));
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("materials")).hasSize(2);
      assertThat(request(path(id)+"/materials/"+hiddenId,HttpMethod.GET,alice,null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
    @Test void strictInputsAndUnicodeLimit() throws Exception {
      String id=start();
      for(String input:List.of("{}","null","{\"markdown\":null,\"expectedLockVersion\":0}","{\"markdown\":42,\"expectedLockVersion\":0}",
        "{\"markdown\":\"\",\"expectedLockVersion\":\"0\"}","{\"markdown\":\"\",\"expectedLockVersion\":0.0}",
        "{\"markdown\":\"\",\"expectedLockVersion\":-1}","{\"markdown\":\"\",\"expectedLockVersion\":0,\"userId\":\"forged\"}"))
        assertError(request(path(id)+"/draft",HttpMethod.PUT,alice,input),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertThat(save(id,alice,"😀".repeat(20000),0).getStatusCode()).isEqualTo(HttpStatus.OK);
      assertError(save(id,alice,"\r\n".repeat(10001),1),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertError(save(id,alice,"😀".repeat(20001),1),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertError(save(id,alice,"invalid\u0000",1),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft").get("lockVersion").asInt()).isEqualTo(1);
      for(String input:List.of("null","{}","{\"taskId\":42}","{\"taskId\":\"1-1-1-1-1\"}","{\"taskId\":\""+taskId+"\",\"userId\":\"forged\"}"))
        assertError(request("/api/v1/sessions",HttpMethod.POST,alice,input),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
    }
    @Test void corsLimitsOriginAndMethods() {
      HttpHeaders headers=new HttpHeaders();headers.setOrigin("http://localhost:3000");
      headers.setAccessControlRequestHeaders(List.of("authorization","content-type"));
      for(var route:Map.of("/api/v1/sessions",HttpMethod.POST,"/api/v1/sessions/id/draft",HttpMethod.PUT,"/api/v1/sessions/id/workspace",HttpMethod.GET).entrySet()){
        headers.setAccessControlRequestMethod(route.getValue());
        assertThat(http.exchange(route.getKey(),HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
      }
      headers.setOrigin("https://attacker.invalid");
      assertThat(http.exchange("/api/v1/sessions",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
    ResponseEntity<String> submit(String id,String jwt,long version,String hash,String checkpoint) throws Exception {
      return request(path(id)+"/document-versions",HttpMethod.POST,jwt,mapper.writeValueAsString(Map.of(
        "checkpoint",checkpoint,"expectedDraftLockVersion",version,"expectedContentHash",hash)));
    }
    @Test void submitsSealedInitialAndReplaysAfterStateTransition() throws Exception {
      String id=start();var saved=json(save(id,alice,"가설\r\n근거 😀",0));String hash=saved.get("contentHash").asText();
      var response=submit(id,alice,1,hash,"INITIAL");assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
      var doc=json(response);assertThat(doc.get("contentMarkdown").asText()).isEqualTo("가설\n근거 😀");
      assertThat(doc.get("sourceDraftLockVersion").asLong()).isEqualTo(1);assertThat(doc.get("contentHash").asText()).isEqualTo(hash);
      assertThat(doc.get("sealedAt").asText()).isNotBlank();assertThat(doc.get("versionNo").asInt()).isEqualTo(1);
      assertThat(response.getHeaders().getCacheControl()).contains("no-store");
      var state=json(request(path(id)+"/workspace",HttpMethod.GET,alice,null));
      assertThat(state.get("session").get("currentStep").asText()).isEqualTo("CHALLENGE");
      assertThat(state.get("session").get("status").asText()).isEqualTo("ACTIVE");
      assertThat(state.get("session").get("allowedActions").toString()).isEqualTo("[\"READ_MATERIALS\"]");
      assertThat(state.get("initialReportId").isNull()).isTrue();
      assertThat(json(submit(id,alice,1,hash,"INITIAL"))).isEqualTo(doc);
      assertError(save(id,alice,"late",1),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      assertError(submit(id,alice,2,hash,"INITIAL"),HttpStatus.CONFLICT,"DOCUMENT_ALREADY_SUBMITTED");
      var history=json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null));
      assertThat(history.get("items")).hasSize(1);assertThat(history.get("items").get(0)).isEqualTo(doc);
      assertThatThrownBy(()->database.update("UPDATE document_versions SET content_markdown='changed' WHERE session_id=?",UUID.fromString(id)))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      // A future workflow can edit the draft without changing an already sealed artifact.
      database.update("UPDATE learning_sessions SET draft_markdown='future revision',draft_lock_version=2 WHERE id=?",UUID.fromString(id));
      assertThat(json(submit(id,alice,1,hash,"INITIAL"))).isEqualTo(doc);
    }
    @Test void submissionRejectsHashVersionEmptyAndUnsupportedPhaseWithoutMutation() throws Exception {
      String id=start();String empty=com.doezip.session.service.SessionService.hash("");
      assertError(submit(id,alice,0,empty,"INITIAL"),HttpStatus.UNPROCESSABLE_ENTITY,"EMPTY_DOCUMENT");
      var saved=json(save(id,alice,"body",0));String hash=saved.get("contentHash").asText();
      assertError(submit(id,alice,0,hash,"INITIAL"),HttpStatus.CONFLICT,"DRAFT_VERSION_CONFLICT");
      assertError(submit(id,alice,1,empty,"INITIAL"),HttpStatus.CONFLICT,"DRAFT_CONTENT_CONFLICT");
      assertError(submit(id,alice,1,hash,"FINAL"),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      for(String step:List.of("CHALLENGE","FEEDBACK","FOLLOW_UP","CONDITION_CHANGE","FINAL_REVIEW","DONE")){
        database.update("UPDATE learning_sessions SET current_step=? WHERE id=?",step,UUID.fromString(id));
        assertError(submit(id,alice,1,hash,"INITIAL"),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      }
      database.update("UPDATE learning_sessions SET current_step='WRITING',status='ABANDONED' WHERE id=?",UUID.fromString(id));
      assertError(submit(id,alice,1,hash,"INITIAL"),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      assertThat(json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null)).get("items")).isEmpty();
      assertThat(database.queryForObject("SELECT draft_markdown FROM learning_sessions WHERE id=?",String.class,UUID.fromString(id))).isEqualTo("body");
    }
    @Test void documentAccessRequiresOwnerAndUnsupportedWritesRemainDenied() throws Exception {
      String id=start();var saved=json(save(id,alice,"private report",0));String hash=saved.get("contentHash").asText();
      for(String jwt:Arrays.asList(null,bob)){
        HttpStatus expected=jwt==null?HttpStatus.UNAUTHORIZED:HttpStatus.NOT_FOUND;
        assertThat(submit(id,jwt,1,hash,"INITIAL").getStatusCode()).isEqualTo(expected);
        assertThat(request(path(id)+"/document-versions",HttpMethod.GET,jwt,null).getStatusCode()).isEqualTo(expected);
      }
      assertError(submit(UUID.randomUUID().toString(),alice,1,hash,"INITIAL"),HttpStatus.NOT_FOUND,"SESSION_NOT_FOUND");
      var document=json(submit(id,alice,1,hash,"INITIAL"));
      assertThat(request(path(id)+"/document-versions",HttpMethod.GET,bob,null).getBody()).doesNotContain("private report",document.get("id").asText());
      for(HttpMethod method:List.of(HttpMethod.PUT,HttpMethod.DELETE))
        assertThat(request(path(id)+"/document-versions/"+document.get("id").asText(),method,alice,"{}").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
    @Test void submissionInputIsStrict() throws Exception {
      String id=start();String hash=com.doezip.session.service.SessionService.hash("");
      for(String input:List.of("{}","null","[]",
          "{\"checkpoint\":\"INITIAL\",\"expectedDraftLockVersion\":\"0\",\"expectedContentHash\":\""+hash+"\"}",
          "{\"checkpoint\":\"INITIAL\",\"expectedDraftLockVersion\":-1,\"expectedContentHash\":\""+hash+"\"}",
          "{\"checkpoint\":\"INITIAL\",\"expectedDraftLockVersion\":0.0,\"expectedContentHash\":\""+hash+"\"}",
          "{\"checkpoint\":\"REVISION\",\"expectedDraftLockVersion\":0,\"expectedContentHash\":\""+hash+"\"}",
          "{\"checkpoint\":\"INITIAL\",\"expectedDraftLockVersion\":0,\"expectedContentHash\":\"bad\"}",
          "{\"checkpoint\":\"INITIAL\",\"expectedDraftLockVersion\":0,\"expectedContentHash\":\""+hash+"\",\"contentMarkdown\":\"forged\"}"))
        assertError(request(path(id)+"/document-versions",HttpMethod.POST,alice,input),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
    }
    @Test void concurrentDuplicateSubmissionsProduceOneArtifact() throws Exception {
      String id=start();String hash=json(save(id,alice,"same submission",0)).get("contentHash").asText();
      try(var pool=Executors.newFixedThreadPool(2)){
        var gate=new CountDownLatch(1);
        var first=pool.submit(()->{gate.await();return submit(id,alice,1,hash,"INITIAL");});
        var second=pool.submit(()->{gate.await();return submit(id,alice,1,hash,"INITIAL");});gate.countDown();
        var a=first.get(20,TimeUnit.SECONDS);var b=second.get(20,TimeUnit.SECONDS);
        assertThat(a.getStatusCode()).isEqualTo(HttpStatus.CREATED);assertThat(b.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(json(a)).isEqualTo(json(b));
      }
      assertThat(database.queryForObject("SELECT count(*) FROM document_versions WHERE session_id=?",Integer.class,UUID.fromString(id))).isEqualTo(1);
    }
    @Test void saveAndSubmitRaceCannotSealAnUnexpectedBuffer() throws Exception {
      String id=start();String hash=json(save(id,alice,"expected",0)).get("contentHash").asText();
      try(var pool=Executors.newFixedThreadPool(2)){
        var gate=new CountDownLatch(1);
        var writing=pool.submit(()->{gate.await();return save(id,alice,"newer",1);});
        var submitting=pool.submit(()->{gate.await();return submit(id,alice,1,hash,"INITIAL");});gate.countDown();
        var a=writing.get(20,TimeUnit.SECONDS);var b=submitting.get(20,TimeUnit.SECONDS);
        if(a.getStatusCode()==HttpStatus.OK){
          assertError(b,HttpStatus.CONFLICT,"DRAFT_VERSION_CONFLICT");
          assertThat(json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null)).get("items")).isEmpty();
        }else{
          assertError(a,HttpStatus.CONFLICT,"INVALID_SESSION_STATE");assertThat(b.getStatusCode()).isEqualTo(HttpStatus.CREATED);
          assertThat(json(b).get("contentMarkdown").asText()).isEqualTo("expected");
        }
      }
    }
    @Test void submissionCorsLimitsOriginsAndMethods() {
      HttpHeaders headers=new HttpHeaders();headers.setOrigin("http://localhost:3000");headers.setAccessControlRequestHeaders(List.of("authorization","content-type"));
      for(HttpMethod method:List.of(HttpMethod.GET,HttpMethod.POST)){
        headers.setAccessControlRequestMethod(method);
        assertThat(http.exchange("/api/v1/sessions/id/document-versions",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
      }
      headers.setAccessControlRequestMethod(HttpMethod.DELETE);
      assertThat(http.exchange("/api/v1/sessions/id/document-versions",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
      headers.setAccessControlRequestMethod(HttpMethod.POST);headers.setOrigin("https://attacker.invalid");
      assertThat(http.exchange("/api/v1/sessions/id/document-versions",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    UUID template(UUID task,String hashOverride) {
      UUID id=UUID.randomUUID();String text="첫 번째 문장을 자료와 비교한다.\n두 번째 문장을 검토한다.";
      String hash=hashOverride==null?com.doezip.session.service.SessionService.hash(text):hashOverride;
      database.update("INSERT INTO challenge_templates(id,task_id,variant_code,title,instructions_markdown,content_hash) VALUES (?,?,'PRIVATE_VARIANT_NEVER_SEND','별도 검토 초안','사실과 다를 수 있습니다.',?)",id,task,hash);
      int order=0;for(String line:text.split("\n")) database.update("INSERT INTO challenge_statements(id,challenge_template_id,statement_key,sort_order,content_text) VALUES (?,?,?,?,?)",UUID.randomUUID(),id,"S"+(++order),order,line);
      return id;
    }
    String submittedSession() throws Exception {
      String id=start();String hash=json(save(id,alice,"USER_ORIGINAL_REPORT",0)).get("contentHash").asText();
      assertThat(submit(id,alice,1,hash,"INITIAL").getStatusCode()).isEqualTo(HttpStatus.CREATED);return id;
    }
    ResponseEntity<String> beginChallenge(String id,String jwt) {
      return request(path(id)+"/challenge",HttpMethod.POST,jwt,"{\"noticeVersion\":\"challenge-notice-v1\",\"acknowledged\":true}");
    }
    @Test void challengeConsentAssignsSeparateContentAndRestoresWithoutPrivateMetadata() throws Exception {
      UUID template=template(taskId,null);String id=submittedSession();
      var before=request(path(id)+"/workspace",HttpMethod.GET,alice,null);
      assertThat(before.getBody()).doesNotContain("첫 번째 문장","별도 검토 초안",template.toString(),"PRIVATE_VARIANT");
      assertThat(json(before).get("challengeRunId").isNull()).isTrue();assertThat(json(before).get("session").get("allowedActions").toString()).contains("START_CHALLENGE");
      var original=json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null));
      var response=beginChallenge(id,alice);assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      var run=json(response);assertThat(run.get("statements")).hasSize(2);assertThat(run.get("reviews")).isEmpty();
      assertThat(run.get("status").asText()).isEqualTo("IN_PROGRESS");assertThat(run.get("lockVersion").asLong()).isZero();assertThat(run.get("submittedAt").isNull()).isTrue();
      List<String> responseFields=new ArrayList<>();run.fieldNames().forEachRemaining(responseFields::add);
      assertThat(responseFields).containsExactlyInAnyOrder("id","sessionId","title","instructionsMarkdown","noticeVersion","status","lockVersion","statements","reviews","submittedAt");
      assertThat(response.getBody()).doesNotContain("PRIVATE_VARIANT",template.toString(),"faultTemplateId","correctAnswer","isFault","USER_ORIGINAL_REPORT");
      assertThat(response.getHeaders().getCacheControl()).contains("no-store");
      String runId=run.get("id").asText();
      assertThat(json(request("/api/v1/challenge-runs/"+runId,HttpMethod.GET,alice,null))).isEqualTo(run);
      assertThat(json(beginChallenge(id,alice))).isEqualTo(run);
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("challengeRunId").asText()).isEqualTo(runId);
      assertThat(json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null))).isEqualTo(original);
      assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft")).isEqualTo(json(before).get("draft"));
      assertThat(database.queryForObject("SELECT count(*) FROM challenge_runs WHERE session_id=? AND notice_acknowledged_at IS NOT NULL",Integer.class,UUID.fromString(id))).isEqualTo(1);
      database.update("UPDATE learning_sessions SET current_step='FEEDBACK' WHERE id=?",UUID.fromString(id));
      assertThat(json(beginChallenge(id,alice))).isEqualTo(run);
    }
    @Test void challengeRequiresStrictVersionedAcknowledgement() throws Exception {
      template(taskId,null);String id=submittedSession();
      for(String body:List.of("{}","null","[]","{\"noticeVersion\":\"challenge-notice-v1\",\"acknowledged\":false}",
          "{\"noticeVersion\":\"challenge-notice-v1\",\"acknowledged\":\"true\"}",
          "{\"noticeVersion\":\"old-version\",\"acknowledged\":true}",
          "{\"noticeVersion\":\"challenge-notice-v1\",\"acknowledged\":true,\"templateId\":\"forged\"}"))
        assertError(request(path(id)+"/challenge",HttpMethod.POST,alice,body),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertThat(database.queryForObject("SELECT count(*) FROM challenge_runs",Integer.class)).isZero();
    }
    @Test void challengeRequiresSealedInitialAndProperPhase() throws Exception {
      template(taskId,null);String id=start();
      assertError(beginChallenge(id,alice),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      database.update("UPDATE learning_sessions SET current_step='CHALLENGE' WHERE id=?",UUID.fromString(id));
      assertError(beginChallenge(id,alice),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      String sealed=submittedSession();
      for(String step:List.of("WRITING","FEEDBACK","FOLLOW_UP","CONDITION_CHANGE","FINAL_REVIEW","DONE")){
        database.update("UPDATE learning_sessions SET current_step=? WHERE id=?",step,UUID.fromString(sealed));
        assertError(beginChallenge(sealed,alice),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      }
      database.update("UPDATE learning_sessions SET current_step='CHALLENGE',status='ABANDONED' WHERE id=?",UUID.fromString(sealed));
      assertError(beginChallenge(sealed,alice),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      assertThat(database.queryForObject("SELECT count(*) FROM challenge_runs",Integer.class)).isZero();
    }
    @Test void challengeOwnerAndDefaultDenyApplyToAllEntryPoints() throws Exception {
      template(taskId,null);String id=submittedSession();
      assertError(beginChallenge(id,bob),HttpStatus.NOT_FOUND,"SESSION_NOT_FOUND");
      assertError(beginChallenge(id,null),HttpStatus.UNAUTHORIZED,"UNAUTHORIZED");
      String runId=json(beginChallenge(id,alice)).get("id").asText();
      assertError(request("/api/v1/challenge-runs/"+runId,HttpMethod.GET,bob,null),HttpStatus.NOT_FOUND,"CHALLENGE_NOT_FOUND");
      assertError(request("/api/v1/challenge-runs/"+runId,HttpMethod.GET,null,null),HttpStatus.UNAUTHORIZED,"UNAUTHORIZED");
      assertError(request("/api/v1/challenge-runs/"+UUID.randomUUID(),HttpMethod.GET,alice,null),HttpStatus.NOT_FOUND,"CHALLENGE_NOT_FOUND");
      assertThat(request("/api/v1/challenge-runs/"+runId+"/reviews",HttpMethod.PUT,alice,"{}").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(request("/api/v1/challenge-runs/"+runId+"/submit",HttpMethod.POST,alice,"{}").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(request("/api/v1/challenge-templates",HttpMethod.GET,alice,null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
    @Test void challengeConcurrentStartsAssignOneRun() throws Exception {
      template(taskId,null);String id=submittedSession();
      try(var pool=Executors.newFixedThreadPool(2)){
        var gate=new CountDownLatch(1);
        var a=pool.submit(()->{gate.await();return beginChallenge(id,alice);});
        var b=pool.submit(()->{gate.await();return beginChallenge(id,alice);});gate.countDown();
        var first=a.get(20,TimeUnit.SECONDS);var second=b.get(20,TimeUnit.SECONDS);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(first)).isEqualTo(json(second));
      }
      assertThat(database.queryForObject("SELECT count(*) FROM challenge_runs WHERE session_id=?",Integer.class,UUID.fromString(id))).isEqualTo(1);
    }
    @Test void unavailableOrCorruptChallengeDoesNotRecordAStartedRun() throws Exception {
      String id=submittedSession();assertError(beginChallenge(id,alice),HttpStatus.SERVICE_UNAVAILABLE,"CHALLENGE_UNAVAILABLE");
      template(taskId,"0".repeat(64));assertError(beginChallenge(id,alice),HttpStatus.SERVICE_UNAVAILABLE,"CHALLENGE_UNAVAILABLE");
      assertThat(database.queryForObject("SELECT count(*) FROM challenge_runs",Integer.class)).isZero();
      assertThatThrownBy(()->database.update("UPDATE challenge_statements SET content_text='tampered'"))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void challengeCorsAndTaskForeignKeysAreRestricted() throws Exception {
      UUID template=template(taskId,null);String id=submittedSession();
      assertThatThrownBy(()->database.update("INSERT INTO challenge_runs(id,session_id,task_id,challenge_template_id,notice_version,notice_acknowledged_at) VALUES (?,?,?,?,'challenge-notice-v1',now())",UUID.randomUUID(),UUID.fromString(id),UUID.randomUUID(),template))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      HttpHeaders headers=new HttpHeaders();headers.setOrigin("http://localhost:3000");headers.setAccessControlRequestHeaders(List.of("authorization","content-type"));
      for(var route:Map.of(path(id)+"/challenge",HttpMethod.POST,"/api/v1/challenge-runs/id",HttpMethod.GET).entrySet()){
        headers.setAccessControlRequestMethod(route.getValue());
        assertThat(http.exchange(route.getKey(),HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        headers.setOrigin("https://attacker.invalid");
        assertThat(http.exchange(route.getKey(),HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        headers.setOrigin("http://localhost:3000");
      }
    }


    String reviewRun() throws Exception {template(taskId,null);return json(beginChallenge(submittedSession(),alice)).get("id").asText();}
    String reviewBody(String run,long version,String reason) throws Exception {
      String statement=json(request("/api/v1/challenge-runs/"+run,HttpMethod.GET,alice,null)).get("statements").get(0).get("id").asText();
      return "{\"expectedLockVersion\":"+version+",\"reviews\":[{\"statementId\":\""+statement+"\",\"decision\":\"KEEP\",\"reasonText\":\""+reason+"\",\"replacementText\":null,\"evidence\":[]}]}";
    }
    ResponseEntity<String> saveReview(String run,String jwt,String body){return request("/api/v1/challenge-runs/"+run+"/reviews",HttpMethod.PUT,jwt,body);}
    ResponseEntity<String> submitReview(String run,String jwt,long version){return request("/api/v1/challenge-runs/"+run+"/submit",HttpMethod.POST,jwt,"{\"expectedLockVersion\":"+version+"}");}
    @Test void reviewsPersistStableIdsAndDeleteOmittedRows() throws Exception {
      String id=reviewRun();var first=json(saveReview(id,alice,reviewBody(id,0,"자료와 일치합니다")));
      assertThat(first.get("lockVersion").asLong()).isEqualTo(1);String row=first.get("reviews").get(0).get("id").asText();
      var second=json(saveReview(id,alice,reviewBody(id,1,"이유 수정")));
      assertThat(second.get("reviews").get(0).get("id").asText()).isEqualTo(row);
      assertThat(json(request("/api/v1/challenge-runs/"+id,HttpMethod.GET,alice,null))).isEqualTo(second);
      assertThat(json(saveReview(id,alice,"{\"expectedLockVersion\":2,\"reviews\":[]}")).get("reviews")).isEmpty();
    }
    @Test void reviewOwnershipVersionAndStrictInputAreEnforced() throws Exception {
      String id=reviewRun();String body=reviewBody(id,0,"검토");
      assertError(saveReview(id,bob,body),HttpStatus.NOT_FOUND,"CHALLENGE_NOT_FOUND");
      assertError(saveReview(id,null,body),HttpStatus.UNAUTHORIZED,"UNAUTHORIZED");
      assertError(saveReview(id,alice,body.replace("\"KEEP\"","\"CORRECT\"")),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_REVIEW");
      assertError(saveReview(id,alice,body.replace("검토","　")),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_REVIEW");
      assertError(saveReview(id,alice,body.replace("\"reviews\":","\"userId\":\"forged\",\"reviews\":")),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertThat(saveReview(id,alice,body).getStatusCode()).isEqualTo(HttpStatus.OK);
      assertError(saveReview(id,alice,body),HttpStatus.CONFLICT,"CHALLENGE_VERSION_CONFLICT");
      assertError(submitReview(id,alice,0),HttpStatus.CONFLICT,"CHALLENGE_VERSION_CONFLICT");
    }
    @Test void reviewEvidenceIsResolvedFromPublicOriginalAndRangesAreValidated() throws Exception {
      String id=reviewRun();UUID material=UUID.randomUUID();
      database.update("INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order) VALUES (?,?,'review-evidence','원자료','LOG',? ,?,'INITIAL',1)",material,taskId,"첫 줄\n실제 근거\n끝 줄",com.doezip.session.service.SessionService.hash("첫 줄\n실제 근거\n끝 줄"));
      var body=(com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(reviewBody(id,0,"근거 확인"));
      var evidence=(com.fasterxml.jackson.databind.node.ArrayNode)body.get("reviews").get(0).get("evidence");
      evidence.addObject().put("materialId",material.toString()).put("lineStart",2).put("lineEnd",2).put("relation","SUPPORTS");
      var saved=json(saveReview(id,alice,body.toString()));var link=saved.get("reviews").get(0).get("evidence").get(0);
      assertThat(link.get("quotedText").asText()).isEqualTo("실제 근거");assertThat(link.get("origin").asText()).isEqualTo("USER");
      body.put("expectedLockVersion",1);((com.fasterxml.jackson.databind.node.ObjectNode)evidence.get(0)).put("lineEnd",500);
      assertError(saveReview(id,alice,body.toString()),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_EVIDENCE");
      ((com.fasterxml.jackson.databind.node.ObjectNode)evidence.get(0)).put("lineEnd",2);evidence.add(evidence.get(0).deepCopy());
      assertError(saveReview(id,alice,body.toString()),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_EVIDENCE");evidence.remove(1);
      database.update("UPDATE materials SET release_stage='CONDITION_CHANGE' WHERE id=?",material);
      assertError(saveReview(id,alice,body.toString()),HttpStatus.NOT_FOUND,"MATERIAL_NOT_FOUND");
      assertThat(json(request("/api/v1/challenge-runs/"+id,HttpMethod.GET,alice,null))).isEqualTo(saved);
    }
    @Test void submissionFreezesPartialReviewsAndReplaysWithoutChangingReport() throws Exception {
      String id=reviewRun();var before=json(request("/api/v1/challenge-runs/"+id,HttpMethod.GET,alice,null));String sid=before.get("sessionId").asText();
      var workspace=json(request(path(sid)+"/workspace",HttpMethod.GET,alice,null));var documents=json(request(path(sid)+"/document-versions",HttpMethod.GET,alice,null));
      assertThat(saveReview(id,alice,reviewBody(id,0,"확인")).getStatusCode()).isEqualTo(HttpStatus.OK);
      var submitted=json(submitReview(id,alice,1));assertThat(submitted.get("status").asText()).isEqualTo("SUBMITTED");assertThat(submitted.get("lockVersion").asLong()).isEqualTo(2);
      assertThat(json(submitReview(id,alice,1))).isEqualTo(submitted);
      assertError(saveReview(id,alice,reviewBody(id,2,"변조")),HttpStatus.CONFLICT,"CHALLENGE_SUBMITTED");
      assertThat(json(request(path(sid)+"/workspace",HttpMethod.GET,alice,null)).get("draft")).isEqualTo(workspace.get("draft"));
      assertThat(json(request(path(sid)+"/document-versions",HttpMethod.GET,alice,null))).isEqualTo(documents);
      assertError(submitReview(id,bob,2),HttpStatus.NOT_FOUND,"CHALLENGE_NOT_FOUND");
    }
    @Test void concurrentReviewWritesHaveOneWinner() throws Exception {
      String id=reviewRun();String body=reviewBody(id,0,"경합");
      try(var pool=Executors.newFixedThreadPool(2)){
       var gate=new CountDownLatch(1);var a=pool.submit(()->{gate.await();return saveReview(id,alice,body);});var b=pool.submit(()->{gate.await();return saveReview(id,alice,body);});gate.countDown();
       var codes=List.of(a.get(20,TimeUnit.SECONDS).getStatusCode().value(),b.get(20,TimeUnit.SECONDS).getStatusCode().value());assertThat(codes).containsExactlyInAnyOrder(200,409);
      }
    }

    @Test void submitAndSaveSerializeAndForeignStatementsAreRejected() throws Exception {
      String id=reviewRun();String body=reviewBody(id,0,"경합");
      var malformed=(com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(body);
      ((com.fasterxml.jackson.databind.node.ObjectNode)malformed.get("reviews").get(0)).put("statementId",UUID.randomUUID().toString());
      assertError(saveReview(id,alice,malformed.toString()),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_REVIEW");
      try(var pool=Executors.newFixedThreadPool(2)){
       var gate=new CountDownLatch(1);var a=pool.submit(()->{gate.await();return saveReview(id,alice,body);});var b=pool.submit(()->{gate.await();return submitReview(id,alice,0);});gate.countDown();
       assertThat(List.of(a.get(20,TimeUnit.SECONDS).getStatusCode().value(),b.get(20,TimeUnit.SECONDS).getStatusCode().value())).containsExactlyInAnyOrder(200,409);
      }
      var current=json(request("/api/v1/challenge-runs/"+id,HttpMethod.GET,alice,null));
      assertThat(submitReview(id,alice,current.get("lockVersion").asLong()).getStatusCode()).isEqualTo(HttpStatus.OK);
      assertError(saveReview(id,alice,body),HttpStatus.CONFLICT,"CHALLENGE_SUBMITTED");
    }

    @Autowired com.doezip.evaluation.repository.EvaluationRepository evaluationJobs;
    @Autowired com.doezip.evaluation.service.EvaluationWorker evaluationWorker;
    String evaluationSession() throws Exception {String run=reviewRun();assertThat(submitReview(run,alice,0).getStatusCode()).isEqualTo(HttpStatus.OK);return json(request("/api/v1/challenge-runs/"+run,HttpMethod.GET,alice,null)).get("sessionId").asText();}
    String evaluationDocument(String id)throws Exception{return json(request(path(id)+"/document-versions",HttpMethod.GET,alice,null)).get("items").get(0).get("id").asText();}
    ResponseEntity<String> evaluate(String session,String jwt,UUID key,String document){
      HttpHeaders h=new HttpHeaders();h.setContentType(MediaType.APPLICATION_JSON);if(jwt!=null)h.setBearerAuth(jwt);if(key!=null)h.set("Idempotency-Key",key.toString());
      return http.exchange(path(session)+"/evaluations",HttpMethod.POST,new HttpEntity<>("{\"phase\":\"INITIAL\",\"documentVersionId\":\""+document+"\"}",h),String.class);
    }
    @Test void evaluationFreezesInputReplaysAndNeverExposesSnapshot()throws Exception{
      String sid=evaluationSession(),doc=evaluationDocument(sid);UUID key=UUID.randomUUID();var created=evaluate(sid,alice,key,doc);assertThat(created.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
      var value=json(created);UUID id=UUID.fromString(value.get("id").asText());assertThat(value.size()).isEqualTo(9);assertThat(value.get("status").asText()).isEqualTo("QUEUED");
      assertThat(created.getBody()).doesNotContain("USER_ORIGINAL_REPORT","inputSnapshot","leaseToken","fingerprint","materials");assertThat(created.getHeaders().getCacheControl()).contains("no-store");
      assertThat(json(evaluate(sid,alice,key,doc))).isEqualTo(value);
      assertError(evaluate(sid,alice,key,UUID.randomUUID().toString()),HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT");
      var conflict=evaluate(sid,alice,UUID.randomUUID(),doc);assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);assertThat(json(conflict).get("code").asText()).isEqualTo("EVALUATION_IN_PROGRESS");assertThat(json(conflict).get("details").get("evaluationId").asText()).isEqualTo(id.toString());
      var snapshot=evaluationJobs.find(id).orElseThrow().snapshot();assertThat(snapshot).contains("USER_ORIGINAL_REPORT","materials","challenge","lifecycle-v1");
      assertThatThrownBy(()->database.update("UPDATE evaluation_runs SET input_snapshot_json='{}' WHERE id=?",id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      evaluationWorker.tick();var terminal=json(request("/api/v1/evaluations/"+id,HttpMethod.GET,alice,null));assertThat(terminal.get("status").asText()).isEqualTo("FAILED");assertThat(terminal.get("errorCode").asText()).isEqualTo("EVALUATOR_NOT_CONFIGURED");assertThat(terminal.get("reportId").isNull()).isTrue();assertThat(terminal.get("retryable").asBoolean()).isFalse();
      assertThat(json(evaluate(sid,alice,key,doc))).isEqualTo(terminal);assertThat(evaluationJobs.find(id).orElseThrow().snapshot()).isEqualTo(snapshot);
      assertThat(json(request(path(sid)+"/workspace",HttpMethod.GET,alice,null)).get("activeEvaluationId").asText()).isEqualTo(id.toString());
    }
    @Test void evaluationOwnershipHeadersAndPhaseAreRequired()throws Exception{
      String sid=evaluationSession(),doc=evaluationDocument(sid);UUID key=UUID.randomUUID();
      assertError(evaluate(sid,bob,key,doc),HttpStatus.NOT_FOUND,"SESSION_NOT_FOUND");assertError(evaluate(sid,null,key,doc),HttpStatus.UNAUTHORIZED,"UNAUTHORIZED");assertError(evaluate(sid,alice,null,doc),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
      assertError(evaluate(sid,alice,key,UUID.randomUUID().toString()),HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_EVALUATION_INPUT");
      String id=json(evaluate(sid,alice,key,doc)).get("id").asText();
      assertError(request("/api/v1/evaluations/"+id,HttpMethod.GET,bob,null),HttpStatus.NOT_FOUND,"EVALUATION_NOT_FOUND");
      assertError(request("/api/v1/evaluations/"+id+"/retry",HttpMethod.POST,bob,null),HttpStatus.NOT_FOUND,"EVALUATION_NOT_FOUND");
      assertError(request("/api/v1/evaluations/"+id+"/retry",HttpMethod.POST,alice,null),HttpStatus.CONFLICT,"EVALUATION_NOT_RETRYABLE");
      String writing=start();assertError(evaluate(writing,alice,UUID.randomUUID(),doc),HttpStatus.CONFLICT,"INVALID_SESSION_STATE");
      String unsubmitted=submittedSession();assertError(evaluate(unsubmitted,alice,UUID.randomUUID(),evaluationDocument(unsubmitted)),HttpStatus.CONFLICT,"CHALLENGE_NOT_SUBMITTED");
    }
    @Test void expiredWorkerCannotFinishAndRetryRetainsSnapshotAndAttemptLimit()throws Exception{
      String sid=evaluationSession();UUID id=UUID.fromString(json(evaluate(sid,alice,UUID.randomUUID(),evaluationDocument(sid))).get("id").asText());String snapshot=evaluationJobs.find(id).orElseThrow().snapshot();
      for(int attempt=1;attempt<=3;attempt++){
       database.update("UPDATE evaluation_runs SET next_attempt_at=now() WHERE id=?",id);var claim=evaluationJobs.claim().orElseThrow();assertThat(claim.attempts()).isEqualTo(attempt);assertThat(evaluationJobs.claim()).isEmpty();
       database.update("UPDATE evaluation_runs SET lease_expires_at=now()-interval '1 second' WHERE id=?",id);assertThat(evaluationJobs.recoverExpired()).isEqualTo(1);assertThat(evaluationJobs.fail(claim,"STALE_WORKER_RESULT",false)).isFalse();
      }
      assertThat(evaluationJobs.find(id).orElseThrow().retryable()).isTrue();
      assertThat(request("/api/v1/evaluations/"+id+"/retry",HttpMethod.POST,alice,null).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
      var fourth=evaluationJobs.claim().orElseThrow();assertThat(fourth.attempts()).isEqualTo(4);assertThat(evaluationJobs.fail(fourth,"WORKER_TEMPORARY_FAILURE",true)).isTrue();
      assertThat(evaluationJobs.find(id).orElseThrow().retryable()).isFalse();assertError(request("/api/v1/evaluations/"+id+"/retry",HttpMethod.POST,alice,null),HttpStatus.CONFLICT,"EVALUATION_NOT_RETRYABLE");assertThat(evaluationJobs.find(id).orElseThrow().snapshot()).isEqualTo(snapshot);
    }
    @Test void concurrentEvaluationRequestsCreateOneJobAndCorsAllowsOnlyLocalOrigin()throws Exception{
      String sid=evaluationSession(),doc=evaluationDocument(sid);UUID key=UUID.randomUUID();
      try(var pool=Executors.newFixedThreadPool(2)){
       var gate=new CountDownLatch(1);var a=pool.submit(()->{gate.await();return evaluate(sid,alice,key,doc);});var b=pool.submit(()->{gate.await();return evaluate(sid,alice,key,doc);});gate.countDown();
       var first=a.get(20,TimeUnit.SECONDS);var second=b.get(20,TimeUnit.SECONDS);assertThat(first.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);assertThat(json(first)).isEqualTo(json(second));
      }
      assertThat(database.queryForObject("SELECT count(*) FROM evaluation_runs",Integer.class)).isEqualTo(1);
      HttpHeaders headers=new HttpHeaders();headers.setOrigin("http://localhost:3000");headers.setAccessControlRequestMethod(HttpMethod.POST);headers.setAccessControlRequestHeaders(List.of("authorization","content-type","idempotency-key"));
      assertThat(http.exchange(path(sid)+"/evaluations",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
      headers.setOrigin("https://attacker.invalid");assertThat(http.exchange(path(sid)+"/evaluations",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
    @Autowired com.doezip.evaluation.service.ResultPublisher resultPublisher;
    @Autowired com.doezip.evaluation.service.ResultValidator resultValidator;
    com.doezip.evaluation.repository.EvaluationRepository.Job resultJob() throws Exception {
      for(String area:List.of("PROMPT","EVIDENCE","DOCUMENT","DEFENSE"))
        database.update("INSERT INTO rubric_dimensions(id,task_id,code,area,title,public_description,criteria_json) VALUES (?,?,?,?,?,'Synthetic test criterion','{}')",UUID.randomUUID(),taskId,area.toLowerCase()+".test",area,area+" test");
      String sid=evaluationSession();evaluate(sid,alice,UUID.randomUUID(),evaluationDocument(sid));
      return evaluationJobs.claim().orElseThrow();
    }
    com.fasterxml.jackson.databind.node.ObjectNode resultDraft(com.doezip.evaluation.repository.EvaluationRepository.Job job) throws Exception {
      var snapshot=mapper.readTree(job.snapshot());var result=mapper.createObjectNode();
      result.put("summary","Synthetic publication test, not an AI evaluation");result.putArray("strengths");result.putArray("improvements");result.putNull("nextPracticeText");
      var areas=result.putArray("areas");
      for(var rubric:snapshot.get("task").get("rubrics")){
        var area=areas.addObject();area.put("area",rubric.get("area").asText());var d=area.putArray("dimensions").addObject();
        d.put("code",rubric.get("code").asText());d.put("title",rubric.get("title").asText());d.put("state","NOT_OBSERVED");d.put("rationale","No observation in this test");d.putNull("gap");d.putNull("nextAction");d.putNull("confidenceLevel");d.putArray("evidence");
      }
      var faults=result.putObject("faultSummary");faults.put("note","No approved answer policy connected");var statements=faults.putArray("statements");
      for(var statement:snapshot.get("challenge").get("statements")){
        var f=statements.addObject();f.put("statementId",statement.get("id").asText());f.putNull("reviewId");f.put("detectionResult","UNREVIEWED");f.put("evidenceResult","NOT_OBSERVED");f.put("repairResult","NOT_OBSERVED");f.put("recheckResult","NOT_OBSERVED");f.put("feedback","No review submitted");
      }
      return result;
    }
    com.fasterxml.jackson.databind.node.ObjectNode documentDimension(JsonNode draft){
      for(var area:draft.get("areas"))if(area.get("area").asText().equals("DOCUMENT"))return (com.fasterxml.jackson.databind.node.ObjectNode)area.get("dimensions").get(0);
      throw new AssertionError();
    }
    com.fasterxml.jackson.databind.node.ObjectNode addObservation(JsonNode draft,com.doezip.evaluation.repository.EvaluationRepository.Job job){
      var d=documentDimension(draft);d.put("state","PARTIAL");
      var e=((com.fasterxml.jackson.databind.node.ArrayNode)d.get("evidence")).addObject();e.put("id",UUID.randomUUID().toString());e.put("kind","SELF_REPORT");e.put("polarity","SUPPORT");e.put("method","RULE");e.put("subjectType","DOCUMENT_VERSION");e.put("subjectId",job.documentId().toString());e.put("excerpt","USER_ORIGINAL_REPORT");e.put("explanation","Synthetic exact text reference");
      var source=e.putObject("source");source.put("materialId",initialId.toString());source.put("lineStart",1);source.put("lineEnd",2);source.put("quotedText","line one\nline two");return e;
    }
    void noPublishedResult(){
      for(String table:List.of("feedback_reports","dimension_evaluations","evaluation_evidence"))assertThat(database.queryForObject("SELECT count(*) FROM "+table,Integer.class)).isZero();
    }
    @Test void validResultPublishesAtomicallyAndIsOwnerOnlyImmutable()throws Exception{
      var job=resultJob();var draft=resultDraft(job);addObservation(draft,job);var report=resultPublisher.publish(job,draft,true);
      String id=report.get("id").asText();var response=request("/api/v1/reports/"+id,HttpMethod.GET,alice,null);
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);assertThat(response.getHeaders().getCacheControl()).contains("no-store");assertThat(json(response)).isEqualTo(report);
      assertThat(response.getBody()).doesNotContain("input_snapshot_json","Never leak","variant_code","answer_key");
      assertThat(json(response).get("sample").asBoolean()).isTrue();assertThat(draft.has("id")).isFalse();
      var evaluation=json(request("/api/v1/evaluations/"+job.id(),HttpMethod.GET,alice,null));assertThat(evaluation.get("status").asText()).isEqualTo("SUCCEEDED");assertThat(evaluation.get("reportId").asText()).isEqualTo(id);
      var workspace=json(request(path(job.sessionId().toString())+"/workspace",HttpMethod.GET,alice,null));assertThat(workspace.get("initialReportId").asText()).isEqualTo(id);assertThat(workspace.get("session").get("currentStep").asText()).isEqualTo("FEEDBACK");assertThat(workspace.get("session").get("allowedActions").toString()).contains("READ_INITIAL_REPORT").doesNotContain("REQUEST_INITIAL_EVALUATION");
      assertError(request("/api/v1/reports/"+id,HttpMethod.GET,bob,null),HttpStatus.NOT_FOUND,"REPORT_NOT_FOUND");
      assertThat(request("/api/v1/reports/"+id,HttpMethod.GET,null,null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertError(request("/api/v1/reports/"+UUID.randomUUID(),HttpMethod.GET,alice,null),HttpStatus.NOT_FOUND,"REPORT_NOT_FOUND");
      assertThatThrownBy(()->resultPublisher.publish(job,draft,true)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);
      assertThat(database.queryForObject("SELECT count(*) FROM feedback_reports",Integer.class)).isEqualTo(1);
      for(String table:List.of("feedback_reports","dimension_evaluations","evaluation_evidence"))assertThatThrownBy(()->database.update("UPDATE "+table+" SET created_at=now()" )).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void resultRejectsInventedSubjectsQuotesHiddenSourcesAndExtraFields()throws Exception{
      var job=resultJob();var base=resultDraft(job);addObservation(base,job);var snapshot=mapper.readTree(job.snapshot());
      List<java.util.function.Consumer<com.fasterxml.jackson.databind.node.ObjectNode>> corruptions=List.of(
        d->((com.fasterxml.jackson.databind.node.ObjectNode)documentDimension(d).get("evidence").get(0)).put("subjectId",UUID.randomUUID().toString()),
        d->((com.fasterxml.jackson.databind.node.ObjectNode)documentDimension(d).get("evidence").get(0)).put("excerpt","invented quotation"),
        d->((com.fasterxml.jackson.databind.node.ObjectNode)documentDimension(d).get("evidence").get(0).get("source")).put("materialId",hiddenId.toString()),
        d->((com.fasterxml.jackson.databind.node.ObjectNode)documentDimension(d).get("evidence").get(0).get("source")).put("quotedText","wrong quote"),
        d->((com.fasterxml.jackson.databind.node.ObjectNode)documentDimension(d).get("evidence").get(0).get("source")).put("lineEnd",99),
        d->documentDimension(d).put("title","Invented rubric"),
        d->documentDimension(d).put("code","invented.code"),
        d->d.put("privateAnswer","must not pass through"),
        d->d.put("summary","\u0000"),
        d->((com.fasterxml.jackson.databind.node.ObjectNode)d.get("faultSummary").get("statements").get(0)).put("detectionResult","VALID_KEEP"),
        d->d.get("areas").forEach(a->{if(a.path("area").asText().equals("PROMPT"))((com.fasterxml.jackson.databind.node.ObjectNode)a.get("dimensions").get(0)).put("state","SUFFICIENT");})
      );
      for(var corruption:corruptions){var invalid=base.deepCopy();corruption.accept(invalid);assertThatThrownBy(()->resultValidator.validate(invalid,snapshot)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);}
      var invalid=base.deepCopy();documentDimension(invalid).put("code","missing");assertThatThrownBy(()->resultPublisher.publish(job,invalid,true)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);noPublishedResult();assertThat(evaluationJobs.find(job.id()).orElseThrow().status()).isEqualTo("RUNNING");
    }
    @Test void expiredAndReclaimedWorkersCannotPublish()throws Exception{
      var job=resultJob();var draft=resultDraft(job);database.update("UPDATE evaluation_runs SET lease_expires_at=now()-interval '1 second' WHERE id=?",job.id());
      assertThatThrownBy(()->resultPublisher.publish(job,draft,true)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);noPublishedResult();
      evaluationJobs.recoverExpired();database.update("UPDATE evaluation_runs SET next_attempt_at=now() WHERE id=?",job.id());var next=evaluationJobs.claim().orElseThrow();
      assertThatThrownBy(()->resultPublisher.publish(job,draft,true)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);noPublishedResult();assertThat(resultPublisher.publish(next,draft,true).get("id").isTextual()).isTrue();
    }
    @Test void failedReportInsertRollsBackDimensionsEvidenceAndSession()throws Exception{
      var job=resultJob();var draft=resultDraft(job);addObservation(draft,job);
      database.execute("CREATE FUNCTION fail_report_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END; $$");
      database.execute("CREATE TRIGGER fail_report_test BEFORE INSERT ON feedback_reports FOR EACH ROW EXECUTE FUNCTION fail_report_for_test()");
      try{assertThatThrownBy(()->resultPublisher.publish(job,draft,true)).isInstanceOf(org.springframework.dao.DataAccessException.class);}
      finally{database.execute("DROP TRIGGER fail_report_test ON feedback_reports");database.execute("DROP FUNCTION fail_report_for_test()");}
      noPublishedResult();assertThat(evaluationJobs.find(job.id()).orElseThrow().status()).isEqualTo("RUNNING");assertThat(database.queryForObject("SELECT current_step FROM learning_sessions WHERE id=?",String.class,job.sessionId())).isEqualTo("CHALLENGE");
    }
    @Test void leaseExpiryDuringPublicationRollsBackAllRows()throws Exception{
      var job=resultJob();var draft=resultDraft(job);addObservation(draft,job);
      // Test-only DB trigger advances lease expiry after inserting result details, before final CAS.
      database.execute("CREATE FUNCTION expire_result_lease_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE evaluation_runs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=NEW.evaluation_run_id; RETURN NEW; END; $$");
      database.execute("CREATE TRIGGER expire_result_test AFTER INSERT ON feedback_reports FOR EACH ROW EXECUTE FUNCTION expire_result_lease_for_test()");
      try{assertThatThrownBy(()->resultPublisher.publish(job,draft,true)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);}
      finally{database.execute("DROP TRIGGER expire_result_test ON feedback_reports");database.execute("DROP FUNCTION expire_result_lease_for_test()");}
      noPublishedResult();assertThat(evaluationJobs.find(job.id()).orElseThrow().status()).isEqualTo("RUNNING");
    }

    @Test void reviewedStatementStillRequiresAnswerPolicyAndCorrectReviewReference()throws Exception{
      var job=resultJob();var snapshot=mapper.readTree(job.snapshot());var draft=resultDraft(job);
      var review=((com.fasterxml.jackson.databind.node.ArrayNode)snapshot.get("challenge").get("reviews")).addObject();String reviewId=UUID.randomUUID().toString();
      review.put("id",reviewId);review.put("statementId",draft.get("faultSummary").get("statements").get(0).get("statementId").asText());review.put("reasonText","User reasoning");review.putNull("replacementText");
      var fault=(com.fasterxml.jackson.databind.node.ObjectNode)draft.get("faultSummary").get("statements").get(0);fault.put("reviewId",reviewId);fault.put("detectionResult","REVIEW_REQUIRED");
      assertThat(resultValidator.validate(draft,snapshot)).isEqualTo(draft);
      fault.put("detectionResult","DETECTED");assertThatThrownBy(()->resultValidator.validate(draft,snapshot)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);
      fault.put("detectionResult","REVIEW_REQUIRED");fault.put("reviewId",UUID.randomUUID().toString());assertThatThrownBy(()->resultValidator.validate(draft,snapshot)).isInstanceOf(com.doezip.evaluation.service.InvalidEvaluationResult.class);
    }
    @Test void concurrentPublishersProduceExactlyOneReport()throws Exception{
      var job=resultJob();var draft=resultDraft(job);
      var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var gate=new java.util.concurrent.CountDownLatch(1);
      try{
        java.util.concurrent.Callable<Boolean> publish=()->{gate.await();try{resultPublisher.publish(job,draft,true);return true;}catch(com.doezip.evaluation.service.InvalidEvaluationResult rejected){return false;}};
        var first=pool.submit(publish);var second=pool.submit(publish);gate.countDown();assertThat(List.of(first.get(15,java.util.concurrent.TimeUnit.SECONDS),second.get(15,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
      }finally{pool.shutdownNow();}
      assertThat(database.queryForObject("SELECT count(*) FROM feedback_reports",Integer.class)).isEqualTo(1);assertThat(database.queryForObject("SELECT count(*) FROM dimension_evaluations",Integer.class)).isEqualTo(4);
    }

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean com.doezip.evaluation.adapter.EvaluationSettings aiSettings;
    @org.springframework.test.context.bean.override.mockito.MockitoBean com.doezip.evaluation.adapter.EvaluationAdapter aiAdapter;
    @Autowired com.doezip.evaluation.repository.EvaluationBudget aiBudget;
    com.doezip.evaluation.repository.EvaluationRepository.Job aiJob()throws Exception{
      org.mockito.Mockito.doReturn(true).when(aiSettings).available();
      var job=resultJob();
      database.update("UPDATE evaluation_runs SET status='QUEUED',lease_token=NULL,lease_expires_at=NULL,attempt_count=0 WHERE id=?",job.id());
      return evaluationJobs.find(job.id()).orElseThrow();
    }
    @Test void workerPublishesValidatedAdapterResultWithoutHoldingTransaction()throws Exception{
      var job=aiJob();var draft=resultDraft(job);addObservation(draft,job);
      org.mockito.Mockito.when(aiAdapter.evaluate(org.mockito.ArgumentMatchers.any())).thenAnswer(call->{
        assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();return draft;
      });
      evaluationWorker.tick();var completed=evaluationJobs.find(job.id()).orElseThrow();assertThat(completed.status()).isEqualTo("SUCCEEDED");
      var report=json(request("/api/v1/reports/"+completed.reportId(),HttpMethod.GET,alice,null));assertThat(report.get("sample").asBoolean()).isFalse();assertThat(report.get("summary").asText()).contains("Synthetic");
      var snapshot=mapper.readTree(completed.snapshot());assertThat(snapshot.path("evaluatorVersion").asText()).isEqualTo("gemini-evaluation-v1");assertThat(snapshot.path("llmConfig").path("model").asText()).isEqualTo("gemini-3.5-flash-lite");assertThat(snapshot.toString()).doesNotContain("apiKey");
      assertThat(database.queryForObject("SELECT sum(calls) FROM evaluation_call_budgets WHERE scope='global'",Integer.class)).isEqualTo(1);
    }
    @Test void invalidAiOutputRetriesAtMostThreeTimesAndLeavesNoPartialReport()throws Exception{
      var job=aiJob();org.mockito.Mockito.when(aiAdapter.evaluate(org.mockito.ArgumentMatchers.any())).thenReturn(mapper.createObjectNode().put("privateAnswer","not allowed"));
      for(int n=1;n<=3;n++){evaluationWorker.tick();var current=evaluationJobs.find(job.id()).orElseThrow();assertThat(current.attempts()).isEqualTo(n);assertThat(current.status()).isEqualTo(n<3?"QUEUED":"FAILED");noPublishedResult();database.update("UPDATE evaluation_runs SET next_attempt_at=now() WHERE id=?",job.id());}
      org.mockito.Mockito.verify(aiAdapter,org.mockito.Mockito.times(3)).evaluate(org.mockito.ArgumentMatchers.any());assertThat(evaluationJobs.find(job.id()).orElseThrow().retryable()).isTrue();
    }
    @Test void quotaReservationRollsBackGlobalIncrementAndPreventsProviderCall()throws Exception{
      var job=aiJob();org.mockito.Mockito.doReturn(1).when(aiSettings).dailyLimit();aiBudget.reserve(job.sessionId());
      evaluationWorker.tick();assertThat(evaluationJobs.find(job.id()).orElseThrow().error()).isEqualTo("EVALUATION_DAILY_LIMIT");org.mockito.Mockito.verifyNoInteractions(aiAdapter);noPublishedResult();assertThat(database.queryForObject("SELECT calls FROM evaluation_call_budgets WHERE scope='global'",Integer.class)).isEqualTo(1);
    }
    @Test void heartbeatOnlyRenewsCurrentUnexpiredClaim()throws Exception{
      var job=resultJob();assertThat(evaluationJobs.heartbeat(job)).isTrue();database.update("UPDATE evaluation_runs SET lease_expires_at=now()-interval '1 second' WHERE id=?",job.id());assertThat(evaluationJobs.heartbeat(job)).isFalse();
    }

    @Test void concurrentBudgetReservationsCannotExceedAccountLimit()throws Exception{
      var job=aiJob();org.mockito.Mockito.doReturn(1).when(aiSettings).dailyLimit();
      var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var gate=new java.util.concurrent.CountDownLatch(1);
      try{
        java.util.concurrent.Callable<Boolean> reserve=()->{gate.await();try{aiBudget.reserve(job.sessionId());return true;}catch(com.doezip.evaluation.adapter.EvaluationFailure limited){return false;}};
        var first=pool.submit(reserve);var second=pool.submit(reserve);gate.countDown();assertThat(List.of(first.get(15,java.util.concurrent.TimeUnit.SECONDS),second.get(15,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
      }finally{pool.shutdownNow();}
      assertThat(database.queryForObject("SELECT calls FROM evaluation_call_budgets WHERE scope='global'",Integer.class)).isEqualTo(1);
    }

    void enableChat(){when(chatSettings.available()).thenReturn(true);when(chatSettings.model()).thenReturn("test-provider");when(chatSettings.dailyLimit()).thenReturn(20);when(chatSettings.globalLimit()).thenReturn(100);}
    String chatBody(UUID key,String text,boolean include)throws Exception{return mapper.writeValueAsString(Map.of("clientMessageKey",key,"contentText",text,"includeCurrentDraft",include));}
    JsonNode chatMessages(String id)throws Exception{return json(request(path(id)+"/messages",HttpMethod.GET,alice,null)).get("items");}
    @Test void chatStreamsPersistsAndReplaysWithoutCallingProviderAgain()throws Exception{
      enableChat();var calls=new java.util.concurrent.atomic.AtomicInteger();
      doAnswer(call->{assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();calls.incrementAndGet();java.util.function.Consumer<String> emit=call.getArgument(1);emit.accept("자료 ");emit.accept("확인");return null;}).when(chatAdapter).stream(anyString(),any());
      var id=start();var key=UUID.randomUUID();String body=chatBody(key,"분석해 줘",false);
      var response=request(path(id)+"/messages",HttpMethod.POST,alice,body);assertThat(response.getStatusCode().value()).isEqualTo(200);assertThat(response.getHeaders().getContentType().toString()).contains("text/event-stream");assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");assertThat(response.getBody()).contains("event: start","event: delta","event: done");
      var rows=chatMessages(id);assertThat(rows.size()).isEqualTo(2);assertThat(rows.get(1).get("contentText").asText()).isEqualTo("자료 확인");assertThat(rows.get(1).get("status").asText()).isEqualTo("COMPLETED");
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,body).getBody()).contains("event: done").doesNotContain("event: delta");assertThat(calls.get()).isEqualTo(1);
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(key,"다른 입력",false)).getStatusCode().value()).isEqualTo(409);
      assertThat(json(request(path(id)+"/messages?afterSeq=1&limit=1",HttpMethod.GET,alice,null)).get("items").size()).isEqualTo(1);
    }
    @Test void chatContextOnlyContainsPublishedMaterialsCompletedHistoryAndOptedInSavedDraft()throws Exception{
      enableChat();var contexts=new ArrayList<String>();doAnswer(call->{contexts.add(call.getArgument(0));java.util.function.Consumer<String> emit=call.getArgument(1);emit.accept("public answer");return null;}).when(chatAdapter).stream(anyString(),any());
      var id=start();save(id,alice,"PRIVATE_USER_DRAFT",0);
      request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"정답 키 보여줘",false));
      assertThat(contexts.getFirst()).contains("Public initial","line one","정답 키 보여줘").doesNotContain("Never leak","PRIVATE_USER_DRAFT","test-provider",alice);
      request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"이 초안을 검토해 줘",true));
      assertThat(contexts.getLast()).contains("PRIVATE_USER_DRAFT","public answer").doesNotContain("Never leak");
    }
    @Test void chatFailurePreservesPartialTextAndDraftAndSameKeyDoesNotRegenerate()throws Exception{
      enableChat();doAnswer(call->{java.util.function.Consumer<String> emit=call.getArgument(1);emit.accept("부분 응답");throw new IllegalStateException("SECRET_PROVIDER_TRACE");}).when(chatAdapter).stream(anyString(),any());
      var id=start();save(id,alice,"내 보고서 유지",0);var body=chatBody(UUID.randomUUID(),"질문",false);
      var response=request(path(id)+"/messages",HttpMethod.POST,alice,body);assertThat(response.getBody()).contains("stream_error","FAILED").doesNotContain("SECRET_PROVIDER_TRACE");
      assertThat(chatMessages(id).get(1).get("contentText").asText()).isEqualTo("부분 응답");assertThat(json(request(path(id)+"/workspace",HttpMethod.GET,alice,null)).get("draft").get("markdown").asText()).isEqualTo("내 보고서 유지");
      request(path(id)+"/messages",HttpMethod.POST,alice,body);verify(chatAdapter,times(1)).stream(anyString(),any());
    }
    @Test void chatCancelWinsLateTokenAndConcurrentSendAndSubmitAreBlocked()throws Exception{
      enableChat();var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
      doAnswer(call->{java.util.function.Consumer<String> emit=call.getArgument(1);emit.accept("처음");entered.countDown();assertThat(release.await(8,TimeUnit.SECONDS)).isTrue();emit.accept("늦은 토큰");return null;}).when(chatAdapter).stream(anyString(),any());
      var id=start();var draft=json(save(id,alice,"보고서",0));var key=UUID.randomUUID();var executor=Executors.newSingleThreadExecutor();
      try{
       var future=executor.submit(()->request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(key,"질문",false)));assertThat(entered.await(8,TimeUnit.SECONDS)).isTrue();
       var row=chatMessages(id).get(1);var messageId=row.get("id").asText();
       var duplicate=request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(key,"질문",false));assertThat(json(duplicate).get("details").get("assistantMessageId").asText()).isEqualTo(messageId);
       assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"새 질문",false)).getStatusCode().value()).isEqualTo(409);
       assertThat(request(path(id)+"/document-versions",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("checkpoint","INITIAL","expectedDraftLockVersion",draft.get("lockVersion").asLong(),"expectedContentHash",draft.get("contentHash").asText()))).getStatusCode().value()).isEqualTo(409);
       assertThat(request(path(id)+"/messages/"+messageId+"/cancel",HttpMethod.POST,bob,"{}").getStatusCode().value()).isEqualTo(404);
       assertThat(json(request(path(id)+"/messages/"+messageId+"/cancel",HttpMethod.POST,alice,"{}")).get("status").asText()).isEqualTo("CANCELLED");release.countDown();future.get(8,TimeUnit.SECONDS);
       var restored=chatMessages(id).get(1);assertThat(restored.get("status").asText()).isEqualTo("CANCELLED");assertThat(restored.get("contentText").asText()).isEqualTo("처음");
      }finally{release.countDown();executor.shutdownNow();}
    }
    @Test void staleChatRecoversAfterServerRestartAndDeniesWrongOwnerAndInvalidStage()throws Exception{
      enableChat();var id=start();UUID owner=database.queryForObject("SELECT id FROM users WHERE auth_subject='alice'",UUID.class);
      var begun=chatService.begin(owner,UUID.fromString(id),new com.doezip.chat.dto.ChatDtos.Request(UUID.randomUUID(),"질문",false));
      database.update("UPDATE chat_messages SET created_at=now()-interval '91 seconds' WHERE id=?",begun.assistant().id());
      assertThat(chatMessages(id).get(1).get("status").asText()).isEqualTo("FAILED");
      assertThat(request(path(id)+"/messages",HttpMethod.GET,bob,null).getStatusCode().value()).isEqualTo(404);
      assertThat(request(path(id)+"/messages",HttpMethod.POST,bob,chatBody(UUID.randomUUID(),"질문",false)).getStatusCode().value()).isEqualTo(404);
      database.update("UPDATE learning_sessions SET current_step='CHALLENGE' WHERE id=?",UUID.fromString(id));
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"질문",false)).getStatusCode().value()).isEqualTo(409);
    }
    @Test void chatBudgetAndInputLimitsAreEnforcedBeforeProviderCall()throws Exception{
      enableChat();when(chatSettings.dailyLimit()).thenReturn(1);doAnswer(call->{java.util.function.Consumer<String> emit=call.getArgument(1);emit.accept("응답");return null;}).when(chatAdapter).stream(anyString(),any());var id=start();
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID()," ",false)).getStatusCode().value()).isEqualTo(400);
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"x".repeat(4001),false)).getStatusCode().value()).isEqualTo(400);
      request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"질문",false));
      assertThat(request(path(id)+"/messages",HttpMethod.POST,alice,chatBody(UUID.randomUUID(),"두 번째",false)).getStatusCode().value()).isEqualTo(429);verify(chatAdapter,times(1)).stream(anyString(),any());
    }

    @Test void chatErrorsBeforeStreamingRemainJsonEvenWithAnSseAcceptHeader()throws Exception{
      var id=start();var headers=new HttpHeaders();headers.setBearerAuth(alice);headers.setContentType(MediaType.APPLICATION_JSON);headers.setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
      var response=http.exchange(path(id)+"/messages",HttpMethod.POST,new HttpEntity<>(chatBody(UUID.randomUUID(),"질문",false),headers),String.class);
      assertThat(response.getStatusCode().value()).isEqualTo(503);assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_JSON);assertThat(json(response).get("code").asText()).isEqualTo("CHAT_NOT_CONFIGURED");
      var invalid=http.exchange(path(id)+"/messages",HttpMethod.POST,new HttpEntity<>("{}",headers),String.class);assertThat(invalid.getStatusCode().value()).isEqualTo(400);assertThat(invalid.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
    }

    @org.springframework.test.context.bean.override.mockito.MockitoBean com.doezip.learning.adapter.FlowFeedbackAi flowAi;
    @Autowired com.doezip.learning.service.FlowService flows;
    JsonNode newFlow(String kind,String mode)throws Exception {
      if(kind.equals("REPORT")){
       UUID tid=com.doezip.learning.service.FlowTasks.REPORT_V2_ID;
       database.update("INSERT INTO tasks(id,task_code,version_no,title,description_markdown,status) VALUES (?,'flow-test',2,'Scenario','Public','PUBLISHED') ON CONFLICT DO NOTHING",tid);
       for(int i=1;i<=3;i++){String content="confirmed source "+i+"\nunknown cause "+i;database.update("INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order) VALUES (?,?,?,?, 'LOG',?,?,'INITIAL',?) ON CONFLICT DO NOTHING",UUID.fromString("74444444-4444-4444-8444-00000000000"+i),tid,"flow-source-"+i,"Flow material "+i,content,com.doezip.session.service.SessionService.hash(content),i);}
      }
      var r=request("/api/v1/learning-flows",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("requestKey",UUID.randomUUID(),"kind",kind,"mode",mode)));
      assertThat(r.getStatusCode().value()).as(r.getBody()).isEqualTo(200);return json(r);
    }
    JsonNode flowNotes(JsonNode f)throws Exception {return json(request("/api/v1/learning-flows/"+f.path("id").asText()+"/notes",HttpMethod.PUT,alice,mapper.writeValueAsString(Map.of("version",f.path("version").asLong(),"notes",Map.of("explanation","I chose this with limits","verification","Not yet verified; need more evidence","citations",List.of())))));}
    JsonNode sealFlow(JsonNode f)throws Exception {
      String artifact="function addItem(items,item){return [...items,item];}";long version;
      if(f.path("kind").asText().equals("REPORT")){artifact="The cause remains unknown.";var saved=json(save(f.path("sessionId").asText(),alice,artifact,0));version=saved.path("lockVersion").asLong();}
      else {String cp="/api/v1/coding-workspaces/"+f.path("codingId").asText();var saved=json(request(cp,HttpMethod.PUT,alice,mapper.writeValueAsString(Map.of("code",artifact,"expectedVersion",0))));version=saved.path("version").asLong();request(cp+"/runs",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("version",version,"suite",saved.path("taskVersion").asText(),"results",List.of(Map.of("name","duplicate","passed",false,"detail","still duplicated")))));}
      f=flowNotes(f);var r=request("/api/v1/learning-flows/"+f.path("id").asText()+"/submit",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("version",f.path("version").asLong(),"artifactVersion",version,"artifactHash",com.doezip.session.service.SessionService.hash(artifact))));assertThat(r.getStatusCode().value()).as(r.getBody()).isEqualTo(200);return json(r);
    }
    @Test void learningFlowsPreserveLegacyAndSeparateModesWithStrictOwnership()throws Exception {
      for(String kind:List.of("REPORT","CODING"))for(String mode:List.of("TRAINING","SIMULATION")){
       var f=newFlow(kind,mode);String p="/api/v1/learning-flows/"+f.path("id").asText();
       assertThat(f.path("flowVersion").asText()).isEqualTo("learning-flow-v2");
       assertThat(request(p,HttpMethod.GET,bob,null).getStatusCode().value()).isEqualTo(404);
       assertThat(request(p+"/answers",HttpMethod.POST,alice,"{\"decision\":\"x\",\"change\":\"y\"}").getStatusCode().value()).isEqualTo(409);
       assertThat(request(p+"/hints",HttpMethod.POST,alice,"{\"index\":0}").getStatusCode().value()).isEqualTo(mode.equals("TRAINING")?200:409);
       var sealed=sealFlow(f);assertThat(sealed.path("stage").asText()).isEqualTo("EXPLAIN");assertThat(sealed.path("snapshot").path("records").size()).isGreaterThan(3);
       assertThat(request(p+"/feedback",HttpMethod.POST,alice,"{}").getStatusCode().value()).isEqualTo(409);
       assertThat(request(p+"/notes",HttpMethod.PUT,alice,"{\"version\":2,\"notes\":{\"explanation\":\"x\",\"verification\":\"x\",\"citations\":[]}}").getStatusCode().value()).isEqualTo(409);
       if(kind.equals("REPORT"))assertThat(save(f.path("sessionId").asText(),alice,"late",1).getStatusCode().value()).isEqualTo(409);
       assertThat(json(request(p+"/answers",HttpMethod.POST,alice,"{\"decision\":\"I cannot explain this yet\",\"change\":\"I need another test\"}")).path("stage").asText()).isEqualTo("FEEDBACK");
       assertThat(request(p+"/answers",HttpMethod.POST,alice,"{\"decision\":\"changed\",\"change\":\"changed\"}").getStatusCode().value()).isEqualTo(409);
       assertThat(request(p+"/feedback",HttpMethod.POST,alice,"{}").getStatusCode().value()).isEqualTo(503);
      }
    }
    @Test void learningContentV2UsesThreeSourcesAndTheVersionedCodingSuite()throws Exception {
      var report=newFlow("REPORT","TRAINING");
      UUID session=UUID.fromString(report.path("sessionId").asText());
      assertThat(database.queryForObject("SELECT task_id FROM learning_sessions WHERE id=?",UUID.class,session)).isEqualTo(com.doezip.learning.service.FlowTasks.REPORT_V2_ID);
      assertThat(database.queryForObject("SELECT count(*) FROM materials WHERE task_id=?",Integer.class,com.doezip.learning.service.FlowTasks.REPORT_V2_ID)).isEqualTo(3);
      assertThat(report.path("task").path("situation").asText()).contains("서로 다른 가능성");

      var coding=newFlow("CODING","TRAINING");String cp="/api/v1/coding-workspaces/"+coding.path("codingId").asText();
      var workspace=json(request(cp,HttpMethod.GET,alice,null));
      assertThat(workspace.path("taskVersion").asText()).isEqualTo("duplicate-items-v2");
      String wrong=mapper.writeValueAsString(Map.of("version",0,"suite","duplicate-items-v1","results",List.of(Map.of("name","legacy","passed",true,"detail","wrong suite"))));
      assertThat(request(cp+"/runs",HttpMethod.POST,alice,wrong).getStatusCode().value()).isEqualTo(400);
      assertThat(json(request("/api/v1/coding-workspaces/"+codingStart(alice),HttpMethod.GET,alice,null)).path("taskVersion").asText()).isEqualTo("duplicate-items-v1");
    }
    @Test void learningFlowRejectsStaleArtifactsAndForeignCitations()throws Exception {
      var f=newFlow("REPORT","TRAINING");String p="/api/v1/learning-flows/"+f.path("id").asText();String sid=f.path("sessionId").asText();
      var bad=request(p+"/notes",HttpMethod.PUT,alice,mapper.writeValueAsString(Map.of("version",0,"notes",Map.of("explanation","x","verification","x","citations",List.of(Map.of("materialId",hiddenId,"lineStart",1,"lineEnd",1))))));assertThat(bad.getStatusCode().value()).isEqualTo(404);
      var saved=json(save(sid,alice,"first",0));save(sid,alice,"second",1);f=flowNotes(f);
      var r=request(p+"/submit",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("version",f.path("version").asLong(),"artifactVersion",1,"artifactHash",saved.path("contentHash").asText())));assertThat(r.getStatusCode().value()).isEqualTo(409);assertThat(json(request(p,HttpMethod.GET,alice,null)).path("snapshot").isNull()).isTrue();
      assertThat(request(path(sid)+"/document-versions",HttpMethod.POST,alice,mapper.writeValueAsString(Map.of("checkpoint","INITIAL","expectedDraftLockVersion",2,"expectedContentHash",com.doezip.session.service.SessionService.hash("second")))).getStatusCode().value()).isEqualTo(409);
    }
    @Test void learningFeedbackUsesFrozenEvidenceAndCreatesSeparatePractice()throws Exception {
      var f=sealFlow(newFlow("CODING","TRAINING"));String p="/api/v1/learning-flows/"+f.path("id").asText();UUID id=UUID.fromString(f.path("id").asText());
      request(p+"/answers",HttpMethod.POST,alice,"{\"decision\":\"I checked the duplicate test\",\"change\":\"I would test updated titles\"}");
      doReturn(true).when(aiSettings).available();
      when(flowAi.evaluate(anyString(),any())).thenAnswer(call->{JsonNode input=call.getArgument(1);assertThat(input.path("records").toString()).contains("I checked the duplicate test").doesNotContain("Never leak");var result=mapper.createObjectNode().put("practiceArea","VERIFY");var items=result.putArray("items");for(String area:List.of("REQUEST","VERIFY","IMPROVE","EXPLAIN"))items.addObject().put("area",area).put("observation","This is a submitted record, not proof of ability").put("nextAction","Verify one claim").putArray("recordIds").add("artifact");return result;});
      assertThat(request(p+"/feedback",HttpMethod.POST,alice,"{}").getStatusCode().value()).isEqualTo(200);
      JsonNode completed=null;for(int i=0;i<100;i++){completed=json(request(p,HttpMethod.GET,alice,null));if(completed.path("feedbackStatus").asText().equals("SUCCEEDED"))break;Thread.sleep(25);}
      assertThat(completed.path("feedbackStatus").asText()).isEqualTo("SUCCEEDED");assertThat(completed.path("feedback").path("items").get(0).path("sources").get(0).path("text")).isEqualTo(f.path("snapshot").path("artifact"));
      var child=json(request(p+"/practice",HttpMethod.POST,alice,"{}"));assertThat(child.path("parentId").asText()).isEqualTo(id.toString());assertThat(child.path("codingId")).isNotEqualTo(f.path("codingId"));assertThat(child.path("stage").asText()).isEqualTo("WORKING");assertThat(json(request(p+"/practice",HttpMethod.POST,alice,"{}")).path("id")).isEqualTo(child.path("id"));
      assertThatThrownBy(()->database.update("UPDATE learning_flows SET snapshot='{}'::jsonb WHERE id=?",id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
      request(p+"/feedback",HttpMethod.POST,alice,"{}");verify(flowAi,times(1)).evaluate(anyString(),any());
    }
    @Test void learningFeedbackFailureAndExpiredLeaseDoNotPublishSuccess()throws Exception {
      var f=sealFlow(newFlow("REPORT","TRAINING"));UUID id=UUID.fromString(f.path("id").asText());UUID user=database.queryForObject("SELECT user_id FROM learning_flows WHERE id=?",UUID.class,id);flows.answer(user,id,new com.doezip.learning.dto.FlowDtos.Answers("reason","new condition"));doReturn(true).when(aiSettings).available();
      var r=flows.reserve(user,id);assertThatThrownBy(()->flows.reserve(user,id)).isInstanceOf(com.doezip.session.service.SessionFailure.class);
      database.update("UPDATE learning_flows SET feedback_started_at=now()-interval '2 minutes' WHERE id=?",id);assertThat(flows.get(user,id).feedbackStatus()).isEqualTo("FAILED");assertThat(flows.finish(user,id,r.token(),mapper.createObjectNode()).feedbackStatus()).isEqualTo("FAILED");
      when(flowAi.evaluate(anyString(),any())).thenThrow(new IllegalStateException("PRIVATE_PROVIDER_FAILURE"));request("/api/v1/learning-flows/"+id+"/feedback",HttpMethod.POST,alice,"{}");
      for(int i=0;i<100;i++){if(flows.get(user,id).feedbackStatus().equals("FAILED"))break;Thread.sleep(25);}assertThat(flows.get(user,id).feedbackStatus()).isEqualTo("FAILED");assertThat(flows.get(user,id).feedback().isNull()).isTrue();
    }
}
