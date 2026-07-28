/**
 * ServerWakeup.tsx
 *
 * Wraps the entire app. On first mount it pings /health.
 *   • If the server responds → renders children normally (zero visible delay).
 *   • If the server is suspended / unreachable → shows a friendly animated
 *     "Server is waking up…" screen and auto-retries every 5 s until it comes back.
 *
 * This covers the Render.com free-tier "This service has been suspended." blank
 * page that Android users see when the service spun down.
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

const HEALTH_URL = `${API_BASE_URL}/health`;
const RETRY_INTERVAL_MS = 5_000;
const MAX_WAIT_SECONDS = 90; // realistic upper bound for Render cold-start

type Status = 'checking' | 'awake' | 'sleeping';

// ── tiny inline SVG icons ──────────────────────────────────────────────────
function SpinnerIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      style={{ animation: 'sw-spin 1.1s linear infinite' }}
    >
      <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
      <path
        d="M28 6a22 22 0 0 1 22 22"
        stroke="url(#sw-grad)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="sw-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#cg)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: 4 }}
    >
      <defs>
        <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── main component ─────────────────────────────────────────────────────────
export function ServerWakeup({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    const ok = await pingHealth();
    if (!mountedRef.current) return;
    if (ok) {
      setStatus('awake');
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    } else {
      setStatus('sleeping');
      setAttempt((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // First check immediately
    check();

    // Retry every RETRY_INTERVAL_MS
    timerRef.current = setInterval(check, RETRY_INTERVAL_MS);

    // Elapsed-seconds counter (shown in the wakeup UI)
    elapsedRef.current = setInterval(() => {
      if (mountedRef.current) setElapsed((s) => s + 1);
    }, 1_000);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── render: server is up (or still checking for the very first time) ──
  if (status === 'awake') return <>{children}</>;

  // ── render: initial silent check (< 1 s typically) ──
  // Show children immediately on first check so instant loads don't flash.
  // But if the server is confirmed sleeping, we override with the wakeup screen.
  if (status === 'checking' && attempt === 0) return <>{children}</>;

  // ── render: wakeup screen ──────────────────────────────────────────────
  const progress = Math.min((elapsed / MAX_WAIT_SECONDS) * 100, 98);
  const nextRetryIn = RETRY_INTERVAL_MS / 1000 - (elapsed % (RETRY_INTERVAL_MS / 1000));

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes sw-spin  { to { transform: rotate(360deg); } }
        @keyframes sw-pulse { 0%,100%{opacity:.6}50%{opacity:1} }
        @keyframes sw-float {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-8px)}
        }
        @keyframes sw-bar   { from{width:0%} to{width:${progress}%} }
        @keyframes sw-fadein{ from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        .sw-dot1{animation:sw-pulse 1.4s ease-in-out infinite}
        .sw-dot2{animation:sw-pulse 1.4s ease-in-out .2s infinite}
        .sw-dot3{animation:sw-pulse 1.4s ease-in-out .4s infinite}
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#0f1729 0%,#0d2045 50%,#0a0f2e 100%)',
          padding: '24px',
          fontFamily: "'Inter','Segoe UI',sans-serif",
          animation: 'sw-fadein .5s ease both',
        }}
      >
        {/* Glow blob */}
        <div
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(99,102,241,.25) 0%,transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Cloud icon */}
        <div style={{ animation: 'sw-float 3s ease-in-out infinite', marginBottom: 24 }}>
          <CloudIcon />
        </div>

        {/* Spinner */}
        <SpinnerIcon />

        {/* Headline */}
        <h1
          style={{
            marginTop: 28,
            marginBottom: 8,
            fontSize: 'clamp(1.2rem,5vw,1.6rem)',
            fontWeight: 800,
            color: '#f1f5f9',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          Server is waking up…
        </h1>

        {/* Sub-text */}
        <p
          style={{
            margin: '0 0 32px',
            fontSize: '0.88rem',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 1.6,
          }}
        >
          The server went to sleep to save energy. It will be ready in about{' '}
          <strong style={{ color: '#818cf8' }}>30–60 seconds</strong>.
          <br />
          No action needed — this page will open automatically.
        </p>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            maxWidth: 320,
            height: 6,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: 99,
              background: 'linear-gradient(90deg,#818cf8,#38bdf8)',
              transition: 'width 1s linear',
            }}
          />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: '0.78rem',
            color: '#64748b',
            marginBottom: 32,
          }}
        >
          <span>⏱ {elapsed}s elapsed</span>
          <span>🔄 Attempt {attempt}</span>
          <span>⏳ Next check in {Math.max(0, Math.ceil(nextRetryIn))}s</span>
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['sw-dot1', 'sw-dot2', 'sw-dot3'].map((cls) => (
            <div
              key={cls}
              className={cls}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#818cf8,#38bdf8)',
              }}
            />
          ))}
        </div>

        {/* Manual retry button */}
        <button
          type="button"
          onClick={() => { setAttempt(0); setElapsed(0); setStatus('checking'); check(); }}
          style={{
            marginTop: 28,
            padding: '10px 24px',
            borderRadius: 8,
            border: '1px solid rgba(129,140,248,.4)',
            background: 'rgba(129,140,248,.1)',
            color: '#818cf8',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all .2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(129,140,248,.22)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(129,140,248,.1)';
          }}
        >
          ↺ &nbsp;Retry Now
        </button>

        {/* Footer note */}
        <p style={{ marginTop: 40, fontSize: '0.7rem', color: '#334155', textAlign: 'center' }}>
          Hosted on Render free tier · auto-retrying every {RETRY_INTERVAL_MS / 1000}s
        </p>
      </div>
    </>
  );
}
