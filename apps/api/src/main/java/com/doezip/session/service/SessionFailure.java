package com.doezip.session.service;
public class SessionFailure extends RuntimeException {
 public final int status; public final String code;
 public SessionFailure(int status,String code){this.status=status;this.code=code;}
 public static SessionFailure invalid(){return new SessionFailure(400,"INVALID_INPUT");}
 public static SessionFailure missing(){return new SessionFailure(404,"SESSION_NOT_FOUND");}
}
