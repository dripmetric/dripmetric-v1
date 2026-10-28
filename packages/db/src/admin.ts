/**
 * @dripmetric/db/admin — the surface the request path must NOT be able to reach.
 *
 * Migrations, a schema reset and the `.env` loader all touch the filesystem and the
 * schema itself. They belong to the migrate CLI, the worker and the tests, not to a
 * Next.js route handler, and keeping them out of the main entry point means the web
 * bundle cannot pull them in by accident.
 */
export { runMigrations, loadMigrations, resetDatabase, MIGRATIONS_DIR } from './migrate.js';
export type { Migration, MigrateResult } from './migrate.js';
export { loadRootEnv } from './load-env.js';
