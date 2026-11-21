import { SignupForm } from '@/components/signup-form';
import { CTA_LABEL, DEFINITION, SITE } from '@/content/site';
import { WAITLIST_ID } from './site-header';

/**
 * The first screen: the claim, one sentence of what Dripmetric is, and the form.
 *
 * Nothing else, not even reassurance ticks under the form (the founder removed them on
 * 21 Nov 2026). No illustration and no sample data: everything a visitor reads here is
 * something the product does today (apps/site/README.md, "One page, one job"). The verb
 * is "see", not "fix": Dripmetric finds and reports leaks; it does not act on them.
 */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__copy">
        <p className="pill">
          <span className="pill__status">Private beta</span>
          Revenue-leak detection for self-serve SaaS
        </p>
        <h1 id="hero-title" className="display">
          See where your signup funnel <span className="leak-word">leaks</span> revenue.
        </h1>
        <p className="lede">
          {DEFINITION} It watches your product and payment events, catches the moment a likely buyer
          stops, and tells you where it happened and what it is worth.
        </p>
        <SignupForm
          source="hero"
          id={WAITLIST_ID}
          endpoint={SITE.waitlistEndpoint}
          contactEmail={SITE.contactEmail}
          label={CTA_LABEL}
        />
      </div>
    </section>
  );
}
