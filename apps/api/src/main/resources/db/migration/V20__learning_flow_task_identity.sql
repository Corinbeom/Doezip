ALTER TABLE learning_flows ADD COLUMN task_catalog_id varchar(80);

UPDATE learning_flows
SET task_catalog_id = CASE task_kind
  WHEN 'REPORT' THEN 'payment-delay-report'
  WHEN 'CODING' THEN 'item-identity-coding'
END;

ALTER TABLE learning_flows
  ALTER COLUMN task_catalog_id SET NOT NULL,
  ADD CONSTRAINT learning_flow_task_catalog_id_format
    CHECK (task_catalog_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE INDEX learning_flow_task_identity
  ON learning_flows(task_catalog_id, flow_version);
