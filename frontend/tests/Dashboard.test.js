import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/components/Dashboard';
import { useAuth } from '../src/contexts/AuthContext';
import { profile as profileAPI } from '../src/services/api';

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
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock child components
jest.mock('../src/components/PersonalAssistant', () => {
  return function MockPersonalAssistant({ user, isDialogOpen, setIsDialogOpen }) {
    return (
      <div data-testid="personal-assistant">
        <div>Personal Assistant for {user.username}</div>
        <div>Dialog Open: {isDialogOpen.toString()}</div>
        <button onClick={() => setIsDialogOpen(false)}>Close Dialog</button>
      </div>
    );
  };
});

jest.mock('../src/components/CircularAgents', () => {
  return function MockCircularAgents({ agents, avatarUrl, user, triggerAnimation }) {
    return (
      <div data-testid="circular-agents">
        <div>Agents Count: {agents.length}</div>
        <div>User: {user.username}</div>
        <div>Animation: {triggerAnimation.toString()}</div>
        {agents.map((agent, index) => (
          <div key={index} data-testid={`agent-${agent.name.toLowerCase().replace(/\s+/g, '-')}`}>
            {agent.name}
          </div>
        ))}
      </div>
    );
  };
});

// Wrapper component for testing with router
const DashboardWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Dashboard Component', () => {
  const mockLogout = jest.fn();
  const mockUser = {
    username: 'testuser',
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
      username: 'testuser',
      email: 'test@example.com',
    });

    profileAPI.getAvatarUrl.mockResolvedValue({
      url: 'https://example.com/avatar.jpg',
    });

    // Mock window.resetAssistantPosition
    window.resetAssistantPosition = jest.fn();
  });

  afterEach(() => {
    delete window.resetAssistantPosition;
  });

  it('should render dashboard with main sections', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Check main title
    expect(screen.getAllByText('Sadaora AI')).toHaveLength(2); // Appears in nav and footer
    expect(screen.getByText('Welcome to Your')).toBeInTheDocument();
    expect(screen.getByText('Personal AI Assistant')).toBeInTheDocument();

    // Check main sections
    expect(screen.getByText('Talk to Your AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Your AI')).toBeInTheDocument();
    expect(screen.getByText('Agent Network')).toBeInTheDocument();
    expect(screen.getByText('Your Personalized')).toBeInTheDocument();
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText('Your')).toBeInTheDocument();
    expect(screen.getByText('Achievements & Progress')).toBeInTheDocument();

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
      expect(screen.getByText('testuser')).toBeInTheDocument();
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
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
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
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    // Click on the user profile section
    const profileButton = screen.getByText('testuser').closest('button');
    await userEvent.click(profileButton);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('should open personal assistant dialog', async () => {
    
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    const assistantButton = screen.getByText('Talk to Your AI Assistant');
    await userEvent.click(assistantButton);

    await waitFor(() => {
      expect(screen.getByText('Dialog Open: true')).toBeInTheDocument();
    });

    expect(window.resetAssistantPosition).toHaveBeenCalled();
  });

  it('should close personal assistant dialog', async () => {
    
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Open dialog first
    const assistantButton = screen.getByText('Talk to Your AI Assistant');
    await userEvent.click(assistantButton);

    await waitFor(() => {
      expect(screen.getByText('Dialog Open: true')).toBeInTheDocument();
    });

    // Close dialog
    const closeButton = screen.getByText('Close Dialog');
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByText('Dialog Open: false')).toBeInTheDocument();
    });
  });

  it('should render all agent modules', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('circular-agents')).toBeInTheDocument();
      expect(screen.getByText('Agents Count: 10')).toBeInTheDocument();
    });

    // Check for specific agents
    expect(screen.getByTestId('agent-career-agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-money-agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-mind-agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-travel-agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-body-agent')).toBeInTheDocument();
  });

  it('should display personalized insights', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Career Growth Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Financial Planning Insight')).toBeInTheDocument();
    expect(screen.getByText('Wellness Recommendation')).toBeInTheDocument();
    
    expect(screen.getByText('Explore Career Agent')).toBeInTheDocument();
    expect(screen.getByText('Check Money Agent')).toBeInTheDocument();
    expect(screen.getByText('Visit Mind Agent')).toBeInTheDocument();
  });

  it('should display achievement cards', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Daily Engagement')).toBeInTheDocument();
    expect(screen.getByText('Career Goals')).toBeInTheDocument();
    expect(screen.getByText('Wellness Score')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Growth')).toBeInTheDocument();

    expect(screen.getByText('7 Day Streak')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
  });

  it('should display daily recommendations', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Today\'s')).toBeInTheDocument();
    expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Career Focus')).toBeInTheDocument();
    expect(screen.getByText('Wellness Boost')).toBeInTheDocument();
    expect(screen.getByText('Learning Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Priority Action for Today')).toBeInTheDocument();

    expect(screen.getByText('15 min task')).toBeInTheDocument();
    expect(screen.getByText('10 min break')).toBeInTheDocument();
    expect(screen.getByText('30 min study')).toBeInTheDocument();
    expect(screen.getByText('HIGH IMPACT')).toBeInTheDocument();
  });

  it('should display monthly goals overview', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Monthly Goals Overview')).toBeInTheDocument();
    expect(screen.getByText('Career Development')).toBeInTheDocument();
    expect(screen.getByText('Financial Planning')).toBeInTheDocument();
    expect(screen.getByText('Personal Wellness')).toBeInTheDocument();

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    profileAPI.getCurrentUser.mockRejectedValue(new Error('API Error'));
    profileAPI.getAvatarUrl.mockRejectedValue(new Error('Avatar Error'));

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user data:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching avatar:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should trigger animation after user data loads', async () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Initially animation should be false
    await waitFor(() => {
      expect(screen.getByText('Animation: false')).toBeInTheDocument();
    });

    // After user data loads and timeout, animation should be true
    await waitFor(() => {
      expect(screen.getByText('Animation: true')).toBeInTheDocument();
    }, { timeout: 1000 });
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
    expect(screen.getAllByText('Sadaora AI')).toHaveLength(2); // Appears in nav and footer

    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
    expect(screen.getByText('Copyright © 2025. All rights reserved.')).toBeInTheDocument();
  });

  it('should display feature highlights', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Intelligent Coordination')).toBeInTheDocument();
    expect(screen.getByText('Natural Conversation')).toBeInTheDocument();
    expect(screen.getByText('Personalized Insights')).toBeInTheDocument();

    expect(screen.getByText('Seamlessly connects all your AI agents for unified guidance')).toBeInTheDocument();
    expect(screen.getByText('Chat naturally about any aspect of your life and goals')).toBeInTheDocument();
    expect(screen.getByText('Tailored recommendations based on your unique profile')).toBeInTheDocument();
  });

  it('should display recent activity summary', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Recent AI Insights')).toBeInTheDocument();
    expect(screen.getByText('Career progression analysis completed')).toBeInTheDocument();
    expect(screen.getByText('Financial optimization suggestions ready')).toBeInTheDocument();
    expect(screen.getByText('Wellness routine recommendations updated')).toBeInTheDocument();

    expect(screen.getByText('2 hours ago • Based on your recent profile updates')).toBeInTheDocument();
    expect(screen.getByText('1 day ago • Potential savings identified')).toBeInTheDocument();
    expect(screen.getByText('3 days ago • Personalized for your lifestyle')).toBeInTheDocument();
  });

  it('should handle missing user data gracefully', () => {
    useAuth.mockReturnValue({
      logout: mockLogout,
      user: null,
    });

    profileAPI.getCurrentUser.mockResolvedValue({
      username: '',
      email: '',
    });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    // Should still render without crashing
    expect(screen.getAllByText('Sadaora AI')).toHaveLength(2); // Appears in nav and footer
    expect(screen.getByText('Welcome to Your')).toBeInTheDocument();
    expect(screen.getByText('Personal AI Assistant')).toBeInTheDocument();
  });
});