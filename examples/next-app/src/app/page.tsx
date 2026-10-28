import { SignupForm } from './signup-form';

export default function HomePage() {
  return (
    <>
      <h1>Ledgerly</h1>
      <p>
        An example app that sends the four events every Dripmetric number depends on:{' '}
        <code>Signed Up</code>, <code>Activated</code>, <code>Checkout Started</code> and{' '}
        <code>Subscription Started</code> — all from the server, where ad blockers and a declined
        consent banner cannot stop them.
      </p>
      <SignupForm />
    </>
  );
}
