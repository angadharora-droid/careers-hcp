import mongoose from 'mongoose';

export const POSITION_STATUSES = [
  'Vacant', 'Filled', 'Under Recruitment', 'Frozen', 'On Hold',
  'Contract', 'Outsourced', 'Eliminated',
];

// One document per sanctioned seat (PCN), not per role.
const positionSchema = new mongoose.Schema(
  {
    pcn: { type: String, required: true, unique: true },       // CPA-FO-C1-001
    job_code: { type: String, required: true, index: true },   // CPA-FO-C1 (role-level, candidate-facing)
    unit: { type: String, default: 'Centre Point Amravati' },
    unit_code: { type: String, default: 'CPA', index: true }, // HCP | CPA | CPNM | PABLO | DALI
    unit_class: { type: String, default: 'HT2 (Full Service Hotel)' },
    designation: { type: String, required: true },
    job_family: { type: String, default: '' },
    grade: { type: String, required: true },
    department: { type: String, required: true },
    reports_to: { type: String, default: '' },
    cost_centre: { type: String, default: '' },
    // The sanctioned salary band. An offer is judged under / within / over this
    // band — there is no separate budgeted figure to drift out of step with it.
    salary_min: { type: Number, default: 0 },
    salary_max: { type: Number, default: 0 },
    status: { type: String, enum: POSITION_STATUSES, default: 'Vacant' },
    occupant_name: { type: String, default: '' },
    vacant_since: { type: Date, default: null },
    /* Time-to-fill, stamped when a selection claims the seat. `vacant_since` is
       cleared in the same moment, so the elapsed days are RECORDED here rather
       than recomputed later — that keeps the dashboard average stable even after
       the seat is handed back and refilled. */
    filled_on: { type: Date, default: null },
    days_to_fill: { type: Number, default: null },
    replacement_sla_days: { type: Number, default: 30 },
    is_critical: { type: Boolean, default: false },
    is_revenue_generating: { type: Boolean, default: false },
    is_guest_facing: { type: Boolean, default: false },
    job_description: { type: String, default: '' },            // shown on the public Career Panel
    competency_profile: { type: String, default: null },        // '<dept>_assoc' | '<dept>_exec' | null → generic placeholders
    approver: { type: String, default: 'General Manager' },
    remarks: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Position', positionSchema);
