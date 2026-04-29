/**
 * Vercel Edge Function — OG Metadata Fetcher
 * GET /api/meta?url=https://example.com
 *
 * Returns: { title, image, desc, blocked }
 * Graceful fallback: 403/4xx/5xx/timeout → { blocked: true }
 */
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return Response.json({ error: 'missing_url' }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return Response.json({ error: 'invalid_url' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
      redirect: 'follow',
    });

    // Graceful fallback: non-OK → empty, not error
    if (!res.ok) {
      return Response.json({ title: '', image: '', desc: '', blocked: true });
    }

    const html = await res.text();

    // Extract metadata with regex (edge runtime — no DOM parser)
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '';
    const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1]?.trim()
      ?? html.match(/property='og:title'\s+content='([^']+)'/i)?.[1]?.trim()
      ?? '';
    const image = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
      ?? html.match(/property='og:image'\s+content='([^']+)'/i)?.[1]
      ?? '';
    const desc = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]
      ?? html.match(/property='og:description'\s+content='([^']+)'/i)?.[1]
      ?? html.match(/name="description"\s+content="([^"]+)"/i)?.[1]
      ?? '';

    return Response.json({
      title: ogTitle || title,
      image,
      desc,
      blocked: false,
    });
  } catch {
    // Network error, timeout → safe fallback
    return Response.json({ title: '', image: '', desc: '', blocked: true });
  }
}
