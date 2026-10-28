import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

/** What went wrong with a link, in the founder's words rather than ours. */
const PROBLEMS: Record<string, string> = {
  unknown: 'That link is not one of ours. Ask for a new one below.',
  expired: 'That link has expired. Links last 15 minutes; ask for a new one below.',
  used: 'That link has already been used. Ask for a new one below.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { problem } = await searchParams;
  const message = problem ? PROBLEMS[problem] : undefined;

  return (
    <>
      <h1>Sign in to Dripmetric</h1>
      <p className="lede">No password. We email you a link that works once.</p>
      {message ? <p className="warn">{message}</p> : null}
      <LoginForm />
    </>
  );
}
