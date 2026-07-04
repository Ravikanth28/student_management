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

export type LoginResponse = {
  token: string;
  user: {
    username: string;
    role: 'admin';
  };
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
