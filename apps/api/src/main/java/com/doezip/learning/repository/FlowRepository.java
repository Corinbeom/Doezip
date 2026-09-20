package com.doezip.learning.repository;
import com.fasterxml.jackson.databind.*;
import com.doezip.session.service.SessionFailure;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class FlowRepository {
 public final JdbcTemplate db; public final ObjectMapper json;
 public FlowRepository(JdbcTemplate db,ObjectMapper json){this.db=db;this.json=json;}
 public JdbcTemplate db(){return db;} public ObjectMapper json(){return json;}
 public JsonNode parse(String text){try{return text==null?json.nullNode():json.readTree(text);}catch(Exception e){throw new IllegalStateException(e);}}
 public String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 public JsonNode owned(UUID user,UUID id,boolean lock){return db.query("SELECT row_to_json(f)::text FROM learning_flows f WHERE id=? AND user_id=?"+(lock?" FOR NO KEY UPDATE":""),(r,n)->parse(r.getString(1)),id,user).stream().findFirst().orElseThrow(SessionFailure::missing);}
 public Optional<JsonNode> active(UUID user,String catalogId,String mode){return db.query("SELECT row_to_json(f)::text FROM learning_flows f WHERE user_id=? AND task_catalog_id=? AND mode=? AND stage IN ('WORKING','EXPLAIN') AND created_at>COALESCE((SELECT max(done.created_at) FROM learning_flows done WHERE done.user_id=f.user_id AND done.task_catalog_id=f.task_catalog_id AND done.mode=f.mode AND done.stage='FEEDBACK'),'-infinity'::timestamptz) ORDER BY CASE WHEN stage='EXPLAIN' THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1",(r,n)->parse(r.getString(1)),user,catalogId,mode).stream().findFirst();}
 public List<UUID> visible(UUID user){return db.queryForList("SELECT id FROM (SELECT id,created_at,1 AS priority FROM learning_flows WHERE user_id=? AND stage='FEEDBACK' UNION ALL SELECT id,created_at,0 AS priority FROM (SELECT candidate.id,candidate.created_at,row_number() OVER(PARTITION BY candidate.task_catalog_id,candidate.mode ORDER BY CASE WHEN candidate.stage='EXPLAIN' THEN 0 ELSE 1 END,candidate.created_at DESC,candidate.id DESC) AS active_rank FROM learning_flows candidate WHERE candidate.user_id=? AND candidate.stage IN ('WORKING','EXPLAIN') AND candidate.created_at>COALESCE((SELECT max(done.created_at) FROM learning_flows done WHERE done.user_id=candidate.user_id AND done.task_catalog_id=candidate.task_catalog_id AND done.mode=candidate.mode AND done.stage='FEEDBACK'),'-infinity'::timestamptz)) active WHERE active_rank=1) visible ORDER BY priority,created_at DESC,id DESC LIMIT 50",UUID.class,user,user);}
 public void event(UUID resource,String kind,Object body){
  db.update("INSERT INTO learning_flow_events(id,flow_id,kind,body) SELECT ?,id,?,?::jsonb FROM learning_flows WHERE (session_id=? OR coding_id=?) AND stage='WORKING'",UUID.randomUUID(),kind,encode(body),resource,resource);
 }
 public boolean managed(UUID resource){return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM learning_flows WHERE session_id=? OR coding_id=?)",Boolean.class,resource,resource));}
 public void legacyOnly(UUID resource){if(managed(resource))throw new SessionFailure(409,"USE_LEARNING_FLOW");}
 public void expire(UUID id){db.update("UPDATE learning_flows SET feedback_status='FAILED',feedback_token=NULL WHERE id=? AND feedback_status='RUNNING' AND feedback_started_at<now()-interval '90 seconds'",id);}
}
