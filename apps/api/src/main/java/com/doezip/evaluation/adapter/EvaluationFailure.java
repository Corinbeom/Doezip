package com.doezip.evaluation.adapter;
/** Safe status only. Never propagate provider body, submitted input or credentials. */
public class EvaluationFailure extends RuntimeException {
    private final String code;
    private final boolean temporary;
    private final long retryAfterSeconds;
    public EvaluationFailure(String code, boolean temporary) { this(code,temporary,0); }
    public EvaluationFailure(String code, boolean temporary, long retryAfterSeconds) {
        super(code); this.code=code; this.temporary=temporary; this.retryAfterSeconds=retryAfterSeconds;
    }
    public String code() { return code; }
    public boolean temporary() { return temporary; }
    public long retryAfterSeconds() { return retryAfterSeconds; }
}
