import mongoose from 'mongoose';

export const STAGES = ['Applied', 'Interview Scheduled', 'Selected', 'Rejected', 'On Hold'];

// Standard rejection reasons — the only values accepted on Rejected transitions.
export const REJECTION_REASONS = [
  'Frequent job changes / no stability',
  'Negative attitude or poor professionalism',
  'Weak communication skills',
  'Not suitable for hotel culture / team fit',
  'Lack of required skills or knowledge',
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

    candidate_name: { type: String, required: true },
    age: Number,
    gender: String,
    mobile: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    qualification: String,
    total_experience_years: Number,
    current_designation: String,
    years_in_current_firm: Number,
    current_salary: Number,
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
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Application', applicationSchema);
