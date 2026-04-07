import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <SignIn />
      </div>
    </main>
  );
}
