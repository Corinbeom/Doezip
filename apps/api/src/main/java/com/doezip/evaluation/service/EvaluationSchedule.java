package com.doezip.evaluation.service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
@Configuration @EnableScheduling
@ConditionalOnProperty(name="app.evaluation.worker-enabled",havingValue="true",matchIfMissing=true)
public class EvaluationSchedule {
 private final EvaluationWorker worker;
 public EvaluationSchedule(EvaluationWorker worker){this.worker=worker;}
 @Scheduled(fixedDelay=2000,initialDelay=2000) public void poll(){worker.tick();}
}
