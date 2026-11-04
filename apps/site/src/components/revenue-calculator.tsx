'use client';

import { useState } from 'react';

const money = (value: number) => '$' + Math.round(value).toLocaleString('en-US');
const plain = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const parse = (value: string) => {
  const number = parseFloat(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? number : NaN;
};

/**
 * Potential revenue, with the formula always on screen (settled decision 14): people
 * who reached high intent and did not pay, times the founder's list price. The default
 * values render on the server, so the example reads without JavaScript.
 */
export function RevenueCalculator() {
  const [signups, setSignups] = useState('400');
  const [share, setShare] = useState('6');
  const [price, setPrice] = useState('49');

  const s = parse(signups);
  const p = parse(price);
  const pct = Math.min(parse(share), 100);
  const valid = !Number.isNaN(s) && !Number.isNaN(p) && !Number.isNaN(pct);
  const total = valid ? s * (pct / 100) * p : 0;

  return (
    <form
      className="calc card"
      data-reveal
      aria-labelledby="calc-title"
      onSubmit={(event) => event.preventDefault()}
    >
      <p id="calc-title" className="calc__title">
        Try it with your numbers
      </p>
      <div className="calc__fields">
        <div className="field">
          <label htmlFor="calc-signups">Signups a month</label>
          <input
            id="calc-signups"
            name="signups"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={signups}
            onChange={(event) => setSignups(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="calc-share">Reach high intent but don’t pay (%)</label>
          <input
            id="calc-share"
            name="share"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={share}
            onChange={(event) => setShare(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="calc-price">Your monthly price ($)</label>
          <input
            id="calc-price"
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
      </div>
      <div className="calc__result">
        <output
          className="calc__out"
          htmlFor="calc-signups calc-share calc-price"
          aria-live="polite"
        >
          <span className="calc__amount" data-calc-amount>
            {valid ? money(total) : '—'}
          </span>
          <span className="calc__per">a month in potential revenue</span>
        </output>
        <p className="calc__formula mono" data-calc-formula>
          {valid
            ? `${plain(s)} × ${plain(pct)}% × $${plain(p)} = ${money(total)}`
            : 'Enter three numbers to see the formula.'}
        </p>
      </div>
      <p className="note">
        Your numbers, our formula. Dripmetric counts the actual people — and on Starter, tells you
        who they are.
      </p>
    </form>
  );
}
