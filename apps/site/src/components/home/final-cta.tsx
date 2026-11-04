import { SignupForm } from '@/components/signup-form';
import { SITE } from '@/content/site';

/** 14 · The closing ask, with the founding-seat option. */
export function FinalCta() {
  return (
    <section className="section section--ink cta-final" id="get-access" aria-labelledby="cta-title">
      <div className="wrap cta-final__inner">
        <h2 id="cta-title" className="h2 cta-final__title">
          Find your first leak this week.
        </h2>
        <p className="lede">
          Dripmetric is in private beta. We’re letting founders in weekly, in small cohorts — and
          the free plan stays free, forever.
        </p>
        <SignupForm
          source="final"
          idPrefix="final"
          endpoint={SITE.waitlistEndpoint}
          contactEmail={SITE.contactEmail}
          noteId="final-email-note"
          dark
          foundingOption
        >
          <p className="signup__fine" id="final-email-note">
            We use your email only to let you in and to share launch news. Questions?{' '}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </p>
        </SignupForm>
      </div>
    </section>
  );
}
