import { useCallback, useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS, type Student } from '../types';

type Props = { onLogout: () => void };

function IconAlertTriangle() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

const todayStr = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function CRAttendancePage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [availableSections, setAvailableSections] = useState<string[]>(['A', 'B', 'C', 'D']);
  const [date, setDate] = useState(todayStr());

  // Autocomplete state
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected absentees list
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);

  // Modal & submission state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Today's absentees view
  const [todayAbsentees, setTodayAbsentees] = useState<{ id: number; name: string; register_number: string }[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);

  // Fetch sections meta
  useEffect(() => {
    api.get<{ sections: string[] }>('/students/meta/sections')
      .then((res) => {
        if (res.data.sections.length > 0) {
          setAvailableSections(res.data.sections);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete search (strictly requires & filters by selected Year and Section)
  useEffect(() => {
    if (!year || !section || !q.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.get<{ data: Student[] }>('/students/search', {
        params: { year, section, q: q.trim(), limit: 10 },
      })
        .then((res) => {
          setSuggestions(res.data.data);
          setShowDropdown(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, year, section]);

  // Load today's absentees preview for selected class
  const fetchTodayAbsentees = useCallback(async () => {
    if (!year || !section) {
      setTodayAbsentees([]);
      return;
    }
    setLoadingToday(true);
    try {
      const res = await api.get<{ date: string; data: { year: string; section: string; absentees: { id: number; name: string; register_number: string }[] }[] }>('/attendance/day', {
        params: { date },
      });
      const match = res.data.data.find(
        (g) => String(g.year) === String(year) && String(g.section).toLowerCase() === String(section).toLowerCase()
      );
      setTodayAbsentees(match ? match.absentees : []);
    } catch {
      setTodayAbsentees([]);
    } finally {
      setLoadingToday(false);
    }
  }, [date, year, section]);

  useEffect(() => {
    void fetchTodayAbsentees();
  }, [fetchTodayAbsentees]);

  const addStudent = (student: Student) => {
    if (selectedStudents.some((s) => s.id === student.id)) {
      toastError('Already added', `${student.name} is already in the absentees list.`);
      return;
    }
    setSelectedStudents((prev) => [...prev, student]);
    setQ('');
    setShowDropdown(false);
  };

  const removeStudent = (studentId: number) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('/attendance/cr-submit', {
        year,
        section,
        att_date: date,
        absent_student_ids: selectedStudents.map((s) => s.id),
      });
      success('Absentees saved', `Attendance updated for ${YEAR_LABELS[year] ?? year} Sec ${section}`);
      setSelectedStudents([]);
      setShowConfirmModal(false);
      void fetchTodayAbsentees();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Submission failed', msg ?? 'Could not update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell
      title="Class Representative Absentees Update"
      subtitle="Select class, search student name, and mark today's absentees"
      onLogout={onLogout}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, maxWidth: 840, margin: '0 auto' }}>
        {/* Class Selector Card */}
        <div className="card card-padded">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>1. Select Class & Date</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Academic Year *
              </label>
              <select className="form-control" value={year} onChange={(e) => { setYear(e.target.value); setSelectedStudents([]); }}>
                <option value="">Select Year</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{YEAR_LABELS[y]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Section *
              </label>
              <select className="form-control" value={section} onChange={(e) => { setSection(e.target.value); setSelectedStudents([]); }}>
                <option value="">Select Section</option>
                {availableSections.map((s) => (
                  <option key={s} value={s}>Sec {s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Date *
              </label>
              <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Autocomplete Search & Add Card */}
        <div className="card card-padded">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>
            2. Search & Add Absent Students {year && section ? `(${YEAR_LABELS[year] ?? year} - Sec ${section})` : ''}
          </h2>

          {(!year || !section) ? (
            <div style={{ padding: '16px 18px', background: 'var(--amber-light)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius)', color: 'var(--amber)', fontSize: '0.86rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center' }}>
              <IconAlertTriangle />
              <span>Please select both <strong>Academic Year</strong> and <strong>Section</strong> above first to search students for your class.</span>
            </div>
          ) : null}

          <div ref={searchRef} style={{ position: 'relative', marginBottom: 16 }}>
            <input
              type="text"
              className="form-control"
              placeholder={year && section ? `Search student in ${YEAR_LABELS[year] ?? year} Sec ${section} by name or reg no...` : 'Select Year and Section above to start search'}
              value={q}
              disabled={!year || !section}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            />

            {showDropdown && suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((s) => {
                  const isAdded = selectedStudents.some((item) => item.id === s.id);
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: '10px 14px',
                        cursor: isAdded ? 'default' : 'pointer',
                        background: isAdded ? 'var(--surface-2)' : 'transparent',
                        opacity: isAdded ? 0.6 : 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onClick={() => { if (!isAdded) addStudent(s); }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{s.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                          Reg: <span style={{ fontFamily: 'monospace' }}>{s.register_number}</span> · Enrollment: {s.enrollment_number}
                        </div>
                      </div>
                      <button type="button" className={`btn btn-sm ${isAdded ? 'btn-outline' : 'btn-primary'}`} disabled={isAdded}>
                        {isAdded ? 'Added' : '+ Add Absent'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Absentees Badges / Selected List */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
              Selected Absentees ({selectedStudents.length}):
            </div>
            {selectedStudents.length === 0 ? (
              <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontStyle: 'italic', color: 'var(--text-3)', fontSize: '0.85rem', textAlign: 'center' }}>
                No students selected yet. Type a student's name above to add them to the absentees list.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {selectedStudents.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 100,
                      color: 'var(--red)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>{s.name} ({s.register_number})</span>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--red)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px 4px',
                      }}
                      title="Remove student"
                      onClick={() => removeStudent(s.id)}
                    >
                      <IconX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              onClick={() => {
                setShowConfirmModal(true);
              }}
            >
              Submit Absentees ({selectedStudents.length})
            </button>
          </div>
        </div>

        {/* Today's Saved Absentees Report for this Class */}
        <div className="card card-padded">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 12 }}>
            3. Absentees Marked Today ({YEAR_LABELS[year] ?? year} - Sec {section})
          </h2>
          {loadingToday ? (
            <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
          ) : todayAbsentees.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No absentees marked today for this class.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Register Number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAbsentees.map((st, idx) => (
                    <tr key={st.id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{st.name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{st.register_number}</td>
                      <td><span className="badge badge-red">Absent</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmModal
          title="Confirm Absentees Submission"
          description={`Are you sure you want to mark ${selectedStudents.length} student(s) as ABSENT for ${YEAR_LABELS[year] ?? year} Sec ${section} on ${date}?`}
          confirmLabel={submitting ? 'Submitting…' : 'Confirm & Save'}
          loading={submitting}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirmModal(false)}
        >
          <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius)', maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
              Absent Students List:
            </div>
            {selectedStudents.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                No students selected (All students in class will be marked Present).
              </div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                {selectedStudents.map((s) => (
                  <li key={s.id} style={{ marginBottom: 4 }}>
                    {s.name} <span style={{ color: 'var(--text-3)', fontFamily: 'monospace' }}>({s.register_number})</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </ConfirmModal>
      )}
    </Shell>
  );
}
