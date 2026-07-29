/**
 * Shared Google Drive access-token helper for Vercel serverless functions.
 *
 * Signs a Service Account JWT and exchanges it for an OAuth access token.
 * Files/dirs prefixed with `_` are ignored by Vercel's file-based routing,
 * so this is NOT exposed as an endpoint.
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — Google Service Account JSON string
 */
import { createSign } from 'node:crypto';

/** Drive OAuth scopes — upload needs write, the stream proxy only needs read. */
export const DRIVE_SCOPE_RW = 'https://www.googleapis.com/auth/drive';
export const DRIVE_SCOPE_RO = 'https://www.googleapis.com/auth/drive.readonly';

// Token cache per scope, reused across hot invocations (token valid 1h).
// Keyed by scope on purpose: handing a readonly token to the upload path would
// fail every upload with a confusing 403.
const cache = new Map(); // scope -> { token, expiry }

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

/**
 * @param {string} scope — DRIVE_SCOPE_RW or DRIVE_SCOPE_RO
 * @returns {Promise<string>} access token
 */
export async function getDriveToken(scope) {
  const now = Date.now();
  const hit = cache.get(scope);
  if (hit && now < hit.expiry) return hit.token;

  const saJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJsonStr) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');

  const sa = JSON.parse(saJsonStr);
  const nowSec = Math.floor(now / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSec + 3600,
    iat: nowSec,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}`,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Failed to get Google token');

  cache.set(scope, { token: data.access_token, expiry: now + 3500 * 1000 }); // refresh 100s early
  return data.access_token;
}
