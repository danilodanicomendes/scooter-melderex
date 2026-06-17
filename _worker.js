/**
 * Cloudflare Pages Worker — proxy /api/* → https://scooter-melder.de/*
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      // Strip /api prefix: /api/submit → /submit, /api/getCompanies → /getCompanies
      const targetPath = url.pathname.slice('/api'.length);
      const targetUrl  = 'https://scooter-melder.de' + targetPath + url.search;

      const headers = new Headers(request.headers);
      headers.set('Host', 'scooter-melder.de');
      headers.set('Origin', 'https://scooter-melder.de');
      headers.set('Referer', 'https://scooter-melder.de/');

      const proxyRequest = new Request(targetUrl, {
        method:  request.method,
        headers: headers,
        body:    request.method !== 'GET' && request.method !== 'HEAD'
                   ? request.body
                   : undefined,
        // Don't follow redirects — return the redirect response as-is.
        // The /submit endpoint redirects to /confirmation on success (302).
        // We treat any 3xx or 2xx as success on the client side.
        redirect: 'manual',
      });

      const response = await fetch(proxyRequest);

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');

      return new Response(response.body, {
        status:  response.status,
        headers: responseHeaders,
      });
    }

    // Serve static assets (index.html etc.)
    return env.ASSETS.fetch(request);
  },
};
