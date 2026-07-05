import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { BLOOD_GROUPS, type Student, type StudentListResponse } from '../types';

type Props = { onLogout: () => void };

export function BloodGroupsPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // Load the blood groups that actually exist (fall back to the standard eight).
  useEffect(() => {
    let active = true;
    api.get<{ bloodGroups: string[] }>('/students/meta')
      .then((res) => { if (active) setGroups(res.data.bloodGroups?.length ? res.data.bloodGroups : [...BLOOD_GROUPS]); })
      .catch(() => { if (active) setGroups([...BLOOD_GROUPS]); });
    return () => { active = false; };
  }, []);

  // No group selected → show all students; a group selected → filter to it.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params: Record<string, string | number> = { limit: 2000 };
    if (group) params.blood_group = group;
    api.get<StudentListResponse>('/students/filter', { params })
      .then((res) => { if (active) setStudents(res.data.data); })
      .catch(() => { if (active) setStudents([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group]);

  const filtered = students.filter((s) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(t) ||
      s.register_number.toLowerCase().includes(t) ||
      s.enrollment_number.toLowerCase().includes(t) ||
      (s.section ?? '').toLowerCase().includes(t)
    );
  });

  return (
    <Shell
      title="Blood Groups"
      subtitle="Find students by blood group — useful for emergencies and blood drives"
      onLogout={onLogout}
    >
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
          Select a blood group
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className={`btn ${group === '' ? 'btn-primary' : 'btn-outline'}`}
            style={{ minWidth: 64, fontWeight: 700 }}
            onClick={() => setGroup('')}
          >
            All
          </button>
          {(groups.length ? groups : [...BLOOD_GROUPS]).map((g) => (
            <button
              key={g}
              type="button"
              className={`btn ${group === g ? 'btn-primary' : 'btn-outline'}`}
              style={{ minWidth: 64, fontWeight: 700 }}
              onClick={() => setGroup(group === g ? '' : g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {(
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              {group
                ? <>Blood group <span className="badge badge-red" style={{ marginLeft: 4 }}>{group}</span></>
                : <>All blood groups</>}
              {!loading && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>{filtered.length} student{filtered.length === 1 ? '' : 's'}</span>}
            </h2>
            <input
              className="form-control"
              placeholder="Filter by name / number / section…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </div>

          {loading ? (
            <div style={{ padding: '24px 20px', color: 'var(--text-3)', fontSize: '0.85rem' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px 20px', color: 'var(--text-3)', fontSize: '0.85rem' }}>{group ? 'No students found for this blood group.' : 'No students found.'}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Enrollment No.</th>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Phone</th>
                    <th>Blood Group</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="td-muted" style={{ fontFamily: 'monospace' }}>{s.enrollment_number}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge badge-purple">Sec {s.section}</span></td>
                      <td className="td-muted">{s.phone}</td>
                      <td><span className="badge badge-red">{s.blood_group}</span></td>
                      <td>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/students/${s.id}`)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
