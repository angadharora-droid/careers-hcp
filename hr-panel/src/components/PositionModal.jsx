import { useRef, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { ErrorBox } from './LoadState';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

const STATUSES = ['Vacant', 'Filled', 'Under Recruitment', 'Frozen', 'On Hold', 'Contract', 'Outsourced', 'Eliminated'];

const PROFILE_OPTIONS = [
  { value: '', label: '— generic —' },
  { value: 'fo_assoc', label: 'fo_assoc (Front Office — Associate)' },
  { value: 'fo_exec', label: 'fo_exec (Front Office — Executive)' },
];

function Section({ title, children }) {
  return (
    <section className="mt-5 first:mt-3">
      <h4 className="font-display text-[17px] font-semibold text-ink leading-tight border-b border-line pb-1.5">{title}</h4>
      {children}
    </section>
  );
}

function FieldError({ id, msg }) {
  if (!msg) return null;
  return <p id={id} className="field-err" role="alert">{msg}</p>;
}

// `position` = null → Add; otherwise Edit.
export default function PositionModal({ position, grades, onClose, onSaved }) {
  const toast = useToast();
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmEliminate, setConfirmEliminate] = useState(false);
  const [fieldErrs, setFieldErrs] = useState({});
  const designationRef = useRef(null);
  const departmentRef = useRef(null);
  const [form, setForm] = useState(() => ({
    designation: position?.designation || '',
    job_family: position?.job_family || '',
    grade: position?.grade || (grades[0]?.code ?? 'C1'),
    department: position?.department || '',
    cost_centre: position?.cost_centre || '',
    reports_to: position?.reports_to || '',
    approver: position?.approver || 'General Manager',
    salary_min: position?.salary_min ?? '',
    salary_max: position?.salary_max ?? '',
    budgeted_salary: position?.budgeted_salary ?? '',
    status: position?.status || 'Vacant',
    replacement_sla_days: position?.replacement_sla_days ?? 30,
    is_critical: !!position?.is_critical,
    is_revenue_generating: !!position?.is_revenue_generating,
    is_guest_facing: !!position?.is_guest_facing,
    competency_profile: position?.competency_profile || '',
    remarks: position?.remarks || '',
    job_description: position?.job_description || '',
  }));

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Validate on blur, not on keystroke (guide).
  const validateField = (k, value) => {
    let msg = null;
    if (k === 'designation' && !value.trim()) msg = 'Designation is required';
    if (k === 'department' && !value.trim()) msg = 'Department is required';
    setFieldErrs((m) => ({ ...m, [k]: msg }));
    return !msg;
  };
  const blur = (k) => (e) => validateField(k, e.target.value);

  async function save() {
    setErr(null);
    const okDes = validateField('designation', form.designation);
    const okDep = validateField('department', form.department);
    if (!okDes || !okDep) {
      // Focus the first invalid field (guide).
      (!okDes ? designationRef : departmentRef).current?.focus();
      return;
    }
    const payload = {
      ...form,
      designation: form.designation.trim(),
      department: form.department.trim(),
      salary_min: Number(form.salary_min) || 0,
      salary_max: Number(form.salary_max) || 0,
      budgeted_salary: Number(form.budgeted_salary) || 0,
      replacement_sla_days: Number(form.replacement_sla_days) || 0,
      competency_profile: form.competency_profile || null,
    };
    setBusy(true);
    try {
      if (position) {
        await api.patch(`/positions/${position.id}`, payload);
        toast('Position updated');
      } else {
        const data = await api.post('/positions', payload);
        toast(`Position created: ${data.position.pcn}`);
      }
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function eliminate() {
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/positions/${position.id}/eliminate`);
      toast('Position eliminated');
      onSaved();
    } catch (e) {
      setConfirmEliminate(false);
      setErr(e.message); // e.g. "Cannot eliminate a filled position — separate the occupant first"
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" labelledBy="position-modal-title">
      <h3 id="position-modal-title" className="font-display text-[22px] font-semibold text-ink leading-tight mb-1.5">
        {position ? 'Edit Position' : 'Add Position'}
      </h3>
      {position ? (
        <p className="pcn">{position.pcn}</p>
      ) : (
        <p className="hint">PCN auto-generated as CPA-DEPT-GRADE-SERIAL on save.</p>
      )}

      <Section title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5">
          <div>
            <label className="lbl" htmlFor="pos-designation">Designation <span className="text-brand-red">*</span></label>
            <input
              id="pos-designation"
              ref={designationRef}
              className={`inp ${fieldErrs.designation ? 'inp-err' : ''}`}
              value={form.designation}
              onChange={set('designation')}
              onBlur={blur('designation')}
              aria-invalid={!!fieldErrs.designation}
              aria-describedby={fieldErrs.designation ? 'pos-designation-err' : undefined}
            />
            <FieldError id="pos-designation-err" msg={fieldErrs.designation} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-family">Job Family</label>
            <input id="pos-family" className="inp" value={form.job_family} onChange={set('job_family')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-grade">Corporate Grade</label>
            <select id="pos-grade" className="inp" value={form.grade} onChange={set('grade')}>
              {grades.map((g) => <option key={g.code} value={g.code}>{g.code} — {g.meaning}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="pos-department">Department <span className="text-brand-red">*</span></label>
            <input
              id="pos-department"
              ref={departmentRef}
              className={`inp ${fieldErrs.department ? 'inp-err' : ''}`}
              value={form.department}
              onChange={set('department')}
              onBlur={blur('department')}
              aria-invalid={!!fieldErrs.department}
              aria-describedby={fieldErrs.department ? 'pos-department-err' : undefined}
            />
            <FieldError id="pos-department-err" msg={fieldErrs.department} />
          </div>
        </div>
      </Section>

      <Section title="Reporting & budget">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5">
          <div>
            <label className="lbl" htmlFor="pos-reports">Reports To</label>
            <input id="pos-reports" className="inp" value={form.reports_to} onChange={set('reports_to')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-approver">Approval Authority</label>
            <input id="pos-approver" className="inp" value={form.approver} onChange={set('approver')} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-2.5">
          <div>
            <label className="lbl" htmlFor="pos-cc">Cost Centre</label>
            <input id="pos-cc" className="inp" value={form.cost_centre} onChange={set('cost_centre')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-smin">Salary Min (₹/mo)</label>
            <input id="pos-smin" className="inp" type="number" inputMode="numeric" min="0" value={form.salary_min} onChange={set('salary_min')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-smax">Salary Max (₹/mo)</label>
            <input id="pos-smax" className="inp" type="number" inputMode="numeric" min="0" value={form.salary_max} onChange={set('salary_max')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-budget">Budgeted Salary (₹/mo)</label>
            <input id="pos-budget" className="inp" type="number" inputMode="numeric" min="0" value={form.budgeted_salary} onChange={set('budgeted_salary')} />
          </div>
        </div>
      </Section>

      <Section title="Flags & SLA">
        <div className="flex gap-4 flex-wrap mt-3">
          <label className="flex items-center gap-1.5 text-[12.5px] font-medium">
            <input type="checkbox" checked={form.is_critical} onChange={set('is_critical')} /> Critical Position
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] font-medium">
            <input type="checkbox" checked={form.is_revenue_generating} onChange={set('is_revenue_generating')} /> Revenue Generating
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] font-medium">
            <input type="checkbox" checked={form.is_guest_facing} onChange={set('is_guest_facing')} /> Guest Facing
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-2.5">
          <div>
            <label className="lbl" htmlFor="pos-sla">Replacement SLA (days)</label>
            <input id="pos-sla" className="inp" type="number" inputMode="numeric" min="0" value={form.replacement_sla_days} onChange={set('replacement_sla_days')} />
          </div>
          <div>
            <label className="lbl" htmlFor="pos-status">Vacancy Status</label>
            <select id="pos-status" className="inp" value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="pos-remarks">Remarks</label>
            <input id="pos-remarks" className="inp" value={form.remarks} onChange={set('remarks')} />
          </div>
        </div>
      </Section>

      <Section title="Public listing">
        <label className="lbl" htmlFor="pos-jd">Job Description</label>
        <textarea
          id="pos-jd"
          className="inp min-h-[160px] resize-y"
          value={form.job_description}
          onChange={set('job_description')}
          aria-describedby="pos-jd-hint"
          placeholder={'About the role\n\nWhat you will do\n• …\n\nWhat we look for\n• …'}
        />
        <p id="pos-jd-hint" className="hint">Shown publicly on the Careers site.</p>
        <label className="lbl" htmlFor="pos-profile">Competency Profile</label>
        <select id="pos-profile" className="inp" value={form.competency_profile} onChange={set('competency_profile')}>
          {PROFILE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="hint">Decides which competency anchors the interview panel scores against.</p>
      </Section>

      <ErrorBox error={err} />

      <div className="flex gap-2 flex-wrap mt-4 items-center">
        <button type="button" className="btn btn-green" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        {position && (
          <button type="button" className="btn btn-red btn-sm ml-auto" onClick={() => setConfirmEliminate(true)} disabled={busy}>
            Eliminate
          </button>
        )}
      </div>

      {confirmEliminate && (
        <ConfirmDialog
          title="Eliminate position?"
          body={
            <>
              Mark <b className="font-mono">{position.pcn}</b> as Eliminated? The seat stops accepting recruitment and leaves the sanctioned strength. A filled seat cannot be eliminated.
            </>
          }
          confirmLabel="Eliminate"
          tone="danger"
          busy={busy}
          onCancel={() => setConfirmEliminate(false)}
          onConfirm={eliminate}
        />
      )}
    </Modal>
  );
}
