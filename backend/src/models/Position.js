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
    salary_min: { type: Number, default: 0 },
    salary_max: { type: Number, default: 0 },
    budgeted_salary: { type: Number, default: 0 },
    status: { type: String, enum: POSITION_STATUSES, default: 'Vacant' },
    occupant_name: { type: String, default: '' },
    vacant_since: { type: Date, default: null },
    replacement_sla_days: { type: Number, default: 30 },
    is_critical: { type: Boolean, default: false },
    is_revenue_generating: { type: Boolean, default: false },
    is_guest_facing: { type: Boolean, default: false },
    job_description: { type: String, default: '' },            // shown on the public Career Panel
    competency_profile: { type: String, default: null },        // 'fo_assoc' | 'fo_exec' | null → generic placeholders
    approver: { type: String, default: 'General Manager' },
    remarks: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Position', positionSchema);
