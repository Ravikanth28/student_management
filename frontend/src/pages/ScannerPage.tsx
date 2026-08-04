import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { StudentActionModal } from '../components/StudentActionModal';
import { proxiedImage } from '../lib/img';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { LATE_PERIOD_LABELS, type LatePeriod, type Student } from '../types';

type Props = { onLogout: () => void };

const PERIODS: LatePeriod[] = ['morning', 'morning_break', 'lunch', 'evening_break'];
type FeedItem = { id: number; name: string; sub: string; status: 'ok' | 'dup' | 'err' | 'notfound' };

export function ScannerPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const lockRef = useRef(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [manual, setManual] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [notFound, setNotFound] = useState<string | null>(null);

  // Rapid attendance: mark each scan late for a chosen period, no modal, keep scanning.
  const [rapidMode, setRapidMode] = useState(false);
  const [rapidPeriod, setRapidPeriod] = useState<LatePeriod>('morning');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const markedRef = useRef<Set<string>>(new Set());
  const feedIdRef = useRef(0);

  const pushFeed = (name: string, sub: string, status: FeedItem['status']) =>
    setFeed((prev) => [{ id: ++feedIdRef.current, name, sub, status }, ...prev].slice(0, 15));

  const lookup = async (code: string) => {
    let value = code.trim();

    if (!value || lockRef.current) return;
    if (rapidMode && markedRef.current.has(value)) return; // already handled this session
    lockRef.current = true;

    // ── Rapid mode: mark late immediately and keep scanning ──
    if (rapidMode) {
      try {
        const res = await api.get<{ student: Student }>('/students/lookup', { params: { code: value } });
        const s = res.data.student;
        const time = new Date().toTimeString().slice(0, 5);
        markedRef.current.add(value);
        try {
          await api.post('/late-records', { student_id: s.id, period: rapidPeriod, time });
          if (navigator.vibrate) navigator.vibrate(60);
          pushFeed(s.name, `${LATE_PERIOD_LABELS[rapidPeriod]} · ${time}`, 'ok');
        } catch (e) {
          const st = (e as { response?: { status?: number } })?.response?.status;
          pushFeed(s.name, st === 409 ? 'Already marked today' : 'Save failed', st === 409 ? 'dup' : 'err');
        }
      } catch {
        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
        pushFeed(`Code ${value}`, 'Not registered', 'notfound');
        setNotFound(value);
  };

  useEffect(() => {
    void startScan();
    return () => stopScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live search by name / enrollment / register number.
  const onManualChange = (v: string) => {
    setManual(v);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    const term = v.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await api.get<{ data: Student[] }>('/students/search', { params: { q: term } });
        setResults(res.data.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectStudent = (s: Student) => {
    setScanning(false);
    setResults([]);
    setManual('');
    setStudent(s);
  };

  const closeModal = () => {
    setStudent(null);
    setManual('');
    setResults([]);
    setScanning(true);
  };

  return (
    <Shell title="Scanner" subtitle="Scan a student ID barcode to mark late or add an achievement" onLogout={onLogout}>
      <div className="card card-padded" style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Rapid attendance mode */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="checkbox" checked={rapidMode} onChange={(e) => { setRapidMode(e.target.checked); markedRef.current.clear(); setFeed([]); }} />
            Rapid attendance mode
          </label>
          {rapidMode && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginBottom: 6 }}>Each scan is marked late for:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PERIODS.map((p) => (
                  <button key={p} type="button" className={`btn btn-sm ${rapidPeriod === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRapidPeriod(p)}>
                    {LATE_PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <BarcodeScanner 
          active={scanning}
          onScan={lookup}
          isProcessing={looking}
          notFound={notFound}
          onScanAgain={() => { setNotFound(null); setScanning(true); }}
          onAddStudent={() => navigate('/students/new')}
        />

        {/* Manual search — by name, enrollment, or register number */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Or search by name / number</div>
          <input
            className="form-control"
            style={{ width: '100%' }}
            placeholder="Type a name, enrollment or register number…"
            value={manual}
            onChange={(e) => onManualChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) selectStudent(results[0]); }}
          />
          {searching && <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 8 }}>Searching…</div>}
          {results.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {results.map((s) => {
                const photo = proxiedImage(s.photo_url);
                return (
                  <button key={s.id} type="button" className="scan-result" onClick={() => selectStudent(s)}>
                    <span className="scan-result-avatar">
                      {photo ? (
                        <img src={photo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
                      ) : null}
                      <span className="scan-result-initial" style={{ display: photo ? 'none' : 'flex' }}>{s.name?.charAt(0).toUpperCase() || '?'}</span>
                    </span>
                    <span className="scan-result-info">
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                        {s.name}
                        {s.section ? <span className="scan-result-section">Sec {s.section}</span> : null}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-2)' }}>{s.register_number} · {s.enrollment_number} · {s.department} · {s.batch}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!searching && manual.trim().length >= 2 && results.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 8 }}>No students match “{manual.trim()}”.</div>
          )}
        </div>

        {/* Rapid-mode session feed */}
        {rapidMode && feed.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
              Marked this session ({markedRef.current.size})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {feed.map((f) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className={`badge ${f.status === 'ok' ? 'badge-green' : f.status === 'dup' ? 'badge-amber' : 'badge-gray'}`}>{f.sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {student && <StudentActionModal student={student} onClose={closeModal} />}
    </Shell>
  );
}
