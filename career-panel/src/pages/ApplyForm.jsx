import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPosition, submitApplication } from '../lib/api';
import { countWords, friendlyLevel } from '../lib/format';
import ErrorAlert from '../components/ErrorAlert';
import RoleClosed from '../components/RoleClosed';
import { FormSkeleton } from '../components/Skeleton';
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  LoaderIcon,
  UploadIcon,
  XIcon,
} from '../components/Icons';

const SOURCES = [
  'Referral (employee)',
  'Walk-in',
  'Naukri / Portal',
  'Instagram / Social',
  'Newspaper',
  'Consultant',
  'Other',
];

const MAX_FILES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['pdf'];
const INTRO_WORD_LIMIT = 50;
const INTRO_WARN_AT = 45;

const INPUT_CLS =
  'w-full min-h-[44px] rounded-sm border border-line bg-beige/40 px-3 py-2.5 text-[16px] text-body placeholder:text-muted/70 focus:outline-none focus:border-berry';

const EMPTY_FORM = {
  candidate_name: '',
  email: '',
  mobile: '',
  age: '',
  gender: '',
  qualification: '',
  total_experience_years: '',
  current_designation: '',
  years_in_current_firm: '',
  current_salary: '',
  expected_salary: '',
  willing_to_relocate: '',
  needs_accommodation: '',
  worked_at_cph_before: '',
  source: '',
  why_join: '',
  intro_note: '',
};

// Focus order for "focus the first invalid field" on submit
const FIELD_ORDER = Object.keys(EMPTY_FORM);

// A candidate who declares 0 years of experience has no current employer to
// describe, so these three stop being required for them.
const CURRENT_EMPLOYMENT_FIELDS = ['current_designation', 'years_in_current_firm', 'current_salary'];
const FRESHER_HINT = 'Not needed for freshers.';

const isFresher = (form) => {
  const t = String(form.total_experience_years).trim();
  return t !== '' && Number(t) === 0;
};

const isExempt = (name, form) => CURRENT_EMPLOYMENT_FIELDS.includes(name) && isFresher(form);

const requiredText = (missing) => (v) => (String(v).trim() ? '' : missing);

const requiredNumber = ({ missing, label, max = Infinity }) => (v) => {
  const t = String(v).trim();
  if (!t) return missing;
  const n = Number(t);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  if (n > max) return `${label} cannot be more than ${max}.`;
  return '';
};

const VALIDATORS = {
  candidate_name: requiredText('Please enter your full name.'),
  email: (v) => {
    const t = v.trim();
    if (!t) return 'Please enter your email address.';
    return /^\S+@\S+\.\S+$/.test(t)
      ? ''
      : 'That email address does not look right — please check it.';
  },
  mobile: (v) => {
    const t = v.trim();
    if (!t) return 'Please enter your mobile number.';
    return /^[0-9+\-() ]{7,15}$/.test(t) ? '' : 'Please enter a valid mobile number.';
  },
  age: (v) => {
    const t = String(v).trim();
    if (!t) return 'Please enter your age.';
    const n = Number(t);
    return Number.isFinite(n) && n >= 16 && n <= 70 ? '' : 'Age should be between 16 and 70.';
  },
  gender: requiredText('Please select your gender.'),
  qualification: requiredText('Please enter your highest qualification.'),
  total_experience_years: requiredNumber({
    missing: 'Please enter your total experience — enter 0 if you are a fresher.',
    label: 'Experience',
    max: 50,
  }),
  current_designation: requiredText('Please enter your current or last designation.'),
  years_in_current_firm: requiredNumber({
    missing: 'Please enter how long you have been with your current firm.',
    label: 'Years in current firm',
    max: 50,
  }),
  current_salary: requiredNumber({
    missing: 'Please enter your current salary.',
    label: 'Current salary',
  }),
  expected_salary: requiredNumber({
    missing: 'Please enter your expected salary.',
    label: 'Expected salary',
  }),
  willing_to_relocate: requiredText('Please tell us whether you can relocate to Amravati.'),
  needs_accommodation: requiredText('Please tell us whether you need staff accommodation.'),
  worked_at_cph_before: requiredText(
    'Please tell us whether you have worked at Centre Point Hospitality before.'
  ),
  source: requiredText('Please tell us how you heard about us.'),
  why_join: requiredText('Please tell us why you want to join Centre Point.'),
  intro_note: (v) => {
    if (!v.trim()) return 'Please introduce yourself in a few words.';
    return countWords(v) > INTRO_WORD_LIMIT
      ? `Please keep your intro to ${INTRO_WORD_LIMIT} words or fewer.`
      : '';
  },
};

