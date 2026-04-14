import { Metadata } from 'next';
import VerifyClient from './VerifyClient';

// ---------------------------------------------------------------------------
// SSR — fetch certificate data + generate OG meta
// ---------------------------------------------------------------------------

const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://academy-assessment:4003';

interface CertData {
  certificate_number: string;
  status: string;
  level: string;
  issued_at: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  course_title: Record<string, string> | string;
  qr_code_data?: string;
  pdf_url?: string;
}

async function fetchCert(certNumber: string): Promise<CertData | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/verify/${certNumber}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

function getTitle(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.en || text.fr || Object.values(text)[0] || '';
}

// ---------------------------------------------------------------------------
// Generate OG metadata for social sharing
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { certNumber: string };
}): Promise<Metadata> {
  const cert = await fetchCert(params.certNumber);

  if (!cert) {
    return {
      title: 'Certificate Not Found | AU-IBAR Learning',
      description: 'This certificate could not be verified.',
    };
  }

  const holderName = `${cert.first_name} ${cert.last_name}`;
  const courseTitle = getTitle(cert.course_title);

  return {
    title: `${holderName} — ${courseTitle} | AU-IBAR Certification`,
    description: `Verified ARIS Academy certification (${cert.level}) for ${holderName}. Certificate ${cert.certificate_number}, issued ${new Date(cert.issued_at).toLocaleDateString('en')}.`,
    openGraph: {
      title: `ARIS Certification — ${holderName}`,
      description: `${courseTitle} (${cert.level}) — Verified by AU-IBAR Learning`,
      siteName: 'AU-IBAR Learning',
      type: 'website',
      url: `https://learning.au-ibar.org/verify/${cert.certificate_number}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component (Server Component)
// ---------------------------------------------------------------------------

export default async function VerifyPage({
  params,
}: {
  params: { certNumber: string };
}) {
  const cert = await fetchCert(params.certNumber);

  return <VerifyClient cert={cert} certNumber={params.certNumber} />;
}
