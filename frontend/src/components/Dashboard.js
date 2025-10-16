import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profile as profileAPI, activities as activitiesAPI, careerInsights as careerInsightsAPI, dailyRecommendations as dailyRecommendationsAPI } from '../services/api';
import PersonalAssistant from './PersonalAssistant';
import CircularAgents from './CircularAgents';

// Import Heroicons
import { BriefcaseIcon, CurrencyDollarIcon, HeartIcon, GlobeAltIcon, UserCircleIcon, SparklesIcon, HomeIcon, BookOpenIcon, AcademicCapIcon, FireIcon, SunIcon, ChatBubbleLeftRightIcon, CommandLineIcon, LightBulbIcon, ArrowTrendingUpIcon, ClockIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, CpuChipIcon, CheckCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';

/**
 * Dashboard component - The main view after a user logs in.
 * It displays the core features of the Idii. AI Assistant platform.
 */
const Dashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userData, setUserData] = useState({ first_name: '', email: '' });
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [isAssistantDialogOpen, setIsAssistantDialogOpen] = useState(false);
  const [personalizedInsights, setPersonalizedInsights] = useState([]);
  const [recommendedAgents, setRecommendedAgents] = useState([]);
  const [careerInsightsStatus, setCareerInsightsStatus] = useState('loading');
  const [isImgError, setImgError] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('welcome');
  const [showSubTabs, setShowSubTabs] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitySummary, setActivitySummary] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyRecommendations, setDailyRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsLastFetched, setRecommendationsLastFetched] = useState(null);

  // Fetch user data and avatar on component mount
  useEffect(() => {
    fetchUserData();
    fetchAvatar();
    generatePersonalizedInsights();
    fetchRecentActivities();
    fetchActivitySummary();
    fetchDailyRecommendations();
  }, []);

  // Trigger animation when user data is loaded
  useEffect(() => {
    if (userData.first_name && user) {
      // Delay animation slightly to ensure component is fully rendered
      const timer = setTimeout(() => {
        setTriggerAnimation(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userData.first_name, user]);

  // Re-fetch activities when showAllActivities changes
  useEffect(() => {
    fetchRecentActivities();
  }, [showAllActivities]);

  // Setup timer to update time display dynamically
  useEffect(() => {
    // Simple timer that updates every 10 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(timer);
  }, []);

  // Setup 24-hour refresh for recommendations
  useEffect(() => {
    const checkRecommendationsRefresh = () => {
      if (shouldRefreshRecommendations()) {
        console.log('24 hours passed, refreshing recommendations...');
        fetchDailyRecommendations();
      }
    };

    // Check every hour for recommendation refresh
    const timer = setInterval(checkRecommendationsRefresh, 60 * 60 * 1000); // Check every hour

    // Also check immediately when component mounts
    checkRecommendationsRefresh();

    return () => clearInterval(timer);
  }, [recommendationsLastFetched]);

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      setUserData({
        name: data.first_name,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Generate personalized insights based on user data
  const generatePersonalizedInsights = async () => {
    try {
      setCareerInsightsStatus('loading');

      // Fetch career insights from API
      const careerInsightsResponse = await careerInsightsAPI.getSummary();

      let insights = [];

      if (careerInsightsResponse.status === 'success') {
        // Use real career insights data
        insights = careerInsightsResponse.insights.map(insight => ({
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

        setCareerInsightsStatus('success');
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
        setCareerInsightsStatus('no_analysis');
      } else {
        setCareerInsightsStatus('error');
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

      setPersonalizedInsights(insights);

    } catch (error) {
      console.error('Error fetching career insights:', error);
      setCareerInsightsStatus('error');

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
      setPersonalizedInsights(fallbackInsights);
    }

    // Generate recommended agents based on user activity and profile
    const recommended = [
      { name: 'Career Agent', priority: 1, reason: 'Most relevant to your goals' },
      { name: 'Money Agent', priority: 2, reason: 'High potential impact' },
      { name: 'Mind Agent', priority: 3, reason: 'Trending in your network' }
    ];
    setRecommendedAgents(recommended);
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


  // Sort agents based on recommendations
  const getSortedAgents = () => {
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
  };

  const fetchAvatar = async () => {
    try {
      const data = await profileAPI.getAvatarUrl();
      // In development mode, prepend backend URL to relative avatar paths
      let url = data.url;
      if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        url = backendUrl + url;
      }
      setAvatarUrl(url);
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  };

  // Fetch recent activities
  const fetchRecentActivities = async (limit = null) => {
    try {
      setLoadingActivities(true);
      const activityLimit = limit || (showAllActivities ? 10 : 5);
      const activities = await activitiesAPI.getRecentActivities(activityLimit);
      setRecentActivities(activities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      // Keep empty array on error
      setRecentActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Fetch activity summary
  const fetchActivitySummary = async () => {
    try {
      const summary = await activitiesAPI.getActivitySummary(7); // Last 7 days
      setActivitySummary(summary);
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
      setLoadingRecommendations(true);
      const response = await dailyRecommendationsAPI.getRecommendations();

      // Accept any valid recommendations regardless of status (success, cached, fallback)
      if (response.recommendations && response.recommendations.length > 0) {
        setDailyRecommendations(response.recommendations);
        setRecommendationsLastFetched(new Date());
        console.log(`Loaded ${response.recommendations.length} recommendations`);
      } else {
        // Fallback to static recommendations if API fails
        console.log('No recommendations received, using fallback');
        setDailyRecommendations(getStaticFallbackRecommendations());
      }
    } catch (error) {
      console.error('Error fetching daily recommendations:', error);
      // Fallback to static recommendations
      setDailyRecommendations(getStaticFallbackRecommendations());
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Force generate new recommendations (for refresh button)
  const forceGenerateRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      const response = await dailyRecommendationsAPI.generateRecommendations();

      // Accept any valid recommendations regardless of status (success, cached, fallback)
      if (response.recommendations && response.recommendations.length > 0) {
        setDailyRecommendations(response.recommendations);
        setRecommendationsLastFetched(new Date());
        console.log(`✅ Generated ${response.recommendations.length} new recommendations (${response.status})`);
      } else {
        // Fallback to static recommendations if API fails
        console.log('⚠️ No recommendations generated, using static fallback');
        setDailyRecommendations(getStaticFallbackRecommendations());
      }
    } catch (error) {
      console.error('Error generating new recommendations:', error);
      // Fallback to static recommendations
      setDailyRecommendations(getStaticFallbackRecommendations());
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Static fallback recommendations
  const getStaticFallbackRecommendations = () => [
    {
      id: "career_profile_review",
      title: "Profile Boost",
      description: "Optimize your LinkedIn profile with compelling headlines, achievements, and keywords to attract opportunities",
      category: "career",
      priority: "high",
      estimated_time: "25 min",
      action_type: "review",
      color: "blue",
      icon: "BriefcaseIcon"
    },
    {
      id: "skill_assessment",
      title: "Market Analysis",
      description: "Identify 3 high-demand skills in your target market and create a strategic learning roadmap",
      category: "learning",
      priority: "high",
      estimated_time: "25 min",
      action_type: "explore",
      color: "purple",
      icon: "AcademicCapIcon"
    },
    {
      id: "industry_networking",
      title: "Industry Connect",
      description: "Research and reach out to 3 industry leaders with thoughtful messages to expand your professional circle",
      category: "networking",
      priority: "medium",
      estimated_time: "35 min",
      action_type: "connect",
      color: "green",
      icon: "UserGroupIcon"
    }
  ];

  // Check if recommendations need refresh (24 hour logic)
  const shouldRefreshRecommendations = () => {
    if (!recommendationsLastFetched) return true;

    const now = new Date();
    const lastFetch = new Date(recommendationsLastFetched);
    const hoursSinceLastFetch = (now - lastFetch) / (1000 * 60 * 60);

    return hoursSinceLastFetch >= 24;
  };

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
    setIsAssistantDialogOpen(true);
    // Reset assistant position to bottom right corner
    if (window.resetAssistantPosition) {
      window.resetAssistantPosition();
    }
    // Note: Chat activity is now tracked when messages are actually sent in ChatDialog
  };

  // Handler for view all activities toggle
  const handleViewAllActivities = () => {
    setShowAllActivities(!showAllActivities);
  };

  // Handler for sidebar toggle
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Handler for tab change
  const handleTabChange = (tabId) => {
    // Check if tab is disabled
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.disabled) {
      return; // Don't change tab if disabled
    }

    setActiveTab(tabId);
    if (!sidebarExpanded) {
      setSidebarExpanded(true);
    }
    // Always show sub-tabs when clicking any tab
    setShowSubTabs(true);
  };

  // Handler for Dashboard Sections toggle
  const handleDashboardSectionsToggle = () => {
    if (activeTab === 'welcome' && showSubTabs) {
      // If already on welcome page and sub-tabs are shown, just toggle sub-tabs
      setShowSubTabs(!showSubTabs);
    } else {
      // Otherwise, go to welcome page and show sub-tabs
      setActiveTab('welcome');
      setShowSubTabs(true);
    }
    if (!sidebarExpanded) {
      setSidebarExpanded(true);
    }
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
      name: 'Body Agent',
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

  // Tab configuration
  const tabs = [
    {
      id: 'insights',
      name: 'AI Insights',
      icon: LightBulbIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'achievements',
      name: 'Achievements',
      icon: StarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      disabled: true // Coming soon
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      icon: SunIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
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
              if (description.includes('•')) {
                const bulletPoints = description.split('•').filter(point => point.trim());
                return (
                  <ul className="space-y-2">
                    {bulletPoints.map((point, index) => (
                      <li key={index} className="flex items-start">
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
          <div className="space-y-3">
            {recentActivities.map((activity) => {
              // Determine color and icon based on activity type and source
              const getActivityStyle = (activity) => {
                if (activity.activity_type === 'chat') {
                  const isEdit = activity.activity_metadata?.action_type === 'edit';
                  // Special handling for chat messages
                  if (activity.activity_source === 'dashboard') {
                    return {
                      color: 'bg-purple-500',
                      title: isEdit ? '✏️ Personal Assistant Edit' : '💬 Personal Assistant Chat',
                      description: isEdit ? 'Edited dashboard conversation' : 'Started dashboard conversation',
                      icon: isEdit ? '✏️' : '💬'
                    };
                  } else if (activity.activity_source === 'career') {
                    return {
                      color: 'bg-green-500',
                      title: isEdit ? '✏️ Career Assistant Edit' : '💼 Career Assistant Chat',
                      description: isEdit ? 'Edited career agent conversation' : 'Started career agent conversation',
                      icon: isEdit ? '✏️' : '💼'
                    };
                  }
                } else if (activity.activity_type === 'resume_analysis') {
                  return {
                    color: 'bg-blue-500',
                    title: '📄 Resume Analysis',
                    description: activity.activity_description,
                    icon: '📄'
                  };
                }

                // Default colors for other activities
                switch (activity.activity_source) {
                  case 'career':
                    return {
                      color: 'bg-blue-500',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '💼'
                    };
                  case 'money':
                    return {
                      color: 'bg-green-500',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '💰'
                    };
                  case 'mind':
                    return {
                      color: 'bg-purple-500',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '🧠'
                    };
                  case 'travel':
                    return {
                      color: 'bg-indigo-500',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '✈️'
                    };
                  case 'dashboard':
                    return {
                      color: 'bg-gray-500',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '📊'
                    };
                  default:
                    return {
                      color: 'bg-gray-400',
                      title: activity.activity_title,
                      description: activity.activity_description,
                      icon: '📝'
                    };
                }
              };

              // Format time ago with comprehensive time units
              const formatTimeAgo = (dateString) => {
                const now = currentTime;
                // Force treat dateString as UTC by adding 'Z' if no timezone info
                let utcDateString = dateString;

                // Check for timezone info (+ or - after 'T', or 'Z' at end)
                const hasTimezoneInfo = dateString.includes('Z') ||
                                      dateString.includes('+', dateString.indexOf('T')) ||
                                      dateString.includes('-', dateString.indexOf('T'));

                if (!hasTimezoneInfo) {
                  // Remove any microseconds and add Z
                  if (dateString.includes('.')) {
                    utcDateString = dateString.split('.')[0] + 'Z';
                  } else {
                    utcDateString = dateString + 'Z';
                  }
                }
                const activityDate = new Date(utcDateString);
                const diffInMilliseconds = now - activityDate;


                // Less than 1 minute
                const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
                if (diffInSeconds < 60) {
                  if (diffInSeconds < 5) return 'just now';
                  return `${diffInSeconds} second${diffInSeconds === 1 ? '' : 's'} ago`;
                }

                // Less than 1 hour
                const diffInMinutes = Math.floor(diffInSeconds / 60);
                if (diffInMinutes < 60) {
                  return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
                }

                // Less than 1 day
                const diffInHours = Math.floor(diffInMinutes / 60);
                if (diffInHours < 24) {
                  return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
                }

                // Less than 1 month (30 days)
                const diffInDays = Math.floor(diffInHours / 24);
                if (diffInDays < 30) {
                  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
                }

                // Less than 1 year (365 days)
                const diffInMonths = Math.floor(diffInDays / 30);
                if (diffInDays < 365) {
                  return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
                }

                // 1 year or more
                const diffInYears = Math.floor(diffInDays / 365);
                return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
              };

              const style = getActivityStyle(activity);

              return (
                <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className={`w-3 h-3 ${style.color} rounded-full mt-1.5 flex-shrink-0 shadow-sm`}></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 font-medium truncate">{style.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.created_at)}</p>
                    {style.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{style.description}</p>
                    )}
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
    const highPriorityRec = dailyRecommendations.find(rec => rec.priority === 'high') || dailyRecommendations[0];

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
          agents={getSortedAgents()}
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
                  <span className="text-white font-bold text-sm">S</span>
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
                      onError={() => setImgError(true)}
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


        {/* Sidebar and Tab Content Section */}
        <div className="relative flex min-h-screen">
          {/* Sidebar */}
          <div className={`fixed left-0 top-16 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 shadow-sm ${
            sidebarExpanded ? 'w-72' : 'w-14'
          }`}>
            {/* Sidebar Toggle Button */}
            <div className="absolute -right-3 top-6 z-50">
              <button
                onClick={toggleSidebar}
                className="w-6 h-6 bg-white border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md"
                aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {sidebarExpanded ? (
                  <ChevronLeftIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="px-3 py-4 h-full">
              {!sidebarExpanded ? (
                /* Collapsed Sidebar - Show only icons */
                <div className="space-y-2 mt-4">
                  {/* Dashboard Sections Icon */}
                  <button
                    onClick={handleDashboardSectionsToggle}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 group ${
                      activeTab === 'welcome'
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title="Dashboard"
                  >
                    <HomeIcon className="h-4 w-4" />
                  </button>
                  {/* Sub-tabs Icons */}
                  {tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    const isDisabled = tab.disabled;
                    const tabTitle = isDisabled ? `${tab.name} - Coming Soon` : tab.name;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        disabled={isDisabled}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 group ${
                          isDisabled
                            ? 'text-gray-300 cursor-not-allowed opacity-50'
                            : activeTab === tab.id
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                        title={tabTitle}
                      >
                        <IconComponent className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Expanded Sidebar - Show hierarchical structure */
                <div className="space-y-1 mt-4">
                  {/* Main Dashboard Sections Button */}
                  <button
                    onClick={handleDashboardSectionsToggle}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'welcome'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <HomeIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium text-left flex-1">Dashboard</span>
                    {showSubTabs ? (
                      <ChevronUpIcon className="h-3 w-3 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-3 w-3 text-gray-400" />
                    )}
                  </button>

                  {/* Sub-tabs */}
                  {showSubTabs && (
                    <div className="ml-3 space-y-1 border-l border-gray-200 pl-3">
                      {tabs.map((tab) => {
                        const IconComponent = tab.icon;
                        const isDisabled = tab.disabled;

                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            disabled={isDisabled}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-all duration-200 text-sm ${
                              isDisabled
                                ? 'text-gray-400 cursor-not-allowed opacity-60'
                                : activeTab === tab.id
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <IconComponent className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium text-left flex-1">{tab.name}</span>
                            {isDisabled && (
                              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                Coming Soon
                              </span>
                            )}
                            {!isDisabled && activeTab === tab.id && (
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
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

        {/* Personal Assistant Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PersonalAssistant 
            user={userData} 
            isDialogOpen={isAssistantDialogOpen}
            setIsDialogOpen={setIsAssistantDialogOpen}
          />
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
    </div>
  );
};

export default Dashboard;