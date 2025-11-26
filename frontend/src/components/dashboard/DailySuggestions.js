import { useState } from 'react';
import { Sparkles, RefreshCw, ArrowRight } from 'lucide-react';

export default function DailySuggestions({ 
  suggestions = [], 
  loading = false,
  onRefresh,
  getRecommendationIcon,
  getRecommendationColor 
}) {
  const [activeTab, setActiveTab] = useState('suggestions');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setRefreshing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Today's AI Suggestions</h2>
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
              Today's <span className="hidden sm:inline">Suggestions</span>
            </button>
            {/* <button
              onClick={() => setActiveTab('all')}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors relative ${
                activeTab === 'all'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Suggestions
            </button> */}
          </div>
          <button 
            onClick={handleRefresh}
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
        {loading ? (
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
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Generate Suggestions
            </button>
          </div>
        ) : (
          suggestions.map((suggestion) => {
            const IconComponent = getRecommendationIcon ? getRecommendationIcon(suggestion) : Sparkles;
            const colors = getRecommendationColor ? getRecommendationColor(suggestion) : {
              iconBg: 'bg-blue-100',
              iconColor: 'text-blue-600',
              actionColor: 'text-blue-600',
              actionHover: 'hover:text-blue-700'
            };
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
  );
}