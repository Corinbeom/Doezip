package com.doezip.session.controller;

import com.doezip.session.dto.DocumentDtos.*;
import com.doezip.session.service.DocumentService;
import com.doezip.user.service.CurrentUser;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions/{id}/document-versions")
public class DocumentController {
 @org.springframework.beans.factory.annotation.Autowired private com.doezip.learning.repository.FlowRepository flowRecords;
    private final DocumentService documents;
    private final CurrentUser user;
    public DocumentController(DocumentService documents, CurrentUser user) { this.documents = documents; this.user = user; }
    @PostMapping
    public ResponseEntity<Document> submit(Authentication auth, @PathVariable UUID id, @RequestBody Create body) {
        documents.list(user.id(auth),id);flowRecords.legacyOnly(id);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(documents.submit(user.id(auth), id, body));
    }
    @GetMapping
    public ResponseEntity<Documents> list(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(documents.list(user.id(auth), id));
    }
}
