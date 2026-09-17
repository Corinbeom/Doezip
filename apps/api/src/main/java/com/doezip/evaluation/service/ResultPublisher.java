package com.doezip.evaluation.service;

import com.doezip.evaluation.repository.EvaluationRepository;
import com.doezip.evaluation.repository.EvaluationRepository.Job;
import com.doezip.evaluation.repository.ResultRepository;
import com.doezip.session.repository.SessionRepository;
import com.doezip.session.service.SessionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResultPublisher {
    private final ResultRepository results;
    private final EvaluationRepository jobs;
    private final SessionRepository sessions;
    private final ResultValidator validator;
    private final ObjectMapper mapper;
    public ResultPublisher(ResultRepository results, EvaluationRepository jobs, SessionRepository sessions, ResultValidator validator, ObjectMapper mapper) {
        this.results = results; this.jobs = jobs; this.sessions = sessions; this.validator = validator; this.mapper = mapper;
    }
    // Internal worker entry only. No HTTP publication or test-success toggle exists.
    @Transactional
    public JsonNode publish(Job claim, JsonNode candidate, boolean sample) {
        var session = sessions.lockOwned(claim.sessionId(), results.owner(claim.sessionId())).orElseThrow(InvalidEvaluationResult::new);
        if (!session.getStatus().equals("ACTIVE") || !Set.of("CHALLENGE", "FEEDBACK").contains(session.getCurrentStep()) || !results.lockClaim(claim)) throw new InvalidEvaluationResult();
        // Read frozen inputs from the locked database row, never from a caller's Job copy.
        var job = jobs.find(claim.id()).orElseThrow(InvalidEvaluationResult::new);
        JsonNode snapshot;
        try { snapshot = mapper.readTree(job.snapshot()); }
        catch (Exception e) { throw new InvalidEvaluationResult(); }
        if (!SessionService.hash(EvaluationService.canonical(snapshot)).equals(job.fingerprint())) throw new InvalidEvaluationResult();
        ObjectNode report = (ObjectNode) validator.validate(candidate, snapshot);
        results.storeDimensions(job.id(), session.getTaskId(), report.get("areas"));
        report.put("id", UUID.randomUUID().toString());
        report.put("sessionId", job.sessionId().toString());
        report.put("evaluationId", job.id().toString());
        report.put("phase", "INITIAL");
        report.put("documentVersionId", job.documentId().toString());
        report.put("sample", sample);
        report.putNull("comparison");
        report.put("createdAt", Instant.now().truncatedTo(ChronoUnit.MICROS).toString());
        results.storeReport(report);
        // Recheck real wall time after all inserts; an expired worker rolls everything back.
        if (!results.complete(job)) throw new InvalidEvaluationResult();
        session.feedback();
        return report;
    }
}
