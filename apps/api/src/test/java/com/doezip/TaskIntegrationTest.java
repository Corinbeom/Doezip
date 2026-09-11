package com.doezip;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@ActiveProfiles("local")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TaskIntegrationTest {
    static final String SAMPLE = "61111111-1111-4111-8111-111111111113";
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.cors-allowed-origin", () -> "http://localhost:3000");
    }
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired org.flywaydb.core.Flyway flyway;

    @Test void migrationReapplyDoesNotDuplicateSeedAndConstraintsHold() {
        flyway.migrate();
        assertThat(jdbc.queryForObject("select status from tasks where id='61111111-1111-4111-8111-111111111111'", String.class)).isEqualTo("ARCHIVED");
        assertThat(jdbc.queryForObject("select description_markdown from tasks where id='61111111-1111-4111-8111-111111111111'", String.class)).contains("현재는 조회만 가능");
        assertThat(jdbc.queryForObject("select version_no from tasks where id=?::uuid", Integer.class, SAMPLE)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from tasks", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from rubric_dimensions", Integer.class)).isEqualTo(24);
        assertThat(jdbc.queryForObject("select count(*) from materials", Integer.class)).isEqualTo(3);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
            "insert into tasks (id, task_code, title, description_markdown, version_no) values (?, 'invalid', 'test', 'test', 0)",
            UUID.randomUUID())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
            "insert into tasks (id, task_code, title, description_markdown) values (?, 'browse-demo', 'test', 'test')",
            UUID.randomUUID())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
            "insert into rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json) values (?, ?, 'test', 'PROMPT', 'test', 'test', '{}'::jsonb)",
            UUID.randomUUID(), UUID.randomUUID())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test void readsDatabaseSampleWithOnlyPublicFields() throws Exception {
        jdbc.update("update rubric_dimensions set criteria_json = ?::jsonb where task_id = ?::uuid",
            "{\"privateAnswer\":\"SECRET_TEST_SENTINEL\"}", SAMPLE);
        var list = http.getForEntity("/api/v1/tasks", String.class);
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        var items = mapper.readTree(list.getBody()).get("items");
        assertThat(items.size()).isEqualTo(1);
        var response = http.getForEntity("/api/v1/tasks/" + SAMPLE, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var task = mapper.readTree(response.getBody());
        assertThat(task).isEqualTo(items.get(0));
        Set<String> fields = new HashSet<>(); task.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("id", "taskCode", "versionNo", "title", "descriptionMarkdown", "status", "rubrics");
        assertThat(task.get("taskCode").asText()).isEqualTo("browse-demo");
        assertThat(task.get("rubrics").size()).isEqualTo(8);
        assertThat(task.get("rubrics").get(0).get("code").asText()).isEqualTo("prompt.context");
        for (var rubric : task.get("rubrics")) {
            fields.clear(); rubric.fieldNames().forEachRemaining(fields::add);
            assertThat(fields).containsExactlyInAnyOrder("code", "area", "title", "description");
        }
        assertThat(response.getBody()).doesNotContain("SECRET_TEST_SENTINEL", "criteria", "materials", "groundTruth");
    }
    @Test void draftIsHiddenAndArchivedIsDetailOnly() throws Exception {
        UUID draft = UUID.randomUUID(), archived = UUID.randomUUID();
        try {
            insertTask(draft, "DRAFT"); insertTask(archived, "ARCHIVED");
            var body = http.getForObject("/api/v1/tasks", String.class);
            assertThat(body).doesNotContain(draft.toString(), archived.toString());
            assertThat(http.getForEntity("/api/v1/tasks/" + draft, String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            var archivedResponse = http.getForEntity("/api/v1/tasks/" + archived, String.class);
            assertThat(archivedResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(mapper.readTree(archivedResponse.getBody()).get("status").asText()).isEqualTo("ARCHIVED");
        } finally { jdbc.update("delete from tasks where id in (?, ?)", draft, archived); }
    }
    private void insertTask(UUID id, String status) {
        jdbc.update("insert into tasks (id, task_code, title, description_markdown, status) values (?, ?, ?, ?, ?)",
            id, id.toString(), "test task", "test description", status);
    }
    @Test void missingAndMalformedIdsReturnContractErrors() throws Exception {
        for (var entry : Map.of("not-a-uuid", HttpStatus.BAD_REQUEST, UUID.randomUUID().toString(), HttpStatus.NOT_FOUND).entrySet()) {
            var response = http.getForEntity("/api/v1/tasks/" + entry.getKey(), String.class);
            assertThat(response.getStatusCode()).isEqualTo(entry.getValue());
            var error = mapper.readTree(response.getBody());
            assertThat(error.size()).isEqualTo(3);
            assertThat(error.get("code").asText()).isEqualTo(entry.getValue() == HttpStatus.BAD_REQUEST ? "INVALID_INPUT" : "TASK_NOT_FOUND");
            assertThat(error.get("requestId").asText()).isEqualTo(response.getHeaders().getFirst("X-Request-Id"));
        }
    }
    @Test void onlyReadPathsArePublicAndCorsIsLocal() {
        for (var path : List.of("/api/v1/tasks/" + SAMPLE + "/materials", "/api/v1/me", "/api/v1/sessions")) {
            assertThat(http.getForEntity(path, String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
        assertThat(http.postForEntity("/api/v1/tasks", null, String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        for (var path : List.of("/api/v1/tasks", "/api/v1/tasks/" + SAMPLE)) {
            for (var origin : List.of("http://localhost:3000", "https://example.invalid")) {
                HttpHeaders headers = new HttpHeaders(); headers.setOrigin(origin);
                headers.setAccessControlRequestMethod(HttpMethod.GET);
                var response = http.exchange(path, HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
                assertThat(response.getStatusCode()).isEqualTo(origin.startsWith("http://localhost") ? HttpStatus.OK : HttpStatus.FORBIDDEN);
            }
        }
    }
}
