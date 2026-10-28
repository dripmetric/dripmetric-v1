'use client';

import { useActionState } from 'react';
import { requestLinkAction, type LoginState } from './actions';

const initial: LoginState = { status: 'idle' };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestLinkAction, initial);

  if (state.status === 'sent') {
    return (
      <div className="card">
        <p>
          <strong>Check your email.</strong> If {state.email} has an account, or is about to have
          one, a sign-in link is on its way. It expires in 15 minutes.
        </p>
        {state.devLink ? (
          <>
            <p className="note">
              No email provider is configured, so the link is below instead of in your inbox.
            </p>
            <a className="key" href={state.devLink}>
              {state.devLink}
            </a>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="card">
      <label htmlFor="email">Your email address</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a link'}
      </button>
      {state.status === 'error' ? <p className="warn">{state.message}</p> : null}
    </form>
  );
}
