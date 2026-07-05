export type StudentInput = {
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
  blood_group?: string;
  dob?: string;
};

export type StudentRecord = StudentInput & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type StudentListResult = {
  data: StudentRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};
