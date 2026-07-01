// Client-side "stuck try-on" heuristic, shared by GenerationDetail and
// TryOnHistory so both views agree on when a still-'pending' doc should read
// as failed (retry/delete affordance instead of an eternal spinner).
//
// The authoritative flip is server-side (functions/tryon.js cleanupStuckTryons,
// 15-min TTL). This client threshold is deliberately shorter so the user sees a
// way out sooner; virtualTryOn's hard ceiling is 180s, so 5 min never trips a
// legitimately in-flight run.
export const STUCK_TRYON_MS = 5 * 60 * 1000;

export function tryonCreatedMs(gen) {
  return gen?.createdAt?.toMillis?.()
    || gen?.createdAt?.toDate?.()?.getTime?.()
    || (gen?.createdAt ? new Date(gen.createdAt).getTime() : 0);
}

// A long-'pending' doc reads as 'failed'; everything else passes through.
export function effectiveTryonStatus(gen, now = Date.now()) {
  const status = gen?.status || 'unknown';
  if (status !== 'pending') return status;
  const ms = tryonCreatedMs(gen);
  return ms && (now - ms > STUCK_TRYON_MS) ? 'failed' : status;
}
