// /api/proxy.js — Vercel Serverless Proxy
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const allowedDomains = [
    'tikwm.com', 'www.tikwm.com',
    'tiktokcdn.com', 'tiktokv.com', 'tiktok.com',
    'muscdn.com', 'musical.ly', 'akamaized.net',
    'cdninstagram.com', 'instagram.com', 'fbcdn.net',
    'googlevideo.com', 'ytimg.com',
    'nichind.dev', 'dwnld.nichind.dev',
  ];

  let parsedUrl;
  try { parsedUrl = new URL(decodeURIComponent(url)); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const hostname = parsedUrl.hostname;
  const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!isAllowed) return res.status(403).json({ error: `Domain not allowed: ${hostname}` });

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'video/mp4,video/*,*/*',
        'Accept-Encoding': 'identity', // jangan gzip supaya stream bisa langsung
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const ct = upstream.headers.get('content-type') || 'video/mp4';
    const cl = upstream.headers.get('content-length');
    const safeFilename = filename || 'video.mp4';

    // Header penting: Content-Disposition attachment supaya browser save, bukan buka
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Cache-Control', 'no-store, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (cl) res.setHeader('Content-Length', cl);

    // Stream chunk by chunk
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();

  } catch (err) {
    console.error('[proxy error]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
