import React, { useEffect, useCallback, useRef, useReducer, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { List } from 'react-window';
import { useAuth } from '../../contexts/AuthContext';
import { profile as profileAPI, activities as activitiesAPI, careerInsights as careerInsightsAPI, dailyRecommendations as dailyRecommendationsAPI } from '../../services/api';
import PersonalAssistant from '../chat/PersonalAssistant';
import CircularAgents from '../ui/CircularAgents';
import { BriefcaseIcon, CurrencyDollarIcon, HeartIcon, GlobeAltIcon, UserCircleIcon, SparklesIcon, HomeIcon, BookOpenIcon, AcademicCapIcon, FireIcon, SunIcon, ChatBubbleLeftRightIcon, CommandLineIcon, LightBulbIcon, ArrowTrendingUpIcon, ClockIcon, StarIcon, ChevronDownIcon, CpuChipIcon, CheckCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Home, Lightbulb, Map, Briefcase, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Sun } from 'lucide-react';
import { requestResetAssistantPosition } from '../../utils/navigationEvents';
import { getStaticFallbackRecommendations } from '../../utils/recommendations';

// ==================== STATE REDUCER ====================
// Consolidates 28 useState calls into organized state management

const initialState = {
  // User & Profile
  avatarUrl: null,
  userData: { first_name: '', email: '' },
  isImgError: false,

  // UI Navigation
  sidebarExpanded: false,
  activeTab: 'welcome',
  activeDashboardTab: 'insights',
  isInsightsMenuOpen: false,
  insightsTab: 'identity',
  showInsightsSubTabs: false,
  showDashboardSubTabs: true,
  triggerAnimation: false,
  isAssistantDialogOpen: false,

  // Insights & Career
  personalizedInsights: [],
  recommendedAgents: [],
  careerInsightsStatus: 'loading',
  analysisProgress: { isAnalyzing: false },
  sectionStatus: {
    professionalIdentity: 'completed',
    workExperience: 'completed',
    salaryAnalysis: 'pending',
    skillsAnalysis: 'pending',
    marketPosition: 'pending'
  },

  // Activities
  recentActivities: [],
  activitySummary: null,
  loadingActivities: false,
  showAllActivities: false,

  // Recommendations
  dailyRecommendations: [],
  loadingRecommendations: false,
  recommendationsLastFetched: null,

  // Time
  currentTime: new Date()
};

function dashboardReducer(state, action) {
  switch (action.type) {
    // User & Profile actions
    case 'SET_AVATAR_URL':
      return { ...state, avatarUrl: action.payload };
    case 'SET_USER_DATA':
      return { ...state, userData: action.payload };
    case 'SET_IMG_ERROR':
      return { ...state, isImgError: action.payload };

    // UI Navigation actions
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarExpanded: !state.sidebarExpanded };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_ACTIVE_DASHBOARD_TAB':
      return { ...state, activeDashboardTab: action.payload };
    case 'TOGGLE_INSIGHTS_MENU':
      return { ...state, isInsightsMenuOpen: !state.isInsightsMenuOpen };
    case 'SET_INSIGHTS_TAB':
      return { ...state, insightsTab: action.payload };
    case 'TOGGLE_INSIGHTS_SUB_TABS':
      return { ...state, showInsightsSubTabs: !state.showInsightsSubTabs };
    case 'TOGGLE_DASHBOARD_SUB_TABS':
      return { ...state, showDashboardSubTabs: !state.showDashboardSubTabs };
    case 'SET_TRIGGER_ANIMATION':
      return { ...state, triggerAnimation: action.payload };
    case 'SET_ASSISTANT_DIALOG_OPEN':
      return { ...state, isAssistantDialogOpen: action.payload };

    // Insights & Career actions
    case 'SET_PERSONALIZED_INSIGHTS':
      return { ...state, personalizedInsights: action.payload };
    case 'SET_RECOMMENDED_AGENTS':
      return { ...state, recommendedAgents: action.payload };
    case 'SET_CAREER_INSIGHTS_STATUS':
      return { ...state, careerInsightsStatus: action.payload };

    // Activities actions
    case 'SET_RECENT_ACTIVITIES':
      return { ...state, recentActivities: action.payload };
    case 'SET_ACTIVITY_SUMMARY':
      return { ...state, activitySummary: action.payload };
    case 'SET_LOADING_ACTIVITIES':
      return { ...state, loadingActivities: action.payload };
    case 'TOGGLE_SHOW_ALL_ACTIVITIES':
      return { ...state, showAllActivities: !state.showAllActivities };

    // Recommendations actions
    case 'SET_DAILY_RECOMMENDATIONS':
      return { ...state, dailyRecommendations: action.payload };
    case 'SET_LOADING_RECOMMENDATIONS':
      return { ...state, loadingRecommendations: action.payload };
    case 'SET_RECOMMENDATIONS_LAST_FETCHED':
      return { ...state, recommendationsLastFetched: action.payload };

    // Time actions
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };

    // Batch updates for performance
    case 'BATCH_UPDATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ==================== ACTIVITY HELPERS ====================
const getActivityStyle = (activity) => {
  if (activity.activity_type === 'chat') {
    const isEdit = activity.activity_metadata?.action_type === 'edit';
    if (activity.activity_source === 'dashboard') {
      return {
        color: 'bg-purple-500',
        title: isEdit ? '✏️ Personal Assistant Edit' : '💬 Personal Assistant Chat',
        description: isEdit ? 'Edited dashboard conversation' : 'Started dashboard conversation'
      };
    } else if (activity.activity_source === 'career') {
      return {
        color: 'bg-green-500',
        title: isEdit ? '✏️ Career Assistant Edit' : '💼 Career Assistant Chat',
        description: isEdit ? 'Edited career agent conversation' : 'Started career agent conversation'
      };
    }
  } else if (activity.activity_type === 'resume_analysis') {
    return { color: 'bg-blue-500', title: '📄 Resume Analysis', description: activity.activity_description };
  }

  const sourceStyles = {
    career: { color: 'bg-blue-500', icon: '💼' },
    money: { color: 'bg-green-500', icon: '💰' },
    mind: { color: 'bg-purple-500', icon: '🧠' },
    travel: { color: 'bg-indigo-500', icon: '✈️' },
    dashboard: { color: 'bg-gray-500', icon: '📊' }
  };
  const style = sourceStyles[activity.activity_source] || { color: 'bg-gray-400', icon: '📝' };
  return { ...style, title: activity.activity_title, description: activity.activity_description };
};

const formatTimeAgo = (dateString, now) => {
  let utcDateString = dateString;
  const hasTimezone = dateString.includes('Z') ||
    dateString.includes('+', dateString.indexOf('T')) ||
    dateString.includes('-', dateString.indexOf('T'));

  if (!hasTimezone) {
    utcDateString = dateString.includes('.') ? dateString.split('.')[0] + 'Z' : dateString + 'Z';
  }

  const diff = now - new Date(utcDateString);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (days < 365) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

// ==================== VIRTUALIZED ACTIVITY LIST ====================
const ITEM_HEIGHT = 88;
const VIRTUALIZATION_THRESHOLD = 10;
const MAX_VISIBLE_HEIGHT = 400;

// Row component for react-window v2
const ActivityRow = React.memo(({ index, style: rowStyle, activities, currentTime }) => {
  const activity = activities[index];
  const activityStyle = getActivityStyle(activity);

  return (
    <div style={rowStyle}>
      <div className="flex items-start space-x-3 p-3 mx-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className={`w-3 h-3 ${activityStyle.color} rounded-full mt-1.5 flex-shrink-0 shadow-sm`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 font-medium truncate">{activityStyle.title}</p>
          <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.created_at, currentTime)}</p>
          {activityStyle.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{activityStyle.description}</p>
          )}
          {activity.activity_metadata?.message_preview && (
            <p className="text-xs text-gray-500 mt-1 italic bg-gray-100 px-2 py-1 rounded truncate">
              "{activity.activity_metadata.message_preview}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

const VirtualizedActivityList = React.memo(({ activities, currentTime }) => {
  const listHeight = Math.min(activities.length * ITEM_HEIGHT, MAX_VISIBLE_HEIGHT);
  const rowProps = useMemo(() => ({ activities, currentTime }), [activities, currentTime]);

  // Use regular rendering for small lists (virtualization overhead not worth it)
  if (activities.length <= VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="space-y-3">
        {activities.map((activity) => {
          const style = getActivityStyle(activity);
          return (
            <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className={`w-3 h-3 ${style.color} rounded-full mt-1.5 flex-shrink-0 shadow-sm`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 font-medium truncate">{style.title}</p>
                <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.created_at, currentTime)}</p>
                {style.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{style.description}</p>}
                {activity.activity_metadata?.message_preview && (
                  <p className="text-xs text-gray-500 mt-2 italic bg-gray-100 px-2 py-1 rounded">
                    "{activity.activity_metadata.message_preview}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <List
      rowComponent={ActivityRow}
      rowCount={activities.length}
      rowHeight={ITEM_HEIGHT}
      rowProps={rowProps}
      style={{ height: listHeight }}
      className="scrollbar-thin scrollbar-thumb-gray-300"
    />
  );
});

/**
 * Dashboard component - The main view after a user logs in.
 * It displays the core features of the Idii. AI Assistant platform.
 */
const Dashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // Consolidated state management using useReducer
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // Destructure state for easier access
  const {
    avatarUrl, userData, isImgError, triggerAnimation, isAssistantDialogOpen,
    sidebarExpanded, activeTab, activeDashboardTab, insightsTab,
    showInsightsSubTabs, showDashboardSubTabs, personalizedInsights,
    recommendedAgents, careerInsightsStatus, analysisProgress, sectionStatus,
    recentActivities, activitySummary, loadingActivities, showAllActivities,
    dailyRecommendations, loadingRecommendations, recommendationsLastFetched,
    currentTime
  } = state;

  // Ref to avoid stale closure in timer callbacks
  const recommendationsLastFetchedRef = useRef(null);


  // Fetch all data on component mount - parallel execution with Promise.allSettled
  useEffect(() => {
    let isMounted = true;

    const loadAllData = async () => {
      const results = await Promise.allSettled([
        fetchUserData(),
        fetchAvatar(),
        generatePersonalizedInsights(),
        fetchRecentActivities(),
        fetchActivitySummary(),
        fetchDailyRecommendations()
      ]);

      // Log any failed requests for debugging (only if component is still mounted)
      if (isMounted) {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const taskNames = ['fetchUserData', 'fetchAvatar', 'generatePersonalizedInsights', 'fetchRecentActivities', 'fetchActivitySummary', 'fetchDailyRecommendations'];
            console.warn(`Dashboard: ${taskNames[index]} failed:`, result.reason);
          }
        });
      }
    };

    loadAllData().catch(error => {
      if (isMounted) {
        console.error('Dashboard: Unhandled error in loadAllData:', error);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Trigger animation when user data is loaded
  useEffect(() => {
    if (userData.first_name && user) {
      // Delay animation slightly to ensure component is fully rendered
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_TRIGGER_ANIMATION', payload: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userData.first_name, user]);

  // Setup timer to update time display dynamically
  useEffect(() => {
    // Simple timer that updates every 10 seconds
    const timer = setInterval(() => {
      dispatch({ type: 'SET_CURRENT_TIME', payload: new Date() });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(timer);
  }, []);

  // Setup 24-hour refresh for recommendations with debounce to prevent race conditions
  const recommendationsRefreshRef = useRef(false);

  useEffect(() => {
    const checkRecommendationsRefresh = async () => {
      // Debounce: skip if already refreshing
      if (recommendationsRefreshRef.current) return;

      if (shouldRefreshRecommendations()) {
        recommendationsRefreshRef.current = true;
        if (process.env.NODE_ENV === 'development') console.log('24 hours passed, refreshing recommendations...');
        try {
          await fetchDailyRecommendations();
        } finally {
          recommendationsRefreshRef.current = false;
        }
      }
    };

    // Check every hour for recommendation refresh
    const timer = setInterval(checkRecommendationsRefresh, 60 * 60 * 1000); // Check every hour

    // Check on mount (but not on recommendationsLastFetched changes to avoid loops)
    checkRecommendationsRefresh();

    return () => clearInterval(timer);
  }, []); // Empty deps - only runs on mount/unmount

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      dispatch({ type: 'SET_USER_DATA', payload: {
        first_name: data.first_name,
        email: data.email
      }});
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Generate personalized insights based on user data
  const generatePersonalizedInsights = async () => {
    try {
      dispatch({ type: 'SET_CAREER_INSIGHTS_STATUS', payload: 'loading' });

      // Fetch career insights from API
      const careerInsightsResponse = await careerInsightsAPI.getSummary();

      let insights = [];

      if (careerInsightsResponse.status === 'success') {
        // Use real career insights data
        insights = (careerInsightsResponse.insights || []).map(insight => ({
          id: insight.id,
          title: insight.title,
          description: insight.description,
          type: insight.type,
          priority: insight.priority,
          icon: getIconComponent(insight.icon),
          color: insight.color,
          action: insight.action,
          details: insight.details
        }));

        dispatch({ type: 'SET_CAREER_INSIGHTS_STATUS', payload: 'success' });
      } else if (careerInsightsResponse.status === 'no_analysis') {
        // Show default message when no analysis available
        insights = [
          {
            id: 'no_career_analysis',
            title: "Upload Your Resume",
            description: "Get personalized career insights by uploading your resume to the Career Agent.",
            type: "career",
            priority: "high",
            icon: BriefcaseIcon,
            color: "bg-blue-500",
            action: "Go to Career Agent"
          }
        ];
        dispatch({ type: 'SET_CAREER_INSIGHTS_STATUS', payload: 'no_analysis' });
      } else {
        dispatch({ type: 'SET_CAREER_INSIGHTS_STATUS', payload: 'error' });
      }

      // Add some general insights if we have fewer than 3
      if (insights.length < 3) {
        const generalInsights = [
          {
            id: 'financial_planning',
            title: "Financial Planning Insight",
            description: "Track your expenses and explore investment opportunities with the Money Agent.",
            type: "money",
            priority: "medium",
            icon: CurrencyDollarIcon,
            color: "bg-green-500",
            action: "Check Money Agent"
          },
          {
            id: 'wellness_recommendation',
            title: "Wellness Recommendation",
            description: "Consider incorporating mindfulness practices into your daily routine.",
            type: "mind",
            priority: "medium",
            icon: HeartIcon,
            color: "bg-pink-500",
            action: "Visit Mind Agent"
          }
        ];

        // Add general insights to fill up to 3 total
        const remainingSlots = 3 - insights.length;
        insights = [...insights, ...generalInsights.slice(0, remainingSlots)];
      }

      dispatch({ type: 'SET_PERSONALIZED_INSIGHTS', payload: insights });

    } catch (error) {
      console.error('Error fetching career insights:', error);
      dispatch({ type: 'SET_CAREER_INSIGHTS_STATUS', payload: 'error' });

      // Fallback to default insights if API fails
      const fallbackInsights = [
        {
          id: 'career_growth',
          title: "Career Growth Opportunity",
          description: "Upload your resume to get personalized career recommendations.",
          type: "career",
          priority: "high",
          icon: ArrowTrendingUpIcon,
          color: "bg-blue-500",
          action: "Explore Career Agent"
        },
        {
          id: 'financial_planning',
          title: "Financial Planning Insight",
          description: "Track your expenses and explore investment opportunities.",
          type: "money",
          priority: "medium",
          icon: CurrencyDollarIcon,
          color: "bg-green-500",
          action: "Check Money Agent"
        },
        {
          id: 'wellness_recommendation',
          title: "Wellness Recommendation",
          description: "Consider incorporating mindfulness practices into your daily routine.",
          type: "mind",
          priority: "medium",
          icon: HeartIcon,
          color: "bg-pink-500",
          action: "Visit Mind Agent"
        }
      ];
      dispatch({ type: 'SET_PERSONALIZED_INSIGHTS', payload: fallbackInsights });
    }

    // Generate recommended agents based on user activity and profile
    const recommended = [
      { name: 'Career Agent', priority: 1, reason: 'Most relevant to your goals' },
      { name: 'Money Agent', priority: 2, reason: 'High potential impact' },
      { name: 'Mind Agent', priority: 3, reason: 'Trending in your network' }
    ];
    dispatch({ type: 'SET_RECOMMENDED_AGENTS', payload: recommended });
  };

  // Helper function to get icon component from string
  const getIconComponent = (iconName) => {
    const iconMap = {
      'BriefcaseIcon': BriefcaseIcon,
      'CurrencyDollarIcon': CurrencyDollarIcon,
      'CpuChipIcon': CpuChipIcon,
      'ArrowTrendingUpIcon': ArrowTrendingUpIcon,
      'ClockIcon': ClockIcon,
      'HeartIcon': HeartIcon,
      'CheckCircleIcon': CheckCircleIcon
    };
    return iconMap[iconName] || BriefcaseIcon; // Default to BriefcaseIcon
  };

  // Agent modules available in the dashboard
  const agentModules = [
    {
      name: 'Career Agent',
      description: 'Get personalized career advice, resume analysis, and job recommendations.',
      icon: BriefcaseIcon,
      color: 'text-blue-500',
      path: '/agents/career',
    },
    {
      name: 'Money Agent',
      description: 'Receive insights on financial planning, budgeting, and investment strategies.',
      icon: CurrencyDollarIcon,
      color: 'text-green-500',
      path: '/agents/money',
    },
    {
      name: 'Mind Agent',
      description: 'Support for mental well-being, stress management, and mindfulness.',
      icon: HeartIcon,
      color: 'text-pink-500',
      path: '/agents/mind',
    },
    {
      name: 'Travel Agent',
      description: 'Plan your next trip with personalized recommendations and itineraries.',
      icon: GlobeAltIcon,
      color: 'text-indigo-500',
      path: '/agents/travel',
    },
    {
      name: 'Wellness',
      description: 'Personalized health and fitness guidance for your physical well-being.',
      icon: SparklesIcon,
      color: 'text-purple-500',
      path: '/agents/body',
    },
    {
      name: 'Family Life Agent',
      description: 'Support and advice for maintaining healthy family relationships and work-life balance.',
      icon: HomeIcon,
      color: 'text-yellow-500',
      path: '/agents/family-life',
    },
    {
      name: 'Hobby Agent',
      description: 'Discover and develop new interests, skills, and recreational activities.',
      icon: BookOpenIcon,
      color: 'text-orange-500',
      path: '/agents/hobby',
    },
    {
      name: 'Knowledge Agent',
      description: 'Enhance your learning journey with personalized knowledge management strategies.',
      icon: AcademicCapIcon,
      color: 'text-cyan-500',
      path: '/agents/knowledge',
    },
    {
      name: 'Personal Development Agent',
      description: 'Achieve personal growth through goal setting and skill development.',
      icon: FireIcon,
      color: 'text-red-500',
      path: '/agents/personal-dev',
    },
    {
      name: 'Spiritual Agent',
      description: 'Guidance for spiritual growth, meditation, and inner peace.',
      icon: SunIcon,
      color: 'text-amber-500',
      path: '/agents/spiritual',
    },
  ];

  // Sort agents based on recommendations (memoized to avoid re-sorting on every render)
  const sortedAgents = useMemo(() => {
    const agentsCopy = [...agentModules];
    const recommendedNames = recommendedAgents.map(r => r.name);

    return agentsCopy.sort((a, b) => {
      const aIndex = recommendedNames.indexOf(a.name);
      const bIndex = recommendedNames.indexOf(b.name);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
  }, [recommendedAgents]);

const fetchAvatar = async () => {
  try {
    const data = await profileAPI.getAvatarUrl();
    // In development mode, prepend backend URL to relative avatar paths
    let url = data.url;
    if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      url = backendUrl + url;
    }
    
    // Add timestamp to force cache refresh
    const timestamp = new Date().getTime();
    const urlWithTimestamp = url.includes('?') 
      ? `${url}&t=${timestamp}` 
      : `${url}?t=${timestamp}`;
    
    dispatch({ type: 'SET_AVATAR_URL', payload: urlWithTimestamp });
  } catch (error) {
    console.error('Error fetching avatar:', error);
  }
};

  // Fetch recent activities (memoized to avoid stale closures)
  const fetchRecentActivities = useCallback(async (limit = null) => {
    try {
      dispatch({ type: 'SET_LOADING_ACTIVITIES', payload: true });
      const activityLimit = limit || (showAllActivities ? 10 : 5);
      const activities = await activitiesAPI.getRecentActivities(activityLimit);
      dispatch({ type: 'SET_RECENT_ACTIVITIES', payload: activities });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      dispatch({ type: 'SET_RECENT_ACTIVITIES', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING_ACTIVITIES', payload: false });
    }
  }, [showAllActivities]);

  // Re-fetch activities when showAllActivities changes
  useEffect(() => {
    fetchRecentActivities();
  }, [fetchRecentActivities]);

  // Fetch activity summary
  const fetchActivitySummary = async () => {
    try {
      const summary = await activitiesAPI.getActivitySummary(7); // Last 7 days
      dispatch({ type: 'SET_ACTIVITY_SUMMARY', payload: summary });
    } catch (error) {
      console.error('Error fetching activity summary:', error);
    }
  };

  // Track activity when user interacts with components
  const trackActivity = async (activityType, activitySource, title, description = null, metadata = {}) => {
    try {
      await activitiesAPI.createActivity({
        activity_type: activityType,
        activity_source: activitySource,
        activity_title: title,
        activity_description: description,
        activity_metadata: metadata
      });
      // Refresh activities after tracking
      fetchRecentActivities();
      fetchActivitySummary();
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  // Fetch daily recommendations
  const fetchDailyRecommendations = async () => {
    try {
      dispatch({ type: 'SET_LOADING_RECOMMENDATIONS', payload: true });
      const response = await dailyRecommendationsAPI.getRecommendations();

      // Accept any valid recommendations regardless of status (success, cached, fallback)
      if (response.recommendations && response.recommendations.length > 0) {
        const now = new Date();
        dispatch({ type: 'BATCH_UPDATE', payload: {
          dailyRecommendations: response.recommendations,
          recommendationsLastFetched: now
        }});
        recommendationsLastFetchedRef.current = now; // Keep ref in sync for timer callbacks
        if (process.env.NODE_ENV === 'development') console.log(`Loaded ${response.recommendations.length} recommendations`);
      } else {
        // Fallback to static recommendations if API fails
        if (process.env.NODE_ENV === 'development') console.log('No recommendations received, using fallback');
        dispatch({ type: 'SET_DAILY_RECOMMENDATIONS', payload: getStaticFallbackRecommendations() });
      }
    } catch (error) {
      console.error('Error fetching daily recommendations:', error);
      // Fallback to static recommendations
      dispatch({ type: 'SET_DAILY_RECOMMENDATIONS', payload: getStaticFallbackRecommendations() });
    } finally {
      dispatch({ type: 'SET_LOADING_RECOMMENDATIONS', payload: false });
    }
  };

  // Force generate new recommendations (for refresh button)
  const forceGenerateRecommendations = async () => {
    try {
      dispatch({ type: 'SET_LOADING_RECOMMENDATIONS', payload: true });
      const response = await dailyRecommendationsAPI.generateRecommendations();

      // Accept any valid recommendations regardless of status (success, cached, fallback)
      if (response.recommendations && response.recommendations.length > 0) {
        dispatch({ type: 'BATCH_UPDATE', payload: {
          dailyRecommendations: response.recommendations,
          recommendationsLastFetched: new Date()
        }});
        if (process.env.NODE_ENV === 'development') console.log(`Generated ${response.recommendations.length} new recommendations (${response.status})`);
      } else {
        // Fallback to static recommendations if API fails
        if (process.env.NODE_ENV === 'development') console.log('No recommendations generated, using static fallback');
        dispatch({ type: 'SET_DAILY_RECOMMENDATIONS', payload: getStaticFallbackRecommendations() });
      }
    } catch (error) {
      console.error('Error generating new recommendations:', error);
      // Fallback to static recommendations
      dispatch({ type: 'SET_DAILY_RECOMMENDATIONS', payload: getStaticFallbackRecommendations() });
    } finally {
      dispatch({ type: 'SET_LOADING_RECOMMENDATIONS', payload: false });
    }
  };

  // Check if recommendations need refresh (24 hour logic)
  // Uses ref to avoid stale closure in timer callbacks
  const shouldRefreshRecommendations = useCallback(() => {
    const lastFetched = recommendationsLastFetchedRef.current;
    if (!lastFetched) return true;

    const now = new Date();
    const lastFetch = new Date(lastFetched);
    const hoursSinceLastFetch = (now - lastFetch) / (1000 * 60 * 60);

    return hoursSinceLastFetch >= 24;
  }, []);

  // Handlers for navigation
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAccount = () => {
    navigate('/profile');
  };

  // Handler for Personal Assistant dialog
  const handlePersonalAssistant = () => {
    dispatch({ type: 'SET_ASSISTANT_DIALOG_OPEN', payload: true });
    // Reset assistant position using event system (replaces window object pollution)
    requestResetAssistantPosition();
    // Note: Chat activity is now tracked when messages are actually sent in ChatDialog
  };

  // Handler for view all activities toggle
  const handleViewAllActivities = () => {
    dispatch({ type: 'TOGGLE_SHOW_ALL_ACTIVITIES' });
  };

  // Handler for sidebar toggle
  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  const handleDashboardToggle = () => {
    dispatch({ type: 'BATCH_UPDATE', payload: { activeTab: 'welcome' }});
    dispatch({ type: 'TOGGLE_DASHBOARD_SUB_TABS' });
  };

  const handleInsightsToggle = () => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'insights' });
    dispatch({ type: 'TOGGLE_INSIGHTS_SUB_TABS' });
  };

  const handleDashboardTabChange = (tabId) => {
    dispatch({ type: 'BATCH_UPDATE', payload: { activeDashboardTab: tabId, activeTab: 'welcome' }});
  };

  const handleInsightsSubTabChange = (subTabId) => {
    dispatch({ type: 'BATCH_UPDATE', payload: { insightsTab: subTabId, activeTab: 'insights' }});
  };

  const handleTabChange = (tabId) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  };

  // Tab configuration
  const dashboardTabs = [
    {
      id: 'insights',
      name: 'AI Insights',
      icon: Lightbulb,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'achievements',
      name: 'Achievements',
      icon: Star,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      disabled: true
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      icon: Sun,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      preview: true
    }
  ];

  const tabs = [
    { id: 'planning', name: 'Career Planning', icon: Map, disabled: true },
    { id: 'job-search', name: 'Job Search', icon: Briefcase, disabled: true },
    { id: 'resume-builder', name: 'Resume Builder', icon: FileText, disabled: true },
    { id: 'documents', name: 'Documents', icon: FileText, disabled: false }
  ];

  const insightsSubTabs = [
    { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
    { id: 'work', label: 'Work Experience Analysis', section: 'workExperience' },
    { id: 'salary', label: 'Salary Analysis', section: 'salaryAnalysis' },
    { id: 'skills', label: 'Skills Analysis', section: 'skillsAnalysis' },
    { id: 'market', label: 'Market Position Analysis', section: 'marketPosition' }
  ];

  // Personalized Insights Component
  const PersonalizedInsights = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
            <LightBulbIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              AI Insights
            </h2>
            <p className="text-gray-600 mt-1">
              Personalized recommendations based on your profile
            </p>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Insights</h3>
          {careerInsightsStatus === 'success' && (
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              Career Analysis Available
            </span>
          )}
          {careerInsightsStatus === 'no_analysis' && (
            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Upload Resume for Analysis
            </span>
          )}
          {careerInsightsStatus === 'loading' && (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full animate-pulse">
              Loading insights...
            </span>
          )}
          {careerInsightsStatus === 'error' && (
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
              Using fallback insights
            </span>
          )}
        </div>

        {careerInsightsStatus === 'loading' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-lg flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personalizedInsights.map((insight) => {
            const IconComponent = insight.icon;

            // Function to render bullet points if description contains them
            const renderDescription = (description) => {
              if (description && description.includes('•')) {
                const bulletPoints = description.split('•').filter(point => point.trim());
                return (
                  <ul className="space-y-2">
                    {bulletPoints.map((point) => (
                      <li key={`bullet-${point.trim().substring(0, 30)}`} className="flex items-start">
                        <span className="text-blue-500 mr-2 mt-0.5">•</span>
                        <span className="text-gray-700 text-sm leading-relaxed">{point.trim()}</span>
                      </li>
                    ))}
                  </ul>
                );
              } else {
                return <p className="text-gray-700 text-sm leading-relaxed">{description}</p>;
              }
            };

            return (
              <div key={insight.id} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors hover:shadow-md min-h-fit">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 ${insight.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 text-base">{insight.title}</h4>
                      {insight.priority === 'high' && (
                        <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full ml-2">High</span>
                      )}
                      {insight.priority === 'medium' && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full ml-2">Med</span>
                      )}
                    </div>
                    <div className="mb-4">
                      {renderDescription(insight.description)}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={() => {
                        // Map different insight sections to specific career agent tabs
                        const insightId = insight.id;
                        const baseCareerUrl = '/agents/career';

                        switch(insightId) {
                          case 'professional_identity':
                            navigate(`${baseCareerUrl}?tab=identity`);
                            break;
                          case 'work_experience':
                            navigate(`${baseCareerUrl}?tab=work`);
                            break;
                          case 'skills_analysis':
                            navigate(`${baseCareerUrl}?tab=skills`);
                            break;
                          case 'market_position':
                            navigate(`${baseCareerUrl}?tab=market`);
                            break;
                          case 'salary_analysis':
                            navigate(`${baseCareerUrl}?tab=salary`);
                            break;
                          default:
                            // Fallback for other insight types
                            if (insight.action.includes('Career')) {
                              navigate('/agents/career');
                            } else if (insight.action.includes('Money')) {
                              navigate('/agents/money');
                            } else if (insight.action.includes('Mind')) {
                              navigate('/agents/mind');
                            }
                        }
                      }}
                    >
                      {insight.action} →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <ClockIcon className="h-5 w-5 text-gray-500" />
            <span>Recent Activity</span>
          </h3>
          <button
            onClick={handleViewAllActivities}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            {showAllActivities ? 'Show Less' : 'View All'}
          </button>
        </div>

        {loadingActivities ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg animate-pulse">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-2 flex-shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : recentActivities.length > 0 ? (
          <VirtualizedActivityList
            activities={recentActivities}
            currentTime={currentTime}
          />
        ) : (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No recent activities yet</p>
            <p className="text-gray-400 text-xs mt-1">Start interacting with AI agents to see your activity here</p>
          </div>
        )}
      </div>
    </div>
  );

  // Achievements & Progress Component
  const AchievementsProgress = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg">
            <StarIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Achievements & Progress
            </h2>
            <p className="text-gray-600 mt-1">
              Track your growth and celebrate milestones
            </p>
          </div>
        </div>
      </div>

      {/* Achievement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <FireIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">7 Day Streak</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Daily Engagement</h3>
          <p className="text-sm text-gray-600 mb-3">Consistent daily AI interactions</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full" style={{width: '70%'}}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">7/10 days to next level</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <BriefcaseIcon className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">In Progress</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Career Goals</h3>
          <p className="text-sm text-gray-600 mb-3">Professional development milestones</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{width: '65%'}}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">3/5 objectives completed</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <HeartIcon className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Excellent</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Wellness Score</h3>
          <p className="text-sm text-gray-600 mb-3">Overall health and mindfulness</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">85/100 wellness points</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <AcademicCapIcon className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">Learning</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Knowledge Growth</h3>
          <p className="text-sm text-gray-600 mb-3">Skills and learning progress</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full" style={{width: '72%'}}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">12/15 learning modules</p>
        </div>
      </div>

      {/* Monthly Goals Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
          Monthly Goals Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Career Development</span>
              <span className="text-sm font-bold text-blue-600">80%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{width: '80%'}}></div>
            </div>
            <p className="text-xs text-gray-500">4/5 milestones achieved</p>
          </div>

          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Financial Planning</span>
              <span className="text-sm font-bold text-green-600">60%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{width: '60%'}}></div>
            </div>
            <p className="text-xs text-gray-500">3/5 targets completed</p>
          </div>

          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Personal Wellness</span>
              <span className="text-sm font-bold text-purple-600">90%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{width: '90%'}}></div>
            </div>
            <p className="text-xs text-gray-500">9/10 wellness goals met</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper function to get icon component from string
  const getRecommendationIcon = (iconName) => {
    const iconMap = {
      'BriefcaseIcon': BriefcaseIcon,
      'AcademicCapIcon': AcademicCapIcon,
      'UserGroupIcon': UserGroupIcon,
      'ChartBarIcon': LightBulbIcon, // Fallback
      'LightBulbIcon': LightBulbIcon,
      'HeartIcon': HeartIcon,
      'CpuChipIcon': CpuChipIcon
    };
    return iconMap[iconName] || BriefcaseIcon;
  };

  // Helper function to get color classes
  const getRecommendationColors = (color) => {
    const colorMap = {
      'blue': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'hover:border-blue-300' },
      'green': { bg: 'bg-green-100', text: 'text-green-600', border: 'hover:border-green-300' },
      'purple': { bg: 'bg-purple-100', text: 'text-purple-600', border: 'hover:border-purple-300' },
      'orange': { bg: 'bg-orange-100', text: 'text-orange-600', border: 'hover:border-orange-300' },
      'red': { bg: 'bg-red-100', text: 'text-red-600', border: 'hover:border-red-300' }
    };
    return colorMap[color] || colorMap['blue'];
  };

  // Today's Recommendations Component
  const TodaysRecommendations = () => {
    // Get the high priority recommendation for the priority section
    const recommendations = dailyRecommendations || [];
    const highPriorityRec = recommendations.find(rec => rec.priority === 'high') || recommendations[0] || null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg">
              <SunIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Today's AI Recommendations
              </h2>
              <p className="text-gray-600 mt-1">
                Personalized daily guidance to help you stay on track
              </p>
            </div>
          </div>
        </div>

        {/* Daily Recommendations Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today's Recommendations</h3>
            {loadingRecommendations && (
              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full animate-pulse">
                Generating...
              </span>
            )}
            {!loadingRecommendations && dailyRecommendations.length > 0 && (
              <button
                onClick={forceGenerateRecommendations}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                title="Generate new recommendations using AI"
              >
                🔄 Refresh
              </button>
            )}
          </div>

          {loadingRecommendations ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyRecommendations.slice(0, 3).map((recommendation, index) => {
                const IconComponent = getRecommendationIcon(recommendation.icon);
                const colors = getRecommendationColors(recommendation.color);

                return (
                  <div key={recommendation.id} className={`border border-gray-200 rounded-lg transition-colors ${colors.border} h-44 flex flex-col`}>
                    {/* Header section with icon and title - fixed height */}
                    <div className="flex items-start space-x-3 p-4 pb-3">
                      <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`h-4 w-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm leading-5 h-5">{recommendation.title}</h4>
                      </div>
                    </div>

                    {/* Description section - flexible height but contained */}
                    <div className="flex-1 px-4 pb-3">
                      <p className="text-xs text-gray-600 leading-4 overflow-hidden">{recommendation.description}</p>
                    </div>

                    {/* Bottom section - fixed height and position */}
                    <div className="h-8 flex items-center justify-between px-4 pb-4">
                      <span className={`text-xs font-medium ${colors.text} ${colors.bg} px-2 py-1 rounded-full flex items-center h-6`}>
                        {recommendation.estimated_time}
                      </span>
                      <button className={`text-xs ${colors.text} hover:opacity-80 font-medium transition-opacity flex items-center h-6`}>
                        {recommendation.action_type === 'review' ? 'Review' :
                         recommendation.action_type === 'explore' ? 'Explore' :
                         recommendation.action_type === 'connect' ? 'Connect' :
                         'Start'} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority Action for Today */}
        {highPriorityRec && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <StarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Priority Action for Today</h3>
                  <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">HIGH IMPACT</span>
                </div>
                <p className="text-gray-600 mb-4">{highPriorityRec.description}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <button className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-2 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all duration-200">
                    Get Started
                  </button>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4" />
                    <span>Est: {highPriorityRec.estimated_time}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <StarIcon className="h-4 w-4" />
                    <span>Category: {highPriorityRec.category}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // AI Agent Network Component
  const AIAgentNetwork = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
            <CommandLineIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              AI Agent Network
            </h2>
            <p className="text-gray-600 mt-1">
              Specialized AI agents for every aspect of your life
            </p>
          </div>
        </div>
      </div>

      {/* AI Agents Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <CircularAgents
          agents={sortedAgents}
          avatarUrl={avatarUrl}
          user={userData}
          triggerAnimation={triggerAnimation}
          onAgentClick={(agent) => {
            // Track agent interaction
            trackActivity(
              'agent_interaction',
              agent.name.toLowerCase().replace(' agent', ''),
              `${agent.name} Interaction`,
              `Accessed ${agent.name} for ${agent.description}`,
              { agent_type: agent.name.toLowerCase().replace(' agent', '') }
            );
          }}
        />
      </div>
    </div>
  );

  // Welcome Page Component
  const WelcomePage = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome to Your Personal AI Assistant
            </h1>
            <p className="text-gray-600 mt-1">
              Your intelligent companion for personalized guidance and growth
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>

          <div className="space-y-3">
            <button
              onClick={handlePersonalAssistant}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center space-x-3"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              <span>Start AI Conversation</span>
            </button>

            <button
              onClick={() => navigate('/agents/career')}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-4 rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 flex items-center space-x-3"
            >
              <BriefcaseIcon className="h-5 w-5" />
              <span>Career Agent</span>
            </button>

            <button
              onClick={() => navigate('/agents/travel')}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-lg font-medium hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 flex items-center space-x-3"
            >
              <GlobeAltIcon className="h-5 w-5" />
              <span>Travel Agent</span>
            </button>

            <button
              onClick={() => navigate('/agents/body')}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-4 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center space-x-3"
            >
              <SparklesIcon className="h-5 w-5" />
              <span>Wellness</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Features</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5">
                <SparklesIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Intelligent Coordination</h3>
                <p className="text-sm text-gray-600">Unified AI agent management</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mt-0.5">
                <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Natural Conversation</h3>
                <p className="text-sm text-gray-600">Chat about life and goals</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mt-0.5">
                <UserCircleIcon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Personalized Insights</h3>
                <p className="text-sm text-gray-600">Tailored recommendations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'welcome':
        return <WelcomePage />;
      case 'insights':
        return <PersonalizedInsights />;
      case 'achievements':
        return <AchievementsProgress />;
      case 'recommendations':
        return <TodaysRecommendations />;
      default:
        return <WelcomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">I</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Idii.</h1>
              </div>
              <div className="hidden lg:flex items-center text-sm text-gray-500">
                <span>Personal AI Assistant Platform</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* User Profile */}
              <button
                onClick={handleAccount}
                className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex-shrink-0">
                  {avatarUrl && !isImgError? (
                    <img
                      src={avatarUrl}
                      alt="User Avatar"
                      onError={() => dispatch({ type: 'SET_IMG_ERROR', payload: true })}
                      className="h-8 w-8 rounded-full object-cover border-2 border-blue-200"
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {userData.first_name || user?.first_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-32">
                    {userData.email || user?.email || ''}
                  </p>
                </div>
                <ChevronDownIcon className="h-4 w-4 text-gray-400 hidden sm:block" />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen bg-gray-50">
        {/* Sidebar */}
       <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex">
      <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 relative ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}>
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md z-50"
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarExpanded ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {!sidebarExpanded ? (
            <div className="space-y-2">
              <button
                onClick={handleDashboardToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Dashboard"
              >
                <Home className="h-5 w-5" />
              </button>

              <button
                onClick={handleInsightsToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Career Insights"
              >
                <Lightbulb className="h-5 w-5" />
              </button>

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;
                const tabTitle = isDisabled ? `${tab.name} - Coming Soon` : tab.name;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={tabTitle}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={handleDashboardToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Home className={`h-5 w-5 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Dashboard</span>
                </div>
                {showDashboardSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {showDashboardSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {dashboardTabs.map((dashTab) => {
                    const DashIconComponent = dashTab.icon;
                    const isDashDisabled = dashTab.disabled;
                    const isPreview = dashTab.preview;

                    return (
                      <button
                        key={dashTab.id}
                        onClick={() => !isDashDisabled && handleDashboardTabChange(dashTab.id)}
                        disabled={isDashDisabled}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-all duration-200 text-sm ${
                          isDashDisabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome'
                            ? `${dashTab.bgColor} ${dashTab.color} border border-current`
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <DashIconComponent className={`h-4 w-4 flex-shrink-0 ${
                          isDashDisabled 
                            ? 'text-gray-300' 
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome' 
                            ? dashTab.color 
                            : 'text-gray-500'
                        }`} />
                        <span className="font-medium text-left flex-1">{dashTab.name}</span>
                        {isDashDisabled && (
                          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                        {isPreview && !isDashDisabled && (
                          <span className="ml-auto text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                            Preview Only
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleInsightsToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Lightbulb className={`h-5 w-5 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Career Insights</span>
                </div>
                {showInsightsSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {/* FIXED: Removed activeTab check for better UX */}
              {showInsightsSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {insightsSubTabs.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleInsightsSubTabChange(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center ${
                        insightsTab === item.id 
                          ? 'bg-orange-100 text-orange-600 font-semibold' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {sectionStatus[item.section] === 'completed' ? (
                        <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : analysisProgress.isAnalyzing ? (
                        <svg className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className={`h-5 w-5 ${
                      isDisabled
                        ? 'text-gray-300'
                        : activeTab === tab.id ? 'text-white' : 'text-gray-500'
                    }`} />
                    <span className="font-medium">{tab.name}</span>
                    {isDisabled && (
                      <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className={`p-4 border-t border-gray-200 ${!sidebarExpanded ? 'px-2' : ''}`}>
          {sidebarExpanded ? (
            <div className="text-xs text-gray-500 text-center">
              © 2025 Idii
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

          {/* Main Content Area */}
          <div className={`flex-1 transition-all duration-300 ${
            sidebarExpanded ? 'ml-72' : 'ml-14'
          }`}>
            <div className="min-h-screen">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="max-w-6xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Life?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Start your journey with personalized AI assistance tailored to your unique goals and aspirations.
            </p>
            <button 
              onClick={handleAccount}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transform hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Customize Your Profile
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Terms Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Terms</h3>
                <ul className="space-y-2">
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Terms of Service
                    </button>
                  </li>
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Cookie Policy
                    </button>
                  </li>
                </ul>
              </div>

              {/* Supports Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Support</h3>
                <ul className="space-y-2">
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Feedback
                    </button>
                  </li>
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Docs
                    </button>
                  </li>
                </ul>
              </div>

              {/* Engage Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Engage</h3>
                <ul className="space-y-2">
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Discord
                    </button>
                  </li>
                  <li>
                    <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Twitter X
                    </button>
                  </li>
                </ul>
              </div>

              {/* Company Info */}
              <div>
                <h3 className="text-white font-semibold mb-4">Idii.</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Empowering lives through personalized AI assistance across all aspects of personal and professional growth.
                </p>
              </div>
            </div>

            {/* Copyright */}
            <div className="border-t border-gray-800 mt-8 pt-8 text-center">
              <p className="text-gray-400 text-sm">
                Copyright © 2025. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* Personal Assistant - Fixed Position Chatbot */}
      <PersonalAssistant
        user={userData}
        isDialogOpen={isAssistantDialogOpen}
        setIsDialogOpen={(open) => dispatch({ type: 'SET_ASSISTANT_DIALOG_OPEN', payload: open })}
      />
    </div>
  );
};

export default Dashboard;