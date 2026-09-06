package com.doezip;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariDataSource;
import java.time.Duration;
import javax.sql.DataSource;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EnvironmentIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("app.cors-allowed-origin", () -> "http://localhost:3000");
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired TestRestTemplate http;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper mapper;

    @Test @Order(1) void connectsToPostgresWithoutInventingDomainTables() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            try (var rows = statement.executeQuery("select count(*) from information_schema.tables where table_schema='public' and table_name <> 'flyway_schema_history'")) {
                rows.next(); assertThat(rows.getInt(1)).isZero();
            }
        }
    }
    @Test @Order(2) void publicHealthShowsOnlyStatus() throws Exception {
        var response = http.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(response.getBody())).isEqualTo(mapper.readTree("{\"status\":\"UP\"}"));
    }
    @Test @Order(3) void protectsEveryOtherPathAndHealthWrites() throws Exception {
        for (String path : new String[]{"/api/v1/tasks", "/api/v1/me", "/actuator/env", "/actuator/health/db", "/"}) {
            var response = http.getForEntity(path, String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            var body = mapper.readTree(response.getBody());
            assertThat(body.size()).isEqualTo(3);
            assertThat(body.get("code").asText()).isEqualTo("UNAUTHORIZED");
            assertThat(body.get("requestId").asText()).isEqualTo(response.getHeaders().getFirst("X-Request-Id"));
        }
        var response = http.postForEntity("/actuator/health", null, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(mapper.readTree(response.getBody()).get("code").asText()).isEqualTo("FORBIDDEN");
    }
    @Test @Order(4) void limitsCorsToLocalWebHealthGet() {
        HttpHeaders allowed = new HttpHeaders(); allowed.setOrigin("http://localhost:3000");
        allowed.setAccessControlRequestMethod(HttpMethod.GET);
        var response = http.exchange("/actuator/health", HttpMethod.OPTIONS, new HttpEntity<>(allowed), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:3000");
        HttpHeaders denied = new HttpHeaders(); denied.setOrigin("https://example.invalid");
        denied.setAccessControlRequestMethod(HttpMethod.GET);
        var blocked = http.exchange("/actuator/health", HttpMethod.OPTIONS, new HttpEntity<>(denied), String.class);
        assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(blocked.getHeaders().getAccessControlAllowOrigin()).isNull();
    }
    @Test @Order(99) void actualDatabaseOutageChangesHealthTo503WithoutDetails() {
        postgres.stop();
        ((HikariDataSource) dataSource).getHikariPoolMXBean().softEvictConnections();
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            var response = http.getForEntity("/actuator/health", String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(mapper.readTree(response.getBody())).isEqualTo(mapper.readTree("{\"status\":\"DOWN\"}"));
        });
    }
}
