package com.doezip.learning.service;
import com.doezip.learning.adapter.FlowFeedbackAi;
import com.doezip.learning.dto.FlowDtos.View;
import java.util.UUID;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.DisposableBean;
@Service
public class FlowFeedback implements DisposableBean {
 private final FlowService flows;private final FlowFeedbackAi ai;
 private final ThreadPoolExecutor executor=new ThreadPoolExecutor(2,2,0L,TimeUnit.SECONDS,new ArrayBlockingQueue<>(8));
 public FlowFeedback(FlowService flows,FlowFeedbackAi ai){this.flows=flows;this.ai=ai;}
 public View request(UUID user,UUID id){var r=flows.reserve(user,id);if(r!=null){
  try{executor.execute(()->{com.fasterxml.jackson.databind.JsonNode result=null;try{result=new com.doezip.learning.adapter.FlowFeedbackValidator().validate(ai.evaluate(r.model(),r.input()),r.input());}catch(Exception ignored){/* No submitted text or provider error is logged. */}flows.finish(user,id,r.token(),result);});}
  catch(RejectedExecutionException e){flows.finish(user,id,r.token(),null);}
 }return flows.get(user,id);}
 public void destroy(){executor.shutdownNow();}
}
