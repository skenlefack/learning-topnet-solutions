// ============================================================================
// AU-IBAR Learning — Dashboard Home (Server Component)
// Renders the client-side dashboard with initial data when available
// ============================================================================
import { cookies } from 'next/headers';
import DashboardClient from '../_components/DashboardClient';

export const dynamic = 'force-dynamic';

async function fetchInitial(token: string) {
  const base = process.env.INTERNAL_API_URL || 'http://academy-learning:4002';
  try {
    const res = await fetch(`${base}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('aris-token')?.value ?? null;

  // Pre-fetch when server-side auth cookie is available
  const initialDashboard = token ? await fetchInitial(token) : null;

  return <DashboardClient initialDashboard={initialDashboard} />;
}
