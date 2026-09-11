package com.doezip.session.service;
import com.doezip.session.dto.SessionDtos.*;
import com.doezip.session.entity.*;
import com.doezip.session.repository.*;
import com.doezip.task.service.*;
import com.doezip.task.repository.TaskRepository;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional(readOnly=true)
public class SessionService {
 private final SessionRepository sessions; private final MaterialRepository materials;
 private final TaskRepository tasks; private final TaskService taskService;
 public SessionService(SessionRepository sessions,MaterialRepository materials,TaskRepository tasks,TaskService taskService){
  this.sessions=sessions;this.materials=materials;this.tasks=tasks;this.taskService=taskService;
 }
 @Transactional public Workspace create(UUID userId,Create request){
  if(request==null)throw SessionFailure.invalid();
  tasks.findByIdAndStatusIn(request.taskId(),List.of("PUBLISHED")).orElseThrow(TaskNotFoundException::new);
  return workspace(sessions.save(new LearningSession(userId,request.taskId())));
 }
 public Workspace get(UUID userId,UUID id){return workspace(owned(userId,id));}
 private LearningSession owned(UUID userId,UUID id){return sessions.findByIdAndUserId(id,userId).orElseThrow(SessionFailure::missing);}
 private List<String> stages(LearningSession s){return s.getConditionReleasedAt()==null?List.of("INITIAL"):List.of("INITIAL","CONDITION_CHANGE");}
 private Workspace workspace(LearningSession s){
  var summary=materials.findByTaskIdAndReleaseStageInOrderBySortOrderAscIdAsc(s.getTaskId(),stages(s)).stream()
    .map(m->new MaterialSummary(m.getId(),m.getTitle(),m.getType(),m.getSortOrder())).toList();
  return new Workspace(new Session(s.getId(),s.getTaskId(),s.getStatus(),s.getCurrentStep(),s.getMode(),s.getConditionReleasedAt(),
   s.writable()?List.of("READ_MATERIALS","WRITE_DRAFT"):List.of("READ_MATERIALS")),taskService.get(s.getTaskId()),summary,
   new Draft(s.getMarkdown(),s.getLockVersion(),hash(s.getMarkdown())),null,null,null,null);
 }
 public Material material(UUID userId,UUID id,UUID materialId){
  var s=owned(userId,id);
  var m=materials.findByIdAndTaskIdAndReleaseStageIn(materialId,s.getTaskId(),stages(s))
   .orElseThrow(()->new SessionFailure(404,"MATERIAL_NOT_FOUND"));
  String[] lines=m.getContentMarkdown().split("\n",-1);
  return new Material(m.getId(),m.getTitle(),m.getType(),m.getSortOrder(),m.getContentMarkdown(),m.getContentHash(),
   IntStream.range(0,lines.length).mapToObj(i->new Line(i+1,lines[i])).toList());
 }
 @Transactional public Draft save(UUID userId,UUID id,Save request){
  if(request==null)throw SessionFailure.invalid();
  if(request.markdown().codePointCount(0,request.markdown().length())>20000) throw SessionFailure.invalid();
  String text=request.markdown().replace("\r\n","\n").replace('\r','\n');
  if(text.codePointCount(0,text.length())>20000 || text.codePoints().anyMatch(c->c==0 || c>=0xD800 && c<=0xDFFF)) throw SessionFailure.invalid();
  // Lock the owned session row so both workflow state and CAS are checked atomically.
  var s=sessions.lockOwned(id,userId).orElseThrow(SessionFailure::missing);
  if(!s.writable())throw new SessionFailure(409,"INVALID_SESSION_STATE");
  if(s.getLockVersion()!=request.expectedLockVersion() || s.getLockVersion()==Long.MAX_VALUE)throw new SessionFailure(409,"DRAFT_VERSION_CONFLICT");
  s.saveDraft(text);
  return new Draft(text,s.getLockVersion(),hash(text));
 }
 public static String hash(String text){
  try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}
  catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
}
