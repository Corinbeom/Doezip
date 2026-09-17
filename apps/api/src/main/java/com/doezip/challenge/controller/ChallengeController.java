package com.doezip.challenge.controller;
import com.doezip.challenge.dto.ChallengeDtos.*;
import com.doezip.challenge.service.ChallengeService;
import com.doezip.user.service.CurrentUser;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1")
public class ChallengeController {
    private final ChallengeService challenges;private final CurrentUser user;
    public ChallengeController(ChallengeService challenges,CurrentUser user){this.challenges=challenges;this.user=user;}
    @PostMapping("/sessions/{id}/challenge") public ResponseEntity<Run> start(Authentication auth,@PathVariable UUID id,@RequestBody Notice notice){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(challenges.start(user.id(auth),id,notice));
    }
    @GetMapping("/challenge-runs/{id}") public ResponseEntity<Run> get(Authentication auth,@PathVariable UUID id){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(challenges.get(user.id(auth),id));
    }
    @PutMapping("/challenge-runs/{id}/reviews") public ResponseEntity<Run> save(Authentication auth,@PathVariable UUID id,@RequestBody com.doezip.challenge.dto.ReviewDtos.Save input){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(challenges.saveReviews(user.id(auth),id,input));
    }
    @PostMapping("/challenge-runs/{id}/submit") public ResponseEntity<Run> submit(Authentication auth,@PathVariable UUID id,@RequestBody com.doezip.challenge.dto.ReviewDtos.Submit input){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(challenges.submit(user.id(auth),id,input));
    }
}
