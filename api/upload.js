/**
 * Vercel Serverless Function — File upload proxy.
 * 
 * Supports two providers:
 *   - "imgur"  → Anonymous Imgur upload (images only, free unlimited)
 *   - "r2"    → Cloudflare R2 (any file type, 10GB free)
 * 
 * POST /api/upload
 * Body: multipart/form-data { file, folder?, provider? }
 *   provider = "imgur" (default for images) | "r2"
 * 
 * Response: { url, provider, size }
 * 
 * Environment variables:
 *   IMGUR_CLIENT_ID              — Imgur Anonymous API
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL  — Cloudflare R2
 */
export const config = { api: { bodyParser: false } };

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

    const { file, filename, mimeType, folder, provider: reqProvider } = parseMultipart(body, boundary);
    if (!file || !filename) return res.status(400).json({ error: 'No file uploaded' });

    // Validate file size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.length > MAX_SIZE) {
      return res.status(413).json({ error: `File too large. Max 25MB` });
    }

    // Auto-detect provider: images → imgur (if configured), else → r2
    const isImage = /^image\/(png|jpe?g|gif|webp|bmp|svg)/.test(mimeType || '');
    const provider = reqProvider || (isImage && process.env.IMGUR_CLIENT_ID ? 'imgur' : 'r2');

    if (provider === 'imgur') {
      return await handleImgur(req, res, file, mimeType, filename);
    } else {
      return await handleR2(req, res, file, mimeType, filename, folder);
    }

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

/* ── Imgur Anonymous Upload ─────────────────────────────────── */
async function handleImgur(req, res, file, mimeType, filename) {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'IMGUR_CLIENT_ID not configured' });
  }

  const imgurRes = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': `Client-ID ${clientId}`,
      'Content-Type': mimeType || 'image/png',
    },
    body: file,
  });

  if (!imgurRes.ok) {
    const errText = await imgurRes.text();
    console.error('Imgur upload failed:', imgurRes.status, errText);
    return res.status(500).json({ error: 'Imgur upload failed', detail: errText });
  }

  const data = await imgurRes.json();
  const url = data.data?.link;
  if (!url) {
    return res.status(500).json({ error: 'Imgur response missing link' });
  }

  return res.status(200).json({ url, provider: 'imgur', size: file.length });
}

/* ── Cloudflare R2 Upload ───────────────────────────────────── */
async function handleR2(req, res, file, mimeType, filename, folder) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return res.status(500).json({ error: 'R2 credentials not configured' });
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder || 'uploads'}/${Date.now()}_${sanitized}`;
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const shortDate = dateStamp.slice(0, 8);
  
  const { createHmac, createHash } = await import('crypto');
  
  const hash = (data) => createHash('sha256').update(data).digest('hex');
  const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
  
  const payloadHash = hash(file);
  const region = 'auto';
  const service = 's3';
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  
  const canonicalHeaders = [
    `content-type:${mimeType || 'application/octet-stream'}`,
    `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${dateStamp}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    'PUT',
    `/${R2_BUCKET_NAME}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    hash(canonicalRequest),
  ].join('\n');
  
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, shortDate), region), service),
    'aws4_request'
  );
  
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const uploadRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateStamp,
      'Authorization': authorization,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error('R2 upload failed:', uploadRes.status, errText);
    return res.status(500).json({ error: 'Upload to R2 failed', detail: errText });
  }

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;
  return res.status(200).json({ url: publicUrl, provider: 'r2', key, size: file.length });
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

  let file = null, filename = null, mimeType = null, folder = 'uploads', provider = '';

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
      } else if (fieldName === 'provider') {
        provider = content.toString().trim();
      }
    }
  }

  return { file, filename, mimeType, folder, provider };
}
