export type Student = {
  id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  section: string;
  year?: string;
  department: string;
  batch: string;
  phone: string;
  parent_phone: string;
  address: string;
  college_email?: string;
  personal_email?: string;
  photo_url?: string;
  blood_group?: string;
  dob?: string;
  created_at: string;
  updated_at: string;
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

/** Current academic year values (stored) + their display labels. */
export const YEAR_OPTIONS = ['1', '2', '3', '4', 'Alumni'] as const;
export const YEAR_LABELS: Record<string, string> = {
  '1': 'I Year',
  '2': 'II Year',
  '3': 'III Year',
  '4': 'IV Year',
  Alumni: 'Alumni',
};

export type StudentListResponse = {
  data: Student[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type Role = 'superadmin' | 'admin' | 'user' | 'cr' | 'student';

export type LoginResponse = {
  token: string;
  user: {
    username: string;
    name: string | null;
    role: Role;
    student_id?: number;
  };
};

export type AppUser = {
  id: number;
  username: string;
  name: string | null;
  role: Role;
  student_id?: number;
  created_by: string | null;
  created_at: string;
};

export type SystemStatus = {
  service: string;
  version: string;
  environment: string;
  serverTime: string;
  uptimeSeconds: number;
  backend: string;
  frontend: string;
  database: { driver: string; connected: boolean };
  auth: { method: string; jwtExpiresIn: string };
  features: {
    cloudinary: boolean;
    googleDrive: boolean;
    bulkImport: boolean;
    export: boolean;
  };
  stats: { totalStudents: number; totalDepartments: number; totalBatches: number };
};

export type AuditLog = {
  id: number;
  action: string;
  entity: string | null;
  entity_id: string | null;
  actor: string | null;
  status: 'success' | 'failure';
  details: string | null;
  ip: string | null;
  created_at: string;
};

export type AuditListResponse = {
  data: AuditLog[];
  meta: { page: number; limit: number; total: number };
};

export type LatePeriod = 'morning' | 'morning_break' | 'lunch' | 'evening_break';

export type LateRecord = {
  id: number;
  student_id: number;
  period: string;
  scheduled_time: string | null;
  late_time: string | null;
  minutes_late: number | null;
  late_date: string;
  marked_by: string | null;
  created_at: string;
  name?: string;
  register_number?: string;
  enrollment_number?: string;
  section?: string;
  year?: string | null;
  department?: string;
  batch?: string;
};

export type LateListResponse = {
  data: LateRecord[];
  meta: { page: number; limit: number; total: number };
};

export type LateSummaryRow = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  batch: string;
  total: number;
  morning: number;
  morning_break: number;
  lunch: number;
  evening_break: number;
  total_minutes: number;
};

export type AchievementMember = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  batch: string;
};

// ─── Attendance ───────────────────────────────────────────────
export type RosterStudent = {
  id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  section: string;
  year: string | null;
};

export type AttendanceDaySection = {
  year: string | null;
  section: string | null;
  present: number;
  absent: number;
  total: number;
  absentees: { id: number; name: string; register_number: string }[];
};

export type AttendanceSummaryRow = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  days: number;
  present: number;
  absent: number;
  percentage: number;
};

export type StudentAttendanceRow = {
  att_date: string;
  status: string;
  year: string | null;
  section: string | null;
};

export type AchievementSummaryRow = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  total: number;
  wins: number;
  participated: number;
};

export type EventType = 'hackathon' | 'presentation' | 'symposium' | 'other';

export const EVENT_TYPE_LABELS: Record<string, string> = {
  hackathon: 'Hackathon',
  presentation: 'Presentation',
  symposium: 'Symposium',
  other: 'Other',
};

export type Achievement = {
  id: number;
  event_type: string | null;
  title: string;
  venue: string | null;
  duration: string | null;
  result: string;
  position: string | null;
  prize: string | null;
  event_date: string | null;
  photos?: string[];
  created_by: string | null;
  created_at: string;
  members: AchievementMember[];
};

export type AchievementListResponse = {
  data: Achievement[];
  meta: { page: number; limit: number; total: number };
};

