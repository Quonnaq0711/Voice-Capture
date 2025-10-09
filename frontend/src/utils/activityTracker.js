import { activities as activitiesAPI } from '../services/api';

/**
 * Activity Tracker Utility
 * Provides helper functions for tracking user activities across the application
 */

class ActivityTracker {
  static instance = null;

  constructor() {
    if (ActivityTracker.instance) {
      return ActivityTracker.instance;
    }
    ActivityTracker.instance = this;
    this.isEnabled = true;
    this.queue = [];
    this.isProcessing = false;
  }

  static getInstance() {
    if (!ActivityTracker.instance) {
      ActivityTracker.instance = new ActivityTracker();
    }
    return ActivityTracker.instance;
  }

  /**
   * Enable or disable activity tracking
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Track a general activity
   * @param {string} activityType - Type of activity
   * @param {string} activitySource - Source component/page
   * @param {string} title - Human readable title
   * @param {string} description - Optional description
   * @param {object} metadata - Additional metadata
   */
  async track(activityType, activitySource, title, description = null, metadata = {}) {
    if (!this.isEnabled) return;

    try {
      await activitiesAPI.createActivity({
        activity_type: activityType,
        activity_source: activitySource,
        activity_title: title,
        activity_description: description,
        activity_metadata: metadata
      });
    } catch (error) {
      console.warn('Failed to track activity:', error);
    }
  }

  /**
   * Track a chat interaction
   * @param {string} source - Source of the chat (dashboard, career, etc.)
   * @param {number} sessionId - Optional session ID
   * @param {number} messageId - Optional message ID
   * @param {string} agentType - Type of agent involved
   */
  async trackChat(source, sessionId = null, messageId = null, agentType = null) {
    if (!this.isEnabled) return;

    try {
      await activitiesAPI.trackChatActivity(source, sessionId, messageId, agentType);
    } catch (error) {
      console.warn('Failed to track chat activity:', error);
    }
  }

  /**
   * Track an agent interaction
   * @param {string} agentType - Type of agent (career, money, mind, etc.)
   * @param {string} interactionType - Type of interaction
   */
  async trackAgentInteraction(agentType, interactionType = 'general') {
    if (!this.isEnabled) return;

    try {
      await activitiesAPI.trackAgentInteraction(agentType, interactionType);
    } catch (error) {
      console.warn('Failed to track agent interaction:', error);
    }
  }

  /**
   * Track a resume analysis
   * @param {string} resumeFilename - Optional filename
   */
  async trackResumeAnalysis(resumeFilename = null) {
    if (!this.isEnabled) return;

    try {
      await activitiesAPI.trackResumeAnalysis(resumeFilename);
    } catch (error) {
      console.warn('Failed to track resume analysis:', error);
    }
  }

  /**
   * Track page/component visits
   * @param {string} pageName - Name of the page/component
   * @param {string} source - Source context
   */
  async trackPageVisit(pageName, source = 'navigation') {
    if (!this.isEnabled) return;

    await this.track(
      'page_visit',
      source,
      `Visited ${pageName}`,
      `User navigated to ${pageName}`,
      { page_name: pageName }
    );
  }

  /**
   * Track feature usage
   * @param {string} featureName - Name of the feature
   * @param {string} source - Source component
   * @param {object} additionalData - Additional feature-specific data
   */
  async trackFeatureUsage(featureName, source, additionalData = {}) {
    if (!this.isEnabled) return;

    await this.track(
      'feature_usage',
      source,
      `Used ${featureName}`,
      `User utilized ${featureName} feature`,
      { feature_name: featureName, ...additionalData }
    );
  }

  /**
   * Track goal completion or milestone
   * @param {string} goalType - Type of goal (daily, weekly, monthly)
   * @param {string} goalName - Name of the goal
   * @param {string} source - Source component
   */
  async trackGoalCompletion(goalType, goalName, source) {
    if (!this.isEnabled) return;

    await this.track(
      'goal_completion',
      source,
      `Completed ${goalName}`,
      `User achieved ${goalType} goal: ${goalName}`,
      { goal_type: goalType, goal_name: goalName }
    );
  }

  /**
   * Track user engagement metrics
   * @param {string} engagementType - Type of engagement (time_spent, interaction_count, etc.)
   * @param {string} source - Source component
   * @param {object} metrics - Engagement metrics
   */
  async trackEngagement(engagementType, source, metrics = {}) {
    if (!this.isEnabled) return;

    await this.track(
      'user_engagement',
      source,
      `${engagementType} engagement`,
      `User engagement metrics recorded`,
      { engagement_type: engagementType, ...metrics }
    );
  }
}

// Export singleton instance
const activityTracker = ActivityTracker.getInstance();

// Export convenience functions for direct use
export const trackActivity = (type, source, title, description, metadata) =>
  activityTracker.track(type, source, title, description, metadata);

export const trackChat = (source, sessionId, messageId, agentType) =>
  activityTracker.trackChat(source, sessionId, messageId, agentType);

export const trackAgentInteraction = (agentType, interactionType) =>
  activityTracker.trackAgentInteraction(agentType, interactionType);

export const trackResumeAnalysis = (filename) =>
  activityTracker.trackResumeAnalysis(filename);

export const trackPageVisit = (pageName, source) =>
  activityTracker.trackPageVisit(pageName, source);

export const trackFeatureUsage = (featureName, source, additionalData) =>
  activityTracker.trackFeatureUsage(featureName, source, additionalData);

export const trackGoalCompletion = (goalType, goalName, source) =>
  activityTracker.trackGoalCompletion(goalType, goalName, source);

export const trackEngagement = (engagementType, source, metrics) =>
  activityTracker.trackEngagement(engagementType, source, metrics);

export default activityTracker;