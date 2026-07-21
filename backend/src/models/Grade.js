import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // A1, B1, C1…
  meaning: { type: String, required: true },            // plain-language label (also used on Career Panel)
  panel_size: { type: Number, enum: [2, 3], default: 2 },
  present_at_cpa: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

export default mongoose.model('Grade', gradeSchema);