export type PlacementType = 'on_campus' | 'off_campus';
export type OfferType = 'full_time' | 'internship' | 'internship_ppo';

export const PLACEMENT_TYPE_LABELS: Record<string, string> = {
  on_campus: 'On-campus',
  off_campus: 'Off-campus',
};
export const OFFER_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  internship: 'Internship',
  internship_ppo: 'Internship + PPO',
};

export type Placement = {
  id: number;
  student_id: number;
  company: string;
  position: string | null;
  package: string | null;
  placement_type: string;
  offer_type: string | null;
  location: string | null;
  placed_date: string | null;
  offer_letter_url?: string;
  created_by: string | null;
  created_at: string;
  name?: string;
  register_number?: string;
  section?: string;
  batch?: string;
};

export type PlacementListResponse = {
  data: Placement[];
  meta: { page: number; limit: number; total: number };
};

export const LATE_PERIOD_LABELS: Record<string, string> = {
  morning: 'Morning',
  morning_break: 'Morning break',
  lunch: 'Lunch',
  evening_break: 'Evening break',
};

export const DISCIPLINE_REASONS = [
  'Improper Haircut',
  'Improper Uniform',
  'Not clean-shaven',
  'Others',
] as const;

export type DisciplineRecord = {
  id: number;
  student_id: number;
  reason: string;
  details: string | null;
  record_date: string;
  record_time: string | null;
  marked_by: string | null;
  created_at: string;
  name?: string;
  register_number?: string;
  enrollment_number?: string;
  section?: string;
  year?: string | null;
  department?: string;
  batch?: string;
};

export type DisciplineListResponse = {
  data: DisciplineRecord[];
  meta: { page: number; limit: number; total: number };
};

export type DisciplineSummaryRow = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  batch: string;
  total: number;
  reasons: string;
};

export type AttendanceRangeRow = {
  att_date: string;
  student_id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  year: string | null;
  section: string | null;
  marked_by: string | null;
};

export type Feedback = {
  id: number;
  content: string;
  created_at: string;
  student_id: number;
  student_name: string;
  register_number: string;
  department: string;
  year: string | null;
  section: string;
  photo_url: string | null;
};

// ─── Exam Card System ─────────────────────────────────────────

export type ExamMarkSplit = {
  id: number;
  test_id?: number;
  label: string;
  marks_each: number;
  total_questions: number;
  question_count: number;
  display_order: number;
  /** Only present in student view — their saved score */
  score?: number | null;
  /** Only present in student view — individual scores per question */
  question_scores?: (number | null)[] | null;
};

export type ExamTest = {
  id: number;
  subject_id?: number;
  test_name: string;
  total_marks: number;
  display_order: number;
  splits: ExamMarkSplit[];
};

export type ExamSubject = {
  id: number;
  card_id?: number;
  subject_name: string;
  display_order: number;
  tests: ExamTest[];
};

export type ExamCard = {
  id: number;
  title: string;
  semester: string;
  year_assigned: string;
  status: 'active' | 'disabled';
  created_by: string | null;
  created_at: string;
  subjects?: ExamSubject[];
};

/** Student row in the superadmin marks view */
export type ExamStudentMarksRow = {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  splits: Array<{
    split_id: number;
    label: string;
    marks_each: number;
    question_count: number;
    max: number;
    score: number | null;
  }>;
  total: number;
  out_of_100: number;
};

/** Full response for /api/exam-cards/:cardId/marks */
export type ExamTestMarksResponse = {
  test_name: string;
  total_marks: number;
  year_assigned: string;
  splits: ExamMarkSplit[];
  rows: ExamStudentMarksRow[];
};

/** Input types for mark split, test, subject when creating a card */
export type ExamMarkSplitInput = {
  id?: string | number;
  label: string;
  marks_each: number;
  total_questions: number;
  question_count: number;
};

export type ExamTestInput = {
  id?: string | number;
  test_name: string;
  total_marks: number;
  splits: ExamMarkSplitInput[];
};

export type ExamSubjectInput = {
  id?: string | number;
  subject_name: string;
  tests: ExamTestInput[];
};

