-- 0003_queue_schema.sql — M1. The queue's own schema.
--
-- pg-boss keeps its tables in a schema of its own, which has two benefits: a dump and
-- restore of `public` stays clean, so leaving Supabase remains a dump and a restore
-- (settled decision 1), and the queue's tables never collide with ours.
--
-- The schema is created HERE, by the owner, rather than by pg-boss at startup.
-- Creating a schema needs CREATE on the DATABASE, and the application role must not
-- have that: it is the one privilege that would let it build itself a table outside
-- every row-level security policy we wrote. So the schema is made once, the role gets
-- CREATE on that schema alone, and the worker starts pg-boss with
-- `createSchema: false` (see apps/worker/src/queue.ts).

CREATE SCHEMA IF NOT EXISTS pgboss;

GRANT USAGE, CREATE ON SCHEMA pgboss TO dripmetric_app;

-- pg-boss creates and reads its own tables, sequences and types inside this schema.
GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO dripmetric_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pgboss TO dripmetric_app;

-- Tables pg-boss creates later belong to whoever created them, so these defaults
-- cover the case where a migration or an admin script creates one instead.
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL ON TABLES TO dripmetric_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL ON SEQUENCES TO dripmetric_app;

-- The queue holds no tenant data of its own: a job's payload names a project, and the
-- handler then opens a scoped transaction like everything else. So no row-level
-- security policy here; the scoping happens where the job is executed.
