import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS, type RosterStudent, type AttendanceDaySection, type AttendanceSummaryRow } from '../types';

type Props = { onLogout: () => void };

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const todayIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function AttendancePage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<'mark' | 'summary'>('mark');

  // ── Marking state ──
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [date, setDate] = useState(todayIST);
  const [pasted, setPasted] = useState('');
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [preview, setPreview] = useState(false);
  const [absentIds, setAbsentIds] = useState<Set<number>>(new Set());
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Day view ──
  const [day, setDay] = useState<AttendanceDaySection[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ year: string; section: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Summary ──
  const [sumFrom, setSumFrom] = useState('');
  const [sumTo, setSumTo] = useState('');
  const [sumYear, setSumYear] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);

  // Load roster when year + section chosen.
  useEffect(() => {
    if (!year || !section) { setRoster([]); return; }
    api.get<{ data: RosterStudent[] }>('/attendance/roster', { params: { year, section } })
      .then((r) => setRoster(r.data.data)).catch(() => setRoster([]));
  }, [year, section]);

  // Load the day register whenever the date changes (and after saving).
  const loadDay = () => api.get<{ data: AttendanceDaySection[] }>('/attendance/day', { params: { date } })
    .then((r) => setDay(r.data.data)).catch(() => setDay([]));
  useEffect(() => { void loadDay(); /* eslint-disable-next-line */ }, [date]);

  const loadSummary = () => api.get<{ data: AttendanceSummaryRow[] }>('/attendance/summary', {
    params: { from: sumFrom || undefined, to: sumTo || undefined, year: sumYear || undefined },
  }).then((r) => setSummary(r.data.data)).catch(() => setSummary([]));
  useEffect(() => { if (tab === 'summary') void loadSummary(); /* eslint-disable-next-line */ }, [tab, sumFrom, sumTo, sumYear]);

  const openPreview = () => {
    if (!year || !section) { toastError('Pick a class', 'Select the year and section first.'); return; }
    if (roster.length === 0) { toastError('No students', 'No students found for that year and section.'); return; }
    const lines = pasted.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    const matched = new Set<number>();
    const miss: string[] = [];
    for (const line of lines) {
      const n = norm(line);
      const hit = roster.find((s) => norm(s.name) === n)
        ?? roster.find((s) => norm(s.name).startsWith(n) || n.startsWith(norm(s.name)))
        ?? roster.find((s) => norm(s.name).includes(n) && n.length >= 4);
      if (hit) matched.add(hit.id); else miss.push(line);
    }
    setAbsentIds(matched);
    setUnmatched(miss);
    setPreview(true);
  };

  const toggle = (id: number) => setAbsentIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const confirmSave = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ present: number; absent: number }>('/attendance', {
        date, year, section, absentee_ids: [...absentIds],
      });
      success('Attendance saved', `${r.data.present} present, ${r.data.absent} absent.`);
      setPreview(false);
      setPasted('');
      await loadDay();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not save', msg ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeDay = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete('/attendance', { params: { date, year: deleteTarget.year, section: deleteTarget.section } });
      success('Attendance deleted', `Year ${deleteTarget.year} Sec ${deleteTarget.section} on ${date} removed.`);
      setDeleteTarget(null);
      await loadDay();
    } catch {
      toastError('Delete failed', 'Could not delete that attendance record.');
    } finally {
      setDeleting(false);
    }
  };

  // College-style layout: always show the four years as headings; each fills in
  // with its section rows for the selected date (or a "not taken" note).
  const dayByYear = useMemo(() => {
    const m = new Map<string, AttendanceDaySection[]>();
    for (const s of day) {
      const key = s.year ?? 'unset';
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    const baseYears = ['1', '2', '3', '4'];
    const extra = [...m.keys()].filter((k) => !baseYears.includes(k));
    return [...baseYears, ...extra.sort()].map((yr) => [yr, m.get(yr) ?? []] as [string, AttendanceDaySection[]]);
  }, [day]);

  const rosterSorted = useMemo(
    () => [...roster].sort((a, b) => Number(absentIds.has(b.id)) - Number(absentIds.has(a.id)) || a.name.localeCompare(b.name)),
    [roster, absentIds],
  );

  return (
    <Shell title="Daily Attendance" subtitle="Mark absentees, view the daily register, and track attendance %" onLogout={onLogout}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'mark' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('mark')}>Mark & Register</button>
        <button className={`btn ${tab === 'summary' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('summary')}>Summary</button>
      </div>

      {tab === 'mark' && (
        <>
          {/* Mark card */}
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>Mark attendance</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <label className="form-label">Year</label>
                <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)} style={{ minWidth: 130 }}>
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.filter((y) => y !== 'Alumni').map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Section</label>
                <select className="form-control" value={section} onChange={(e) => setSection(e.target.value)} style={{ minWidth: 110 }}>
                  <option value="">Select section</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                {year && section ? `${roster.length} students in the class` : ''}
              </div>
            </div>
            <label className="form-label">Paste absentees (one name per line)</label>
            <textarea
              className="form-control"
              rows={5}
              placeholder={'e.g.\nABINASH.S\nNIRANJAN.S'}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn btn-primary" type="button" onClick={openPreview} disabled={!year || !section}>Preview list</button>
            </div>
          </div>

          {/* College-style daily register — a box per year, filtered by date */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Daily register</h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', marginTop: 2 }}>Attendance grid for the selected date</p>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
              </div>
            </div>

            <div className="att-grid">
              {dayByYear.map(([yr, sections]) => (
                <div key={yr} style={{ minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {yr === 'unset' ? 'No year set' : (YEAR_LABELS[yr] ?? yr)}
                  </div>
                  {sections.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', padding: '14px' }}>No attendance taken on {date}.</p>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr><th>Sec</th><th>Present</th><th>Absent</th><th>Absentees</th><th></th></tr>
                        </thead>
                        <tbody>
                          {sections.map((s) => (
                            <tr key={s.section}>
                              <td><span className="badge badge-purple">{s.section}</span></td>
                              <td><span className="badge badge-green">{s.present}</span></td>
                              <td><span className="badge badge-red">{s.absent}</span></td>
                              <td style={{ fontSize: '0.78rem' }}>
                                {s.absentees.length === 0 ? <span style={{ color: 'var(--text-3)' }}>—</span>
                                  : s.absentees.map((a) => a.name).join(', ')}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  type="button"
                                  title="Delete this class's attendance for this date"
                                  onClick={() => setDeleteTarget({ year: String(s.year ?? yr), section: String(s.section ?? '') })}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'summary' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
            <div><label className="form-label">From</label><input type="date" className="form-control" value={sumFrom} onChange={(e) => setSumFrom(e.target.value)} style={{ maxWidth: 160 }} /></div>
            <div><label className="form-label">To</label><input type="date" className="form-control" value={sumTo} onChange={(e) => setSumTo(e.target.value)} style={{ maxWidth: 160 }} /></div>
            <div>
              <label className="form-label">Year</label>
              <select className="form-control" value={sumYear} onChange={(e) => setSumYear(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">All years</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Defaulter below %</label>
              <input type="number" className="form-control" value={threshold} min={0} max={100} onChange={(e) => setThreshold(Number(e.target.value))} style={{ maxWidth: 110 }} />
            </div>
          </div>
          {summary.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No attendance data for these filters.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Name</th><th>Register No.</th><th>Year</th><th>Sec</th><th>Days</th><th>Present</th><th>Absent</th><th>%</th><th></th></tr>
                </thead>
                <tbody>
                  {summary.map((r) => {
                    const low = r.percentage < threshold;
                    return (
                      <tr key={r.student_id} style={low ? { background: 'var(--amber-light)' } : undefined}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td className="td-muted">{r.register_number}</td>
                        <td>{r.year ? (YEAR_LABELS[r.year] ?? r.year) : '—'}</td>
                        <td>{r.section}</td>
                        <td>{r.days}</td>
                        <td>{r.present}</td>
                        <td>{r.absent}</td>
                        <td style={{ fontWeight: 700, color: low ? 'var(--amber)' : 'var(--green)' }}>{r.percentage}%</td>
                        <td>{low ? <span className="badge badge-red">Defaulter</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this attendance?"
          description={`This removes the saved attendance for ${YEAR_LABELS[deleteTarget.year] ?? deleteTarget.year} · Section ${deleteTarget.section} on ${date}. You can re-mark it afterwards.`}
          confirmLabel="Delete"
          onConfirm={removeDay}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Preview / edit modal */}
      {preview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setPreview(false); }}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 26px)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 4 }}>Confirm attendance</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 14 }}>
              {YEAR_LABELS[year] ?? year} · Section {section} · {date} — tap a name to toggle absent/present.
            </p>

            {unmatched.length > 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--amber-light)', color: '#b45309', fontSize: '0.78rem', marginBottom: 12 }}>
                Couldn't match: <strong>{unmatched.join(', ')}</strong>. Tick them manually below if needed.
              </div>
            )}

            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '6px 0' }}>
              Absentees ({absentIds.size})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {rosterSorted.filter((s) => absentIds.has(s.id)).map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} className="scan-result" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '0.84rem' }}>{s.name}</span>
                  <span className="badge badge-red">Absent</span>
                </button>
              ))}
              {absentIds.size === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Nobody marked absent.</span>}
            </div>

            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '6px 0' }}>
              Present ({roster.length - absentIds.size})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, maxHeight: 220, overflowY: 'auto' }}>
              {rosterSorted.filter((s) => !absentIds.has(s.id)).map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} className="scan-result" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: '0.84rem' }}>{s.name}</span>
                  <span className="badge badge-green">Present</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" type="button" onClick={() => setPreview(false)} disabled={saving}>Edit</button>
              <button className="btn btn-primary" type="button" onClick={confirmSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm & save'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
