import { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { BrowserMultiFormatReader } from '@zxing/browser';

type StudentRosterRow = {
  id: number;
  name: string;
  section: string;
  year: string;
  register_number: string;
  enrollment_number: string;
  pooled: boolean;
};

import { useAuth } from '../state/auth';

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
  
  const [scannedEnrollment, setScannedEnrollment] = useState('');
  const [locationVerified, setLocationVerified] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanLocationData, setScanLocationData] = useState<{lat: number, lng: number} | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    loadRoster();
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
      await api.post('/attendance/my-attendance/verify-phone', { phone_number: phone });
      setStep(2);
      startScanning();
    } catch (err: any) {
      toastError('Validation failed', err.response?.data?.message || 'Phone number is incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  const startScanning = async () => {
    setScanning(true);
    
    // Start Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setScanLocationData({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationVerified(true);
          success('Location Verified', 'SMVEC College, Madagadipet');
        },
        (error) => {
          console.error(error);
          toastError('Location Error', 'Failed to get location. Please enable GPS.');
          setLocationVerified(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toastError('Location Error', 'Geolocation is not supported by your browser.');
    }

    // Start Barcode Scanner
    if (!codeReader.current) {
      codeReader.current = new BrowserMultiFormatReader();
    }
    
    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices.length > 0 ? videoInputDevices[0].deviceId : undefined;
      
      if (videoRef.current && selectedDeviceId) {
        await codeReader.current.decodeFromVideoDevice(
          selectedDeviceId, 
          videoRef.current, 
          (result, err) => {
            if (result) {
              setScannedEnrollment(result.getText());
              // Stop scanning once we got a result
              stopScanning();
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      toastError('Camera Error', 'Could not access camera for scanning.');
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const handleSubmitAttendance = async () => {
    if (!scanLocationData) {
      toastError('Validation failed', 'Location not yet verified.');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post('/attendance/my-attendance/mark', {
        phone_number: phone,
        enrollment_number: scannedEnrollment,
        latitude: scanLocationData.lat,
        longitude: scanLocationData.lng
      });
      
      success('Success', 'Your attendance has been marked successfully.');
      setShowWizard(false);
      resetWizard();
    } catch (err: any) {
      toastError('Failed to mark attendance', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setPhone('');
    setScannedEnrollment('');
    setLocationVerified(false);
    setScanLocationData(null);
    stopScanning();
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

  return (
    <Shell onLogout={onLogout} title="My Attendance">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-1)' }}>My Attendance</h1>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.95rem' }}>View your classmates and mark your attendance for today.</p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search by name or reg no..." 
              className="form-control" 
              value={filterText} 
              onChange={e => setFilterText(e.target.value)} 
              style={{ minWidth: 200 }}
            />
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
              Summary / Mark Attendance
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading roster...</div>
        ) : (
          <div style={{ background: 'var(--surface-1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Reg No</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Name</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Section</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Pooled</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((student: StudentRosterRow) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 24px', color: 'var(--text-1)', fontSize: '0.9rem' }}>{student.register_number}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-1)', fontSize: '0.9rem', fontWeight: 500 }}>{student.name}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-2)', fontSize: '0.9rem' }}>{student.section}</td>
                    <td style={{ padding: '12px 24px', textAlign: 'center' }}>
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
                    <td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-2)' }}>
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showWizard && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.85)', zIndex: 9999, 
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ 
              background: '#18181b', width: 500, borderRadius: 16, overflow: 'hidden', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', border: '1px solid #3f3f46'
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-1)' }}>Mark Attendance</h2>
                <button onClick={closeWizard} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}>
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
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>Name</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>Enrollment No</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.enrollment_number}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>Year</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.year}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>Section</div>
                        <div style={{ fontSize: '0.9rem', color: '#f4f4f5', fontWeight: 500 }}>{me.section}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: 24 }}>
                {step === 1 && (
                  <form onSubmit={handlePhoneSubmit}>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: 20 }}>
                      Please verify your identity by entering your registered phone number.
                    </p>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>Phone Number</label>
                      <input 
                        type="text" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                        Validate & Next
                      </button>
                    </div>
                  </form>
                )}

                {step === 2 && (
                  <div>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: 20 }}>
                      Scan your ID Card barcode (Enrollment Number). Your location will also be verified.
                    </p>

                    <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', height: 250, marginBottom: 20, position: 'relative' }}>
                      {!scannedEnrollment ? (
                        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4ade80', flexDirection: 'column' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>Barcode Scanned!</span>
                          <span style={{ color: '#fff', marginTop: 4 }}>{scannedEnrollment}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                      {locationVerified ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      )}
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-1)' }}>Location Status</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                          {locationVerified ? 'Location fetched successfully.' : 'Fetching GPS location...'}
                        </div>
                        {locationVerified && (
                          <div style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: 2, fontWeight: 500 }}>
                            Location: SMVEC College, Madagadipet
                          </div>
                        )}
                      </div>
                    </div>

                    {scannedEnrollment && locationVerified && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={handleSubmitAttendance} 
                          disabled={submitting}
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: submitting ? 0.7 : 1 }}
                        >
                          {submitting ? 'Submitting...' : 'Poll Your Attendance'}
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
