package com.doezip.coding.repository;
import com.doezip.coding.dto.CodingDtos.*;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class CodingRepository {
 private final JdbcTemplate db;private final ObjectMapper json;
 public CodingRepository(JdbcTemplate db,ObjectMapper json){this.db=db;this.json=json;}
 public Workspace owned(UUID id,UUID user,boolean lock){
  return db.query("SELECT * FROM coding_workspaces WHERE id=? AND user_id=?"+(lock?" FOR UPDATE":""),(r,n)->new Workspace(id,r.getString("task_version"),r.getString("code"),r.getLong("version"),r.getString("submitted_at"),r.getString("explanation"),decode(r.getString("last_run")),List.of()),id,user).stream().findFirst().orElseThrow(SessionFailure::missing);
 }
 public List<Turn> turns(UUID id){return db.query("SELECT * FROM coding_turns WHERE workspace_id=? ORDER BY created_at,id",(r,n)->new Turn(r.getObject("id",UUID.class),r.getObject("request_key",UUID.class),r.getLong("base_version"),r.getString("base_code"),r.getString("instruction"),r.getString("status"),r.getString("explanation"),r.getString("proposed_code")),id);}
 public Workspace view(UUID id,UUID user){var w=owned(id,user,false);return new Workspace(w.id(),w.taskVersion(),w.code(),w.version(),w.submittedAt(),w.explanation(),w.lastRun(),turns(id));}
 public String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 private Run decode(String value){try{return value==null?null:json.readValue(value,Run.class);}catch(Exception e){throw new IllegalStateException(e);}}
 public void expire(UUID id){db.update("UPDATE coding_turns SET status='FAILED',explanation='응답 시간이 초과되었습니다. 다시 요청하세요.' WHERE workspace_id=? AND status='RUNNING' AND created_at < now()-interval '90 seconds'",id);}

 public void lockUser(UUID user){db.queryForObject("SELECT pg_advisory_xact_lock(hashtext(?))",Object.class,user.toString());}
 public int countWorkspaces(UUID user){return db.queryForObject("SELECT count(*) FROM coding_workspaces WHERE user_id=?",Integer.class,user);}
 public void create(UUID id,UUID user,String starter){db.update("INSERT INTO coding_workspaces(id,user_id,task_version,code) VALUES (?,?,'duplicate-items-v1',?)",id,user,starter);}
 public List<UUID> list(UUID user){return db.queryForList("SELECT id FROM coding_workspaces WHERE user_id=? ORDER BY created_at DESC LIMIT 50",UUID.class,user);}
 public void save(UUID id,String code){db.update("UPDATE coding_workspaces SET code=?,version=version+1,last_run=NULL,updated_at=now() WHERE id=?",code,id);}
 public void run(UUID id,Run run){db.update("UPDATE coding_workspaces SET last_run=?::jsonb,updated_at=now() WHERE id=?",encode(run),id);}
 public void submit(UUID id,String explanation){db.update("UPDATE coding_workspaces SET submitted_at=now(),explanation=?,updated_at=now() WHERE id=?",explanation,id);}
 public void lockBudget(){db.queryForObject("SELECT pg_advisory_xact_lock(803081)",Object.class);}
 public int userCalls(UUID user){return db.queryForObject("SELECT count(*) FROM coding_turns t JOIN coding_workspaces w ON w.id=t.workspace_id WHERE w.user_id=? AND t.created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",Integer.class,user);}
 public int globalCalls(){return db.queryForObject("SELECT count(*) FROM coding_turns WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",Integer.class);}
 public void reserve(UUID id,UUID workspace,Ask request,Workspace w){db.update("INSERT INTO coding_turns(id,workspace_id,request_key,base_version,base_code,instruction,status) VALUES (?,?,?,?,?,?,'RUNNING')",id,workspace,request.requestKey(),w.version(),w.code(),request.instruction());}
 public void finish(UUID id,UUID workspace,Proposal proposal){db.update("UPDATE coding_turns SET status=?,explanation=?,proposed_code=? WHERE id=? AND workspace_id=? AND status='RUNNING'",proposal==null?"FAILED":"SUCCEEDED",proposal==null?"AI 응답을 받지 못했습니다. 잠시 후 새 요청으로 재시도하세요.":proposal.explanation(),proposal==null?null:proposal.code(),id,workspace);}
}
