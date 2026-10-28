'use client';

import { useActionState } from 'react';
import { createProjectAction, type NewProjectState } from './actions';

const initial: NewProjectState = { status: 'idle' };

const LABELS: Record<string, string> = {
  'publishable/live': 'Publishable key (live) — goes in your website',
  'secret/live': 'Secret key (live) — server only',
  'publishable/test': 'Publishable key (test)',
  'secret/test': 'Secret key (test) — server only',
};

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, initial);

  if (state.status === 'created') {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{state.projectName} is ready</h2>
        <p className="warn">
          Copy the two secret keys now. They are stored hashed, so this is the only time we can show
          them. The publishable keys you can always see again.
        </p>
        {state.keys.map((k) => (
          <div key={`${k.kind}/${k.mode}`}>
            <label>{LABELS[`${k.kind}/${k.mode}`]}</label>
            <code className="key">{k.token}</code>
          </div>
        ))}
        <p className="note">
          Test traffic goes to a separate project, so it never lands in your real numbers.
        </p>
        <p>
          <a href={`/projects/${state.publicId}`}>Open {state.projectName}</a>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card">
      <label htmlFor="name">What is the product called?</label>
      <input id="name" name="name" type="text" required maxLength={100} placeholder="Acme" />
      <p className="note">
        You will get four keys: one pair for your live site and one pair for testing.
      </p>
      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create project'}
      </button>
      {state.status === 'error' ? <p className="warn">{state.message}</p> : null}
    </form>
  );
}
