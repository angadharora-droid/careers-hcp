import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBox, Empty, TableSkeleton } from '../components/LoadState';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import { UserPlus, Users } from '../components/Icons';

const EMPTY_FORM = { name: '', email: '', department: '', designation: '', password: '', role: 'interviewer' };

const ROLE_LABEL = {
  interviewer: 'Interviewer',
  hr_admin: 'HR admin',
  both: 'HR admin + interviewer',
};

// A person may hold both roles on one login — one chip per role.
function RoleChips({ roles, role }) {
  const list = roles?.length ? roles : [role].filter(Boolean);
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {list.map((r) => {
        const hr = r === 'hr_admin';
        return (
          <span
            key={r}
            className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] ${hr ? 'bg-berry-soft text-berry' : 'bg-brand-blue/10 text-brand-blue'}`}
          >
            {hr ? 'HR Admin' : 'Interviewer'}
          </span>
        );
      })}
    </span>
  );
}

export default function InterviewersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get('/users');
      setUsers(d.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setFormErr(null);
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormErr('Name, email and password are required');
      return;
    }
    setBusy(true);
    try {
      await api.post('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        password: form.password,
        roles: form.role === 'both' ? ['interviewer', 'hr_admin'] : [form.role],
      });
      toast(`${ROLE_LABEL[form.role]} account created: ${form.name.trim()}`);
      setForm(EMPTY_FORM);
      load();
    } catch (ex) {
      setFormErr(ex.message); // e.g. 409 "Email already registered"
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Interviewers"
        sub="Panel accounts · appointed panellists score independently"
      />

      <div className="card">
        <h2 className="card-h">Registered Accounts <span className="r">{users.length} account{users.length === 1 ? '' : 's'}</span></h2>
        <div className="infobar">
          Panel appointment in the applicant drawer picks from the <b>interviewer</b> accounts below — panellists sign in to the Interview Panel with these logins and score independently.
        </div>
        <ErrorBox error={err} onRetry={load} />
        {loading ? (
          <TableSkeleton rows={5} />
        ) : users.length === 0 ? (
          <Empty icon={Users} title="No accounts yet">
            Add an interviewer account below — panel appointment needs at least one registered interviewer.
          </Empty>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Designation</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-bold">{u.name}</td>
                    <td>{u.email}</td>
                    <td><RoleChips roles={u.roles} role={u.role} /></td>
                    <td>{u.department || '—'}</td>
                    <td>{u.designation || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-h">Add Account</h2>
        <form onSubmit={create}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2.5">
            <div>
              <label className="lbl">Full Name <span className="text-brand-red">*</span></label>
              <input className="inp" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="lbl">Email <span className="text-brand-red">*</span></label>
              <input className="inp" type="email" autoComplete="off" inputMode="email" value={form.email} onChange={set('email')} placeholder="name@cph.in" />
            </div>
            <div>
              <label className="lbl">Role</label>
              <select className="inp" value={form.role} onChange={set('role')}>
                <option value="interviewer">Interviewer</option>
                <option value="hr_admin">HR Admin</option>
                <option value="both">HR Admin + Interviewer</option>
              </select>
            </div>
            <div>
              <label className="lbl">Department</label>
              <input className="inp" value={form.department} onChange={set('department')} />
            </div>
            <div>
              <label className="lbl">Designation</label>
              <input className="inp" value={form.designation} onChange={set('designation')} />
            </div>
            <div>
              <label className="lbl">Password <span className="text-brand-red">*</span></label>
              <input className="inp" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="min 6 characters" />
            </div>
          </div>
          <ErrorBox error={formErr} />
          <button type="submit" className="btn mt-3" disabled={busy}>
            <UserPlus size={14} />
            {busy ? 'Creating…' : form.role === 'hr_admin' ? 'Add HR admin' : 'Add interviewer'}
          </button>
        </form>
      </div>
    </div>
  );
}
