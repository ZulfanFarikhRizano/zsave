// /api/proxy.js — Vercel Serverless Function
// Proxy download video supaya tidak kena CORS block di browser

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  // Validasi domain yang diizinkan
  const allowedDomains = [
    'tikwm.com',
    'www.tikwm.com',
    'tiktokcdn.com',
    'tiktokv.com',
    'tiktok.com',
    'cdninstagram.com',
    'instagram.com',
    'googlevideo.com',
    'ytimg.com',
    'nichind.dev',
    'dwnld.nichind.dev',
  ];

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const hostname = parsedUrl.hostname;
  const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!isAllowed) return res.status(403).json({ error: `Domain tidak diizinkan: ${hostname}` });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream response langsung ke client
    const buffer = await response.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Gagal fetch dari server: ' + err.message });
  }
}
