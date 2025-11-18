import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Clock, 
  TrendingUp,
  FileText,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function ChatHistoryActivities({ activitiesAPI, onTrackActivity, onChatClick }) {
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'activity'
  const [chatHistory, setChatHistory] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitySummary, setActivitySummary] = useState(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      setLoadingChats(true);
      // Replace with your actual API call
      const response = await fetch('/api/v1/chat/history');
      const chats = await response.json();
      setChatHistory(chats);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      // Mock data for development
      setChatHistory([
        { id: 1, date: '1/1', name: 'Career guidance discussion', timestamp: '2025-01-01T10:30:00', unread: 2 },
        { id: 2, date: '1/1', name: 'Resume optimization tips', timestamp: '2025-01-01T14:20:00', unread: 0 },
        { id: 3, date: '1/2', name: 'Salary negotiation strategies', timestamp: '2025-01-02T09:15:00', unread: 1 },
        { id: 4, date: '1/2', name: 'Industry trends analysis', timestamp: '2025-01-02T16:45:00', unread: 0 },
        { id: 5, date: '1/3', name: 'Interview preparation', timestamp: '2025-01-03T11:00:00', unread: 0 },
        { id: 6, date: '1/3', name: 'LinkedIn profile review', timestamp: '2025-01-03T13:30:00', unread: 3 },
        { id: 7, date: '1/4', name: 'Job search strategy', timestamp: '2025-01-04T10:00:00', unread: 0 },
        { id: 8, date: '1/4', name: 'Networking tips', timestamp: '2025-01-04T15:20:00', unread: 0 },
        { id: 9, date: '1/5', name: 'Skills gap analysis', timestamp: '2025-01-05T09:30:00', unread: 0 },
        { id: 10, date: '1/5', name: 'Career transition planning', timestamp: '2025-01-05T14:00:00', unread: 0 }
      ]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Fetch recent activities
  const fetchRecentActivities = async (limit = null) => {
    try {
      setLoadingActivities(true);
      const activityLimit = limit || (showAllActivities ? 20 : 5);
      
      if (activitiesAPI) {
        const activities = await activitiesAPI.getRecentActivities(activityLimit);
        setRecentActivities(activities);
      } else {
        // Mock data for development
        const mockActivities = [
          {
            id: 1,
            activity_type: 'view',
            activity_source: 'career_insights',
            activity_title: 'Viewed Professional Identity Analysis',
            activity_description: 'Completed review of professional identity section',
            activity_metadata: { section: 'professional_identity', duration: '5m' },
            created_at: '2025-01-15T10:30:00Z'
          },
          {
            id: 2,
            activity_type: 'upload',
            activity_source: 'documents',
            activity_title: 'Uploaded Resume',
            activity_description: 'Resume_2025.pdf successfully uploaded',
            activity_metadata: { filename: 'Resume_2025.pdf', size: '245KB' },
            created_at: '2025-01-14T14:20:00Z'
          },
          {
            id: 3,
            activity_type: 'chat',
            activity_source: 'career_agent',
            activity_title: 'Career Consultation',
            activity_description: 'Discussed salary negotiation strategies',
            activity_metadata: { chat_id: 'chat_123', message_count: 15 },
            created_at: '2025-01-13T09:15:00Z'
          },
          {
            id: 4,
            activity_type: 'analysis',
            activity_source: 'salary_analysis',
            activity_title: 'Salary Analysis Completed',
            activity_description: 'Market comparison analysis finished',
            activity_metadata: { market_position: 'above_average' },
            created_at: '2025-01-12T16:45:00Z'
          },
          {
            id: 5,
            activity_type: 'profile_update',
            activity_source: 'profile',
            activity_title: 'Updated Profile Information',
            activity_description: 'Added new skills and experience',
            activity_metadata: { fields_updated: ['skills', 'experience'] },
            created_at: '2025-01-11T11:00:00Z'
          },
          {
            id: 6,
            activity_type: 'view',
            activity_source: 'market_analysis',
            activity_title: 'Reviewed Market Position',
            activity_description: 'Analyzed current market position and trends',
            activity_metadata: { section: 'market_position' },
            created_at: '2025-01-10T13:30:00Z'
          },
          {
            id: 7,
            activity_type: 'chat',
            activity_source: 'travel_agent',
            activity_title: 'Travel Planning Session',
            activity_description: 'Discussed upcoming business trip',
            activity_metadata: { chat_id: 'chat_124', destination: 'San Francisco' },
            created_at: '2025-01-09T10:00:00Z'
          },
          {
            id: 8,
            activity_type: 'download',
            activity_source: 'documents',
            activity_title: 'Downloaded Report',
            activity_description: 'Career insights report downloaded',
            activity_metadata: { filename: 'career_report.pdf' },
            created_at: '2025-01-08T15:20:00Z'
          }
        ];
        
        setRecentActivities(mockActivities.slice(0, activityLimit));
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Fetch activity summary
  const fetchActivitySummary = async () => {
    try {
      if (activitiesAPI) {
        const summary = await activitiesAPI.getActivitySummary(7);
        setActivitySummary(summary);
      } else {
        // Mock summary
        setActivitySummary({
          total_activities: 45,
          chats_started: 12,
          documents_uploaded: 8,
          insights_viewed: 15,
          profile_updates: 3,
          last_7_days_trend: '+23%'
        });
      }
    } catch (error) {
      console.error('Error fetching activity summary:', error);
    }
  };

  // Track activity when user interacts
  const trackActivity = async (activityType, activitySource, title, description = null, metadata = {}) => {
    try {
      if (activitiesAPI) {
        await activitiesAPI.createActivity({
          activity_type: activityType,
          activity_source: activitySource,
          activity_title: title,
          activity_description: description,
          activity_metadata: metadata
        });
      }
      
      // Track via callback if provided
      if (onTrackActivity) {
        onTrackActivity(activityType, activitySource, title, description, metadata);
      }
      
      // Refresh activities
      fetchRecentActivities();
      fetchActivitySummary();
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  // Handler for view all activities toggle
  const handleViewAllActivities = () => {
    setShowAllActivities(!showAllActivities);
    fetchRecentActivities(!showAllActivities ? 20 : 5);
  };

  // Handle chat click
  const handleChatClick = (chat) => {
    trackActivity('view', 'chat_history', `Opened chat: ${chat.name}`, null, { chat_id: chat.id });
    
    // Use callback if provided
    if (onChatClick) {
      onChatClick(chat);
    }
  };

  // Handle activity click
  const handleActivityClick = (activity) => {
    trackActivity('view', 'activity_history', `Viewed activity: ${activity.activity_title}`, null, { activity_id: activity.id });
    console.log('Activity clicked:', activity);
  };

  // Filter activities by type
  const getFilteredActivities = () => {
    let filtered = recentActivities;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.activity_type === filterType);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.activity_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.activity_description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Get activity icon
  const getActivityIcon = (activityType) => {
    const icons = {
      view: <FileText className="h-4 w-4" />,
      chat: <MessageSquare className="h-4 w-4" />,
      upload: <TrendingUp className="h-4 w-4" />,
      download: <TrendingUp className="h-4 w-4" />,
      analysis: <TrendingUp className="h-4 w-4" />,
      profile_update: <User className="h-4 w-4" />
    };
    return icons[activityType] || <Clock className="h-4 w-4" />;
  };

  // Get activity color
  const getActivityColor = (activityType) => {
    const colors = {
      view: 'bg-blue-100 text-blue-600',
      chat: 'bg-green-100 text-green-600',
      upload: 'bg-purple-100 text-purple-600',
      download: 'bg-orange-100 text-orange-600',
      analysis: 'bg-pink-100 text-pink-600',
      profile_update: 'bg-indigo-100 text-indigo-600'
    };
    return colors[activityType] || 'bg-gray-100 text-gray-600';
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    fetchChatHistory();
    fetchRecentActivities();
    fetchActivitySummary();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial ${
                activeTab === 'history'
                  ? 'text-gray-900 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="h-4 w-4 inline mr-2" />
              Chat History
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial ${
                activeTab === 'activity'
                  ? 'text-gray-900 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Activity
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              if (activeTab === 'history') {
                fetchChatHistory();
              } else {
                fetchRecentActivities();
                fetchActivitySummary();
              }
            }}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'history' ? (
          // Chat History View
          <div className="flex-1 overflow-y-auto">
            {/* Search Bar */}
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="p-3 sm:p-4">
              {loadingChats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No chat history found</p>
                </div>
              ) : (
                <div className="space-y-1 sm:space-y-2">
                  {chatHistory
                    .filter(chat => 
                      !searchQuery || 
                      chat.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleChatClick(chat)}
                        className="flex items-center justify-between space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                          <span className="text-xs sm:text-sm font-medium text-gray-500 w-6 sm:w-8 flex-shrink-0">
                            {chat.date}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-gray-700 truncate font-medium">
                              {chat.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTime(chat.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {chat.unread > 0 && (
                            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                              {chat.unread}
                            </span>
                          )}
                          <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Activity View
          <div className="flex-1 overflow-y-auto">
            {/* Activity Summary */}
            {activitySummary && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-pink-50 border-b border-gray-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Total Activities</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {activitySummary.total_activities}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Chats</p>
                    <p className="text-lg sm:text-xl font-bold text-green-600">
                      {activitySummary.chats_started}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Documents</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-600">
                      {activitySummary.documents_uploaded}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">7-Day Trend</p>
                    <p className="text-lg sm:text-xl font-bold text-purple-600">
                      {activitySummary.last_7_days_trend}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {filterType === 'all' ? 'All Types' : filterType}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                
                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {['all', 'view', 'chat', 'upload', 'download', 'analysis', 'profile_update'].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setFilterType(type);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                          filterType === type ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {type === 'all' ? 'All Types' : type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleViewAllActivities}
                className="text-xs sm:text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                {showAllActivities ? 'Show Less' : 'View All'}
              </button>
            </div>

            {/* Activity Timeline */}
            <div className="p-3 sm:p-4">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : getFilteredActivities().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No activities found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredActivities().map((activity, index) => (
                    <div key={activity.id} className="relative">
                      {/* Timeline line */}
                      {index !== getFilteredActivities().length - 1 && (
                        <div className="absolute left-5 top-12 bottom-0 w-px bg-gray-200"></div>
                      )}
                      
                      {/* Activity Item */}
                      <div
                        onClick={() => handleActivityClick(activity)}
                        className="flex gap-3 sm:gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                      >
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.activity_type)}`}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {activity.activity_title}
                              </h4>
                              {activity.activity_description && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {activity.activity_description}
                                </p>
                              )}
                            </div>
                            <button className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>
                          
                          {/* Metadata */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(activity.created_at)}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                              {activity.activity_source.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}