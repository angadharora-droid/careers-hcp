import mongoose from 'mongoose';

// The fixed interview panel from Interview_Panel.xlsx: for a given unit + grade +
// department, who takes each round. HR can override the resulting assignments on
// any individual application; this is the default, not a lock.
const panelRuleSchema = new mongoose.Schema({
  unit_code: { type: String, required: true, index: true },   // HCP | CPA | CPNM | PABLO | DALI
  grade: { type: String, required: true, index: true },
  department: { type: String, required: true },               // '*' = any department
  dept_code: { type: String, default: '' },                   // raw numeric code from the HCP/CPNM sheets
  // 'seed'   → built from panelData.js, rebuilt on every boot
  // 'import' → written by `npm run import-panel` from a unit's own sheet; the boot
  //            seed leaves these alone, so an import is not undone by a restart.
  source: { type: String, enum: ['seed', 'import'], default: 'seed', index: true },
  rounds: [
    {
      round: { type: Number, required: true },                // 1-based; sheet's PANEL 1/2/3
      interviewer_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      // Where the sheet offers a choice ("ARJUN SIR/ANGADH SIR"), the extras land here.
      alternates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
  ],
});

panelRuleSchema.index({ unit_code: 1, grade: 1, department: 1 }, { unique: true });

export default mongoose.model('PanelRule', panelRuleSchema);
