// ============================================================================
// AU-IBAR Learning — Home Page (Server Component)
// Shows landing page for visitors, redirects authenticated users to dashboard
// ============================================================================
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LandingPage from './_components/LandingPage';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const cookieStore = cookies();
  const token = cookieStore.get('aris-token')?.value;

  if (token) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
