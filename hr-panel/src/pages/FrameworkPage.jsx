import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ErrorBox, Empty, TableSkeleton, CardSkeleton } from '../components/LoadState';
import { SectionTag } from '../components/Badges';
import PageHeader from '../components/PageHeader';
import { AlertTriangle, Plus, Edit, Trash, BookOpen } from '../components/Icons';
import { useToast } from '../context/ToastContext';

// Scoring levels, best → worst; chips reuse the recommendation tint language.
const LEVELS = [
  { label: 'Exceptional', cls: 'bg-brand-green/12 text-brand-green' },
  { label: 'Strong', cls: 'bg-brand-green/8 text-[#4a7c3f]' },
  { label: 'Acceptable', cls: 'bg-brand-amber/12 text-brand-amber' },
  { label: 'Below Expectations', cls: 'bg-brand-red/8 text-brand-red/80' },
  { label: 'Not Suitable', cls: 'bg-brand-red/10 text-brand-red' },
];

function LevelChip({ index }) {
  const lv = LEVELS[index];
  if (!lv) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] whitespace-nowrap ${lv.cls}`}>
      {lv.label}
    </span>
  );
}

const PROFILES = [
  { value: 'core', label: 'core — Attitude block, all roles (60%)' },
  { value: 'fo_assoc', label: 'fo_assoc — Front Office Associate' },
  { value: 'fo_exec', label: 'fo_exec — Front Office Executive' },
  { value: 'generic', label: 'generic — placeholder skills / knowledge' },
];

/* ===== Grade edit modal ===== */
function GradeModal({ grade, onClose, onSaved }) {
  const toast = useToast();
  const [meaning, setMeaning] = useState(grade.meaning);
  const [panelSize, setPanelSize] = useState(grade.panel_size);
  const [presentAtCpa, setPresentAtCpa] = useState(!!grade.present_at_cpa);
  const [meaningErr, setMeaningErr] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    if (!meaning.trim()) { setMeaningErr('Meaning is required'); return; }
    setBusy(true);
    try {
      await api.patch(`/grades/${encodeURIComponent(grade.code)}`, {
        meaning: meaning.trim(),
        panel_size: Number(panelSize),
        present_at_cpa: presentAtCpa,
      });
      toast(`Grade ${grade.code} updated`);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" labelledBy="grade-modal-title">
      <h3 id="grade-modal-title" className="font-display text-[22px] font-semibold text-ink leading-tight mb-1.5">
        Edit Grade — {grade.code}
      </h3>
      <label className="lbl" htmlFor="grade-meaning">Meaning <span className="text-brand-red">*</span></label>
      <input
        id="grade-meaning"
        className={`inp ${meaningErr ? 'inp-err' : ''}`}
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        onBlur={(e) => setMeaningErr(e.target.value.trim() ? null : 'Meaning is required')}
        aria-invalid={!!meaningErr}
      />
      {meaningErr && <p className="field-err" role="alert">{meaningErr}</p>}
      <label className="lbl" htmlFor="grade-panel">Interview Panel Size</label>
      <select id="grade-panel" className="inp" value={panelSize} onChange={(e) => setPanelSize(e.target.value)}>
        <option value={2}>2-member panel</option>
        <option value={3}>3-member committee</option>
      </select>
      <label className="flex items-center gap-1.5 text-[12.5px] font-medium mt-3">
        <input type="checkbox" checked={presentAtCpa} onChange={(e) => setPresentAtCpa(e.target.checked)} />
        Present in CPA sanctioned strength
      </label>
      <ErrorBox error={err} />
      <div className="flex gap-2 mt-3.5">
        <button type="button" className="btn btn-green" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}

/* ===== Competency add/edit modal ===== */
function CompetencyModal({ comp, profile, nextOrder, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !comp;
  const [form, setForm] = useState(() => ({
    key: comp?.key || '',
    name: comp?.name || '',
    section: comp?.section || 'skill',
    weight: comp?.weight ?? 10,
    is_placeholder: !!comp?.is_placeholder,
    anchors: comp?.anchors?.length === 5 ? [...comp.anchors] : ['', '', '', '', ''],
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setAnchor = (i) => (e) => {
    setForm((f) => ({ ...f, anchors: f.anchors.map((a, j) => (j === i ? e.target.value : a)) }));
  };

  async function save() {
    setErr(null);
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (isNew && !form.key.trim()) { setErr('Key is required (e.g. practical, roleknow)'); return; }
    if (form.anchors.some((a) => !a.trim())) { setErr('All 5 behavioural anchors are required'); return; }
    const payload = {
      name: form.name.trim(),
      section: form.section,
      weight: Number(form.weight) || 0,
      is_placeholder: form.is_placeholder,
      anchors: form.anchors.map((a) => a.trim()),
    };
    setBusy(true);
    try {
      if (isNew) {
        await api.post('/competencies', {
          ...payload,
          key: form.key.trim(),
          profile,
          order: nextOrder,
        });
        toast('Competency added');
      } else {
        await api.patch(`/competencies/${comp._id}`, payload);
        toast('Competency updated');
      }
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" labelledBy="comp-modal-title">
      <h3 id="comp-modal-title" className="font-display text-[22px] font-semibold text-ink leading-tight mb-1.5">
        {isNew ? 'Add Competency' : `Edit Competency — ${comp.key}`}
        <span className="mini font-sans font-normal ml-2">profile: {profile}</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5">
        {isNew && (
          <div>
            <label className="lbl" htmlFor="comp-key">Key <span className="text-brand-red">*</span></label>
            <input id="comp-key" className="inp font-mono" value={form.key} onChange={set('key')} placeholder="e.g. practical" />
          </div>
        )}
        <div className={isNew ? '' : 'sm:col-span-2'}>
          <label className="lbl" htmlFor="comp-name">Name <span className="text-brand-red">*</span></label>
          <input id="comp-name" className="inp" value={form.name} onChange={set('name')} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5">
        <div>
          <label className="lbl" htmlFor="comp-section">Section</label>
          <select id="comp-section" className="inp" value={form.section} onChange={set('section')}>
            <option value="att">att — Attitude</option>
            <option value="skill">skill — Skills</option>
            <option value="know">know — Knowledge</option>
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="comp-weight">Weight (points)</label>
          <input id="comp-weight" className="inp" type="number" inputMode="numeric" min="0" value={form.weight} onChange={set('weight')} />
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-[12.5px] font-medium mt-3">
        <input type="checkbox" checked={form.is_placeholder} onChange={set('is_placeholder')} />
        Placeholder — HOD must replace before this role goes live
      </label>

      <div className="mt-2">
        <h4 className="font-display text-[17px] font-semibold text-ink leading-tight border-b border-line pb-1.5 mt-4">
          Behavioural anchors
        </h4>
        {LEVELS.map((lv, i) => (
          <div key={lv.label}>
            <label className="lbl flex items-center gap-2" htmlFor={`comp-anchor-${i}`}>
              <span>Anchor {i + 1}</span>
              <LevelChip index={i} />
            </label>
            <textarea id={`comp-anchor-${i}`} className="inp min-h-[52px] resize-y" value={form.anchors[i]} onChange={setAnchor(i)} />
          </div>
        ))}
      </div>

      <ErrorBox error={err} />
      <div className="flex gap-2 mt-3.5">
        <button type="button" className="btn btn-green" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}

/* ===== Page ===== */
export default function FrameworkPage() {
  const toast = useToast();

  const [grades, setGrades] = useState([]);
  const [gradesErr, setGradesErr] = useState(null);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradeModal, setGradeModal] = useState(null);

  const [profile, setProfile] = useState('core');
  const [comps, setComps] = useState([]);
  const [compsErr, setCompsErr] = useState(null);
  const [compsLoading, setCompsLoading] = useState(true);
  const [compModal, setCompModal] = useState(null); // null | 'new' | competency
  const [compToDelete, setCompToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadGrades = useCallback(async () => {
    setGradesErr(null);
    try {
      const d = await api.get('/grades');
      setGrades(d.grades || []);
    } catch (e) {
      setGradesErr(e.message);
    } finally {
      setGradesLoading(false);
    }
  }, []);

  const loadComps = useCallback(async (p) => {
    setCompsLoading(true);
    setCompsErr(null);
    try {
      const d = await api.get(`/competencies?profile=${encodeURIComponent(p)}`);
      setComps(d.competencies || []);
    } catch (e) {
      setCompsErr(e.message);
    } finally {
      setCompsLoading(false);
    }
  }, []);

  useEffect(() => { loadGrades(); }, [loadGrades]);
  useEffect(() => { loadComps(profile); }, [profile, loadComps]);

  async function deleteComp() {
    const c = compToDelete;
    if (!c) return;
    setDeleteBusy(true);
    try {
      await api.del(`/competencies/${c._id}`);
      toast('Competency deleted');
      loadComps(profile);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleteBusy(false);
      setCompToDelete(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Framework & Grades"
        sub="Grade structure · PCN format · competency library"
      />

      {/* (a) Grade structure */}
      <div className="card">
        <h2 className="card-h">Corporate Grade Structure <span className="r">panel size drives the interview committee</span></h2>
        <ErrorBox error={gradesErr} onRetry={loadGrades} />
        {gradesLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Grade</th><th>Meaning</th><th>Present at CPA?</th><th>Interview Panel</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.code}>
                    <td className="font-bold">{g.code}</td>
                    <td>{g.meaning}</td>
                    <td>
                      {g.present_at_cpa ? (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] bg-brand-green/10 text-brand-green">Yes</span>
                      ) : (
                        <span className="mini">—</span>
                      )}
                    </td>
                    <td>{g.panel_size}-member{g.panel_size === 3 ? ' committee' : ''}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGradeModal(g)}>
                        <Edit size={13} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint mt-2">
          CPA (a full-service unit) has no A2/A4 positions in its sanctioned strength — shown honestly, not invented. Grades A1–A3 convene a 3-member committee; A4 and below use a 2-member panel.
        </p>
      </div>

      {/* (b) PCN format */}
      <div className="card">
        <h2 className="card-h">PCN Format</h2>
        <div className="infobar font-mono">
          <b>CPA – DEPT – GRADE – SERIAL</b> &nbsp;e.g. <span className="pcn">CPA-FO-C1-001</span>
        </div>
        <p className="hint">
          Corporate Grade, Designation, Job Family, Business Unit, and PCN are separate concepts and never mixed. Two people at grade B1 can hold different designations, job families, and salary bands. PCNs are generated server-side — one document per sanctioned seat.
        </p>
      </div>

      {/* (c) Scoring framework */}
      <div className="card">
        <h2 className="card-h">Scoring Framework</h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Section</th><th className="num">Weight</th><th>Competencies</th></tr>
            </thead>
            <tbody>
              <tr><td><b>Attitude</b></td><td className="num">60%</td><td>Guest Orientation 20 · Cultural Fit 15 · Communication 15 · Learning &amp; Teamwork 10</td></tr>
              <tr><td><b>Skills</b></td><td className="num">25%</td><td>Practical 12 · Problem Solving 8 · Grooming 5 (FO); role-specific for others</td></tr>
              <tr><td><b>Knowledge</b></td><td className="num">15%</td><td>Role Knowledge 10 · Hospitality Awareness 5</td></tr>
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">
          Behavioural MCQ, never bare numbers. Levels: Exceptional 100% · Strong 80% · Acceptable 60% · Below Expectations 40% · Not Suitable 20% of each weight. Score bands: 85+ Strongly Recommend · 70–84 Recommend · 55–69 Hold · &lt;55 Do Not Recommend. Any red flag → HR review regardless of score.
        </p>
      </div>

      {/* (d) Competency library */}
      <div className="card">
        <h2 className="card-h">
          Competency Library
          <span className="r">what interviewers actually score against</span>
        </h2>
        <div className="infobar">
          <b>This library replaces the hardcoded scoring arrays of the old artifact.</b> Edits here go live for interviewers immediately — this is where HODs replace the generic placeholders with real trade content before a role goes live.
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <select className="inp w-auto min-w-[280px]" aria-label="Competency profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button type="button" className="btn btn-sm" onClick={() => setCompModal('new')}>
            <Plus size={13} />
            Add competency
          </button>
        </div>

        <ErrorBox error={compsErr} onRetry={() => loadComps(profile)} />
        {compsLoading ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </>
        ) : comps.length === 0 ? (
          <Empty
            icon={BookOpen}
            title="No competencies in this profile yet"
            action={
              <button type="button" className="btn btn-sm" onClick={() => setCompModal('new')}>
                <Plus size={13} />
                Add competency
              </button>
            }
          >
            Add the first competency so interviewers have anchors to score against.
          </Empty>
        ) : (
          comps.map((c) => (
            <div key={c._id} className="border border-line rounded-md mb-3 overflow-hidden">
              <div className="bg-beige/50 px-3.5 py-2.5 flex items-center gap-2 flex-wrap border-b border-line">
                <span className="font-display text-[16px] font-semibold text-ink">{c.name}</span>
                <SectionTag section={c.section} />
                <span className="text-[11px] text-berry font-semibold uppercase tracking-[1px] bg-berry-soft px-2 py-0.5 rounded-sm tabular-nums">{c.weight}%</span>
                <span className="mini font-mono">{c.key}</span>
                <span className="ml-auto flex gap-1.5">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompModal(c)}>
                    <Edit size={13} />
                    Edit
                  </button>
                  <button type="button" className="btn btn-red btn-sm" onClick={() => setCompToDelete(c)}>
                    <Trash size={13} />
                    Delete
                  </button>
                </span>
              </div>
              <div className="px-3.5 py-2.5">
                {c.is_placeholder && (
                  <div className="placeholder-warn">
                    <AlertTriangle size={14} className="mt-px shrink-0" />
                    <span>Placeholder content — the department HOD must replace these anchors before this role goes live.</span>
                  </div>
                )}
                {(c.anchors || []).map((a, i) => (
                  <div key={i} className="flex gap-2 text-xs py-0.5">
                    <span className="font-semibold text-ink min-w-[130px] shrink-0">{LEVELS[i]?.label || `Level ${i + 1}`}</span>
                    <span className="text-body">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {gradeModal && (
        <GradeModal
          grade={gradeModal}
          onClose={() => setGradeModal(null)}
          onSaved={() => { setGradeModal(null); loadGrades(); }}
        />
      )}
      {compModal && (
        <CompetencyModal
          comp={compModal === 'new' ? null : compModal}
          profile={profile}
          nextOrder={comps.length}
          onClose={() => setCompModal(null)}
          onSaved={() => { setCompModal(null); loadComps(profile); }}
        />
      )}
      {compToDelete && (
        <ConfirmDialog
          title="Delete competency?"
          body={
            <>
              Delete <b>{compToDelete.name}</b> from the <b className="font-mono">{profile}</b> profile? Interviewers will stop seeing it immediately.
            </>
          }
          confirmLabel="Delete"
          tone="danger"
          busy={deleteBusy}
          onCancel={() => setCompToDelete(null)}
          onConfirm={deleteComp}
        />
      )}
    </div>
  );
}
