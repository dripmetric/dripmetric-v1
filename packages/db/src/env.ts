import { z } from 'zod';

/**
 * Environment validation. Fails loudly at startup rather than at the first query,
 * so a missing variable is a clear message and not a null dereference in production.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  /** The worker needs a direct or session connection: pg-boss uses advisory locks,
   *  LISTEN/NOTIFY and long transactions, which the transaction pooler does not
   *  support (brief section 12). Falls back to DATABASE_URL in dev. */
  WORKER_DATABASE_URL: z.string().optional(),
  /** Envelope-encryption keys: `<keyId>:<base64 32-byte key>`, comma-separated.
   *  The first encrypts; all of them decrypt, so a key rotates without a backfill. */
  ENCRYPTION_KEYS: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
  /** M13 guard: in production, live projects need the founder's confirmation that
   *  backups exist (settled decision 1). */
  BACKUPS_CONFIRMED: z.string().optional(),
});

export type DbEnv = z.infer<typeof EnvSchema>;

let cached: DbEnv | undefined;

export function dbEnv(): DbEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment is not usable:\n${problems}\n\nCopy .env.example to .env.`);
  }
  cached = parsed.data;
  return cached;
}

/** Tests build a fresh env after changing process.env. */
export function resetDbEnvCache(): void {
  cached = undefined;
}
