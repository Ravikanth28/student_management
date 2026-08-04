import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useAuth } from '../state/auth';

type StudentRosterRow = {
  id: number;
  name: string;
  section: string;
  year: string;
  register_number: string;
  enrollment_number: string;
  pooled: boolean;
};

// Location status states
type LocationStatus = 'idle' | 'requesting-permission' | 'detecting' | 'success' | 'permission-denied' | 'gps-off' | 'error';

type Props = { onLogout: () => void };

export function StudentAttendancePage({ onLogout }: Props) {
  const { username } = useAuth();
  const { success, error: toastError } = useToast();
  const [roster, setRoster] = useState<StudentRosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [expectedEnrollment, setExpectedEnrollment] = useState('');

  const [scannedEnrollment, setScannedEnrollment] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanLocationData, setScanLocationData] = useState<{lat: number, lng: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const locationRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRoster();
    return () => {
      if (locationRetryRef.current) clearTimeout(locationRetryRef.current);
    };
  }, []);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ roster: StudentRosterRow[] }>('/attendance/my-attendance/roster');
      setRoster(res.data.roster);
    } catch (err: any) {
      toastError('Failed to load roster', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    try {
      setSubmitting(true);
      const res = await api.post('/attendance/my-attendance/verify-phone', { phone_number: phone });
      setExpectedEnrollment(res.data.enrollment_number);
      setStep(2);
      setScanning(true);
      startLocationDetection();
    } catch (err: any) {
      toastError('Validation failed', err.response?.data?.message || 'Phone number is incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Main location detection function.
   * Uses @capacitor/geolocation natively on Android - this already
   * handles the "enable GPS" system dialog automatically.
   */
  const startLocationDetection = async () => {
    setScanLocationData(null);
    setLocationStatus('detecting');
    setLocationMessage('Checking GPS status...');

    try {
      if (Capacitor.isNativePlatform()) {
        // Step 1: Check current permission status
        setLocationStatus('requesting-permission');
        setLocationMessage('Requesting location permission...');

        const permStatus = await Geolocation.checkPermissions();

        if (permStatus.location === 'denied') {
          // Permanently denied - user must go to settings
          setLocationStatus('permission-denied');
          setLocationMessage('Location permission was denied. Please enable it in your phone Settings → Apps → Student Portal → Permissions.');
          return;
        }

        if (permStatus.location !== 'granted') {
          // Not yet asked - request it
          const requested = await Geolocation.requestPermissions();
          if (requested.location !== 'granted') {
            setLocationStatus('permission-denied');
            setLocationMessage('Location permission denied. Please allow it in your phone settings to proceed.');
            return;
          }
        }
      }

      // Step 2: Get position (Capacitor will automatically show "enable GPS" dialog if off)
      setLocationStatus('detecting');
      setLocationMessage('Detecting your location...');

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      setScanLocationData({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationStatus('success');
      setLocationMessage('Location detected successfully.');

    } catch (err: any) {
      console.error('Location error code:', err?.code, 'message:', err?.message);

      const code: number = err?.code ?? -1;
      const msg: string = (err?.message ?? '').toLowerCase();

      if (code === 1 || msg.includes('denied') || msg.includes('permission')) {
        // Permission denied
        setLocationStatus('permission-denied');
        setLocationMessage('Location permission was denied. Please go to your phone Settings → Apps → Student Portal → Permissions and allow Location.');
      } else if (code === 2 || msg.includes('unavailable') || msg.includes('disabled') || msg.includes('off')) {
        // GPS is turned off
        setLocationStatus('gps-off');
        setLocationMessage('Your GPS / Location service is turned off. Please turn it on and tap "Retry" below.');
      } else {
        // Generic position error - retry with low accuracy as fallback
        if (Capacitor.isNativePlatform()) {
          try {
            setLocationMessage('High-accuracy GPS unavailable. Trying network location...');
            const fallback = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 30000,
            });
            setScanLocationData({ lat: fallback.coords.latitude, lng: fallback.coords.longitude });
            setLocationStatus('success');
            setLocationMessage('Location detected via network.');
            return;
          } catch {
            // fallback also failed
          }
        } else if (navigator.geolocation) {
          // Web fallback
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setScanLocationData({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setLocationStatus('success');
              setLocationMessage('Location detected successfully.');
            },
            () => {
              setLocationStatus('gps-off');
              setLocationMessage('Could not detect your location. Please turn on GPS and tap "Retry".');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
          return;
        }

        setLocationStatus('error');
        setLocationMessage('Could not get your GPS location. Please ensure you are outdoors or near a window, then tap "Retry".');
      }
    }
  };

  const handleRetryLocation = () => {
    startLocationDetection();
  };

  const handleSubmitAttendance = async () => {
    if (!scanLocationData) return;

    setSubmitting(true);
    try {
      await api.post('/attendance/my-attendance/mark', {
        phone_number: phone,
        enrollment_number: scannedEnrollment,
        latitude: scanLocationData.lat,
        longitude: scanLocationData.lng
      });

      success('Attendance Marked', 'Your attendance has been marked successfully.');
      setShowWizard(false);
      resetWizard();
    } catch (err: any) {
      toastError('Failed to mark attendance', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setPhone('');
    setScannedEnrollment('');
    setScanLocationData(null);
    setLocationStatus('idle');
    setLocationMessage('');
    setScanning(false);
    if (locationRetryRef.current) clearTimeout(locationRetryRef.current);
  };

  const closeWizard = () => {
    setShowWizard(false);
    resetWizard();
  };

  const filteredRoster = useMemo(() => {
    if (!filterText) return roster;
    const lower = filterText.toLowerCase();
    return roster.filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.register_number.toLowerCase().includes(lower) ||
      s.enrollment_number.toLowerCase().includes(lower)
    );
  }, [roster, filterText]);

  const locationVerified = locationStatus === 'success';
  const locationIsError = locationStatus === 'permission-denied' || locationStatus === 'gps-off' || locationStatus === 'error';
  const locationIsLoading = locationStatus === 'detecting' || locationStatus === 'requesting-permission';

  // Location status card styling
  const locationCardStyle = (status: LocationStatus): React.CSSProperties => {
    if (status === 'success') return { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px' };
    if (status === 'permission-denied' || status === 'gps-off' || status === 'error') return { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px' };
    return { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' };
  };

  const locationIcon = (status: LocationStatus) => {
    if (status === 'success') return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    );
    if (locationIsError) return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    );
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 2s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    );
  };

  return (
    <Shell onLogout={onLogout} title="My Attendance">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-1)' }}>My Attendance</h1>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.95rem' }}>View your classmates and mark your attendance for today.</p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by name or reg no..."
              className="form-control"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              style={{ flex: '1 1 200px', minWidth: 200 }}
            />
            <button className="btn btn-primary" onClick={() => setShowWizard(true)} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              Summary / Mark Attendance
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading roster...</div>
        ) : (
          <div style={{ background: 'var(--surface-1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={{ padding: '12px 12px', color: 'var(--text-3)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Reg No</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-3)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Name</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-3)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Section</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-3)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center' }}>Pooled</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((student: StudentRosterRow) => (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 12px', color: 'var(--text-1)', fontSize: '0.85rem' }}>{student.register_number}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-1)', fontSize: '0.85rem', fontWeight: 500 }}>{student.name}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-2)', fontSize: '0.85rem' }}>{student.section}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        {student.pooled ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--text-2)' }}>
                        No students found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showWizard && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <div style={{
              background: '#18181b', width: '100%', maxWidth: 500, borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', border: '1px solid #3f3f46'
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f4f4f5' }}>Mark Attendance</h2>
                <button onClick={closeWizard} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Student Details Header */}
              {(() => {
                const me = roster.find(s => s.enrollment_number === username);
                if (!me) return null;
                return (
                  <div style={{ padding: '16px 24px', background: '#27272a', borderBottom: '1px solid #3f3f46' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', marginBottom: 2 }}>Name</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', marginBottom: 2 }}>Enrollment No</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.enrollment_number}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', marginBottom: 2 }}>Year</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.year}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', marginBottom: 2 }}>Section</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.section}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: 24, overflowY: 'auto' }}>
                {step === 1 && (
                  <form onSubmit={handlePhoneSubmit}>
                    <p style={{ color: '#a1a1aa', fontSize: '0.95rem', marginBottom: 20 }}>
                      Please verify your identity by entering your registered phone number.
                    </p>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>Phone Number</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #3f3f46', background: '#27272a', color: '#f4f4f5', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={submitting}
                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: submitting ? 0.7 : 1 }}
                      >
                        {submitting ? 'Validating...' : 'Validate & Next'}
                      </button>
                    </div>
                  </form>
                )}

                {step === 2 && (
                  <div>
                    <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: 16 }}>
                      Scan your ID Card barcode. Your location will be verified automatically.
                    </p>

                    {/* Barcode scanner */}
                    <div style={{ marginBottom: 16 }}>
                      {!scannedEnrollment ? (
                        <BarcodeScanner
                          active={scanning}
                          onScan={(code) => {
                            if (code !== expectedEnrollment) {
                              closeWizard();
                              toastError('Wrong Barcode', 'The scanned barcode does not match your enrollment number.');
                              return;
                            }
                            setScannedEnrollment(code);
                            setScanning(false);
                          }}
                        />
                      ) : (
                        <div style={{ background: '#000', borderRadius: 12, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', flexDirection: 'column', gap: 8 }}>
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          <span style={{ fontWeight: 600, fontSize: '1rem' }}>Barcode Scanned!</span>
                          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>{scannedEnrollment}</span>
                        </div>
                      )}
                    </div>

                    {/* Location Status Card - inline, NOT a toast */}
                    <div style={{ ...locationCardStyle(locationStatus), marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flexShrink: 0, marginTop: 1 }}>
                          {locationIcon(locationStatus)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: locationVerified ? '#10b981' : locationIsError ? '#ef4444' : '#a1a1aa',
                            marginBottom: 4
                          }}>
                            {locationVerified ? 'Location Detected' :
                             locationStatus === 'permission-denied' ? 'Permission Required' :
                             locationStatus === 'gps-off' ? 'GPS is Turned Off' :
                             locationStatus === 'error' ? 'Location Error' :
                             locationIsLoading ? 'Detecting Location...' : 'Location'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: locationVerified ? '#10b981' : locationIsError ? '#ef4444' : '#71717a', lineHeight: 1.5 }}>
                            {locationMessage || 'Waiting...'}
                          </div>

                          {/* Action buttons — inside the card, NOT a toast */}
                          {locationStatus === 'gps-off' && (
                            <button
                              onClick={handleRetryLocation}
                              style={{
                                marginTop: 10, background: '#ef4444', color: '#fff', border: 'none',
                                padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              ↻ Retry after turning on GPS
                            </button>
                          )}

                          {locationStatus === 'error' && (
                            <button
                              onClick={handleRetryLocation}
                              style={{
                                marginTop: 10, background: '#3b82f6', color: '#fff', border: 'none',
                                padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                              }}
                            >
                              ↻ Retry
                            </button>
                          )}

                          {locationStatus === 'permission-denied' && (
                            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#ef4444' }}>
                              Go to: Settings → Apps → Student Portal → Permissions → Location → Allow
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submit button — only shows when both barcode and location are ready */}
                    {scannedEnrollment === expectedEnrollment && locationVerified && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleSubmitAttendance}
                          disabled={submitting}
                          style={{
                            background: '#10b981', color: '#fff', border: 'none',
                            padding: '10px 20px', borderRadius: 8,
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            fontWeight: 600, opacity: submitting ? 0.7 : 1,
                            fontSize: '0.95rem'
                          }}
                        >
                          {submitting ? 'Submitting...' : '✓ Mark Attendance'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Shell>
  );
}
