package com.doezip.evaluation.repository;

import com.doezip.evaluation.repository.EvaluationRepository.Job;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL for publishing a validated result; called inside the publisher's transaction. */
@Repository
public class ResultRepository {
    private final JdbcTemplate db;
    public ResultRepository(JdbcTemplate db) { this.db = db; }
    public UUID owner(UUID session) {
        return db.queryForObject("SELECT user_id FROM learning_sessions WHERE id=?", UUID.class, session);
    }
    public boolean lockClaim(Job job) {
        return !db.queryForList("SELECT id FROM evaluation_runs WHERE id=? AND session_id=? AND document_version_id=? AND phase='INITIAL' AND status='RUNNING' AND lease_token=? AND lease_expires_at>clock_timestamp() FOR UPDATE",
                job.id(), job.sessionId(), job.documentId(), job.lease()).isEmpty();
    }
    public void storeDimensions(UUID evaluation, UUID task, JsonNode areas) {
        for (var area : areas) for (var dimension : area.get("dimensions")) {
            UUID rubric = db.queryForObject("SELECT id FROM rubric_dimensions WHERE task_id=? AND code=?", UUID.class, task, dimension.get("code").asText());
            UUID id = UUID.randomUUID();
            db.update("INSERT INTO dimension_evaluations(id,evaluation_run_id,task_id,rubric_dimension_id,evidence_state,rationale,gap_text,next_action,confidence_level) VALUES (?,?,?,?,?,?,?,?,?)",
                    id, evaluation, task, rubric, dimension.get("state").asText(), dimension.get("rationale").asText(), nullable(dimension.get("gap")), nullable(dimension.get("nextAction")), nullable(dimension.get("confidenceLevel")));
            for (var e : dimension.get("evidence")) {
                UUID subject = UUID.fromString(e.get("subjectId").asText());
                boolean fault = e.get("subjectType").asText().equals("FAULT_ATTEMPT");
                db.update("INSERT INTO evaluation_evidence(id,dimension_evaluation_id,fault_attempt_id,document_version_id,evidence_kind,polarity,method,observed_excerpt,explanation,source_json) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb)",
                        UUID.fromString(e.get("id").asText()), id, fault ? subject : null, fault ? null : subject, e.get("kind").asText(), e.get("polarity").asText(), e.get("method").asText(), nullable(e.get("excerpt")), e.get("explanation").asText(), e.get("source").isNull() ? null : e.get("source").toString());
            }
        }
    }
    public void storeReport(JsonNode report) {
        db.update("INSERT INTO feedback_reports(id,session_id,evaluation_run_id,summary,strengths_json,improvements_json,fault_summary_json,next_practice_text,sample,public_report_json,created_at) VALUES (?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,?,?::jsonb,?)",
                UUID.fromString(report.get("id").asText()), UUID.fromString(report.get("sessionId").asText()), UUID.fromString(report.get("evaluationId").asText()), report.get("summary").asText(), report.get("strengths").toString(), report.get("improvements").toString(), report.get("faultSummary").toString(), nullable(report.get("nextPracticeText")), report.get("sample").asBoolean(), report.toString(), Timestamp.from(Instant.parse(report.get("createdAt").asText())));
    }
    public boolean complete(Job job) {
        return db.update("UPDATE evaluation_runs SET status='SUCCEEDED',error_code=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE id=? AND status='RUNNING' AND lease_token=? AND lease_expires_at>clock_timestamp()", job.id(), job.lease()) == 1;
    }
    private String nullable(JsonNode n) { return n.isNull() ? null : n.asText(); }
}
