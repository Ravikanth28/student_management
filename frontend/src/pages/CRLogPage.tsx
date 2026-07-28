import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS } from '../types';

interface AttendanceRangeRow {
  att_date: string;
  student_id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  year: string | null;
  section: string | null;
  marked_by: string | null;
}

const MONTHS = [
  { index: 1, name: 'Jan' },
  { index: 2, name: 'Feb' },
  { index: 3, name: 'Mar' },
  { index: 4, name: 'Apr' },
  { index: 5, name: 'May' },
  { index: 6, name: 'Jun' },
  { index: 7, name: 'Jul' },
  { index: 8, name: 'Aug' },
  { index: 9, name: 'Sep' },
  { index: 10, name: 'Oct' },
  { index: 11, name: 'Nov' },
  { index: 12, name: 'Dec' },
];

const availableSections = ['A', 'B', 'C', 'D', 'E'];

function fmtDate(d: string): string {
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function CRLogPage({ onLogout }: { onLogout: () => void }) {
  const { error: toastError } = useToast();
  
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  
  const [records, setRecords] = useState<AttendanceRangeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async (month: number) => {
    if (!year || !section) return;
    
    setLoading(true);
    // Construct from and to dates
    // month is 1-indexed (1=Jan, 12=Dec)
    const fromStr = `${calendarYear}-${String(month).padStart(2, '0')}-01`;
    // Get last day of month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? calendarYear + 1 : calendarYear;
    const lastDay = new Date(nextMonthYear, nextMonth - 1, 0).getDate();
    const toStr = `${calendarYear}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    try {
      const res = await api.get<{ data: AttendanceRangeRow[] }>('/attendance/range', {
        params: { from: fromStr, to: toStr, year, section },
      });
      setRecords(res.data.data);
    } catch {
      setRecords([]);
      toastError('Error', 'Failed to fetch absentees for the selected month.');
    } finally {
      setLoading(false);
    }
  }, [calendarYear, year, section, toastError]);

  const handleMonthClick = (month: number) => {
    if (!year || !section) {
      toastError('Action Required', 'Please select your Academic Year and Section first.');
      return;
    }
    setSelectedMonth(month);
    fetchRecords(month);
  };

  // Clear selected month when class changes
  useEffect(() => {
    setSelectedMonth(null);
    setRecords([]);
  }, [year, section, calendarYear]);

  return (
    <Shell
      title="CR Absentees Log"
      subtitle="View marked absentees by month"
      onLogout={onLogout}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, maxWidth: 840, margin: '0 auto' }}>
        
        {/* Filter Card */}
        <div className="card card-padded">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>1. Select Class</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Academic Year *
              </label>
              <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)}>
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
              <select className="form-control" value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">Select Section</option>
                {availableSections.map((s) => (
                  <option key={s} value={s}>Sec {s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Month Selector Card */}
        <div className="card card-padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>2. Select Month</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={() => setCalendarYear(prev => prev - 1)}
              >
                &larr;
              </button>
              <span style={{ fontWeight: 800 }}>{calendarYear}</span>
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={() => setCalendarYear(prev => prev + 1)}
              >
                &rarr;
              </button>
            </div>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', 
            gap: 10 
          }}>
            {MONTHS.map(m => (
              <button
                key={m.index}
                type="button"
                className={`btn ${selectedMonth === m.index ? 'btn-primary' : 'btn-outline'}`}
                style={{ height: 44 }}
                onClick={() => handleMonthClick(m.index)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results Card */}
        {selectedMonth !== null && (
          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 12 }}>
              3. Absentees Log ({MONTHS.find(m => m.index === selectedMonth)?.name} {calendarYear})
            </h2>
            {loading ? (
              <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
            ) : records.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No absentees marked in this month for this class.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Student Name</th>
                      <th>Register Number</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((st, idx) => (
                      <tr key={`${st.student_id}-${st.att_date}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{fmtDate(st.att_date)}</td>
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
        )}
      </div>
    </Shell>
  );
}
