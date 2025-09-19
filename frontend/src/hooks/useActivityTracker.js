import { useCallback, useEffect, useRef } from 'react';
import activityTracker from '../utils/activityTracker';

/**
 * React Hook for Activity Tracking
 * Provides easy-to-use activity tracking functions for React components
 */
export const useActivityTracker = (componentName, source = 'unknown') => {
  const mountTimeRef = useRef(null);
  const interactionCountRef = useRef(0);

  // Track component mount
  useEffect(() => {
    mountTimeRef.current = Date.now();

    // Track page/component visit
    activityTracker.trackPageVisit(componentName, source);

    // Track component unmount and time spent
    return () => {
      if (mountTimeRef.current) {
        const timeSpent = Math.round((Date.now() - mountTimeRef.current) / 1000); // in seconds
        if (timeSpent > 5) { // Only track if user spent more than 5 seconds
          activityTracker.trackEngagement(
            'time_spent',
            source,
            {
              component: componentName,
              duration_seconds: timeSpent,
              interaction_count: interactionCountRef.current
            }
          );
        }
      }
    };
  }, [componentName, source]);

  // Increment interaction count
  const incrementInteraction = useCallback(() => {
    interactionCountRef.current += 1;
  }, []);

  // Track general activity
  const track = useCallback((activityType, title, description = null, metadata = {}) => {
    incrementInteraction();
    return activityTracker.track(
      activityType,
      source,
      title,
      description,
      { component: componentName, ...metadata }
    );
  }, [componentName, source, incrementInteraction]);

  // Track chat activity
  const trackChat = useCallback((sessionId = null, messageId = null, agentType = null) => {
    incrementInteraction();
    return activityTracker.trackChat(source, sessionId, messageId, agentType);
  }, [source, incrementInteraction]);

  // Track agent interaction
  const trackAgentInteraction = useCallback((agentType, interactionType = 'general') => {
    incrementInteraction();
    return activityTracker.trackAgentInteraction(agentType, interactionType);
  }, [incrementInteraction]);

  // Track resume analysis
  const trackResumeAnalysis = useCallback((filename = null) => {
    incrementInteraction();
    return activityTracker.trackResumeAnalysis(filename);
  }, [incrementInteraction]);

  // Track feature usage
  const trackFeatureUsage = useCallback((featureName, additionalData = {}) => {
    incrementInteraction();
    return activityTracker.trackFeatureUsage(
      featureName,
      source,
      { component: componentName, ...additionalData }
    );
  }, [componentName, source, incrementInteraction]);

  // Track goal completion
  const trackGoalCompletion = useCallback((goalType, goalName) => {
    incrementInteraction();
    return activityTracker.trackGoalCompletion(goalType, goalName, source);
  }, [source, incrementInteraction]);

  // Track button clicks and interactions
  const trackClick = useCallback((element, action = 'click', metadata = {}) => {
    incrementInteraction();
    return track(
      'user_interaction',
      `${action} on ${element}`,
      `User performed ${action} on ${element} in ${componentName}`,
      { element, action, ...metadata }
    );
  }, [track, componentName]);

  // Track form submissions
  const trackFormSubmission = useCallback((formName, formData = {}) => {
    incrementInteraction();
    return track(
      'form_submission',
      `${formName} form submitted`,
      `User submitted ${formName} form`,
      { form_name: formName, ...formData }
    );
  }, [track]);

  // Track search queries
  const trackSearch = useCallback((query, resultsCount = null) => {
    incrementInteraction();
    return track(
      'search_query',
      `Search: "${query}"`,
      `User searched for "${query}"`,
      { search_query: query, results_count: resultsCount }
    );
  }, [track]);

  // Track error occurrences
  const trackError = useCallback((errorType, errorMessage, errorData = {}) => {
    return track(
      'error_occurrence',
      `Error: ${errorType}`,
      errorMessage,
      { error_type: errorType, error_message: errorMessage, ...errorData }
    );
  }, [track]);

  return {
    track,
    trackChat,
    trackAgentInteraction,
    trackResumeAnalysis,
    trackFeatureUsage,
    trackGoalCompletion,
    trackClick,
    trackFormSubmission,
    trackSearch,
    trackError,
    incrementInteraction
  };
};

/**
 * Hook for tracking chat-specific activities
 */
export const useChatActivityTracker = (source = 'chat') => {
  const { trackChat, track, trackClick } = useActivityTracker('Chat', source);

  const trackMessageSent = useCallback((messageText, sessionId = null, agentType = null) => {
    return Promise.all([
      trackChat(sessionId, null, agentType),
      track(
        'message_sent',
        'Message sent',
        'User sent a message',
        {
          message_length: messageText?.length || 0,
          session_id: sessionId,
          agent_type: agentType
        }
      )
    ]);
  }, [trackChat, track]);

  const trackMessageReceived = useCallback((responseText, sessionId = null, agentType = null) => {
    return track(
      'message_received',
      'AI response received',
      'User received AI response',
      {
        response_length: responseText?.length || 0,
        session_id: sessionId,
        agent_type: agentType
      }
    );
  }, [track]);

  const trackSessionCreated = useCallback((sessionName, agentType = null) => {
    return track(
      'session_created',
      'New chat session',
      `Created new chat session: ${sessionName}`,
      { session_name: sessionName, agent_type: agentType }
    );
  }, [track]);

  return {
    trackMessageSent,
    trackMessageReceived,
    trackSessionCreated,
    trackClick
  };
};

/**
 * Hook for tracking agent-specific activities
 */
export const useAgentActivityTracker = (agentType) => {
  const source = agentType.toLowerCase();
  const { trackAgentInteraction, track, trackClick } = useActivityTracker(`${agentType} Agent`, source);

  const trackAgentAccess = useCallback(() => {
    return trackAgentInteraction(source, 'access');
  }, [trackAgentInteraction, source]);

  const trackAgentQuery = useCallback((query, queryType = 'general') => {
    return Promise.all([
      trackAgentInteraction(source, 'query'),
      track(
        'agent_query',
        `${agentType} query: ${queryType}`,
        `User made ${queryType} query to ${agentType} agent`,
        { query_text: query, query_type: queryType }
      )
    ]);
  }, [trackAgentInteraction, track, source, agentType]);

  const trackAgentResponse = useCallback((responseType, responseData = {}) => {
    return track(
      'agent_response',
      `${agentType} response: ${responseType}`,
      `${agentType} agent provided ${responseType} response`,
      { response_type: responseType, ...responseData }
    );
  }, [track, agentType]);

  return {
    trackAgentAccess,
    trackAgentQuery,
    trackAgentResponse,
    trackClick
  };
};

export default useActivityTracker;