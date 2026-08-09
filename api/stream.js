/**
 * Vercel Serverless Function — Google Drive audio/media stream proxy.
 *
 * Proxies media files from Google Drive through our server to bypass CORS restrictions,
 * enabling custom HTML5 audio/video players instead of ugly Drive iframes.
 *
 * GET /api/stream?id={driveFileId}
 *
 * Supports Range headers for seeking.
 * Reuses the same Service Account credentials as /api/upload.
 *
 * Security posture:
 *   - The proxy ONLY serves files that live inside DRIVE_FOLDER_ID (the app's upload
 *     root) or one of its immediate subfolders. This prevents an anonymous caller from
 *     using the service account as an open read-oracle for arbitrary Drive file IDs (IDOR).
 *   - CORS is restricted to ALLOWED_ORIGIN (same-origin <audio src> never needs CORS).
 *   - Per-IP rate limiting guards against bandwidth/egress abuse.
 *
 * Environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — Google Service Account JSON string
 *   DRIVE_FOLDER_ID             — root folder the app uploads into (authorization boundary)
 *   ALLOWED_ORIGIN              — comma-separated allowed CORS origins (optional)
 */

import { getDriveToken, DRIVE_SCOPE_RO } from './_lib/driveToken.js';

// Authorization caches (per warm instance)
let allowedFolders = null;        // Set<string> of folder IDs (root + immediate subfolders)
let allowedFoldersExpiry = 0;
const fileAuthCache = new Map();  // fileId -> expiry timestamp (authorized files; re-validated after TTL)
const FILE_AUTH_TTL = 5 * 60 * 1000;

// Simple per-IP token-bucket rate limiter (per warm instance)
const rateBuckets = new Map();    // ip -> { tokens, last }
const RATE_CAPACITY = 100;        // burst
const RATE_REFILL_PER_SEC = 2;    // sustained
const RATE_MAX_KEYS = 5000;       // bound memory against IP churn / spoofed X-Forwarded-For

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Content-Type, Accept-Ranges');
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function evictFullBuckets(now) {
  for (const [k, v] of rateBuckets) {
    const refilled = Math.min(RATE_CAPACITY, v.tokens + ((now - v.last) / 1000) * RATE_REFILL_PER_SEC);
    if (refilled >= RATE_CAPACITY) rateBuckets.delete(k); // idle bucket — safe to drop
  }
  if (rateBuckets.size >= RATE_MAX_KEYS) rateBuckets.clear(); // hard reset fallback
}

function rateLimit(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b) {
    if (rateBuckets.size >= RATE_MAX_KEYS) evictFullBuckets(now);
    b = { tokens: RATE_CAPACITY, last: now };
    rateBuckets.set(ip, b);
  }
  // refill
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + elapsed * RATE_REFILL_PER_SEC);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// Build the set of authorized folder IDs: the app root + its immediate subfolders
// (upload.js creates per-type subfolders such as images/audio/video/documents).
async function getAllowedFolders(accessToken, rootId) {
  const now = Date.now();
  if (allowedFolders && now < allowedFoldersExpiry) return allowedFolders;

  const set = new Set([rootId]);
  const q = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  let ok = false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      for (const f of data.files || []) set.add(f.id);
      ok = true;
    }
  } catch { /* transient error — do not cache a degraded set */ }

  if (ok) {
    allowedFolders = set;
    allowedFoldersExpiry = now + 5 * 60 * 1000; // 5 min
    return set;
  }
  // On failure, prefer the last-known-good set over a degraded root-only set,
  // and do NOT cache, so the next request retries.
  return allowedFolders || set;
}

// Authorize the requested file: it must have a parent inside the allowed folder set.
async function isFileAuthorized(accessToken, fileId, rootId) {
  const cachedExp = fileAuthCache.get(fileId);
  if (cachedExp && Date.now() < cachedExp) return true;

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) }
  );
  if (!metaRes.ok) return false;

  const meta = await metaRes.json();
  const parents = meta.parents || [];
  const allowed = await getAllowedFolders(accessToken, rootId);
  const ok = parents.some(p => allowed.has(p));
  if (ok) fileAuthCache.set(fileId, Date.now() + FILE_AUTH_TTL);
  else fileAuthCache.delete(fileId);
  return ok;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const fileId = req.query.id;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Missing or invalid file ID' });
  }

  const rootFolderId = process.env.DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    // Fail closed: without the authorization boundary we cannot safely proxy.
    return res.status(500).json({ error: 'DRIVE_FOLDER_ID not configured' });
  }

  try {
    const accessToken = await getDriveToken(DRIVE_SCOPE_RO);

    // Authorization: only serve files that live under the app's Drive folder.
    const authorized = await isFileAuthorized(accessToken, fileId, rootFolderId);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Build request to Google Drive API
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };

    // Forward Range header for seeking support
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const driveRes = await fetch(driveUrl, { headers });

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.error('Drive stream error:', driveRes.status, errText);
      return res.status(driveRes.status).json({
        error: 'Failed to stream from Drive',
        status: driveRes.status,
      });
    }

    // Forward response headers
    const contentType = driveRes.headers.get('content-type') || 'application/octet-stream';
    const contentLength = driveRes.headers.get('content-length');
    const contentRange = driveRes.headers.get('content-range');
    const acceptRanges = driveRes.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
    // Private browser-cache directive only; possession of the Drive URL/file ID
    // still grants read access under the documented Anyone-with-link setup.
    res.setHeader('Cache-Control', 'private, max-age=600');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    // Status: 206 Partial Content for range requests, 200 otherwise
    const statusCode = driveRes.status === 206 ? 206 : 200;
    res.status(statusCode);

    // Pipe the stream, cancelling upstream read if the client disconnects.
    const reader = driveRes.body.getReader();
    let aborted = false;
    let onClosed;
    const closed = new Promise(resolve => { onClosed = resolve; });
    req.on('close', () => {
      aborted = true;
      reader.cancel().catch(() => {});
      onClosed();
    });

    const pump = async () => {
      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) {
          // Respect backpressure: wait until the buffer drains (or the client leaves).
          // `closed` is a single shared promise — no per-iteration listener leak.
          await Promise.race([
            new Promise(resolve => res.once('drain', resolve)),
            closed,
          ]);
        }
      }
      if (!aborted) res.end();
    };

    await pump();

  } catch (err) {
    console.error('Stream proxy error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Stream proxy error', message: err.message });
    }
  }
}
