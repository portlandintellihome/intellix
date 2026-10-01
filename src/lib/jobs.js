// Imported history (e.g. the Housecall export) is reference data, not live
// work. It stays on each client's record (GET /api/clients/:id/jobs) but must
// never count toward or appear in operational job views. Matched on
// source_system being set at all rather than a specific literal, so future
// imports are covered too. Server-side equivalent: `source_system IS NULL`.
export function isLiveJob(job) {
  return Boolean(job) && !job.source_system
}

// "Active" everywhere = native scheduled + in_progress (same as the Jobs tab).
export const ACTIVE_STATUSES = ['scheduled', 'in_progress']
