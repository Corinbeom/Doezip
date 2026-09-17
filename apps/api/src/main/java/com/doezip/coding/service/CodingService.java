package com.doezip.coding.service;
import com.doezip.coding.dto.CodingDtos.*;
import com.doezip.coding.repository.CodingRepository;
import com.doezip.session.service.SessionFailure;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class CodingService {
 @org.springframework.beans.factory.annotation.Autowired private com.doezip.learning.repository.FlowRepository flowRecords;
 private final CodingRepository repo;private final Map<String,String> starters;
 public CodingService(CodingRepository repo){this.repo=repo;starters=Map.of("duplicate-items-v1",starter("coding/starter.js"),"duplicate-items-v2",starter("coding/starter-v2.js"));}
 private String starter(String path){try(var in=new ClassPathResource(path).getInputStream()){return new String(in.readAllBytes(),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException(e);}}
 @Transactional public Workspace create(UUID user){return create(user,"duplicate-items-v1");}
 @Transactional public Workspace create(UUID user,String taskVersion){
  // Bound stored workspaces per learner; submissions remain available.
  repo.lockUser(user);
  if(repo.countWorkspaces(user)>=50)throw new SessionFailure(409,"CODING_WORKSPACE_LIMIT");
  String starter=starters.get(taskVersion);if(starter==null)throw SessionFailure.invalid();
  UUID id=UUID.randomUUID();repo.create(id,user,taskVersion,starter);return repo.view(id,user);
 }
 @Transactional(readOnly=true) public List<UUID> list(UUID user){return repo.list(user);}
 @Transactional public Workspace get(UUID user,UUID id){repo.owned(id,user,true);repo.expire(id);return repo.view(id,user);}
 private Workspace writable(UUID user,UUID id,long version){var w=repo.owned(id,user,true);repo.expire(id);if(w.submittedAt()!=null)throw new SessionFailure(409,"CODING_SUBMITTED");if(w.version()!=version)throw new SessionFailure(409,"CODING_VERSION_CONFLICT");return w;}
 private void idle(UUID id){if(repo.turns(id).stream().anyMatch(t->t.status().equals("RUNNING")))throw new SessionFailure(409,"CODING_AI_RUNNING");}
 @Transactional public Workspace save(UUID user,UUID id,Save body){
  writable(user,id,body.expectedVersion());idle(id);String code=body.code().replace("\r\n","\n").replace('\r','\n');
  if(code.contains("\0")||code.codePoints().anyMatch(c->c>=0xD800&&c<=0xDFFF))throw SessionFailure.invalid();
  repo.save(id,code);flowRecords.event(id,"CODE_SAVED",Map.of("code",code,"version",body.expectedVersion()+1));return repo.view(id,user);
 }
 @Transactional public Workspace run(UUID user,UUID id,Run body){
  var w=writable(user,id,body.version());idle(id);
  if(!body.suite().equals(w.taskVersion()))throw SessionFailure.invalid();
  // Browser-reported public practice checks, never trusted server grading.
  repo.run(id,body);flowRecords.event(id,"PUBLIC_TEST",body);return repo.view(id,user);
 }
 @Transactional public Workspace submit(UUID user,UUID id,Submit body){
  var existing=repo.owned(id,user,true);
  if(existing.submittedAt()!=null&&existing.version()==body.expectedVersion()&&Objects.equals(existing.explanation(),body.explanation()))return repo.view(id,user);
  var w=writable(user,id,body.expectedVersion());idle(id);
  if(w.code().isBlank()||w.lastRun()==null||w.lastRun().version()!=w.version())throw new SessionFailure(409,"CODING_TEST_REQUIRED");
  repo.submit(id,body.explanation());return repo.view(id,user);
 }
 public record Reservation(Turn turn,boolean created) {}
 @Transactional public Reservation reserve(UUID user,UUID id,Ask body,boolean available){
  var w=repo.owned(id,user,true);repo.expire(id);
  var old=repo.turns(id).stream().filter(t->t.requestKey().equals(body.requestKey())).findFirst();
  if(old.isPresent()){var t=old.get();if(t.baseVersion()!=body.expectedVersion()||!t.instruction().equals(body.instruction()))throw new SessionFailure(409,"CODING_KEY_CONFLICT");return new Reservation(t,false);}
  writable(user,id,body.expectedVersion());idle(id);
  if(!available)throw new SessionFailure(503,"CODING_AI_NOT_CONFIGURED");
  repo.lockBudget();
  int count=repo.userCalls(user);
  int global=repo.globalCalls();
  if(count>=20||global>=100||repo.turns(id).size()>=20)throw new SessionFailure(429,"CODING_AI_LIMIT");
  UUID turnId=UUID.randomUUID();repo.reserve(turnId,id,body,w);
  return new Reservation(new Turn(turnId,body.requestKey(),w.version(),w.code(),body.instruction(),"RUNNING",null,null),true);
 }
 @Transactional public Workspace finish(UUID user,UUID id,UUID turnId,Proposal proposal){
  repo.owned(id,user,true);
  repo.finish(turnId,id,proposal);
  return repo.view(id,user);
 }
 @Transactional(readOnly=true) public String context(UUID user,UUID id,Turn turn){var w=repo.view(id,user);return repo.encode(Map.of("taskVersion",w.taskVersion(),"code",turn.baseCode(),"request",turn.instruction(),"publicTestRun",w.lastRun()==null?"실행 기록 없음":w.lastRun(),"history",w.turns().stream().filter(t->t.status().equals("SUCCEEDED")).skip(Math.max(0,w.turns().stream().filter(t->t.status().equals("SUCCEEDED")).count()-4)).map(t->Map.of("request",t.instruction(),"reply",t.explanation())).toList()));}
}
