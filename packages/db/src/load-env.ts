import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads the repo-root `.env`, if there is one, without overwriting anything already
 * set — so CI and production environments win over the committed dev defaults.
 *
 * It is called from entry points (the migrate CLI, the worker), never on import of a
 * library module: a package should not reach out and change the process. The web app
 * gets it from `pnpm dev`, because Next.js reads process.env.
 */
export function loadRootEnv(): boolean {
  // src/ when run through tsx, dist/ when built; the repo root is two levels up
  // from the package either way.
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const candidate of [
    join(packageRoot, '..', '..', '.env'),
    join(packageRoot, '..', '..', '..', '.env'),
  ]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return true;
    }
  }
  return false;
}
