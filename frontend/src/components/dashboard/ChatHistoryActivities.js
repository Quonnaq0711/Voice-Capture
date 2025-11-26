import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Clock,
  TrendingUp,
  FileText,
  User,
  Calendar,
  ExternalLink,
  Search,
  RefreshCw,
  BarChart3,
  Sparkles,
  Mail,
  Filter,
  FolderOpen,
  Send,
  PenLine,
  X
} from 'lucide-react';
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  HeartIcon,
  MapPinIcon,
  AcademicCapIcon,
  HomeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  SparklesIcon,
  ChartBarIcon,
  FireIcon,
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { sessions as sessionsAPI } from '../../services/api';
import { formatTime as formatTimeUTC } from '../../utils/timeFormatter';

// Usage Analytics Component
const UsageAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    weeklyUsage: [],
    agentStats: [],
    totalSessions: 0,
    totalMessages: 0,
    mostUsedAgent: '',
    loading: true
  });

  const agentTabs = [
    { id: 'career', name: 'Career', icon: BriefcaseIcon, color: 'blue' },
    { id: 'money', name: 'Money', icon: CurrencyDollarIcon, color: 'green' },
    { id: 'body', name: 'Wellness', icon: HeartIcon, color: 'red' },
    { id: 'travel', name: 'Travel', icon: MapPinIcon, color: 'purple' },
    { id: 'mind', name: 'Mind', icon: AcademicCapIcon, color: 'indigo' },
    { id: 'family', name: 'Family', icon: HomeIcon, color: 'orange' },
    { id: 'hobby', name: 'Hobby', icon: PuzzlePieceIcon, color: 'pink' },
    { id: 'knowledge', name: 'Knowledge', icon: BookOpenIcon, color: 'teal' },
    { id: 'spiritual', name: 'Spiritual', icon: SparklesIcon, color: 'yellow' }
  ];

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Simulate API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data for demonstration
      const mockData = {
        weeklyUsage: [
          { day: 'Mon', career: 12, money: 8, body: 5, travel: 3, mind: 15, family: 7, hobby: 4, knowledge: 10, spiritual: 2 },
          { day: 'Tue', career: 15, money: 12, body: 8, travel: 6, mind: 18, family: 9, hobby: 6, knowledge: 14, spiritual: 4 },
          { day: 'Wed', career: 18, money: 15, body: 12, travel: 8, mind: 22, family: 11, hobby: 8, knowledge: 16, spiritual: 6 },
          { day: 'Thu', career: 22, money: 18, body: 15, travel: 12, mind: 25, family: 14, hobby: 10, knowledge: 20, spiritual: 8 },
          { day: 'Fri', career: 25, money: 20, body: 18, travel: 15, mind: 28, family: 16, hobby: 12, knowledge: 22, spiritual: 10 },
          { day: 'Sat', career: 20, money: 16, body: 14, travel: 18, mind: 24, family: 20, hobby: 15, knowledge: 18, spiritual: 12 },
          { day: 'Sun', career: 16, money: 12, body: 10, travel: 14, mind: 20, family: 18, hobby: 14, knowledge: 16, spiritual: 15 }
        ],
        agentStats: [
          { agent: 'mind', usage: 162, sessions: 45, avgDuration: '8.5 min', trend: '+12%', satisfaction: 4.8, efficiency: 92 },
          { agent: 'career', usage: 128, sessions: 38, avgDuration: '12.3 min', trend: '+8%', satisfaction: 4.6, efficiency: 88 },
          { agent: 'knowledge', usage: 116, sessions: 35, avgDuration: '10.2 min', trend: '+15%', satisfaction: 4.7, efficiency: 90 },
          { agent: 'money', usage: 101, sessions: 32, avgDuration: '9.8 min', trend: '+5%', satisfaction: 4.5, efficiency: 85 },
          { agent: 'family', usage: 95, sessions: 28, avgDuration: '11.5 min', trend: '+18%', satisfaction: 4.9, efficiency: 94 },
          { agent: 'body', usage: 82, sessions: 25, avgDuration: '7.2 min', trend: '+3%', satisfaction: 4.4, efficiency: 82 },
          { agent: 'travel', usage: 76, sessions: 22, avgDuration: '13.1 min', trend: '+22%', satisfaction: 4.8, efficiency: 91 },
          { agent: 'hobby', usage: 69, sessions: 20, avgDuration: '6.8 min', trend: '+7%', satisfaction: 4.3, efficiency: 79 },
          { agent: 'spiritual', usage: 57, sessions: 18, avgDuration: '14.2 min', trend: '+25%', satisfaction: 4.9, efficiency: 95 }
        ],
        totalSessions: 263,
        totalMessages: 886,
        mostUsedAgent: 'mind',
        timeDistribution: {
          morning: { sessions: 78, percentage: 29.7, peak: '9:00 AM' },
          afternoon: { sessions: 102, percentage: 38.8, peak: '2:30 PM' },
          evening: { sessions: 68, percentage: 25.9, peak: '7:00 PM' },
          night: { sessions: 15, percentage: 5.7, peak: '11:30 PM' }
        },
        usagePatterns: {
          averageSessionLength: '10.2 min',
          longestSession: '45 min',
          shortestSession: '2 min',
          peakUsageDay: 'Friday',
          quietestDay: 'Sunday',
          streakDays: 12,
          weeklyGrowth: '+15.3%'
        },
        productivityMetrics: {
          taskCompletionRate: 87.5,
          averageResponseTime: '2.3s',
          userSatisfactionScore: 4.6,
          goalAchievementRate: 73.2,
          knowledgeRetentionScore: 82.1
        },
        monthlyComparison: [
          { month: 'Jan', sessions: 180, messages: 620, satisfaction: 4.2 },
          { month: 'Feb', sessions: 195, messages: 685, satisfaction: 4.3 },
          { month: 'Mar', sessions: 220, messages: 750, satisfaction: 4.5 },
          { month: 'Apr', sessions: 245, messages: 820, satisfaction: 4.6 },
          { month: 'May', sessions: 263, messages: 886, satisfaction: 4.6 }
        ],
        insights: [
          {
            type: 'peak_performance',
            title: 'Peak Performance Time',
            description: 'You are most productive between 2-4 PM with 38.8% of your sessions.',
            recommendation: 'Schedule important tasks during afternoon hours for optimal results.',
            impact: 'high'
          },
          {
            type: 'agent_preference',
            title: 'Learning Focus',
            description: 'Mind and Career agents account for 55% of your usage, showing strong focus on personal development.',
            recommendation: 'Consider exploring Wellness and Travel agents for a more balanced lifestyle approach.',
            impact: 'medium'
          },
          {
            type: 'consistency',
            title: 'Consistent Usage',
            description: 'You have maintained a 12-day streak, showing excellent engagement.',
            recommendation: 'Keep up the momentum! Set daily reminders to maintain your streak.',
            impact: 'high'
          },
          {
            type: 'efficiency',
            title: 'Session Efficiency',
            description: 'Your average session length of 10.2 minutes indicates focused, productive interactions.',
            recommendation: 'Continue with current session patterns for optimal learning outcomes.',
            impact: 'medium'
          }
        ]
      };

      setAnalyticsData({ ...mockData, loading: false });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setAnalyticsData(prev => ({ ...prev, loading: false }));
    }
  };

  const getAgentInfo = (agentId) => {
    return agentTabs.find(tab => tab.id === agentId) || { name: agentId, icon: ChartBarIcon, color: 'gray' };
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-500 text-blue-100 border-blue-400',
      green: 'bg-green-500 text-green-100 border-green-400',
      red: 'bg-red-500 text-red-100 border-red-400',
      purple: 'bg-purple-500 text-purple-100 border-purple-400',
      indigo: 'bg-indigo-500 text-indigo-100 border-indigo-400',
      orange: 'bg-orange-500 text-orange-100 border-orange-400',
      pink: 'bg-pink-500 text-pink-100 border-pink-400',
      teal: 'bg-teal-500 text-teal-100 border-teal-400',
      yellow: 'bg-yellow-500 text-yellow-100 border-yellow-400'
    };
    return colorMap[color] || 'bg-gray-500 text-gray-100 border-gray-400';
  };

  if (analyticsData.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
          <ChartBarIcon className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Usage Analytics</h2>
        <p className="text-gray-600">Track your AI assistant usage patterns and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Sessions</p>
              <p className="text-2xl font-bold text-blue-900">{analyticsData.totalSessions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Messages</p>
              <p className="text-2xl font-bold text-green-900">{analyticsData.totalMessages}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Most Used Agent</p>
              <p className="text-2xl font-bold text-purple-900 capitalize">{getAgentInfo(analyticsData.mostUsedAgent).name}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <FireIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Avg Session Time</p>
              <p className="text-2xl font-bold text-orange-900">9.8 min</p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-xl border border-blue-200 text-center">
        <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Advanced Analytics Coming Soon</h3>
        <p className="text-gray-600">Detailed usage patterns, productivity metrics, and AI-powered insights will be available in the next update.</p>
      </div>
    </div>
  );
};

