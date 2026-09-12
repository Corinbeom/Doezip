package com.doezip.evaluation.controller;
import com.doezip.evaluation.repository.ReportRepository;
import com.doezip.session.service.SessionFailure;
import com.doezip.user.service.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController
public class ReportController {
 private final ReportRepository reports;private final CurrentUser user;
 public ReportController(ReportRepository reports,CurrentUser user){this.reports=reports;this.user=user;}
 @GetMapping("/api/v1/reports/{id}") public ResponseEntity<JsonNode> get(Authentication auth,@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.owned(id,user.id(auth)).orElseThrow(()->new SessionFailure(404,"REPORT_NOT_FOUND")));}
}
