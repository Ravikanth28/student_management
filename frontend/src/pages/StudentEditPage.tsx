import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { StudentForm, type StudentDraft } from '../components/StudentForm';
import { useToast } from '../components/Toast';
import type { Student } from '../types';

type Props = { onLogout: () => void };

export function StudentEditPage({ onLogout }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [initial, setInitial] = useState<Partial<StudentDraft> | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<Student>(`/students/${id}`);
        if (active) {
          const { id: _id, created_at, updated_at, ...rest } = res.data;
          setInitial(rest);
          setStudentName(res.data.name);
        }
      } catch {
        if (active) toastError('Not found', 'Could not load student record.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async (draft: StudentDraft) => {
    try {
      await api.put(`/students/${id}`, draft);
      success('Student updated', 'Changes saved successfully.');
      navigate(`/students/${id}`);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      throw new Error(apiMsg ?? 'Failed to update student');
    }
  };

  return (
    <Shell
      title="Edit Student"
      subtitle={studentName ? `Editing record for ${studentName}` : 'Loading student...'}
      onLogout={onLogout}
    >
      <div className="card card-padded">
        {loading ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 42, borderRadius: 12 }} />
              </div>
            ))}
          </div>
        ) : initial ? (
          <StudentForm initialValue={initial} submitLabel="Save Changes" onSubmit={handleUpdate} />
        ) : (
          <p style={{ color: 'var(--text-2)' }}>Student not found.</p>
        )}
      </div>
    </Shell>
  );
}
