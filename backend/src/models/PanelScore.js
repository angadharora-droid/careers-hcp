import mongoose from 'mongoose';

const panelScoreSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  panelist_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  panelist_name: String,
  panel_role: String,
  competency_breakdown: [
    {
      competency_key: String,
      name: String,
      section: String,        // att | skill | know
      weight: Number,
      level_index: Number,    // 0..4
      level_label: String,    // Exceptional … Not Suitable
      points: Number,
    },
  ],
  total_score: { type: Number, required: true },
  evidence_notes: { type: String, default: '' },
  strengths: { type: String, default: '' },
  concerns: { type: String, default: '' },
  red_flags: { type: [String], default: [] }, // any flag routes to HR review regardless of total
  submitted_at: { type: Date, default: Date.now },
});

// One score per panellist per application; resubmission replaces it.
panelScoreSchema.index({ application_id: 1, panelist_user_id: 1 }, { unique: true });

export default mongoose.model('PanelScore', panelScoreSchema);
