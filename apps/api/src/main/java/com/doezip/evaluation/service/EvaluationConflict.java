package com.doezip.evaluation.service;
import java.util.UUID;
public class EvaluationConflict extends RuntimeException {public final UUID evaluationId;public EvaluationConflict(UUID id){evaluationId=id;}}
