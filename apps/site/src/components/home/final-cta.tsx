import Link from 'next/link';
import { SignupForm } from '@/components/signup-form';
import { CTA_LABEL, SITE } from '@/content/site';

/** The id of the closing form, which the sticky phone bar hides itself over. */
export const FINAL_CTA_ID = 'waitlist-final';

/**
 * The closing ask: the same one action, with what happens after it. No date and no
 * promise of when: invitations go out in weekly cohorts, and that is all that is certain.
 */
export function FinalCta() {
  return (
    <section className="cta-final" aria-labelledby="cta-title">
      <div className="wrap cta-final__inner">
        <h2 id="cta-title" className="h2">
          Join the private beta.
        </h2>
        <p className="lede">
          Founders are invited weekly, in small cohorts. Your invite brings your project keys and
          the install guide.
        </p>
        <SignupForm
          source="final"
          id={FINAL_CTA_ID}
          endpoint={SITE.waitlistEndpoint}
          contactEmail={SITE.contactEmail}
          label={CTA_LABEL}
          noteId="final-note"
        >
          <p className="signup__fine" id="final-note">
            We use your email only to let you in and to share launch news.{' '}
            <Link prefetch={false} href="/privacy">
              Privacy
            </Link>
            . Questions? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </p>
        </SignupForm>
      </div>
    </section>
  );
}
