package com.doezip.evaluation.repository;
import com.doezip.evaluation.dto.EvaluationDtos.Evaluation;
import java.util.*;
import java.time.Instant;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
@Repository
public class EvaluationRepository {
 private final JdbcTemplate db;
 public EvaluationRepository(JdbcTemplate db){this.db=db;}
 public record Job(UUID id,UUID sessionId,UUID documentId,String phase,String status,String snapshot,String fingerprint,UUID lease,int attempts,String error,Instant createdAt,UUID reportId){
  public boolean retryable(){return status.equals("FAILED")&&attempts<4&&Set.of("WORKER_LEASE_EXPIRED","WORKER_TEMPORARY_FAILURE").contains(error==null?"":error);}
  public Evaluation view(){return new Evaluation(id,sessionId,phase,status,reportId,error,retryable(),2000,createdAt);}
 }
 private Job map(ResultSet r,int index)throws SQLException{return new Job(r.getObject("id",UUID.class),r.getObject("session_id",UUID.class),r.getObject("document_version_id",UUID.class),r.getString("phase"),r.getString("status"),r.getString("input_snapshot_json"),r.getString("input_fingerprint"),r.getObject("lease_token",UUID.class),r.getInt("attempt_count"),r.getString("error_code"),r.getTimestamp("created_at").toInstant(),r.getString("status").equals("SUCCEEDED")?db.queryForObject("SELECT id FROM feedback_reports WHERE evaluation_run_id=?",UUID.class,r.getObject("id",UUID.class)):null);}
 public Optional<Job> find(UUID id){return db.query("SELECT * FROM evaluation_runs WHERE id=?",this::map,id).stream().findFirst();}
 public Optional<Job> byKey(UUID session,UUID key){return db.query("SELECT * FROM evaluation_runs WHERE session_id=? AND idempotency_key=?",this::map,session,key).stream().findFirst();}
 public Optional<Job> latest(UUID session){return db.query("SELECT * FROM evaluation_runs WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 1",this::map,session).stream().findFirst();}
 public Optional<Job> activeJob(UUID session){return db.query("SELECT * FROM evaluation_runs WHERE session_id=? AND status IN ('QUEUED','RUNNING')",this::map,session).stream().findFirst();}
 public boolean succeeded(UUID session){return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM evaluation_runs WHERE session_id=? AND phase='INITIAL' AND status='SUCCEEDED')",Boolean.class,session));}
 public boolean active(UUID session){return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM evaluation_runs WHERE session_id=? AND status IN ('QUEUED','RUNNING'))",Boolean.class,session));}
 public Job insert(UUID session,UUID task,UUID document,UUID challenge,UUID key,String snapshot,String hash){
  UUID id=UUID.randomUUID();db.update("INSERT INTO evaluation_runs(id,session_id,task_id,document_version_id,challenge_run_id,phase,idempotency_key,input_snapshot_json,input_fingerprint,evaluator_version,llm_config_json) VALUES (?,?,?,?,?,'INITIAL',?,?::jsonb,?,'lifecycle-v1','{\"provider\":\"unconfigured\"}')",id,session,task,document,challenge,key,snapshot,hash);return find(id).orElseThrow();
 }
 public void retry(UUID id){db.update("UPDATE evaluation_runs SET status='QUEUED',error_code=NULL,finished_at=NULL,next_attempt_at=now() WHERE id=?",id);}
 @Transactional public Optional<Job> claim(){
  UUID token=UUID.randomUUID();return db.query("WITH candidate AS (SELECT id FROM evaluation_runs WHERE status='QUEUED' AND next_attempt_at<=now() AND attempt_count<4 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE evaluation_runs e SET status='RUNNING',attempt_count=attempt_count+1,lease_token=?,lease_expires_at=now()+interval '30 seconds',started_at=now(),error_code=NULL FROM candidate c WHERE e.id=c.id RETURNING e.*",this::map,token).stream().findFirst();
 }
 @Transactional public boolean fail(Job job,String code,boolean temporary){
  return db.update("UPDATE evaluation_runs SET status=CASE WHEN ? AND attempt_count<3 THEN 'QUEUED' ELSE 'FAILED' END,error_code=?,lease_token=NULL,lease_expires_at=NULL,finished_at=now(),next_attempt_at=now()+interval '2 seconds' WHERE id=? AND status='RUNNING' AND lease_token=? AND lease_expires_at>now()",temporary,code,job.id(),job.lease())==1;
 }
 @Transactional public int recoverExpired(){return db.update("UPDATE evaluation_runs SET status=CASE WHEN attempt_count<3 THEN 'QUEUED' ELSE 'FAILED' END,error_code='WORKER_LEASE_EXPIRED',lease_token=NULL,lease_expires_at=NULL,finished_at=now(),next_attempt_at=now()+interval '2 seconds' WHERE status='RUNNING' AND lease_expires_at<=now()");}
}
