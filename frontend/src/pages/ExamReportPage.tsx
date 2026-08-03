import { useEffect, useState, useRef } from 'react';
import { Shell } from '../components/Shell';
import { SlideTabs } from '../components/SlideTabs';
import { api } from '../api';
import { useToast } from '../components/Toast';
import type { ExamCard, ExamSubject, ExamTest } from '../types';
import { YEAR_OPTIONS, YEAR_LABELS } from '../types';
import * as XLSX from 'xlsx';

type ReportStudent = {
  student_id: number;
  name: string;
  enrollment_number: string;
  register_number: string;
  section: string;
  student_total: number | null;
  teacher_score: number | null;
  splits: { split_id: number; label: string; score: number | null; marks_each: number; question_count: number; total_questions: number; question_scores?: (number | null)[]; }[];
};

export function ExamReportPage({ onLogout }: { onLogout: () => void }) {
  const [cards, setCards] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<number | ''>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedTestId, setSelectedTestId] = useState<number | ''>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [viewingStudent, setViewingStudent] = useState<ReportStudent | null>(null);
  
  const [reportData, setReportData] = useState<ReportStudent[]>([]);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: toastErr } = useToast();

  useEffect(() => {
    api.get('/exam-cards')
      .then((r) => setCards(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCardId) {
      const card = cards.find(c => c.id === selectedCardId);
      if (card && !card.subjects) {
        api.get(`/exam-cards/${selectedCardId}`)
          .then((r) => {
            setCards(prev => prev.map(c => c.id === selectedCardId ? r.data.data : c));
          })
          .catch(() => toastErr('Error', 'Failed to load card details'));
      }
    }
  }, [selectedCardId, cards, toastErr]);

  const getSubjects = () => {
    const card = cards.find(c => c.id === selectedCardId);
    return (card?.subjects ?? []) as ExamSubject[];
  };

  const getTests = () => {
    const subj = getSubjects().find(s => s.id === selectedSubjectId);
    return (subj?.tests ?? []) as ExamTest[];
  };

  const fetchReport = async (testId: number | '') => {
    setFetchingReport(true);
    try {
      if (testId) {
        const res = await api.get(`/exam-report/${testId}`);
        setReportData(res.data.data);
      } else {
        const url = selectedYear ? `/exam-report/default?year=${selectedYear}` : '/exam-report/default';
        const res = await api.get(url);
        setReportData(res.data.data);
      }
    } catch {
      toastErr('Error', 'Failed to fetch exam report');
      setReportData([]);
    } finally {
      setFetchingReport(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedTestId);
    setSelectedSection('');
    setSelectedStudentIds(new Set());
  }, [selectedTestId, selectedYear]);

  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [selectedSection]);

  const handleLocalScoreChange = (studentId: number, markStr: string) => {
    const mark = markStr === '' ? null : Number(markStr);
    setReportData(prev => prev.map(s => s.student_id === studentId ? { ...s, teacher_score: mark } : s));
  };

  const handleClearMarks = () => {
    if (confirm("Are you sure you want to clear these marks? You must click 'Save All Marks' to save this change to the database.")) {
      setReportData(prev => prev.map(s => {
        if (selectedStudentIds.size > 0) {
          if (selectedStudentIds.has(s.student_id)) {
            return { ...s, teacher_score: null };
          }
        } else if (!selectedSection || s.section === selectedSection) {
          return { ...s, teacher_score: null };
        }
        return s;
      }));
      setSelectedStudentIds(new Set());
    }
  };

  const handleDownloadExcel = () => {
    const displayedData = selectedSection ? reportData.filter(s => s.section === selectedSection) : reportData;
    const exportData = displayedData.map(s => ({
      'Enrollment No': s.enrollment_number,
      'Name': s.name,
      'Class': s.section || '',
      'Student Total': s.student_total !== null ? Number(s.student_total) : '',
      'Teacher Total': s.teacher_score !== null ? Number(s.teacher_score) : ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam Report");
    XLSX.writeFile(wb, `Exam_Report_Test_${selectedTestId}.xlsx`);
  };

  const handleBulkSave = async () => {
    if (!selectedTestId) return;
    setFetchingReport(true);
    try {
      const marksPayload = reportData
        .map(row => ({
          enrollment_number: row.enrollment_number,
          mark: row.teacher_score
        }));
        
      await api.post(`/exam-report/upload/${selectedTestId}`, { marks: marksPayload });
      success('Saved', 'Marks saved successfully');
      fetchReport(selectedTestId);
    } catch {
      toastErr('Error', 'Failed to save marks');
      setFetchingReport(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTestId) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let matchCount = 0;
        setReportData(prev => {
          const newData = [...prev];
          for (const row of data as any[]) {
            const keys = Object.keys(row);
            const enrollKey = keys.find(k => k.toLowerCase().includes('enrollment'));
            const regKey = keys.find(k => k.toLowerCase().includes('register'));
            const nameKey = keys.find(k => k.toLowerCase().includes('name'));
            const markKey = keys.find(k => k.toLowerCase().includes('mark') || k.toLowerCase().includes('total') || k.toLowerCase().includes('score'));
            
            if (markKey) {
              const mark = Number(row[markKey]);
              if (isNaN(mark)) continue;
              
              const enroll = enrollKey ? String(row[enrollKey]).trim().toLowerCase() : '';
              const reg = regKey ? String(row[regKey]).trim().toLowerCase() : '';
              const name = nameKey ? String(row[nameKey]).trim().toLowerCase() : '';
              
              const studentIdx = newData.findIndex(s => {
                 const sEnroll = s.enrollment_number.toLowerCase();
                 const sReg = s.register_number?.toLowerCase() || '';
                 const sName = s.name.toLowerCase();
                 
                 // If the excel row has the identifier, it must match.
                 // We count how many provided identifiers match.
                 let matches = 0;
                 let provided = 0;
                 
                 if (enroll) { provided++; if (sEnroll === enroll) matches++; }
                 if (reg) { provided++; if (sReg === reg) matches++; }
                 if (name) { provided++; if (sName === name) matches++; }
                 
                 // Consider it a match if at least one unique identifier (enroll/reg) matches, 
                 // OR if they only provided Name and it matches.
                 return (enroll && sEnroll === enroll) || 
                        (reg && sReg === reg) || 
                        (provided === 1 && name && sName === name) ||
                        (matches >= 2);
              });
              
              if (studentIdx !== -1) {
                newData[studentIdx] = { ...newData[studentIdx], teacher_score: mark };
                matchCount++;
              }
            }
          }
          return newData;
        });
        
        if (matchCount === 0) {
          toastErr('Warning', 'No matching students found in the file.');
        } else {
          success('Success', `Loaded ${matchCount} marks. Click "Save All Marks" below to save.`);
        }
        
      } catch (err) {
        toastErr('Error', 'Failed to process Excel file');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const uniqueSections = Array.from(new Set(reportData.map(s => s.section))).filter(Boolean).sort();
  const displayedData = selectedSection ? reportData.filter(s => s.section === selectedSection) : reportData;

  const headerActions = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {selectedTestId && (
        <>
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button className="btn btn-outline" onClick={handleDownloadExcel} title="Download Excel">
            Download
          </button>
        </>
      )}
      <button className="btn btn-outline" onClick={() => fetchReport(selectedTestId)} disabled={fetchingReport}>
        {fetchingReport ? 'Refreshing...' : 'Refresh'}
      </button>
      {selectedTestId && (
        <button 
          className="btn btn-outline" 
          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          onClick={handleClearMarks} 
          title="Clear marks for displayed students"
        >
          {selectedStudentIds.size > 0 ? `Clear ${selectedStudentIds.size} Selected` : selectedSection ? 'Clear Class' : 'Clear All'}
        </button>
      )}
    </div>
  );

  return (
    <Shell onLogout={onLogout} title="Exams" tabs={<SlideTabs />} actions={headerActions}>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Year</label>
              <select
                className="form-control"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedCardId('');
                  setSelectedSubjectId('');
                  setSelectedTestId('');
                }}
              >
                <option value="">— All Years —</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </div>
            
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Exam Card</label>
              <select
                className="form-control"
                value={selectedCardId}
                onChange={(e) => {
                  setSelectedCardId(Number(e.target.value) || '');
                  setSelectedSubjectId('');
                  setSelectedTestId('');
                }}
              >
                <option value="">— Select Exam Card —</option>
                {cards.filter(c => !selectedYear || String(c.year_assigned) === selectedYear).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Subject</label>
              <select
                className="form-control"
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(Number(e.target.value) || '');
                  setSelectedTestId('');
                }}
                disabled={!selectedCardId}
              >
                <option value="">— Select Subject —</option>
                {getSubjects().map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </div>
            
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Test</label>
              <select
                className="form-control"
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(Number(e.target.value) || '')}
                disabled={!selectedSubjectId}
              >
                <option value="">— Select Test —</option>
                {getTests().map(t => <option key={t.id} value={t.id}>{t.test_name} (Max: {t.total_marks})</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                
                {uniqueSections.length > 0 && (
                  <select
                    className="form-control"
                    style={{ minWidth: 120, padding: '4px 8px', fontSize: '0.9rem' }}
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {uniqueSections.map(sec => (
                      <option key={sec} value={sec}>Class {sec}</option>
                    ))}
                  </select>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-1)', marginLeft: 8 }}>
                  <input
                    type="checkbox"
                    checked={showMatch}
                    onChange={(e) => setShowMatch(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Highlight Matches
                </label>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={{ padding: '12px 24px', width: '48px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                        checked={displayedData.length > 0 && selectedStudentIds.size === displayedData.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds(new Set(displayedData.map(s => s.student_id)));
                          } else {
                            setSelectedStudentIds(new Set());
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrollment No</th>
                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Split Mark</th>
                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Student Total</th>
                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Teacher Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedData.map(row => {
                    let bg = 'transparent';
                    if (showMatch) {
                      const studentVal = row.student_total == null ? 0 : Number(row.student_total);
                      if (row.teacher_score == null) {
                        bg = 'rgba(120, 53, 15, 0.7)'; // Yellow (Warning)
                      } else {
                        const teacherVal = Number(row.teacher_score);
                        bg = studentVal === teacherVal ? 'rgba(20, 83, 45, 0.7)' : 'rgba(127, 29, 29, 0.7)';
                      }
                    }
                    
                    return (
                      <tr key={row.student_id} style={{ borderBottom: '1px solid var(--border)', background: bg }}>
                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                            checked={selectedStudentIds.has(row.student_id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedStudentIds);
                              if (e.target.checked) newSet.add(row.student_id);
                              else newSet.delete(row.student_id);
                              setSelectedStudentIds(newSet);
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 24px', fontSize: '0.9rem', color: 'var(--text-1)' }}>{row.enrollment_number}</td>
                        <td style={{ padding: '12px 24px', fontSize: '0.9rem', color: 'var(--text-1)' }}>{row.name}</td>
                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            onClick={() => setViewingStudent(row)}
                            disabled={!row.splits || row.splits.length === 0}
                          >
                            View
                          </button>
                        </td>
                        <td style={{ padding: '12px 24px', fontSize: '0.9rem', color: 'var(--text-2)', textAlign: 'center' }}>
                          {row.student_total !== null ? Number(row.student_total) : '-'}
                        </td>
                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                          <input
                            type="number"
                            className="form-control"
                            style={{ width: 80, textAlign: 'center', padding: '6px' }}
                            value={row.teacher_score ?? ''}
                            onChange={(e) => handleLocalScoreChange(row.student_id, e.target.value)}
                            placeholder="Mark"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {displayedData.length === 0 && !fetchingReport && (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {displayedData.length > 0 && selectedTestId && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn-primary"
                  onClick={handleBulkSave}
                  disabled={fetchingReport}
                  style={{ padding: '10px 24px', fontSize: '1rem' }}
                >
                  {fetchingReport ? 'Saving...' : 'Save All Marks'}
                </button>
              </div>
            )}
          </div>
      </div>

      {viewingStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-padded" style={{ width: 400, maxWidth: '90%', backgroundColor: '#111827', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-1)' }}>Split Marks - {viewingStudent.name}</h3>
            <div style={{ marginBottom: 20, maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
              {viewingStudent.splits.map((sp, i) => (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                    {sp.label} <small style={{ color: 'var(--text-2)', fontWeight: 'normal' }}>(Max: {sp.marks_each * sp.question_count})</small>
                  </div>
                  {Array.from({ length: sp.total_questions }).map((_, qIdx) => {
                    const qScore = sp.question_scores?.[qIdx] ?? null;
                    return (
                      <div key={qIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>Question {qIdx + 1} <small>(Max: {sp.marks_each})</small></span>
                        <strong style={{ color: 'var(--text-1)' }}>{qScore !== null ? qScore : '-'}</strong>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setViewingStudent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
