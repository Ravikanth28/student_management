import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from './Toast';
import { AchievementForm } from './AchievementForm';
import { PlacementForm } from './PlacementForm';
import { proxiedImage } from '../lib/img';
import { PERIOD_SCHEDULE, minutesLate } from '../lib/lateSchedule';
import { LATE_PERIOD_LABELS, DISCIPLINE_REASONS, type LatePeriod, type Student } from '../types';

type Props = { student: Student; onClose: () => void };
type Step = 'choose' | 'late' | 'discipline' | 'achievement' | 'placement' | 'late-done' | 'discipline-done';

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
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  // Date of the late record — defaults to today (IST), but can be changed.
  const [date, setDate] = useState(() => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  // Live period timings (editable in Settings); fall back to the static defaults.
  const [schedule, setSchedule] = useState<Record<string, string>>(PERIOD_SCHEDULE);

  // Discipline state
  const [discReason, setDiscReason] = useState<string>('Improper Haircut');
  const [discCustomReason, setDiscCustomReason] = useState<string>('');
  const [discDetails, setDiscDetails] = useState<string>('');
  const [discDate, setDiscDate] = useState(() => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [discTime, setDiscTime] = useState(() => new Date().toTimeString().slice(0, 5));

  useEffect(() => {
    api.get<{ schedule: Record<string, string> }>('/settings/period-schedule')
      .then((res) => setSchedule(res.data.schedule))
      .catch(() => { /* keep defaults */ });
  }, []);

  const photo = proxiedImage(student.photo_url);

  const markLate = async () => {
    if (!period) return;
    setSaving(true);
    try {
      await api.post('/late-records', { student_id: student.id, period, time, date });
      success('Marked late', `${student.name} — ${LATE_PERIOD_LABELS[period]} at ${time}`);
      setStep('late-done');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not mark late', msg ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const markDiscipline = async () => {
    const finalReason = discReason === 'Others' ? (discCustomReason.trim() || 'Others') : discReason;
    if (!finalReason) {
      toastError('Validation Error', 'Please select or enter a reason.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/discipline-records', {
        student_id: student.id,
        reason: finalReason,
        details: discDetails.trim() || (discReason === 'Others' ? undefined : discCustomReason.trim() || undefined),
        date: discDate,
        time: discTime,
      });
      success('Discipline record saved', `${student.name} — ${finalReason}`);
      setStep('discipline-done');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not save discipline record', msg ?? 'Please try again.');
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 6 }} onClick={() => setStep('late')}>
                ⏰<span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Late Comer</span>
              </button>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 6 }} onClick={() => setStep('discipline')}>
                ⚠️<span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Discipline</span>
              </button>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 6 }} onClick={() => setStep('achievement')}>
                🏆<span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Achievement</span>
              </button>
              <button className="btn btn-outline btn-lg" style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 6 }} onClick={() => setStep('placement')}>
                💼<span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Placement</span>
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
            <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                  Date
                </label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                  Coming (arrival) time
                </label>
                <input type="time" className="form-control" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 160 }} />
              </div>
              {period && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', paddingBottom: 8 }}>
                  Scheduled <strong>{schedule[period]}</strong>
                  {' · '}
                  <span style={{ color: minutesLate(schedule[period], time) > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                    {minutesLate(schedule[period], time)} min late
                  </span>
                </div>
              )}
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
              {student.name} — {period ? LATE_PERIOD_LABELS[period] : ''}{time ? ` at ${time}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/students/${student.id}`)}>View student record</button>
              <button className="btn btn-outline" onClick={onClose}>Scan next</button>
            </div>
          </div>
        )}

        {/* Step: discipline */}
        {step === 'discipline' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Record Discipline Issue</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'block' }}>
                Select Issue / Violation
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {DISCIPLINE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn ${discReason === r ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setDiscReason(r)}
                  >
                    {r === 'Improper Haircut' && '💇‍♂️ '}
                    {r === 'Not clean-shaven' && '🪒 '}
                    {r === 'Improper Uniform' && '👔 '}
                    {r === 'Others' && '📝 '}
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {discReason === 'Others' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                  Specify Reason / Issue *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. ID Card missing, improper footwear..."
                  value={discCustomReason}
                  onChange={(e) => setDiscCustomReason(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                Remarks / Additional Details (Optional)
              </label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Enter any extra details or action taken..."
                value={discDetails}
                onChange={(e) => setDiscDetails(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                  Date
                </label>
                <input type="date" className="form-control" value={discDate} onChange={(e) => setDiscDate(e.target.value)} style={{ maxWidth: 170 }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
                  Time
                </label>
                <input type="time" className="form-control" value={discTime} onChange={(e) => setDiscTime(e.target.value)} style={{ maxWidth: 160 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setStep('choose')} disabled={saving}>Back</button>
              <button className="btn btn-primary" onClick={markDiscipline} disabled={saving}>{saving ? 'Saving…' : 'Save Discipline Record'}</button>
            </div>
          </>
        )}

        {/* Step: discipline done */}
        {step === 'discipline-done' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 4px' }}>Discipline Record Saved</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 18 }}>
              {student.name} — {discReason === 'Others' ? discCustomReason : discReason}
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

        {/* Step: placement */}
        {step === 'placement' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Add placement</div>
            <PlacementForm student={student} onSuccess={onClose} onCancel={() => setStep('choose')} />
          </>
        )}
      </div>
    </div>
  );
}
