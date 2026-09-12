package com.doezip.evaluation.service;
import com.doezip.evaluation.dto.EvaluationDtos.*;
import com.doezip.evaluation.repository.EvaluationRepository;
import com.doezip.session.repository.*;
import com.doezip.session.service.*;
import com.doezip.challenge.repository.ChallengeRunRepository;
import com.doezip.challenge.service.ChallengeService;
import com.doezip.task.service.TaskService;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional(readOnly=true)
public class EvaluationService {
 private final com.doezip.evaluation.adapter.EvaluationSettings settings;
 private final EvaluationRepository jobs;private final SessionRepository sessions;private final DocumentRepository documents;
 private final ChallengeRunRepository challenges;private final ChallengeService challengeService;private final MaterialRepository materials;private final SessionService sessionService;private final TaskService tasks;private final ObjectMapper mapper;
 public EvaluationService(EvaluationRepository jobs,SessionRepository sessions,DocumentRepository documents,ChallengeRunRepository challenges,ChallengeService challengeService,MaterialRepository materials,SessionService sessionService,TaskService tasks,ObjectMapper mapper,com.doezip.evaluation.adapter.EvaluationSettings settings){this.settings=settings;this.jobs=jobs;this.sessions=sessions;this.documents=documents;this.challenges=challenges;this.challengeService=challengeService;this.materials=materials;this.sessionService=sessionService;this.tasks=tasks;this.mapper=mapper;}
 public Evaluation get(UUID user,UUID id){var job=jobs.find(id).orElseThrow(EvaluationService::missing);sessions.findByIdAndUserId(job.sessionId(),user).orElseThrow(EvaluationService::missing);return job.view();}
 @Transactional public Evaluation request(UUID user,UUID sessionId,UUID key,Request input){
  if(input==null)throw SessionFailure.invalid();var session=sessions.lockOwned(sessionId,user).orElseThrow(SessionFailure::missing);
  var existing=jobs.byKey(sessionId,key);if(existing.isPresent()){
   var j=existing.get();if(!j.phase().equals(input.phase())||!j.documentId().equals(input.documentVersionId()))throw new SessionFailure(409,"IDEMPOTENCY_CONFLICT");return j.view();
  }
  if(!input.phase().equals("INITIAL")||!session.getStatus().equals("ACTIVE")||!Set.of("CHALLENGE","FEEDBACK").contains(session.getCurrentStep()))throw new SessionFailure(409,"INVALID_SESSION_STATE");
  jobs.activeJob(sessionId).ifPresent(j->{throw new EvaluationConflict(j.id());});
  if(jobs.succeeded(sessionId))throw new SessionFailure(409,"EVALUATION_ALREADY_SUCCEEDED");
  var document=documents.findBySessionIdAndCheckpoint(sessionId,"INITIAL").filter(d->d.getId().equals(input.documentVersionId())&&d.getSealedAt()!=null).orElseThrow(()->new SessionFailure(422,"INVALID_EVALUATION_INPUT"));
  var challenge=challenges.findBySessionId(sessionId).filter(c->c.getStatus().equals("SUBMITTED")).orElseThrow(()->new SessionFailure(409,"CHALLENGE_NOT_SUBMITTED"));
  var sources=materials.findByTaskIdAndReleaseStageInOrderBySortOrderAscIdAsc(session.getTaskId(),session.getConditionReleasedAt()==null?List.of("INITIAL"):List.of("INITIAL","CONDITION_CHANGE")).stream().map(m->sessionService.material(user,sessionId,m.getId())).toList();
  Map<String,Object> inputData=new TreeMap<>();inputData.put("schemaVersion",1);inputData.put("document",Map.of("id",document.getId(),"hash",document.getContentHash(),"markdown",document.getContentMarkdown()));
  inputData.put("challenge",challengeService.get(user,challenge.getId()));inputData.put("materials",sources);inputData.put("task",tasks.get(session.getTaskId()));
  inputData.put("messages",List.of());inputData.put("defenseAnswers",List.of());inputData.put("eventCutoff",0);inputData.put("unimplementedInputs",List.of("chat","defense","events"));inputData.put("evaluatorVersion",settings.version());inputData.put("llmConfig",settings.frozenConfig());
  String snapshot=canonical(mapper.valueToTree(inputData));return jobs.insert(sessionId,session.getTaskId(),document.getId(),challenge.getId(),key,snapshot,SessionService.hash(snapshot)).view();
 }
 @Transactional public Evaluation retry(UUID user,UUID id){
  var original=jobs.find(id).orElseThrow(EvaluationService::missing);var session=sessions.lockOwned(original.sessionId(),user).orElseThrow(EvaluationService::missing);
  if(!session.getStatus().equals("ACTIVE")||!Set.of("CHALLENGE","FEEDBACK").contains(session.getCurrentStep()))throw new SessionFailure(409,"INVALID_SESSION_STATE");
  var current=jobs.find(id).orElseThrow(EvaluationService::missing);
  if(!current.retryable())throw new SessionFailure(409,"EVALUATION_NOT_RETRYABLE");jobs.activeJob(current.sessionId()).ifPresent(j->{throw new EvaluationConflict(j.id());});
  jobs.retry(id);return jobs.find(id).orElseThrow().view();
 }
 public static String canonical(JsonNode node){
  if(node.isObject()){ObjectNode sorted=JsonNodeFactory.instance.objectNode();List<String> keys=new ArrayList<>();node.fieldNames().forEachRemaining(keys::add);Collections.sort(keys);for(String key:keys)sorted.set(key,normalize(node.get(key)));return sorted.toString();}
  return normalize(node).toString();
 }
 private static JsonNode normalize(JsonNode node){if(node.isObject()){ObjectNode out=JsonNodeFactory.instance.objectNode();List<String> keys=new ArrayList<>();node.fieldNames().forEachRemaining(keys::add);Collections.sort(keys);keys.forEach(k->out.set(k,normalize(node.get(k))));return out;}if(node.isArray()){ArrayNode out=JsonNodeFactory.instance.arrayNode();node.forEach(v->out.add(normalize(v)));return out;}return node;}
 private static SessionFailure missing(){return new SessionFailure(404,"EVALUATION_NOT_FOUND");}
}
