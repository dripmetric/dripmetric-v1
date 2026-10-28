-- 0001_foundations.sql — M0. Founder accounts, projects, keys, plans, audit log.
--
-- Settled decision D2: plain Postgres only, no Supabase-specific features, so leaving
-- Supabase is a dump and a restore. Nothing here uses an extension Supabase adds.
--
-- Every tenant table gets: a project_id, RLS enabled and FORCED, and a deny-by-default
-- policy keyed on the `app.project_id` setting that packages/db's withProject() sets.
-- The scoped helper is the real guard; RLS is the backstop that catches a mistake
-- (brief section 4).

-- ---------------------------------------------------------------------------
-- The application role. It is NOT the owner, so RLS actually applies to it.
-- The migrate CLI gives it a login password in development; in production the
-- password is set out of band (see docs/runbook.md).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dripmetric_app') THEN
    CREATE ROLE dripmetric_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO dripmetric_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dripmetric_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dripmetric_app;

-- ---------------------------------------------------------------------------
-- plans — tiers mapped to features and limits, read by can(project, feature).
-- Not tenant data: every project reads the same rows.
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  code            text PRIMARY KEY,
  name            text NOT NULL,
  -- Money in minor units plus a currency code, like Stripe (brief section 2).
  price_amount    integer NOT NULL,
  price_currency  text NOT NULL DEFAULT 'usd',
  price_interval  text NOT NULL DEFAULT 'month',
  features        jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The free and paid levels of brief section 2. Free must be useful on its own, so it
-- carries everything except who, why and what to do.
INSERT INTO plans (code, name, price_amount, features, limits) VALUES
  ('free', 'Observe', 0, jsonb_build_object(
      'reveal_identity',   false,
      'why_signals',       false,
      'suggested_actions', false,
      'full_timeline',     false,
      'cohort_table',      false,
      'segment_splits',    true,     -- free in the latest plan (brief section 2)
      'instant_alerts',    true,
      'weekly_report',     true,
      'tracking_health',   true,
      'change_proof',      true
    ), jsonb_build_object(
      'retention_days',          90,       -- settled decision 4
      'reveal_allowance',        0,        -- the switch for "100 free names" later
      'change_window_days_max',  45,       -- brief section 9, Changes
      'instant_alerts_per_day',  10
    )),
  ('starter', 'Starter', 2499, jsonb_build_object(
      'reveal_identity',   true,
      'why_signals',       true,
      'suggested_actions', true,
      'full_timeline',     true,
      'cohort_table',      true,
      'segment_splits',    true,
      'instant_alerts',    true,
      'weekly_report',     true,
      'tracking_health',   true,
      'change_proof',      true
    ), jsonb_build_object(
      'retention_days',          390,      -- 13 months
      'reveal_allowance',        -1,       -- -1 means no limit
      'change_window_days_max',  365,
      'instant_alerts_per_day',  10
    ));

-- ---------------------------------------------------------------------------
-- founder_users / founder_sessions / magic_link_tokens — our own customers.
-- Login is by magic link, no password (brief section 9).
-- These are OUR account records, not tenant data, so they carry no project_id.
-- ---------------------------------------------------------------------------
CREATE TABLE founder_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE UNIQUE INDEX founder_users_email_key ON founder_users (lower(email));

CREATE TABLE founder_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES founder_users (id) ON DELETE CASCADE,
  -- Only the hash is stored; the cookie holds the token itself.
  token_hash  bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
CREATE UNIQUE INDEX founder_sessions_token_hash_key ON founder_sessions (token_hash);
CREATE INDEX founder_sessions_user_id_idx ON founder_sessions (user_id);

CREATE TABLE magic_link_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token_hash  bytea NOT NULL,
  -- Set when the link claims an unclaimed project from the email-only signup (M12).
  project_id  integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE UNIQUE INDEX magic_link_tokens_token_hash_key ON magic_link_tokens (token_hash);
CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens (lower(email));

