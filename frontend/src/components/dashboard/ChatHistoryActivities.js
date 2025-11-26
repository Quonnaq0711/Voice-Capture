import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  User,
  Calendar,
  ExternalLink,
  Search,
  RefreshCw,
  BarChart3,
  Sparkles,
  Filter,
  FolderOpen,
  Send,
  X,
  Flame,
  Activity,
  Award
} from 'lucide-react';
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  HeartIcon,
  MapPinIcon,
  HomeIcon,
  PuzzlePieceIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { sessions as sessionsAPI, activities as activitiesAPIService } from '../../services/api';
import { formatTime as formatTimeUTC } from '../../utils/timeFormatter';

// Animated Counter Component - Fixed: Use ref to track start value and avoid dependency issues
const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    let startTime;
    let animationFrame;
    const startValue = startValueRef.current;
    const endValue = value;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newValue = Math.floor(startValue + (endValue - startValue) * easeOut);
      setDisplayValue(newValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        startValueRef.current = endValue;
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{displayValue}</span>;
};

// Progress Ring Component
const ProgressRing = ({ value, max, size = 80, strokeWidth = 8, color = '#F97316' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

// Feature configuration - moved outside component to prevent recreation
const FEATURE_CONFIG = {
  'Personal Assistant': { color: '#3B82F6', icon: Sparkles },
  'Career Agent': { color: '#F97316', icon: BriefcaseIcon },
  'Documents': { color: '#8B5CF6', icon: FileText },
  'Travel Agent': { color: '#EC4899', icon: MapPinIcon },
  'Wellness': { color: '#EF4444', icon: HeartIcon },
  'Money Agent': { color: '#22C55E', icon: CurrencyDollarIcon },
  'Hobby Agent': { color: '#F59E0B', icon: PuzzlePieceIcon },
  'Family': { color: '#06B6D4', icon: HomeIcon },
  'Spiritual': { color: '#A855F7', icon: SparklesIcon }
};

// Usage Analytics Component with ref for refresh
const UsageAnalytics = React.forwardRef((props, ref) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(7);

  // Memoize fetchAnalyticsData with useCallback
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activitiesAPIService.getUsageAnalytics(timeRange);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Expose refresh method to parent - Fixed: add fetchAnalyticsData as dependency
  React.useImperativeHandle(ref, () => ({ refresh: fetchAnalyticsData }), [fetchAnalyticsData]);

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Optimized heatmap lookup - O(1) instead of O(n) per cell
  const heatmapLookup = useMemo(() => {
    const map = new Map();
    let maxCount = 0;
    analyticsData?.weekly_heatmap?.forEach(h => {
      map.set(`${h.day}-${h.hour}`, h.count);
      if (h.count > maxCount) maxCount = h.count;
    });
    return { map, maxCount: Math.max(maxCount, 1) };
  }, [analyticsData?.weekly_heatmap]);

  const getHeatmapColor = (count, maxCount) => {
    if (count === 0) return 'bg-gray-100';
    const intensity = maxCount > 0 ? count / maxCount : 0;
    if (intensity > 0.75) return 'bg-orange-500';
    if (intensity > 0.5) return 'bg-orange-400';
    if (intensity > 0.25) return 'bg-orange-300';
    return 'bg-orange-200';
  };

  const getTrendInfo = () => {
    if (!analyticsData) return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100' };
    if (analyticsData.trend === 'up') return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' };
    if (analyticsData.trend === 'down') return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' };
    return { icon: Minus, color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const formatHour = (hour) => {
    if (hour === 0) return '12AM';
    if (hour === 12) return '12PM';
    return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <X className="h-7 w-7 text-red-500" />
        </div>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button onClick={fetchAnalyticsData} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!analyticsData || analyticsData.total_activities === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
          <BarChart3 className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Yet</h3>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Start using the AI assistants to see your usage analytics here.
        </p>
      </div>
    );
  }

  const trendInfo = getTrendInfo();
  const TrendIcon = trendInfo.icon;
  const hourlyDist = analyticsData.hourly_distribution || Array(24).fill(0);
  const maxHourly = Math.max(...hourlyDist, 1);
  const weekdayDist = analyticsData.weekday_distribution || [];
  const maxWeekday = Math.max(...weekdayDist.map(d => d.count), 1);

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Analytics</h3>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          {[{ value: 7, label: '7D' }, { value: 30, label: '30D' }, { value: 90, label: '90D' }].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                timeRange === option.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Stats - Blue Gradient */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-xs font-medium mb-1">Total Activities</p>
              <p className="text-4xl font-bold">
                <AnimatedCounter value={analyticsData.total_activities} />
              </p>
            </div>
            <div className={`${trendInfo.bg} rounded-xl p-2`}>
              <TrendIcon className={`h-6 w-6 ${trendInfo.color}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-100">Streak</p>
                <p className="text-sm font-bold">{analyticsData.streak_days} days</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-100">vs Last Week</p>
                <p className="text-sm font-bold">{analyticsData.wow_change > 0 ? '+' : ''}{analyticsData.wow_change}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Engagement Ring - Green */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Engagement</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analyticsData.engagement_rate}%</p>
              <p className="text-[10px] text-gray-400">{analyticsData.days_with_activity}/{analyticsData.total_days} days</p>
            </div>
            <div className="relative">
              <ProgressRing value={analyticsData.engagement_rate} max={100} size={56} strokeWidth={6} color="#10B981" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Award className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Peak Hour - Amber */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Peak Hour</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {analyticsData.peak_hour !== null ? formatHour(analyticsData.peak_hour) : 'N/A'}
              </p>
              <p className="text-[10px] text-gray-400">Most active time</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Feature Usage</h4>
        {Object.keys(analyticsData.agent_usage || {}).length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No usage data</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(analyticsData.agent_usage)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([feature, count]) => {
                const config = FEATURE_CONFIG[feature] || { color: '#9CA3AF', icon: Activity };
                const Icon = config.icon;
                const percentage = analyticsData.total_activities > 0
                  ? Math.round((count / analyticsData.total_activities) * 100)
                  : 0;
                return (
                  <div key={feature} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    >
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-900">{feature}</span>
                        <span className="text-xs text-gray-500">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Weekly Pattern - Bar Chart (Purple) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Weekly Pattern</h4>
        <div className="flex items-end justify-between gap-2" style={{ height: '100px' }}>
          {weekdayDist.map((item, index) => {
            const barHeight = maxWeekday > 0 ? Math.max((item.count / maxWeekday) * 60, 4) : 4;
            const isToday = new Date().getDay() === (index + 1) % 7;
            const isMostActive = analyticsData.most_active_weekday?.day === item.day;
            return (
              <div key={item.day} className="flex-1 flex flex-col items-center justify-end">
                <span className="text-[10px] text-gray-500 mb-1">{item.count}</span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isMostActive ? 'bg-gradient-to-t from-violet-600 to-purple-500' :
                    isToday ? 'bg-violet-400' : 'bg-gray-300'
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
                <span className={`text-[10px] mt-1 ${isToday ? 'text-violet-600 font-bold' : 'text-gray-500'}`}>
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Activity - Bar Chart (Cyan) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Hourly Activity</h4>
        <div className="flex items-end gap-[2px]" style={{ height: '80px' }}>
          {hourlyDist.map((count, hour) => {
            const barHeight = maxHourly > 0 ? Math.max((count / maxHourly) * 56, 2) : 2;
            const isCurrentHour = new Date().getHours() === hour;
            return (
              <div key={hour} className="flex-1 group" title={`${formatHour(hour)}: ${count}`}>
                <div
                  className={`w-full rounded-t transition-all duration-200 ${
                    isCurrentHour ? 'bg-cyan-500' : count > 0 ? 'bg-cyan-300 group-hover:bg-cyan-400' : 'bg-gray-200'
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-gray-400">12AM</span>
          <span className="text-[9px] text-gray-400">6AM</span>
          <span className="text-[9px] text-gray-400">12PM</span>
          <span className="text-[9px] text-gray-400">6PM</span>
          <span className="text-[9px] text-gray-400">11PM</span>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Activity Heatmap</h4>
          <span className="text-[10px] text-gray-400">Hour × Day</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <div className="flex ml-8 mb-1">
              {[0, 6, 12, 18].map(h => (
                <div key={h} className="text-[9px] text-gray-400" style={{ width: '25%' }}>
                  {formatHour(h)}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {weekdayLabels.map((day, dayIndex) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-400 w-7">{day}</span>
                  <div className="flex gap-[2px] flex-1">
                    {Array.from({ length: 24 }, (_, hour) => {
                      // Optimized O(1) lookup instead of O(n) find()
                      const count = heatmapLookup.map.get(`${dayIndex}-${hour}`) || 0;
                      return (
                        <div
                          key={hour}
                          className={`flex-1 h-3 rounded-sm ${getHeatmapColor(count, heatmapLookup.maxCount)} transition-colors hover:ring-1 hover:ring-orange-400`}
                          title={`${day} ${formatHour(hour)}: ${count} activities`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1 mt-2">
              <span className="text-[9px] text-gray-400 mr-1">Less</span>
              <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
              <div className="w-3 h-3 rounded-sm bg-orange-200"></div>
              <div className="w-3 h-3 rounded-sm bg-orange-300"></div>
              <div className="w-3 h-3 rounded-sm bg-orange-400"></div>
              <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
              <span className="text-[9px] text-gray-400 ml-1">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 rounded-xl p-3 text-center">
        <p className="text-[10px] text-gray-400">
          {new Date(analyticsData.period_start).toLocaleDateString()} - {new Date(analyticsData.period_end).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
});

// Add displayName for React DevTools
UsageAnalytics.displayName = 'UsageAnalytics';

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

  // Ref for analytics component refresh
  const analyticsRef = useRef(null);

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

  // Memoized filtered chat history to avoid repeated filtering
  const filteredChatHistory = useMemo(() => {
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
  }, [chatHistory, searchQuery, dateFilter]);

  // Memoized total pages calculation
  const totalPages = useMemo(() => {
    return Math.ceil(filteredChatHistory.length / itemsPerPage);
  }, [filteredChatHistory, itemsPerPage]);

  // Memoized paginated chat history
  const paginatedChatHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredChatHistory.slice(startIndex, endIndex);
  }, [filteredChatHistory, currentPage, itemsPerPage]);

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

  // Memoized filtered activities to avoid repeated filtering
  const filteredActivities = useMemo(() => {
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
  }, [recentActivities, activityTypeFilter, activitySearchQuery, activityDateFilter]);

  // Memoized total pages for activities
  const activityTotalPages = useMemo(() => {
    return Math.ceil(filteredActivities.length / activityItemsPerPage);
  }, [filteredActivities, activityItemsPerPage]);

  // Memoized paginated activities
  const paginatedActivities = useMemo(() => {
    const startIndex = (activityPage - 1) * activityItemsPerPage;
    const endIndex = startIndex + activityItemsPerPage;
    return filteredActivities.slice(startIndex, endIndex);
  }, [filteredActivities, activityPage, activityItemsPerPage]);

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

  // Initial data load with cleanup to prevent memory leaks
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      if (isMounted) {
        await fetchChatHistory();
      }
      if (isMounted) {
        await fetchRecentActivities();
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-refresh activities when switching to Activity tab
  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'activity' && isMounted) {
      fetchRecentActivities();
    }

    return () => {
      isMounted = false;
    };
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
              onClick={() => setActiveTab('analytics')}
              className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors relative flex-1 sm:flex-initial ${
                activeTab === 'analytics'
                  ? 'text-gray-900 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Usage Analytics
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              if (activeTab === 'history') {
                fetchChatHistory();
              } else if (activeTab === 'activity') {
                fetchRecentActivities();
              } else if (activeTab === 'analytics') {
                analyticsRef.current?.refresh();
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
              ) : filteredChatHistory.length === 0 ? (
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
                    {paginatedChatHistory.map((chat) => (
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
                  {totalPages > 1 && (
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
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                          // Show first page, last page, current page, and pages around current page
                          const showPage =
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            Math.abs(pageNum - currentPage) <= 1;

                          // Show ellipsis
                          const showEllipsisBefore = pageNum === currentPage - 2 && currentPage > 3;
                          const showEllipsisAfter = pageNum === currentPage + 2 && currentPage < totalPages - 2;

                          if (showEllipsisBefore || showEllipsisAfter) {
                            return (
                              <span key={`ellipsis-${pageNum}`} className="px-2 text-gray-400">
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
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentPage === totalPages
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
          <UsageAnalytics ref={analyticsRef} />
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
              ) : filteredActivities.length === 0 ? (
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
                    {paginatedActivities.map((activity) => (
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
                  {activityTotalPages > 1 && (
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
                        {Array.from({ length: activityTotalPages }, (_, i) => i + 1).map((pageNum) => {
                          // Show first page, last page, current page, and pages around current page
                          const showPage =
                            pageNum === 1 ||
                            pageNum === activityTotalPages ||
                            Math.abs(pageNum - activityPage) <= 1;

                          // Show ellipsis
                          const showEllipsisBefore = pageNum === activityPage - 2 && activityPage > 3;
                          const showEllipsisAfter = pageNum === activityPage + 2 && activityPage < activityTotalPages - 2;

                          if (showEllipsisBefore || showEllipsisAfter) {
                            return (
                              <span key={`ellipsis-${pageNum}`} className="px-2 text-gray-400">
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
                        disabled={activityPage === activityTotalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          activityPage === activityTotalPages
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