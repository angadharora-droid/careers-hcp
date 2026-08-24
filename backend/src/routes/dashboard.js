import { Router } from 'express';
import Position, { POSITION_STATUSES } from '../models/Position.js';
import Application, { STAGES } from '../models/Application.js';
import PanelScore from '../models/PanelScore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { daysVacant, slaBreached } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

// GET /api/dashboard/summary — all aging/SLA math recomputed server-side
router.get('/summary', async (_req, res) => {
  const positions = await Position.find({});
  const apps = await Application.find({});

  const byStatus = Object.fromEntries(POSITION_STATUSES.map((s) => [s, 0]));
  positions.forEach((p) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

  const live = positions.filter((p) => p.status !== 'Eliminated');
  const vacant = positions.filter((p) => p.status === 'Vacant');
  const dvs = vacant.map(daysVacant).filter((x) => x != null);
  const aging = vacant
    .map((p) => ({
      pcn: p.pcn, job_code: p.job_code, designation: p.designation, department: p.department,
      grade: p.grade, is_critical: p.is_critical, days_vacant: daysVacant(p),
      replacement_sla_days: p.replacement_sla_days, sla_breached: slaBreached(p),
    }))
    .filter((x) => x.days_vacant != null)
    .sort((a, b) => b.days_vacant - a.days_vacant);

  const departments = [...new Set(positions.map((p) => p.department))].map((d) => {
    const dp = positions.filter((p) => p.department === d);
    return {
      department: d,
      total: dp.length,
      filled: dp.filter((p) => p.status === 'Filled').length,
      under_recruitment: dp.filter((p) => p.status === 'Under Recruitment').length,
      vacant: dp.filter((p) => p.status === 'Vacant').length,
      frozen_or_hold: dp.filter((p) => ['Frozen', 'On Hold'].includes(p.status)).length,
      // The department's sanctioned monthly salary band, summed across its seats.
      band_min: dp.reduce((s, p) => s + (p.salary_min || 0), 0),
      band_max: dp.reduce((s, p) => s + (p.salary_max || 0), 0),
    };
  });

  const pipeline = Object.fromEntries(STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length]));
  const flaggedIds = await PanelScore.distinct('application_id', { 'red_flags.0': { $exists: true } });

  /* Average time to fill — how long a seat took from falling vacant to a candidate
     being selected into it. Only seats currently filled through this system carry
     the stamp, so `filled_measured` reports how many rows the average stands on. */
  const fillTimes = live.map((p) => p.days_to_fill).filter((n) => typeof n === 'number');

  res.json({
    positions_total: positions.length,
    by_status: byStatus,
    // The sanctioned monthly salary band across every live seat.
    band_min_total: live.reduce((s, p) => s + (p.salary_min || 0), 0),
    band_max_total: live.reduce((s, p) => s + (p.salary_max || 0), 0),
    avg_days_to_fill: fillTimes.length ? Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length) : 0,
    filled_measured: fillTimes.length,
    avg_days_vacant: dvs.length ? Math.round(dvs.reduce((a, b) => a + b, 0) / dvs.length) : 0,
    sla_breached_count: vacant.filter(slaBreached).length,
    aging_vacancies: aging,
    departments,
    applications_total: apps.length,
    pipeline,
    red_flag_queue_count: flaggedIds.length,
  });
});

export default router;
