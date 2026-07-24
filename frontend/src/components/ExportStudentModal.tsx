import { useState } from 'react';
import { api } from '../api';

type Props = {
  onClose: () => void;
  filters: any;
  studentId?: number; // if provided, export only this student
};

export function ExportStudentModal({ onClose, filters, studentId }: Props) {
  const [includeDetails, setIncludeDetails] = useState(false);
  const [includeAbsence, setIncludeAbsence] = useState(false);
  const [includeLate, setIncludeLate] = useState(false);
  const [includeAchievements, setIncludeAchievements] = useState(false);
  const [includePlacements, setIncludePlacements] = useState(false);

  const handleDownload = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    
    if (studentId) {
      params.set('id', String(studentId));
    } else {
      if (filters.name) params.set('name', filters.name);
      if (filters.department) params.set('department', filters.department);
      if (filters.batch) params.set('batch', filters.batch);
      if (filters.section) params.set('section', filters.section);
      if (filters.year) params.set('year', filters.year);
    }
    
    if (includeDetails) params.set('includeDetails', 'true');
    if (includeAbsence) params.set('includeAbsence', 'true');
    if (includeLate) params.set('includeLate', 'true');
    if (includeAchievements) params.set('includeAchievements', 'true');
    if (includePlacements) params.set('includePlacements', 'true');

    // Call API (using window.open so the browser handles the file download)
    const url = `${api.defaults.baseURL}/students/export?${params.toString()}`;
    
    // We need to fetch it manually to include the Authorization header, OR we can append a token.
    // Since the API uses cookies/localStorage, window.open might not pass the Authorization header.
    // The safest way for a download with JWT is to fetch the blob manually.
    fetchBlobAndDownload(url);
  };

  const fetchBlobAndDownload = async (url: string) => {
    try {
      const token = localStorage.getItem('student-portal-auth');
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `students_export_${ts}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to download export.');
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'clamp(18px, 4vw, 28px)', boxShadow: 'var(--shadow-lg)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Export Student Data</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 20, fontSize: '0.9rem' }}>
          Select which additional records you want to include in the CSV export (Name, Register No & Section are included by default).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-2)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            <input type="checkbox" checked={includeDetails} onChange={e => setIncludeDetails(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Include Full Student Details (Dept, Batch, Contact, etc.)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-2)', borderRadius: 8 }}>
            <input type="checkbox" checked={includeAbsence} onChange={e => setIncludeAbsence(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 600 }}>Include Absence Records</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-2)', borderRadius: 8 }}>
            <input type="checkbox" checked={includeLate} onChange={e => setIncludeLate(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 600 }}>Include Late Records</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-2)', borderRadius: 8 }}>
            <input type="checkbox" checked={includeAchievements} onChange={e => setIncludeAchievements(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 600 }}>Include Achievements</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-2)', borderRadius: 8 }}>
            <input type="checkbox" checked={includePlacements} onChange={e => setIncludePlacements(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 600 }}>Include Placements</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDownload}>Download CSV</button>
        </div>
      </div>
    </div>
  );
}
