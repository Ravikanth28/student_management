import { useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { StudentPicker } from './StudentPicker';
import type { Achievement, EventType, Student } from '../types';

type Props = {
  /** Pre-selected members (e.g. the scanned student). */
  initialMembers?: Student[];
  /** Member ids that cannot be removed. */
  lockedIds?: number[];
  /** When provided, the form edits this achievement instead of creating one. */
  edit?: Achievement;
  onSuccess: () => void;
  onCancel: () => void;
};

const label: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

export function AchievementForm({ initialMembers = [], lockedIds = [], edit, onSuccess, onCancel }: Props) {
  const { success, error: toastError } = useToast();
  const [eventType, setEventType] = useState<EventType>((edit?.event_type as EventType) ?? 'hackathon');
  const [title, setTitle] = useState(edit?.title ?? '');
  const [venue, setVenue] = useState(edit?.venue ?? '');
  const [duration, setDuration] = useState(edit?.duration ?? '');
  const [result, setResult] = useState<'participated' | 'winner'>(edit?.result === 'winner' ? 'winner' : 'participated');
  const [position, setPosition] = useState(edit?.position ?? '');
  const [prize, setPrize] = useState(edit?.prize ?? '');
  const [eventDate, setEventDate] = useState(edit?.event_date ?? '');
  const [members, setMembers] = useState<Student[]>(
    edit
      ? edit.members.map((m) => ({ id: m.student_id, name: m.name, register_number: m.register_number, section: m.section, batch: m.batch } as unknown as Student))
      : initialMembers
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (title.trim().length < 2) { toastError('Title required', 'Enter the event / hackathon name.'); return; }
    if (members.length === 0) { toastError('No students', 'Add at least one student to this achievement.'); return; }

    setSaving(true);
    const payload = {
      event_type: eventType,
      title: title.trim(),
      venue: venue.trim() || undefined,
      duration: duration.trim() || undefined,
      result,
      position: result === 'winner' ? (position.trim() || undefined) : undefined,
      prize: prize.trim() || undefined,
      event_date: eventDate || undefined,
      member_ids: members.map((m) => m.id),
    };
    try {
      if (edit) {
        await api.put(`/achievements/${edit.id}`, payload);
        success('Achievement updated', `Saved for ${members.length} student(s).`);
      } else {
        await api.post('/achievements', payload);
        success('Achievement added', `Saved for ${members.length} student(s).`);
      }
      onSuccess();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not save', msg ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <div>
          <label style={label}>Event type</label>
          <select className="form-control" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
            <option value="hackathon">Hackathon</option>
            <option value="presentation">Presentation</option>
            <option value="symposium">Symposium</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style={label}>Event name *</label>
          <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Smart India Hackathon 2025" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Place / Venue</label>
          <input className="form-control" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. IIT Madras" />
        </div>
        <div>
          <label style={label}>Duration</label>
          <input className="form-control" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 36 hours / 2 days" />
        </div>
      </div>

      <div>
        <label style={label}>Result</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['participated', 'winner'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn ${result === r ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setResult(r)}
            >
              {r === 'participated' ? 'Participated' : 'Winner'}
            </button>
          ))}
        </div>
      </div>

      {result === 'winner' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label}>Position</label>
            <input className="form-control" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. 1st / Runner-up" />
          </div>
          <div>
            <label style={label}>Prize / Reward</label>
            <input className="form-control" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="e.g. ₹50,000" />
          </div>
        </div>
      )}

      <div>
        <label style={label}>Event date</label>
        <input className="form-control" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </div>

      <div>
        <label style={label}>Team members *</label>
        <StudentPicker selected={members} onChange={setMembers} lockedIds={lockedIds} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : edit ? 'Save changes' : 'Save achievement'}
        </button>
      </div>
    </div>
  );
}
