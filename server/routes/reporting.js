import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

// Range filter — covers count-based metrics. KPIs (always MTD) and the
// 6-month revenue trend ignore this and use their own fixed windows.
function rangeStart(range) {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  switch (range) {
    case '30d': return new Date(now - 30 * day)
    case '90d': return new Date(now - 90 * day)
    case 'ytd': return new Date(new Date().getFullYear(), 0, 1)
    case 'all':
    default:    return null
  }
}

function num(v) {
  return v == null ? 0 : Number(v)
}

router.get('/', async (req, res, next) => {
  const range = (req.query.range || 'all').toString()
  const since = rangeStart(range)
  const sinceParam = since ? [since] : []
  const sinceWhere = since ? 'WHERE created_at >= $1' : ''
  const sinceAnd = since ? 'AND created_at >= $1' : ''
  // time_entries range filter keys off the punch-in time, not created_at.
  const teWhere = since ? 'WHERE te.clock_in_at >= $1' : ''
  // Job metrics count native jobs only: imported history (source_system set)
  // is reference data, never live work. Mirrors isLiveJob in src/lib/jobs.js.
  const liveJobsWhere = `WHERE source_system IS NULL ${sinceAnd}`

  console.log('[reporting] request', { range, since: since?.toISOString() })

  try {
    const [
      // KPIs (always month-to-date / point-in-time)
      kpiRevenueMtd,
      kpiActiveJobs,
      kpiNewClientsMtd,

      // Jobs (range-dependent counts; total value/avg from proposals)
      jobsTotal,
      jobsByStatus,
      jobsClosedThisMonth,
      jobsClosedLastMonth,
      proposalValueAgg,

      // Clients
      clientsTotal,
      clientsNewThisMonth,
      topClientsByValue,

      // Team
      jobsPerMember,

      // Revenue trend (always last 6 months)
      revenueByMonth,

      // Labor / time-on-site (from time_entries)
      laborByJob,
      laborTotals,
      utilizationByMember,
      hourlyRateRow,
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(total), 0)::float AS v FROM proposals
             WHERE status = 'Accepted' AND created_at >= date_trunc('month', NOW())`),
      query(`SELECT COUNT(*)::int AS v FROM jobs
             WHERE source_system IS NULL AND status IN ('scheduled', 'in_progress')`),
      query(`SELECT COUNT(*)::int AS v FROM clients WHERE created_at >= date_trunc('month', NOW())`),

      query(`SELECT COUNT(*)::int AS v FROM jobs ${liveJobsWhere}`, sinceParam),
      query(`SELECT COALESCE(status, 'Unspecified') AS status, COUNT(*)::int AS count
             FROM jobs ${liveJobsWhere} GROUP BY 1 ORDER BY count DESC`, sinceParam),
      query(`SELECT COUNT(*)::int AS v FROM jobs
             WHERE source_system IS NULL
               AND status = 'completed' AND closed_at >= date_trunc('month', NOW())`),
      query(`SELECT COUNT(*)::int AS v FROM jobs
             WHERE source_system IS NULL AND status = 'completed'
               AND closed_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
               AND closed_at <  date_trunc('month', NOW())`),
      query(`SELECT COALESCE(SUM(total), 0)::float AS total_value,
                    COALESCE(AVG(total), 0)::float  AS avg_value
             FROM proposals
             WHERE status = 'Accepted' ${sinceAnd}`, sinceParam),

      query(`SELECT COUNT(*)::int AS v FROM clients ${sinceWhere}`, sinceParam),
      query(`SELECT COUNT(*)::int AS v FROM clients WHERE created_at >= date_trunc('month', NOW())`),
      query(`SELECT c.id, c.name, COALESCE(SUM(p.total), 0)::float AS value
             FROM clients c
             LEFT JOIN proposals p ON p.client_id = c.id AND p.status = 'Accepted'
             GROUP BY c.id, c.name
             HAVING COALESCE(SUM(p.total), 0) > 0
             ORDER BY value DESC
             LIMIT 5`),


      query(`SELECT initials, COUNT(*)::int AS count FROM (
               SELECT UNNEST(assigned) AS initials FROM jobs ${liveJobsWhere}
             ) sub GROUP BY initials ORDER BY count DESC`, sinceParam),

      query(`SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
                    COALESCE(SUM(total), 0)::float AS total
             FROM proposals
             WHERE status = 'Accepted'
               AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
             GROUP BY 1
             ORDER BY 1`),

      // Per-job actual on-site hours (open punches counted up to NOW) vs estimate.
      query(`SELECT j.id, j.name,
                    j.estimated_hours::float AS estimated_hours,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600), 0)::float AS actual_hours
             FROM time_entries te
             JOIN jobs j ON j.id = te.job_id
             ${teWhere}
             GROUP BY j.id, j.name, j.estimated_hours
             HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600), 0) > 0
             ORDER BY actual_hours DESC
             LIMIT 25`, sinceParam),
      query(`SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600), 0)::float AS total_hours,
                    COUNT(*) FILTER (WHERE te.clock_out_at IS NULL)::int AS open_punches
             FROM time_entries te ${teWhere}`, sinceParam),
      query(`SELECT tm.name, tm.initials,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600), 0)::float AS hours
             FROM time_entries te
             JOIN team_members tm ON tm.id = te.employee_id
             ${teWhere}
             GROUP BY tm.id, tm.name, tm.initials
             HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600), 0) > 0
             ORDER BY hours DESC`, sinceParam),
      query(`SELECT COALESCE(default_hourly_rate, 0)::float AS rate FROM settings WHERE id = 1`),
    ])

    const hourlyRate = num(hourlyRateRow.rows[0]?.rate)
    const laborJobs = laborByJob.rows.map(j => ({
      job_id: j.id,
      name: j.name,
      actual_hours: num(j.actual_hours),
      estimated_hours: j.estimated_hours == null ? null : num(j.estimated_hours),
      cost: num(j.actual_hours) * hourlyRate,
    }))
    const totalHours = num(laborTotals.rows[0]?.total_hours)

    res.json({
      range,
      since: since ? since.toISOString() : null,
      kpi: {
        revenue_mtd:    num(kpiRevenueMtd.rows[0]?.v),
        active_jobs:    num(kpiActiveJobs.rows[0]?.v),
        new_clients_mtd: num(kpiNewClientsMtd.rows[0]?.v),
      },
      jobs: {
        total: num(jobsTotal.rows[0]?.v),
        by_status: jobsByStatus.rows,
        total_proposal_value: num(proposalValueAgg.rows[0]?.total_value),
        avg_proposal_value:  num(proposalValueAgg.rows[0]?.avg_value),
        closed_this_month:  num(jobsClosedThisMonth.rows[0]?.v),
        closed_last_month:  num(jobsClosedLastMonth.rows[0]?.v),
      },
      clients: {
        total: num(clientsTotal.rows[0]?.v),
        new_this_month: num(clientsNewThisMonth.rows[0]?.v),
        top_by_value: topClientsByValue.rows,
      },
      team: {
        jobs_per_member: jobsPerMember.rows,
      },
      revenue: {
        by_month: revenueByMonth.rows,
      },
      labor: {
        hourly_rate: hourlyRate,
        total_hours: totalHours,
        total_cost: totalHours * hourlyRate,
        open_punches: num(laborTotals.rows[0]?.open_punches),
        by_job: laborJobs,
        utilization_by_member: utilizationByMember.rows.map(m => ({
          name: m.name, initials: m.initials, hours: num(m.hours),
        })),
      },
    })
  } catch (err) {
    console.error('[reporting] error', { code: err?.code, message: err?.message, stack: err?.stack })
    next(err)
  }
})

export default router
