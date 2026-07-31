import { Shell } from '../components/Shell';
import { ExamMarksSection } from '../components/ExamMarksSection';
import { useAuth } from '../state/auth';

export function StudentMarksPage({ onLogout }: { onLogout: () => void }) {
  const { studentId } = useAuth();

  return (
    <Shell onLogout={onLogout}>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: '1.8rem', color: 'var(--text-1)' }}>My Exam Marks</h1>
        
        {studentId ? (
          <ExamMarksSection studentId={studentId} />
        ) : (
          <div className="card card-padded">
            <p style={{ color: 'var(--text-2)' }}>No student profile linked to your account.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
