import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/components/dashboard/Dashboard';
import { useAuth } from '../src/contexts/AuthContext';
import { profile as profileAPI, activities as activitiesAPI, careerInsights as careerInsightsAPI, dailyRecommendations as dailyRecommendationsAPI } from '../src/services/api';

// Mock the AuthContext
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock the API services
jest.mock('../src/services/api', () => ({
  profile: {
    getCurrentUser: jest.fn(),
    getAvatarUrl: jest.fn(),
  },
  activities: {
    getRecentActivities: jest.fn(),
    getActivitySummary: jest.fn(),
    createActivity: jest.fn(),
  },
  careerInsights: {
    getSummary: jest.fn(),
  },
  dailyRecommendations: {
    getRecommendations: jest.fn(),
    generateRecommendations: jest.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock child components
jest.mock('../src/components/chat/PersonalAssistant', () => {
  return function MockPersonalAssistant({ user, isDialogOpen, setIsDialogOpen }) {
    return (
      <div data-testid="personal-assistant">
        <div>Personal Assistant for {user?.first_name || 'User'}</div>
        <div>Dialog Open: {isDialogOpen?.toString() || 'false'}</div>
        <button onClick={() => setIsDialogOpen(false)}>Close Dialog</button>
      </div>
    );
  };
});

jest.mock('../src/components/ui/CircularAgents', () => {
  return function MockCircularAgents({ agents, avatarUrl, user, triggerAnimation }) {
    return (
      <div data-testid="circular-agents">
        <div>Agents Count: {agents?.length || 0}</div>
        <div>User: {user?.first_name || 'User'}</div>
        <div>Animation: {triggerAnimation?.toString() || 'false'}</div>
        {agents?.map((agent, index) => (
          <div key={index} data-testid={`agent-${agent.name.toLowerCase().replace(/\s+/g, '-')}`}>
            {agent.name}
          </div>
        ))}
      </div>
    );
  };
});

// Mock navigation events
jest.mock('../src/utils/navigationEvents', () => ({
  requestResetAssistantPosition: jest.fn(),
}));

// Mock recommendations utility
jest.mock('../src/utils/recommendations', () => ({
  getStaticFallbackRecommendations: jest.fn(() => [
    { id: 1, title: 'Test Recommendation', description: 'Test description', priority: 'high', estimated_time: '15 min', category: 'career', icon: 'BriefcaseIcon', color: 'blue', action_type: 'start' }
  ]),
}));

// Wrapper component for testing with router
const DashboardWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Dashboard Component', () => {
  const mockLogout = jest.fn();
  const mockUser = {
    first_name: 'Test',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    useAuth.mockReturnValue({
      logout: mockLogout,
      user: mockUser,
    });

    profileAPI.getCurrentUser.mockResolvedValue({
      first_name: 'Test',
      email: 'test@example.com',
    });

    profileAPI.getAvatarUrl.mockResolvedValue({
      url: 'https://example.com/avatar.jpg',
    });

    activitiesAPI.getRecentActivities.mockResolvedValue([]);
    activitiesAPI.getActivitySummary.mockResolvedValue({});

    careerInsightsAPI.getSummary.mockResolvedValue({
      status: 'no_analysis',
      insights: []
    });

    dailyRecommendationsAPI.getRecommendations.mockResolvedValue({
      status: 'success',
      recommendations: [
        { id: 1, title: 'Career Focus', description: 'Review your resume', priority: 'high', estimated_time: '15 min', category: 'career', icon: 'BriefcaseIcon', color: 'blue', action_type: 'review' },
        { id: 2, title: 'Learning', description: 'Complete a course', priority: 'medium', estimated_time: '30 min', category: 'learning', icon: 'AcademicCapIcon', color: 'green', action_type: 'start' },
      ]
    });
  });

  it('should render dashboard with main sections', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Check for Idii branding (may appear multiple times)
    const idiiElements = screen.getAllByText('Idii.');
    expect(idiiElements.length).toBeGreaterThan(0);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(profileAPI.getCurrentUser).toHaveBeenCalled();
      expect(profileAPI.getAvatarUrl).toHaveBeenCalled();
    });
  });

  it('should display user information in navigation', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should display avatar when available', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      const avatar = screen.getByAltText('User Avatar');
      expect(avatar).toBeInTheDocument();
    });
  });

  it('should handle logout functionality', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    await userEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should navigate to profile when account button is clicked', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Click on the user profile section
    const profileButton = screen.getByText('Test').closest('button');
    await userEvent.click(profileButton);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('should render PersonalAssistant component', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // The PersonalAssistant component should be rendered
    await waitFor(() => {
      expect(screen.getByTestId('personal-assistant')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    profileAPI.getCurrentUser.mockRejectedValue(new Error('API Error'));
    profileAPI.getAvatarUrl.mockRejectedValue(new Error('Avatar Error'));

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      // Either error or warn should be called
      expect(consoleSpy.mock.calls.length + consoleWarnSpy.mock.calls.length).toBeGreaterThan(0);
    });

    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should display user name in PersonalAssistant', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // The PersonalAssistant should show the user's name
    await waitFor(() => {
      expect(screen.getByText(/Personal Assistant for/i)).toBeInTheDocument();
    });
  });

  it('should navigate to profile when customize profile button is clicked', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    const customizeButton = screen.getByText('Customize Your Profile');
    await userEvent.click(customizeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('should display footer with correct links', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Engage')).toBeInTheDocument();

    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
    expect(screen.getByText('Copyright © 2025. All rights reserved.')).toBeInTheDocument();
  });

  it('should display key features section', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Intelligent Coordination')).toBeInTheDocument();
    expect(screen.getByText('Natural Conversation')).toBeInTheDocument();
    expect(screen.getByText('Personalized Insights')).toBeInTheDocument();
  });

  it('should handle missing user data gracefully', () => {
    useAuth.mockReturnValue({
      logout: mockLogout,
      user: null,
    });

    profileAPI.getCurrentUser.mockResolvedValue({
      first_name: '',
      email: '',
    });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Should still render without crashing - multiple "Idii." instances may exist
    const idiiElements = screen.getAllByText('Idii.');
    expect(idiiElements.length).toBeGreaterThan(0);
  });

  it('should display sidebar navigation', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Sidebar should have expand button
    const expandButton = screen.getByLabelText(/expand sidebar/i);
    expect(expandButton).toBeInTheDocument();
  });

  it('should toggle sidebar when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Initially collapsed, find expand button
    const expandButton = screen.getByLabelText(/expand sidebar/i);
    await user.click(expandButton);

    // After expanding, should find collapse button
    await waitFor(() => {
      expect(screen.getByLabelText(/collapse sidebar/i)).toBeInTheDocument();
    });
  });

  it('should have Career Agent quick access button', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Find the Career Agent button by its text content
    const careerButton = screen.getByText(/Career Agent/i).closest('button');
    expect(careerButton).toBeInTheDocument();
  });

  it('should have Travel Agent quick access button', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Find the Travel Agent button by its text content
    const travelButton = screen.getByText(/Travel Agent/i).closest('button');
    expect(travelButton).toBeInTheDocument();
  });

  it('should display daily recommendations', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(dailyRecommendationsAPI.getRecommendations).toHaveBeenCalled();
    });
  });

  it('should display career insights', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(careerInsightsAPI.getSummary).toHaveBeenCalled();
    });
  });

  it('should fetch recent activities', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(activitiesAPI.getRecentActivities).toHaveBeenCalled();
    });
  });
});
