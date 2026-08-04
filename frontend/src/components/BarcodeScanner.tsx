import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

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

type Props = {
  active: boolean;
  onScan: (code: string) => void;
  isProcessing?: boolean; // If true, displays a processing overlay
  notFound?: string | null; // If string, displays a not found error
  onScanAgain?: () => void;
  onAddStudent?: () => void;
};

export function BarcodeScanner({ active, onScan, isProcessing, notFound, onScanAgain, onAddStudent }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [engine, setEngine] = useState<'native' | 'fallback' | null>(null);

  useEffect(() => {
    if (active && !isProcessing && !notFound) {
      void startScan();
    } else {
      stopScan();
    }
    return () => { stopScan(); };
  }, [active, isProcessing, notFound]);

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
            try {
              const codes = await detectorRef.current.detect(canvas);
              text = codes?.[0]?.rawValue;
            } catch (err) {
              detectorRef.current = null;
              if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader(SCAN_HINTS);
              setEngine('fallback');
            }
          }
          
          if (!detectorRef.current && readerRef.current) {
            text = readerRef.current.decodeFromCanvas(canvas)?.getText?.();
          }
          
          if (text) {
             let value = text.trim();
             if (value.startsWith(']') && value.length > 3) {
               if (/^\][a-zA-Z][0-9a-zA-Z]/.test(value)) {
                 value = value.substring(3);
               }
             }
             if (value) onScan(value);
          }
        } catch { /* no barcode this frame */ }
      }
    }
    if (runningRef.current) timerRef.current = window.setTimeout(() => void decodeLoop(), 120);
  };

  const startScan = async () => {
    setCameraError(null);
    if (!videoRef.current) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanning(false);
      setCameraError('Camera access is not supported. Please ensure you are using a secure connection (HTTPS) and a modern browser.');
      return;
    }

    const savedEngine = localStorage.getItem('scanner_pref');
    
    // Prefer the OS-native barcode detector; keep ZXing as a fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector;
    if (BD && !detectorRef.current && engine !== 'fallback' && savedEngine !== 'fallback') {
      try { detectorRef.current = new BD({ formats: ['code_128', 'qr_code', 'ean_13', 'code_39'] }); } catch { detectorRef.current = null; }
    }
    if (!detectorRef.current && !readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(SCAN_HINTS);
    }
    setEngine(detectorRef.current ? 'native' : 'fallback');

    let stream: MediaStream;
    try {
      try {
        const video1 = {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        } as unknown as MediaTrackConstraints;
        stream = await navigator.mediaDevices.getUserMedia({ video: video1 });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

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
    } catch (err) {
      console.error('Camera access error:', err);
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

  const toggleEngine = () => {
    if (engine === 'native') {
      detectorRef.current = null;
      localStorage.setItem('scanner_pref', 'fallback');
      setEngine('fallback');
    } else {
      localStorage.setItem('scanner_pref', 'native');
      setEngine('native');
      stopScan();
      void startScan();
    }
  };

  return (
    <>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0f172a', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />

        {scanning && !isProcessing && !notFound && (
          <>
            <div className="scan-frame" style={{ inset: '28% 5%' }}>
              <div className="scanline" />
            </div>
            <div className="scan-status">Scanning…</div>
          </>
        )}

        {isProcessing && (
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
              <button className="btn btn-primary" type="button" onClick={() => onScanAgain && onScanAgain()}>Scan again</button>
              {onAddStudent && (
                <button
                  type="button"
                  onClick={onAddStudent}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '0 14px', height: 38, fontWeight: 600, cursor: 'pointer' }}
                >
                  Add student
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, textAlign: 'center' }}>
          Line the barcode up inside the box. <strong>If it's blurry, pull the phone back a few inches!</strong>
        </p>
        {engine && (
          <span 
            className={`badge ${engine === 'native' ? 'badge-green' : 'badge-amber'}`}
            onClick={toggleEngine}
            style={{ cursor: 'pointer' }}
            title="Tap to switch scanner engine"
          >
            {engine === 'native' ? 'Fast scanner (tap to switch)' : 'Basic scanner (tap to switch)'}
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
    </>
  );
}
