-- Durable UTC-day call reservations. Network retries also consume a reservation.
CREATE TABLE evaluation_call_budgets (
 budget_day date NOT NULL, scope varchar(50) NOT NULL, calls integer NOT NULL CHECK(calls >= 0),
 PRIMARY KEY(budget_day,scope)
);
