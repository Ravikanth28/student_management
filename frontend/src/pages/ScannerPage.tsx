import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { StudentActionModal } from '../components/StudentActionModal';
import type { Student } from '../types';

type Props = { onLogout: () => void };

// Look for common ID-card symbologies and try harder on blurry frames.
const SCAN_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
  ]],
]);

export function ScannerPage({ onLogout }: Props) {
  const { error: toastError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lockRef = useRef(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [manual, setManual] = useState('');
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stopScan = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    trackRef.current = null;
    setScanning(false);
    setTorchOn(false);
  };

  const startScan = async () => {
    setCameraError(null);
    if (!videoRef.current) return;
    // Scan often; prefer the back camera at high resolution with continuous focus.
    const reader = new BrowserMultiFormatReader(SCAN_HINTS, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 800 });
    // Keep only standard "ideal" constraints at the top level; put non-standard
    // focus hints in `advanced` (optional) so no device rejects the camera.
    const video = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' }],
    } as unknown as MediaTrackConstraints;

    try {
      controlsRef.current = await reader.decodeFromConstraints(
        { video },
        videoRef.current,
        (result) => { if (result) void lookup(result.getText()); }
      );
      setScanning(true);
      // Detect torch support on the active track.
      const track = (videoRef.current.srcObject as MediaStream | null)?.getVideoTracks?.()[0] ?? null;
      trackRef.current = track;
      const caps = (track?.getCapabilities?.() as { torch?: boolean } | undefined);
      setTorchAvailable(Boolean(caps?.torch));
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
    } catch {
      /* torch not supported on this device */
    }
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
    void startScan(); // resume scanning
  };

  return (
    <Shell title="Scanner" subtitle="Scan a student ID barcode to mark late or add an achievement" onLogout={onLogout}>
      <div className="card card-padded" style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Camera */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0f172a', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />

          {/* Scan frame + moving line + status (while actively scanning) */}
          {scanning && !looking && (
            <>
              <div className="scan-frame">
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
            Hold the barcode inside the box — it scans automatically.
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
