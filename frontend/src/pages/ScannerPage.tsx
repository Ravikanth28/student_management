import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { StudentActionModal } from '../components/StudentActionModal';
import { proxiedImage } from '../lib/img';
import { LATE_PERIOD_LABELS, type LatePeriod, type Student } from '../types';

type Props = { onLogout: () => void };

const PERIODS: LatePeriod[] = ['morning', 'morning_break', 'lunch', 'evening_break'];
type FeedItem = { id: number; name: string; sub: string; status: 'ok' | 'dup' | 'err' | 'notfound' };

// ZXing fallback (when the native BarcodeDetector isn't available).
// TRY_HARDER helps read low-contrast / glare-affected barcodes.
const SCAN_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
    BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
  ]],
]);

// Region of interest: the wide, short band where the barcode sits.
const ROI = { x: 0.05, y: 0.28, w: 0.90, h: 0.44 };

// Boost contrast on the cropped band so faint bars survive the glare.
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const contrast = 1.6;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = gray * contrast + intercept;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

export function ScannerPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [manual, setManual] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [engine, setEngine] = useState<'native' | 'fallback' | null>(null);

  // Rapid attendance: mark each scan late for a chosen period, no modal, keep scanning.
  const [rapidMode, setRapidMode] = useState(false);
  const [rapidPeriod, setRapidPeriod] = useState<LatePeriod>('morning');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const markedRef = useRef<Set<string>>(new Set());
  const feedIdRef = useRef(0);

  const pushFeed = (name: string, sub: string, status: FeedItem['status']) =>
    setFeed((prev) => [{ id: ++feedIdRef.current, name, sub, status }, ...prev].slice(0, 15));

  const stopScan = () => {
    runningRef.current = false;
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    setScanning(false);
    setTorchOn(false);
  };

  const decodeLoop = async () => {
    if (!runningRef.current) return;
    const v = videoRef.current;
    if (v && v.videoWidth && v.readyState >= 2) {
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
      const vw = v.videoWidth, vh = v.videoHeight;
      const sw = Math.floor(vw * ROI.w), sh = Math.floor(vh * ROI.h);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(v, Math.floor(vw * ROI.x), Math.floor(vh * ROI.y), sw, sh, 0, 0, sw, sh);
        enhance(ctx, sw, sh);
        try {
          let text: string | undefined;
          if (detectorRef.current) {
            const codes = await detectorRef.current.detect(canvas);
            text = codes?.[0]?.rawValue;
          } else if (readerRef.current) {
            text = readerRef.current.decodeFromCanvas(canvas)?.getText?.();
          }
          if (text) void lookup(text);
        } catch { /* no barcode this frame */ }
      }
    }
    if (runningRef.current) timerRef.current = window.setTimeout(() => void decodeLoop(), 120);
  };

  const startScan = async () => {
    setCameraError(null);
    setNotFound(null);
    if (!videoRef.current) return;

    // Prefer the OS-native barcode detector; keep ZXing as a fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector;
    if (BD && !detectorRef.current) {
      try { detectorRef.current = new BD(); } catch { detectorRef.current = null; }
    }
    if (!detectorRef.current && !readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(SCAN_HINTS);
    }
    setEngine(detectorRef.current ? 'native' : 'fallback');

    const video = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' }],
    } as unknown as MediaTrackConstraints;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchAvailable(Boolean(caps?.torch));

      runningRef.current = true;
      setScanning(true);
      void decodeLoop();
    } catch {
      setScanning(false);
      setCameraError('Could not access the camera. Allow camera access and press "Restart camera", or use manual entry below.');
    }
  };

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch { /* torch unsupported */ }
  };

  const lookup = async (code: string) => {
    const value = code.trim();
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
      } finally {
        setTimeout(() => { lockRef.current = false; }, 1200);
      }
      return; // keep the camera scanning for the next student
    }

    setLooking(true);
    try {
      const res = await api.get<{ student: Student }>('/students/lookup', { params: { code: value } });
      if (navigator.vibrate) navigator.vibrate(60); // success buzz
      stopScan();
      setStudent(res.data.student);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // Show a clear, in-scanner "not registered" banner and pause scanning.
        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
        stopScan();
        setNotFound(value);
      } else {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toastError('Lookup failed', msg ?? 'Please try again.');
      }
    } finally {
      setLooking(false);
      setTimeout(() => { lockRef.current = false; }, 900); // debounce repeated scans
    }
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

  // Pick a searched student → open the action popup (works the same in rapid mode).
  const selectStudent = (s: Student) => {
    stopScan();
    setResults([]);
    setManual('');
    setStudent(s);
  };

  const closeModal = () => {
    setStudent(null);
    setManual('');
    setResults([]);
    void startScan();
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

        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0f172a', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />

          {scanning && !looking && !notFound && (
            <>
              <div className="scan-frame" style={{ inset: '28% 5%' }}>
                <div className="scanline" />
              </div>
              <div className="scan-status">Scanning…</div>
            </>
          )}

          {looking && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.5)', color: '#fff', fontWeight: 600 }}>
              Looking up…
            </div>
          )}

          {notFound && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', background: 'rgba(127,29,29,0.92)', color: '#fff', textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 44, lineHeight: 1 }}>🚫</div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Not registered</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>No student in the system for</div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.06em' }}>{notFound}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-primary" type="button" onClick={() => void startScan()}>Scan again</button>
                <button
                  type="button"
                  onClick={() => navigate('/students/new')}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '0 14px', height: 38, fontWeight: 600, cursor: 'pointer' }}
                >
                  Add student
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, textAlign: 'center' }}>
            Line the barcode up inside the box. Tilt slightly to kill glare.
          </p>
          {engine && (
            <span className={`badge ${engine === 'native' ? 'badge-green' : 'badge-amber'}`}>
              {engine === 'native' ? 'Fast scanner' : 'Basic scanner'}
            </span>
          )}
          {torchAvailable && (
            <button className="btn btn-outline btn-sm" type="button" onClick={() => void toggleTorch()}>
              {torchOn ? '🔦 Torch on' : '🔦 Torch'}
            </button>
          )}
        </div>

        {cameraError && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--red-light)', color: '#b91c1c', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
            {cameraError}
            <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => void startScan()}>Restart camera</button>
          </div>
        )}

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
