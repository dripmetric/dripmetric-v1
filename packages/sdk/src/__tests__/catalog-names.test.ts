import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOG_EVENTS_BY_NAME } from '@dripmetric/catalog';

/**
 * The SDK's event names, checked against the real catalog.
 *
 * The PUBLISHED package does not import the catalog: it carries Zod schemas and 76
 * event definitions, and this bundle has a 5 KB gzipped budget. The catalog is a
 * devDependency, used by this test only, and `files: ["dist"]` keeps it out of the
 * tarball. So the dozen names the SDK sends are string literals in
 * `src/shared/types.ts`.
 *
 * That trade needs this test. A typo in one of those literals would reach a founder's
 * dashboard as an event that can never be mapped — it would sit in the Inbox forever
 * looking like their own custom event, and nothing else would notice.
 */
const SDK_TYPES = join(dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'types.ts');

describe('the names the SDK hardcodes', () => {
  it('are all real catalog events', async () => {
    const source = await readFile(SDK_TYPES, 'utf8');

    // Every quoted event name in the AUTO_EVENTS object, plus the core's PAGE_LEFT.
    const block = /export const AUTO_EVENTS = \{([\s\S]*?)\} as const;/.exec(source);
    expect(block, 'AUTO_EVENTS was not found; has the SDK been restructured?').not.toBeNull();

    const pageLeft = /export const PAGE_LEFT = '([^']+)'/.exec(source)?.[1];
    expect(pageLeft, 'PAGE_LEFT was not found').toBeDefined();

    // One entry refers to PAGE_LEFT rather than repeating the literal, because the
    // core imports that name on its own to stay inside its size budget.
    const names = [...block![1]!.matchAll(/:\s*(?:'([^']+)'|PAGE_LEFT)/g)].map(
      (m) => m[1] ?? pageLeft!,
    );

    expect(names.length, 'the SDK should send 12 automatic events').toBe(12);

    for (const name of names) {
      expect(
        CATALOG_EVENTS_BY_NAME.has(name),
        `the SDK sends "${name}", which is not in the catalog. A typo here would sit ` +
          `in a founder's Inbox forever, looking like one of their own events.`,
      ).toBe(true);
    }
  });

  it('are exactly the twelve the brief says the snippet captures', async () => {
    const source = await readFile(SDK_TYPES, 'utf8');
    const block = /export const AUTO_EVENTS = \{([\s\S]*?)\} as const;/.exec(source);
    const names = [...block![1]!.matchAll(/:\s*(?:'([^']+)'|PAGE_LEFT)/g)].map(
      (m) => m[1] ?? 'Page Left',
    );

    // brief Appendix A: "The snippet captures 18 context fields and 12 behaviour
    // events on its own."
    expect(names.sort()).toEqual(
      [
        'Page Viewed',
        'Page Left',
        'Signup Started',
        'Form Started',
        'Form Submitted',
        'Form Abandoned',
        'Form Error',
        'Pricing Interaction',
        'Plan Selected',
        'Rage Click',
        'Dead Click',
        'Slow Page',
      ].sort(),
    );
  });
});
