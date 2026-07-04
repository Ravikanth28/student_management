import { useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../state/auth';
import type { AppUser, Role } from '../types';

type Props = { onLogout: () => void };

const ROLE_BADGE: Record<Role, string> = {
  superadmin: 'badge-navy',
  admin: 'badge-blue',
  user: 'badge-gray',
};

const label: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

export function UsersPage({ onLogout }: Props) {
  const { username: me } = useAuth();
  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<{ data: AppUser[] }>('/users')
      .then((r) => setUsers(r.data.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    if (name.trim().length < 2) { toastError('Name required', 'Enter the person’s full name.'); return; }
    if (username.trim().length < 3) { toastError('Invalid username', 'At least 3 characters.'); return; }
    if (password.length < 8) { toastError('Weak password', 'At least 8 characters.'); return; }
    setCreating(true);
    try {
      await api.post('/users', { username: username.trim(), name: name.trim(), password, role });
      success('User created', `${name.trim()} (${role})`);
      setName(''); setUsername(''); setPassword(''); setRole('user');
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not create user', msg ?? 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      success('User deleted', deleteTarget.username);
      setDeleteTarget(null);
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Delete failed', msg ?? 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Shell title="Users" subtitle="Create and manage login accounts and roles" onLogout={onLogout}>
      {/* Create user */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>Create a login</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={label}>Full name</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" autoComplete="off" />
          </div>
          <div>
            <label style={label}>Username</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. staff01" autoComplete="off" />
          </div>
          <div>
            <label style={label}>Password</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" autoComplete="new-password" />
          </div>
          <div>
            <label style={label}>Role</label>
            <select className="form-control" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">User (view only)</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={createUser} disabled={creating} style={{ height: 44 }}>
            {creating ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>

      {/* Users list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Name</th><th>Username</th><th>Role</th><th>Created by</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name ?? '—'}{u.username === me && <span className="td-muted"> (you)</span>}</td>
                    <td className="td-muted">{u.username}</td>
                    <td><span className={`badge ${ROLE_BADGE[u.role]}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td className="td-muted">{u.created_by ?? '—'}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      {u.username !== me && (
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(u)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete user?"
          description={`Permanently delete the login "${deleteTarget.username}" (${deleteTarget.role})? They will no longer be able to sign in.`}
          confirmLabel="Delete user"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Shell>
  );
}
