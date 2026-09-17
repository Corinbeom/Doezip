package com.doezip.user.service;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.stereotype.Component;
@Component
public class CurrentUser {
    private final UserService users;
    public CurrentUser(UserService users) { this.users=users; }
    public UUID id(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token) || !token.isAuthenticated())
            throw new InsufficientAuthenticationException("Authentication required");
        return users.get(token.getToken()).id();
    }
    public void requireOwner(Authentication authentication, UUID ownerId) {
        if (!id(authentication).equals(ownerId)) throw new UserNotFoundException();
    }
}
