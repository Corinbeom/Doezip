package com.doezip.auth;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.oauth2.jwt.JwtException;
import static org.assertj.core.api.Assertions.*;

class AuthConfigTest {
    private final AuthConfig config = new AuthConfig();
    @Test void disabledAuthFailsClosedWithoutRequiringExternalSettings() {
        var decoder = config.jwtDecoder(false, "", "", "", "", new MockEnvironment());
        assertThatThrownBy(() -> decoder.decode("untrusted")).isInstanceOf(JwtException.class);
    }
    @Test void configuredAuthRequiresHttpsAndProviderIdentity() {
        for (String url : new String[]{"", "relative", "http://127.0.0.1:1234", "https://user:password@example.com"}) {
            assertThatThrownBy(() -> config.jwtDecoder(true, url, "https://example.com/jwks", "authenticated", "doezip", new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(() -> config.jwtDecoder(true, "https://example.com", url, "authenticated", "doezip", new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class);
        }
        assertThatThrownBy(() -> config.jwtDecoder(true, "https://example.com", "https://example.com/jwks", "authenticated", "", new MockEnvironment()))
            .isInstanceOf(IllegalStateException.class);
    }
    @Test void unreachableJwksCannotAuthenticate() throws Exception {
        var environment = new MockEnvironment(); environment.setActiveProfiles("test");
        // Reserve then close a local port; no third-party identity server is involved.
        int port;
        try (var socket = new java.net.ServerSocket(0, 0, java.net.InetAddress.getByName("127.0.0.1"))) { port=socket.getLocalPort(); }
        String issuer = "http://127.0.0.1:" + port;
        var decoder = config.jwtDecoder(true, issuer, issuer + "/jwks", "authenticated", "doezip", environment);
        var key = new RSAKeyGenerator(2048).keyID("unreachable").generate();
        var claims = new JWTClaimsSet.Builder().issuer(issuer).audience("authenticated").subject("learner")
            .expirationTime(Date.from(Instant.now().plusSeconds(300))).claim("role", "authenticated").build();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(key));
        assertThatThrownBy(() -> decoder.decode(jwt.serialize())).isInstanceOf(JwtException.class);
    }
}
