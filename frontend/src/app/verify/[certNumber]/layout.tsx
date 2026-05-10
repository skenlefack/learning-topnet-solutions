import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Certificate | AU-IBAR Learning',
  description: 'Verify the authenticity of an AU-IBAR Learning certification',
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-brand-navy via-brand-gold to-brand-maroon" />
      {children}
    </div>
  );
}
