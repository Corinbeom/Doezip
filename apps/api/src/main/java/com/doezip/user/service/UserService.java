package com.doezip.user.service;
import com.doezip.user.dto.*;
import com.doezip.user.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class UserService {
    private final UserRepository users;
    private final String provider;
    private final Validator validator;
    public UserService(UserRepository users, @Value("${app.auth.provider-id}") String provider, Validator validator) {
        this.users=users; this.provider=provider; this.validator=validator;
    }
    @Transactional(readOnly=true)
    public UserResponse get(Jwt jwt) {
        return UserResponse.from(users.findByAuthProviderAndAuthSubject(provider, jwt.getSubject()).orElseThrow(UserNotFoundException::new));
    }
    @Transactional
    public UserResponse bootstrap(Jwt jwt, BootstrapRequest request) {
        String name = request.displayName();
        if (name != null && !validName(name)) throw new InvalidProfileException();
        if (name == null) {
            Object metadata = jwt.getClaims().get("user_metadata");
            Object candidate = metadata instanceof Map<?, ?> values ? values.get("full_name") : null;
            name = candidate instanceof String text && validName(text) ? text.strip() : "학습자";
        }
        Object claim = jwt.getClaims().get("email");
        String email = claim instanceof String text && !text.isBlank()
            && validator.validate(new EmailValue(text)).isEmpty() ? text : null;
        users.insertIfAbsent(UUID.randomUUID(), provider, jwt.getSubject(), name.strip(), email);
        return get(jwt);
    }
    private boolean validName(String value) {
        int count = value.codePointCount(0, value.length());
        return !value.isBlank() && count <= 80 && value.codePoints().noneMatch(c -> Character.isISOControl(c) || c >= 0xD800 && c <= 0xDFFF);
    }
    private record EmailValue(@Email @Size(max=320) String email) {}
}
