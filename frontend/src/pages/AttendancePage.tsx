import * as XLSX from 'xlsx';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { StudentActivityModal } from '../components/StudentActivityModal';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS, type RosterStudent, type AttendanceDaySection, type AttendanceSummaryRow, type StudentAttendanceRow, type AttendanceRangeRow, type Student } from '../types';

type Props = { onLogout: () => void };

function IconFileSpreadsheet() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9v10"/></svg>;
}
function IconDownload() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function IconCalendar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconUser() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IconTrash() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const todayIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
// Case/space/dot-insensitive: "PRAVEEN.M" / "praveen m" / "Praveen  M" → "PRAVEENM"
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
// Order-insensitive token key: "ABINASH.S" and "S ABINASH" both → "ABINASH S"
const tokenKey = (s: string) => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).sort().join(' ');

export function AttendancePage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<'class-summary' | 'mark' | 'summary' | 'export'>('class-summary');

  // Export state
  const [exportFrom, setExportFrom] = useState(todayIST);
  const [exportTo, setExportTo] = useState(todayIST);
  const [exportYear, setExportYear] = useState('');
  const [exportSection, setExportSection] = useState('');
  const [exporting, setExporting] = useState(false);

  // Date-wise log state
  const [dateLog, setDateLog] = useState<AttendanceRangeRow[]>([]);
  const [loadingDateLog, setLoadingDateLog] = useState(false);

  // ── Absentees multi-select & removal state ──
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [targetToRemove, setTargetToRemove] = useState<{ student_id: number; att_date: string; name: string }[] | null>(null);
  const [removing, setRemoving] = useState(false);

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === dateLog.length && dateLog.length > 0) {
      setSelectedKeys(new Set());
    } else {
      const allKeys = new Set(dateLog.map((r) => `${r.att_date}_${r.student_id}`));
      setSelectedKeys(allKeys);
    }
  };

  const handleConfirmRemove = async () => {
    if (!targetToRemove || targetToRemove.length === 0) return;
    setRemoving(true);
    try {
      const entries = targetToRemove.map((t) => ({ student_id: t.student_id, att_date: t.att_date }));
      const res = await api.post<{ removed: number }>('/attendance/remove-absentees', { entries });
      success('Absentees removed', `Successfully removed ${res.data.removed} absent record(s).`);
      setTargetToRemove(null);
      setSelectedKeys(new Set());
      await Promise.all([loadDateLog(), loadDay()]);
    } catch {
      toastError('Removal failed', 'Could not remove selected absent record(s).');
    } finally {
      setRemoving(false);
    }
  };

  // ── Marking state ──
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [date, setDate] = useState(todayIST);
  const [pasted, setPasted] = useState('');
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [preview, setPreview] = useState(false);
  const [absentIds, setAbsentIds] = useState<Set<number>>(new Set());
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Day view ──
  const [day, setDay] = useState<AttendanceDaySection[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ year: string; section: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Summary filters ──
  const [sumFrom, setSumFrom] = useState('');
  const [sumTo, setSumTo] = useState('');
  const [sumYear, setSumYear] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);
  const filteredSummary = useMemo(() => summary.filter((r) => r.absent > 0), [summary]);

  // ── Student Activity Modal state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [viewRows, setViewRows] = useState<StudentAttendanceRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Load roster when year + section chosen.
  useEffect(() => {
    if (!year || !section) { setRoster([]); return; }
    api.get<{ data: RosterStudent[] }>('/attendance/roster', { params: { year, section } })
      .then((r) => setRoster(r.data.data)).catch(() => setRoster([]));
  }, [year, section]);

  // Load the day register whenever the date changes (and after saving).
  const loadDay = () => api.get<{ data: AttendanceDaySection[] }>('/attendance/day', { params: { date } })
    .then((r) => setDay(r.data.data)).catch(() => setDay([]));
  useEffect(() => { void loadDay(); /* eslint-disable-next-line */ }, [date]);

  const loadDateLog = useCallback(() => {
    setLoadingDateLog(true);
    api.get<{ data: AttendanceRangeRow[] }>('/attendance/range', {
      params: { from: sumFrom || undefined, to: sumTo || undefined, year: sumYear || undefined },
    })
      .then((r) => setDateLog(r.data.data))
      .catch(() => setDateLog([]))
      .finally(() => setLoadingDateLog(false));
  }, [sumFrom, sumTo, sumYear]);

  useEffect(() => {
    if (tab === 'summary') {
      void loadDateLog();
    }
  }, [tab, sumFrom, sumTo, sumYear, loadDateLog]);

  // ── Class Summary state (Admin) ──
  const [csYear, setCsYear] = useState('');
  const [csDate, setCsDate] = useState(todayIST());
  const [classSummary, setClassSummary] = useState<any[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [csModalOpen, setCsModalOpen] = useState(false);
  const [csModalAbsentees, setCsModalAbsentees] = useState<any[]>([]);
  const [csModalPresent, setCsModalPresent] = useState<any[]>([]);
  const [csModalClass, setCsModalClass] = useState('');
  const [csModalTab, setCsModalTab] = useState<'absent' | 'present'>('absent');

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => todayIST().slice(0, 7));
  const [exportStudentName, setExportStudentName] = useState('');

  useEffect(() => {
    if (tab === 'class-summary' && csYear) {
      setCsLoading(true);
      api.get<{ data: any[] }>('/attendance/class-summary', { params: { year: csYear, date: csDate } })
        .then((r) => setClassSummary(r.data.data))
        .catch(() => setClassSummary([]))
        .finally(() => setCsLoading(false));
    }
  }, [tab, csYear, csDate]);

  const handleExport = async () => {
    if (!exportMonth) {
      toastError('Month required', 'Please select a month.');
      return;
    }
    setExporting(true);
    try {
      const parts = exportMonth.split('-');
      const yearNum = parseInt(parts[0], 10);
      const monthNum = parseInt(parts[1], 10);
      
      if (isNaN(yearNum) || isNaN(monthNum)) {
        toastError('Invalid Month', 'Please select a valid month.');
        setExporting(false);
        return;
      }

      const startStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      
      const todayStr = todayIST(); // "YYYY-MM-DD"
      const currentYearMonth = todayStr.slice(0, 7);
      
      let endStr: string;
      let lastDayInLoop: number;
      
      if (exportMonth === currentYearMonth) {
        endStr = todayStr;
        lastDayInLoop = parseInt(todayStr.slice(8, 10), 10);
      } else if (exportMonth > currentYearMonth) {
        toastError('Future Month', 'Cannot export attendance for future months.');
        setExporting(false);
        return;
      } else {
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        endStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        lastDayInLoop = lastDay;
      }

      const res = await api.get<{ data: any[] }>('/attendance/export-data', {
        params: { from: startStr, to: endStr, year: exportYear || undefined, section: exportSection || undefined }
      });
      let students = res.data.data;
      
      if (exportStudentName.trim()) {
        const searchName = norm(exportStudentName);
        students = students.filter((s: any) => norm(s.name).includes(searchName));
      }

      if (students.length === 0) {
        toastError('No data', 'No students found for the selected filters.');
        setExporting(false);
        return;
      }
      
      // Calculate date range columns
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum - 1, lastDayInLoop);
      const dates: string[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(`${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }

      // Identify working days (days where at least one student has attendance)
      const workingDays = new Set<string>();
      for (const s of students) {
        for (const date of dates) {
          if (s.attendance[date]) workingDays.add(date);
        }
      }

      // Build excel rows
      const rows = students.map((s) => {
        const row: Record<string, string> = {
          Name: s.name,
          'Enrollment Number': s.enrollment_number || '-',
          'Register Number': s.register_number || '-',
          'Section': s.section || '-'
        };
        for (const date of dates) {
          const status = s.attendance[date];
          if (status === 'present') {
            row[date] = 'P';
          } else if (status === 'absent') {
            row[date] = 'A';
          } else {
            row[date] = workingDays.has(date) ? 'A' : '-';
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `Attendance_Export_${exportMonth}.xlsx`);
    } catch (e: any) {
      toastError('Export failed', e.response?.data?.message || 'Could not export data');
    } finally {
      setExporting(false);
    }
  };

  const openPreview = () => {
    if (!year || !section) { toastError('Pick a class', 'Select the year and section first.'); return; }
    if (roster.length === 0) { toastError('No students', 'No students found for that year and section.'); return; }
    const lines = pasted.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    const matched = new Set<number>();
    const miss: string[] = [];
    for (const line of lines) {
      const n = norm(line);
      const tk = tokenKey(line);
      const hit = roster.find((s) => norm(s.name) === n)                                   // exact (ignoring case/dots/spaces)
        ?? roster.find((s) => tokenKey(s.name) === tk)                                      // same words, any order (initial before/after)
        ?? roster.find((s) => norm(s.name).startsWith(n) || n.startsWith(norm(s.name)))     // with/without initial
        ?? roster.find((s) => n.length >= 4 && norm(s.name).includes(n));                   // loose contains
      if (hit) matched.add(hit.id); else miss.push(line);
    }
    setAbsentIds(matched);
    setUnmatched(miss);
    setPreview(true);
  };

  const toggle = (id: number) => setAbsentIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const confirmSave = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ present: number; absent: number }>('/attendance', {
        date, year, section, absentee_ids: [...absentIds],
      });
      success('Attendance saved', `${r.data.present} present, ${r.data.absent} absent.`);
      setPreview(false);
      setPasted('');
      await loadDay();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not save', msg ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeDay = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete('/attendance', { params: { date, year: deleteTarget.year, section: deleteTarget.section } });
      success('Attendance deleted', `Year ${deleteTarget.year} Sec ${deleteTarget.section} on ${date} removed.`);
      setDeleteTarget(null);
      await loadDay();
    } catch {
      toastError('Delete failed', 'Could not delete that attendance record.');
    } finally {
      setDeleting(false);
    }
  };

  // College-style layout: always show the four years as headings; each fills in
  // with its section rows for the selected date (or a "not taken" note).
  const dayByYear = useMemo(() => {
    const m = new Map<string, AttendanceDaySection[]>();
    for (const s of day) {
      const key = s.year ?? 'unset';
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    const baseYears = ['1', '2', '3', '4'];
    const extra = [...m.keys()].filter((k) => !baseYears.includes(k));
    return [...baseYears, ...extra.sort()].map((yr) => [yr, m.get(yr) ?? []] as [string, AttendanceDaySection[]]);
  }, [day]);

  const rosterSorted = useMemo(
    () => [...roster].sort((a, b) => Number(absentIds.has(b.id)) - Number(absentIds.has(a.id)) || a.name.localeCompare(b.name)),
    [roster, absentIds],
  );

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get<{ data: AttendanceSummaryRow[] }>('/attendance/summary', {
        params: {
          from: exportFrom || undefined,
          to: exportTo || undefined,
          year: exportYear || undefined,
          section: exportSection || undefined,
        },
      });

      // Filter for students with total leaves > 0 in this range
      const absenteesOnly = res.data.data.filter((r) => r.absent > 0);

      if (absenteesOnly.length === 0) {
        toastError('No data found', 'No absentee records found for the selected date range and class filters.');
        return;
      }

      const rows = absenteesOnly.map((r, idx) => ({
        'S.No': idx + 1,
        'Student Name': r.name,
        'Section': r.section ?? '—',
        'Register Number': r.register_number,
        'Year': YEAR_LABELS[r.year ?? ''] ?? r.year ?? '—',
        'Total Number of Leave': r.absent,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Absentees Report');

      const fileName = `Absentees_Report_${exportFrom || 'all'}_to_${exportTo || 'all'}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      success('Excel exported', `Downloaded leave report for ${rows.length} student(s) into ${fileName}.`);
    } catch {
      toastError('Export failed', 'Could not generate Excel report.');
    } finally {
      setExporting(false);
    }
  };

  const vPresent = viewRows.filter((r) => r.status === 'present').length;
  const vAbsent = viewRows.filter((r) => r.status === 'absent').length;
  const vPct = viewRows.length ? Math.round((1000 * vPresent) / viewRows.length) / 10 : 0;

  return (
    <Shell title="Daily Attendance" subtitle="Mark absentees, view daily registers, and export absentee Excel reports" onLogout={onLogout}>


      {tab === 'class-summary' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label className="form-label">Select Year</label>
              <select className="form-control" value={csYear} onChange={(e) => setCsYear(e.target.value)} style={{ minWidth: 150 }}>
                <option value="">-- Choose Year --</option>
                {YEAR_OPTIONS.filter((y) => y !== 'Alumni').map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Select Date</label>
              <input type="date" className="form-control" value={csDate} onChange={(e) => setCsDate(e.target.value)} />
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn btn-primary" onClick={() => setExportModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconDownload /> Export Data
              </button>
            </div>
          </div>

          {!csYear ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Please select a year to view the summary.</div>
          ) : csLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading class summary...</div>
          ) : (
            <div style={{ background: 'var(--surface-1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Class (Section)</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Total Students</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Present</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Absent</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.map((cls, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 24px', color: 'var(--text-1)', fontWeight: 500 }}>Section {cls.class}</td>
                      <td style={{ padding: '12px 24px', color: 'var(--text-1)', fontWeight: 600 }}>{cls.present + cls.absent}</td>
                      <td style={{ padding: '12px 24px', color: '#10b981', fontWeight: 600 }}>{cls.present}</td>
                      <td style={{ padding: '12px 24px', color: '#ef4444', fontWeight: 600 }}>{cls.absent}</td>
                      <td style={{ padding: '12px 24px' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => {
                            setCsModalClass(cls.class);
                            setCsModalAbsentees(cls.absentees);
                            setCsModalPresent(cls.present_students || []);
                            setCsModalTab('absent');
                            setCsModalOpen(true);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {classSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-2)' }}>
                        No attendance data recorded for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal for Absentees/Present */}
          {csModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--surface)', width: 750, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-1)' }}>Class Register - Section {csModalClass}</h2>
                  <button onClick={() => setCsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                
                {/* KPI Cards */}
                <div style={{ padding: '16px 24px', background: 'var(--surface)', display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-3)', marginBottom: 4 }}>Date</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-1)' }}>{csDate.split('-').reverse().join('-')}</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-3)', marginBottom: 4 }}>Section</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-1)' }}>{csModalClass}</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-3)', marginBottom: 4 }}>Total</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-1)' }}>{csModalPresent.length + csModalAbsentees.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', marginBottom: 4 }}>Present</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{csModalPresent.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ef4444', marginBottom: 4 }}>Absent</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>{csModalAbsentees.length}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  <button 
                    onClick={() => setCsModalTab('absent')}
                    style={{ flex: 1, padding: '12px', background: csModalTab === 'absent' ? 'var(--surface-2)' : 'transparent', border: 'none', borderBottom: csModalTab === 'absent' ? '2px solid #ef4444' : '2px solid transparent', color: csModalTab === 'absent' ? '#ef4444' : 'var(--text-2)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Absent ({csModalAbsentees.length})
                  </button>
                  <button 
                    onClick={() => setCsModalTab('present')}
                    style={{ flex: 1, padding: '12px', background: csModalTab === 'present' ? 'var(--surface-2)' : 'transparent', border: 'none', borderBottom: csModalTab === 'present' ? '2px solid #10b981' : '2px solid transparent', color: csModalTab === 'present' ? '#10b981' : 'var(--text-2)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Present ({csModalPresent.length})
                  </button>
                </div>
                <div style={{ padding: 24, overflowY: 'auto' }}>
                  {csModalTab === 'absent' ? (
                    csModalAbsentees.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {csModalAbsentees.map((s, i) => (
                          <div key={i} style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 500 }}>
                            {i + 1}. {s.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>Everyone was present!</div>
                    )
                  ) : (
                    csModalPresent.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {csModalPresent.map((s, i) => (
                          <div key={i} style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 500 }}>
                            {i + 1}. {s.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>No students marked present.</div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Export Data Modal */}
          {exportModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--surface)', width: 400, borderRadius: 16, overflow: 'hidden', padding: 24 }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-1)' }}>Export Attendance Data</h3>
                
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">Select Month</label>
                  <input type="month" className="form-control" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} style={{ width: '100%' }} />
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">Year (Optional)</label>
                  <select className="form-control" value={exportYear} onChange={(e) => setExportYear(e.target.value)} style={{ width: '100%' }}>
                    <option value="">All Years</option>
                    {YEAR_OPTIONS.filter((y) => y !== 'Alumni').map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                  </select>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">Section (Optional)</label>
                  <select className="form-control" value={exportSection} onChange={(e) => setExportSection(e.target.value)} style={{ width: '100%' }}>
                    <option value="">All Sections</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>Sec {s}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label className="form-label">Student Name (Optional)</label>
                  <input type="text" className="form-control" placeholder="Search by name" value={exportStudentName} onChange={(e) => setExportStudentName(e.target.value)} style={{ width: '100%' }} />
                </div>
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setExportModalOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Exporting...' : 'Download Excel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mark' && (
        <>
          {/* Mark card */}
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>Mark attendance</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <label className="form-label">Year</label>
                <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)} style={{ minWidth: 130 }}>
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.filter((y) => y !== 'Alumni').map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Section</label>
                <select className="form-control" value={section} onChange={(e) => setSection(e.target.value)} style={{ minWidth: 110 }}>
                  <option value="">Select section</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                {year && section ? `${roster.length} students in the class` : ''}
              </div>
            </div>
            <label className="form-label">Paste absentees (one name per line)</label>
            <textarea
              className="form-control"
              rows={5}
              placeholder={'e.g.\nABINASH.S\nNIRANJAN.S'}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn btn-primary" type="button" onClick={openPreview} disabled={!year || !section}>Preview list</button>
            </div>
          </div>

          {/* College-style daily register — a box per year, filtered by date */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Daily register</h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', marginTop: 2 }}>Attendance grid for the selected date</p>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
              </div>
            </div>

            <div className="att-grid">
              {dayByYear.map(([yr, sections]) => (
                <div key={yr} style={{ minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {yr === 'unset' ? 'No year set' : (YEAR_LABELS[yr] ?? yr)}
                  </div>
                  {sections.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', padding: '14px' }}>No attendance taken on {date}.</p>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr><th>Sec</th><th>Present</th><th>Absent</th><th>Absentees</th><th></th></tr>
                        </thead>
                        <tbody>
                          {sections.map((s) => (
                            <tr key={s.section}>
                              <td><span className="badge badge-purple">{s.section}</span></td>
                              <td><span className="badge badge-green">{s.present}</span></td>
                              <td><span className="badge badge-red">{s.absent}</span></td>
                              <td style={{ fontSize: '0.78rem' }}>
                                {s.absentees.length === 0 ? <span style={{ color: 'var(--text-3)' }}>—</span> : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {s.absentees.map((a) => (
                                      <span
                                        key={a.id}
                                        className="badge badge-red"
                                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        title="Click to remove absent record for this student on this date"
                                        onClick={() => setTargetToRemove([{ student_id: a.id, att_date: date, name: a.name }])}
                                      >
                                        {a.name} <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>×</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  type="button"
                                  title="Delete this class's attendance for this date"
                                  onClick={() => setDeleteTarget({ year: String(s.year ?? yr), section: String(s.section ?? '') })}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'summary' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <label className="form-label">Select Month (Report)</label>
              <input
                type="month"
                className="form-control"
                style={{ maxWidth: 160 }}
                onChange={(e) => {
                  const val = e.target.value; // YYYY-MM
                  if (val) {
                    const [y, m] = val.split('-').map(Number);
                    const start = `${y}-${String(m).padStart(2, '0')}-01`;
                    const lastDay = new Date(y, m, 0).getDate();
                    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                    setSumFrom(start);
                    setSumTo(end);
                  }
                }}
              />
            </div>
            <div>
              <label className="form-label">Year Filter</label>
              <select className="form-control" value={sumYear} onChange={(e) => setSumYear(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">All years</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </div>
          </div>

          {dateLog.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>
                {selectedKeys.size > 0 ? (
                  <span><strong>{selectedKeys.size}</strong> absent record(s) selected</span>
                ) : (
                  <span style={{ color: 'var(--text-2)' }}>Select absentees below using checkboxes to remove them in bulk</span>
                )}
              </div>
              <div>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={selectedKeys.size === 0}
                  style={{ background: selectedKeys.size > 0 ? '#dc2626' : undefined, borderColor: selectedKeys.size > 0 ? '#dc2626' : undefined, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const selectedList = dateLog
                      .filter((r) => selectedKeys.has(`${r.att_date}_${r.student_id}`))
                      .map((r) => ({ student_id: r.student_id, att_date: r.att_date, name: r.name }));
                    setTargetToRemove(selectedList);
                  }}
                >
                  <IconTrash />
                  Remove Selected Absentees ({selectedKeys.size})
                </button>
              </div>
            </div>
          )}

          {loadingDateLog ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Loading date-wise log...</div>
          ) : dateLog.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontStyle: 'italic' }}>No absentee records found for the selected date range and class filters.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedKeys.size > 0 && selectedKeys.size === dateLog.length}
                        onChange={toggleSelectAll}
                        title="Select or deselect all"
                      />
                    </th>
                    <th>Date</th>
                    <th>Student Name</th>
                    <th>Register No.</th>
                    <th>Year</th>
                    <th>Sec</th>
                    <th>Marked By</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dateLog.map((r, idx) => {
                    const key = `${r.att_date}_${r.student_id}`;
                    const isSelected = selectedKeys.has(key);
                    return (
                      <tr key={`${r.att_date}-${r.student_id}-${idx}`} style={{ background: isSelected ? 'rgba(239, 68, 68, 0.06)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectKey(key)}
                          />
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.att_date}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td className="td-muted">{r.register_number}</td>
                        <td><span className="badge badge-purple">{r.year ? (YEAR_LABELS[r.year] ?? r.year) : '—'}</span></td>
                        <td><span className="badge badge-green">Sec {r.section}</span></td>
                        <td className="td-muted" style={{ fontSize: '0.78rem' }}>{r.marked_by || 'system'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            type="button"
                            style={{ color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.3)' }}
                            onClick={() => setTargetToRemove([{ student_id: r.student_id, att_date: r.att_date, name: r.name }])}
                            title="Remove absent record for this student on this date"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div className="card card-padded" style={{ maxWidth: 800 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <IconFileSpreadsheet /> Export Absentees Excel Report
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 18 }}>
            Select date range (inclusive) and optional class filters to download an Excel (.xlsx) file of absentees with total leave counts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div>
              <label className="form-label">Select Month (Report)</label>
              <input
                type="month"
                className="form-control"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m] = val.split('-').map(Number);
                    const start = `${y}-${String(m).padStart(2, '0')}-01`;
                    const lastDay = new Date(y, m, 0).getDate();
                    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                    setExportFrom(start);
                    setExportTo(end);
                  }
                }}
              />
            </div>
            <div>
              <label className="form-label">From Date *</label>
              <input type="date" className="form-control" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">To Date *</label>
              <input type="date" className="form-control" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Year Filter</label>
              <select className="form-control" value={exportYear} onChange={(e) => setExportYear(e.target.value)}>
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{YEAR_LABELS[y]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Section Filter</label>
              <select className="form-control" value={exportSection} onChange={(e) => setExportSection(e.target.value)}>
                <option value="">All Sections</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>Sec {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={exporting}
              onClick={handleExportExcel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconDownload />
              <span>{exporting ? 'Generating Excel…' : 'Download Excel (.xlsx) Report'}</span>
            </button>
          </div>
        </div>
      )}

      {viewOpen && (
        <StudentActivityModal
          student={viewStudent}
          title="Attendance history"
          loading={viewLoading}
          onClose={() => setViewOpen(false)}
          kpis={[
            { label: 'Days', value: viewRows.length },
            { label: 'Present', value: vPresent, tone: 'green' },
            { label: 'Absent', value: vAbsent, tone: 'red' },
            { label: '%', value: `${vPct}%`, tone: vPct < 75 ? 'amber' : 'green' },
          ]}
        >
          {viewRows.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No attendance records.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Status</th><th>Sec</th></tr></thead>
                <tbody>
                  {viewRows.map((r) => (
                    <tr key={r.att_date}>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{r.att_date}</td>
                      <td><span className={`badge ${r.status === 'absent' ? 'badge-red' : 'badge-green'}`}>{r.status === 'absent' ? 'Absent' : 'Present'}</span></td>
                      <td>{r.section ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StudentActivityModal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this attendance?"
          description={`This removes the saved attendance for ${YEAR_LABELS[deleteTarget.year] ?? deleteTarget.year} · Section ${deleteTarget.section} on ${date}. You can re-mark it afterwards.`}
          confirmLabel="Delete"
          onConfirm={removeDay}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {targetToRemove && (
        <ConfirmModal
          title={`Remove ${targetToRemove.length === 1 ? 'absent record' : `${targetToRemove.length} absent records`}?`}
          description={
            targetToRemove.length === 1
              ? `This will remove the absent record for ${targetToRemove[0].name} on ${targetToRemove[0].att_date} and mark them as present.`
              : `This will remove absent records for ${targetToRemove.length} selected student(s) and mark them as present.`
          }
          confirmLabel={removing ? 'Removing…' : 'Remove Absentees'}
          onConfirm={handleConfirmRemove}
          onCancel={() => setTargetToRemove(null)}
          loading={removing}
        />
      )}

      {/* Preview / edit modal */}
      {preview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setPreview(false); }}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 26px)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 4 }}>Confirm attendance</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 12 }}>
              {YEAR_LABELS[year] ?? year} · Section {section} · {date} — tap a name to toggle absent/present.
            </p>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{roster.length}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-3)' }}>Total</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--green-light)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--green)' }}>{roster.length - absentIds.size}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#16a34a' }}>Present</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fee2e2', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b91c1c' }}>{absentIds.size}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#b91c1c' }}>Absent</div>
              </div>
            </div>

            {unmatched.length > 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--amber-light)', color: '#b45309', fontSize: '0.78rem', marginBottom: 12 }}>
                Couldn't match: <strong>{unmatched.join(', ')}</strong>. Tick them manually below if needed.
              </div>
            )}

            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '6px 0' }}>
              Absentees ({absentIds.size})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {rosterSorted.filter((s) => absentIds.has(s.id)).map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} className="scan-result" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '0.84rem' }}>{s.name}</span>
                  <span className="badge badge-red">Absent</span>
                </button>
              ))}
              {absentIds.size === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Nobody marked absent.</span>}
            </div>

            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', margin: '6px 0' }}>
              Present ({roster.length - absentIds.size})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, maxHeight: 220, overflowY: 'auto' }}>
              {rosterSorted.filter((s) => !absentIds.has(s.id)).map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} className="scan-result" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: '0.84rem' }}>{s.name}</span>
                  <span className="badge badge-green">Present</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn btn-outline" type="button" onClick={() => setPreview(false)} disabled={saving}>← Back</button>
              <button className="btn btn-primary" type="button" onClick={confirmSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm & save'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
