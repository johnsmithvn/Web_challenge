/**
 * Self-check for the api/ refactor (v4.25.0) — run: `node api/_lib/smoke.test.js`
 *
 * Covers the two claims the refactor makes but the frontend build cannot verify:
 *   1. `base64url` output === the old `.replace(/=/g,'')...` chain (JWT would break silently)
 *   2. `generateFileName()` format unchanged: LifeHub_<folder>_<yyyymmdd>_<HHMMSS>_<hex6>.<ext>
 *   3. RS256 sign/verify round-trip over a real generated key (crypto call path intact)
 *
 * Lives under `_lib/` so Vercel's file-based routing ignores it (no endpoint).
 */
import assert from 'node:assert/strict';
import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateFileName, MAX_UPLOAD_BYTES } from '../upload.js';

/* 1 — base64url === old manual chain */
const oldChain = (buf) =>
  buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

for (const sample of [
  { alg: 'RS256', typ: 'JWT' },
  { iss: 'sa@proj.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/drive' },
  { pad: 'a' },        // base64 length % 4 === 2 → two '=' to strip
  { pad: 'ab' },       // one '='
  { pad: 'abc' },      // none
  { s: '+/+/????' },   // forces both '+' and '/' in the base64 alphabet
]) {
  const buf = Buffer.from(JSON.stringify(sample));
  assert.equal(buf.toString('base64url'), oldChain(buf), `base64url mismatch: ${JSON.stringify(sample)}`);
}

/* 2 — filename format unchanged */
const name = generateFileName('holiday photo.JPEG', 'images');
assert.match(
  name,
  /^LifeHub_images_\d{8}_\d{6}_[0-9a-f]{6}\.JPEG$/,
  `unexpected filename shape: ${name}`,
);
assert.match(generateFileName('noext', 'uploads'), /^LifeHub_uploads_\d{8}_\d{6}_[0-9a-f]{6}\.bin$/);
assert.match(generateFileName('a.tar.gz', 'documents'), /_[0-9a-f]{6}\.gz$/);
assert.equal(MAX_UPLOAD_BYTES, 4 * 1024 * 1024, 'upload limit must fit inside Vercel 4.5 MB request cap');

const uploadSource = readFileSync(new URL('../upload.js', import.meta.url), 'utf8');
const streamSource = readFileSync(new URL('../stream.js', import.meta.url), 'utf8');
assert.ok((uploadSource.match(/supportsAllDrives=true/g) || []).length >= 3,
  'upload must opt into Shared Drive support for list/create/upload');
assert.ok((streamSource.match(/supportsAllDrives=true/g) || []).length >= 3,
  'stream must opt into Shared Drive support for list/get/media');
// hex is always 6 chars — Math.random() can produce short fractions, padStart guards it
for (let i = 0; i < 500; i++) {
  assert.match(generateFileName('x.mp3', 'audio'), /_[0-9a-f]{6}\.mp3$/);
}

/* 3 — RS256 sign/verify round-trip with base64url output */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const unsigned = `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from('{"iss":"x"}').toString('base64url')}`;
const sig = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
assert.ok(
  createVerify('RSA-SHA256').update(unsigned).verify(publicKey, Buffer.from(sig, 'base64url')),
  'RS256 signature did not verify',
);
assert.ok(!/[+/=]/.test(sig), 'signature must be URL-safe (no +, /, =)');

console.log('api smoke check: OK');
