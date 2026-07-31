import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import type {
  ExamCard,
  ExamSubject,
  ExamTest,
  ExamMarkSplit,
  ExamTestMarksResponse,
} from '../types';
import { YEAR_LABELS } from '../types';

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ─── Draft types (UI only, include _id for keying) ────────────────────────────
interface SplitDraft { _id: string; id?: number; label: string; marks_each: number; total_questions: number; question_count: number; }
interface TestDraft  { _id: string; id?: number; test_name: string; total_marks: number; splits: SplitDraft[]; }
interface SubjectDraft { _id: string; id?: number; subject_name: string; tests: TestDraft[]; }

function emptySplit(): SplitDraft { return { _id: crypto.randomUUID(), label: '', marks_each: 1, total_questions: 1, question_count: 1 }; }
function emptyTest(): TestDraft  { return { _id: crypto.randomUUID(), test_name: '', total_marks: 0, splits: [emptySplit()] }; }
function emptySubject(): SubjectDraft { return { _id: crypto.randomUUID(), subject_name: '', tests: [emptyTest()] }; }

const yearOptions = [
  { value: '1', label: 'I Year' }, { value: '2', label: 'II Year' },
  { value: '3', label: 'III Year' }, { value: '4', label: 'IV Year' },
];

function downloadCSV(data: ExamTestMarksResponse, rows: ExamTestMarksResponse['rows'], cardTitle: string) {
  const splitLabels = data.splits.map((s) => s.label);
  const header = ['Register No', 'Name', 'Section', ...splitLabels, 'Total', 'Out of 100'];
  const csvRows = rows.map((r) => [
    r.register_number, r.name, r.section,
    ...r.splits.map((s) => s.score ?? ''),
    r.total, r.out_of_100,
  ]);
  const csv = [header, ...csvRows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${cardTitle}_${data.test_name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── View Marks Modal ─────────────────────────────────────────────────────────
function ViewMarksModal({ card, onClose }: { card: ExamCard; onClose: () => void }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedTestId, setSelectedTestId]       = useState<number | ''>('');
  const [selectedSection, setSelectedSection]     = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<ExamTestMarksResponse | null>(null);
  const { error: toastError } = useToast();

  const subjects: ExamSubject[] = (card.subjects ?? []) as ExamSubject[];
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const tests: ExamTest[] = (selectedSubject?.tests ?? []) as ExamTest[];

  const fetchMarks = useCallback(async (testId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/exam-cards/${card.id}/marks?test_id=${testId}`);
      setData(res.data.data);
    } catch { toastError('Failed to load marks'); }
    finally { setLoading(false); }
  }, [card.id, toastError]);

  useEffect(() => {
    if (selectedTestId) { fetchMarks(Number(selectedTestId)); setSelectedSection(''); }
    else { setData(null); setSelectedSection(''); }
  }, [selectedTestId, fetchMarks]);

  const uniqueSections = Array.from(new Set(data?.rows.map((r) => r.section) || [])).filter(Boolean).sort();
  const filteredRows = data ? data.rows.filter((r) => !selectedSection || r.section === selectedSection) : [];

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-1)' }}>📊 {card.title}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{card.semester} · {YEAR_LABELS[card.year_assigned]}</span>
          </div>
          <button onClick={onClose} style={styles.iconBtn}><IconClose /></button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexShrink: 0, flexWrap: 'wrap' }}>
          <select style={styles.select} value={selectedSubjectId}
            onChange={(e) => { setSelectedSubjectId(Number(e.target.value) || ''); setSelectedTestId(''); setData(null); }}>
            <option value="">— Select Subject —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
          <select style={styles.select} value={selectedTestId}
            onChange={(e) => setSelectedTestId(Number(e.target.value) || '')}
            disabled={!selectedSubjectId}>
            <option value="">— Select Test —</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.test_name} (/{t.total_marks})</option>)}
          </select>
          {data && uniqueSections.length > 0 && (
            <select style={styles.select} value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}>
              <option value="">— All Sections —</option>
              {uniqueSections.map((sec) => <option key={sec} value={sec}>Section {sec}</option>)}
            </select>
          )}
          {data && (
            <button style={{ ...styles.btn, ...styles.btnPrimary, marginLeft: 'auto' }}
              onClick={() => downloadCSV(data, filteredRows, card.title)}>
              <IconDownload /> Download CSV
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {loading && <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 40 }}>Loading…</p>}
          {!loading && !data && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
              <p>Select a subject and test to view marks</p>
            </div>
          )}
          {!loading && data && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Reg. No</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Sec</th>
                  {data.splits.map((sp) => (
                    <th key={sp.id} style={{ ...styles.th, textAlign: 'center' }}>
                      {sp.label}<br />
                      <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>/{sp.marks_each * sp.question_count}</span>
                    </th>
                  ))}
                  <th style={{ ...styles.th, textAlign: 'center' }}>Total<br /><span style={{ fontSize: '0.7rem', opacity: 0.6 }}>/{data.total_marks}</span></th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Out of 100</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.student_id}>
                    <td style={styles.td}>{row.register_number}</td>
                    <td style={styles.td}>{row.name}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{row.section}</td>
                    {row.splits.map((sp, i) => (
                      <td key={i} style={{ ...styles.td, textAlign: 'center' }}>
                        {sp.score !== null
                          ? <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{sp.score}</span>
                          : <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>—</span>}
                      </td>
                    ))}
                    <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{row.total}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
                        background: row.out_of_100 >= 75 ? 'rgba(52,211,153,0.15)' : row.out_of_100 >= 50 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                        color: row.out_of_100 >= 75 ? '#34d399' : row.out_of_100 >= 50 ? '#fbbf24' : '#f87171',
                      }}>{row.out_of_100}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create/Edit Card Modal ────────────────────────────────────────────────────────
function CreateCardModal({ editCardId, onClose, onCreated }: { editCardId?: number | null; onClose: () => void; onCreated: () => void }) {
  const { success, error: toastError } = useToast();
  const [title, setTitle]       = useState('');
  const [semester, setSemester] = useState('');
  const [yearAssigned, setYearAssigned] = useState('1');
  const [subjects, setSubjects] = useState<SubjectDraft[]>([emptySubject()]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (editCardId) {
      api.get(`/exam-cards/${editCardId}`).then((res) => {
        const c = res.data.data;
        setTitle(c.title);
        setSemester(c.semester);
        setYearAssigned(String(c.year_assigned));
        setSubjects(c.subjects.map((s: any) => ({
          _id: String(s.id), id: s.id, subject_name: s.subject_name,
          tests: s.tests.map((t: any) => ({
            _id: String(t.id), id: t.id, test_name: t.test_name, total_marks: t.total_marks,
            splits: t.splits.map((sp: any) => ({
              _id: String(sp.id), id: sp.id, label: sp.label,
              marks_each: sp.marks_each, total_questions: sp.total_questions, question_count: sp.question_count
            }))
          }))
        })));
      }).catch(() => toastError('Error', 'Failed to load card details'));
    }
  }, [editCardId, toastError]);

  const addSubject = () => setSubjects((p) => [...p, emptySubject()]);
  const removeSubject = (sid: string) => setSubjects((p) => p.filter((s) => s._id !== sid));
  const updateSubjectName = (sid: string, val: string) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid ? { ...s, subject_name: val } : s));

  const addTest = (sid: string) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid ? { ...s, tests: [...s.tests, emptyTest()] } : s));
  const removeTest = (sid: string, tid: string) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid ? { ...s, tests: s.tests.filter((t) => t._id !== tid) } : s));
  const updateTest = (sid: string, tid: string, field: keyof TestDraft, val: string | number) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid
      ? { ...s, tests: s.tests.map((t): TestDraft => t._id === tid ? { ...t, [field]: val } : t) }
      : s));

  const addSplit = (sid: string, tid: string) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid
      ? { ...s, tests: s.tests.map((t): TestDraft => t._id === tid ? { ...t, splits: [...t.splits, emptySplit()] } : t) }
      : s));
  const removeSplit = (sid: string, tid: string, spid: string) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid
      ? { ...s, tests: s.tests.map((t): TestDraft => t._id === tid ? { ...t, splits: t.splits.filter((sp) => sp._id !== spid) } : t) }
      : s));
  const updateSplit = (sid: string, tid: string, spid: string, field: keyof SplitDraft, val: string | number) =>
    setSubjects((p) => p.map((s): SubjectDraft => s._id === sid
      ? { ...s, tests: s.tests.map((t): TestDraft => t._id === tid
          ? { ...t, splits: t.splits.map((sp): SplitDraft => sp._id === spid ? { ...sp, [field]: val } : sp) }
          : t) }
      : s));

  const handleSave = async () => {
    if (!title.trim()) { toastError('Validation', 'Card title is required'); return; }
    if (!semester.trim()) { toastError('Validation', 'Semester label is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), semester: semester.trim(), year_assigned: yearAssigned,
        subjects: subjects.map(s => ({
          id: s.id,
          subject_name: s.subject_name.trim(),
          tests: s.tests.map(t => ({
            id: t.id,
            test_name: t.test_name.trim(),
            total_marks: Number(t.total_marks),
            splits: t.splits.map(sp => ({
              id: sp.id,
              label: sp.label.trim(),
              marks_each: Number(sp.marks_each),
              question_count: Number(sp.question_count),
              total_questions: Number(sp.total_questions)
            }))
          }))
        }))
      };
      if (editCardId) {
        await api.put(`/exam-cards/${editCardId}`, payload);
        success('Updated', 'Exam card updated successfully');
      } else {
        await api.post('/exam-cards', payload);
        success('Created', 'Exam card created successfully');
      }
      onCreated();
    } catch { toastError('Error', editCardId ? 'Failed to update exam card' : 'Failed to create exam card'); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, maxWidth: 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-1)' }}>{editCardId ? 'Edit Exam Card' : 'Create Exam Card'}</h2>
          <button onClick={onClose} style={styles.iconBtn}><IconClose /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {/* Card meta */}
          <div style={styles.formSection}>
            <label style={styles.label}>Card Title *</label>
            <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Semester 3 Internal Marks" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={styles.label}>Semester Label *</label>
              <input style={styles.input} value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. Semester 3 / ODD 2024" />
            </div>
            <div>
              <label style={styles.label}>Assign to Year *</label>
              <select style={styles.select} value={yearAssigned} onChange={(e) => setYearAssigned(e.target.value)}>
                {yearOptions.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
          </div>

          {/* Subjects */}
          {subjects.map((subj, si) => (
            <div key={subj._id} style={styles.card}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <span style={styles.badge}>Subject {si + 1}</span>
                <input style={{ ...styles.input, flex: 1, marginBottom: 0 }} value={subj.subject_name}
                  onChange={(e) => updateSubjectName(subj._id, e.target.value)} placeholder="Subject name" />
                {subjects.length > 1 && (
                  <button style={styles.dangerIconBtn} onClick={() => removeSubject(subj._id)}><IconTrash /></button>
                )}
              </div>

              {subj.tests.map((test, ti) => {
                const splitTotal = test.splits.reduce((acc, sp) => acc + Number(sp.marks_each) * Number(sp.question_count), 0);
                const totalOk    = splitTotal === Number(test.total_marks);
                return (
                  <div key={test._id} style={styles.testBox}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ ...styles.badge, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: '0.7rem' }}>Test {ti + 1}</span>
                      <input style={{ ...styles.input, flex: 2, marginBottom: 0 }} value={test.test_name}
                        onChange={(e) => updateTest(subj._id, test._id, 'test_name', e.target.value)}
                        placeholder="Test name (e.g. CAT 1)" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Total Marks</span>
                        <input style={{ ...styles.input, width: 72, marginBottom: 0, textAlign: 'center' }}
                          type="number" min={1} value={test.total_marks || ''}
                          onChange={(e) => updateTest(subj._id, test._id, 'total_marks', Number(e.target.value))}
                          placeholder="0" />
                      </div>
                      {subj.tests.length > 1 && (
                        <button style={styles.dangerIconBtn} onClick={() => removeTest(subj._id, test._id)}><IconTrash /></button>
                      )}
                    </div>

                    <div style={{ marginLeft: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 32px', gap: 8, marginBottom: 6 }}>
                        <span style={styles.colHeader}>Split Label</span>
                        <span style={styles.colHeader}>Marks Each</span>
                        <span style={styles.colHeader}>Total Qs</span>
                        <span style={styles.colHeader}>Answer Qs</span>
                        <span />
                      </div>
                      {test.splits.map((sp) => (
                        <div key={sp._id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 32px', gap: 8, marginBottom: 6 }}>
                          <input style={{ ...styles.input, marginBottom: 0 }} value={sp.label}
                            onChange={(e) => updateSplit(subj._id, test._id, sp._id, 'label', e.target.value)}
                            placeholder="e.g. 2 Mark" />
                          <input style={{ ...styles.input, marginBottom: 0, textAlign: 'center' }}
                            type="number" min={1} value={sp.marks_each || ''}
                            onChange={(e) => updateSplit(subj._id, test._id, sp._id, 'marks_each', Number(e.target.value))} />
                          <input style={{ ...styles.input, marginBottom: 0, textAlign: 'center' }}
                            type="number" min={1} value={sp.total_questions || ''}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              updateSplit(subj._id, test._id, sp._id, 'total_questions', v);
                              if (v < sp.question_count) updateSplit(subj._id, test._id, sp._id, 'question_count', v);
                            }} />
                          <input style={{ ...styles.input, marginBottom: 0, textAlign: 'center' }}
                            type="number" min={1} max={sp.total_questions || 999} value={sp.question_count || ''}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              updateSplit(subj._id, test._id, sp._id, 'question_count', v);
                              if (v > sp.total_questions) updateSplit(subj._id, test._id, sp._id, 'total_questions', v);
                            }} />
                          {test.splits.length > 1 && (
                            <button style={{ ...styles.dangerIconBtn, alignSelf: 'center' }}
                              onClick={() => removeSplit(subj._id, test._id, sp._id)}><IconTrash /></button>
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                        <button style={styles.ghostBtn} onClick={() => addSplit(subj._id, test._id)}>+ Add Split</button>
                        <span style={{ fontSize: '0.78rem', color: totalOk ? '#34d399' : '#f87171' }}>
                          Split sum: {splitTotal} / {test.total_marks || 0}
                          {!totalOk && test.total_marks > 0 && ' ⚠️ mismatch'}
                          {totalOk && test.total_marks > 0 && ' ✓'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button style={styles.ghostBtn} onClick={() => addTest(subj._id)}>+ Add Test</button>
            </div>
          ))}

          <button style={{ ...styles.ghostBtn, width: '100%', marginTop: 8, padding: '10px 0' }} onClick={addSubject}>
            <IconPlus /> Add Subject
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button style={styles.btn} onClick={onClose}>Cancel</button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editCardId ? 'Update Card' : 'Create Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ExamCardsPage({ onLogout }: { onLogout: () => void }) {
  const { success, error: toastError } = useToast();
  const [cards, setCards]           = useState<ExamCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCardId, setEditCardId] = useState<number | null>(null);
  const [viewCard, setViewCard]     = useState<ExamCard | null>(null);
  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const confirmRef = useRef<HTMLInputElement>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/exam-cards');
      setCards(res.data.data);
    } catch { toastError('Error', 'Failed to load exam cards'); }
    finally { setLoading(false); }
  }, [toastError]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const openView = async (card: ExamCard) => {
    try {
      const res = await api.get(`/exam-cards/${card.id}`);
      setViewCard(res.data.data);
    } catch { toastError('Error', 'Failed to load card details'); }
  };

  const toggleStatus = async (card: ExamCard) => {
    const next = card.status === 'active' ? 'disabled' : 'active';
    try {
      await api.patch(`/exam-cards/${card.id}/status`, { status: next });
      success('Updated', `Card ${next === 'active' ? 'enabled' : 'disabled'}`);
      fetchCards();
    } catch { toastError('Error', 'Failed to update status'); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/exam-cards/${deleteId}`);
      success('Deleted', 'Exam card deleted successfully');
      setDeleteId(null); setConfirmText(''); fetchCards();
    } catch { toastError('Error', 'Failed to delete card'); }
  };

  return (
    <Shell title="Exam Cards" subtitle="Manage semester internal exam cards" onLogout={onLogout}
      actions={
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setEditCardId(null); setShowCreate(true); }}>
          <IconPlus /> New Card
        </button>
      }
    >
      <div style={{ padding: '24px 0' }}>
        {loading && <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 60 }}>Loading…</p>}
        {!loading && cards.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-1)' }}>No exam cards yet</h3>
            <p style={{ margin: 0, color: 'var(--text-2)' }}>Create your first semester exam card to get started.</p>
            <button style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 20 }} onClick={() => setShowCreate(true)}>
              <IconPlus /> Create First Card
            </button>
          </div>
        )}
        <div style={styles.grid}>
          {cards.map((card) => (
            <div key={card.id} style={styles.cardBox}>
              <div style={{ ...styles.statusBar, background: card.status === 'active' ? 'linear-gradient(90deg,#34d399,#059669)' : 'linear-gradient(90deg,#6b7280,#4b5563)' }} />
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 700 }}>{card.title}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{card.semester}</span>
                  </div>
                  <span style={{
                    ...styles.badge,
                    background: card.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(107,114,128,0.2)',
                    color: card.status === 'active' ? '#34d399' : '#9ca3af',
                  }}>
                    {card.status === 'active' ? '● Active' : '○ Disabled'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={styles.chip}>📅 {YEAR_LABELS[card.year_assigned] ?? card.year_assigned}</span>
                  <span style={styles.chip}>🕐 {new Date(card.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...styles.btn, flex: 1 }} onClick={() => openView(card)}><IconEye /> View Marks</button>
                  <button style={{ ...styles.btn, flex: 1, ...(card.status === 'active' ? styles.btnWarning : styles.btnSuccess) }}
                    onClick={() => toggleStatus(card)}>
                    {card.status === 'active' ? '⊘ Disable' : '✓ Enable'}
                  </button>
                  <button style={{ ...styles.btn, padding: '8px 12px' }}
                    onClick={() => { setEditCardId(card.id); setShowCreate(true); }}>
                    <IconEdit />
                  </button>
                  <button style={{ ...styles.btn, ...styles.btnDanger, padding: '8px 12px' }}
                    onClick={() => { setDeleteId(card.id); setConfirmText(''); setTimeout(() => confirmRef.current?.focus(), 50); }}>
                    <IconTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && <CreateCardModal editCardId={editCardId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchCards(); }} />}
      {viewCard && <ViewMarksModal card={viewCard} onClose={() => setViewCard(null)} />}

      {deleteId !== null && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', color: '#f87171' }}>⚠️ Delete Exam Card</h3>
            <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>
              This will permanently delete this card and <strong>all student marks</strong>. This cannot be undone.
            </p>
            <p style={{ color: 'var(--text-2)', marginBottom: 8, fontSize: '0.9rem' }}>
              Type <strong style={{ color: 'var(--text-1)' }}>DELETE</strong> to confirm:
            </p>
            <input ref={confirmRef} style={{ ...styles.input, marginBottom: 20 }}
              value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={styles.btn} onClick={() => { setDeleteId(null); setConfirmText(''); }}>Cancel</button>
              <button style={{ ...styles.btn, ...styles.btnDanger }}
                onClick={confirmDelete} disabled={confirmText !== 'DELETE'}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16,
    padding: 28, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 },
  cardBox: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' },
  statusBar: { height: 4 },
  emptyState: { textAlign: 'center', padding: '80px 20px', background: 'var(--surface-2)', borderRadius: 16, border: '1px dashed var(--border)' },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface-3)', color: 'var(--text-1)', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
  },
  btnPrimary: { background: 'var(--accent)', color: '#fff', border: 'none' },
  btnDanger:  { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  btnWarning: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  btnSuccess: { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' },
  iconBtn: {
    display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8,
    background: 'var(--surface-3)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-2)',
  },
  dangerIconBtn: {
    display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 6, flexShrink: 0,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', color: '#f87171',
  },
  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 6, border: '1px dashed var(--border)',
    background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.82rem',
  },
  input: {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface-1)', color: 'var(--text-1)', fontSize: '0.88rem',
    outline: 'none', boxSizing: 'border-box', marginBottom: 12,
  },
  select: {
    padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface-1)', color: 'var(--text-1)', fontSize: '0.88rem', cursor: 'pointer',
  },
  label: { display: 'block', fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.02em' },
  formSection: { marginBottom: 16 },
  card: { background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 },
  testBox: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 },
  badge: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20,
    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
    background: 'rgba(52,211,153,0.15)', color: '#34d399',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20,
    fontSize: '0.76rem', background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    padding: '10px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700,
    color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase',
    borderBottom: '2px solid var(--border)', background: 'var(--surface-1)', whiteSpace: 'nowrap',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-1)', verticalAlign: 'middle' },
  colHeader: { fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600, letterSpacing: '0.04em' },
};
