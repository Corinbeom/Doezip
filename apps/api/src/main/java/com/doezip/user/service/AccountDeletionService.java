package com.doezip.user.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class AccountDeletionService {
    private final AccountDeletionStore store;
    private final IdentityDeletionGateway identities;
    private final String provider;

    public AccountDeletionService(AccountDeletionStore store, IdentityDeletionGateway identities,
            @Value("${app.auth.provider-id}") String provider) {
        this.store = store; this.identities = identities; this.provider = provider;
    }

    public void delete(Jwt jwt) {
        String subject = jwt.getSubject();
        boolean recovery = store.begin(provider, subject);
        try {
            identities.delete(subject, recovery);
        } catch (RuntimeException exception) {
            store.cancel(provider, subject);
            throw exception;
        }
        store.finish(provider, subject, subjectHash(provider, subject));
    }

    public boolean isRecentlyDeleted(String subject) {
        return store.isBlocked(subjectHash(provider, subject));
    }

    private String subjectHash(String provider, String subject) {
        try {
            byte[] input = (provider + "\0" + subject).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
