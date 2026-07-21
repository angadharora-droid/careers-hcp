import mongoose from 'mongoose';

// Atomic serial counters for PCN generation (one per UNIT-DEPT-GRADE key) so
// seat numbering can't collide across concurrent HR users.
const counterSchema = new mongoose.Schema({
  _id: String, // e.g. "CPA-FO-C1"
  seq: { type: Number, default: 0 },
});

export default mongoose.model('Counter', counterSchema);
