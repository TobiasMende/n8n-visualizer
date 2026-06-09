export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', 'nuxt-security', '@nuxt/eslint'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/tokens.css', '@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],
  typescript: { strict: true },
  devtools: { enabled: true },
  security: {
    // Server-proxy model: the browser only ever talks to our own origin, so
    // connect-src stays tight. The arbitrary n8n host is reached server-side.
    headers: {
      contentSecurityPolicy: {
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        // Vue Flow injects inline styles for node positioning.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
      crossOriginEmbedderPolicy: 'unsafe-none',
    },
    // Header-level size cap (honest clients). The handlers additionally enforce
    // a streaming cap to also bound chunked requests, which this misses.
    requestSizeLimiter: {
      maxRequestSizeInBytes: 5_000_000,
      maxUploadFileRequestInBytes: 5_000_000,
    },
    // Disabled: it consumes the request body (breaking our streaming reader) and
    // can reject/mutate legitimate workflow JSON. XSS is covered by CSP + the
    // href guard + Vue's escaping instead.
    xssValidator: false,
  },
})
