import type { ReactNode } from 'react';
import { proxiedImage } from '../lib/img';
import { YEAR_LABELS, type Student } from '../types';

export type ActivityKpi = { label: string; value: ReactNode; tone?: 'default' | 'green' | 'red' | 'amber' };

const TONE: Record<string, { bg: string; fg: string }> = {
  default: { bg: 'var(--surface-2)', fg: 'var(--text)' },
  green: { bg: 'var(--green-light)', fg: 'var(--green)' },
  red: { bg: '#fee2e2', fg: '#b91c1c' },
  amber: { bg: 'var(--amber-light)', fg: 'var(--amber)' },
};

type Props = {
  student: Student | null;
  title: string;
  kpis: ActivityKpi[];
  loading?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Reusable "student activity" popup: avatar + identity header, KPI cards, then a table. */
export function StudentActivityModal({ student, title, kpis, loading, onClose, children }: Props) {
  const photo = student ? proxiedImage(student.photo_url) : null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 26px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              : <span style={{ fontSize: 20, fontWeight: 700 }}>{student?.name?.charAt(0) ?? '?'}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>{student?.name ?? '…'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {student?.enrollment_number && <span className="badge badge-gray">{student.enrollment_number}</span>}
              {student?.year && <span className="badge badge-blue">{YEAR_LABELS[student.year] ?? student.year}</span>}
              {student?.section && <span className="badge badge-purple">Sec {student.section}</span>}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={onClose}>Close</button>
        </div>

        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>{title}</div>

        {/* KPI cards */}
        {kpis.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
            {kpis.map((k) => {
              const t = TONE[k.tone ?? 'default'];
              return (
                <div key={k.label} style={{ padding: '10px 12px', borderRadius: 10, background: t.bg, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: t.fg }}>{k.value}</div>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-3)' }}>{k.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {loading ? <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Loading…</p> : children}
      </div>
    </div>
  );
}
