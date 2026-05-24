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
export const config = { api: { bodyParser: false } };

// Global in-memory cache for folder IDs across hot serverless invocations
let folderCache = {};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Missing multipart boundary' });

    const { file, filename, mimeType, folder } = parseMultipart(body, boundary);
    if (!file || !filename) return res.status(400).json({ error: 'No file uploaded' });

    // Validate file size (max 50MB for Drive)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.length > MAX_SIZE) {
      return res.status(413).json({ error: `File too large. Max 50MB` });
    }

    return await handleDrive(req, res, file, mimeType, filename, folder);

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

/* ── Google Drive Service Account Upload ───────────────────── */
async function getDriveToken(serviceAccountJson) {
  const crypto = await import('crypto');
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsigned}.${signature}`;
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Failed to get Google Token');
  return data.access_token;
}

// Get or Create Subfolder
async function getOrCreateSubfolder(accessToken, rootFolderId, folderName) {
  const cacheKey = `${rootFolderId}_${folderName}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  // Search if folder exists
  const query = `name='${folderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    const id = searchData.files[0].id;
    folderCache[cacheKey] = id;
    return id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
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

function generateFileName(originalName, folder) {
  const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'bin';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  
  // Example: LifeHub_images_20260523_161030_1a2b3c.jpg
  return `LifeHub_${folder}_${yyyy}${mm}${dd}_${HH}${MM}${SS}_${hex}.${ext}`;
}

async function handleDrive(req, res, file, mimeType, originalFilename, folder) {
  const saJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const rootFolderId = process.env.DRIVE_FOLDER_ID;

  if (!saJsonStr || !rootFolderId) {
    return res.status(500).json({ error: 'Google Drive credentials not configured' });
  }

  try {
    const accessToken = await getDriveToken(saJsonStr);
    
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

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
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
      } else if (fieldName === 'folder') {
        folder = content.toString().trim() || 'uploads';
      }
    }
  }

  return { file, filename, mimeType, folder };
}
