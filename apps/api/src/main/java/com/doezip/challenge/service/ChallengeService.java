package com.doezip.challenge.service;
import com.doezip.challenge.dto.ChallengeDtos.*;
import com.doezip.challenge.entity.*;
import com.doezip.challenge.repository.*;
import com.doezip.session.repository.*;
import com.doezip.session.service.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.doezip.challenge.dto.ChallengeDtos.NOTICE_VERSION;
@Service @Transactional(readOnly=true)
public class ChallengeService {
    private final SessionRepository sessions; private final DocumentRepository documents;
    private final ChallengeTemplateRepository templates; private final ChallengeStatementRepository statements;
    private final ChallengeRunRepository runs; private final ReviewRepository reviews; private final SessionService materialService;
    public ChallengeService(SessionRepository sessions,DocumentRepository documents,ChallengeTemplateRepository templates,
        ChallengeStatementRepository statements,ChallengeRunRepository runs,ReviewRepository reviews,SessionService materialService){
        this.reviews=reviews;this.materialService=materialService;
        this.sessions=sessions;this.documents=documents;this.templates=templates;this.statements=statements;this.runs=runs;
    }
    @Transactional public Run start(UUID userId,UUID sessionId,Notice notice){
        if(notice==null||!notice.acknowledged()||!NOTICE_VERSION.equals(notice.noticeVersion()))throw SessionFailure.invalid();
        var session=sessions.lockOwned(sessionId,userId).orElseThrow(SessionFailure::missing);
        var existing=runs.findBySessionId(sessionId);
        if(existing.isPresent())return view(existing.get());
        if(!session.getStatus().equals("ACTIVE")||!session.getCurrentStep().equals("CHALLENGE")
            ||documents.findBySessionIdAndCheckpoint(sessionId,"INITIAL").isEmpty())throw new SessionFailure(409,"INVALID_SESSION_STATE");
        var template=templates.findFirstByTaskIdOrderByIdAsc(session.getTaskId()).orElseThrow(ChallengeService::unavailable);
        var run=new ChallengeRun(session,template.getId(),notice.noticeVersion());
        Run response=view(run); // Validate assigned content before persisting the acknowledgement.
        runs.save(run);return response;
    }
    public Run get(UUID userId,UUID runId){
        var run=runs.findById(runId).orElseThrow(()->new SessionFailure(404,"CHALLENGE_NOT_FOUND"));
        sessions.findByIdAndUserId(run.getSessionId(),userId).orElseThrow(()->new SessionFailure(404,"CHALLENGE_NOT_FOUND"));
        return view(run);
    }
    private Run view(ChallengeRun run){
        var template=templates.findById(run.getTemplateId()).orElseThrow(ChallengeService::unavailable);
        var lines=statements.findByTemplateIdOrderBySortOrderAsc(run.getTemplateId());
        String text=lines.stream().map(ChallengeStatement::getText).collect(Collectors.joining("\n"));
        if(lines.isEmpty()||!SessionService.hash(text).equals(template.getContentHash()))throw unavailable();
        return new Run(run.getId(),run.getSessionId(),template.getTitle(),template.getInstructions(),run.getNoticeVersion(),run.getStatus(),
            run.getLockVersion(),lines.stream().map(s->new Statement(s.getId(),s.getStatementKey(),s.getSortOrder(),s.getText())).toList(),reviews.find(run.getId()),run.getSubmittedAt());
    }
    private com.doezip.challenge.entity.ChallengeRun locked(UUID user,UUID id){
        var sessionId=runs.sessionId(id).orElseThrow(()->new SessionFailure(404,"CHALLENGE_NOT_FOUND"));
        var session=sessions.lockOwned(sessionId,user).orElseThrow(()->new SessionFailure(404,"CHALLENGE_NOT_FOUND"));
        // All challenge mutations serialize on the session and run, in this order.
        var run=runs.lockById(id).orElseThrow(()->new SessionFailure(404,"CHALLENGE_NOT_FOUND"));
        if(!session.getStatus().equals("ACTIVE")||!session.getCurrentStep().equals("CHALLENGE"))throw new SessionFailure(409,"INVALID_SESSION_STATE");
        return run;
    }
    @Transactional public Run saveReviews(UUID user,UUID id,com.doezip.challenge.dto.ReviewDtos.Save input){
        if(input==null)throw SessionFailure.invalid();var run=locked(user,id);if(!run.getStatus().equals("IN_PROGRESS"))throw new SessionFailure(409,"CHALLENGE_SUBMITTED");
        checkVersion(run,input.expectedLockVersion());
        var allowed=statements.findByTemplateIdOrderBySortOrderAsc(run.getTemplateId()).stream().map(ChallengeStatement::getId).collect(Collectors.toSet());
        var previous=reviews.find(id).stream().collect(Collectors.toMap(com.doezip.challenge.dto.ReviewDtos.Review::statementId,r->r));
        Set<UUID> seen=new HashSet<>();List<com.doezip.challenge.dto.ReviewDtos.Review> result=new ArrayList<>();
        for(var r:input.reviews()){
            if(blank(r.reasonText())||(r.decision().equals("KEEP")?r.replacementText()!=null:blank(r.replacementText())))throw new SessionFailure(422,"INVALID_REVIEW");
            if(!allowed.contains(r.statementId())||!seen.add(r.statementId()))throw new SessionFailure(422,"INVALID_REVIEW");
            var old=previous.get(r.statementId());List<com.doezip.challenge.dto.ReviewDtos.Evidence> evidence=new ArrayList<>();Set<String> ranges=new HashSet<>();
            for(var e:r.evidence()){
                String range=e.materialId()+":"+e.lineStart()+":"+e.lineEnd();
                if(!ranges.add(range))throw new SessionFailure(422,"INVALID_EVIDENCE");
                var material=materialService.material(user,run.getSessionId(),e.materialId());
                if(e.lineEnd()<e.lineStart()||e.lineEnd()>material.lines().size())throw new SessionFailure(422,"INVALID_EVIDENCE");
                String quote=material.lines().subList(e.lineStart()-1,e.lineEnd()).stream().map(l->l.text()).collect(Collectors.joining("\n"));
                UUID evidenceId=old==null?UUID.randomUUID():old.evidence().stream().filter(v->v.materialId().equals(e.materialId())&&v.lineStart()==e.lineStart()&&v.lineEnd()==e.lineEnd()).map(v->v.id()).findFirst().orElseGet(UUID::randomUUID);
                evidence.add(new com.doezip.challenge.dto.ReviewDtos.Evidence(evidenceId,e.materialId(),e.lineStart(),e.lineEnd(),quote,e.relation(),"USER","ACCEPTED",e.userNote()));
            }
            result.add(new com.doezip.challenge.dto.ReviewDtos.Review(old==null?UUID.randomUUID():old.id(),r.statementId(),r.decision(),r.reasonText(),r.replacementText(),evidence));
        }
        reviews.replace(id,run.getTemplateId(),result);run.saved();return view(run);
    }
    @Transactional public Run submit(UUID user,UUID id,com.doezip.challenge.dto.ReviewDtos.Submit input){
        if(input==null)throw SessionFailure.invalid();var run=locked(user,id);if(run.getStatus().equals("SUBMITTED"))return view(run);
        checkVersion(run,input.expectedLockVersion());run.submit();return view(run);
    }
    private boolean blank(String text){return text==null||text.codePoints().allMatch(c->Character.isWhitespace(c)||Character.isSpaceChar(c));}
    private void checkVersion(ChallengeRun run,long version){if(run.getLockVersion()!=version||version==Long.MAX_VALUE)throw new SessionFailure(409,"CHALLENGE_VERSION_CONFLICT");}
    private static SessionFailure unavailable(){return new SessionFailure(503,"CHALLENGE_UNAVAILABLE");}
}
