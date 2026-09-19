package com.doezip.user.controller;
import com.doezip.user.dto.*;
import com.doezip.user.service.UserService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/me")
public class UserController {
    private final UserService users;
    private final com.doezip.user.service.AccountDeletionService accountDeletion;
    public UserController(UserService users, com.doezip.user.service.AccountDeletionService accountDeletion) {
        this.users=users; this.accountDeletion=accountDeletion;
    }
    @GetMapping
    public ResponseEntity<UserResponse> get(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(users.get(jwt));
    }
    @PostMapping("/bootstrap")
    public ResponseEntity<UserResponse> bootstrap(@AuthenticationPrincipal Jwt jwt, @RequestBody BootstrapRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(users.bootstrap(jwt, request));
    }
    @PutMapping("/legal-acceptance")
    public ResponseEntity<UserResponse> acceptLegal(@AuthenticationPrincipal Jwt jwt,
            @jakarta.validation.Valid @RequestBody LegalAcceptanceRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(users.acceptLegal(jwt, request));
    }
    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt) {
        accountDeletion.delete(jwt);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
