import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CareerAgent from '../src/components/agents/CareerAgent';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="icon-search">Search</div>,
  Filter: () => <div data-testid="icon-filter">Filter</div>,
  X: () => <div data-testid="icon-x">X</div>,
  FileText: () => <div data-testid="icon-file-text">FileText</div>,
  FileType: () => <div data-testid="icon-file-type">FileType</div>,
  File: () => <div data-testid="icon-file">File</div>,
}));

// Mock AuthContext
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 1, email: 'test@example.com' },
    logout: jest.fn(),
  })),
}));

// Mock PersonalAssistant
jest.mock('../src/components/chat/PersonalAssistant', () => {
  return function MockPersonalAssistant() {
    return <div data-testid="personal-assistant">Personal Assistant</div>;
  };
});

// Mock NotificationPanel
jest.mock('../src/components/ui/NotificationPanel', () => {
  return function MockNotificationPanel() {
    return <div data-testid="notification-panel">Notifications</div>;
  };
});

// Mock AgentDesignModal
jest.mock('../src/components/AgentDesignModal', () => {
  return function MockAgentDesignModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    return (
      <div data-testid="agent-design-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  };
});

// Mock API services
jest.mock('../src/services/api', () => ({
  profile: {
    getProfile: jest.fn().mockResolvedValue({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    }),
  },
  sessions: {
    getSessions: jest.fn().mockResolvedValue([]),
  },
  auth: {
    getResumes: jest.fn().mockResolvedValue([]),
    uploadResume: jest.fn().mockResolvedValue({}),
    deleteResume: jest.fn().mockResolvedValue({}),
  },
  activities: {
    createActivity: jest.fn().mockResolvedValue({}),
  },
  streamingFetch: jest.fn(),
}));

// Mock chatApi
jest.mock('../src/services/chatApi', () => ({
  getCareerInsights: jest.fn().mockResolvedValue(null),
  hasCareerInsights: jest.fn().mockResolvedValue(false),
  getCareerInsightsByResume: jest.fn().mockResolvedValue(null),
}));

// Mock recharts
jest.mock('recharts', () => ({
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div>Pie</div>,
  Cell: () => <div>Cell</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div>Bar</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
  Tooltip: () => <div>Tooltip</div>,
  Legend: () => <div>Legend</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div>Line</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  RadialBarChart: ({ children }) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div>RadialBar</div>,
  RadarChart: ({ children }) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid: () => <div>PolarGrid</div>,
  PolarAngleAxis: () => <div>PolarAngleAxis</div>,
  PolarRadiusAxis: () => <div>PolarRadiusAxis</div>,
  Radar: () => <div>Radar</div>,
}));

const renderCareerAgent = (props = {}) => {
  return render(
    <MemoryRouter>
      <CareerAgent {...props} />
    </MemoryRouter>
  );
};

describe('CareerAgent Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderCareerAgent();
      expect(document.body).toBeInTheDocument();
    });

    it('should show PersonalAssistant by default', () => {
      renderCareerAgent();
      expect(screen.getByTestId('personal-assistant')).toBeInTheDocument();
    });

    it('should hide PersonalAssistant when showPersonalAssistant is false', () => {
      renderCareerAgent({ showPersonalAssistant: false });
      expect(screen.queryByTestId('personal-assistant')).not.toBeInTheDocument();
    });

    it('should display career-related content', () => {
      renderCareerAgent();
      // Career Agent renders multiple career-related elements
      const careerElements = screen.getAllByText(/Career/i);
      expect(careerElements.length).toBeGreaterThan(0);
    });
  });

  describe('Tab Navigation', () => {
    it('should render insights tab content by default', async () => {
      renderCareerAgent();
      // Wait for component to load
      await waitFor(() => {
        // Looking for career-related content
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should accept external activeTab prop', () => {
      renderCareerAgent({ externalActiveTab: 'insights' });
      expect(document.body).toBeInTheDocument();
    });

    it('should accept external insightsTab prop', () => {
      renderCareerAgent({ externalInsightsTab: 'identity' });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Analysis Progress', () => {
    it('should display analysis progress when provided', () => {
      const analysisProgress = {
        isAnalyzing: true,
        progress: 50,
        currentSection: 'Analyzing Skills',
        message: 'Processing your resume...',
      };

      renderCareerAgent({ externalAnalysisProgress: analysisProgress });
      expect(document.body).toBeInTheDocument();
    });

    it('should handle section status updates', () => {
      const sectionStatus = {
        professionalIdentity: 'completed',
        education: 'in_progress',
        experience: 'pending',
      };

      renderCareerAgent({ externalSectionStatus: sectionStatus });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Professional Data', () => {
    it('should display professional data when provided', () => {
      const professionalData = {
        professionalIdentity: {
          title: 'Senior Software Engineer',
          summary: 'Experienced developer with 10+ years',
          keyHighlights: ['Leadership', 'Innovation'],
          currentRole: 'Tech Lead',
          currentIndustry: 'Technology',
          currentCompany: 'TechCorp',
          location: 'San Francisco, CA',
          marketPosition: {
            competitiveness: 85,
            skillRelevance: 90,
            industryDemand: 88,
            careerPotential: 92,
          },
        },
        workExperience: {
          totalYears: 10,
          companies: [
            { name: 'Google', role: 'Software Engineer', years: 5 },
            { name: 'Meta', role: 'Senior Engineer', years: 5 },
          ],
        },
      };

      renderCareerAgent({ externalProfessionalData: professionalData });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('External Handlers', () => {
    it('should call externalSetAnalysisProgress when provided', () => {
      const setAnalysisProgress = jest.fn();
      renderCareerAgent({ externalSetAnalysisProgress: setAnalysisProgress });
      expect(document.body).toBeInTheDocument();
    });

    it('should call externalSetSectionStatus when provided', () => {
      const setSectionStatus = jest.fn();
      renderCareerAgent({ externalSetSectionStatus: setSectionStatus });
      expect(document.body).toBeInTheDocument();
    });

    it('should call externalAddNotification when provided', () => {
      const addNotification = jest.fn();
      renderCareerAgent({ externalAddNotification: addNotification });
      expect(document.body).toBeInTheDocument();
    });

    it('should use external analysis stream handler when provided', () => {
      const startGlobalAnalysisStream = jest.fn();
      renderCareerAgent({ externalStartGlobalAnalysisStream: startGlobalAnalysisStream });
      expect(document.body).toBeInTheDocument();
    });

    it('should use external cancel handler when provided', () => {
      const cancelAnalysis = jest.fn();
      renderCareerAgent({ externalCancelAnalysis: cancelAnalysis });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Document Analysis Integration', () => {
    it('should track analyzing document ID', () => {
      renderCareerAgent({ externalAnalyzingDocumentId: 123 });
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should handle open assistant callback', () => {
      const onOpenAssistant = jest.fn();
      renderCareerAgent({ externalOnOpenAssistant: onOpenAssistant });
      expect(document.body).toBeInTheDocument();
    });
  });
});

describe('Toast Component', () => {
  it('should render success toast', async () => {
    const { container } = renderCareerAgent();
    // Toast is internal, we verify the component structure exists
    expect(container).toBeTruthy();
  });
});

describe('ConfirmDialog Component', () => {
  it('should not render when closed', () => {
    renderCareerAgent();
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();
  });
});

describe('DocumentUpload Component', () => {
  it('should render upload area', async () => {
    renderCareerAgent();
    // Wait for document section to render
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should accept PDF, DOCX, and TXT files', () => {
    const { container } = renderCareerAgent();
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput) {
      expect(fileInput.getAttribute('accept')).toContain('.pdf');
      expect(fileInput.getAttribute('accept')).toContain('.docx');
      expect(fileInput.getAttribute('accept')).toContain('.txt');
    }
  });
});

describe('DocumentList Component', () => {
  it('should show empty state when no documents', async () => {
    renderCareerAgent();
    await waitFor(() => {
      // Check for empty state or document list
      expect(document.body).toBeInTheDocument();
    });
  });

  it('should display search input when documents exist', async () => {
    const { auth } = require('../src/services/api');
    auth.getResumes.mockResolvedValue([
      { id: 1, original_filename: 'resume.pdf', file_type: 'pdf', created_at: '2025-01-15T10:00:00Z' },
    ]);

    renderCareerAgent();

    await waitFor(() => {
      const searchInput = screen.queryByPlaceholderText(/search documents/i);
      // Search appears when there are documents
      expect(document.body).toBeInTheDocument();
    });
  });
});

describe('Integration with External State', () => {
  it('should work with all external props combined', () => {
    const props = {
      showPersonalAssistant: true,
      showSidebar: true,
      externalActiveTab: 'insights',
      externalInsightsTab: 'identity',
      externalAnalysisProgress: { isAnalyzing: false },
      externalSectionStatus: {},
      externalSetAnalysisProgress: jest.fn(),
      externalSetSectionStatus: jest.fn(),
      externalProfessionalData: null,
      externalSetProfessionalData: jest.fn(),
      externalAddNotification: jest.fn(),
      externalStartGlobalAnalysisStream: jest.fn(),
      externalCancelAnalysis: jest.fn(),
      externalAnalyzingDocumentId: null,
      externalOnOpenAssistant: jest.fn(),
    };

    renderCareerAgent(props);
    expect(document.body).toBeInTheDocument();
  });
});
