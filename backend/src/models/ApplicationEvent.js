import mongoose from 'mongoose';

/* One line in an application's history. The pipeline stores CURRENT state only —
   an application knows it is Rejected, not when it was shortlisted or who moved
   it — so anything the timeline needs to show after the fact is written here as
   it happens.

   Deliberately not written for: the application being created (applied_on already
   records that) and interview scores (PanelScore.submitted_at is the record, and
   a resubmission replaces it rather than adding to it). Both are merged into the
   timeline at read time, so no event can contradict them. */

export const EVENT_TYPES = [
  'stage',      // stage moved (from → to)
  'panel',      // interview panel appointed or changed
  'offer',      // offer terms set, letter generated or emailed
  'approval',   // Section B approval record saved
  'move',       // pushed to a different role
  'document',   // documents attached by HR
  'edit',       // candidate / register fields changed by hand
  'talent',     // added to / removed from the Talent Bank
];

const applicationEventSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    // One line, already phrased for a reader: "Moved to Interview Scheduled".
    summary: { type: String, required: true },
    // Optional second line: the reason, the panel names, the seat.
    detail: { type: String, default: '' },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    actor_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actor_name: { type: String, default: '' },
    actor_role: { type: String, default: '' },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

applicationEventSchema.index({ application_id: 1, at: 1 });

/* Fire-and-forget: a timeline entry must never be the reason a stage change or an
   offer fails, so a write error is logged and swallowed rather than thrown. */
export async function recordEvent(applicationId, type, summary, opts = {}) {
  try {
    const { actor, detail = '', from = '', to = '', at } = opts;
    return await mongoose.model('ApplicationEvent').create({
      application_id: applicationId,
      type,
      summary,
      detail,
      from,
      to,
      actor_user_id: actor?._id,
      actor_name: actor?.name || '',
      actor_role: actor?.hasRole?.('hr_admin') ? 'hr_admin' : (actor ? 'interviewer' : ''),
      at: at || new Date(),
    });
  } catch (err) {
    console.warn('Timeline event not recorded:', err.message);
    return null;
  }
}

export default mongoose.model('ApplicationEvent', applicationEventSchema);
