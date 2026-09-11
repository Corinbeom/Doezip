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
    private final ChallengeRunRepository runs;
    public ChallengeService(SessionRepository sessions,DocumentRepository documents,ChallengeTemplateRepository templates,
        ChallengeStatementRepository statements,ChallengeRunRepository runs){
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
            run.getLockVersion(),lines.stream().map(s->new Statement(s.getId(),s.getStatementKey(),s.getSortOrder(),s.getText())).toList(),List.of(),run.getSubmittedAt());
    }
    private static SessionFailure unavailable(){return new SessionFailure(503,"CHALLENGE_UNAVAILABLE");}
}
