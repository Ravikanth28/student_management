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

function IconFolder() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--blue)' }}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function IconTestFile() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#34d399', filter: 'drop-shadow(0px 4px 8px rgba(52, 211, 153, 0.25))' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function ExamReportPage({ onLogout }: { onLogout: () => void }) {
  const [cards, setCards] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | ''>('');
  const [selectedTestName, setSelectedTestName] = useState<string | null>(null);
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
    if (selectedSubjectId && selectedTestName) {
      const subj = getSubjects().find(s => s.id === selectedSubjectId);
      const test = subj?.tests.find(t => t.test_name === selectedTestName);
      setSelectedTestId(test ? test.id : '');
    } else {
      setSelectedTestId('');
    }
  }, [selectedSubjectId, selectedTestName, cards, selectedCardId]);

  useEffect(() => {
    if (selectedTestId) {
      fetchReport(selectedTestId);
    } else {
      setReportData([]);
    }
    setSelectedSection('');
    setSelectedStudentIds(new Set());
  }, [selectedTestId]);

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

  const getUniqueTestNames = () => {
    const subj = getSubjects();
    const names = new Set<string>();
    subj.forEach(s => s.tests.forEach(t => names.add(t.test_name)));
    return Array.from(names);
  };

  return (
    <Shell onLogout={onLogout} title="Exams" tabs={<SlideTabs />} actions={headerActions}>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        
        {selectedYear === null ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {['1', '2', '3', '4'].map((year) => (
              <div key={year} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', transition: 'all 0.2s ease', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
                onClick={() => { setSelectedYear(year); setSelectedCardId(''); setSelectedTestId(''); setReportData([]); }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >  <div style={{ marginBottom: '16px' }}><IconFolder /></div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: 'var(--text-1)' }}>{YEAR_LABELS[year] ?? `${year} Year`}</h3>
              </div>
            ))}
          </div>
        ) : selectedYear !== null && selectedTestName === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => { setSelectedYear(null); setSelectedCardId(''); setSelectedTestName(null); setSelectedSubjectId(''); }}>← Back to Years</button>
              <div style={{ flex: 1, maxWidth: 300 }}>
                <select
                  className="form-control"
                  value={selectedCardId}
                  onChange={(e) => {
                    setSelectedCardId(Number(e.target.value) || '');
                  }}
                >
                  <option value="">— Select Exam Card —</option>
                  {cards.filter(c => String(c.year_assigned) === selectedYear).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
            
            {!selectedCardId ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ margin: 0 }}>Please select an exam card above to view its tests.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {getUniqueTestNames().map(testName => (
                  <div key={testName} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', transition: 'all 0.2s ease', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
                    onClick={() => { setSelectedTestName(testName); setSelectedTestId(''); setReportData([]); }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >  <div style={{ marginBottom: '16px' }}><IconTestFile /></div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-1)' }}>{testName}</h3>
                  </div>
                ))}
                {getUniqueTestNames().length === 0 && <p style={{ color: 'var(--text-2)' }}>No tests found in this exam card.</p>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => { setSelectedTestName(null); setSelectedSubjectId(''); }}>← Back to Tests</button>
              <h3 style={{ margin: 0, color: 'var(--text-1)' }}>{selectedTestName}</h3>
              <div style={{ flex: 1, maxWidth: 300, marginLeft: 'auto' }}>
                <select
                  className="form-control"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(Number(e.target.value) || '');
                  }}
                >
                  <option value="">— Select Subject —</option>
                  {getSubjects().filter(s => s.tests.some(t => t.test_name === selectedTestName)).map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>
            </div>

            {!selectedTestId ? (
               <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 12 }}>
                 <div style={{ marginBottom: 12 }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)' }}>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              </div>
                 <h3 style={{ margin: '0 0 8px', color: 'var(--text-1)' }}>Select a Subject</h3>
                 <p style={{ margin: 0 }}>Choose a subject above to view the {selectedTestName} marks.</p>
               </div>
            ) : (
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
                      {displayedData.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-2)' }}>
                            No students found.
                          </td>
                        </tr>
                      ) : displayedData.map(row => {
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
                                style={{ width: 80, margin: '0 auto', textAlign: 'center' }}
                                value={row.teacher_score !== null ? row.teacher_score : ''}
                                onChange={(e) => handleLocalScoreChange(row.student_id, e.target.value)}
                                placeholder="Mark"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
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
        )}
      </div>

      {viewingStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-padded" style={{ width: 800, maxWidth: '95%', backgroundColor: '#111827', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-1)' }}>Split Marks - {viewingStudent.name}</h3>
            
            <div style={{ marginBottom: 24, maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Split</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px', textAlign: 'center' }}>Max</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Score</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingStudent.splits.map((sp, i) => {
                    const hasChoice = sp.total_questions > sp.question_count;
                    const subtitle = `(${sp.marks_each}M × ${sp.question_count} Q${hasChoice ? ` out of ${sp.total_questions}` : ''})`;
                    
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <strong style={{ color: 'var(--text-1)', fontSize: '1rem' }}>{sp.label}</strong>
                            <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{subtitle}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px', color: 'var(--text-1)', fontWeight: 600, textAlign: 'center', verticalAlign: 'middle' }}>
                          {sp.marks_each * sp.question_count}
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {Array.from({ length: sp.total_questions }).map((_, qIdx) => {
                              const qScore = sp.question_scores?.[qIdx] ?? null;
                              return (
                                <div key={qIdx} style={{
                                  width: '36px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '6px',
                                  color: 'var(--text-1)',
                                  fontWeight: 600,
                                  fontSize: '0.9rem'
                                }}>
                                  {qScore !== null ? qScore : '-'}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