export default function ChatHistoryActivities({ activitiesAPI, onTrackActivity, onChatClick }) {
  const [activeTab, setActiveTab] = useState('activity'); // 'activity', 'history', or 'analytics'
  const [chatHistory, setChatHistory] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'today', 'week', 'month', 'all'

  // Pagination state for Session History
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Pagination state for Activities
  const [activityPage, setActivityPage] = useState(1);
  const activityItemsPerPage = 5;
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityDateFilter, setActivityDateFilter] = useState('all'); // 'today', 'week', 'month', 'all'
  const [activityTypeFilter, setActivityTypeFilter] = useState('all'); // 'all', 'sessions', 'messages', 'analysis', 'documents'

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      setLoadingChats(true);
      const sessions = await sessionsAPI.getSessions();

      // Transform sessions data to match expected format (with null check)
      const transformedSessions = (sessions || []).map(session => {
        const date = new Date(session.created_at || session.first_message_time);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

        return {
          id: session.id,
          date: dateStr,
          name: session.session_name || 'Untitled Chat',
          timestamp: session.first_message_time || session.created_at,
          unread: session.unread ? 1 : 0,
          message_count: session.message_count || 0
        };
      });

      setChatHistory(transformedSessions);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      // Set empty array on error
      setChatHistory([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Fetch recent activities
  const fetchRecentActivities = async (limit = null) => {
    try {
      setLoadingActivities(true);
      const activityLimit = limit || 100; // Get recent 100 activities

      if (activitiesAPI) {
        const activities = await activitiesAPI.getRecentActivities(activityLimit);
        setRecentActivities(activities);
      } else {
        // Mock data for development
        const mockActivities = [
          {
            id: 1,
            activity_type: 'analysis',
            activity_source: 'documents',
            activity_title: 'Analyzing Resume_2025.pdf',
            activity_description: 'Started resume analysis',
            activity_metadata: { resume_filename: 'Resume_2025.pdf', document_id: 1 },
            created_at: '2025-01-15T10:30:00Z'
          },
          {
            id: 2,
            activity_type: 'chat',
            activity_source: 'dashboard',
            activity_title: 'Sent message to Personal Assistant from dashboard',
            activity_description: 'Asked about career opportunities',
            activity_metadata: { chat_id: 'chat_123' },
            created_at: '2025-01-14T14:20:00Z'
          },
          {
            id: 3,
            activity_type: 'chat',
            activity_source: 'dashboard',
            activity_title: 'Chat Message Edit - dashboard',
            activity_description: 'Updated previous message',
            activity_metadata: { chat_id: 'chat_123', message_id: 456 },
            created_at: '2025-01-13T16:15:00Z'
          },
          {
            id: 4,
            activity_type: 'chat',
            activity_source: 'career_agent',
            activity_title: 'Career Consultation',
            activity_description: 'Discussed salary negotiation strategies',
            activity_metadata: { chat_id: 'chat_124', message_count: 15 },
            created_at: '2025-01-13T09:15:00Z'
          },
          {
            id: 5,
            activity_type: 'analysis',
            activity_source: 'documents',
            activity_title: 'Resume Analysis Completed',
            activity_description: 'Completed analyzing Resume_2024.pdf',
            activity_metadata: { resume_filename: 'Resume_2024.pdf', document_id: 2 },
            created_at: '2025-01-12T16:45:00Z'
          },
          {
            id: 6,
            activity_type: 'chat',
            activity_source: 'career_agent',
            activity_title: 'Chat Message',
            activity_description: 'Asked about interview preparation',
            activity_metadata: { chat_id: 'chat_125' },
            created_at: '2025-01-11T11:00:00Z'
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
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  // Handle chat click
  const handleChatClick = (chat) => {
    // Activity tracking is handled by the parent's onChatClick callback
    // to avoid duplicate records
    if (onChatClick) {
      onChatClick(chat);
    }
  };

  // Filter chat history by search query and date
  const getFilteredChatHistory = () => {
    let filtered = [...(chatHistory || [])];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(chat => {
        const chatDate = new Date(chat.timestamp);
        const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

        switch (dateFilter) {
          case 'today':
            return chatDay.getTime() === today.getTime();
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return chatDay >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return chatDay >= monthAgo;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  // Get paginated chat history
  const getPaginatedChatHistory = () => {
    const filtered = getFilteredChatHistory();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate total pages for chat history
  const getTotalPages = () => {
    const filtered = getFilteredChatHistory();
    return Math.ceil(filtered.length / itemsPerPage);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Reset to first page when search query changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Extract detailed description from activity title for chat activities
  const extractActivityDetails = (activity) => {
    const { activity_type, activity_source, activity_title, activity_description } = activity;

    // For view activities from chat_history (opened session), extract session name from title
    if (activity_type === 'view' && activity_source === 'chat_history' && activity_title) {
      const colonIndex = activity_title.indexOf(':');
      if (colonIndex !== -1) {
        // Extract the part after the colon as details (session name)
        const details = activity_title.substring(colonIndex + 1).trim();
        return details || activity_description;
      }
    }

    // For chat activities, format as "Sent/Edited message in personal assistant"
    if (activity_type === 'chat' && activity_title) {
      const isEdit = activity_title.toLowerCase().includes('edit');
      if (isEdit) {
        return 'Edited message in personal assistant';
      }
      return 'Sent message in personal assistant';
    }

    return activity_description;
  };

  // Format activity title for better display
  const formatActivityTitle = (activity) => {
    const { activity_type, activity_source, activity_title } = activity;

    // Handle view activities from chat_history (opened session)
    if (activity_type === 'view' && activity_source === 'chat_history') {
      return 'Opened Session';
    }

    // Handle chat activities
    if (activity_type === 'chat') {
      // Check if it's an edit action
      if (activity_title && (activity_title.toLowerCase().includes('edit') || activity_title.toLowerCase().includes('edited'))) {
        return 'Edited Message';
      }
      // Regular chat message
      return 'Sent Message';
    }

    // Handle analysis activities (both 'analysis' and 'resume_analysis')
    if (activity_type === 'analysis' || activity_type === 'resume_analysis') {
      // Check if it's resume/document analysis
      if (activity_source === 'documents' ||
          activity_source === 'resume' ||
          activity_source === 'career' ||  // Backend uses 'career' for resume analysis
          (activity_title && activity_title.toLowerCase().includes('resume'))) {
        if (activity_title && activity_title.toLowerCase().includes('analyzing')) {
          return 'Analyzing Resume';
        }
        return 'Resume Analysis';
      }
      // Other analysis types - keep original but clean up
      return activity_title.replace(/Completed?$/i, '').trim();
    }

    // For other types, return the original title but remove redundant source info
    let title = activity_title;

    // Remove common redundant phrases
    title = title.replace(/from dashboard/gi, '');
    title = title.replace(/- dashboard/gi, '');
    title = title.replace(/from \w+/gi, ''); // Remove "from xxx"

    return title.trim();
  };

  // Filter activities by type
  const getFilteredActivities = () => {
    // Only show key activity types: analysis (Resume Analysis) and chat (Dashboard Chat, Career Chat)
    let filtered = recentActivities.filter(a =>
      a.activity_type === 'analysis' ||
      a.activity_type === 'resume_analysis' ||  // Backend uses 'resume_analysis'
      a.activity_type === 'view' ||  // Legacy activity type for old records
      a.activity_type === 'chat'
    );

    // Apply activity type filter
    if (activityTypeFilter !== 'all') {
      filtered = filtered.filter(a => {
        switch (activityTypeFilter) {
          case 'sessions':
            // Opened Session: view from chat_history
            return a.activity_type === 'view' && a.activity_source === 'chat_history';
          case 'messages':
            // Sent/Edited Message: chat type
            return a.activity_type === 'chat';
          case 'analysis':
            // Resume Analysis: analysis or resume_analysis type
            return a.activity_type === 'analysis' || a.activity_type === 'resume_analysis';
          case 'documents':
            // Document views: view from documents source
            return a.activity_type === 'view' && a.activity_source === 'documents';
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (activitySearchQuery.trim()) {
      filtered = filtered.filter(a => {
        const formattedTitle = formatActivityTitle(a);
        return formattedTitle.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
               a.activity_title.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
               a.activity_description?.toLowerCase().includes(activitySearchQuery.toLowerCase());
      });
    }

    // Apply date filter (same logic as Session History)
    if (activityDateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(activity => {
        const activityDate = new Date(activity.created_at);
        const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());

        switch (activityDateFilter) {
          case 'today':
            return activityDay.getTime() === today.getTime();
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return activityDay >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return activityDay >= monthAgo;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  // Get paginated activities
  const getPaginatedActivities = () => {
    const filtered = getFilteredActivities();
    const startIndex = (activityPage - 1) * activityItemsPerPage;
    const endIndex = startIndex + activityItemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate total pages for activities
  const getActivityTotalPages = () => {
    const filtered = getFilteredActivities();
    return Math.ceil(filtered.length / activityItemsPerPage);
  };

  // Handle activity page change
  const handleActivityPageChange = (pageNumber) => {
    setActivityPage(pageNumber);
  };

  // Reset to first page when activity search query changes
  const handleActivitySearchChange = (e) => {
    setActivitySearchQuery(e.target.value);
    setActivityPage(1);
  };

  // Get activity icon - matches Activity Type filter icons
  const getActivityIcon = (activity) => {
    const { activity_type, activity_source } = activity;

    // Sessions: view from chat_history (purple MessageSquare)
    if (activity_type === 'view' && activity_source === 'chat_history') {
      return <MessageSquare className="h-4 w-4" />;
    }

    // Documents: view from documents (blue FolderOpen)
    if (activity_type === 'view' && activity_source === 'documents') {
      return <FolderOpen className="h-4 w-4" />;
    }

    // Messages: chat type (green Send/paper plane)
    if (activity_type === 'chat') {
      return <Send className="h-4 w-4" />;
    }

    // Analysis: analysis or resume_analysis (pink TrendingUp)
    if (activity_type === 'analysis' || activity_type === 'resume_analysis') {
      return <TrendingUp className="h-4 w-4" />;
    }

    // Fallback icons for other types
    const icons = {
      view: <FileText className="h-4 w-4" />,
      upload: <TrendingUp className="h-4 w-4" />,
      download: <TrendingUp className="h-4 w-4" />,
      profile_update: <User className="h-4 w-4" />
    };
    return icons[activity_type] || <Clock className="h-4 w-4" />;
  };

  // Get activity color - matches Activity Type filter colors
  const getActivityColor = (activity) => {
    const { activity_type, activity_source } = typeof activity === 'object' ? activity : { activity_type: activity, activity_source: null };

    // Sessions: view from chat_history (purple)
    if (activity_type === 'view' && activity_source === 'chat_history') {
      return 'bg-purple-100 text-purple-600';
    }

    // Documents: view from documents (blue)
    if (activity_type === 'view' && activity_source === 'documents') {
      return 'bg-blue-100 text-blue-600';
    }

    // Messages: chat type (green)
    if (activity_type === 'chat') {
      return 'bg-green-100 text-green-600';
    }

    // Analysis: analysis or resume_analysis (pink)
    if (activity_type === 'analysis' || activity_type === 'resume_analysis') {
      return 'bg-pink-100 text-pink-600';
    }

    // Fallback colors for other types
    const colors = {
      view: 'bg-blue-100 text-blue-600',
      upload: 'bg-purple-100 text-purple-600',
      download: 'bg-orange-100 text-orange-600',
      profile_update: 'bg-indigo-100 text-indigo-600'
    };
    return colors[activity_type] || 'bg-gray-100 text-gray-600';
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

  // Format time - Use unified UTC formatter
  const formatTime = (dateString) => {
    return formatTimeUTC(dateString);
  };

  useEffect(() => {
    fetchChatHistory();
    fetchRecentActivities();
  }, []);

  // Auto-refresh activities when switching to Activity tab
  useEffect(() => {
    if (activeTab === 'activity') {
      fetchRecentActivities();
    }
  }, [activeTab]);

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex">
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial ${
                activeTab === 'activity'
                  ? 'text-gray-900 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Recent Activities
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial ${
                activeTab === 'history'
                  ? 'text-gray-900 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="h-4 w-4 inline mr-2" />
              Session History
            </button>
            <button
              disabled
              className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial text-gray-300 cursor-not-allowed"
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Usage Analytics
              <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs font-medium rounded">
                Coming Soon
              </span>
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              if (activeTab === 'history') {
                fetchChatHistory();
              } else if (activeTab === 'activity') {
                fetchRecentActivities();
              }
              // Analytics tab doesn't need refresh (it auto-loads on mount)
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
          // Session History View
          <div className="flex-1 overflow-y-auto">
            {/* Search Bar and Filters */}
            <div className="p-3 sm:p-4 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
              <div className="space-y-3">
                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filters Section */}
                <div className="space-y-3">
                  {/* Filter Header with Active Count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">Filters</span>
                      {(dateFilter !== 'all' || searchQuery) && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                          {(dateFilter !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0)} active
                        </span>
                      )}
                    </div>
                    {(dateFilter !== 'all' || searchQuery) && (
                      <button
                        onClick={() => {
                          setDateFilter('all');
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Time Period Filter - Segmented Control Style */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">Time Period</span>
                    </div>
                    <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                      {[
                        { value: 'all', label: 'All Time' },
                        { value: 'today', label: 'Today' },
                        { value: 'week', label: 'This Week' },
                        { value: 'month', label: 'This Month' }
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => {
                            setDateFilter(filter.value);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            dateFilter === filter.value
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat List */}
            <div className="p-3 sm:p-4 flex-1">
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-3"></div>
                  <p className="text-sm text-gray-500">Loading sessions...</p>
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
                  <p className="text-xs text-gray-400 mt-1 text-center">Start a conversation to create your first session</p>
                </div>
              ) : getFilteredChatHistory().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Search className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No matching sessions</p>
                  <p className="text-xs text-gray-400 mt-1 text-center">Try adjusting your filters</p>
                  {(searchQuery || dateFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setDateFilter('all');
                        setCurrentPage(1);
                      }}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {getPaginatedChatHistory().map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleChatClick(chat)}
                        className="relative bg-white border border-gray-200 rounded-lg p-3 hover:border-orange-300 hover:shadow-md cursor-pointer transition-all duration-200 group hover:scale-[1.01]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center mb-2">
                              {chat.unread > 0 && (
                                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 flex-shrink-0 animate-pulse"></span>
                              )}
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {chat.name}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span>{chat.date}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>{formatTime(chat.timestamp)}</span>
                              </div>
                              {chat.message_count > 0 && (
                                <div className="flex items-center">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  <span>{chat.message_count}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {chat.unread > 0 && (
                              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                {chat.unread}
                              </span>
                            )}
                            <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {getTotalPages() > 1 && (
                    <div className="flex items-center justify-center space-x-2 pt-4 border-t border-gray-100">
                      {/* Previous Button */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentPage === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((pageNum) => {
                          // Show first page, last page, current page, and pages around current page
                          const showPage =
                            pageNum === 1 ||
                            pageNum === getTotalPages() ||
                            Math.abs(pageNum - currentPage) <= 1;

                          // Show ellipsis
                          const showEllipsisBefore = pageNum === currentPage - 2 && currentPage > 3;
                          const showEllipsisAfter = pageNum === currentPage + 2 && currentPage < getTotalPages() - 2;

                          if (showEllipsisBefore || showEllipsisAfter) {
                            return (
                              <span key={pageNum} className="px-2 text-gray-400">
                                ...
                              </span>
                            );
                          }

                          if (!showPage) return null;

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                currentPage === pageNum
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === getTotalPages()}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentPage === getTotalPages()
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          // Usage Analytics View
          <UsageAnalytics />
        ) : (
          // Recent Activities View
          <div className="flex-1 overflow-y-auto">
            {/* Search Bar and Filters */}
            {recentActivities.length > 0 && (
              <div className="p-3 sm:p-4 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
                <div className="space-y-3">
                  {/* Search Box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search"
                      value={activitySearchQuery}
                      onChange={handleActivitySearchChange}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
                    />
                    {activitySearchQuery && (
                      <button
                        onClick={() => {
                          setActivitySearchQuery('');
                          setActivityPage(1);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Filters Section */}
                  <div className="space-y-3">
                    {/* Filter Header with Active Count */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">Filters</span>
                        {(activityDateFilter !== 'all' || activityTypeFilter !== 'all') && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                            {(activityDateFilter !== 'all' ? 1 : 0) + (activityTypeFilter !== 'all' ? 1 : 0)} active
                          </span>
                        )}
                      </div>
                      {(activityDateFilter !== 'all' || activityTypeFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setActivityDateFilter('all');
                            setActivityTypeFilter('all');
                            setActivityPage(1);
                          }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Time Period Filter - Segmented Control Style */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">Time Period</span>
                      </div>
                      <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                        {[
                          { value: 'all', label: 'All Time' },
                          { value: 'today', label: 'Today' },
                          { value: 'week', label: 'This Week' },
                          { value: 'month', label: 'This Month' }
                        ].map((filter) => (
                          <button
                            key={filter.value}
                            onClick={() => {
                              setActivityDateFilter(filter.value);
                              setActivityPage(1);
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                              activityDateFilter === filter.value
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Activity Type Filter - Chip Style with Icons */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">Activity Type</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'All', icon: null, color: 'gray' },
                          { value: 'sessions', label: 'Sessions', icon: MessageSquare, color: 'purple' },
                          { value: 'messages', label: 'Messages', icon: Send, color: 'green' },
                          { value: 'analysis', label: 'Analysis', icon: TrendingUp, color: 'pink' },
                          { value: 'documents', label: 'Documents', icon: FolderOpen, color: 'blue' }
                        ].map((filter) => {
                          const isActive = activityTypeFilter === filter.value;
                          const IconComponent = filter.icon;
                          const colorClasses = {
                            gray: isActive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                            purple: isActive ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
                            green: isActive ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-200 hover:border-green-300',
                            pink: isActive ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-pink-600 border-pink-200 hover:border-pink-300',
                            blue: isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300'
                          };
                          return (
                            <button
                              key={filter.value}
                              onClick={() => {
                                setActivityTypeFilter(filter.value);
                                setActivityPage(1);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${colorClasses[filter.color]}`}
                            >
                              {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Cards */}
            <div className="p-3 sm:p-4">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : getFilteredActivities().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">
                    {activitySearchQuery || activityTypeFilter !== 'all' || activityDateFilter !== 'all'
                      ? 'No activities match your filters'
                      : 'No activities found'}
                  </p>
                  {(activitySearchQuery || activityTypeFilter !== 'all' || activityDateFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setActivitySearchQuery('');
                        setActivityTypeFilter('all');
                        setActivityDateFilter('all');
                        setActivityPage(1);
                      }}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Activity Cards */}
                  <div className="space-y-2 mb-4">
                    {getPaginatedActivities().map((activity) => (
                      <div
                        key={activity.id}
                        className="relative bg-white border border-gray-200 rounded-lg p-3 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity)}`}>
                            {getActivityIcon(activity)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {formatActivityTitle(activity)}
                                </h4>
                                {extractActivityDetails(activity) && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {extractActivityDetails(activity)}
                                  </p>
                                )}
                              </div>
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
                              {activity.activity_source && (
                                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs font-medium">
                                  {activity.activity_source === 'chat_history' ? 'session history' : activity.activity_source.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {getActivityTotalPages() > 1 && (
                    <div className="flex items-center justify-center space-x-2 pt-4 border-t border-gray-100">
                      {/* Previous Button */}
                      <button
                        onClick={() => handleActivityPageChange(activityPage - 1)}
                        disabled={activityPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          activityPage === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: getActivityTotalPages() }, (_, i) => i + 1).map((pageNum) => {
                          // Show first page, last page, current page, and pages around current page
                          const showPage =
                            pageNum === 1 ||
                            pageNum === getActivityTotalPages() ||
                            Math.abs(pageNum - activityPage) <= 1;

                          // Show ellipsis
                          const showEllipsisBefore = pageNum === activityPage - 2 && activityPage > 3;
                          const showEllipsisAfter = pageNum === activityPage + 2 && activityPage < getActivityTotalPages() - 2;

                          if (showEllipsisBefore || showEllipsisAfter) {
                            return (
                              <span key={pageNum} className="px-2 text-gray-400">
                                ...
                              </span>
                            );
                          }

                          if (!showPage) return null;

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handleActivityPageChange(pageNum)}
                              className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                activityPage === pageNum
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => handleActivityPageChange(activityPage + 1)}
                        disabled={activityPage === getActivityTotalPages()}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          activityPage === getActivityTotalPages()
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}