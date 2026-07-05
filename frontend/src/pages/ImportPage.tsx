import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { useAuth } from '../state/auth';
import { proxiedImage } from '../lib/img';

// ─── Icons ────────────────────────────────────────────────────
function IconUpload() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────
interface ImportError {
  row: number;
  register_number: string;
  reason: string;
}
interface ImportSuccess {
  student_id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  photo_url: string;
}
interface ImportResult {
  mode?: 'full_import' | 'photo_update' | 'details_update';
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  successes?: ImportSuccess[];
  importId?: string;
}
interface ImportProgress {
  current: number;
  total: number;
  status: string;
}

// ─── Download template CSV ────────────────────────────────────
function downloadTemplate() {
  const headers = [
    'name', 'register_number', 'enrollment_number', 'section', 'current_year', 'department', 'batch',
    'phone', 'parent_phone', 'address', 'college_email', 'personal_email',
    'dob', 'blood_group', 'photo_url'
  ];
  const example = [
    'Arun Kumar', '21CS001', 'EN21CS001', 'A', '1', 'Computer Science', '2021-2025',
    '9876543210', '9876543211', '12 Main St, Chennai 600001',
    'arun@college.edu', 'arun@gmail.com',
    '2004-05-21', 'O+',
    'https://drive.google.com/file/d/YOUR_FILE_ID/view'
  ];
  const csv = [headers.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { onLogout: () => void };

export function ImportPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [driveLink, setDriveLink] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveProgress, setDriveProgress] = useState<ImportProgress | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [detailsModal, setDetailsModal] = useState<{ successes: any[], errors: any[] } | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'all' | 'success' | 'duplicate' | 'error'>('all');

  const fetchHistory = async () => {
    try {
      const res = await api.get('/students/import-history');
      setHistory(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileSelect = (f: File) => {
    if (!f.name.match(/\.(csv|xlsx|xls)$/i)) {
      toastError('Invalid file', 'Please upload a .csv, .xlsx, or .xls file.');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  const { token } = useAuth();

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use relative API path so it works everywhere (localhost, IPs, proxy)
      const res = await api.post<ImportResult>('/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      });

      const data = res.data;
      setResult(data);
      if (data.mode === 'photo_update') {
        if (data.updated > 0) {
          success('Photos Updated', `${data.updated} student photos updated successfully.`);
        }
      } else if (data.mode === 'details_update') {
        if (data.updated > 0) {
          success('Details Updated', `${data.updated} students updated (blood group / DOB).`);
        }
      } else {
        if (data.imported > 0) {
          success('Import complete', `${data.imported} students imported successfully.`);
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Import failed', msg ?? 'Could not process the file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDriveImport = async () => {
    if (!driveLink.trim()) return;
    setDriveLoading(true);
    setResult(null);
    setDriveProgress(null);
    const importId = Math.random().toString(36).substring(2, 15);

    // Start polling progress
    const interval = setInterval(async () => {
      try {
        const pRes = await api.get<ImportProgress>(`/students/import-progress/${importId}`);
        setDriveProgress(pRes.data);
        if (pRes.data.status === 'completed' || pRes.data.status === 'error') {
          clearInterval(interval);
        }
      } catch (e) {}
    }, 1000);

    try {
      const res = await api.post<ImportResult>('/students/import-photos-drive', { 
        driveFolderUrl: driveLink, 
        importId 
      }, {
        timeout: 10 * 60 * 1000, 
      });
      const data = res.data;
      setResult(data);
      if (data.updated > 0) {
        success('Photos Imported', `${data.updated} student photos downloaded and linked.`);
      }
      fetchHistory();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Import failed', msg ?? 'Could not process Google Drive folder.');
    } finally {
      clearInterval(interval);
      setDriveLoading(false);
    }
  };

  const handleDeletePhoto = async (studentId: number) => {
    if (!window.confirm('Delete this photo from the student?')) return;
    try {
      await api.delete(`/students/${studentId}/photo`);
      success('Deleted', 'Photo removed successfully');
      
      // Remove from Result successes if showing
      if (result && result.successes) {
        setResult({
          ...result,
          successes: result.successes.filter(s => s.student_id !== studentId)
        });
      }
      
      // Remove from Modal successes if showing
      if (detailsModal) {
        setDetailsModal({
          ...detailsModal,
          successes: detailsModal.successes.filter(s => s.student_id !== studentId)
        });
      }
    } catch (err) {
      toastError('Error', 'Failed to delete photo');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!window.confirm('Delete this history record?')) return;
    try {
      await api.delete(`/students/import-history/${id}`);
      fetchHistory();
    } catch (err) {
      toastError('Error', 'Failed to delete history');
    }
  };

  return (
    <Shell
      title="Bulk Import"
      subtitle="Import multiple students from a CSV or Excel file"
      onLogout={onLogout}
      actions={
        <button className="btn btn-outline btn-sm" type="button" onClick={downloadTemplate}>
          <IconDownload /> Download Template
        </button>
      }
    >
      {/* Instructions Card */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
          1. Bulk Student Import (CSV/Excel)
        </h2>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          How to Import
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[
            { step: '1', title: 'Download Template', desc: 'Click "Download Template" above to get the correct CSV format.' },
            { step: '2', title: 'Fill in Data', desc: 'Add students. For photos, paste the Google Drive share link in the photo_url column.' },
            { step: '3', title: 'Upload File', desc: 'Upload your filled CSV or Excel file below.' },
            { step: '4', title: 'Auto Photo Upload', desc: 'Photos from Google Drive are downloaded & uploaded to Cloudinary automatically.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--navy)', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
              }}>{step}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Column guide */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Required Columns
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['name', 'register_number', 'enrollment_number', 'section', 'department', 'batch', 'phone', 'parent_phone', 'address'].map(col => (
              <span key={col} className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{col}</span>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 8px' }}>
            Optional Columns
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['current_year', 'dob', 'blood_group', 'college_email', 'personal_email', 'photo_url'].map(col => (
              <span key={col} className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{col}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>
            💡 <strong>photo_url</strong> accepts Google Drive share links — photos are automatically downloaded and uploaded to Cloudinary.
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 6 }}>
            💡 <strong>dob</strong> accepts <code>YYYY-MM-DD</code> or <code>M/D/YY</code>. <strong>blood_group</strong> like <code>O+</code> or <code>B +ve</code>.
            To only fill blood group / DOB for students that already exist, upload a sheet with just
            <code> register_number</code> (or <code>enrollment_number</code>) plus <code>dob</code> / <code>blood_group</code>.
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--blue-light)' : 'var(--surface-2)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ color: dragOver ? 'var(--blue)' : 'var(--text-3)', marginBottom: 12 }}>
            <IconUpload />
          </div>
          {file ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ color: 'var(--green)' }}><IconFile /></div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{file.name}</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                {(file.size / 1024).toFixed(1)} KB · Click to change
              </span>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Drop CSV or Excel here, or click to browse
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                Supports .csv · .xlsx · .xls · up to 10 MB
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          id="bulk-file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
          {file && !loading && (
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => { setFile(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            >
              <IconTrash /> Remove
            </button>
          )}
          <button
            id="start-import-btn"
            className="btn btn-primary"
            type="button"
            disabled={!file || loading}
            onClick={handleImport}
            style={{ minWidth: 160 }}
          >
            {loading ? <><Spinner /> Processing...</> : <><IconUpload /> Start Import</>}
          </button>
        </div>

        {loading && (
          <div style={{
            marginTop: 16, padding: '14px 18px',
            background: 'var(--blue-light)', borderRadius: 'var(--radius)',
            border: '1px solid #93c5fd', fontSize: '0.82rem', color: '#1d4ed8',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Spinner />
            <div>
              <strong>Importing students…</strong>
              <div style={{ fontSize: '0.75rem', marginTop: 2, opacity: 0.8 }}>
                Downloading photos from Google Drive and uploading to Cloudinary. This may take a few minutes for large files.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drive Folder Zone */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
          2. Bulk Photo Import via Google Drive
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 16 }}>
          Paste a link to a Google Drive folder containing student photos. Ensure the folder is set to "Anyone with the link can view". Photos must contain the student's Enrollment Number in their filename (e.g., <code style={{background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4}}>Arun 2511399.jpg</code>).
        </p>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={driveLoading || loading}
            />
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!driveLink.trim() || driveLoading || loading}
            onClick={handleDriveImport}
            style={{ minWidth: 160 }}
          >
            {driveLoading ? <><Spinner /> Fetching...</> : 'Import Photos'}
          </button>
        </div>

        {driveLoading && (
          <div style={{
            marginTop: 16, padding: '14px 18px',
            background: 'var(--blue-light)', borderRadius: 'var(--radius)',
            border: '1px solid #93c5fd', fontSize: '0.82rem', color: '#1d4ed8',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Spinner />
            <div style={{ flex: 1 }}>
              <strong>Importing photos from Google Drive...</strong>
              <div style={{ fontSize: '0.75rem', marginTop: 2, opacity: 0.8 }}>
                Downloading photos and uploading them to Cloudinary. This may take several minutes.
              </div>
              {driveProgress && driveProgress.total > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4, fontWeight: 600 }}>
                    <span>Progress: {driveProgress.current} / {driveProgress.total} completed</span>
                    <span>{Math.round((driveProgress.current / driveProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#bfdbfe', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      background: '#2563eb', 
                      width: `${(driveProgress.current / driveProgress.total) * 100}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Result Card */}
      {result && (
        <div className="card card-padded">
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{
              flex: 1, minWidth: 120, padding: '14px 18px',
              background: 'var(--green-light)', borderRadius: 'var(--radius)',
              border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ color: 'var(--green)', width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
                <IconCheck />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>
                  {result.mode === 'full_import' ? result.imported : result.updated}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                  {result.mode === 'photo_update' ? 'Photos Updated' : result.mode === 'details_update' ? 'Students Updated' : 'Imported Successfully'}
                </div>
              </div>
            </div>
            <div style={{
              flex: 1, minWidth: 120, padding: '14px 18px',
              background: '#fef2f2', borderRadius: 'var(--radius)',
              border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ color: 'var(--red)', width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
                <IconX />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{result.skipped}</div>
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Skipped / Errors</div>
              </div>
            </div>
          </div>

          {/* Action after success */}
          {(result.imported > 0 || result.updated > 0) && (
            <div style={{ marginBottom: 16 }}>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/students')}>
                View Student Records →
              </button>
            </div>
          )}

          {/* Error table */}
          {result.errors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                Error Details ({result.errors.length} rows)
              </h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Row</th>
                      <th>Register No.</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="td-muted">{e.row}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{e.register_number || '—'}</td>
                        <td style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success / Undo Table */}
          {result.successes && result.successes.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
                Successfully Updated ({result.successes.length} photos)
              </h4>
              <div className="table-container" style={{ border: '1px solid #bbf7d0' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Photo</th>
                      <th>Enrollment No.</th>
                      <th>Name</th>
                      <th style={{ width: 100 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.successes.map((s, i) => (
                      <tr key={i}>
                        <td>
                          <img src={proxiedImage(s.photo_url) ?? undefined} alt="" loading="lazy" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.enrollment_number || s.register_number}</td>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.name}</td>
                        <td>
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                            onClick={() => handleDeletePhoto(s.student_id)}
                          >
                            <IconTrash /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="card card-padded" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
            3. Import History
          </h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Students</th>
                  <th>Reason</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const succ = typeof h.successes === 'string' ? JSON.parse(h.successes || '[]') : (h.successes || []);
                  const errs = typeof h.errors === 'string' ? JSON.parse(h.errors || '[]') : (h.errors || []);
                  return (
                    <tr key={h.id}>
                      <td style={{ fontSize: '0.82rem' }}>{new Date(h.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', alignItems: 'center' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '0.9rem' }}>
                            {succ.length + errs.length}
                          </div>
                          <div 
                            style={{ cursor: 'pointer', padding: '4px 8px', background: 'rgba(46,196,182,0.1)', borderRadius: 4, color: 'var(--green)', fontWeight: 600, transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(46,196,182,0.2)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(46,196,182,0.1)'}
                            onClick={() => { setDetailsModal({ successes: succ, errors: errs }); setActiveModalTab('success'); }}
                            title="View Success Details"
                          >
                            Success: {succ.length}
                          </div>
                          <div 
                            style={{ cursor: 'pointer', padding: '4px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: 4, color: '#f59e0b', fontWeight: 600, transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                            onClick={() => { setDetailsModal({ successes: succ, errors: errs }); setActiveModalTab('duplicate'); }}
                            title="View Skipped Details"
                          >
                            Skipped: {errs.filter((e: any) => e.reason.toLowerCase().includes('already') || e.reason.toLowerCase().includes('duplicate')).length}
                          </div>
                          <div 
                            style={{ cursor: 'pointer', padding: '4px 8px', background: 'rgba(239,35,60,0.1)', borderRadius: 4, color: 'var(--red)', fontWeight: 600, transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(239,35,60,0.2)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(239,35,60,0.1)'}
                            onClick={() => { setDetailsModal({ successes: succ, errors: errs }); setActiveModalTab('error'); }}
                            title="View Error Details"
                          >
                            Errors: {errs.filter((e: any) => !e.reason.toLowerCase().includes('already') && !e.reason.toLowerCase().includes('duplicate')).length}
                          </div>
                        </div>
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline btn-sm" 
                          style={{ padding: '4px 12px', fontSize: '0.75rem', width: 'auto' }}
                          onClick={() => {
                            setDetailsModal({ successes: succ, errors: errs });
                            setActiveModalTab('all');
                          }}
                        >
                          View Details
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-outline btn-sm" 
                          style={{ color: 'var(--red)', borderColor: 'var(--red)', padding: '4px 8px' }}
                          onClick={() => handleDeleteHistory(h.id)}
                          title="Clear History"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="card card-padded" style={{ 
            width: '100%', maxWidth: 1100, maxHeight: '95vh', overflowY: 'auto', 
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
          }}>
            <button 
              onClick={() => setDetailsModal(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
            >
              <IconX />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 16 }}>Import Details</h2>
            
            {(() => {
              const duplicates = detailsModal.errors.filter(e => e.reason.toLowerCase().includes('already') || e.reason.toLowerCase().includes('duplicate'));
              const hardErrors = detailsModal.errors.filter(e => !e.reason.toLowerCase().includes('already') && !e.reason.toLowerCase().includes('duplicate'));
              const total = detailsModal.successes.length + detailsModal.errors.length;

              const getCardStyle = (tab: string, baseBorder: string, baseBg: string) => ({
                padding: '12px 16px', 
                background: activeModalTab === tab ? baseBg : '#fff', 
                borderRadius: 8, 
                border: activeModalTab === tab ? `2px solid ${baseBorder}` : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: activeModalTab === tab ? 1 : 0.7
              });

              return (
                <>
                  {/* Modal KPIs (Tabs) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    <div style={getCardStyle('all', 'var(--text-3)', 'var(--bg)')} onClick={() => setActiveModalTab('all')}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Total Processed</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{total}</div>
                    </div>
                    <div style={getCardStyle('success', 'var(--green)', 'rgba(46, 196, 182, 0.05)')} onClick={() => setActiveModalTab('success')}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase' }}>Successfully Updated</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{detailsModal.successes.length}</div>
                    </div>
                    <div style={getCardStyle('duplicate', '#f59e0b', 'rgba(245, 158, 11, 0.05)')} onClick={() => setActiveModalTab('duplicate')}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>Skipped (Duplicates)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{duplicates.length}</div>
                    </div>
                    <div style={getCardStyle('error', 'var(--red)', 'rgba(239, 35, 60, 0.05)')} onClick={() => setActiveModalTab('error')}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>Hard Errors</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{hardErrors.length}</div>
                    </div>
                  </div>

                  <div className="table-container">
                    <table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Photo</th>
                          <th style={{ width: 160 }}>Register/Enroll No.</th>
                          <th style={{ width: 200 }}>Name</th>
                          <th>Reason</th>
                          <th style={{ width: 110, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeModalTab === 'all' || activeModalTab === 'success') && detailsModal.successes.map((s, i) => (
                          <tr key={`succ-${i}`}>
                            <td>
                              <img src={proxiedImage(s.photo_url) ?? undefined} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.enrollment_number || s.register_number}</td>
                            <td style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
                            <td style={{ color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>Success</td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                className="btn btn-outline btn-sm" 
                                style={{ color: 'var(--red)', borderColor: 'var(--red)', padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleDeletePhoto(s.student_id)}
                              >
                                <IconTrash /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(activeModalTab === 'all' || activeModalTab === 'duplicate') && duplicates.map((e, i) => (
                          <tr key={`dup-${i}`}>
                            <td style={{ color: '#f59e0b', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}>-</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.register_number || '—'}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>—</td>
                            <td style={{ color: '#f59e0b', fontSize: '0.82rem', lineHeight: 1.4 }}>{e.reason}</td>
                            <td style={{ textAlign: 'right' }}>—</td>
                          </tr>
                        ))}
                        {(activeModalTab === 'all' || activeModalTab === 'error') && hardErrors.map((e, i) => (
                          <tr key={`err-${i}`}>
                            <td style={{ color: 'var(--red)', textAlign: 'center' }}><IconX /></td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.register_number || '—'}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>—</td>
                            <td style={{ color: 'var(--red)', fontSize: '0.82rem', lineHeight: 1.4 }}>{e.reason}</td>
                            <td style={{ textAlign: 'right' }}>—</td>
                          </tr>
                        ))}
                        
                        {((activeModalTab === 'success' && detailsModal.successes.length === 0) ||
                          (activeModalTab === 'duplicate' && duplicates.length === 0) ||
                          (activeModalTab === 'error' && hardErrors.length === 0) ||
                          (activeModalTab === 'all' && total === 0)) && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>
                              No records found in this category.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </Shell>
  );
}
