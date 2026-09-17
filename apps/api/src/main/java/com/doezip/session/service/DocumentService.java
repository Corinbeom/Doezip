package com.doezip.session.service;

import com.doezip.session.dto.DocumentDtos.*;
import com.doezip.session.entity.DocumentVersion;
import com.doezip.session.repository.DocumentRepository;
import com.doezip.session.repository.SessionRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DocumentService {
    private final com.doezip.chat.repository.ChatRepository chat;
    private final SessionRepository sessions;
    private final DocumentRepository documents;
    public DocumentService(SessionRepository sessions, DocumentRepository documents, com.doezip.chat.repository.ChatRepository chat) {
        this.chat=chat;this.sessions = sessions; this.documents = documents;
    }
    public Documents list(UUID userId, UUID sessionId) {
        sessions.findByIdAndUserId(sessionId, userId).orElseThrow(SessionFailure::missing);
        return new Documents(documents.findBySessionIdOrderByVersionNoAsc(sessionId).stream().map(Document::from).toList());
    }
    @Transactional
    public Document submit(UUID userId, UUID sessionId, Create request) {
        if (request == null) throw SessionFailure.invalid();
        // Share the draft's lock: saving and sealing cannot race past state/CAS checks.
        var session = sessions.lockOwned(sessionId, userId).orElseThrow(SessionFailure::missing);
        if (!"INITIAL".equals(request.checkpoint())) throw new SessionFailure(409, "INVALID_SESSION_STATE");
        var previous = documents.findBySessionIdAndCheckpoint(sessionId, "INITIAL");
        if (previous.isPresent()) {
            var submitted = previous.get();
            if (submitted.getSourceDraftLockVersion() == request.expectedDraftLockVersion()
                && submitted.getContentHash().equals(request.expectedContentHash())) return Document.from(submitted);
            throw new SessionFailure(409, "DOCUMENT_ALREADY_SUBMITTED");
        }
        chat.expire(sessionId);
        if(chat.active(sessionId).isPresent())throw new SessionFailure(409,"MESSAGE_IN_PROGRESS");
        if (!session.writable()) throw new SessionFailure(409, "INVALID_SESSION_STATE");
        if (session.getLockVersion() != request.expectedDraftLockVersion()) throw new SessionFailure(409, "DRAFT_VERSION_CONFLICT");
        String hash = SessionService.hash(session.getMarkdown());
        if (!hash.equals(request.expectedContentHash())) throw new SessionFailure(409, "DRAFT_CONTENT_CONFLICT");
        if (session.getMarkdown().codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c)))
            throw new SessionFailure(422, "EMPTY_DOCUMENT");
        var document = documents.save(new DocumentVersion(session, hash));
        session.submitInitial();
        return Document.from(document);
    }
}
