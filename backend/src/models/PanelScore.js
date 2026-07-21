import mongoose from 'mongoose';

const panelScoreSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  panelist_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  panelist_name: String,
  round: { type: Number, required: true, default: 1 },
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

// One score per ROUND per application; resubmission replaces it. Keyed on the round
// rather than the panellist so an interviewer holding two rounds files two scores.
panelScoreSchema.index({ application_id: 1, round: 1 }, { unique: true });

export default mongoose.model('PanelScore', panelScoreSchema);
