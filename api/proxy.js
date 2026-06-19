// /api/proxy.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  const allowedDomains = [
    'tikwm.com', 'www.tikwm.com',
    'tiktokcdn.com', 'tiktokv.com', 'tiktok.com',
    'muscdn.com', 'musical.ly',
    'cdninstagram.com', 'instagram.com',
    'googlevideo.com', 'ytimg.com',
    'nichind.dev', 'dwnld.nichind.dev',
  ];

  let parsedUrl;
  try { parsedUrl = new URL(url); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const hostname = parsedUrl.hostname;
  const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!isAllowed) return res.status(403).json({ error: `Domain tidak diizinkan: ${hostname}` });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': '*/*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const safeFilename = filename ? encodeURIComponent(filename) : 'video.mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    // Penting untuk streaming video besar
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream langsung tanpa buffer seluruh file di memory
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();

  } catch (err) {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal fetch: ' + err.message });
    }
  }
}
