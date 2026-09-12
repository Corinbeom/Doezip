package com.doezip.evaluation.service;
import com.doezip.evaluation.repository.EvaluationRepository;
import com.doezip.session.service.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
@Service
public class EvaluationWorker {
 private final EvaluationRepository jobs;private final ObjectMapper mapper;
 public EvaluationWorker(EvaluationRepository jobs,ObjectMapper mapper){this.jobs=jobs;this.mapper=mapper;}
 // Claim/finalize use short independent transactions. No transaction spans processing.
 public void tick(){jobs.recoverExpired();jobs.claim().ifPresent(job->{
  try{
   String hash=SessionService.hash(EvaluationService.canonical(mapper.readTree(job.snapshot())));
   if(!hash.equals(job.fingerprint())){jobs.fail(job,"INVALID_EVALUATION_INPUT",false);return;}
   // F05a has no evaluator or report publisher. Never invent a successful evaluation.
   jobs.fail(job,"EVALUATOR_NOT_CONFIGURED",false);
  }catch(com.fasterxml.jackson.core.JsonProcessingException invalid){jobs.fail(job,"INVALID_EVALUATION_INPUT",false);}
 });}
}
