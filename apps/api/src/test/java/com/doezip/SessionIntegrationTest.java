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

@ActiveProfiles("test")
@Testcontainers
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
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
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate database;
    @Autowired JwtDecoder decoder;
    @Autowired CurrentUser currentUser;
    @BeforeEach void setup() throws Exception {
        database.update("DELETE FROM learning_sessions"); database.update("DELETE FROM materials");
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
      assertThat(workspace.get("session").get("allowedActions").toString()).isEqualTo("[\"READ_MATERIALS\",\"WRITE_DRAFT\"]");
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
      assertThat(request(path(id)+"/document-versions",HttpMethod.POST,alice,"{}").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
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
}
