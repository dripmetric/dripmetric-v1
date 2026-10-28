'use server';

import { z } from 'zod';
import { requestMagicLink } from '@/lib/auth';
import { mailbox, mailboxEnabled } from '@/lib/mailer';

export type LoginState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** `devLink` is only ever set when there is no email provider configured. */
  | { status: 'sent'; email: string; devLink?: string };

const Email = z.string().email().max(254);

export async function requestLinkAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = Email.safeParse(String(formData.get('email') ?? '').trim());
  if (!parsed.success)
    return { status: 'error', message: 'That does not look like an email address.' };

  const email = parsed.data.toLowerCase();
  await requestMagicLink(email);

  // The reply is the same whether or not the address is known, so it cannot be used
  // to find out who has an account.
  const state: LoginState = { status: 'sent', email };

  if (mailboxEnabled()) {
    // Development only: surface the link so `pnpm dev` needs no email account.
    const link = mailbox()
      .find((m) => m.to === email)
      ?.text.match(/https?:\/\/\S+/)?.[0];
    if (link) return { ...state, devLink: link };
  }
  return state;
}
