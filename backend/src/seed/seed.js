import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Position from '../models/Position.js';
import Grade from '../models/Grade.js';
import Competency from '../models/Competency.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { deptAbbrOf } from '../utils/helpers.js';
import { GRADES, ROSTER, COMPETENCIES, USERS, makeJobDescription } from './seedData.js';

// Positions went vacant on 26 Jun 2026 in Artifact A's data — kept so the
// aging-vacancy dashboard has real numbers on first run.
const VACANT_SINCE = new Date('2026-06-26T00:00:00');

export async function seedIfEmpty() {
  if (await Position.countDocuments()) return false;
  console.log('Empty database — seeding Centre Point Amravati roster…');

  await Grade.insertMany(GRADES);
  await Competency.insertMany(COMPETENCIES);

  for (const u of USERS) {
    await User.create({ ...u, password_hash: await bcrypt.hash(u.password, 10) });
  }

  // Expand the 26-designation roster into individual PCN seats (67 total),
  // driving the same UNIT-DEPT-GRADE-SERIAL counters used for new positions.
  const docs = [];
  for (const r of ROSTER) {
    const abbr = r.abbr || deptAbbrOf(r.dept);
    const key = `CPA-${abbr}-${r.grade}`;
    for (let n = 0; n < r.count; n++) {
      const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
      docs.push({
        pcn: `${key}-${String(c.seq).padStart(3, '0')}`,
        job_code: key,
        designation: r.desig,
        job_family: r.fam,
        grade: r.grade,
        department: r.dept,
        reports_to: r.reports,
        cost_centre: r.dept,
        salary_min: r.min,
        salary_max: r.max,
        budgeted_salary: r.max,
        status: 'Vacant',
        vacant_since: VACANT_SINCE,
        replacement_sla_days: r.crit ? 15 : 30,
        is_critical: r.crit,
        is_revenue_generating: r.rev,
        is_guest_facing: r.guest,
        job_description: makeJobDescription(r),
        competency_profile: r.fo || null,
        approver: r.grade === 'A1' ? 'Ownership' : 'General Manager',
      });
    }
  }
  await Position.insertMany(docs);
  console.log(`Seeded: ${docs.length} positions, ${GRADES.length} grades, ${COMPETENCIES.length} competencies, ${USERS.length} users.`);
  return true;
}

// Standalone: node src/seed/seed.js [--reset]
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed/seed.js')) {
  const { connectDB } = await import('../db.js');
  await connectDB();
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    console.log('Database dropped.');
  }
  const did = await seedIfEmpty();
  if (!did) console.log('Database not empty — nothing seeded. Use --reset to wipe and reseed.');
  await mongoose.disconnect();
}
