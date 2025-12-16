/**
 * Custom event system to replace window object pollution
 * Provides type-safe navigation events between components
 */

// Navigation event types
export const NavigationEvents = {
  RESET_POSITION: 'assistant:resetPosition',
  NAVIGATE: 'assistant:navigate',
  CANCEL_NAVIGATION: 'assistant:cancelNavigation',
  GET_STATE: 'assistant:getState',
  STATE_RESPONSE: 'assistant:stateResponse'
};

/**
 * Dispatch a navigation event
 * @param {string} eventName - Event name (without 'assistant:' prefix)
 * @param {Object} detail - Event payload
 */
export const dispatchNavigationEvent = (eventName, detail = {}) => {
  const event = new CustomEvent(`assistant:${eventName}`, { detail });
  document.dispatchEvent(event);
};

/**
 * Subscribe to a navigation event
 * @param {string} eventName - Event name (without 'assistant:' prefix)
 * @param {Function} handler - Event handler
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNavigationEvent = (eventName, handler) => {
  const eventType = `assistant:${eventName}`;
  document.addEventListener(eventType, handler);
  return () => document.removeEventListener(eventType, handler);
};

/**
 * Request navigation to an agent
 * @param {string} agentName - Name of the agent to navigate to
 * @param {Function} addSystemMessage - Optional callback for system messages
 */
export const requestAgentNavigation = (agentName, addSystemMessage = null) => {
  dispatchNavigationEvent('navigate', { agentName, addSystemMessage });
};

/**
 * Request assistant position reset
 */
export const requestResetAssistantPosition = () => {
  dispatchNavigationEvent('resetPosition');
};

/**
 * Request navigation cancellation
 */
export const requestCancelNavigation = () => {
  dispatchNavigationEvent('cancelNavigation');
};

/**
 * Get current navigation state (async via event)
 * @returns {Promise<Object>} Navigation state
 */
export const getNavigationState = () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ isNavigating: false, targetAgent: null });
    }, 1000);

    const handler = (event) => {
      clearTimeout(timeout);
      document.removeEventListener(NavigationEvents.STATE_RESPONSE, handler);
      resolve(event.detail);
    };

    document.addEventListener(NavigationEvents.STATE_RESPONSE, handler);
    dispatchNavigationEvent('getState');
  });
};
