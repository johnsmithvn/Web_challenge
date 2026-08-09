/**
 * Vercel Serverless Function — File upload proxy.
 * 
 * Supports Google Drive Service Account (images, audio, video, docs)
 * 
 * POST /api/upload
 * Body: multipart/form-data { file, folder? }
 * 
 * Response: { url, provider, id, size }
 * 
 * Environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON    — Google Service Account JSON string
 *   DRIVE_FOLDER_ID                — Google Drive Root Folder ID to upload to
 */
import { verifyAuth } from './_lib/verifyAuth.js';
import { getDriveToken, DRIVE_SCOPE_RW } from './_lib/driveToken.js';

export const config = { api: { bodyParser: false } };

// Global in-memory cache for folder IDs across hot serverless invocations
let folderCache = {};

// Whitelist of allowed upload subfolders — prevents Drive query injection via the
// user-controlled `folder` field. Anything else is coerced to 'uploads'.
const ALLOWED_FOLDERS = new Set(['images', 'audio', 'video', 'documents', 'uploads']);

// Vercel Functions cap the whole request body at 4.5 MB. Keep room for the
// multipart envelope and reject early locally instead of advertising 50 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;

// Allowed CORS origins (comma-separated env). Same-origin app calls (relative
// '/api/upload') don't need CORS at all; this only governs cross-origin access.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Require a valid Supabase session — block anonymous uploads to the owner's Drive.
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const declaredLength = Number(req.headers['content-length'] || 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return res.status(413).json({ error: 'File too large. Max 4 MB' });
    }

    const chunks = [];
    let received = 0;
    for await (const chunk of req) {
      received += chunk.length;
      if (received > MAX_REQUEST_BYTES) {
        return res.status(413).json({ error: 'File too large. Max 4 MB' });
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Missing multipart boundary' });

    const { file, filename, mimeType, folder } = parseMultipart(body, boundary);
    if (!file || !filename) return res.status(400).json({ error: 'No file uploaded' });

    // Coerce folder to the whitelist (defense-in-depth against Drive query injection)
    const safeFolder = ALLOWED_FOLDERS.has(folder) ? folder : 'uploads';

    if (file.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'File too large. Max 4 MB' });
    }

    return await handleDrive(req, res, file, mimeType, filename, safeFolder);

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

/* ── Google Drive Service Account Upload ───────────────────── */
// Get or Create Subfolder
async function getOrCreateSubfolder(accessToken, rootFolderId, folderName) {
  const cacheKey = `${rootFolderId}_${folderName}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  // Search if folder exists
  const query = `name='${folderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    const id = searchData.files[0].id;
    folderCache[cacheKey] = id;
    return id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId]
    })
  });
  
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create folder ${folderName}: ${errText}`);
  }

  const createData = await createRes.json();
  folderCache[cacheKey] = createData.id;
  return createData.id;
}

export function generateFileName(originalName, folder) {
  const ext = originalName.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'bin';
  // yyyymmddHHMMSS (UTC — Vercel functions run in UTC)
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

  // Example: LifeHub_images_20260523_161030_1a2b3c.jpg
  return `LifeHub_${folder}_${ts.slice(0, 8)}_${ts.slice(8)}_${hex}.${ext}`;
}

async function handleDrive(req, res, file, mimeType, originalFilename, folder) {
  const saJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const rootFolderId = process.env.DRIVE_FOLDER_ID;

  if (!saJsonStr || !rootFolderId) {
    return res.status(500).json({ error: 'Google Drive credentials not configured' });
  }

  try {
    const accessToken = await getDriveToken(DRIVE_SCOPE_RW);

    // Determine the target folder ID (Root vs Subfolder)
    let targetFolderId = rootFolderId;
    if (folder && folder !== 'uploads') {
      targetFolderId = await getOrCreateSubfolder(accessToken, rootFolderId, folder);
    }

    // Generate unique formatted filename
    const formattedFilename = generateFileName(originalFilename, folder || 'misc');
    
    // Create multipart body
    const boundary = 'kb_drive_boundary_' + Date.now();
    const metadata = {
      name: formattedFilename,
      parents: [targetFolderId]
    };

    const prefix = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) + `\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`);

    const payload = Buffer.concat([prefix, file, suffix]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': payload.length.toString()
      },
      body: payload
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Drive upload failed:', uploadRes.status, errText);
      return res.status(500).json({ error: 'Upload to Drive failed', detail: errText });
    }

    const data = await uploadRes.json();
    
    // Removed the per-file permission API call!
    // The user MUST set the Root Folder to "Viewer" for Anyone.
    // Files inside will automatically inherit it.

    let hash = '';
    if (mimeType && mimeType.startsWith('audio/')) {
      hash = '#audio';
    } else if (mimeType && mimeType.startsWith('video/')) {
      hash = '#video';
    }

    const url = `https://drive.google.com/uc?export=view&id=${data.id}${hash}`;
    return res.status(200).json({ url, provider: 'drive', id: data.id, size: file.length });

  } catch (err) {
    console.error('Drive upload exception:', err);
    return res.status(500).json({ error: 'Drive upload error', message: err.message });
  }
}

/* ── Multipart Parser ───────────────────────────────────────── */
function parseMultipart(body, boundary) {
  const sep = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = body.indexOf(sep, start);
    if (idx === -1) break;
    if (start > 0) {
      let partEnd = idx - 2;
      if (partEnd > start) parts.push(body.slice(start, partEnd));
    }
    start = idx + sep.length + 2;
  }

  let file = null, filename = null, mimeType = null, folder = 'uploads';

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    
    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);

    const nameMatch = headers.match(/name="([^"]+)"/);
    const fileMatch = headers.match(/filename="([^"]+)"/);
    const typeMatch = headers.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (fileMatch && !file) {
        file = content;
        filename = fileMatch[1];
        mimeType = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';
        // Sanitize: reject anything that isn't a clean type/subtype (prevents CRLF/header
        // injection into the outgoing Drive multipart body).
        if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) mimeType = 'application/octet-stream';
      } else if (fieldName === 'folder') {
        folder = content.toString().trim() || 'uploads';
      }
    }
  }

  return { file, filename, mimeType, folder };
}
