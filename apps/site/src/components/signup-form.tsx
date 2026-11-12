'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * The waitlist form: one field, one button.
 *
 * With an endpoint configured (NEXT_PUBLIC_WAITLIST_ENDPOINT) it POSTs `email` and
 * `source` as an ordinary `application/x-www-form-urlencoded` body, which Formspree,
 * Loops, Buttondown, Tally and most form backends accept. Without one it opens a
 * pre-filled email to the contact address. Without JavaScript the browser submits the
 * same form natively, to the same place.
 *
 * Once someone is on the list the form is replaced by what happens next, so the page
 * never shows an empty box where a confirmation should be.
 */
export function SignupForm({
  source,
  id,
  endpoint,
  contactEmail,
  label,
  noteId,
  children,
}: {
  source: 'hero' | 'final';
  id: string;
  endpoint: string;
  contactEmail: string;
  label: string;
  noteId: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const configured = /^https:\/\/\S+$/i.test(endpoint);
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent('Dripmetric waitlist')}`;

  useEffect(() => {
    // Arriving from a "Join the waitlist" link puts the cursor in the field it points at.
    const focusIfTargeted = () => {
      if (window.location.hash === `#${id}`) email.current?.focus({ preventScroll: true });
    };
    focusIfTargeted();
    window.addEventListener('hashchange', focusIfTargeted);
    return () => window.removeEventListener('hashchange', focusIfTargeted);
  }, [id]);

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
      setJoined(true);
      return;
    }

    if (!configured) {
      const body =
        'Please add me to the Dripmetric waitlist.\r\n\r\nEmail: ' +
        address +
        '\r\nSigned up from: ' +
        source;
      window.location.href =
        `mailto:${contactEmail}?subject=` +
        encodeURIComponent(`Dripmetric waitlist: ${address}`) +
        '&body=' +
        encodeURIComponent(body);
      setStatus({
        tone: 'ok',
        text: `Your email app should open with a ready-to-send message. If it doesn’t, write to ${contactEmail}.`,
      });
      return;
    }

    const data = new URLSearchParams({ email: address, source });
    setBusy(true);
    setStatus({ tone: 'ok', text: 'Sending…' });
    fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus(null);
        setJoined(true);
      })
      .catch(() =>
        setStatus({
          tone: 'error',
          text: `That didn’t go through. Please try again, or email ${contactEmail}.`,
        }),
      )
      .finally(() => setBusy(false));
  };

  if (joined) {
    return (
      <div className="signup signup--done" id={id} role="status">
        <p className="signup__done-title">You’re on the list.</p>
        <p>
          We invite founders weekly, in small cohorts. Your invite and project keys will come to the
          address you gave us.
        </p>
      </div>
    );
  }

  const inputId = `${id}-email`;
  return (
    <form
      className="signup"
      id={id}
      action={configured ? endpoint : mailto}
      method="post"
      encType={configured ? undefined : 'text/plain'}
      noValidate
      onSubmit={onSubmit}
    >
      <input type="hidden" name="source" value={source} />
      <label className="signup__label" htmlFor={inputId}>
        Work email
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
          className="btn btn--primary"
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {label}
        </button>
      </div>
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${id}-gotcha`}>Leave this empty</label>
        <input id={`${id}-gotcha`} type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
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
