package com.doezip.user.service;

public class AccountDeletionUnavailableException extends RuntimeException {
    public AccountDeletionUnavailableException() { super("ACCOUNT_DELETION_UNAVAILABLE"); }
    AccountDeletionUnavailableException(Throwable cause) { super("ACCOUNT_DELETION_UNAVAILABLE", cause); }
}
