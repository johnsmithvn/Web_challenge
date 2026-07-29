/**
 * Shared auth helper for Vercel serverless functions.
 *
 * Verifies a Supabase access token (JWT) sent as `Authorization: Bearer <token>`
 * against the Supabase Auth REST endpoint. Files/dirs prefixed with `_` are
 * ignored by Vercel's file-based routing, so this is NOT exposed as an endpoint.
 *
 * Env (available to Vercel functions via process.env regardless of VITE_ prefix):
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 */
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * Extract a Bearer token from the request's Authorization header.
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verify the request's bearer token against Supabase Auth.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ id: string, email?: string } | null>} the authenticated user, or null
 */
export async function verifyAuth(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;

  try {
    // Capped so a hung Supabase request doesn't tie up the function until the
    // platform timeout.
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}
