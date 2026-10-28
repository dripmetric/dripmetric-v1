// Dev-only defaults so a developer can run `pnpm test` without first writing a .env.
// CLAUDE.md rule 3: tests never call a paid API, so the Anthropic and Resend keys stay empty.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://dripmetric_app:dripmetric_app@localhost:54329/dripmetric';
process.env.ADMIN_DATABASE_URL ??= 'postgres://dripmetric:dripmetric@localhost:54329/dripmetric';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.AUTH_SECRET ??= 'test-only-auth-secret-0000000000000000000000';
process.env.ENCRYPTION_KEYS ??= 'k1:ZGV2LW9ubHktMzItYnl0ZS1rZXktZm9yLWxvY2FsISE=';
process.env.LOG_LEVEL ??= 'silent';
