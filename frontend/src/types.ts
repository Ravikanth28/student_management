export type Student = {
  id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  section: string;
  department: string;
  batch: string;
  phone: string;
  parent_phone: string;
  address: string;
  college_email?: string;
  personal_email?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
};

export type StudentListResponse = {
  data: Student[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type Role = 'superadmin' | 'admin' | 'user';

export type LoginResponse = {
  token: string;
  user: {
    username: string;
    name: string | null;
    role: Role;
  };
};

export type AppUser = {
  id: number;
  username: string;
  name: string | null;
  role: Role;
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
  batch: string;
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
