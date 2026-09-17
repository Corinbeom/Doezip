package com.doezip.evaluation.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReportRepository {
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    public ReportRepository(JdbcTemplate db, ObjectMapper mapper) { this.db = db; this.mapper = mapper; }
    public Optional<JsonNode> owned(UUID id, UUID user) {
        return db.query("SELECT r.public_report_json::text FROM feedback_reports r JOIN evaluation_runs e ON e.id=r.evaluation_run_id JOIN learning_sessions s ON s.id=r.session_id WHERE r.id=? AND s.user_id=? AND e.status='SUCCEEDED'",
                (r, i) -> parse(r.getString(1)), id, user).stream().findFirst();
    }
    private JsonNode parse(String json) {
        try { return mapper.readTree(json); }
        catch (Exception e) { throw new IllegalStateException("Invalid stored report"); }
    }
}
