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
class AuthIntegrationTest {
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
    @BeforeEach void clearUsers() { database.update("DELETE FROM users"); }

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
    @Test void getDoesNotCreateAndBootstrapIsStableAndMinimal() throws Exception {
        String jwt = token("first", c -> {});
        assertError(request("/api/v1/me", HttpMethod.GET, jwt, null), HttpStatus.NOT_FOUND, "USER_NOT_FOUND");
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
        var first = bootstrap(jwt, "{}");
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getHeaders().getCacheControl()).isEqualTo("no-store");
        var user = json(first);
        assertThat(user.size()).isEqualTo(3);
        assertThat(user.get("displayName").asText()).isEqualTo("학습자 예시");
        assertThat(user.get("email").asText()).isEqualTo("learner@example.com");
        assertThat(json(bootstrap(jwt, "{\"displayName\":\"다른 이름\"}"))).isEqualTo(user);
        assertThat(json(request("/api/v1/me", HttpMethod.GET, jwt, null))).isEqualTo(user);
        assertThat(database.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(1);
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
        assertThat(http.exchange("/api/v1/tasks", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(http.exchange("/api/v1/me", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        headers.setOrigin("https://attacker.invalid");
        assertThat(http.exchange("/api/v1/me/bootstrap", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
