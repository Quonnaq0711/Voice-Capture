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
