import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Position from '../models/Position.js';
import Grade from '../models/Grade.js';
import Competency from '../models/Competency.js';
import User, { migrateRoles } from '../models/User.js';
import Counter from '../models/Counter.js';
import PanelRule from '../models/PanelRule.js';
import { deptAbbrOf } from '../utils/helpers.js';
import { GRADES, ROSTER, COMPETENCIES, USERS, makeJobDescription } from './seedData.js';
import { PANEL_USERS, PANEL_RULES } from './panelData.js';

// Shared default for every seeded panellist login. Override per environment.
const PANEL_PASSWORD = process.env.SEED_PANEL_PASSWORD || 'panel@2026';

/* Creates the interviewer logins from Interview_Panel.xlsx and the fixed panel
   matrix that maps unit + grade + department → who takes each round.

   Runs independently of the position seed so the panel can be refreshed on an
   existing database. Existing users are matched by email and never overwritten —
   a password changed in production survives a re-run. */
export async function seedPanel() {
  await migrateRoles();

  const idByKey = {};
  let created = 0;
  let regranted = 0;
  for (const p of PANEL_USERS) {
    const email = p.email.toLowerCase();
    const roles = p.hr ? ['interviewer', 'hr_admin'] : ['interviewer'];
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: p.name,
        email,
        roles,
        department: p.department || '',
        designation: p.designation || '',
        password_hash: await bcrypt.hash(PANEL_PASSWORD, 10),
      });
      created += 1;
    } else {
      // Roles are additive on an existing account: grant what the panel sheet says
      // this person needs without disturbing anything HR has added by hand.
      const missing = roles.filter((r) => !user.roles.includes(r));
      if (missing.length) {
        user.roles = [...user.roles, ...missing];
        await user.save();
        regranted += 1;
      }
    }
    idByKey[p.key] = user._id;
  }

  // Rules are fully rebuilt: the workbook is the source of truth for them.
  await PanelRule.deleteMany({});
  const docs = [];
  for (const r of PANEL_RULES) {
    const rounds = r.rounds
      .filter((s) => idByKey[s.key])
      .map((s) => ({
        round: s.round,
        interviewer_user_id: idByKey[s.key],
        alternates: s.alternates.map((k) => idByKey[k]).filter(Boolean),
      }));
    if (rounds.length) {
      docs.push({ unit_code: r.unit, grade: r.grade, department: r.dept, dept_code: r.dept_code, rounds });
    }
  }
  await PanelRule.insertMany(docs);
  const hrCount = PANEL_USERS.filter((p) => p.hr).length;
  console.log(
    `Panel: ${created} new login(s) of ${PANEL_USERS.length}` +
    (regranted ? `, ${regranted} re-granted` : '') +
    `, ${hrCount} with HR Panel access, ${docs.length} panel rules.`
  );
  return { users: created, rules: docs.length };
}

// Positions went vacant on 26 Jun 2026 in Artifact A's data — kept so the
// aging-vacancy dashboard has real numbers on first run.
const VACANT_SINCE = new Date('2026-06-26T00:00:00');

export async function seedIfEmpty() {
  // The panel is kept current even on an already-populated database, so adding a
  // unit or fixing an email in panelData.js takes effect on the next boot.
  await seedPanel();

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
