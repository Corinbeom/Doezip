package com.doezip;

import com.doezip.session.entity.DocumentVersion;
import com.doezip.session.entity.LearningSession;
import java.sql.DriverManager;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class DocumentPrecisionIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11");
    @Test void initialResponseTimestampsEqualPostgresRoundTripEvenWithNanosecondClock() throws Exception {
        var session = new LearningSession(UUID.randomUUID(), UUID.randomUUID());
        // Linux clocks may return nanos; macOS clock precision hid this response/replay mismatch.
        var document = new DocumentVersion(session, "0".repeat(64), Instant.parse("2026-09-11T06:55:58.730609683Z"));
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var query = connection.prepareStatement("SELECT ?::timestamptz, ?::timestamptz")) {
            query.setObject(1, document.getSealedAt().atOffset(ZoneOffset.UTC));
            query.setObject(2, document.getCreatedAt().atOffset(ZoneOffset.UTC));
            try (var row = query.executeQuery()) {
                assertThat(row.next()).isTrue();
                assertThat(row.getObject(1, OffsetDateTime.class).toInstant()).isEqualTo(document.getSealedAt());
                assertThat(row.getObject(2, OffsetDateTime.class).toInstant()).isEqualTo(document.getCreatedAt());
            }
        }
    }
}
