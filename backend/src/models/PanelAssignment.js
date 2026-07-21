import mongoose from 'mongoose';

// The link between the HR Panel and the Interview Panel: an interviewer only ever
// sees applications where a row here names them.
const panelAssignmentSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  interviewer_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  panel_role: { type: String, default: 'Panellist 1' }, // Panellist 1 / 2 / 3 (Committee)
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_at: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Scored'], default: 'Pending' },
});

panelAssignmentSchema.index({ application_id: 1, interviewer_user_id: 1 }, { unique: true });

export default mongoose.model('PanelAssignment', panelAssignmentSchema);
