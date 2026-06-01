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

  console.log('[reporting] request', { range, since: since?.toISOString() })

  try {
    const [
      // KPIs (always month-to-date / point-in-time)
      kpiRevenueMtd,
      kpiActiveJobs,
      kpiOpenTickets,
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

      // Tickets
      ticketCounts,
      ticketAvgResolution,
      ticketsByPriority,

      // Team
      jobsPerMember,
      ticketsResolvedPerMember,

      // Revenue trend (always last 6 months)
      revenueByMonth,
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(total), 0)::float AS v FROM proposals
             WHERE status = 'Accepted' AND created_at >= date_trunc('month', NOW())`),
      query(`SELECT COUNT(*)::int AS v FROM jobs WHERE status IS NOT NULL AND status <> 'completed'`),
      query(`SELECT COUNT(*)::int AS v FROM support_tickets WHERE status <> 'Resolved'`),
      query(`SELECT COUNT(*)::int AS v FROM clients WHERE created_at >= date_trunc('month', NOW())`),

      query(`SELECT COUNT(*)::int AS v FROM jobs ${sinceWhere}`, sinceParam),
      query(`SELECT COALESCE(status, 'Unspecified') AS status, COUNT(*)::int AS count
             FROM jobs ${sinceWhere} GROUP BY 1 ORDER BY count DESC`, sinceParam),
      query(`SELECT COUNT(*)::int AS v FROM jobs
             WHERE status = 'completed' AND closed_at >= date_trunc('month', NOW())`),
      query(`SELECT COUNT(*)::int AS v FROM jobs
             WHERE status = 'completed'
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

      query(`SELECT
               COUNT(*) FILTER (WHERE status <> 'Resolved')::int AS open,
               COUNT(*) FILTER (WHERE status = 'Resolved')::int  AS closed
             FROM support_tickets ${sinceWhere}`, sinceParam),
      query(`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0)::float AS hours
             FROM support_tickets
             WHERE status = 'Resolved' AND resolved_at IS NOT NULL ${sinceAnd}`, sinceParam),
      query(`SELECT COALESCE(priority, 'Normal') AS priority, COUNT(*)::int AS count
             FROM support_tickets ${sinceWhere}
             GROUP BY 1 ORDER BY count DESC`, sinceParam),

      query(`SELECT initials, COUNT(*)::int AS count FROM (
               SELECT UNNEST(assigned) AS initials FROM jobs ${sinceWhere}
             ) sub GROUP BY initials ORDER BY count DESC`, sinceParam),
      query(`SELECT tm.name, tm.initials, COUNT(t.id)::int AS count
             FROM team_members tm
             LEFT JOIN support_tickets t ON t.assigned_to = tm.id
                                         AND t.status = 'Resolved'
                                         ${since ? 'AND t.created_at >= $1' : ''}
             GROUP BY tm.id, tm.name, tm.initials
             HAVING COUNT(t.id) > 0
             ORDER BY count DESC`, sinceParam),

      query(`SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
                    COALESCE(SUM(total), 0)::float AS total
             FROM proposals
             WHERE status = 'Accepted'
               AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
             GROUP BY 1
             ORDER BY 1`),
    ])

    res.json({
      range,
      since: since ? since.toISOString() : null,
      kpi: {
        revenue_mtd:    num(kpiRevenueMtd.rows[0]?.v),
        active_jobs:    num(kpiActiveJobs.rows[0]?.v),
        open_tickets:   num(kpiOpenTickets.rows[0]?.v),
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
      tickets: {
        open:   num(ticketCounts.rows[0]?.open),
        closed: num(ticketCounts.rows[0]?.closed),
        avg_resolution_hours: num(ticketAvgResolution.rows[0]?.hours),
        by_priority: ticketsByPriority.rows,
      },
      team: {
        jobs_per_member: jobsPerMember.rows,
        tickets_resolved_per_member: ticketsResolvedPerMember.rows,
      },
      revenue: {
        by_month: revenueByMonth.rows,
      },
    })
  } catch (err) {
    console.error('[reporting] error', { code: err?.code, message: err?.message, stack: err?.stack })
    next(err)
  }
})

export default router
