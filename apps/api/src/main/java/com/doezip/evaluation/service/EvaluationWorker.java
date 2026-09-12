package com.doezip.evaluation.service;

import com.doezip.evaluation.adapter.EvaluationAdapter;
import com.doezip.evaluation.adapter.EvaluationFailure;
import com.doezip.evaluation.adapter.EvaluationSettings;
import com.doezip.evaluation.repository.EvaluationBudget;
import com.doezip.evaluation.repository.EvaluationRepository;
import com.doezip.session.service.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Service;

@Service
public class EvaluationWorker {
    private final EvaluationRepository jobs;
    private final ObjectMapper mapper;
    private final EvaluationAdapter adapter;
    private final ResultPublisher publisher;
    private final EvaluationBudget budget;
    private final EvaluationSettings settings;
    private final AtomicBoolean busy=new AtomicBoolean();
    private final ScheduledExecutorService heartbeats=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"evaluation-heartbeat");t.setDaemon(true);return t;});
    public EvaluationWorker(EvaluationRepository jobs,ObjectMapper mapper,EvaluationAdapter adapter,ResultPublisher publisher,EvaluationBudget budget,EvaluationSettings settings){
        this.jobs=jobs;this.mapper=mapper;this.adapter=adapter;this.publisher=publisher;this.budget=budget;this.settings=settings;
    }
    // One bounded slot. No transaction spans a provider call; heartbeats use independent short transactions.
    public void tick(){
        if(!busy.compareAndSet(false,true))return;
        try{jobs.recoverExpired();jobs.claim().ifPresent(this::process);}
        finally{busy.set(false);}
    }
    private void process(EvaluationRepository.Job job){
        long started=System.nanoTime();var lost=new AtomicBoolean();
        var heartbeat=heartbeats.scheduleAtFixedRate(()->{
            try{if(System.nanoTime()-started>TimeUnit.SECONDS.toNanos(150)||!jobs.heartbeat(job))lost.set(true);}
            catch(RuntimeException unavailable){lost.set(true);}
        },20,20,TimeUnit.SECONDS);
        try{
            var snapshot=mapper.readTree(job.snapshot());
            if(!SessionService.hash(EvaluationService.canonical(snapshot)).equals(job.fingerprint()))throw new EvaluationFailure("INVALID_EVALUATION_INPUT",false);
            if(!settings.available()||!snapshot.path("llmConfig").path("provider").asText().equals("gemini"))throw new EvaluationFailure("EVALUATOR_NOT_CONFIGURED",false);
            budget.reserve(job.sessionId());
            var result=adapter.evaluate(snapshot);
            if(lost.get()||System.nanoTime()-started>TimeUnit.SECONDS.toNanos(150))throw new EvaluationFailure("AI_TIMEOUT",true);
            // UUIDs identify server observations, not model-generated facts. Still validate subject references and quotes.
            for(var area:result.path("areas"))for(var dimension:area.path("dimensions"))for(var evidence:dimension.path("evidence")){
                if(evidence.isObject())((com.fasterxml.jackson.databind.node.ObjectNode)evidence).put("id",java.util.UUID.randomUUID().toString()).put("method","LLM");
            }
            publisher.publish(job,result,false);
        }catch(EvaluationFailure failure){jobs.fail(job,failure.code(),failure.temporary(),failure.retryAfterSeconds());}
        catch(InvalidEvaluationResult invalid){jobs.fail(job,"INVALID_EVALUATION_RESULT",true);}
        catch(com.fasterxml.jackson.core.JsonProcessingException invalid){jobs.fail(job,"INVALID_EVALUATION_INPUT",false);}
        catch(RuntimeException failure){jobs.fail(job,"WORKER_TEMPORARY_FAILURE",true);}
        finally{heartbeat.cancel(false);}
    }
    @PreDestroy void close(){heartbeats.shutdownNow();}
}
