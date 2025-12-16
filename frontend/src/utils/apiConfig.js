/**
 * API URL Configuration
 * Centralized configuration for all agent API endpoints
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Agent type to API URL mapping
// In production: relative paths (proxied through Nginx)
// In development: localhost URLs for direct connection
export const AGENT_API_MAP = {
  'career': IS_PRODUCTION ? '/api/career' : (process.env.REACT_APP_CAREER_URL || 'http://localhost:6002') + '/api/chat',
  'money': IS_PRODUCTION ? '/api/money' : 'http://localhost:8003/api/chat',
  'mind': IS_PRODUCTION ? '/api/mind' : 'http://localhost:8004/api/chat',
  'travel': IS_PRODUCTION ? '/api/travel' : 'http://localhost:8005/api/chat',
  'body': IS_PRODUCTION ? '/api/body' : 'http://localhost:8006/api/chat',
  'family-life': IS_PRODUCTION ? '/api/family-life' : 'http://localhost:8007/api/chat',
  'hobby': IS_PRODUCTION ? '/api/hobby' : 'http://localhost:8008/api/chat',
  'knowledge': IS_PRODUCTION ? '/api/knowledge' : 'http://localhost:8009/api/chat',
  'personal-dev': IS_PRODUCTION ? '/api/personal-dev' : 'http://localhost:8010/api/chat',
  'spiritual': IS_PRODUCTION ? '/api/spiritual' : 'http://localhost:8011/api/chat'
};

// Path to agent type mapping (for URL-based agent detection)
export const PATH_TO_AGENT_MAP = {
  '/agents/career': 'career',
  '/agents/money': 'money',
  '/agents/mind': 'mind',
  '/agents/travel': 'travel',
  '/agents/body': 'body',
  '/agents/family-life': 'family-life',
  '/agents/hobby': 'hobby',
  '/agents/knowledge': 'knowledge',
  '/agents/personal-dev': 'personal-dev',
  '/agents/spiritual': 'spiritual'
};

/**
 * Get API base URL for a given agent type
 * @param {string} agentType - The agent type (e.g., 'career', 'money')
 * @returns {string|null} - The API base URL or null if not found
 */
export const getAgentApiUrl = (agentType) => {
  return AGENT_API_MAP[agentType] || null;
};

/**
 * Get agent type from URL pathname
 * @param {string} pathname - The URL pathname (e.g., '/agents/career')
 * @returns {string|null} - The agent type or null if not an agent path
 */
export const getAgentTypeFromPath = (pathname) => {
  for (const [path, agentType] of Object.entries(PATH_TO_AGENT_MAP)) {
    if (pathname.startsWith(path)) {
      return agentType;
    }
  }
  return null;
};

/**
 * Get API URLs (message and stream) for an agent
 * @param {string} agentType - The agent type
 * @returns {{ messageUrl: string|null, streamUrl: string|null }}
 */
export const getAgentApiUrls = (agentType) => {
  const baseUrl = getAgentApiUrl(agentType);
  if (!baseUrl) {
    return { messageUrl: null, streamUrl: null };
  }
  return {
    messageUrl: `${baseUrl}/message`,
    streamUrl: `${baseUrl}/message/stream`
  };
};
