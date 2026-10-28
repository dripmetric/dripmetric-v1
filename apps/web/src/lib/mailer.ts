import { webEnv, isProduction } from './env';

/**
 * Our own system email: login links, alert digests and the weekly report
 * (settled decision D5, Resend). The founder's own email provider is for end-user
 * mail in a later layer.
 *
 * In development and in tests there is no API key, so mail goes to a console mailbox
 * instead. That keeps `pnpm dev` working with no account and keeps CLAUDE.md rule 3
 * honest: tests never call a paid API.
 */

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SentEmail extends Email {
  sentAt: Date;
  via: 'resend' | 'console';
}

/** The dev mailbox. Kept in memory so `/dev/mailbox` can show the last magic link. */
const consoleMailbox: SentEmail[] = [];
const MAILBOX_LIMIT = 50;

export function mailbox(): readonly SentEmail[] {
  return consoleMailbox;
}

export async function sendEmail(email: Email): Promise<SentEmail> {
  const env = webEnv();

  if (!env.RESEND_API_KEY) {
    const sent: SentEmail = { ...email, sentAt: new Date(), via: 'console' };
    consoleMailbox.unshift(sent);
    consoleMailbox.length = Math.min(consoleMailbox.length, MAILBOX_LIMIT);
    console.log(
      `\n─── email (console mailbox: no RESEND_API_KEY) ───\nto: ${email.to}\nsubject: ${email.subject}\n\n${email.text}\n──────────────────────────────────────────────────\n`,
    );
    return sent;
  }

  // Resend's REST API, called directly: one fetch is less to maintain than an SDK.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend refused the email (${response.status}): ${detail.slice(0, 300)}`);
  }
  return { ...email, sentAt: new Date(), via: 'resend' };
}

/** Dev-only helper for the mailbox page. */
export function mailboxEnabled(): boolean {
  return !isProduction() && !webEnv().RESEND_API_KEY;
}
