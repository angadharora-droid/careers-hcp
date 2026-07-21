import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ['hr_admin', 'interviewer'], required: true },
    department: { type: String, default: '' }, // for interviewers
    designation: { type: String, default: '' },
    password_hash: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    designation: this.designation,
  };
};

export default mongoose.model('User', userSchema);
