import type { ScopedDb } from '@dripmetric/db';
import type { ProductDefinition } from './types.js';

/**
 * Configures a project from a product definition: the funnel, its steps, the URL
 * rules and the event-name mappings a founder would confirm at setup.
 *
 * Without this the engines have nothing to read. Step state only exists for steps
 * that are declared, so a run against an unconfigured project records no stalls at
 * all — the simulator reported 0 of 126 stalls visible until this existed, which is
 * exactly the kind of silent zero the truth file is there to catch.
 *
 * The real setup flow a founder walks through is M5. This is the same data, applied
 * directly, so M6 to M8 can be verified before that flow exists.
 */
export async function configureProject(db: ScopedDb, definition: ProductDefinition): Promise<void> {
  const funnel = await db.one<{ id: number }>(
    `INSERT INTO funnels (project_id, name, is_active) VALUES ($1, 'Onboarding', true) RETURNING id`,
    [db.projectId],
  );

  for (const [position, step] of definition.steps.entries()) {
    let urlRuleId: number | null = null;

    if (step.urlPattern) {
      const rule = await db.one<{ id: number }>(
        `INSERT INTO url_rules (project_id, pattern, canonical, step_label, is_key_page, position)
         VALUES ($1, $2, 'Onboarding Step Viewed', $3, true, $4)
         RETURNING id`,
        [db.projectId, step.urlPattern, step.label, position],
      );
      urlRuleId = rule.id;
    }

    await db.exec(
      `INSERT INTO funnel_steps
         (project_id, funnel_id, position, label, event_name, url_rule_id, importance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        db.projectId,
        funnel.id,
        position,
        step.label,
        step.eventName,
        urlRuleId,
        // Every step before Activated starts as Key (brief section 8.1).
        position < definition.steps.length - 1 ? 'key' : 'key',
      ],
    );
  }

  // The pricing rule, so a pricing page view becomes Pricing Viewed with no code.
  await db.exec(
    `INSERT INTO url_rules (project_id, pattern, canonical, is_key_page, position)
     VALUES ($1, '/pricing', 'Pricing Viewed', true, 100)
     ON CONFLICT DO NOTHING`,
    [db.projectId],
  );

  /*
   * The founder's own name for their core action, mapped to Core Action.
   *
   * This is the mapping the event dictionary exists for: the products send
   * "Invoice Sent", "Board Created" and "Webhook Delivered", and the engines only
   * ever read canonical names (brief section 7). The row is pre-created as
   * confirmed, which is what the founder clicking "yes, that is our core action"
   * will do in the M5 flow.
   */
  await db.exec(
    `INSERT INTO event_names (project_id, raw_name, canonical, status, confidence)
     VALUES ($1, $2, 'Core Action', 'confirmed', 'high')
     ON CONFLICT (project_id, raw_name)
       DO UPDATE SET canonical = 'Core Action', status = 'confirmed'`,
    [db.projectId, definition.coreActionName],
  );
}
