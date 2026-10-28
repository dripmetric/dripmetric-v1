import { notFound } from 'next/navigation';
import { mailbox, mailboxEnabled } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

/**
 * The console mailbox (brief M0: "a console mailbox in dev, Resend in production").
 * It exists only when no email provider is configured, so it cannot appear in
 * production, where RESEND_API_KEY is set.
 */
export default function MailboxPage() {
  if (!mailboxEnabled()) notFound();
  const messages = mailbox();

  return (
    <>
      <h1>Dev mailbox</h1>
      <p className="lede">
        Email we would have sent. This page exists only because no email provider is configured.
      </p>
      {messages.length === 0 ? (
        <p>Nothing yet.</p>
      ) : (
        messages.map((m, i) => (
          <div className="card" key={i}>
            <p className="note">
              {m.sentAt.toISOString()} — to {m.to}
            </p>
            <strong>{m.subject}</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.86rem' }}>{m.text}</pre>
          </div>
        ))
      )}
    </>
  );
}
