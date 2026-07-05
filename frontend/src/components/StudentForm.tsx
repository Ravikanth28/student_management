import { useEffect, useState } from 'react';
import { BLOOD_GROUPS, type Student } from '../types';
import { useToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────
export type StudentDraft = Omit<Student, 'id' | 'created_at' | 'updated_at'>;

const emptyStudent: StudentDraft = {
  name: '', register_number: '', enrollment_number: '', section: '',
  department: '', batch: '', phone: '', parent_phone: '',
  address: '', college_email: '', personal_email: '',
  // photo_url is managed via Cloudinary upload on the student profile page
  photo_url: '',
  blood_group: '', dob: '',
};

type FieldMeta = {
  key: keyof StudentDraft;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  span?: boolean;
  textarea?: boolean;
  options?: readonly string[];
};

// Grouped field definitions
const SECTIONS: { title: string; fields: FieldMeta[] }[] = [
  {
    title: 'Academic Information',
    fields: [
      { key: 'register_number',  label: 'Register Number',    required: true, placeholder: 'e.g. 21CS001' },
      { key: 'enrollment_number', label: 'Enrollment Number', required: true, placeholder: 'e.g. EN21CS001' },
      { key: 'section',          label: 'Section',            required: true, placeholder: 'e.g. A' },
      { key: 'department',       label: 'Department',         required: true, placeholder: 'e.g. Computer Science' },
      { key: 'batch',            label: 'Batch / Year',       required: true, placeholder: 'e.g. 2021–2025' },
    ],
  },
  {
    title: 'Personal Information',
    fields: [
      { key: 'name', label: 'Full Name', required: true, placeholder: 'Enter student full name' },
      { key: 'dob',          label: 'Date of Birth',     type: 'date' },
      { key: 'blood_group',  label: 'Blood Group',       options: BLOOD_GROUPS, placeholder: 'Select blood group' },
      { key: 'phone',        label: 'Phone Number',      required: true, type: 'tel', placeholder: '10-digit mobile number' },
      { key: 'parent_phone', label: 'Parent Phone',      required: true, type: 'tel', placeholder: "Parent's mobile number" },
      { key: 'address',      label: 'Address',           required: true, placeholder: 'Full residential address', textarea: true, span: true },
    ],
  },
  {
    title: 'Contact (Optional)',
    fields: [
      { key: 'college_email',  label: 'College Email',  type: 'email', placeholder: 'student@college.edu' },
      { key: 'personal_email', label: 'Personal Email', type: 'email', placeholder: 'student@gmail.com' },
    ],
  },
];

// ─── Validation ───────────────────────────────────────────────
function validate(form: StudentDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.name.trim())            errs.name            = 'Full name is required';
  if (!form.register_number.trim()) errs.register_number = 'Register number is required';
  if (!form.enrollment_number.trim()) errs.enrollment_number = 'Enrollment number is required';
  if (!form.section.trim())         errs.section         = 'Section is required';
  if (!form.department.trim())      errs.department      = 'Department is required';
  if (!form.batch.trim())           errs.batch           = 'Batch is required';
  if (!form.phone.trim())           errs.phone           = 'Phone number is required';
  else if (!/^\d{7,15}$/.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid phone number (7–15 digits)';
  if (!form.parent_phone.trim())    errs.parent_phone    = 'Parent phone is required';
  else if (!/^\d{7,15}$/.test(form.parent_phone.replace(/\s/g, ''))) errs.parent_phone = 'Enter a valid phone number';
  if (!form.address.trim())         errs.address         = 'Address is required';
  if (form.college_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.college_email)) {
    errs.college_email = 'Enter a valid email address';
  }
  if (form.personal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personal_email)) {
    errs.personal_email = 'Enter a valid email address';
  }
  return errs;
}

// ─── Props ───────────────────────────────────────────────────
type Props = {
  initialValue?: Partial<StudentDraft>;
  onSubmit: (student: StudentDraft) => Promise<void>;
  submitLabel: string;
};

export function StudentForm({ initialValue, onSubmit, submitLabel }: Props) {
  const { success, error: toastError } = useToast();
  const [form, setForm]           = useState<StudentDraft>({ ...emptyStudent, ...initialValue });
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({ ...emptyStudent, ...initialValue });
    setErrors({});
  }, [initialValue]);

  const set = (key: keyof StudentDraft, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear error on edit
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      success('Saved successfully', 'Student record has been saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Save failed', apiMsg ?? msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="student-form" onSubmit={handleSubmit} noValidate>
      {SECTIONS.map(({ title, fields }) => (
        <div key={title} className="form-section">
          <div className="form-section-title">{title}</div>
          <div className="form-grid-2">
            {fields.map(({ key, label, required, type = 'text', placeholder, span, textarea, options }) => (
              <div
                key={key}
                className="form-group"
                style={span ? { gridColumn: '1 / -1' } : undefined}
              >
                <label className="form-label" htmlFor={`field-${key}`}>
                  {label}
                  {required ? <span className="required">*</span> : <span className="optional">(optional)</span>}
                </label>
                {options ? (
                  <select
                    id={`field-${key}`}
                    className={`form-control${errors[key] ? ' error' : ''}`}
                    value={(form[key] as string) ?? ''}
                    onChange={e => set(key, e.target.value)}
                  >
                    <option value="">{placeholder ?? 'Select…'}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : textarea ? (
                  <textarea
                    id={`field-${key}`}
                    className={`form-control${errors[key] ? ' error' : ''}`}
                    placeholder={placeholder}
                    value={(form[key] as string) ?? ''}
                    onChange={e => set(key, e.target.value)}
                  />
                ) : (
                  <input
                    id={`field-${key}`}
                    type={type}
                    className={`form-control${errors[key] ? ' error' : ''}`}
                    placeholder={placeholder}
                    value={(form[key] as string) ?? ''}
                    onChange={e => set(key, e.target.value)}
                    autoComplete="off"
                  />
                )}
                {errors[key] ? <span className="form-error">{errors[key]}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Cloudinary Photo Note — Live */}
      <div style={{
        padding: '13px 18px',
        background: 'var(--green-light)',
        border: '1px solid #86efac',
        borderRadius: 'var(--radius)',
        fontSize: '0.8rem',
        color: '#15803d',
        fontWeight: 600,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Photo upload is available on the student profile after saving. Cloudinary integration is live.
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={() => window.history.back()}>Cancel</button>
        <button
          id="student-form-submit"
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ minWidth: 140 }}
        >
          {submitting ? (
            <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
          ) : null}
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
