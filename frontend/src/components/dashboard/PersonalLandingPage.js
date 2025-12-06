import { useState, useEffect } from 'react';
import { 
  Briefcase,
  GraduationCap,
  UserPlus,
  BookOpen,
  TrendingUp,
  Users
} from 'lucide-react';
import WelcomeSection from './WelcomeSection';
import DailySuggestions from './DailySuggestions';
import RecentInsights from './RecentInsights';
import PriorityActionCard from './PriorityActionCard';
import { dailyRecommendations as dailyRecommendationsAPI } from '../../services/api';
import { getStaticFallbackRecommendations } from '../../utils/recommendations';

export default function PersonalLandingPage({ onUploadResume, onCustomizeProfile, onNavigateToCareerInsights, user= "Todd" }) {
  const [dailyRecommendations, setDailyRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsLastFetched, setRecommendationsLastFetched] = useState(null);

  // Fetch daily recommendations
  const fetchDailyRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      const response = await dailyRecommendationsAPI.getRecommendations();

      // Accept any valid recommendations regardless of status (success, cached, fallback)
      if (response.recommendations && response.recommendations.length > 0) {
        setDailyRecommendations(response.recommendations);
        setRecommendationsLastFetched(new Date());
        if (process.env.NODE_ENV === 'development' && window.memoryMonitor?.verbose) console.log(`Loaded ${response.recommendations.length} recommendations`);
      } else {
        // Fallback to static recommendations if API fails
        if (process.env.NODE_ENV === 'development' && window.memoryMonitor?.verbose) console.log('No recommendations received, using fallback');
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
        if (process.env.NODE_ENV === 'development' && window.memoryMonitor?.verbose) console.log(`Generated ${response.recommendations.length} new recommendations (${response.status})`);
      } else {
        // Fallback to static recommendations if API fails
        if (process.env.NODE_ENV === 'development' && window.memoryMonitor?.verbose) console.log('No recommendations generated, using static fallback');
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
    
    // Handler for priority action "Get Started" button
  const handlePriorityActionStart = (recommendation) => {
    if (process.env.NODE_ENV === 'development' && window.memoryMonitor?.verbose) console.log('Starting priority action:', recommendation);
    // Add your custom logic here (e.g., navigate to specific page, open modal, etc.)
  };

    const suggestions = dailyRecommendations.length > 0 ? dailyRecommendations : getStaticFallbackRecommendations();
     // Get the high priority recommendation for the priority section
    const highPriorityRec = dailyRecommendations.find(rec => rec.priority === 'high') || dailyRecommendations[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Section */}
      <WelcomeSection 
        onUploadResume={onUploadResume}
        onCustomizeProfile={onCustomizeProfile}
        userName={user}
      />

      {/* AI Suggestions Section */}
      <DailySuggestions
        suggestions={suggestions}
        loading={loadingRecommendations}
        onRefresh={forceGenerateRecommendations}
        getRecommendationIcon={getRecommendationIcon}
        getRecommendationColor={getRecommendationColor}
      />
          
          {/* Priority Action for Today */}
      <PriorityActionCard
        recommendation={highPriorityRec}
        onGetStarted={handlePriorityActionStart}
      />

      {/* Recent Insights Section */}
      <RecentInsights onNavigateToCareerInsights={onNavigateToCareerInsights} />
    </div>
  );
}