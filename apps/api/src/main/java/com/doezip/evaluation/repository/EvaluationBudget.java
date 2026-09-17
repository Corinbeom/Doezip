package com.doezip.evaluation.repository;

import com.doezip.evaluation.adapter.EvaluationSettings;
import com.doezip.evaluation.adapter.EvaluationFailure;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class EvaluationBudget {
    private final JdbcTemplate db;
    private final EvaluationSettings settings;
    public EvaluationBudget(JdbcTemplate db,EvaluationSettings settings) { this.db=db;this.settings=settings; }
    @Transactional
    public void reserve(UUID session) {
        UUID user=db.queryForObject("SELECT user_id FROM learning_sessions WHERE id=?",UUID.class,session);
        reserveUser(user);
    }
    @Transactional
    public void reserveUser(UUID user) {
        increment("global",settings.globalLimit());
        increment("user:"+user,settings.dailyLimit());
    }
    private void increment(String scope,int maximum) {
        int changed=db.update("INSERT INTO evaluation_call_budgets(budget_day,scope,calls) VALUES ((clock_timestamp() AT TIME ZONE 'UTC')::date,?,1) ON CONFLICT(budget_day,scope) DO UPDATE SET calls=evaluation_call_budgets.calls+1 WHERE evaluation_call_budgets.calls<?",scope,maximum);
        if(changed!=1)throw new EvaluationFailure("EVALUATION_DAILY_LIMIT",false);
    }
}
