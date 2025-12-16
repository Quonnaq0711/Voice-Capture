import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatHistoryActivities from '../src/components/dashboard/ChatHistoryActivities';

// Mock the sessions and activities API
jest.mock('../src/services/api', () => ({
  sessions: {
    getSessions: jest.fn(),
  },
  activities: {
    getUsageAnalytics: jest.fn().mockResolvedValue({
      total_activities: 10,
      daily_activity: [
        { date: '2025-11-23', day: 'Sat', count: 2 },
        { date: '2025-11-24', day: 'Sun', count: 1 },
        { date: '2025-11-25', day: 'Mon', count: 3 },
        { date: '2025-11-26', day: 'Tue', count: 0 },
        { date: '2025-11-27', day: 'Wed', count: 2 },
        { date: '2025-11-28', day: 'Thu', count: 1 },
        { date: '2025-11-29', day: 'Fri', count: 1 },
      ],
      activity_by_type: { chat: 7, analysis: 3 },
      activity_by_source: { dashboard: 6, career: 4 },
      most_active_day: { date: '2025-11-25', count: 3 },
      most_used_source: { source: 'dashboard', count: 6 },
      average_daily_activities: 1.4,
      streak_days: 2,
      days_with_activity: 6,
      total_days: 30,
      time_of_day: { morning: 3, afternoon: 4, evening: 2, night: 1 },
      peak_time: 'afternoon',
      agent_usage: { Dashboard: 6, Career: 4 },
      // Enhanced analytics fields
      hourly_distribution: [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      weekday_distribution: [
        { day: 'Mon', count: 3 },
        { day: 'Tue', count: 0 },
        { day: 'Wed', count: 2 },
        { day: 'Thu', count: 1 },
        { day: 'Fri', count: 1 },
        { day: 'Sat', count: 2 },
        { day: 'Sun', count: 1 },
      ],
      most_active_weekday: { day: 'Mon', count: 3 },
      weekly_heatmap: Array.from({ length: 168 }, (_, i) => ({
        day: Math.floor(i / 24),
        hour: i % 24,
        count: Math.floor(Math.random() * 3),
      })),
      this_week_count: 6,
      last_week_count: 4,
      wow_change: 50.0,
      trend: 'up',
      engagement_rate: 20.0,
      peak_hour: 9,
      period_start: '2025-10-30T00:00:00Z',
      period_end: '2025-11-29T00:00:00Z'
    }),
  },
}));

// Mock timeFormatter
jest.mock('../src/utils/timeFormatter', () => ({
  formatTime: jest.fn((dateString) => '10:30 AM'),
}));

import { sessions as sessionsAPI } from '../src/services/api';

const mockActivitiesAPI = {
  getRecentActivities: jest.fn(),
  createActivity: jest.fn(),
};

describe('ChatHistoryActivities Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionsAPI.getSessions.mockResolvedValue([]);
    mockActivitiesAPI.getRecentActivities.mockResolvedValue([]);
  });

  describe('Tab Navigation', () => {
    it('should render with Recent Activities tab active by default', () => {
      render(<ChatHistoryActivities />);

      const activityTab = screen.getByText('Recent Activities');
      expect(activityTab.closest('button')).toHaveClass('text-gray-900');
    });

    it('should switch to Session History tab when clicked', () => {
      render(<ChatHistoryActivities />);

      const historyTab = screen.getByText('Session History');
      fireEvent.click(historyTab);

      expect(historyTab.closest('button')).toHaveClass('text-gray-900');
    });

    it('should switch to Usage Analytics tab when clicked', async () => {
      render(<ChatHistoryActivities />);

      const analyticsTab = screen.getByText('Usage Analytics');
      fireEvent.click(analyticsTab);

      expect(analyticsTab.closest('button')).toHaveClass('text-gray-900');
    });

    it('should render Usage Analytics tab as enabled', () => {
      render(<ChatHistoryActivities />);

      const analyticsTab = screen.getByText('Usage Analytics');
      expect(analyticsTab.closest('button')).not.toBeDisabled();
    });
  });

  describe('Session History Tab', () => {
    it('should show loading spinner while fetching sessions', () => {
      sessionsAPI.getSessions.mockImplementation(() => new Promise(() => {}));

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    });

    it('should display sessions when loaded', async () => {
      const mockSessions = [
        {
          id: 1,
          session_name: 'Career Discussion',
          created_at: '2025-01-15T10:00:00Z',
          message_count: 5,
        },
        {
          id: 2,
          session_name: 'Resume Review',
          created_at: '2025-01-14T14:00:00Z',
          message_count: 10,
        },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Career Discussion')).toBeInTheDocument();
        expect(screen.getByText('Resume Review')).toBeInTheDocument();
      });
    });

    it('should show empty state when no sessions exist', async () => {
      sessionsAPI.getSessions.mockResolvedValue([]);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('No sessions yet')).toBeInTheDocument();
      });
    });

    it('should call onChatClick when a session is clicked', async () => {
      const mockSessions = [
        { id: 1, session_name: 'Test Chat', created_at: '2025-01-15T10:00:00Z' },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);
      const onChatClick = jest.fn();

      render(<ChatHistoryActivities onChatClick={onChatClick} />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Test Chat')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Chat'));
      expect(onChatClick).toHaveBeenCalled();
    });
  });

  describe('Search and Filters', () => {
    it('should filter sessions by search query', async () => {
      const mockSessions = [
        { id: 1, session_name: 'Career Discussion', created_at: '2025-01-15T10:00:00Z' },
        { id: 2, session_name: 'Resume Review', created_at: '2025-01-14T14:00:00Z' },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Career Discussion')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search sessions...');
      fireEvent.change(searchInput, { target: { value: 'Resume' } });

      expect(screen.queryByText('Career Discussion')).not.toBeInTheDocument();
      expect(screen.getByText('Resume Review')).toBeInTheDocument();
    });

    it('should show no matching sessions message when search has no results', async () => {
      const mockSessions = [
        { id: 1, session_name: 'Career Discussion', created_at: '2025-01-15T10:00:00Z' },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Career Discussion')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search sessions...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No matching sessions')).toBeInTheDocument();
    });

    it('should clear search when clear button is clicked', async () => {
      const mockSessions = [
        { id: 1, session_name: 'Test Session', created_at: '2025-01-15T10:00:00Z' },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Test Session')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search sessions...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No matching sessions')).toBeInTheDocument();

      // Click clear all filters
      fireEvent.click(screen.getByText('Clear all filters'));

      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });
  });

  describe('Date Filters', () => {
    it('should show date filter options', async () => {
      sessionsAPI.getSessions.mockResolvedValue([
        { id: 1, session_name: 'Test', created_at: '2025-01-15T10:00:00Z' },
      ]);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('All Time')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('This Week')).toBeInTheDocument();
        expect(screen.getByText('This Month')).toBeInTheDocument();
      });
    });

    it('should update active filter when filter button is clicked', async () => {
      sessionsAPI.getSessions.mockResolvedValue([
        { id: 1, session_name: 'Test', created_at: '2025-01-15T10:00:00Z' },
      ]);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      const todayButton = screen.getByText('Today');
      fireEvent.click(todayButton);

      expect(todayButton).toHaveClass('bg-white');
    });
  });

  describe('Recent Activities Tab', () => {
    it('should show activities from API', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'chat',
          activity_source: 'dashboard',
          activity_title: 'Sent message',
          activity_description: 'Asked about career',
          created_at: '2025-01-15T10:00:00Z',
        },
      ];
      mockActivitiesAPI.getRecentActivities.mockResolvedValue(mockActivities);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('Sent Message')).toBeInTheDocument();
      });
    });

    it('should show empty state when no activities', async () => {
      mockActivitiesAPI.getRecentActivities.mockResolvedValue([]);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('No activities found')).toBeInTheDocument();
      });
    });

    it('should format activity title correctly for chat messages', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'chat',
          activity_source: 'dashboard',
          activity_title: 'Chat Message Edit - dashboard',
          activity_description: 'Updated message',
          created_at: '2025-01-15T10:00:00Z',
        },
      ];
      mockActivitiesAPI.getRecentActivities.mockResolvedValue(mockActivities);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('Edited Message')).toBeInTheDocument();
      });
    });

    it('should format activity title correctly for resume analysis', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'analysis',
          activity_source: 'documents',
          activity_title: 'Analyzing Resume_2025.pdf',
          activity_description: 'Started analysis',
          created_at: '2025-01-15T10:00:00Z',
        },
      ];
      mockActivitiesAPI.getRecentActivities.mockResolvedValue(mockActivities);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('Analyzing Resume')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Type Filters', () => {
    it('should show activity type filter buttons', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'chat',
          activity_source: 'dashboard',
          activity_title: 'Test',
          created_at: '2025-01-15T10:00:00Z',
        },
      ];
      mockActivitiesAPI.getRecentActivities.mockResolvedValue(mockActivities);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByText('Analysis')).toBeInTheDocument();
        expect(screen.getByText('Documents')).toBeInTheDocument();
      });
    });

    it('should filter activities by type', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'chat',
          activity_source: 'dashboard',
          activity_title: 'Chat Message',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 2,
          activity_type: 'analysis',
          activity_source: 'documents',
          activity_title: 'Resume Analysis',
          created_at: '2025-01-14T10:00:00Z',
        },
      ];
      mockActivitiesAPI.getRecentActivities.mockResolvedValue(mockActivities);

      render(<ChatHistoryActivities activitiesAPI={mockActivitiesAPI} />);

      await waitFor(() => {
        expect(screen.getByText('Sent Message')).toBeInTheDocument();
      });

      // Click on Analysis filter
      fireEvent.click(screen.getByText('Analysis'));

      await waitFor(() => {
        expect(screen.queryByText('Sent Message')).not.toBeInTheDocument();
        expect(screen.getByText('Resume Analysis')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Button', () => {
    it('should call fetch functions when refresh button is clicked', async () => {
      sessionsAPI.getSessions.mockResolvedValue([
        { id: 1, session_name: 'Test', created_at: '2025-01-15T10:00:00Z' },
      ]);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      // Clear mock and click refresh
      sessionsAPI.getSessions.mockClear();
      const refreshButton = screen.getByTitle('Refresh');
      fireEvent.click(refreshButton);

      expect(sessionsAPI.getSessions).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should show pagination when there are many sessions', async () => {
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        session_name: `Session ${i + 1}`,
        created_at: '2025-01-15T10:00:00Z',
      }));
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });

      // Should show pagination controls
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should navigate to next page when Next is clicked', async () => {
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        session_name: `Session ${i + 1}`,
        created_at: '2025-01-15T10:00:00Z',
      }));
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      // Should now show sessions from page 2
      await waitFor(() => {
        expect(screen.getByText('Session 6')).toBeInTheDocument();
      });
    });

    it('should disable Previous button on first page', async () => {
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        session_name: `Session ${i + 1}`,
        created_at: '2025-01-15T10:00:00Z',
      }));
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('Previous');
      expect(prevButton).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Unread Indicator', () => {
    it('should show unread badge for sessions with unread messages', async () => {
      const mockSessions = [
        {
          id: 1,
          session_name: 'Unread Chat',
          created_at: '2025-01-15T10:00:00Z',
          unread: true,
        },
      ];
      sessionsAPI.getSessions.mockResolvedValue(mockSessions);

      render(<ChatHistoryActivities />);
      fireEvent.click(screen.getByText('Session History'));

      await waitFor(() => {
        expect(screen.getByText('Unread Chat')).toBeInTheDocument();
        // Check for unread indicator (the pulsing dot)
        const unreadDot = document.querySelector('.animate-pulse');
        expect(unreadDot).toBeInTheDocument();
      });
    });
  });
});
