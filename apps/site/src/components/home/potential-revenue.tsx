import { RevenueCalculator } from '@/components/revenue-calculator';

/** 07 · A dollar figure at the founder's own price, with the formula on screen. */
export function PotentialRevenue() {
  return (
    <section className="section" id="potential-revenue" aria-labelledby="money-title">
      <div className="wrap money">
        <header className="section-head money__head" data-reveal>
          <p className="kicker">
            <span className="kicker__n">05</span> Put a price on it
          </p>
          <h2 id="money-title" className="h2">
            A dollar figure, at your own price.
          </h2>
          <p className="lede">
            Send one paid event and Dripmetric puts money on every leak: the people who reached high
            intent and didn’t pay, times your list price. The formula is always on screen, never
            hidden behind a model.
          </p>
        </header>
        <RevenueCalculator />
      </div>
    </section>
  );
}
