import { forwardToAutomation, joinWaitlist, markWaitlistForwarded } from '@dripmetric/db/waitlist';
import { after } from 'next/server';
import { SITE } from '@/content/site';
import { createRateLimiter, handleWaitlistPost } from '@/lib/waitlist-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const limiter = createRateLimiter();

export function POST(request: Request): Promise<Response> {
  return handleWaitlistPost(request, {
    env: process.env,
    now: () => new Date(),
    join: joinWaitlist,
    markForwarded: markWaitlistForwarded,
    forward: forwardToAutomation,
    later: (task) => after(task),
    limiter,
    contactEmail: SITE.contactEmail,
    homeUrl: SITE.homeUrl,
    log: (line) => console.log(JSON.stringify(line)),
  });
}
