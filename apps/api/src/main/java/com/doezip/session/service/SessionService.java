package com.doezip.session.service;
import com.doezip.challenge.repository.*;
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
 @org.springframework.beans.factory.annotation.Autowired private com.doezip.learning.repository.FlowRepository flowRecords;
 private final ChallengeRunRepository challenges;private final ChallengeTemplateRepository templates;private final DocumentRepository documents;
 private final com.doezip.evaluation.repository.EvaluationRepository evaluations;
 private final SessionRepository sessions; private final MaterialRepository materials;
 private final TaskRepository tasks; private final TaskService taskService;
 public SessionService(SessionRepository sessions,MaterialRepository materials,TaskRepository tasks,TaskService taskService,ChallengeRunRepository challenges,ChallengeTemplateRepository templates,DocumentRepository documents,com.doezip.evaluation.repository.EvaluationRepository evaluations){
  this.evaluations=evaluations;
  this.challenges=challenges;this.templates=templates;this.documents=documents;
  this.sessions=sessions;this.materials=materials;this.tasks=tasks;this.taskService=taskService;
 }
 @Transactional public Workspace create(UUID userId,Create request){
  if(request==null)throw SessionFailure.invalid();
  tasks.findByIdAndStatusIn(request.taskId(),List.of("PUBLISHED")).orElseThrow(TaskNotFoundException::new);
  return workspace(sessions.saveAndFlush(new LearningSession(userId,request.taskId())));
 }
 public Workspace get(UUID userId,UUID id){return workspace(owned(userId,id));}
 private LearningSession owned(UUID userId,UUID id){return sessions.findByIdAndUserId(id,userId).orElseThrow(SessionFailure::missing);}
 private List<String> stages(LearningSession s){return s.getConditionReleasedAt()==null?List.of("INITIAL"):List.of("INITIAL","CONDITION_CHANGE");}
 private Workspace workspace(LearningSession s){
  var summary=materials.findByTaskIdAndReleaseStageInOrderBySortOrderAscIdAsc(s.getTaskId(),stages(s)).stream()
    .map(m->new MaterialSummary(m.getId(),m.getTitle(),m.getType(),m.getSortOrder())).toList();
  var challenge=challenges.findBySessionId(s.getId());
  var evaluation=evaluations.latest(s.getId());
  List<String> actions=new ArrayList<>(List.of("READ_MATERIALS"));
  if(s.writable())actions.addAll(List.of("WRITE_DRAFT","SNAPSHOT_INITIAL","SEND_MESSAGE"));
  if(challenge.isEmpty()&&s.getStatus().equals("ACTIVE")&&s.getCurrentStep().equals("CHALLENGE")
    &&documents.findBySessionIdAndCheckpoint(s.getId(),"INITIAL").isPresent()&&templates.existsByTaskId(s.getTaskId()))actions.add("START_CHALLENGE");
  if(challenge.isPresent()&&challenge.get().getStatus().equals("IN_PROGRESS")&&s.getStatus().equals("ACTIVE")&&s.getCurrentStep().equals("CHALLENGE"))actions.addAll(List.of("EDIT_CHALLENGE","SUBMIT_CHALLENGE"));
  if(challenge.isPresent()&&challenge.get().getStatus().equals("SUBMITTED")&&s.getStatus().equals("ACTIVE")&&Set.of("CHALLENGE","FEEDBACK").contains(s.getCurrentStep())&&evaluation.isEmpty())actions.add("REQUEST_INITIAL_EVALUATION");
  if(evaluation.map(j->j.reportId()).isPresent())actions.add("READ_INITIAL_REPORT");
  return new Workspace(new Session(s.getId(),s.getTaskId(),s.getStatus(),s.getCurrentStep(),s.getMode(),s.getConditionReleasedAt(),
   actions),taskService.get(s.getTaskId()),summary,
   new Draft(s.getMarkdown(),s.getLockVersion(),hash(s.getMarkdown())),challenge.map(c->c.getId()).orElse(null),evaluation.map(j->j.reportId()).orElse(null),null,evaluation.map(j->j.id()).orElse(null));
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
  s.saveDraft(text);flowRecords.event(id,"REPORT_SAVED",Map.of("markdown",text,"version",s.getLockVersion()));
  return new Draft(text,s.getLockVersion(),hash(text));
 }
 public static String hash(String text){
  try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}
  catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
}
