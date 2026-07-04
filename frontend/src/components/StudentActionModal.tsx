import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from './Toast';
import { AchievementForm } from './AchievementForm';
import { proxiedImage } from '../lib/img';
import { LATE_PERIOD_LABELS, type LatePeriod, type Student } from '../types';

type Props = { student: Student; onClose: () => void };
type Step = 'choose' | 'late' | 'achievement' | 'late-done';

const PERIODS: LatePeriod[] = ['morning', 'morning_break', 'lunch', 'evening_break'];

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

export function StudentActionModal({ student, onClose }: Props) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState<Step>('choose');
  const [period, setPeriod] = useState<LatePeriod | null>(null);
  const [saving, setSaving] = useState(false);

  const photo = proxiedImage(student.photo_url);

  const markLate = async () => {
    if (!period) return;
    setSaving(true);
    try {
      await api.post('/late-records', { student_id: student.id, period });
      success('Marked late', `${student.name} — ${LATE_PERIOD_LABELS[period]}`);
      setStep('late-done');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not mark late', msg ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 28px)' }}>
        {/* Student header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <span style={{ fontSize: 22, fontWeight: 700 }}>{student.name.charAt(0)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{student.name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span className="badge badge-blue">{student.department}</span>
              <span className="badge badge-gray">{student.batch}</span>
              <span className="badge badge-navy">Sec {student.section}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <Info label="Enrollment No." value={student.enrollment_number} />
          <Info label="Register No." value={student.register_number} />
        </div>

        {/* Step: choose */}
        {step === 'choose' && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 10 }}>What would you like to do?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '18px 12px', gap: 8 }} onClick={() => setStep('late')}>
                ⏰<span style={{ fontWeight: 700 }}>Late Comer</span>
              </button>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '18px 12px', gap: 8 }} onClick={() => setStep('achievement')}>
                🏆<span style={{ fontWeight: 700 }}>Achievement</span>
              </button>
            </div>
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {/* Step: late */}
        {step === 'late' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10 }}>Mark late for which period?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PERIODS.map((p) => (
                <button key={p} className={`btn ${period === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriod(p)}>
                  {LATE_PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => { setStep('choose'); setPeriod(null); }} disabled={saving}>Back</button>
              <button className="btn btn-primary" onClick={markLate} disabled={!period || saving}>{saving ? 'Marking…' : 'Mark late'}</button>
            </div>
          </>
        )}

        {/* Step: late done */}
        {step === 'late-done' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 4px' }}>Marked late</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 18 }}>
              {student.name} — {period ? LATE_PERIOD_LABELS[period] : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/students/${student.id}`)}>View student record</button>
              <button className="btn btn-outline" onClick={onClose}>Scan next</button>
            </div>
          </div>
        )}

        {/* Step: achievement */}
        {step === 'achievement' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Add achievement</div>
            <AchievementForm
              initialMembers={[student]}
              lockedIds={[student.id]}
              onSuccess={onClose}
              onCancel={() => setStep('choose')}
            />
          </>
        )}
      </div>
    </div>
  );
}
