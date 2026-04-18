'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type ProbeResult = {
  status?: number;
  ok?: boolean;
  body?: string;
  error?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function DebugPage() {
  const [origin, setOrigin] = useState('');
  const [isMiniKitInstalled, setIsMiniKitInstalled] = useState(false);
  const [session, setSession] = useState<string>('loading');
  const [versionResult, setVersionResult] = useState<ProbeResult | null>(null);
  const [chatResult, setChatResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setIsMiniKitInstalled(MiniKit.isInstalled());
    getSession()
      .then((value) => setSession(JSON.stringify(value, null, 2)))
      .catch((error) => setSession(error instanceof Error ? error.message : String(error)));
  }, []);

  async function probe(path: string, init?: RequestInit): Promise<ProbeResult> {
    try {
      const res = await fetch(`${apiBase}${path}`, init);
      return {
        status: res.status,
        ok: res.ok,
        body: await res.text(),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return (
    <main style={{ padding: 24, color: 'white', background: '#111', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Genie Local Debug</h1>

      <section style={{ display: 'grid', gap: 12, fontFamily: 'monospace', fontSize: 13 }}>
        <div>origin: {origin}</div>
        <div>NEXT_PUBLIC_API_URL: {apiBase || '(empty - same origin)'}</div>
        <div>version URL: {apiBase || origin}/api/version</div>
        <div>chat URL: {apiBase || origin}/api/chat</div>
        <div>MiniKit installed: {String(isMiniKitInstalled)}</div>
      </section>

      <section style={{ display: 'flex', gap: 12, margin: '24px 0', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={async () => setVersionResult(await probe('/api/version'))}
          style={{ padding: '12px 16px', background: '#fff', color: '#111', borderRadius: 8 }}
        >
          Test /api/version
        </button>
        <button
          type="button"
          onClick={async () => {
            setChatResult(await probe('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{ role: 'user', content: 'debug ping' }],
              }),
            }));
          }}
          style={{ padding: '12px 16px', background: '#fff', color: '#111', borderRadius: 8 }}
        >
          Test /api/chat
        </button>
      </section>

      <DebugBlock title="Session" value={session} />
      <DebugBlock title="Version Result" value={versionResult} />
      <DebugBlock title="Chat Result" value={chatResult} />
    </main>
  );
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          padding: 12,
          background: '#222',
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
