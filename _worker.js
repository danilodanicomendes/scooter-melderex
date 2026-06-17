/**
 * Cloudflare Pages Worker — proxy /api/* → https://scooter-melder.de/*
 *
 * Key challenge: Laravel uses two cookies for CSRF:
 *   - XSRF-TOKEN (readable by JS)
 *   - scooter_melderde_session (HttpOnly)
 * Both are set with Domain=scooter-melder.de, so the browser ignores them
 * when served from pages.dev. We rewrite Set-Cookie headers to remove the
 * Domain attribute so the browser stores them under our domain instead.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const targetPath = url.pathname.slice('/api'.length) || '/';
      const targetUrl  = 'https://scooter-melder.de' + targetPath + url.search;

      // Forward request headers, spoof origin so Laravel accepts us
      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('Host',    'scooter-melder.de');
      reqHeaders.set('Origin',  'https://scooter-melder.de');
      reqHeaders.set('Referer', 'https://scooter-melder.de/');

      const proxyReq = new Request(targetUrl, {
        method:   request.method,
        headers:  reqHeaders,
        body:     ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual', // return 302 as-is; client treats it as success
      });

      const response = await fetch(proxyReq);

      // Build response headers — rewrite Set-Cookie to remove Domain restriction
      const resHeaders = new Headers();

      for (const [key, value] of response.headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
          // Strip Domain=..., SameSite=Strict/Lax (replace with None), add Secure
          const rewritten = value
            .replace(/;\s*Domain=[^;]*/gi, '')
            .replace(/;\s*SameSite=\w+/gi, '; SameSite=None')
            .replace(/;\s*Secure/gi, '')   // remove first, then re-add once
            + '; Secure';
          resHeaders.append('Set-Cookie', rewritten);
        } else {
          resHeaders.append(key, value);
        }
      }

      resHeaders.set('Access-Control-Allow-Origin',      request.headers.get('Origin') || '*');
      resHeaders.set('Access-Control-Allow-Credentials', 'true');

      return new Response(response.body, {
        status:  response.status,
        headers: resHeaders,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
