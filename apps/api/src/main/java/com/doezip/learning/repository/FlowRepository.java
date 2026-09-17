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
 public void event(UUID resource,String kind,Object body){
  db.update("INSERT INTO learning_flow_events(id,flow_id,kind,body) SELECT ?,id,?,?::jsonb FROM learning_flows WHERE (session_id=? OR coding_id=?) AND stage='WORKING'",UUID.randomUUID(),kind,encode(body),resource,resource);
 }
 public boolean managed(UUID resource){return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM learning_flows WHERE session_id=? OR coding_id=?)",Boolean.class,resource,resource));}
 public void legacyOnly(UUID resource){if(managed(resource))throw new SessionFailure(409,"USE_LEARNING_FLOW");}
 public void expire(UUID id){db.update("UPDATE learning_flows SET feedback_status='FAILED',feedback_token=NULL WHERE id=? AND feedback_status='RUNNING' AND feedback_started_at<now()-interval '90 seconds'",id);}
}
