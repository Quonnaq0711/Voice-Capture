import { useState, useEffect } from 'react';
import { 
  Briefcase,
  GraduationCap,
  UserPlus,
  BookOpen,
  TrendingUp,
  Users,
  DollarSign,
  Heart,
  Target,
  Award,
  TrendingUp as ArrowTrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import careerInsightsAPI from '../../services/api';

export default function RecentInsights() {
  const navigate = useNavigate();
  const [personalizedInsights, setPersonalizedInsights] = useState([]);
  const [careerInsightsStatus, setCareerInsightsStatus] = useState('loading');

  // Get icon component based on string name
  const getIconComponent = (iconName) => {
    const iconMap = {
      'BriefcaseIcon': Briefcase,
      'AcademicCapIcon': GraduationCap,
      'UserGroupIcon': UserPlus,
      'BookOpen': BookOpen,
      'TrendingUp': TrendingUp,
      'Users': Users,
      'DollarSign': DollarSign,
      'CurrencyDollarIcon': DollarSign,
      'Heart': Heart,
      'HeartIcon': Heart,
      'Target': Target,
      'Award': Award,
      'ArrowTrendingUpIcon': ArrowTrendingUp
    };
    return iconMap[iconName] || BookOpen;
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
            icon: Briefcase,
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
            icon: DollarSign,
            color: "bg-green-500",
            action: "Check Money Agent"
          },
          {
            id: 'wellness_recommendation',
            title: "Wellness Recommendation",
            description: "Consider incorporating mindfulness practices into your daily routine.",
            type: "mind",
            priority: "medium",
            icon: Heart,
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
          icon: ArrowTrendingUp,
          color: "bg-blue-500",
          action: "Explore Career Agent"
        },
        {
          id: 'financial_planning',
          title: "Financial Planning Insight",
          description: "Track your expenses and explore investment opportunities.",
          type: "money",
          priority: "medium",
          icon: DollarSign,
          color: "bg-green-500",
          action: "Check Money Agent"
        },
        {
          id: 'wellness_recommendation',
          title: "Wellness Recommendation",
          description: "Consider incorporating mindfulness practices into your daily routine.",
          type: "mind",
          priority: "medium",
          icon: Heart,
          color: "bg-pink-500",
          action: "Visit Mind Agent"
        }
      ];
      setPersonalizedInsights(fallbackInsights);
    }
  };

  // Load personalized insights on component mount
  useEffect(() => {
    generatePersonalizedInsights();
  }, []);

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
        // Loading skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
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

            return (
              <div key={insight.id} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors hover:shadow-md">
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
  );
}