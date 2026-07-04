import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Student, StudentListResponse } from '../types';

type Props = {
  selected: Student[];
  onChange: (students: Student[]) => void;
  lockedIds?: number[];
};

/** Searchable, filterable multi-select of students (used to build a team). */
export function StudentPicker({ selected, onChange, lockedIds = [] }: Props) {
  const [q, setQ] = useState('');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('');
  const [batches, setBatches] = useState<string[]>([]);
  const [results, setResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ departments: string[]; batches: string[] }>('/students/meta')
      .then((r) => setBatches(r.data.batches))
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get<StudentListResponse>('/students', {
        params: { q: q || undefined, batch: batch || undefined, section: section || undefined, limit: 20 },
      })
        .then((r) => setResults(r.data.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, batch, section]);

  const selectedIds = new Set(selected.map((s) => s.id));

  const toggle = (student: Student) => {
    if (selectedIds.has(student.id)) {
      if (lockedIds.includes(student.id)) return; // can't remove the scanned student
      onChange(selected.filter((s) => s.id !== student.id));
    } else {
      onChange([...selected, student]);
    }
  };

  return (
    <div>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selected.map((s) => (
            <span key={s.id} className="badge badge-blue" style={{ padding: '4px 10px', gap: 6 }}>
              {s.name}
              {!lockedIds.includes(s.id) && (
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-label={`Remove ${s.name}`}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', fontWeight: 700, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          className="form-control"
          style={{ flex: '2 1 160px', height: 38 }}
          placeholder="Search name / number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="form-control" style={{ flex: '1 1 100px', height: 38 }} value={batch} onChange={(e) => setBatch(e.target.value)}>
          <option value="">All years</option>
          {batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input
          className="form-control"
          style={{ flex: '1 1 90px', height: 38 }}
          placeholder="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        />
      </div>

      {/* Results */}
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        {loading ? (
          <div style={{ padding: 14, fontSize: '0.82rem', color: 'var(--text-3)' }}>Searching…</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 14, fontSize: '0.82rem', color: 'var(--text-3)' }}>No students found.</div>
        ) : (
          results.map((s) => {
            const picked = selectedIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  width: '100%', padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: picked ? 'var(--blue-light)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{s.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginLeft: 8 }}>
                    {s.register_number} · {s.batch} · Sec {s.section}
                  </span>
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: picked ? 'var(--blue)' : 'var(--text-3)' }}>
                  {picked ? '✓ Added' : '+ Add'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
