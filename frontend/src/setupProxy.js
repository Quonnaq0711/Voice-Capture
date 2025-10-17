const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Read target from environment variable, fallback to container backend
  const target = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

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

  console.log('✓ Agent proxies configured:');
  console.log('  - /api/pa -> ' + paTarget + ' (with path rewrite /api/pa -> /api/chat)');
  console.log('  - /api/career -> ' + careerTarget + ' (with path rewrite /api/career -> /api/chat)');

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
  app.use(
    '/avatars',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'info',
    })
  );

  app.use(
    '/resumes',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'info',
    })
  );

  console.log('✓ Static file proxy configured: /avatars, /resumes');
};
