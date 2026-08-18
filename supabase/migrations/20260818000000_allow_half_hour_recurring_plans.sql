ALTER TABLE public.recurring_plans
  ALTER COLUMN duration_hours TYPE NUMERIC(5,2)
  USING duration_hours::numeric,
  ALTER COLUMN duration_hours SET DEFAULT 2.00;
