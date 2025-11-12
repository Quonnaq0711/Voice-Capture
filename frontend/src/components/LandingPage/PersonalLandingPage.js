import { useState, useEffect } from 'react';
import { 
  Upload, 
  User, 
  Sparkles, 
  RefreshCw,
  TrendingUp,
  Users,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Briefcase,
  GraduationCap,
  UserPlus
} from 'lucide-react';
import { dailyRecommendationsAPI, profileAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function PersonalLandingPage() {
  const [activeTab, setActiveTab] = useState('suggestions');
    const [dailyRecommendations, setDailyRecommendations] = useState([]);
    const [userData, setUserData] = useState({ first_name: '', email: '' });
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsLastFetched, setRecommendationsLastFetched] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUserData();
    }, []);

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
      setRefreshing(true);
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
      setRefreshing(false);
    }
  };

  // Check if recommendations need refresh (24 hour logic)
  const shouldRefreshRecommendations = () => {
    if (!recommendationsLastFetched) return true;

    const now = new Date();
    const lastFetch = new Date(recommendationsLastFetched);
    const hoursSinceLastFetch = (now - lastFetch) / (1000 * 60 * 60);

    return hoursSinceLastFetch >= 24;
  };

  // Get icon component based on recommendation
  const getRecommendationIcon = (rec) => {
    const iconMap = {
      'BriefcaseIcon': Briefcase,
      'AcademicCapIcon': GraduationCap,
      'UserGroupIcon': UserPlus,
      'BookOpen': BookOpen,
      'TrendingUp': TrendingUp,
      'Users': Users
    };
    return iconMap[rec.icon] || BookOpen;
  };

  // Get color classes based on recommendation
  const getRecommendationColor = (rec) => {
    const colorMap = {
      blue: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', actionColor: 'text-blue-600', actionHover: 'hover:text-blue-700' },
      purple: { iconBg: 'bg-purple-100', iconColor: 'text-purple-600', actionColor: 'text-purple-600', actionHover: 'hover:text-purple-700' },
      green: { iconBg: 'bg-green-100', iconColor: 'text-green-600', actionColor: 'text-green-600', actionHover: 'hover:text-green-700' },
      orange: { iconBg: 'bg-orange-100', iconColor: 'text-orange-600', actionColor: 'text-orange-600', actionHover: 'hover:text-orange-700' },
      pink: { iconBg: 'bg-pink-100', iconColor: 'text-pink-600', actionColor: 'text-pink-600', actionHover: 'hover:text-pink-700' }
    };
    return colorMap[rec.color] || colorMap.blue;
  };

  // Load recommendations on component mount
  useEffect(() => {
    if (shouldRefreshRecommendations()) {
      fetchDailyRecommendations();
    } else if (dailyRecommendations.length === 0) {
      // Load cached or fallback
      setDailyRecommendations(getStaticFallbackRecommendations());
    }
  }, []);

    const suggestions = dailyRecommendations.length > 0 ? dailyRecommendations : getStaticFallbackRecommendations();
    
    const handleAccount = () => {
        navigate('/profile')
    };

    const handleResumeUpload = () => {
        navigate('/agent/career')
    };

    const fetchUserData = async () => {
        try {
          const data = await profileAPI.getCurrentUser();
          setUserData({
            first_name: data.first_name,
            email: data.email
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 sm:p-8 md:p-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
         Welcome {userData.first_name || User?.email || ''}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 text-center max-w-4xl mx-auto">
          This is Idii. A platform where "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
          incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
          nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum 
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia"
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <button
                      className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      onClick={handleResumeUpload}
                  >
            <Upload className="h-5 w-5" />
            Upload Resume
          </button>
                  <button
                      className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      onClick={handleAccount}
                  >
            <User className="h-5 w-5" />
            Customize Profile
          </button>
        </div>
      </div>

      {/* AI Suggestions Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">AI Suggestions</h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Personalized daily guidance to help you stay on track
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('suggestions')}
                className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors relative ${
                  activeTab === 'suggestions'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Today's Suggestions
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors relative ${
                  activeTab === 'all'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Suggestions
              </button>
            </div>
            <button 
              onClick={forceGenerateRecommendations}
              disabled={refreshing}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Suggestion Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loadingRecommendations ? (
            // Loading skeleton
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))
          ) : suggestions.length === 0 ? (
            // Empty state
            <div className="col-span-full text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No suggestions available at the moment</p>
              <button
                onClick={forceGenerateRecommendations}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Generate Suggestions
              </button>
            </div>
          ) : (
            suggestions.map((suggestion) => {
              const IconComponent = getRecommendationIcon(suggestion);
              const colors = getRecommendationColor(suggestion);
              const actionLabel = suggestion.action_type 
                ? suggestion.action_type.charAt(0).toUpperCase() + suggestion.action_type.slice(1)
                : 'Start';

              return (
                <div
                  key={suggestion.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Card Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 ${colors.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${colors.iconColor}`} />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex-1">
                      {suggestion.title}
                    </h3>
                  </div>

                  {/* Card Description */}
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4 flex-1">
                    {suggestion.description}
                  </p>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">
                      {suggestion.estimated_time || suggestion.duration}
                    </span>
                    <button className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${colors.actionColor} ${colors.actionHover} transition-colors`}>
                      {actionLabel}
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Additional sections can be added here */}
    </div>
  );
}