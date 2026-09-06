package com.doezip.shared;
public record ApiError(String code, String message, String requestId) {}
