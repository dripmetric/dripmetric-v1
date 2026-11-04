import { SectionHead } from '@/components/ui/section-head';
import { CAPABILITIES } from '@/content/site';

/** 08 · Provider-neutral by design — what works before any money data arrives. */
export function NoBilling() {
  return (
    <section className="section section--paper2" id="no-billing" aria-labelledby="billing-title">
      <div className="wrap">
        <SectionHead
          n="06"
          kicker="Any billing provider, or none"
          id="billing-title"
          title="No billing integration. No Stripe required."
          lede={
            <>
              Dripmetric never connects to your billing provider. Payment events arrive like any
              other event — one <code>track()</code> call from your webhook handler, your database
              or your CDP — so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat and a
              hand-rolled billing table all work the same way.
            </>
          }
        />
        <div className="table-wrap" data-reveal>
          <table className="matrix">
            <caption className="visually-hidden">
              What works with product events alone, and what money events add
            </caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Product events alone</th>
                <th scope="col">With money events</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map(([capability, alone, withMoney]) => (
                <tr key={capability}>
                  <th scope="row">{capability}</th>
                  <td
                    className={alone === '—' ? undefined : 'yes'}
                    data-label="Product events alone"
                  >
                    {alone}
                  </td>
                  <td
                    className={withMoney === '—' ? undefined : 'yes'}
                    data-label="With money events"
                  >
                    {withMoney}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="callout">
          <strong>Money events are an upgrade in depth, not a gate.</strong> The “paid event” is one
          setting — which event means someone started paying. It defaults to{' '}
          <code>Subscription Started</code>. Add it in week two without redoing anything.
        </p>
      </div>
    </section>
  );
}
