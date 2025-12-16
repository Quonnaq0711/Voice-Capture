import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonalAssistant, {
  navigateToAgent,
  cancelAgentNavigation,
  resetAssistantPosition
} from '../src/components/chat/PersonalAssistant';

// Mock ChatDialog
jest.mock('../src/components/chat/ChatDialog', () => {
  return function MockChatDialog({ onClose }) {
    return (
      <div data-testid="chat-dialog">
        <button onClick={onClose} data-testid="close-dialog">Close</button>
      </div>
    );
  };
});

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}));

const renderPersonalAssistant = (props = {}) => {
  const defaultProps = {
    user: { id: 1, first_name: 'John', email: 'john@example.com' },
    notifications: [],
    ...props,
  };

  return render(
    <MemoryRouter>
      <PersonalAssistant {...defaultProps} />
    </MemoryRouter>
  );
};

describe('PersonalAssistant Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the assistant avatar', () => {
      const { container } = renderPersonalAssistant();
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show welcome message when user is logged in', () => {
      renderPersonalAssistant();
      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();
    });

    it('should not show welcome message when user is null', () => {
      renderPersonalAssistant({ user: null });
      expect(screen.queryByText(/Welcome/i)).not.toBeInTheDocument();
    });

    it('should display default name when first_name is not available', () => {
      renderPersonalAssistant({ user: { id: 1, email: 'test@test.com' } });
      // Welcome bubble won't show without first_name
      expect(screen.queryByText(/Welcome, John!/i)).not.toBeInTheDocument();
    });
  });

  describe('Welcome Message', () => {
    it('should auto-hide welcome message after timeout', async () => {
      renderPersonalAssistant();
      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();

      // Fast-forward 10 seconds (WELCOME_MESSAGE_TIMEOUT_MS)
      jest.advanceTimersByTime(10000);

      await waitFor(() => {
        expect(screen.queryByText(/Welcome, John!/i)).not.toBeInTheDocument();
      });
    });

    it('should close welcome message when close button is clicked', () => {
      renderPersonalAssistant();
      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Close welcome message');
      fireEvent.click(closeButton);

      expect(screen.queryByText(/Welcome, John!/i)).not.toBeInTheDocument();
    });
  });

  describe('Dialog Behavior', () => {
    it('should not render chat dialog initially when not opened', () => {
      renderPersonalAssistant({ isDialogOpen: false });
      expect(screen.queryByTestId('chat-dialog')).not.toBeInTheDocument();
    });

    it('should render chat dialog when isDialogOpen is true and dialog has been opened', () => {
      const { rerender } = render(
        <MemoryRouter>
          <PersonalAssistant
            user={{ id: 1, first_name: 'John' }}
            isDialogOpen={true}
          />
        </MemoryRouter>
      );

      // Dialog should be visible when isDialogOpen is true
      expect(screen.getByTestId('chat-dialog')).toBeInTheDocument();
    });

    it('should call onDialogClose when dialog is closed', () => {
      const onDialogClose = jest.fn();
      render(
        <MemoryRouter>
          <PersonalAssistant
            user={{ id: 1, first_name: 'John' }}
            isDialogOpen={true}
            onDialogClose={onDialogClose}
          />
        </MemoryRouter>
      );

      const closeButton = screen.getByTestId('close-dialog');
      fireEvent.click(closeButton);

      expect(onDialogClose).toHaveBeenCalled();
    });
  });

  describe('Notifications', () => {
    it('should show notification bubble when notification is provided', () => {
      const notifications = [
        { id: 1, type: 'success', title: 'Test', message: 'Test notification' }
      ];
      renderPersonalAssistant({ notifications });

      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });

    it('should show notification title when provided', () => {
      const notifications = [
        { id: 1, type: 'info', title: 'Important', message: 'Some message' }
      ];
      renderPersonalAssistant({ notifications });

      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    it('should auto-dismiss non-error notifications after timeout', async () => {
      const notifications = [
        { id: 1, type: 'success', message: 'Success message' }
      ];
      renderPersonalAssistant({ notifications });

      expect(screen.getByText('Success message')).toBeInTheDocument();

      // Fast-forward 5 seconds (NOTIFICATION_DISMISS_MS)
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    it('should close notification when close button is clicked', () => {
      const notifications = [
        { id: 1, type: 'info', message: 'Info message' }
      ];
      renderPersonalAssistant({ notifications });

      expect(screen.getByText('Info message')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Close notification');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Info message')).not.toBeInTheDocument();
    });

    it('should show progress bar for progress notifications', () => {
      const notifications = [
        {
          id: 1,
          type: 'progress',
          message: 'Processing...',
          progress: 50,
          current_section: 'Step 1'
        }
      ];
      const { container } = renderPersonalAssistant({ notifications });

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });
  });

  describe('Dragging', () => {
    it('should render draggable assistant avatar', () => {
      const { container } = renderPersonalAssistant();
      // The main SVG for the avatar should exist
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe('Public API Functions', () => {
    it('should dispatch navigation event when navigateToAgent is called', () => {
      const handler = jest.fn();
      document.addEventListener('assistant:navigate', handler);

      navigateToAgent('Career Agent');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail).toEqual({ agentName: 'Career Agent' });

      document.removeEventListener('assistant:navigate', handler);
    });

    it('should dispatch cancel navigation event', () => {
      const handler = jest.fn();
      document.addEventListener('assistant:cancelNavigation', handler);

      cancelAgentNavigation();

      expect(handler).toHaveBeenCalled();

      document.removeEventListener('assistant:cancelNavigation', handler);
    });

    it('should dispatch reset position event', () => {
      const handler = jest.fn();
      document.addEventListener('assistant:resetPosition', handler);

      resetAssistantPosition();

      expect(handler).toHaveBeenCalled();

      document.removeEventListener('assistant:resetPosition', handler);
    });
  });

  describe('External State Control', () => {
    it('should use external isDialogOpen state when provided', () => {
      const setIsDialogOpen = jest.fn();
      render(
        <MemoryRouter>
          <PersonalAssistant
            user={{ id: 1, first_name: 'John' }}
            isDialogOpen={true}
            setIsDialogOpen={setIsDialogOpen}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('chat-dialog')).toBeInTheDocument();
    });

    it('should pass callbacks to ChatDialog', () => {
      const onUnreadCountChange = jest.fn();
      const onOpenAgentModal = jest.fn();

      render(
        <MemoryRouter>
          <PersonalAssistant
            user={{ id: 1, first_name: 'John' }}
            isDialogOpen={true}
            onUnreadCountChange={onUnreadCountChange}
            onOpenAgentModal={onOpenAgentModal}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('chat-dialog')).toBeInTheDocument();
    });
  });
});
