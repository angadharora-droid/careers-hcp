import mongoose from 'mongoose';

// The link between the HR Panel and the Interview Panel: an interviewer only ever
// sees applications where a row here names them.
//
// One row per ROUND, not per panellist. The same interviewer may hold more than one
// round on the same candidate — the workbook does exactly that, putting Parag in
// Round 1 and Round 3 of every A-grade interview.
const panelAssignmentSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  interviewer_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  round: { type: Number, required: true, default: 1 },
  panel_role: { type: String, default: 'Round 1' }, // display label
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  auto_assigned: { type: Boolean, default: false }, // seeded from a PanelRule rather than picked by HR
  assigned_at: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Scored'], default: 'Pending' },
});

// A round has exactly one interviewer. Deliberately NOT unique on
// (application, interviewer) — that would forbid one person taking two rounds.
panelAssignmentSchema.index({ application_id: 1, round: 1 }, { unique: true });

export default mongoose.model('PanelAssignment', panelAssignmentSchema);
