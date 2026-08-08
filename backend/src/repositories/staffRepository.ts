import { pool } from '../config/db.js';

export interface Staff {
  id: number;
  emp_id: string;
  name: string;
  department: string | null;
  phone: string | null;
  email: string | null;
  dob: string | Date | null;
  photo_url: string | null;
  user_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export type StaffCreatePayload = Omit<Staff, 'id' | 'created_at' | 'updated_at'>;

export async function getStaffById(id: number): Promise<Staff | null> {
  const [rows] = await pool.query<any[]>('SELECT * FROM staff WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function getStaffByEmpId(empId: string): Promise<Staff | null> {
  const [rows] = await pool.query<any[]>('SELECT * FROM staff WHERE emp_id = ?', [empId]);
  return rows[0] || null;
}

export async function getStaffByUserId(userId: number): Promise<Staff | null> {
  const [rows] = await pool.query<any[]>('SELECT * FROM staff WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

export async function getAllStaff(): Promise<Staff[]> {
  const [rows] = await pool.query<any[]>('SELECT * FROM staff ORDER BY name ASC');
  return rows;
}

export async function createStaff(data: StaffCreatePayload): Promise<number> {
  const [result] = await pool.query<any>(
    `INSERT INTO staff (emp_id, name, department, phone, email, dob, photo_url, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.emp_id,
      data.name,
      data.department || null,
      data.phone || null,
      data.email || null,
      data.dob || null,
      data.photo_url || null,
      data.user_id || null,
    ]
  );
  return result.insertId;
}

export async function updateStaff(id: number, data: Partial<StaffCreatePayload>): Promise<boolean> {
  const sets: string[] = [];
  const vals: any[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(value);
    }
  }

  if (sets.length === 0) return true;

  vals.push(id);
  const [result] = await pool.query<any>(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`, vals);
  return result.affectedRows > 0;
}

export async function deleteStaff(id: number): Promise<boolean> {
  const [result] = await pool.query<any>('DELETE FROM staff WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
