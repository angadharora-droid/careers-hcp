import mongoose from 'mongoose';

// HR-editable competency library — replaces the hardcoded ATTITUDE / FO_SKILLS /
// FO_KNOW_* / placeholder arrays in the original artifacts.
//
// profile:
//   'core'     → Attitude block, applies to EVERY role (60%)
//   'fo_assoc' → Front Office Associate skills + knowledge (25% + 15%)
//   'fo_exec'  → Front Office Executive skills + knowledge
//   'generic'  → placeholder skills + knowledge used by any role without its own profile
const competencySchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    section: { type: String, enum: ['att', 'skill', 'know'], required: true },
    weight: { type: Number, required: true },
    profile: { type: String, required: true, index: true },
    anchors: {
      type: [String], // exactly 5: Exceptional / Strong / Acceptable / Below Expectations / Not Suitable
      validate: [(a) => a.length === 5, 'Exactly 5 behavioural anchors required'],
    },
    is_placeholder: { type: Boolean, default: false }, // "[PLACEHOLDER — HOD to replace]"
    order: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

competencySchema.index({ profile: 1, key: 1 }, { unique: true });

export default mongoose.model('Competency', competencySchema);
