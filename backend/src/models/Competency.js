import mongoose from 'mongoose';

// HR-editable competency library — replaces the hardcoded ATTITUDE / FO_SKILLS /
// FO_KNOW_* / placeholder arrays in the original artifacts.
//
// profile:
//   'core'      → Attitude block, applies to EVERY role (60%)
//   '<dept>_assoc' / '<dept>_exec'
//               → the department's skills + knowledge (25% + 15%), transcribed from
//                 hotel_assessment_criteria.docx. dept ∈ fo | hk | fb | kit | eng |
//                 sec | val | str | kst | adm | ops | lead. '_exec' is used from grade
//                 B1 upward, where the document's crisis-management and manpower /
//                 budget questions apply; '_assoc' at B2 and below.
//   'generic'   → placeholder skills + knowledge, the fallback for a position created
//                 before its department profile exists
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
