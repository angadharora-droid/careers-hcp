import mongoose from 'mongoose';

export const STAGES = ['Applied', 'Interview Scheduled', 'Selected', 'Rejected', 'On Hold'];

// Standard rejection reasons. Rejected transitions accept one of these or a
// free-text reason in the form "Other: <text>" (validated in routes/applications.js).
export const REJECTION_REASONS = [
  'Frequent job changes / no stability',
  'Negative attitude or poor professionalism',
  'Weak communication skills',
  'Not suitable for hotel culture / team fit',
  'Lack of required skills or knowledge',
  'Over budget',
];

// Candidates apply to a job_code (role). A specific PCN seat is assigned on SELECTION,
// matching Artifact A's behaviour (HR maps applicant → seat when moving to Selected).
const applicationSchema = new mongoose.Schema(
  {
    reference_id: { type: String, required: true, unique: true }, // given to candidate for status lookup
    job_code: { type: String, required: true, index: true },
    position_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null }, // set on selection
    pcn: { type: String, default: '' },                            // seat filled on selection
    // role snapshot (denormalised so pipeline rows don't need joins)
    designation: String,
    department: String,
    grade: String,
    job_family: String,
    competency_profile: { type: String, default: null },
    unit: { type: String, default: 'Centre Point Amravati' },
    unit_code: { type: String, default: 'CPA', index: true }, // keys the fixed-panel lookup

    candidate_name: { type: String, required: true },
    age: Number,
    gender: String,
    mobile: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    qualification: String,
    total_experience_years: Number,
    current_designation: String,
    current_employer: { type: String, default: '' },      // Application Register: Current / Last Employer
    years_in_current_firm: Number,
    current_salary: Number,
    // Hotel-industry years only — the register tracks it separately from total
    // experience because relevance, not length, drives shortlisting.
    relevant_hotel_experience_years: { type: Number, default: null },
    notice_period: { type: String, default: '' },         // free text: '30 days', 'Immediate'
    expected_salary: Number,
    willing_to_relocate: { type: String, default: 'Yes' },
    needs_accommodation: { type: String, default: 'No' },
    worked_at_cph_before: { type: String, default: '' }, // 'Yes' / 'No'
    source: { type: String, default: 'Walk-in' },
    why_join: String,
    intro_note: String, // capped at 50 words (validated server-side)
    documents: [{ filename: String, original_name: String }],

    stage: { type: String, enum: STAGES, default: 'Applied' },
    rejection_reason: { type: String, default: '' },
    interview_date: { type: String, default: '' },
    // Offer terms — captured at/after selection, printed on the offer letter.
    date_of_joining: { type: String, default: '' },   // ISO 'YYYY-MM-DD'
    offered_salary: { type: Number, default: null },   // monthly CTC actually offered
    offer_sent_at: { type: Date, default: null },
    offer_sent_to: { type: String, default: '' },
    applied_on: { type: Date, default: Date.now },
    /* Every time HR pushes this application to a different role, the role it came
       from is recorded here. The reference_id never changes, so control point 1
       (one unique Application ID per application) survives the move. */
    move_history: [{
      from_job_code: String,
      from_designation: String,
      from_stage: String,
      from_rejection_reason: String,
      moved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      moved_by_name: String,
      note: String,
      moved_at: { type: Date, default: Date.now },
    }],
    // Application Register, Section A — HR's running note on the row.
    remarks: { type: String, default: '' },
    /* Application Register, Section B — Selection and Approval Record.
       Only the authorities and dates live here; the candidate, application ID,
       recommended designation/grade, recommended salary, interviewers and
       expected joining date are all read off the application itself so the
       register can never disagree with the pipeline. */
    approval: {
      recommended_by: { type: String, default: '' },
      salary_approved_by: { type: String, default: '' },
      approval_date: { type: String, default: '' },     // ISO 'YYYY-MM-DD'
      offer_issued_date: { type: String, default: '' }, // ISO 'YYYY-MM-DD'
      employee_code: { type: String, default: '' },     // filled in after joining
      closed_by: { type: String, default: '' },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Application', applicationSchema);
