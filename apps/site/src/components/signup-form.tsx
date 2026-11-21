'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { waitlistMessage, type WaitlistOutcome } from '@/content/waitlist-messages';

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * The waitlist form: one field, one button.
 *
 * It POSTs `email` and `source` as an ordinary `application/x-www-form-urlencoded`
 * body: to the site's own /api/waitlist on Vercel, or to NEXT_PUBLIC_WAITLIST_ENDPOINT
 * when that is set (src/content/site.ts). With neither (the static export) it opens a
 * pre-filled email to the contact address. Without JavaScript the browser submits the
 * same form natively, to the same place, and the endpoint answers with a small page.
 *
 * What the visitor reads afterwards comes from src/content/waitlist-messages.ts, the
 * same words the endpoint uses, so "closed", "check your address" and "on the list"
 * read the same with or without JavaScript.
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
  /** The id of a note under the form that the field should point screen readers to. */
  noteId?: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  // An https:// URL, or a path on this site such as /api/waitlist.
  const configured = /^(https:\/\/\S+|\/\S*)$/i.test(endpoint);
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
      .then(async (response) => {
        if (response.ok) {
          setStatus(null);
          setJoined(true);
          return;
        }
        // The site's endpoint names the problem; anything else is a generic failure.
        const answer = (await response.json().catch(() => null)) as { error?: string } | null;
        const known: WaitlistOutcome[] = [
          'waitlist_closed',
          'email_invalid',
          'email_disposable',
          'rate_limited',
        ];
        const outcome = known.find((code) => code === answer?.error) ?? 'waitlist_unavailable';
        const message = waitlistMessage(outcome, contactEmail);
        if (outcome === 'email_invalid' || outcome === 'email_disposable') {
          setInvalid(true);
          input.focus();
        }
        setStatus({ tone: 'error', text: `${message.title} ${message.body}` });
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
    const done = waitlistMessage('joined', contactEmail);
    return (
      <div className="signup signup--done" id={id} role="status">
        <p className="signup__done-title">{done.title}</p>
        <p>{done.body}</p>
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
          aria-describedby={noteId || undefined}
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
