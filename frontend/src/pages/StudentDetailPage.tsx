import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import type { Student } from '../types';

// ─── SVG Icons ──────────────────────────────────────────────
function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconImageOff() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V6m5.5-2H19a2 2 0 0 1 2 2v11" /><path d="M8.5 8.5a2 2 0 1 0 2.83 2.83" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}
function IconTrashPhoto() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91A16 16 0 0 0 14 15.91l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IconMapPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

// ─── Field config ────────────────────────────────────────────
const FIELDS: { key: keyof Student; label: string; icon?: React.ReactNode; span?: boolean }[] = [
  { key: 'register_number',   label: 'Register Number' },
  { key: 'enrollment_number', label: 'Enrollment Number' },
  { key: 'department',        label: 'Department' },
  { key: 'batch',             label: 'Batch' },
  { key: 'section',           label: 'Section' },
  { key: 'phone',             label: 'Phone',         icon: <IconPhone /> },
  { key: 'parent_phone',      label: 'Parent Phone',  icon: <IconPhone /> },
  { key: 'college_email',     label: 'College Email', icon: <IconMail /> },
  { key: 'personal_email',    label: 'Personal Email',icon: <IconMail /> },
  { key: 'address',           label: 'Address',       icon: <IconMapPin />, span: true },
];