-- ---------------------------------------------------------------------------
-- projects — the tenant. A 4-byte integer id is the foreign key everywhere else,
-- because it is repeated on every event row; the uuid is what appears in URLs.
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id              integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  public_id       uuid NOT NULL DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  plan_code       text NOT NULL DEFAULT 'free' REFERENCES plans (code),
  -- IANA zone. Used for "Monday morning", quiet hours and working hours (brief section 12).
  timezone        text NOT NULL DEFAULT 'UTC',
  -- A test project is a sibling row linked to its live project (brief section 4).
  mode            text NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
  live_project_id integer REFERENCES projects (id) ON DELETE CASCADE,
  -- Validated by Zod in packages/db/src/settings.ts; changes go to the audit log.
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Per-project secret for the masking tag (settled decision 6). Envelope-encrypted
  -- with the key named by masking_secret_key_id, like every other stored secret.
  masking_secret        bytea NOT NULL,
  masking_secret_key_id text NOT NULL,
  -- Email-only instant projects expire unless a magic link claims them (brief section 9).
  claimed_at      timestamptz,
  claim_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT projects_test_has_parent CHECK (
    (mode = 'live' AND live_project_id IS NULL) OR
    (mode = 'test' AND live_project_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX projects_public_id_key ON projects (public_id);
CREATE UNIQUE INDEX projects_live_sibling_key ON projects (live_project_id) WHERE mode = 'test';

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- Which founders may see which projects.
CREATE TABLE project_members (
  project_id  integer NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES founder_users (id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_id_idx ON project_members (user_id);

-- ---------------------------------------------------------------------------
-- api_keys — publishable (write-only, origin-restricted) and secret (hashed, shown
-- once, rotatable). Brief section 5.
-- ---------------------------------------------------------------------------
CREATE TABLE api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    integer NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('publishable', 'secret')),
  mode          text NOT NULL CHECK (mode IN ('live', 'test')),
  -- sha256 of the token. Ingest looks a key up by this, never by the token itself.
  lookup_hash   bytea NOT NULL,
  -- Publishable keys are public by design (they sit in the founder's HTML), so the
  -- token is kept so the snippet can be shown again. Secret keys keep NULL here:
  -- they are shown once at creation and never again.
  token         text,
  -- For display: "sk_live_...a1b2".
  last_four     text NOT NULL,
  name          text NOT NULL DEFAULT 'default',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  CONSTRAINT api_keys_secret_is_hashed CHECK (kind = 'publishable' OR token IS NULL)
);
CREATE UNIQUE INDEX api_keys_lookup_hash_key ON api_keys (lookup_hash);
CREATE INDEX api_keys_project_id_idx ON api_keys (project_id);

-- ---------------------------------------------------------------------------
-- audit_log — settings changes, key events, reveals and deletions (brief section 10).
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  project_id  integer REFERENCES projects (id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES founder_users (id) ON DELETE SET NULL,
  -- 'settings.changed', 'key.created', 'key.revoked', 'user.revealed', 'user.deleted', ...
  action      text NOT NULL,
  subject     text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_project_created_idx ON audit_log (project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security, deny by default.
--
-- current_setting('app.project_id', true) is NULL unless withProject() set it, and a
-- NULL comparison is not true, so a query that forgot the scope returns nothing
-- rather than another tenant's rows. FORCE makes this apply to the table owner too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_project_id() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.project_id', true), '')::integer
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'project_members', 'api_keys', 'audit_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- `projects` keys on its own id; the others on project_id.
CREATE POLICY projects_scoped ON projects
  USING (id = app_current_project_id())
  WITH CHECK (id = app_current_project_id());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_members', 'api_keys', 'audit_log'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (project_id = app_current_project_id()) WITH CHECK (project_id = app_current_project_id())',
      t || '_scoped', t);
  END LOOP;
END
$$;

-- Some work is genuinely cross-project: creating a project, logging a founder in,
-- the worker sweeping every project. Those paths run as the owner with
-- `app.bypass_rls` set, through withoutProject() in packages/db, which is a named,
-- audited escape hatch rather than an accident.
CREATE OR REPLACE FUNCTION app_rls_bypassed() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on'
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'project_members', 'api_keys', 'audit_log'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_rls_bypassed()) WITH CHECK (app_rls_bypassed())',
      t || '_bypass', t);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dripmetric_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dripmetric_app;
