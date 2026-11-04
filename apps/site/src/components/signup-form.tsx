'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

/** Fired by the founding-seat button when no payment link is configured. */
export const FOUNDING_EVENT = 'dm:founding-seat';

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * The early-access form.
 *
 * With an endpoint configured (NEXT_PUBLIC_WAITLIST_ENDPOINT) it POSTs
 * `email`, `source` and `founding_seat` as an ordinary form body, which Formspree,
 * Loops, Buttondown, Tally and most form backends accept. Without one it opens a
 * pre-filled email to the contact address. Without JavaScript the browser submits
 * the same form natively, to the same place.
 */
export function SignupForm({
  source,
  idPrefix,
  endpoint,
  contactEmail,
  dark = false,
  foundingOption = false,
  noteId,
  children,
}: {
  source: 'hero' | 'final';
  idPrefix: string;
  endpoint: string;
  contactEmail: string;
  dark?: boolean;
  foundingOption?: boolean;
  noteId: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [founding, setFounding] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const configured = /^https:\/\/\S+$/i.test(endpoint);
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent('Dripmetric early access')}`;

  useEffect(() => {
    if (!foundingOption) return;
    const onFounding = () => {
      setFounding(true);
      window.setTimeout(() => email.current?.focus({ preventScroll: true }), 450);
    };
    window.addEventListener(FOUNDING_EVENT, onFounding);
    return () => window.removeEventListener(FOUNDING_EVENT, onFounding);
  }, [foundingOption]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = email.current;
    if (!input) return;
    const address = input.value.trim();
    input.value = address;
    if (!address || !input.checkValidity()) {
      setInvalid(true);
      setStatus({ tone: 'error', text: 'Enter an email address like you@yourcompany.com.' });
      input.focus();
      return;
    }
    setInvalid(false);

    const form = event.currentTarget;
    const trap = form.elements.namedItem('_gotcha');
    if (trap instanceof HTMLInputElement && trap.value) {
      setStatus({ tone: 'ok', text: 'You’re on the list.' });
      return;
    }

    if (!configured) {
      const body =
        'Please add me to the Dripmetric private beta.\r\n\r\nEmail: ' +
        address +
        '\r\nFounding seat: ' +
        (founding ? 'yes, I’d like one' : 'not now') +
        '\r\nSigned up from: ' +
        source;
      window.location.href =
        `mailto:${contactEmail}?subject=` +
        encodeURIComponent(`Dripmetric early access — ${address}`) +
        '&body=' +
        encodeURIComponent(body);
      setStatus({
        tone: 'ok',
        text: `Your email app should open with a ready-to-send message. If it doesn’t, write to ${contactEmail}.`,
      });
      return;
    }

    const data = new URLSearchParams({
      email: address,
      source,
      founding_seat: founding ? 'yes' : 'no',
    });
    setBusy(true);
    setStatus({ tone: 'ok', text: 'Sending…' });
    fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        form.reset();
        setFounding(false);
        setStatus({
          tone: 'ok',
          text: founding
            ? 'You’re on the list, and we’ve noted your interest in a founding seat. We’ll email you when your seat opens.'
            : 'You’re on the list. We’ll email you when your seat opens.',
        });
      })
      .catch(() =>
        setStatus({
          tone: 'error',
          text: `That didn’t go through. Please try again, or email ${contactEmail}.`,
        }),
      )
      .finally(() => setBusy(false));
  };

  const inputId = `${idPrefix}-email`;
  return (
    <form
      className={dark ? 'signup signup--dark' : 'signup'}
      id={`${idPrefix}-signup`}
      action={configured ? endpoint : mailto}
      method="post"
      encType={configured ? undefined : 'text/plain'}
      noValidate
      onSubmit={onSubmit}
    >
      <input type="hidden" name="source" value={source} />
      <label className="signup__label" htmlFor={inputId}>
        Your work email
      </label>
      <div className="signup__row">
        <input
          ref={email}
          className="signup__input"
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@yourcompany.com"
          required
          aria-describedby={noteId}
          aria-invalid={invalid || undefined}
          onInput={() => {
            if (invalid && email.current?.checkValidity()) {
              setInvalid(false);
              setStatus(null);
            }
          }}
        />
        <button
          className={dark ? 'btn btn--light' : 'btn btn--primary'}
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          Get early access
        </button>
      </div>
      {foundingOption ? (
        <label className="check">
          <input
            type="checkbox"
            name="founding_seat"
            value="yes"
            checked={founding}
            onChange={(event) => setFounding(event.target.checked)}
            data-founding-box
          />
          I’d like one of the 25 founding seats ($390 a year, locked for life).
        </label>
      ) : null}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${idPrefix}-gotcha`}>Leave this empty</label>
        <input
          id={`${idPrefix}-gotcha`}
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p
        className="signup__status"
        role="status"
        aria-live="polite"
        data-tone={status?.tone === 'error' ? 'error' : undefined}
      >
        {status?.text ?? ''}
      </p>
      {children}
    </form>
  );
}
