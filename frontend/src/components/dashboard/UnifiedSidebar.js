import { useState, useEffect, useRef, startTransition } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import {
  Home,
  Lightbulb,
  FileText,
  MessageSquare,
  Plane,
  Activity,
  Briefcase,
  MapPin,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Import layout components
import TopNavigation from '../layout/TopNavigation';
import Sidebar from '../layout/Sidebar';
import MobileMenuOverlay from '../layout/MobileMenuOverlay';

// Import dashboard components
import AgentPreviewModal from './AgentPreviewModal';
import PersonalLandingPage from './PersonalLandingPage';
import Documents from './Documents';
import ChatHistoryActivities from './ChatHistoryActivities';

// Import feature components
import PersonalAssistant from '../chat/PersonalAssistant';
import CareerAgent from '../agents/CareerAgent';
import { profile as profileAPI, activities as activitiesAPI, streamingFetch } from '../../services/api';

// Static images from public/design/ folder
const TravelAgentImg = '/design/TravelAgent.png';
const BodyAgentImg = '/design/BodyAgent.png';

export default function UnifiedSidebarRefactored() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  
  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('landing');
  
  // Career sub-tabs state
  const [showCareerSubTabs, setShowCareerSubTabs] = useState(false);
  const [careerSubTab, setCareerSubTab] = useState('insights');
  const [careerInsightsSubTab, setCareerInsightsSubTab] = useState('identity');
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true); // Control insights sub-items visibility
  
  // Analysis state
  const [analysisProgress, setAnalysisProgress] = useState({
    isAnalyzing: false,
    isCancelling: false,  // Shows "Cancelling..." state immediately when Cancel is clicked
    currentSection: null,
    completedSections: [],
    totalSections: 7,
    progress: 0,
    error: null
  });
  
  const [sectionStatus, setSectionStatus] = useState({
    professionalIdentity: 'pending',
    workExperience: 'pending',
    salaryAnalysis: 'pending',
    skillsAnalysis: 'pending',
    marketPosition: 'pending'
  });
  
  const [professionalData, setProfessionalData] = useState({
    professionalIdentity: {
      title: '',
      summary: '',
      keyHighlights: [],
      currentRole: '',
      currentIndustry: '',
      currentCompany: '',
      location: '',
      marketPosition: {
        competitiveness: 0,
        skillRelevance: 0,
        industryDemand: 0,
        careerPotential: 0
      }
    },
    educationBackground: {
      highestDegree: '',
      totalYearsOfEducation: 0,
      educationTimeline: [],
      certifications: [],
      academicAchievements: []
    },
    workExperience: {
      totalYears: 0,
      timelineStart: null,
      timelineEnd: null,
      analytics: {
        workingYears: { years: '', period: '' },
        heldRoles: { count: '', longest: '' },
        heldTitles: { count: '', shortest: '' },
        companies: { count: '', longest: '' },
        insights: {
          gaps: '',
          shortestTenure: '',
          companySize: '',
          averageRoleDuration: ''
        }
      },
      companies: [],
      industries: []
    },
    skillsAnalysis: {
      hardSkills: [],
      softSkills: [],
      coreStrengths: [],
      developmentAreas: []
    },
    careerTrajectory: [],
    strengthsWeaknesses: {
      strengths: [],
      weaknesses: []
    },
    salaryAnalysis: {
      currentSalary: null,
      historicalTrends: [],
      marketComparison: null,
      predictedGrowth: null,
      salaryFactors: [],
      recommendations: []
    }
  });
  const [lastAnalyzedDocumentId, setLastAnalyzedDocumentId] = useState(null);

  // Modal state for agent previews
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Personal Assistant dialog state
  const [isAssistantDialogOpen, setIsAssistantDialogOpen] = useState(false);
  const [initialSessionId, setInitialSessionId] = useState(null);

  // User data state
  const [userData, setUserData] = useState({ first_name: '', email: '' });
  const [isImgError, setImgError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);
  
  const addNotification = (notification) => {
    // Generate unique ID using timestamp + random number if no ID provided
    const uniqueId = notification.id || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newNotification = {
      ...notification,
      id: uniqueId,
      timestamp: notification.timestamp || new Date().toISOString()
    };

    setNotifications(prev => {
      // If a custom ID is provided, check for duplicates
      if (notification.id) {
        const existingIndex = prev.findIndex(n => n.id === uniqueId);
        if (existingIndex !== -1) {
          // Update existing notification instead of adding duplicate
          const updated = [...prev];
          updated[existingIndex] = newNotification;
          return updated;
        }
      }
      // Add new notification
      return [...prev, newNotification];
    });
  };

  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Fetch user data on mount
  useEffect(() => {
    fetchUserData();
    fetchAvatar();
  }, []);

  // Detect screen size and set mobile state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Global analysis stream handler reference
  const activeReaderRef = useRef(null);
  const analysisCancelledRef = useRef(false);
  const [analysisSessionId, setAnalysisSessionId] = useState(null);
  // Generation counter to ignore stale events from old analysis requests
  // This increments each time a new analysis starts, ensuring old events are dropped
  const analysisGenerationRef = useRef(0);

  // Global resume analysis stream starter - called by Documents component
  const startGlobalAnalysisStream = async (userId, documentId, documentFilename) => {
    // CRITICAL: Cancel any existing analysis before starting a new one
    // This prevents two analyses from running concurrently
    if (activeReaderRef.current) {
      try {
        activeReaderRef.current.cancel();
      } catch (error) {
        // Ignore cleanup errors
      }
      activeReaderRef.current = null;
    }

    // Cancel previous backend analysis if session exists
    if (analysisSessionId) {
      try {
        const cancelUrl = process.env.NODE_ENV === 'production'
          ? `/api/career/analyze/cancel/${analysisSessionId}`
          : `${process.env.REACT_APP_CAREER_URL || 'http://localhost:6002'}/api/career/analyze/cancel/${analysisSessionId}`;
        await fetch(cancelUrl, { method: 'DELETE' });
      } catch (error) {
        // Ignore cancel errors
      }
      setAnalysisSessionId(null);
    }

    // Reset cancellation flag at start of new analysis
    analysisCancelledRef.current = false;

    // CRITICAL: Increment generation counter to invalidate any stale events from previous analysis
    // This ensures that if an old streaming loop is still processing, it will drop all events
    analysisGenerationRef.current += 1;
    const currentGeneration = analysisGenerationRef.current;

    try {
      // Reset and prepare analysis state (clear any previous cancelling state)
      setAnalysisProgress({
        isAnalyzing: true,
        isCancelling: false,
        currentSection: null,
        completedSections: [],
        totalSections: 7,
        progress: 0,
        error: null
      });

      setSectionStatus({
        professionalIdentity: 'pending',
        educationBackground: 'pending',
        workExperience: 'pending',
        skillsAnalysis: 'pending',
        marketPosition: 'pending',
        careerTrajectory: 'pending',
        strengthsWeaknesses: 'pending',
        salaryAnalysis: 'pending'
      });

      setProfessionalData({
        professionalIdentity: {
          title: '', summary: '', keyHighlights: [], currentRole: '', currentIndustry: '',
          currentCompany: '', location: '',
          marketPosition: { competitiveness: 0, skillRelevance: 0, industryDemand: 0, careerPotential: 0 }
        },
        educationBackground: {
          highestDegree: '', totalYearsOfEducation: 0, educationTimeline: [],
          certifications: [], academicAchievements: []
        },
        workExperience: {
          totalYears: 0, timelineStart: null, timelineEnd: null,
          analytics: {
            workingYears: { years: '', period: '' }, heldRoles: { count: '', longest: '' },
            heldTitles: { count: '', shortest: '' }, companies: { count: '', longest: '' },
            insights: { gaps: '', shortestTenure: '', companyChanges: '', careerProgression: '' }
          },
          companies: [], industries: []
        },
        skillsAnalysis: { hardSkills: [], softSkills: [], coreStrengths: [], developmentAreas: [] },
        careerTrajectory: [],
        strengthsWeaknesses: { strengths: [], weaknesses: [] },
        salaryAnalysis: {
          currentSalary: null, historicalTrends: [], marketComparison: null,
          predictedGrowth: null, salaryFactors: [], recommendations: []
        }
      });

      setLastAnalyzedDocumentId(documentId);

      addNotification({
        type: 'progress',
        title: 'Resume Analysis Started',
        message: `Starting comprehensive analysis of ${documentFilename}`,
        details: 'This may take a few minutes. You will see real-time updates as each section completes.'
      });

      // Call streaming API
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/career/analyze_resume_streaming'
        : (process.env.REACT_APP_CAREER_URL || 'http://localhost:6002') + '/api/career/analyze_resume_streaming';

      const response = await streamingFetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          user_id: String(userId),
          resume_id: String(documentId)
        })
      });

      const reader = response.body.getReader();
      activeReaderRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        // Check if analysis was cancelled
        if (analysisCancelledRef.current) break;

        // CRITICAL: Check if a newer analysis has started (generation changed)
        // This handles the race condition where old events are still being processed
        if (analysisGenerationRef.current !== currentGeneration) break;

        const { done, value } = await reader.read();
        if (done) break;

        // Check cancellation again after read (in case cancelled during blocking read)
        if (analysisCancelledRef.current) break;

        // Check generation again after read to catch race conditions
        if (analysisGenerationRef.current !== currentGeneration) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // CRITICAL: Check generation before processing each event to prevent stale updates
          if (analysisGenerationRef.current !== currentGeneration) break;

          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonString = line.slice(6).trim();
              if (!jsonString) continue;

              const data = JSON.parse(jsonString);

              // Extract session_id from initial status message for cancellation support
              if (data.type === 'status' && data.session_id) {
                setAnalysisSessionId(data.session_id);
              }

              if (data.type === 'section_start') {
                // Backend sends section_start when beginning a new section
                unstable_batchedUpdates(() => {
                  setAnalysisProgress(prev => ({
                    ...prev,
                    currentSection: data.section,
                    progress: data.progress || prev.progress,
                    totalSections: data.total_sections || 7,
                    isAnalyzing: true
                  }));
                  setSectionStatus(prev => ({ ...prev, [data.section]: 'analyzing' }));
                });

              } else if (data.type === 'section_complete') {
                // Batch all state updates together for better performance
                unstable_batchedUpdates(() => {
                  // Update professional data with the new section
                  if (data.data) {
                    const sectionData = data.data[data.section] || data.data;
                    setProfessionalData(prev => ({ ...prev, [data.section]: sectionData }));
                  }

                  // Update section status
                  setSectionStatus(prev => ({ ...prev, [data.section]: 'completed' }));

                  // Update analysis progress
                  setAnalysisProgress(prev => {
                    const newCompletedSections = [...prev.completedSections, data.section];
                    const newProgress = Math.round((newCompletedSections.length / prev.totalSections) * 100);
                    return {
                      ...prev,
                      completedSections: newCompletedSections,
                      progress: newProgress,
                      currentSection: null
                    };
                  });
                });

                // Defer notification to avoid blocking render (non-critical UI update)
                startTransition(() => {
                  const sectionName = data.section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  addNotification({
                    type: 'complete',
                    title: `✅ ${sectionName} Complete`,
                    message: `${sectionName} analysis completed successfully! New insights are now available in your career profile.`,
                    timestamp: Date.now()
                  });
                });

              } else if (data.type === 'analysis_complete') {
                // Batch final state updates for completion
                unstable_batchedUpdates(() => {
                  setAnalysisProgress(prev => ({
                    ...prev,
                    isAnalyzing: false,
                    currentSection: null,
                    progress: data.success ? 100 : prev.progress,
                    error: data.error || null
                  }));

                  if (data.professional_data) {
                    setProfessionalData(prev => ({ ...prev, ...data.professional_data }));
                  }
                });

                // Defer notification to non-blocking update
                startTransition(() => {
                  if (data.success) {
                    addNotification({
                      type: 'complete',
                      title: '✅ Resume Analysis Complete',
                      message: 'Resume analysis completed successfully! All insights are now available in your career profile.',
                      timestamp: Date.now()
                    });
                  } else if (data.error) {
                    addNotification({
                      type: 'error',
                      title: 'Analysis Failed',
                      message: 'There was an error completing your career analysis',
                      details: data.error
                    });
                  }
                });

                activeReaderRef.current = null;
                break;

              } else if (data.type === 'cancelled') {
                // Handle backend cancellation confirmation
                unstable_batchedUpdates(() => {
                  setAnalysisProgress(prev => ({
                    ...prev,
                    isAnalyzing: false,
                    isCancelling: false,
                    currentSection: null,
                    error: 'Analysis cancelled by user'
                  }));
                });

                startTransition(() => {
                  addNotification({
                    type: 'warning',
                    title: 'Analysis Cancelled',
                    message: `Analysis cancelled. ${data.sections_completed || 0} sections were completed.`,
                    timestamp: Date.now()
                  });
                });

                activeReaderRef.current = null;
                break;

              } else if (data.type === 'section_error') {
                // Handle individual section failures (analysis may continue)
                unstable_batchedUpdates(() => {
                  setSectionStatus(prev => ({ ...prev, [data.section]: 'failed' }));
                  setAnalysisProgress(prev => ({
                    ...prev,
                    progress: data.progress || prev.progress
                  }));
                });

                startTransition(() => {
                  const sectionName = data.display_name || data.section;
                  addNotification({
                    type: 'error',
                    title: `Section Failed: ${sectionName}`,
                    message: data.can_continue
                      ? 'Analysis will continue with remaining sections.'
                      : 'Too many failures. Analysis stopped.',
                    details: data.error,
                    timestamp: Date.now()
                  });
                });

              } else if (data.type === 'error') {
                // Handle fatal errors from backend
                unstable_batchedUpdates(() => {
                  setAnalysisProgress(prev => ({
                    ...prev,
                    isAnalyzing: false,
                    isCancelling: false,
                    currentSection: null,
                    error: data.message || 'An error occurred during analysis'
                  }));
                });

                startTransition(() => {
                  addNotification({
                    type: 'error',
                    title: 'Analysis Error',
                    message: data.message || 'An unexpected error occurred',
                    details: data.original_error || data.error_details,
                    timestamp: Date.now()
                  });
                });

                activeReaderRef.current = null;
                break;
              }
            } catch (parseError) {
              // Skip malformed streaming data
            }
          }
        }
      }
    } catch (error) {
      setAnalysisProgress(prev => ({
        ...prev,
        isAnalyzing: false,
        error: `Failed to analyze resume: ${error.message}`
      }));

      addNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: 'Failed to analyze resume',
        details: error.message || 'An unexpected error occurred during analysis'
      });

      activeReaderRef.current = null;
    }
  };

  // Cleanup reader on unmount
  useEffect(() => {
    return () => {
      if (activeReaderRef.current) {
        try {
          activeReaderRef.current.cancel();
        } catch (error) {
          // Ignore cleanup errors
        }
        activeReaderRef.current = null;
      }
    };
  }, []);

  // Cancel analysis handler - allows user to stop ongoing analysis
  const cancelAnalysis = async () => {
    // Only proceed if analysis is actually running
    if (!analysisProgress.isAnalyzing) return;

    // Immediately show "Cancelling..." state to give user feedback
    // Actual cancellation happens after current LLM section completes
    setAnalysisProgress(prev => ({
      ...prev,
      isCancelling: true
    }));

    // Set cancellation flag - this will stop the streaming loop
    analysisCancelledRef.current = true;

    // Try to cancel the reader if available
    if (activeReaderRef.current) {
      try {
        activeReaderRef.current.cancel();
      } catch (error) {
        // Ignore cleanup errors
      }
      activeReaderRef.current = null;
    }

    // Call backend cancel API to stop LLM processing
    if (analysisSessionId) {
      try {
        const cancelUrl = process.env.NODE_ENV === 'production'
          ? `/api/career/analyze/cancel/${analysisSessionId}`
          : `${process.env.REACT_APP_CAREER_URL || 'http://localhost:6002'}/api/career/analyze/cancel/${analysisSessionId}`;

        await fetch(cancelUrl, { method: 'DELETE' });
      } catch (error) {
        // Continue with frontend cancellation even if backend call fails
      }
      setAnalysisSessionId(null);
    }

    // Reset analysis state (including isCancelling flag)
    setAnalysisProgress(prev => ({
      ...prev,
      isAnalyzing: false,
      isCancelling: false,
      currentSection: null,
      error: 'Analysis cancelled by user'
    }));

    // Add cancellation notification
    addNotification({
      type: 'warning',
      title: 'Analysis Cancelled',
      message: 'Resume analysis was cancelled. Previously completed sections are preserved.',
      timestamp: Date.now()
    });
  };

  // Fetch user data
  const fetchUserData = async () => {
    try {
      setLoadingUser(true);
      const data = await profileAPI.getCurrentUser();
      setUserData({
        first_name: data.first_name,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData({ first_name: 'User', email: '' });
      addNotification({
        type: 'error',
        message: 'Failed to load user profile'
      });
    } finally {
      setLoadingUser(false);
    }
  };
    
  const fetchAvatar = async () => {
    try {
      const data = await profileAPI.getAvatarUrl();
      let url = data.url;
      if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        url = backendUrl + url;
      }
      
      const timestamp = new Date().getTime();
      const urlWithTimestamp = url.includes('?') 
        ? `${url}&t=${timestamp}` 
        : `${url}?t=${timestamp}`;
      
      setAvatarUrl(urlWithTimestamp);
    } catch (error) {
      console.error("Error fetching avatar:", error);
    }
  };

  // Handler for logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handler for account/profile
  const handleAccount = () => {
    navigate('/profile', { state: { tab: 'account' } });
  };
  
  // Handler for upload resume
  const handleUploadResume = () => {
    setActiveTab('documents');
  };
    
  // Handler for Chat History
  const handleChatClick = (chat) => {
    handleTrackActivity('view', 'chat_history', `Opened chat: ${chat.name}`, null, { chat_id: chat.id });
    // Open Personal Assistant dialog and switch to the selected session
    setInitialSessionId(chat.id);
    setIsAssistantDialogOpen(true);
  };

  // Track activity callback
  const handleTrackActivity = async (activityType, activitySource, title, description = null, metadata = {}) => {
    try {
      await activitiesAPI.createActivity({
        activity_type: activityType,
        activity_source: activitySource,
        activity_title: title,
        activity_description: description,
        activity_metadata: metadata
      });
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  // Main tabs configuration
  const mainTabs = [
    {
      id: 'landing',
      name: 'Dashboard',
      icon: Home,
      disabled: false
    },
    {
      id: 'career-insights',
      name: 'Career',
      icon: Lightbulb,
      hasSubTabs: true,
      disabled: false
    },
    {
      id: 'travel-agent',
      name: 'Travel',
      icon: Plane,
      preview: true,
      disabled: false,
      isAgentPreview: true,
      agentName: 'Travel Agent'
    },
    {
      id: 'body-agent',
      name: 'Wellness',
      icon: Activity,
      preview: true,
      disabled: false,
      isAgentPreview: true,
      agentName: 'Body Agent'
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: FileText,
      disabled: false
    },
    {
      id: 'chat-history',
      name: 'Activities',
      icon: MessageSquare,
      disabled: false
    }
  ];

  // Career sub-tabs configuration
  const careerSubTabs = [
    {
      id: 'insights',
      name: 'Career Insights',
      icon: Lightbulb,
      hasSubMenu: true,
      subItems: [
        { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
        { id: 'education', label: 'Education Background', section: 'educationBackground' },
        { id: 'work', label: 'Work Experience', section: 'workExperience' },
        { id: 'salary', label: 'Salary', section: 'salaryAnalysis' },
        { id: 'skills', label: 'Skills', section: 'skillsAnalysis' }
      ]
    },
    {
      id: 'job-search',
      name: 'Job Search',
      icon: Briefcase,
      hasSubMenu: false,
      comingSoon: true
    },
    {
      id: 'planning',
      name: 'Career Planning',
      icon: MapPin,
      hasSubMenu: false,
      comingSoon: true
    },
    {
      id: 'resumes',
      name: 'Documents',
      icon: FileText,
      hasSubMenu: false
    }
  ];

  // Sidebar handlers
  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarExpanded(!sidebarExpanded);
    }
  };

  const handleCareerSubTabClick = (subTabId) => {
    // If clicking insights when already on insights, toggle the sub-menu
    if (subTabId === 'insights' && careerSubTab === 'insights') {
      setIsInsightsExpanded(!isInsightsExpanded);
    } else {
      // Otherwise, switch to the clicked tab
      setCareerSubTab(subTabId);
      setActiveTab('career-insights');

      // If switching to insights from another tab, keep it expanded
      if (subTabId === 'insights') {
        setIsInsightsExpanded(true);
      }
    }

    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleCareerInsightsSubClick = (insightId) => {
    setCareerInsightsSubTab(insightId);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // Handle navigation from RecentInsights to Career Insights
  const handleCareerInsightsNavigation = (insightId = null) => {
    // Switch to career-insights tab
    setActiveTab('career-insights');
    setShowCareerSubTabs(true);
    setCareerSubTab('insights');
    setIsInsightsExpanded(true);

    // If a specific insight ID is provided, navigate to that sub-section
    if (insightId) {
      setCareerInsightsSubTab(insightId);
    }

    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleTabChange = (tab) => {
    // Always set active tab first for visual feedback
    setActiveTab(tab.id);

    // Toggle career sub-tabs when clicking Career
    if (tab.id === 'career-insights') {
      setShowCareerSubTabs(!showCareerSubTabs);
    } else {
      setShowCareerSubTabs(false);
    }

    // If it's an agent preview, open the modal
    if (tab.isAgentPreview) {
      handleOpenAgentModal(tab.agentName);
    }

    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleOpenAgentModal = (agentName) => {
    if (agentName === 'Travel Agent') {
      setSelectedAgent({
        title: 'Preview',
        imageSrc: TravelAgentImg
      });
      setAgentModalOpen(true);
    } else if (agentName === 'Body Agent') {
      setSelectedAgent({
        title: 'Preview',
        imageSrc: BodyAgentImg
      });
      setAgentModalOpen(true);
    }
  };

  // Render career content based on selected sub-tab
  const renderCareerContent = () => {
    // Map UnifiedSidebar sub-tabs to CareerAgent tabs
    const tabMapping = {
      'insights': 'insights',
      'job-search': 'job-search',
      'planning': 'planning',
      'resumes': 'documents'  // Map 'resumes' to 'documents' in CareerAgent
    };

    const mappedTab = tabMapping[careerSubTab] || 'insights';

    return (
      <CareerAgent
        showPersonalAssistant={false}
        showSidebar={false}
        externalActiveTab={mappedTab}
        externalInsightsTab={careerInsightsSubTab}
        externalAnalysisProgress={analysisProgress}
        externalSectionStatus={sectionStatus}
        externalSetAnalysisProgress={setAnalysisProgress}
        externalSetSectionStatus={setSectionStatus}
        externalProfessionalData={professionalData}
        externalSetProfessionalData={setProfessionalData}
        externalAddNotification={addNotification}
        externalStartGlobalAnalysisStream={startGlobalAnalysisStream}
        externalCancelAnalysis={cancelAnalysis}
        externalAnalyzingDocumentId={lastAnalyzedDocumentId}
        externalOnOpenAssistant={() => setIsAssistantDialogOpen(true)}
      />
    );
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'landing':
        return (
          <PersonalLandingPage
            onUploadResume={handleUploadResume}
            onCustomizeProfile={handleAccount}
            onNavigateToCareerInsights={handleCareerInsightsNavigation}
          />
        );

      case 'career-insights':
        return renderCareerContent();
      
      case 'documents':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <Documents
                onUploadClick={() => handleTrackActivity('upload', 'documents', 'Document upload initiated')}
              />
            </div>
          </div>
        );
      
      case 'chat-history':
        return (
          <ChatHistoryActivities 
            activitiesAPI={activitiesAPI}
            onTrackActivity={handleTrackActivity}
            onChatClick={handleChatClick}
          />
        );
      
      default:
        return (
          <PersonalLandingPage
            onUploadResume={handleUploadResume}
            onCustomizeProfile={handleAccount}
            onNavigateToCareerInsights={handleCareerInsightsNavigation}
          />
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navigation Bar */}
        <TopNavigation
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onAccountClick={handleAccount}
          onLogoutClick={handleLogout}
          userData={userData}
          avatarUrl={avatarUrl}
          isImgError={isImgError}
          onImageError={() => setImgError(true)}
          loadingUser={loadingUser}
          isMobile={isMobile}
          notifications={notifications}
          onDismissNotification={dismissNotification}
        />

        {/* Main Content Area with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile Menu Overlay */}
          <MobileMenuOverlay
            isVisible={isMobile && mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar */}
          <Sidebar
            sidebarExpanded={sidebarExpanded}
            mobileMenuOpen={mobileMenuOpen}
            isMobile={isMobile}
            activeTab={activeTab}
            mainTabs={mainTabs}
            careerSubTabs={careerSubTabs}
            showCareerSubTabs={showCareerSubTabs}
            careerSubTab={careerSubTab}
            careerInsightsSubTab={careerInsightsSubTab}
            isInsightsExpanded={isInsightsExpanded}
            onToggleSidebar={toggleSidebar}
            onCloseMobileMenu={() => setMobileMenuOpen(false)}
            onTabChange={handleTabChange}
            onCareerSubTabClick={handleCareerSubTabClick}
            onCareerInsightsSubClick={handleCareerInsightsSubClick}
            analysisProgress={analysisProgress}
            sectionStatus={sectionStatus}
          />

          {/* Main Content */}
          <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Agent Preview Modal */}
      <AgentPreviewModal
        isOpen={agentModalOpen}
        selectedAgent={selectedAgent}
        onClose={() => setAgentModalOpen(false)}
      />

      {/* Personal Assistant - Fixed Position Chatbot */}
      <PersonalAssistant
        user={userData}
        isDialogOpen={isAssistantDialogOpen}
        setIsDialogOpen={setIsAssistantDialogOpen}
        agentType={activeTab === 'career-insights' ? 'career' : 'dashboard'}
        notifications={notifications}
        initialSessionId={initialSessionId}
        onSessionSwitched={() => setInitialSessionId(null)}
      />
    </>
  );
}