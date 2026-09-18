package com.doezip.learning.service;
import com.doezip.learning.dto.FlowDtos.*;
import com.doezip.learning.repository.FlowRepository;
import com.doezip.session.service.*;
import com.doezip.session.dto.SessionDtos;
import com.doezip.session.dto.DocumentDtos;
import com.doezip.coding.service.CodingService;
import com.doezip.coding.dto.CodingDtos;
import com.doezip.chat.repository.ChatRepository;
import com.doezip.evaluation.adapter.EvaluationSettings;
import com.doezip.evaluation.repository.EvaluationBudget;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class FlowService {
 private final FlowRepository repo;private final SessionService sessions;private final DocumentService documents;
 private final CodingService coding;private final ChatRepository chat;private final EvaluationSettings settings;private final EvaluationBudget budget;
 public FlowService(FlowRepository repo,SessionService sessions,DocumentService documents,CodingService coding,ChatRepository chat,EvaluationSettings settings,EvaluationBudget budget){this.repo=repo;this.sessions=sessions;this.documents=documents;this.coding=coding;this.chat=chat;this.settings=settings;this.budget=budget;}
 private UUID uuid(JsonNode n,String key){return n.path(key).isNull()?null:UUID.fromString(n.path(key).asText());}
 private SessionFailure conflict(){return new SessionFailure(409,"FLOW_STATE_CONFLICT");}
 private void working(JsonNode f,long version){if(!f.path("stage").asText().equals("WORKING")||f.path("version").asLong()!=version)throw conflict();}
 @Transactional public View create(UUID user,Create b){return create(user,b,null,null);}
 private View create(UUID user,Create b,UUID parent,String content){
  Kind kind=FlowTasks.kind(b.catalogId(),b.version());
  repo.db().queryForObject("SELECT pg_advisory_xact_lock(hashtext(?))",Object.class,user.toString());
  var prior=repo.db().queryForList("SELECT id FROM learning_flows WHERE user_id=? AND request_key=?",UUID.class,user,b.requestKey());
  if(!prior.isEmpty()){var f=repo.owned(user,prior.getFirst(),false);if(!f.path("task_catalog_id").asText().equals(b.catalogId())||!f.path("flow_version").asText().equals(b.version())||!f.path("mode").asText().equals(b.mode().name())||!Objects.equals(uuid(f,"parent_id"),parent))throw conflict();return view(f);}
  if(repo.db().queryForObject("SELECT count(*) FROM learning_flows WHERE user_id=?",Integer.class,user)>=50)throw new SessionFailure(409,"FLOW_LIMIT");
  UUID session=null,code=null,id=UUID.randomUUID();
  if(kind==Kind.REPORT){var w=sessions.create(user,new SessionDtos.Create(FlowTasks.reportTaskId(b.catalogId(),b.version())));session=w.session().id();if(content!=null)sessions.save(user,session,new SessionDtos.Save(content,0));}
  else {var w=coding.create(user,FlowTasks.codingTaskVersion(b.catalogId(),b.version()));code=w.id();if(content!=null)coding.save(user,code,new CodingDtos.Save(content,0L));}
  repo.db().update("INSERT INTO learning_flows(id,user_id,request_key,task_catalog_id,task_kind,mode,flow_version,session_id,coding_id,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)",id,user,b.requestKey(),b.catalogId(),kind.name(),b.mode().name(),b.version(),session,code,parent);
  UUID resource=session==null?code:session;
  repo.event(resource,"INITIAL_ARTIFACT",Map.of("content",session==null?coding.get(user,code).code():sessions.get(user,session).draft().markdown()));
  return view(repo.owned(user,id,false));
 }
 @Transactional public List<View> list(UUID user){return repo.db().queryForList("SELECT id FROM learning_flows WHERE user_id=? ORDER BY created_at DESC LIMIT 50",UUID.class,user).stream().map(id->view(repo.owned(user,id,false))).toList();}
 @Transactional public View get(UUID user,UUID id){repo.owned(user,id,true);repo.expire(id);return view(repo.owned(user,id,false));}
 private View view(JsonNode f){
  var comparison=new ArrayList<JsonNode>();var parent=uuid(f,"parent_id");
  if(parent!=null){var old=repo.owned(uuid(f,"user_id"),parent,false);if(!f.path("snapshot").isNull()){
   var c=repo.json().createObjectNode();c.put("label","이전 제출과 비교");
   c.put("previousArtifact",old.path("snapshot").path("artifact").asText());c.put("currentArtifact",f.path("snapshot").path("artifact").asText());
   c.put("changed",!old.path("snapshot").path("artifact").equals(f.path("snapshot").path("artifact")));c.set("previousVerification",old.path("snapshot").path("notes"));c.set("currentVerification",f.path("snapshot").path("notes"));comparison.add(c);
  }}
  var task=FlowTasks.get(f.path("task_catalog_id").asText(),f.path("flow_version").asText(),false);
  JsonNode snapshot=f.path("snapshot");
  if(snapshot.isObject()){
   var normalized=(ObjectNode)snapshot.deepCopy();
   var snapshotTask=(ObjectNode)repo.json().valueToTree(task);
   if(snapshot.path("task").isObject())snapshot.path("task").properties().forEach(entry->snapshotTask.set(entry.getKey(),entry.getValue()));
   normalized.set("task",snapshotTask);snapshot=normalized;
  }
  return new View(uuid(f,"id"),f.path("task_catalog_id").asText(),f.path("task_kind").asText(),f.path("mode").asText(),f.path("flow_version").asText(),uuid(f,"session_id"),uuid(f,"coding_id"),parent,f.path("stage").asText(),f.path("version").asLong(),f.path("notes"),f.path("hints"),snapshot,f.path("answers"),f.path("feedback"),f.path("feedback_status").asText(),task,comparison);
 }
 @Transactional public View save(UUID user,UUID id,Save b){var f=repo.owned(user,id,true);working(f,b.version());
  // Check material ownership/stage and ranges before saving references. Quotes are server-derived at sealing.
  citations(user,f,b.notes());
  repo.db().update("UPDATE learning_flows SET notes=?::jsonb,version=version+1 WHERE id=?",repo.encode(b.notes()),id);return view(repo.owned(user,id,false));}
 private ArrayNode citations(UUID user,JsonNode f,Notes notes){var result=repo.json().createArrayNode();
  if(!notes.citations().isEmpty()&&uuid(f,"session_id")==null)throw SessionFailure.invalid();
  for(var c:notes.citations()) {var m=sessions.material(user,uuid(f,"session_id"),c.materialId());if(c.lineEnd()<c.lineStart()||c.lineEnd()>m.lines().size())throw SessionFailure.invalid();
   var item=result.addObject();item.put("materialId",c.materialId().toString());item.put("lineStart",c.lineStart());item.put("lineEnd",c.lineEnd());item.put("quote",String.join("\n",m.lines().subList(c.lineStart()-1,c.lineEnd()).stream().map(SessionDtos.Line::text).toList()));
  }return result;
 }
 @Transactional public View hint(UUID user,UUID id,Hint b){var f=repo.owned(user,id,true);if(!f.path("mode").asText().equals("TRAINING")||!f.path("stage").asText().equals("WORKING"))throw conflict();
  var hints=(ArrayNode)f.path("hints").deepCopy();if(!java.util.stream.StreamSupport.stream(hints.spliterator(),false).anyMatch(h->h.path("index").asInt()==b.index()))hints.addObject().put("index",b.index()).put("text",FlowTasks.get(f.path("task_catalog_id").asText(),f.path("flow_version").asText(),true).hints().get(b.index()));
  repo.db().update("UPDATE learning_flows SET hints=?::jsonb WHERE id=?",hints.toString(),id);return view(repo.owned(user,id,false));
 }
 @Transactional public View submit(UUID user,UUID id,Submit b){var f=repo.owned(user,id,true);
  if(!f.path("snapshot").isNull()) {var s=f.path("snapshot");if(s.path("flowVersion").asLong()==b.version()&&s.path("artifactVersion").asLong()==b.artifactVersion()&&s.path("artifactHash").asText().equals(b.artifactHash()))return view(f);throw conflict();}
  working(f,b.version());Notes notes;try{notes=repo.json().treeToValue(f.path("notes"),Notes.class);}catch(Exception e){throw SessionFailure.invalid();}
  if(notes.explanation().isBlank()||notes.verification().isBlank())throw new SessionFailure(422,"FLOW_NOTES_REQUIRED");
  var snapshot=repo.json().createObjectNode();snapshot.put("flowVersion",b.version());snapshot.put("artifactVersion",b.artifactVersion());snapshot.put("artifactHash",b.artifactHash());snapshot.put("cutoff",java.time.Instant.now().toString());snapshot.set("notes",f.path("notes"));snapshot.set("hints",f.path("hints"));snapshot.set("task",repo.json().valueToTree(FlowTasks.get(f.path("task_catalog_id").asText(),f.path("flow_version").asText(),false)));snapshot.put("mode",f.path("mode").asText());
  var records=snapshot.putArray("records");String artifact;
  if(uuid(f,"session_id")!=null){UUID sid=uuid(f,"session_id");var w=sessions.get(user,sid);
   // DocumentService takes the same session lock used by save/chat before sealing.
   var d=documents.submit(user,sid,new DocumentDtos.Create("INITIAL",b.artifactVersion(),b.artifactHash()));artifact=d.contentMarkdown();
   for(var m:w.materials()){var material=sessions.material(user,sid,m.id());record(records,"material-"+m.id(),"공개 자료",material.contentMarkdown());}
   for(var message:chat.list(sid,0,100))if(message.status().equals("COMPLETED"))record(records,"message-"+message.id(),message.role().equals("USER")?"사용자 요청":"AI 응답 · 사용자 이해의 증거 아님",message.contentText());
  }else {var w=coding.get(user,uuid(f,"coding_id"));if(!SessionService.hash(w.code()).equals(b.artifactHash()))throw conflict();
   w=coding.submit(user,w.id(),new CodingDtos.Submit(b.artifactVersion(),notes.explanation()));artifact=w.code();
   snapshot.set("publicRun",repo.json().valueToTree(w.lastRun()));record(records,"public-run","브라우저 보고 공개 테스트 · 독립 채점 아님",repo.encode(w.lastRun()));
   for(var t:w.turns())if(t.status().equals("SUCCEEDED")){record(records,"request-"+t.id(),"사용자 요청",t.instruction());record(records,"proposal-"+t.id(),"AI 제안 · 사용자 이해의 증거 아님",t.explanation()+"\n"+t.proposedCode());}
  }
  snapshot.put("artifact",artifact);record(records,"artifact","제출 결과물",artifact);record(records,"explanation","사용자 제출 설명 · 자기 보고",notes.explanation());record(records,"verification","사용자 검증 설명 · 자기 보고",notes.verification());
  var quotes=citations(user,f,notes);snapshot.set("citations",quotes);for(int i=0;i<quotes.size();i++)record(records,"citation-"+i,"사용자가 선택한 원문 · 선택만으로 검증 능력을 확정하지 않음",quotes.get(i).toString());
  for(var event:repo.db().query("SELECT id,kind,body::text FROM learning_flow_events WHERE flow_id=? ORDER BY created_at,id",(r,n)->Map.of("id",r.getString(1),"kind",r.getString(2),"body",r.getString(3)),id))record(records,"event-"+event.get("id"),event.get("kind"),event.get("body"));
  if(snapshot.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>250000)throw new SessionFailure(422,"FLOW_CONTEXT_LIMIT");
  repo.db().update("UPDATE learning_flows SET snapshot=?::jsonb,stage='EXPLAIN',version=version+1 WHERE id=?",snapshot.toString(),id);return view(repo.owned(user,id,false));
 }
 private void record(ArrayNode list,String id,String label,String text){list.addObject().put("id",id).put("label",label).put("text",text);}
 @Transactional public View answer(UUID user,UUID id,Answers b){var f=repo.owned(user,id,true);var node=repo.json().valueToTree(b);
  if(!f.path("answers").isNull()){if(f.path("answers").equals(node))return view(f);throw conflict();}
  if(!f.path("stage").asText().equals("EXPLAIN"))throw conflict();
  repo.db().update("UPDATE learning_flows SET answers=?::jsonb,stage='FEEDBACK',version=version+1 WHERE id=?",node.toString(),id);return view(repo.owned(user,id,false));
 }
 @Transactional public View practice(UUID user,UUID id){var f=repo.owned(user,id,true);if(!f.path("feedback_status").asText().equals("SUCCEEDED"))throw conflict();
  var child=repo.db().queryForList("SELECT id FROM learning_flows WHERE parent_id=?",UUID.class,id);if(!child.isEmpty())return view(repo.owned(user,child.getFirst(),false));
  return create(user,new Create(UUID.randomUUID(),f.path("task_catalog_id").asText(),f.path("flow_version").asText(),Mode.TRAINING),id,f.path("snapshot").path("artifact").asText());
 }
 public record Reservation(UUID token,String model,JsonNode input) {}
 @Transactional public Reservation reserve(UUID user,UUID id){var f=repo.owned(user,id,true);repo.expire(id);f=repo.owned(user,id,false);
  if(!f.path("stage").asText().equals("FEEDBACK"))throw conflict();
  if(f.path("feedback_status").asText().equals("SUCCEEDED"))return null;
  if(f.path("feedback_status").asText().equals("RUNNING"))throw new SessionFailure(409,"FLOW_EVALUATING");
  if(!settings.available())throw new SessionFailure(503,"FLOW_AI_NOT_CONFIGURED");
  if(f.path("feedback_attempts").asInt()>=3)throw new SessionFailure(429,"FLOW_EVALUATION_LIMIT");
  budget.reserveUser(user);UUID token=UUID.randomUUID();String model=f.path("model").isNull()?settings.model():f.path("model").asText();
  repo.db().update("UPDATE learning_flows SET feedback_status='RUNNING',feedback_token=?,feedback_started_at=now(),feedback_attempts=feedback_attempts+1,model=? WHERE id=?",token,model,id);
  var input=(ObjectNode)f.path("snapshot").deepCopy();var records=(ArrayNode)input.path("records");record(records,"decision","AI 패널을 닫은 뒤의 직접 설명 · 외부 도움 차단은 아님",f.path("answers").path("decision").asText());record(records,"change","조건 변경에 대한 직접 설명",f.path("answers").path("change").asText());
  input.put("promptVersion",f.path("prompt_version").asText());return new Reservation(token,model,input);
 }
 @Transactional public View finish(UUID user,UUID id,UUID token,JsonNode feedback){repo.owned(user,id,true);repo.expire(id);repo.db().update("UPDATE learning_flows SET feedback_status=?,feedback=?::jsonb,feedback_token=NULL WHERE id=? AND feedback_status='RUNNING' AND feedback_token=?",feedback==null?"FAILED":"SUCCEEDED",feedback==null?null:feedback.toString(),id,token);return view(repo.owned(user,id,false));}
}
