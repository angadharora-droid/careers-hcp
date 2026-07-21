import mongoose from 'mongoose';

export const ROLES = ['hr_admin', 'interviewer'];

// A person can hold both roles on one login: Parag chairs interview rounds AND runs
// the HR panel. `roles` is the source of truth; `role` survives as the primary role
// for display and for any client still reading a single value.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    roles: {
      type: [String],
      enum: ROLES,
      required: true,
      validate: { validator: (v) => v.length > 0, message: 'A user needs at least one role' },
    },
    department: { type: String, default: '' }, // for interviewers
    designation: { type: String, default: '' },
    password_hash: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.virtual('role').get(function () {
  return this.roles?.[0] || null;
});

userSchema.methods.hasRole = function (...roles) {
  return roles.some((r) => this.roles.includes(r));
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,   // primary role
    roles: this.roles,
    department: this.department,
    designation: this.designation,
  };
};

/* Backfills `roles` on documents written before the field existed, and drops the
   old single `role` key. Safe to run on every boot — it only touches stragglers. */
export async function migrateRoles() {
  const legacy = await mongoose.connection.collection('users')
    .find({ roles: { $exists: false } }, { projection: { role: 1 } }).toArray();
  if (!legacy.length) return 0;
  for (const u of legacy) {
    await mongoose.connection.collection('users').updateOne(
      { _id: u._id },
      { $set: { roles: [u.role || 'interviewer'] }, $unset: { role: '' } }
    );
  }
  console.log(`Migrated ${legacy.length} user account(s) to multi-role.`);
  return legacy.length;
}

export default mongoose.model('User', userSchema);