const DOCS_REQUIRED_MESSAGE =
  'Please attach at least one document — your CV, and certificates if you have them.';

/* ---------- field primitives (label + control + inline error) ---------- */

function FieldShell({ label, name, required, hint, error, children }) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block font-button text-[11px] uppercase tracking-[1.5px] text-muted mb-1.5"
      >
        {label}
        {required && <span className="text-brand-red"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`${name}-hint`} className="mt-1.5 text-[11px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-[12px] font-medium text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(name, hint, error, extra) {
  return (
    [hint ? `${name}-hint` : null, error ? `${name}-error` : null, extra]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function TextField({ label, name, required, hint, error, inputRef, className = '', ...props }) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error}>
      <input
        id={name}
        name={name}
        ref={inputRef}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={`${INPUT_CLS} ${error ? 'border-brand-red focus:border-brand-red' : ''} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

function SelectField({ label, name, required, hint, error, inputRef, children, ...props }) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error}>
      <div className="relative">
        <select
          id={name}
          name={name}
          ref={inputRef}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className={`${INPUT_CLS} appearance-none pr-9 ${
            error ? 'border-brand-red focus:border-brand-red' : ''
          }`}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>
    </FieldShell>
  );
}

function TextareaField({ label, name, required, hint, error, inputRef, extraDescribedBy, className = '', ...props }) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error}>
      <textarea
        id={name}
        name={name}
        ref={inputRef}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(name, hint, error, extraDescribedBy)}
        className={`${INPUT_CLS} resize-y min-h-[88px] ${
          error ? 'border-brand-red focus:border-brand-red' : ''
        } ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

function FormSection({ title, required, children }) {
  return (
    <section className="p-5 sm:p-8 lg:p-10 border-t border-line">
      <h2 className="font-display text-xl font-semibold text-ink">
        {title}
        {required && <span className="text-brand-red"> *</span>}
      </h2>
      <span className="mt-2 block h-0.5 w-8 bg-berry" aria-hidden="true" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function focusField(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center' });
}

function fileSizeLabel(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ---------- success screen ---------- */

function SuccessScreen({ role }) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-card border border-line rounded-sm p-6 sm:p-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center">
          <CheckIcon size={34} strokeWidth={2.25} />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
          Thanks for applying
        </h1>
        <p className="mt-3 text-[13px] text-body leading-relaxed">
          Thank you for applying{role ? ` for ${role.designation}` : ''} at Centre Point Amravati.
          We will connect with you if your application moves further.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center min-h-[44px] bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 py-2.5 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
          >
            Browse more roles
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- apply form ---------- */

export default function ApplyForm() {
  const { job_code } = useParams();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [closed, setClosed] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const fieldRefs = useRef({});

  const registerField = (name) => (el) => {
    fieldRefs.current[name] = el;
  };

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    setClosed(false);
    getPosition(job_code)
      .then((data) => setRole(data.role))
      .catch((e) => {
        if (e.status === 404) setClosed(true);
        else setLoadError(e.message);
      })
      .finally(() => setLoading(false));
  }, [job_code]);

  useEffect(() => {
    load();
  }, [load]);

  const validateField = (name, value, state = form) => {
    if (isExempt(name, state)) return '';
    const validator = VALIDATORS[name];
    return validator ? validator(value, state) : '';
  };

  const set = (name) => (e) => {
    const value = e.target.value;
    const next = { ...form, [name]: value };
    setForm(next);
    // Validate on blur, not keystroke — but clear an existing error as soon as it's fixed.
    setErrors((prev) => {
      const out = { ...prev };
      if (out[name]) out[name] = validateField(name, value, next);
      // Crossing in or out of fresher territory changes which of these are required.
      if (name === 'total_experience_years') {
        for (const f of CURRENT_EMPLOYMENT_FIELDS) {
          if (out[f]) out[f] = validateField(f, next[f], next);
        }
      }
      return out;
    });
  };

  const onBlur = (name) => (e) => {
    const message = validateField(name, e.target.value);
    setErrors((prev) => (prev[name] === message ? prev : { ...prev, [name]: message }));
  };

  const fieldProps = (name) => ({
    value: form[name],
    onChange: set(name),
    onBlur: onBlur(name),
    error: errors[name] || '',
    inputRef: registerField(name),
  });

  const fresher = isFresher(form);

  const introWords = countWords(form.intro_note);
  const introOver = introWords > INTRO_WORD_LIMIT;
  const introPct = Math.min(100, (introWords / INTRO_WORD_LIMIT) * 100);
  const meterColor = introOver
    ? 'bg-brand-red'
    : introWords >= INTRO_WARN_AT
      ? 'bg-brand-amber'
      : 'bg-berry';

  const addFiles = (picked) => {
    const problems = [];
    const next = [...files];
    for (const f of Array.from(picked || [])) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        problems.push(`"${f.name}" — only PDF files are accepted.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        problems.push(`"${f.name}" — files must be 5 MB or smaller.`);
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      if (next.length >= MAX_FILES) {
        problems.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
    setFileError(problems.join(' '));
  };

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = ''; // allow re-picking the same file after removal
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
  };

  const openPicker = () => {
    if (files.length < MAX_FILES) fileInputRef.current?.click();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Validate everything; focus the first invalid field.
    const nextErrors = {};
    for (const name of FIELD_ORDER) {
      const message = validateField(name, form[name], form);
      if (message) nextErrors[name] = message;
    }
    const missingDocs = files.length === 0;
    if (missingDocs) setFileError(DOCS_REQUIRED_MESSAGE);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalid = FIELD_ORDER.find((name) => nextErrors[name]);
      focusField(fieldRefs.current[firstInvalid]);
      return;
    }
    if (missingDocs) {
      focusField(dropZoneRef.current);
      return;
    }

    const fd = new FormData();
    fd.append('job_code', job_code);
    Object.entries(form).forEach(([key, value]) => {
      const v = String(value).trim();
      if (v !== '') fd.append(key, v);
    });
    files.forEach((f) => fd.append('documents', f));

    setSubmitting(true);
    try {
      const data = await submitApplication(fd);
      setResult(data);
      window.scrollTo(0, 0);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return <SuccessScreen role={role} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to={`/jobs/${encodeURIComponent(job_code)}`}
        className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 font-button text-[11px] uppercase tracking-[2px] text-berry hover:text-berry-dark mb-4 transition-colors duration-200"
      >
        <ArrowLeftIcon size={14} />
        Back to role details
      </Link>

      {loading && <FormSkeleton />}
      {!loading && loadError && <ErrorAlert message={loadError} onRetry={load} />}
      {!loading && closed && <RoleClosed />}

      {!loading && !loadError && !closed && role && (
        <form onSubmit={onSubmit} noValidate className="bg-card border border-line rounded-sm">
          {/* The role — compact read-only summary */}
          <section className="p-5 sm:p-8 lg:px-10">
            <p className="font-button text-[11px] uppercase tracking-[2px] text-berry">
              You are applying for
            </p>
            <h1 className="mt-2 font-display text-[26px] sm:text-3xl font-semibold text-ink leading-tight">
              {role.designation}
            </h1>
            <p className="mt-2 font-button text-[11px] uppercase tracking-[1.5px] text-muted">
              {[role.department, friendlyLevel(role.grade_label), role.unit]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>

          <FormSection title="Personal details">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
              <TextField
                label="Full name"
                name="candidate_name"
                required
                type="text"
                autoComplete="name"
                placeholder="As on your ID"
                {...fieldProps('candidate_name')}
              />
              <TextField
                label="Email address"
                name="email"
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                {...fieldProps('email')}
              />
              <TextField
                label="Mobile number"
                name="mobile"
                required
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="10-digit mobile"
                {...fieldProps('mobile')}
              />
              <TextField
                label="Age"
                name="age"
                required
                type="number"
                inputMode="numeric"
                min="16"
                max="70"
                placeholder="e.g. 24"
                {...fieldProps('age')}
              />
              <SelectField label="Gender" name="gender" required {...fieldProps('gender')}>
                <option value="">Select…</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </SelectField>
              <TextField
                label="Highest qualification"
                name="qualification"
                required
                type="text"
                placeholder="e.g. B.Sc. Hospitality, 12th pass"
                {...fieldProps('qualification')}
              />
            </div>
          </FormSection>

          <FormSection title="Experience & compensation">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
              <TextField
                label="Total experience (years)"
                name="total_experience_years"
                required
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.5"
                placeholder="0 if you're a fresher"
                {...fieldProps('total_experience_years')}
              />
              <TextField
                label="Current / last designation"
                name="current_designation"
                required={!fresher}
                hint={fresher ? FRESHER_HINT : undefined}
                type="text"
                autoComplete="organization-title"
                placeholder="e.g. Front Desk Associate"
                {...fieldProps('current_designation')}
              />
              <TextField
                label="Years in current firm"
                name="years_in_current_firm"
                required={!fresher}
                hint={fresher ? FRESHER_HINT : undefined}
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.5"
                {...fieldProps('years_in_current_firm')}
              />
              <TextField
                label="Current salary (₹ / month)"
                name="current_salary"
                required={!fresher}
                hint={fresher ? FRESHER_HINT : undefined}
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="e.g. 15000"
                {...fieldProps('current_salary')}
              />
              <TextField
                label="Expected salary (₹ / month)"
                name="expected_salary"
                required
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="e.g. 18000"
                {...fieldProps('expected_salary')}
              />
            </div>
          </FormSection>

          <FormSection title="About you">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-6">
              <SelectField
                label="Willing to relocate to Amravati?"
                name="willing_to_relocate"
                required
                {...fieldProps('willing_to_relocate')}
              >
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </SelectField>
              <SelectField
                label="Need staff accommodation?"
                name="needs_accommodation"
                required
                {...fieldProps('needs_accommodation')}
              >
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </SelectField>
              <SelectField
                label="Worked at Centre Point Hospitality before?"
                name="worked_at_cph_before"
                required
                {...fieldProps('worked_at_cph_before')}
              >
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </SelectField>
              <SelectField
                label="How did you hear about us?"
                name="source"
                required
                {...fieldProps('source')}
              >
                <option value="">Select…</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <TextareaField
                label="Why do you want to join Centre Point?"
                name="why_join"
                required
                rows="3"
                placeholder="A few honest lines are perfect."
                {...fieldProps('why_join')}
              />
              <div>
                <TextareaField
                  label="Quick intro"
                  name="intro_note"
                  required
                  rows="3"
                  hint="Introduce yourself in your own words — who you are, what you enjoy, what you're good at."
                  placeholder={`A short introduction, up to ${INTRO_WORD_LIMIT} words.`}
                  extraDescribedBy="intro-word-count"
                  {...fieldProps('intro_note')}
                />
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-1 flex-1 rounded-sm bg-line/60 overflow-hidden"
                    role="presentation"
                  >
                    <div
                      className={`h-full ${meterColor} transition-all duration-200 ease-out`}
                      style={{ width: `${introPct}%` }}
                    />
                  </div>
                  <p
                    id="intro-word-count"
                    aria-live="polite"
                    className={`shrink-0 text-[12px] font-semibold tabular-nums ${
                      introOver
                        ? 'text-brand-red'
                        : introWords >= INTRO_WARN_AT
                          ? 'text-brand-amber'
                          : 'text-muted'
                    }`}
                  >
                    {introWords} / {INTRO_WORD_LIMIT} words
                    {introOver && ' — over the limit'}
                  </p>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Documents" required>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={handleFileInput}
              className="hidden"
              id="documents-input"
            />
            <div
              ref={dropZoneRef}
              role="button"
              tabIndex={0}
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openPicker();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              aria-label="Add documents — click to choose files, or drag and drop"
              aria-disabled={files.length >= MAX_FILES || undefined}
              className={`rounded-sm border border-dashed p-6 text-center transition-colors duration-200 ${
                files.length >= MAX_FILES
                  ? 'border-line bg-beige/20 cursor-not-allowed opacity-60'
                  : dragOver
                    ? 'border-berry bg-berry-soft/40 cursor-pointer'
                    : 'border-line bg-beige/30 hover:border-berry cursor-pointer'
              }`}
            >
              <UploadIcon size={22} className="mx-auto text-muted" />
              <p className="mt-2.5 text-[13px] font-medium text-ink">
                {files.length >= MAX_FILES
                  ? 'File limit reached — remove a file to add another'
                  : 'Click to choose files, or drag & drop here'}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                CV and certificates · PDF only · at least 1 file · up to {MAX_FILES} files · 5 MB
                each
              </p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 border border-line rounded-sm divide-y divide-line">
                {files.map((f, i) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 pl-3 pr-1.5 py-1.5">
                    <FileTextIcon size={16} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted tabular-nums">
                      {fileSizeLabel(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${f.name}`}
                      className="shrink-0 w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-sm text-muted hover:text-brand-red active:scale-[0.98] transition duration-200"
                    >
                      <XIcon size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {fileError && (
              <p className="mt-2 text-[12px] font-medium text-brand-red" role="alert">
                {fileError}
              </p>
            )}
          </FormSection>

          {/* Submit */}
          <section className="p-5 sm:p-8 lg:px-10 border-t border-line">
            {serverError && (
              <div className="mb-4">
                <ErrorAlert message={serverError} />
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-[11.5px] text-muted sm:max-w-sm leading-relaxed">
                By submitting, you confirm the details above are true to the best of your
                knowledge. Fields marked <span className="text-brand-red font-semibold">*</span>{' '}
                are required.
              </p>
              <button
                type="submit"
                disabled={submitting || introOver}
                className="sm:ml-auto shrink-0 inline-flex items-center justify-center gap-2.5 min-h-[44px] bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-8 py-3 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <LoaderIcon size={15} className="animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
