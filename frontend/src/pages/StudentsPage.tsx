import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useAuth } from '../state/auth';
import { isStaff } from '../lib/roles';
import type { Student, StudentListResponse } from '../types';

// --- SVG Icons ----------------------------------------------
function IconSearch() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function IconMoreVertical() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

const PAGE_LIMIT = 10;

type Props = { onLogout: () => void };

export function StudentsPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { role } = useAuth();
  const staff = isStaff(role);

  const [data, setData]         = useState<StudentListResponse | null>(null);
  const [query, setQuery]       = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch]       = useState('');
  const [section, setSection]   = useState('');
  const [year, setYear]         = useState('');
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta]         = useState<{ departments: string[]; batches: string[]; years: string[]; sections: string[] }>({ departments: [], batches: [], years: [], sections: [] });
  const [dynamicSections, setDynamicSections] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch filter metadata once
  useEffect(() => {
    api.get('/students/meta').then(res => {
      setMeta(res.data);
      setDynamicSections(res.data.sections ?? []);
    }).catch(() => {});
  }, []);

  // Re-fetch sections whenever dept/batch/year filter changes
  useEffect(() => {
    const params: Record<string, string> = {};
    if (department) params.department = department;
    if (batch)      params.batch = batch;
    if (year)       params.year = year;
    api.get<{ sections: string[] }>('/students/meta/sections', { params })
      .then(res => {
        setDynamicSections(res.data.sections ?? []);
        // Reset section if it's no longer valid in the new filtered set
        if (section && !res.data.sections.includes(section)) setSection('');
      })
      .catch(() => {});
  }, [department, batch, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch students whenever page or query changes (debounced for query)
  useEffect(() => {
    let active = true;

    const fetch = async (p: number, q: string, d: string, b: string, s: string) => {
      setLoading(true);
      try {
        const res = await api.get<StudentListResponse>('/students', {
          params: { 
            page: p, 
            limit: PAGE_LIMIT, 
            q: q.trim() || undefined,
            department: d || undefined,
            batch: b || undefined,
            section: s || undefined,
            year: year || undefined,
          },
        });
        if (active) setData(res.data);
      } catch {
        if (active) toastError('Load failed', 'Could not fetch student records.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetch(page, query, department, batch, section), query ? 300 : 0);

    return () => { active = false; };
  }, [page, query, department, batch, section, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setPage(1); // reset to first page on new search
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      success('Student deleted', `${deleteTarget.name} has been removed.`);
      setDeleteTarget(null);
      // Refresh current page
      const res = await api.get<StudentListResponse>('/students', {
        params: { 
            page, 
            limit: PAGE_LIMIT, 
            q: query.trim() || undefined,
            department: department || undefined,
            batch: batch || undefined,
            section: section || undefined,
            year: year || undefined,
        },
      });
      setData(res.data);
    } catch {
      toastError('Delete failed', 'Could not delete this student record.');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.meta.total / PAGE_LIMIT) : 0;
  const students   = data?.data ?? [];

  return (
    <Shell
      title="Student Records"
      subtitle={data ? `${data.meta.total} total students` : 'Loading...'}
      onLogout={onLogout}
      actions={
        staff ? (
          <button className="btn btn-primary" type="button" id="add-student-btn" onClick={() => navigate('/students/new')}>
            <IconPlus /> Add Student
          </button>
        ) : undefined
      }
    >
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--primary)', background: 'linear-gradient(to right, rgba(67, 97, 238, 0.03), transparent)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Filtered Students</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4, lineHeight: 1 }}>{data ? data.meta.total : '-'}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--green)', background: 'linear-gradient(to right, rgba(46, 196, 182, 0.03), transparent)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Page</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--green)', marginTop: 4, lineHeight: 1 }}>
            {page} <span style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 600 }}>/ {totalPages || 1}</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--blue)', background: 'linear-gradient(to right, rgba(58, 12, 163, 0.03), transparent)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Active Filters</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(!department && !batch && !section && !year) ? (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-2)', fontWeight: 500 }}>No filters active</span>
            ) : (
              <>
                {department && <span className="badge badge-primary">{department}</span>}
                {batch && <span className="badge badge-blue">{batch}</span>}
                {year && <span className="badge badge-amber">{year}</span>}
                {section && <span className="badge badge-gray">Sec {section}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="search-wrapper" style={{ width: '100%' }}>
            <span className="search-icon"><IconSearch /></span>
            <input
              id="student-list-search"
              type="search"
              className="search-input"
              placeholder="Search by name, register or enroll no..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              aria-label="Search students"
            />
          </div>
          
          <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 12 }}>
            <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)' }}>
                <IconFilter /> <span style={{fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Filters</span>
            </div>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              value={department}
              onChange={e => { setDepartment(e.target.value); setPage(1); }}
            >
              <option value="">All Departments</option>
              {meta.departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              value={batch}
              onChange={e => { setBatch(e.target.value); setPage(1); }}
            >
              <option value="">All Batches/Years</option>
              {meta.batches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              value={year}
              onChange={e => { setYear(e.target.value); setSection(''); setPage(1); }}
            >
              <option value="">All Years</option>
              {meta.years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              value={section}
              onChange={e => { setSection(e.target.value); setPage(1); }}
            >
              <option value="">All Sections</option>
              {dynamicSections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {loading ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Register No.</th><th>Enrollment No.</th><th>Section</th><th>Department</th><th>Batch</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}>
                        <div className="skeleton" style={{ height: 14, borderRadius: 6, width: j === 6 ? 80 : '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><IconUsers /></div>
            <p className="empty-title">{query || department || batch || section || year ? 'No results found' : 'No students yet'}</p>
            <p className="empty-sub">
              {query || department || batch || section || year
                ? `No students match your criteria. Try adjusting the search or filters.`
                : 'Add your first student record to get started.'}
            </p>
            {staff && (!query && !department && !batch && !section && !year) && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} type="button" onClick={() => navigate('/students/new')}>
                <IconPlus /> Add First Student
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Register No.</th>
                    <th>Enrollment No.</th>
                    <th>Section</th>
                    <th>Department</th>
                    <th>Batch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr 
                      key={student.id} 
                      onDoubleClick={() => navigate(`/students/${student.id}`)}
                      style={{ cursor: 'pointer' }}
                      title="Double click to view details"
                    >
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{student.name}</span>
                      </td>
                      <td className="td-muted td-nowrap">{student.register_number}</td>
                      <td className="td-muted td-nowrap">{student.enrollment_number}</td>
                      <td className="td-nowrap"><span className="badge badge-purple">{student.section}</span></td>
                      <td className="td-nowrap"><span className="badge badge-blue">{student.department}</span></td>
                      <td className="td-nowrap"><span className="badge badge-gray">{student.batch}</span></td>
                      <td className="td-nowrap">
                        <div className="td-actions">
                          <button
                            className="btn btn-outline btn-sm"
                            type="button"
                            onClick={() => navigate(`/students/${student.id}`)}
                            title="View student profile"
                          >
                            <IconEye /> View
                          </button>

                          {staff && (
                          <div className="actions-dropdown-container">
                            <button
                              className="btn btn-outline btn-sm"
                              type="button"
                              style={{ padding: '0 8px' }}
                              onClick={() => setActionMenuOpen(actionMenuOpen === student.id ? null : student.id)}
                            >
                              <IconMoreVertical />
                            </button>
                            {actionMenuOpen === student.id && (
                              <div className="actions-dropdown">
                                <button
                                  type="button"
                                  onClick={() => { setActionMenuOpen(null); navigate(`/students/${student.id}/edit`); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}
                                >
                                  <IconEdit /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setActionMenuOpen(null); setDeleteTarget(student); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)' }}
                                >
                                  <IconTrash /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={data?.meta.total ?? 0}
              limit={PAGE_LIMIT}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Student Record"
          description={`Are you sure you want to permanently delete ${deleteTarget.name} (${deleteTarget.register_number})? This action cannot be undone.`}
          confirmLabel="Delete Student"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Shell>
  );
}
