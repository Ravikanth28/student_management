import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { StudentActionModal } from '../components/StudentActionModal';
import type { Student } from '../types';

type Props = { onLogout: () => void };

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
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [engine, setEngine] = useState<'native' | 'fallback' | null>(null);

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
    lockRef.current = true;
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

  const closeModal = () => {
    setStudent(null);
    setManual('');
    void startScan();
  };

  return (
    <Shell title="Scanner" subtitle="Scan a student ID barcode to mark late or add an achievement" onLogout={onLogout}>
      <div className="card card-padded" style={{ maxWidth: 560, margin: '0 auto' }}>
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
              <button className="btn btn-primary" style={{ marginTop: 8 }} type="button" onClick={() => void startScan()}>Scan again</button>
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

        {/* Manual fallback */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Or enter the number manually</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-control"
              style={{ flex: 1 }}
              placeholder="Enrollment or register number"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void lookup(manual); }}
            />
            <button className="btn btn-primary" onClick={() => void lookup(manual)} disabled={!manual.trim() || looking}>
              Find
            </button>
          </div>
        </div>
      </div>

      {student && <StudentActionModal student={student} onClose={closeModal} />}
    </Shell>
  );
}
