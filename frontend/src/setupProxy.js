const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Read target from environment variable, fallback to local backend (5000)
  // Note: Docker backend runs on 8000, but local python dev runs on 5000.
  // Defaulting to 5000 solves issues where env var isn't loaded correctly in local dev.
  const target = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  console.log('='.repeat(60));
  console.log('🔧 Proxy Configuration');
  console.log('='.repeat(60));
  console.log('Target Backend:', target);
  console.log('Environment:', process.env.REACT_APP_ENVIRONMENT || 'production');
  console.log('Dev Mode:', process.env.REACT_APP_DEV_MODE || 'false');
  console.log('='.repeat(60));

  // IMPORTANT: Specific routes MUST come before catch-all routes
  // Proxy for Personal Assistant (development mode)
  // In dev mode, PA runs on port 6001, so we need to proxy /api/pa requests
  // Note: http-proxy-middleware removes the matched prefix (/api/pa) before calling pathRewrite
  // So we receive paths like "/health" and need to prepend "/api/chat"
  const paTarget = process.env.REACT_APP_PA_URL || 'http://localhost:6001';
  app.use(
    '/api/pa',
    createProxyMiddleware({
      target: paTarget,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: (path) => {
        // Path already has /api/pa removed, so just prepend /api/chat
        const newPath = '/api/chat' + path;
        console.log(`[PA Proxy] Rewriting: /api/pa${path} -> ${newPath}`);
        return newPath;
      },
    })
  );

  // Proxy for Career Agent (development mode)
  const careerTarget = process.env.REACT_APP_CAREER_URL || 'http://localhost:6002';
  app.use(
    '/api/career',
    createProxyMiddleware({
      target: careerTarget,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: (path) => {
        // Path already has /api/career removed, so just prepend /api/chat
        const newPath = '/api/chat' + path;
        console.log(`[Career Proxy] Rewriting: /api/career${path} -> ${newPath}`);
        return newPath;
      },
    })
  );

  // Proxy for Voice STT Service (development mode)
  const voiceTarget = process.env.REACT_APP_VOICE_URL || 'http://localhost:6003';
  app.use(
    '/api/voice',
    createProxyMiddleware({
      target: voiceTarget,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: (path) => {
        const newPath = '/api/voice' + path;
        console.log(`[Voice Proxy] Rewriting: /api/voice${path} -> ${newPath}`);
        return newPath;
      },
    })
  );

  console.log('✓ Agent proxies configured:');
  console.log('  - /api/pa -> ' + paTarget + ' (with path rewrite /api/pa -> /api/chat)');
  console.log('  - /api/career -> ' + careerTarget + ' (with path rewrite /api/career -> /api/chat)');
  console.log('  - /api/voice -> ' + voiceTarget + ' (Voice STT service)');

  // Proxy for Work Agent (development mode)
  // NOTE: SSE streaming requires special handling to prevent response buffering
  const workTarget = process.env.REACT_APP_WORK_URL || 'http://localhost:6004';
  app.use(
    '/api/work',
    createProxyMiddleware({
      target: workTarget,
      changeOrigin: true,
      logLevel: 'debug',
      // Critical for SSE: disable response buffering
      selfHandleResponse: false,
      // Prevent request compression that could cause buffering
      onProxyReq: (proxyReq, req, res) => {
        // Remove Accept-Encoding to prevent compression buffering
        proxyReq.removeHeader('Accept-Encoding');
        // Log streaming requests for debugging
        if (req.url.includes('/stream')) {
          console.log(`[Work Proxy] SSE streaming request: ${req.method} ${req.url}`);
        }
      },
      // Flush headers immediately for streaming
      onProxyRes: (proxyRes, req, res) => {
        // Set headers to prevent any buffering
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // For SSE endpoints, ensure proper content type is passed through
        if (req.url.includes('/stream')) {
          console.log(`[Work Proxy] SSE response headers:`, proxyRes.headers);
          // Flush immediately - prevent Node.js from buffering
          res.flushHeaders();
        }
      },
      pathRewrite: (path) => {
        // app.use('/api/work') strips the prefix, but backend router expects /api/work
        // So we need to add it back
        const newPath = '/api/work' + path;
        console.log(`[Work Proxy] Rewriting: /api/work${path} -> ${newPath}`);
        return newPath;
      },
    })
  );
  console.log('  - /api/work -> ' + workTarget + ' (with SSE streaming support)');

  // Catch-all proxy for other /api requests to backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'debug',
    })
  );

  // Also proxy /v1 paths (in case some requests bypass /api prefix)
  app.use(
    '/v1',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: {
        '^/v1': '/api/v1', // Rewrite /v1 to /api/v1
      },
    })
  );

  // Proxy static files (avatars and resumes)
  // No pathRewrite needed - default behavior should preserve the path
  // Proxy static files (avatars and resumes)
  // We need pathRewrite because app.use('/path') strips the prefix
  app.use(
    '/avatars',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'info',
      pathRewrite: (path) => {
        return '/avatars' + path;
      },
    })
  );

  app.use(
    '/resumes',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'info',
      pathRewrite: (path) => {
        return '/resumes' + path;
      },
    })
  );

  console.log('✓ Static file proxy configured: /avatars, /resumes');
};
