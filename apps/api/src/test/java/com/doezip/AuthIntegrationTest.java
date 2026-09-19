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
import java.util.concurrent.atomic.*;
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
class AuthIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11");
    static final RSAKey rsa;
    static final ECKey ec;
    static final HttpServer jwks;
    static final String issuer;
    static final AtomicInteger deletionStatus = new AtomicInteger(200);
    static final AtomicInteger deletionCalls = new AtomicInteger();
    static final AtomicReference<String> deletionRequest = new AtomicReference<>();
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
            jwks.createContext("/auth/v1/admin/users/", exchange -> {
                deletionCalls.incrementAndGet();
                String request = exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath()
                    + "\nAuthorization: " + exchange.getRequestHeaders().getFirst("Authorization")
                    + "\napikey: " + exchange.getRequestHeaders().getFirst("apikey")
                    + "\n" + new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                deletionRequest.set(request);
                byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(deletionStatus.get(), body.length);
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
        registry.add("app.auth.admin-url", () -> issuer + "/auth/v1");
        registry.add("app.auth.secret-key", () -> "test-secret-key");
        registry.add("app.cors-allowed-origin", () -> "http://localhost:3000");
    }
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate database;
    @Autowired JwtDecoder decoder;
    @Autowired CurrentUser currentUser;
    @Autowired com.doezip.user.service.IdentityDeletionGateway identityDeletionGateway;
    @BeforeEach void clearUsers() {
        database.update("DELETE FROM users"); database.update("DELETE FROM account_deletion_blocks");
        deletionStatus.set(200); deletionCalls.set(0); deletionRequest.set(null);
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
    ResponseEntity<String> acceptLegal(String token, String body) { return request("/api/v1/me/legal-acceptance", HttpMethod.PUT, token, body); }
    ResponseEntity<String> deleteAccount(String token) { return request("/api/v1/me", HttpMethod.DELETE, token, null); }
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
    @Test void getDoesNotCreateAndBootstrapIsStableAndMinimal() throws Exception {
        String jwt = token("first", c -> {});
        assertError(request("/api/v1/me", HttpMethod.GET, jwt, null), HttpStatus.NOT_FOUND, "USER_NOT_FOUND");
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
        var first = bootstrap(jwt, "{}");
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getHeaders().getCacheControl()).isEqualTo("no-store");
        var user = json(first);
        assertThat(user.size()).isEqualTo(4);
        assertThat(user.get("displayName").asText()).isEqualTo("학습자 예시");
        assertThat(user.get("email").asText()).isEqualTo("learner@example.com");
        assertThat(user.get("legalAccepted").asBoolean()).isFalse();
        assertThat(json(bootstrap(jwt, "{\"displayName\":\"다른 이름\"}"))).isEqualTo(user);
        assertThat(json(request("/api/v1/me", HttpMethod.GET, jwt, null))).isEqualTo(user);
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(1);
    }
    @Test void adminDeletionFixtureAcceptsServerOnlyCredentials() {
        identityDeletionGateway.delete("direct-test",false);
        assertThat(deletionRequest.get()).contains("direct-test", "test-secret-key");
    }
    @Test void recordsCurrentLegalVersionsWithoutPretendingExistingUsersAccepted() throws Exception {
        String jwt=token("legal",c->{});bootstrap(jwt,"{}");
        assertThat(json(request("/api/v1/me",HttpMethod.GET,jwt,null)).get("legalAccepted").asBoolean()).isFalse();
        String current="{\"termsVersion\":\"2026-09-21\",\"privacyVersion\":\"2026-09-21\",\"aiNoticeVersion\":\"2026-09-21\"}";
        var accepted=acceptLegal(jwt,current);assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);assertThat(json(accepted).get("legalAccepted").asBoolean()).isTrue();
        assertThat(database.queryForObject("SELECT legal_accepted_at IS NOT NULL FROM users WHERE auth_subject='legal'",Boolean.class)).isTrue();
        assertError(acceptLegal(jwt,current.replace("2026-09-21","old-version")),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
        assertError(acceptLegal(jwt,current.substring(0,current.length()-1)+",\"accepted\":true}"),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
        assertError(acceptLegal(jwt,"{\"termsVersion\":20260921,\"privacyVersion\":\"2026-09-21\",\"aiNoticeVersion\":\"2026-09-21\"}"),HttpStatus.BAD_REQUEST,"INVALID_INPUT");
        assertThat(json(request("/api/v1/me",HttpMethod.GET,jwt,null)).get("legalAccepted").asBoolean()).isTrue();
    }
    @Test void concurrentBootstrapCreatesOneIdentity() throws Exception {
        String jwt = token("concurrent", c -> {});
        try (var executor = Executors.newFixedThreadPool(8)) {
            List<Callable<ResponseEntity<String>>> tasks = new ArrayList<>();
            for (int i=0;i<8;i++) tasks.add(() -> bootstrap(jwt, "{}"));
            Set<String> ids = new HashSet<>();
            for (var future : executor.invokeAll(tasks)) {
                var result = future.get(20, TimeUnit.SECONDS);
                assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK); ids.add(json(result).get("id").asText());
            }
            assertThat(ids).hasSize(1);
        }
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(1);
    }
    @Test void usersSharingEmailStaySeparateAndOwnershipUsesServerIdentity() throws Exception {
        String alice = token("alice", c -> {}), bob = token("bob", c -> {});
        UUID aliceId = UUID.fromString(json(bootstrap(alice, "{}")).get("id").asText());
        UUID bobId = UUID.fromString(json(bootstrap(bob, "{}")).get("id").asText());
        assertThat(aliceId).isNotEqualTo(bobId);
        assertThat(json(request("/api/v1/me", HttpMethod.GET, alice, null)).get("id").asText()).isEqualTo(aliceId.toString());
        var authentication = new JwtAuthenticationToken(decoder.decode(alice), List.of());
        currentUser.requireOwner(authentication, aliceId);
        assertThatThrownBy(() -> currentUser.requireOwner(authentication, bobId)).isInstanceOf(UserNotFoundException.class);
        assertThatThrownBy(() -> currentUser.id(null)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
    }
    @Test void profileInputIsBoundedAndInvalidOptionalClaimsNeverLeak() throws Exception {
        String jwt = token("input", c -> c.claim("email", "not-email").claim("user_metadata", Map.of("full_name", "x".repeat(81))));
        for (String body : List.of("{\"displayName\":\"\"}", "{\"displayName\":\"   \"}",
                "{\"displayName\":\"" + "x".repeat(81) + "\"}", "{\"id\":\"forged\"}", "{\"displayName\":123}", "{\"displayName\":null}", "null")) {
            assertError(bootstrap(jwt, body), HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        }
        var result = json(bootstrap(jwt, "{}"));
        assertThat(result.get("displayName").asText()).isEqualTo("학습자"); assertThat(result.get("email").isNull()).isTrue();
        String emoji = "😀".repeat(80);
        assertThat(json(bootstrap(token("unicode", c -> {}), mapper.writeValueAsString(Map.of("displayName", emoji)))).get("displayName").asText()).isEqualTo(emoji);
    }
    @Test void rejectsInvalidClaimsSignaturesAndAlgorithmsWithSafe401() throws Exception {
        List<Consumer<JWTClaimsSet.Builder>> changes = List.of(
            c -> c.issuer("https://other.invalid"), c -> c.audience("other"), c -> c.audience((List<String>)null),
            c -> c.expirationTime(Date.from(Instant.now().minusSeconds(120))), c -> c.expirationTime(null),
            c -> c.notBeforeTime(Date.from(Instant.now().plusSeconds(120))), c -> c.subject(""), c -> c.subject(null),
            c -> c.subject("x".repeat(256)), c -> c.claim("role", "service_role"), c -> c.claim("role", null),
            c -> c.claim("role", 42), c -> c.claim("sub", 42), c -> c.claim("aud", 42),
            c -> c.claim("is_anonymous", true), c -> c.claim("is_anonymous", "false"));
        for (int i=0; i<changes.size(); i++) {
            var response = bootstrap(token("bad", changes.get(i)), "{}");
            assertThat(response.getStatusCode()).as("invalid claim case %s", i).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertError(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        }
        RSAKey wrong = new RSAKeyGenerator(2048).keyID(rsa.getKeyID()).generate();
        assertError(bootstrap(signed("bad", c -> {}, wrong, JWSAlgorithm.RS256), "{}"), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertError(bootstrap(signed("bad", c -> {}, rsa, JWSAlgorithm.RS512), "{}"), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertError(bootstrap("not-a-token", "{}"), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertError(bootstrap(null, "{}"), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
    }
    @Test void acceptsEs256AndStillDeniesUnimplementedRoutes() throws Exception {
        String jwt = signed("elliptic", c -> {}, ec, JWSAlgorithm.ES256);
        assertThat(bootstrap(jwt, "{}").getStatusCode()).isEqualTo(HttpStatus.OK);
        for (String path : List.of("/api/v1/learning-sessions", "/actuator/env", "/api/v1/me/other"))
            assertError(request(path, HttpMethod.GET, jwt, null), HttpStatus.FORBIDDEN, "FORBIDDEN");
        assertError(request("/api/v1/tasks", HttpMethod.POST, jwt, "{}"), HttpStatus.FORBIDDEN, "FORBIDDEN");
    }
    @Test void corsAllowsOnlyConfiguredOriginAndMeMethods() {
        HttpHeaders headers = new HttpHeaders(); headers.setOrigin("http://localhost:3000");
        headers.setAccessControlRequestMethod(HttpMethod.POST); headers.setAccessControlRequestHeaders(List.of("authorization", "content-type"));
        var allowed = http.exchange("/api/v1/me/bootstrap", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
        assertThat(allowed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(allowed.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:3000");
        headers.setAccessControlRequestMethod(HttpMethod.PUT);
        assertThat(http.exchange("/api/v1/me/legal-acceptance",HttpMethod.OPTIONS,new HttpEntity<>(headers),String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(http.exchange("/api/v1/tasks", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(http.exchange("/api/v1/me", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        headers.setAccessControlRequestMethod(HttpMethod.DELETE);
        assertThat(http.exchange("/api/v1/me", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        headers.setOrigin("https://attacker.invalid");
        assertThat(http.exchange("/api/v1/me/bootstrap", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test void deletesIdentityAndAllOwnedLearningDataButKeepsSharedContent() throws Exception {
        String alice = token("delete-report", c -> {}), bob = token("keep-user", c -> {});
        UUID aliceId = UUID.fromString(json(bootstrap(alice, "{}")).get("id").asText());
        UUID bobId = UUID.fromString(json(bootstrap(bob, "{}")).get("id").asText());
        UUID task=UUID.randomUUID(), rubric=UUID.randomUUID(), material=UUID.randomUUID(), template=UUID.randomUUID(), statement=UUID.randomUUID();
        UUID session=UUID.randomUUID(), document=UUID.randomUUID(), challenge=UUID.randomUUID(), fault=UUID.randomUUID(), link=UUID.randomUUID();
        UUID evaluation=UUID.randomUUID(), dimension=UUID.randomUUID(), evidence=UUID.randomUUID(), report=UUID.randomUUID(), message=UUID.randomUUID(), flow=UUID.randomUUID(), event=UUID.randomUUID();
        database.update("INSERT INTO tasks(id,task_code,title,description_markdown) VALUES (?,?,?,?)",task,"delete-fixture-"+task,"공유 과제","설명");
        database.update("INSERT INTO rubric_dimensions(id,task_id,code,area,title,public_description,criteria_json) VALUES (?,?,?,?,?,?,?::jsonb)",rubric,task,"evidence","EVIDENCE","근거","설명","{}");
        database.update("INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash) VALUES (?,?,?,?,?,?,?)",material,task,"log","로그","LOG","한 줄","a".repeat(64));
        database.update("INSERT INTO challenge_templates(id,task_id,variant_code,title,instructions_markdown,content_hash) VALUES (?,?,?,?,?,?)",template,task,"v1","검산","안내","b".repeat(64));
        database.update("INSERT INTO challenge_statements(id,challenge_template_id,statement_key,sort_order,content_text) VALUES (?,?,?,?,?)",statement,template,"s1",1,"주장");
        database.update("INSERT INTO learning_sessions(id,user_id,task_id) VALUES (?,?,?)",session,aliceId,task);
        database.update("INSERT INTO document_versions(id,session_id,version_no,checkpoint,content_markdown,content_hash,source_draft_lock_version,sealed_at) VALUES (?,?,?,?,?,?,?,now())",document,session,1,"INITIAL","보고서","c".repeat(64),0);
        database.update("INSERT INTO challenge_runs(id,session_id,task_id,challenge_template_id,notice_version,notice_acknowledged_at,status,submitted_at) VALUES (?,?,?,?,?,now(),'SUBMITTED',now())",challenge,session,task,template,"v1");
        database.update("INSERT INTO fault_attempts(id,challenge_run_id,challenge_template_id,statement_id,decision,reason_text) VALUES (?,?,?,?,?,?)",fault,challenge,template,statement,"KEEP","원문 확인");
        database.update("INSERT INTO evidence_links(id,fault_attempt_id,material_id,line_start,line_end,quoted_text,relation,origin,review_status) VALUES (?,?,?,?,?,?,?,?,?)",link,fault,material,1,1,"한 줄","SUPPORTS","USER","ACCEPTED");
        database.update("INSERT INTO evaluation_runs(id,session_id,task_id,document_version_id,challenge_run_id,phase,status,idempotency_key,input_snapshot_json,input_fingerprint,evaluator_version,llm_config_json) VALUES (?,?,?,?,?,?,'SUCCEEDED',?,?::jsonb,?,?,?::jsonb)",evaluation,session,task,document,challenge,"INITIAL",UUID.randomUUID(),"{}","d".repeat(64),"test","{}");
        database.update("INSERT INTO dimension_evaluations(id,evaluation_run_id,task_id,rubric_dimension_id,evidence_state,rationale) VALUES (?,?,?,?,?,?)",dimension,evaluation,task,rubric,"SUFFICIENT","근거 있음");
        database.update("INSERT INTO evaluation_evidence(id,dimension_evaluation_id,document_version_id,evidence_kind,polarity,method,explanation) VALUES (?,?,?,?,?,?,?)",evidence,dimension,document,"REPORT","SUPPORT","RULE","연결");
        database.update("INSERT INTO feedback_reports(id,session_id,evaluation_run_id,summary,strengths_json,improvements_json,fault_summary_json,public_report_json) VALUES (?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb)",report,session,evaluation,"요약","[]","[]","[]","{}");
        database.update("INSERT INTO chat_messages(id,session_id,seq_no,role,content_text,status,client_message_key,completed_at) VALUES (?,?,1,'USER',?,'COMPLETED',?,now())",message,session,"질문",UUID.randomUUID());
        database.update("INSERT INTO learning_flows(id,user_id,request_key,task_kind,mode,session_id,task_catalog_id) VALUES (?,?,?,'REPORT','TRAINING',?,?)",flow,aliceId,UUID.randomUUID(),session,"delete-fixture");
        database.update("INSERT INTO learning_flow_events(id,flow_id,kind,body) VALUES (?,?,?,?::jsonb)",event,flow,"START","{}");

        ResponseEntity<String> deleted=deleteAccount(alice);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(deleted.getHeaders().getCacheControl()).contains("no-store");
        assertThat(deletionCalls.get()).isEqualTo(1);
        assertThat(deletionRequest.get()).contains("DELETE /auth/v1/admin/users/delete-report","Authorization: Bearer test-secret-key","apikey: test-secret-key","\"should_soft_delete\":false");
        for(String table:List.of("learning_sessions","document_versions","challenge_runs","fault_attempts","evidence_links","evaluation_runs","dimension_evaluations","evaluation_evidence","feedback_reports","chat_messages","learning_flows","learning_flow_events"))
            assertThat(database.queryForObject("SELECT count(*) FROM "+table,Integer.class)).as(table).isZero();
        assertThat(database.queryForObject("SELECT count(*) FROM users WHERE id=?",Integer.class,aliceId)).isZero();
        assertThat(database.queryForObject("SELECT count(*) FROM users WHERE id=?",Integer.class,bobId)).isOne();
        for(String table:List.of("tasks","rubric_dimensions","materials","challenge_templates","challenge_statements"))
            assertThat(database.queryForObject("SELECT count(*) FROM "+table,Integer.class)).as(table).isOne();
        assertError(bootstrap(alice,"{}"),HttpStatus.GONE,"ACCOUNT_DELETED");
        assertThat(json(request("/api/v1/me",HttpMethod.GET,bob,null)).get("id").asText()).isEqualTo(bobId.toString());
    }

    @Test void providerFailureKeepsLocalAccountAndAllowsRetry() throws Exception {
        String jwt=token("delete-retry",c->{});UUID id=UUID.fromString(json(bootstrap(jwt,"{}")).get("id").asText());
        database.update("INSERT INTO coding_workspaces(id,user_id,task_version,code) VALUES (?,?,?,?)",UUID.randomUUID(),id,"duplicate-items-v1","return true");
        deletionStatus.set(500);
        assertError(deleteAccount(jwt),HttpStatus.SERVICE_UNAVAILABLE,"ACCOUNT_DELETION_UNAVAILABLE");
        assertThat(database.queryForObject("SELECT deletion_requested_at IS NULL FROM users WHERE id=?",Boolean.class,id)).isTrue();
        assertThat(database.queryForObject("SELECT count(*) FROM coding_workspaces WHERE user_id=?",Integer.class,id)).isOne();
        deletionStatus.set(200);
        assertThat(deleteAccount(jwt).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(database.queryForObject("SELECT count(*) FROM users WHERE id=?",Integer.class,id)).isZero();
    }
    @Test void onlyAnInterruptedPendingDeletionTreatsMissingProviderIdentityAsSuccess() throws Exception {
        String fresh=token("missing-fresh",c->{});UUID freshId=UUID.fromString(json(bootstrap(fresh,"{}")).get("id").asText());
        deletionStatus.set(404);assertError(deleteAccount(fresh),HttpStatus.SERVICE_UNAVAILABLE,"ACCOUNT_DELETION_UNAVAILABLE");
        assertThat(database.queryForObject("SELECT count(*) FROM users WHERE id=?",Integer.class,freshId)).isOne();
        String recovery=token("missing-recovery",c->{});UUID recoveryId=UUID.fromString(json(bootstrap(recovery,"{}")).get("id").asText());
        database.update("UPDATE users SET deletion_requested_at=now() WHERE id=?",recoveryId);
        assertThat(deleteAccount(recovery).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(database.queryForObject("SELECT count(*) FROM users WHERE id=?",Integer.class,recoveryId)).isZero();
    }
}
