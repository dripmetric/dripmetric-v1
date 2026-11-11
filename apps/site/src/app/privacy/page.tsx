import type { Metadata } from 'next';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';
import { SITE } from '@/content/site';
import { OPEN_GRAPH } from '@/lib/metadata';

export const metadata: Metadata = {
  title: { absolute: 'Privacy on dripmetric.com — Dripmetric' },
  description:
    'dripmetric.com sets no cookies and runs no analytics or third-party scripts. A waitlist email address is used only to let you in and share launch news.',
  alternates: {
    canonical: SITE.privacyUrl,
    types: { 'text/markdown': `${SITE.origin}/privacy.md` },
  },
  openGraph: { ...OPEN_GRAPH, url: SITE.privacyUrl, title: 'Privacy on dripmetric.com' },
};

export const dynamic = 'force-static';

/**
 * A plain-language notice for this website only, written the way the founder app's
 * legal placeholders are: it states what the code does and says it is not lawyer-reviewed.
 */
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader nav={false} />
      <main id="main" className="page">
        <div className="wrap">
          <p className="kicker">Last updated 4 November 2026</p>
          <h1>Privacy on dripmetric.com</h1>
          <p>
            This notice covers this website only — not the Dripmetric product. It is written in
            plain language to describe what this site actually does. It has not been reviewed by a
            lawyer.
          </p>

          <h2>What this site does not do</h2>
          <ul>
            <li>It sets no cookies and stores nothing in your browser.</li>
            <li>It runs no analytics, advertising or tracking scripts.</li>
            <li>
              It loads nothing from other companies: fonts, styles and scripts are served from this
              domain.
            </li>
          </ul>

          <h2>What the hosting provider sees</h2>
          <p>
            Like any website, this one is served by a hosting provider, which may keep standard
            request logs — for example your IP address, browser type and the page you asked for — to
            keep the site running and secure. We don’t use those logs to identify or follow you.
          </p>

          <h2>If you join the waitlist</h2>
          <p>
            We receive the email address you type, which form you used, and whether you asked about
            a founding seat. Depending on how you sign up, it reaches us through the service we use
            to manage the waitlist, or as an email from your own email app. We use it only to let
            you into the beta and to share launch news, and we don’t sell it or share it with anyone
            else.
          </p>

          <h2>Getting your details removed</h2>
          <p>
            Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> and we will delete
            your address from the waitlist.
          </p>
        </div>
      </main>
      <SiteFooter full={false} />
    </>
  );
}
