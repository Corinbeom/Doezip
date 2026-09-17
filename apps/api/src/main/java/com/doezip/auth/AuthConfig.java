package com.doezip.auth;

import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AuthConfig {
    @Bean
    JwtDecoder jwtDecoder(@Value("${app.auth.enabled}") boolean enabled,
            @Value("${app.auth.issuer}") String issuer, @Value("${app.auth.jwk-set-uri}") String jwks,
            @Value("${app.auth.audience}") String audience, @Value("${app.auth.provider-id}") String provider,
            Environment environment) {
        if (!enabled) return token -> { throw new BadJwtException("Authentication is not configured"); };
        boolean test = environment.acceptsProfiles(Profiles.of("test"));
        requireUrl(issuer, test); requireUrl(jwks, test);
        if (audience.isBlank() || !provider.matches("[A-Za-z0-9_-]{1,50}"))
            throw new IllegalStateException("Valid auth audience and provider-id are required");
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3)); factory.setReadTimeout(Duration.ofSeconds(3));
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks)
            .jwsAlgorithms(algorithms -> { algorithms.clear(); algorithms.add(SignatureAlgorithm.RS256); algorithms.add(SignatureAlgorithm.ES256); })
            .restOperations(new RestTemplate(factory)).build();
        OAuth2TokenValidator<Jwt> claims = jwt -> {
            Object role = jwt.getClaims().get("role");
            Object anonymous = jwt.getClaims().get("is_anonymous");
            String subject = jwt.getSubject();
            boolean valid = jwt.getExpiresAt() != null && jwt.getAudience() != null && jwt.getAudience().contains(audience)
                && subject != null && !subject.isBlank() && subject.length() <= 255
                && "authenticated".equals(role) && (anonymous == null || Boolean.FALSE.equals(anonymous));
            return valid ? OAuth2TokenValidatorResult.success() : OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "Invalid authentication claims", null));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(issuer), claims));
        return token -> {
            // Nimbus normalizes registered claims (e.g. numeric sub to String), so check raw types first.
            try {
                var source = com.nimbusds.jose.JWSObject.parse(token).getPayload().toJSONObject();
                if (source == null) throw new BadJwtException("Invalid authentication claims");
                Object audienceClaim = source.get("aud");
                boolean validAudienceType = audienceClaim instanceof String || audienceClaim instanceof java.util.Collection<?> values
                    && values.stream().allMatch(String.class::isInstance);
                if (!(source.get("sub") instanceof String) || !validAudienceType)
                    throw new BadJwtException("Invalid authentication claim types");
                return decoder.decode(token);
            } catch (java.text.ParseException exception) {
                throw new BadJwtException("Invalid authentication token");
            }
        };
    }
    private static void requireUrl(String value, boolean test) {
        try {
            URI uri = URI.create(value);
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null
                    || !("https".equals(uri.getScheme()) || (test && "http".equals(uri.getScheme())
                    && ("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost())))))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Auth issuer and JWKS must be absolute HTTPS URLs");
        }
    }
}
