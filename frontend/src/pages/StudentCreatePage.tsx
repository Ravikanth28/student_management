import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { StudentForm, type StudentDraft } from '../components/StudentForm';
import { useToast } from '../components/Toast';

type Props = { onLogout: () => void };

export function StudentCreatePage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const handleCreate = async (student: StudentDraft) => {
    try {
      await api.post('/students', student);
      success('Student added', 'New student record has been created successfully.');
      navigate('/students');
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      throw new Error(apiMsg ?? 'Failed to create student');
    }
  };

  return (
    <Shell
      title="Add Student"
      subtitle="Create a new student record"
      onLogout={onLogout}
    >
      <div className="card card-padded">
        <StudentForm submitLabel="Create Student" onSubmit={handleCreate} />
      </div>
    </Shell>
  );
}
