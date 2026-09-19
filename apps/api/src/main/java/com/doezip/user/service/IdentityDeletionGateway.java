package com.doezip.user.service;

public interface IdentityDeletionGateway {
    void delete(String subject, boolean allowMissing);
}
