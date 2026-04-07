import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <SignUp />
      </div>
    </main>
  );
}
