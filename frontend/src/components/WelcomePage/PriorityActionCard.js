import { Star as StarIcon, Clock as ClockIcon } from 'lucide-react';

/**
 * PriorityActionCard Component
 * 
 * Displays a high-priority recommendation card with emphasis styling
 * 
 * Props:
 * - recommendation: Object - The recommendation to display
 *   {
 *     title: string,
 *     description: string,
 *     estimated_time: string,
 *     category: string,
 *     priority: string
 *   }
 * - onGetStarted: Function - Optional callback when "Get Started" is clicked
 */
export default function PriorityActionCard({ recommendation, onGetStarted }) {
  if (!recommendation) return null;

  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted(recommendation);
    } else {
      console.log('Get started with:', recommendation);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <StarIcon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Priority Action for Today</h3>
            <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
              HIGH IMPACT
            </span>
          </div>
          <p className="text-gray-600 mb-4">{recommendation.description}</p>
          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-2 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Get Started
            </button>
            {recommendation.estimated_time && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <ClockIcon className="h-4 w-4" />
                <span>Est: {recommendation.estimated_time}</span>
              </div>
            )}
            {recommendation.category && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <StarIcon className="h-4 w-4" />
                <span>Category: {recommendation.category}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}