import mongoose from 'mongoose';

/* A running note on an application, shared by everyone working the candidate:
   HR and the panellists appointed to that candidate both post and both read.
   Comments are deliberately NOT scores — nothing here feeds the recommendation.
   They carry the operational thread the scorecard has no room for ("candidate
   asked to reschedule", "salary approval pending with the GM").

   The author's name and role are denormalised so an old comment still reads
   correctly after the person's designation changes or their account is removed. */
const applicationCommentSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    author_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    author_name: { type: String, required: true },
    // 'hr_admin' | 'interviewer' — the hat the author was wearing when they posted.
    author_role: { type: String, required: true },
    author_designation: { type: String, default: '' },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// The thread is always read oldest-first for one application.
applicationCommentSchema.index({ application_id: 1, created_at: 1 });

export default mongoose.model('ApplicationComment', applicationCommentSchema);
