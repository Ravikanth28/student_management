import { useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { StudentPicker } from './StudentPicker';
import type { OfferType, Placement, PlacementType, Student } from '../types';

type Props = {
  /** Fixed student (from the scanner). */
  student?: Student;
  /** Edit an existing placement. */
  edit?: Placement;
  onSuccess: () => void;
  onCancel: () => void;
};

const label: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

export function PlacementForm({ student, edit, onSuccess, onCancel }: Props) {
  const { success, error: toastError } = useToast();
  const [company, setCompany] = useState(edit?.company ?? '');
  const [position, setPosition] = useState(edit?.position ?? '');
  const [pkg, setPkg] = useState(edit?.package ?? '');
  const [placementType, setPlacementType] = useState<PlacementType>((edit?.placement_type as PlacementType) ?? 'on_campus');
  const [offerType, setOfferType] = useState<OfferType | ''>((edit?.offer_type as OfferType) ?? 'full_time');
  const [location, setLocation] = useState(edit?.location ?? '');
  const [placedDate, setPlacedDate] = useState(edit?.placed_date ?? '');
  const [picked, setPicked] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);

  // The student this placement is for: fixed (scanner), the edited one, or picked.
  const fixedName = student ? `${student.name} (${student.register_number})` : edit ? `${edit.name} (${edit.register_number})` : null;
  const studentId = student?.id ?? edit?.student_id ?? picked[0]?.id;

  const submit = async () => {
    if (company.trim().length < 1) { toastError('Company required', 'Enter the company name.'); return; }
    if (!edit && !studentId) { toastError('No student', 'Select the placed student.'); return; }

    const payload = {
      company: company.trim(),
      position: position.trim() || undefined,
      package: pkg.trim() || undefined,
      placement_type: placementType,
      offer_type: offerType || undefined,
      location: location.trim() || undefined,
      placed_date: placedDate || undefined,
    };
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/placements/${edit.id}`, payload);
        success('Placement updated', company.trim());
      } else {
        await api.post('/placements', { student_id: studentId, ...payload });
        success('Placement added', company.trim());
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
      {fixedName ? (
        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-2)' }}>Student: </span><strong>{fixedName}</strong></div>
      ) : (
        <div>
          <label style={label}>Student *</label>
          <StudentPicker selected={picked} onChange={(s) => setPicked(s.slice(-1))} />
        </div>
      )}

      <div>
        <label style={label}>Company *</label>
        <input className="form-control" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Infosys" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Position / Role</label>
          <input className="form-control" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Software Engineer" />
        </div>
        <div>
          <label style={label}>Package</label>
          <input className="form-control" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="e.g. 6 LPA" />
        </div>
      </div>

      <div>
        <label style={label}>Placed through</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['on_campus', 'off_campus'] as const).map((t) => (
            <button key={t} type="button" className={`btn ${placementType === t ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setPlacementType(t)}>
              {t === 'on_campus' ? 'On-campus' : 'Off-campus'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Offer type</label>
          <select className="form-control" value={offerType} onChange={(e) => setOfferType(e.target.value as OfferType)}>
            <option value="full_time">Full-time</option>
            <option value="internship">Internship</option>
            <option value="internship_ppo">Internship + PPO</option>
          </select>
        </div>
        <div>
          <label style={label}>Location</label>
          <input className="form-control" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru" />
        </div>
      </div>

      <div>
        <label style={label}>Placement date</label>
        <input className="form-control" type="date" value={placedDate} onChange={(e) => setPlacedDate(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : edit ? 'Save changes' : 'Save placement'}
        </button>
      </div>
    </div>
  );
}
