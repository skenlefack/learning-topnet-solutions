// ============================================================================
// Topnet Solutions Academy — SYSTRAN Translation Proxy
// POST { text, source, target } → { translatedText }
// Keeps API key server-side
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

const SYSTRAN_URL = 'https://systran.topnet-solutions.com:8904';
const SYSTRAN_KEY = 'ea850eeb-4bf3-45d5-81b3-d0afe1bb172d';

export async function POST(req: NextRequest) {
  try {
    const { texts, source, target } = await req.json();

    if (!texts || !target) {
      return NextResponse.json({ error: 'Missing texts or target' }, { status: 400 });
    }

    // SYSTRAN /translation/text/translate endpoint
    const input = Array.isArray(texts) ? texts : [texts];

    const res = await fetch(`${SYSTRAN_URL}/translation/text/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${SYSTRAN_KEY}`,
      },
      body: JSON.stringify({
        input: input.map(t => ({ text: t })),
        source: source || 'auto',
        target,
      }),
      // Allow self-signed certs on internal server
      // @ts-ignore - Node.js fetch option
      ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? {} : {}),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'SYSTRAN error');
      console.error('[SYSTRAN] Error:', res.status, err);
      return NextResponse.json({ error: 'Translation service error' }, { status: 502 });
    }

    const data = await res.json();
    // SYSTRAN wraps output as JSON string: '{"text":"Hello"}' — unwrap it
    const translations = (data.outputs || []).map((o: any) => {
      const raw = o.output;
      if (typeof raw === 'string' && raw.startsWith('{')) {
        try { return JSON.parse(raw).text || raw; } catch { return raw; }
      }
      return raw;
    });

    return NextResponse.json({
      success: true,
      translations,
    });
  } catch (err: any) {
    console.error('[SYSTRAN] Exception:', err.message);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