// ─── Photo Panel Component ────────────────────────────────────
function PhotoPanel({ student, onPhotoUpdate }: { student: Student; onPhotoUpdate: (url: string | null) => void }) {
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(student.photo_url ?? null);

  // ── Resilient image loading ──────────────────────────────────
  // Cloudinary can be slow on a cold cache and occasionally times out (408).
  // Retry a few times before giving up, and distinguish "load failed" from
  // "no photo" so a transient error never masquerades as a missing photo.
  const MAX_RETRIES = 2;
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    setAttempt(0);
    setLoadFailed(false);
  }, [previewUrl]);

  useEffect(() => () => { if (retryTimer.current) window.clearTimeout(retryTimer.current); }, []);

  const isBlob = previewUrl?.startsWith('blob:') ?? false;
  // Cache-bust on retry so the browser re-requests instead of reusing a failed response.
  const displaySrc = previewUrl && attempt > 0 && !isBlob
    ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}_r=${attempt}`
    : previewUrl;

  const handleImgError = () => {
    if (attempt < MAX_RETRIES) {
      retryTimer.current = window.setTimeout(() => setAttempt(a => a + 1), 1000);
    } else {
      setLoadFailed(true);
    }
  };

  const retryLoad = () => { setLoadFailed(false); setAttempt(0); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post<{ photo_url: string }>(`/students/${student.id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewUrl(res.data.photo_url);
      onPhotoUpdate(res.data.photo_url);
      success('Photo uploaded', 'Student photo saved to Cloudinary.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Upload failed', msg ?? 'Could not upload photo.');
      setPreviewUrl(student.photo_url ?? null); // revert
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!previewUrl) return;
    setDeletingPhoto(true);
    try {
      await api.delete(`/students/${student.id}/photo`);
      setPreviewUrl(null);
      onPhotoUpdate(null);
      success('Photo removed', 'Student photo has been deleted.');
    } catch {
      toastError('Delete failed', 'Could not remove photo.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  return (
    <div>
      {/* Photo Display */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '2px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text-3)',
          position: 'relative',
        }}
      >
        {previewUrl && !loadFailed ? (
          <img
            key={attempt}
            src={displaySrc ?? undefined}
            alt={`${student.name} photo`}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onLoad={() => setLoadFailed(false)}
            onError={handleImgError}
          />
        ) : previewUrl && loadFailed ? (
          <>
            <IconImageOff />
            <span style={{ fontSize: '0.74rem', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
              Couldn’t load photo
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={retryLoad}>
              Retry
            </button>
          </>
        ) : (
          <>
            <IconCamera />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
              No Photo
            </span>
          </>
        )}

        {/* Upload overlay on hover */}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Spinner />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={`photo-upload-${student.id}`}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          style={{ flex: 1 }}
          disabled={uploading || deletingPhoto}
          onClick={() => fileInputRef.current?.click()}
          title="Upload or change photo"
        >
          {uploading ? <Spinner /> : <IconUpload />}
          {previewUrl ? 'Change' : 'Upload'}
        </button>
        {previewUrl && (
          <button
            className="btn btn-danger btn-sm"
            type="button"
            disabled={uploading || deletingPhoto}
            onClick={handleDeletePhoto}
            title="Remove photo"
          >
            {deletingPhoto ? <Spinner /> : <IconTrashPhoto />}
          </button>
        )}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
        JPEG · PNG · WebP · max 5 MB
      </p>

      {/* Register Number card below photo */}
      <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 4 }}>Student ID</div>
        <div style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{student.register_number}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
type Props = { onLogout: () => void };

export function StudentDetailPage({ onLogout }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [student, setStudent]   = useState<Student | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<Student>(`/students/${id}`);
        if (active) setStudent(res.data);
      } catch {
        if (active) toastError('Not found', 'Could not load student profile.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!student) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${student.id}`);
      success('Student deleted', `${student.name} has been removed.`);
      navigate('/students', { replace: true });
    } catch {
      toastError('Delete failed', 'Could not delete this student record.');
      setDeleting(false);
    }
  };

  const handlePhotoUpdate = (url: string | null) => {
    if (student) setStudent(prev => prev ? { ...prev, photo_url: url ?? undefined } : prev);
  };

  return (
    <Shell
      title={loading ? 'Student Profile' : (student?.name ?? 'Student Profile')}
      subtitle={student ? `${student.department} · Batch ${student.batch}` : undefined}
      onLogout={onLogout}
      actions={
        student ? (
          <>
            <button className="btn btn-outline" type="button" onClick={() => navigate(-1)}>
              <IconArrowLeft /> Back
            </button>
            <button className="btn btn-primary" type="button" id="edit-student-btn" onClick={() => navigate(`/students/${student.id}/edit`)}>
              <IconEdit /> Edit
            </button>
            <button className="btn btn-danger" type="button" id="delete-student-btn" onClick={() => setShowDelete(true)}>
              <IconTrash /> Delete
            </button>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="card card-padded">
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 28 }}>
            <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 16, width: '70%', borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : student ? (
        <div className="card card-padded">
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <span className="badge badge-blue"  style={{ padding: '4px 14px' }}>{student.department}</span>
            <span className="badge badge-gray"  style={{ padding: '4px 14px' }}>Batch {student.batch}</span>
            <span className="badge badge-purple" style={{ padding: '4px 14px' }}>Section {student.section}</span>
            <span className="badge badge-green" style={{ padding: '4px 14px' }}>Active</span>
          </div>

          <div className="profile-layout">
            {/* Photo Panel */}
            <PhotoPanel student={student} onPhotoUpdate={handlePhotoUpdate} />

            {/* Info Grid */}
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.02em' }}>
                {student.name}
              </h2>

              <div className="profile-info-grid">
                {FIELDS.map(({ key, label, icon, span }) => {
                  const value = student[key];
                  return (
                    <div key={key} className="profile-field" style={span ? { gridColumn: '1 / -1' } : undefined}>
                      <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {icon}{label}
                      </span>
                      <span className={`field-value${!value ? ' empty' : ''}`}>
                        {value || 'Not provided'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                <span>Added: <strong>{new Date(student.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                <span>Updated: <strong>{new Date(student.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card card-padded">
          <p style={{ color: 'var(--text-2)' }}>Student record not found.</p>
        </div>
      )}

      {showDelete && student && (
        <ConfirmModal
          title="Delete Student Record"
          description={`Are you sure you want to permanently delete ${student.name} (${student.register_number})? This action cannot be undone.`}
          confirmLabel="Delete Student"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
        />
      )}
    </Shell>
  );
}
