// === Share-import (SPEC-1.6 §A, URL half) ==============================
// importFromUrl: the user shared a LINK (shop page, Pinterest pin, article)
// into drape. We fetch it server-side, find the primary image (og:image /
// twitter:image, or the URL itself if it's already an image), shrink it, and
// hand back a JPEG the client feeds into the normal analyze→register flow.
//
// Server-side on purpose: the browser can't fetch cross-origin pages, and a
// server fetch needs SSRF discipline — https only, public addresses only,
// every redirect hop re-validated, and hard size/time caps.

const dns = require('dns').promises;
const net = require('net');
const sharp = require('sharp');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const MAX_HTML = 1.5 * 1024 * 1024;   // page cap — og tags live in <head>
const MAX_IMG = 12 * 1024 * 1024;     // raw image cap before shrink
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

function privateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    return low === '::1' || low.startsWith('fc') || low.startsWith('fd')
      || low.startsWith('fe80') || low.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)   // link-local / cloud metadata
    || a >= 224;
}

async function assertPublicHttps(url) {
  let u;
  try { u = new URL(url); } catch { throw new HttpsError('invalid-argument', 'bad_url'); }
  if (u.protocol !== 'https:') throw new HttpsError('invalid-argument', 'https_only');
  const { address } = await dns.lookup(u.hostname).catch(() => ({ address: null }));
  if (!address || privateIp(address)) throw new HttpsError('invalid-argument', 'blocked_host');
  return u;
}

// fetch with manual redirects so every hop passes the SSRF check.
async function safeFetch(url, accept) {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = await assertPublicHttps(current);
    const res = await fetch(u, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept, 'user-agent': 'Mozilla/5.0 (compatible; drape-import/1.0)' },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new HttpsError('unavailable', 'bad_redirect');
      current = new URL(loc, u).href;
      continue;
    }
    if (!res.ok) throw new HttpsError('unavailable', `fetch_${res.status}`);
    return res;
  }
  throw new HttpsError('unavailable', 'too_many_redirects');
}

async function readCapped(res, cap) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) { reader.cancel().catch(() => {}); break; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function findOgImage(html, baseUrl) {
  // property/name order varies; scan a handful of common patterns.
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try { return new URL(m[1].replace(/&amp;/g, '&'), baseUrl).href; } catch { /* next */ }
    }
  }
  return null;
}

exports.importFromUrl = onCall(
  { cors: true, timeoutSeconds: 30, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const rawUrl = String(request.data?.url || '').trim().slice(0, 2000);
    if (!rawUrl) throw new HttpsError('invalid-argument', 'url_required');

    // 1) Is the URL itself an image?
    let imgBuf = null;
    let pageTitle = '';
    const first = await safeFetch(rawUrl, 'text/html,image/*');
    const ctype = (first.headers.get('content-type') || '').toLowerCase();
    if (ctype.startsWith('image/')) {
      imgBuf = await readCapped(first, MAX_IMG);
    } else {
      // 2) HTML page → og:image.
      const html = (await readCapped(first, MAX_HTML)).toString('utf8');
      pageTitle = (html.match(/<title[^>]*>([^<]{1,200})/i)?.[1] || '').trim();
      const ogUrl = findOgImage(html, first.url || rawUrl);
      if (!ogUrl) throw new HttpsError('not-found', 'no_image');
      const imgRes = await safeFetch(ogUrl, 'image/*');
      imgBuf = await readCapped(imgRes, MAX_IMG);
    }
    if (!imgBuf?.length) throw new HttpsError('not-found', 'no_image');

    // Shrink to analyze-friendly size; JPEG keeps the callable response small.
    let jpeg;
    try {
      jpeg = await sharp(imgBuf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 84 }).toBuffer();
    } catch {
      throw new HttpsError('invalid-argument', 'not_an_image');
    }
    return {
      imageBase64: jpeg.toString('base64'),
      contentType: 'image/jpeg',
      title: pageTitle,
      sourceUrl: rawUrl,
    };
  },
);
