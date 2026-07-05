import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { StudentActionModal } from '../components/StudentActionModal';
import type { Student } from '../types';

type Props = { onLogout: () => void };

// Only the symbologies used on ID cards — fewer formats = faster decode.
const SCAN_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
    BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
  ]],
]);

// Region of interest: a wide, short band in the middle where the barcode sits.
// Fractions of the video frame — matches the on-screen scan box.
const ROI = { x: 0.05, y: 0.30, w: 0.90, h: 0.40 };

export function ScannerPage({ onLogout }: Props) {
  const { error: toastError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
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
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stopScan = () => {
    runningRef.current = false;
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    setScanning(false);
    setTorchOn(false);
  };

  // Decode only the cropped ROI band — fast, and ignores glare outside the box.
  const decodeLoop = () => {
    if (!runningRef.current) return;
    const v = videoRef.current;
    const reader = readerRef.current;
    if (v && reader && v.videoWidth && v.readyState >= 2) {
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
      const vw = v.videoWidth, vh = v.videoHeight;
      const sx = Math.floor(vw * ROI.x), sy = Math.floor(vh * ROI.y);
      const sw = Math.floor(vw * ROI.w), sh = Math.floor(vh * ROI.h);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
        try {
          const text = reader.decodeFromCanvas(canvas)?.getText?.();
          if (text) void lookup(text);
        } catch { /* no barcode in this frame */ }
      }
    }
    if (runningRef.current) timerRef.current = window.setTimeout(decodeLoop, 80);
  };

  const startScan = async () => {
    setCameraError(null);
    if (!videoRef.current) return;
    readerRef.current = readerRef.current ?? new BrowserMultiFormatReader(SCAN_HINTS);

    const video = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
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
      decodeLoop();
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
      stopScan();
      setStudent(res.data.student);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Not found', msg ?? `No student found for "${value}".`);
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

          {scanning && !looking && (
            <>
              {/* Wide, short band matching the ROI — aim the barcode inside it */}
              <div className="scan-frame" style={{ inset: '30% 5%' }}>
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, textAlign: 'center' }}>
            Line the barcode up inside the box. Tilt slightly to kill glare.
          </p>
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
