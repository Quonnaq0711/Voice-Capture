import { useState, useEffect } from 'react';
import { 
  Home, 
  Lightbulb, 
  FileText, 
  MessageSquare,
  Plane,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Import separated components
import TopNavigation from './TopNavigation';
import Sidebar from './Sidebar';
import AgentPreviewModal from './AgentPreviewModal';
import MobileMenuOverlay from './MobileMenuOverlay';
import PersonalLandingPage from './PersonalLandingPage';
import Documents from './Documents';
import ChatHistoryActivities from './ChatHistoryActivities';

// Import API services
import profileAPI from '../../services/api';
import activitiesAPI from '../../services/api';

export default function UnifiedSidebarRefactored() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  
  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('landing');
  
  // Career Insights state
  const [showInsightsSubTabs, setShowInsightsSubTabs] = useState(false);
  const [insightsTab, setInsightsTab] = useState('identity');
  
  // Analysis state
  const [analysisProgress, setAnalysisProgress] = useState({
    isAnalyzing: false,
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
  
  const [professionalData, setProfessionalData] = useState(null);
  const [lastAnalyzedDocumentId, setLastAnalyzedDocumentId] = useState(null);

  // Modal state for agent previews
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // User data state
  const [userData, setUserData] = useState({ first_name: '', email: '' });
  const [isImgError, setImgError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);
  
  const addNotification = (notification) => {
    setNotifications(prev => [...prev, { 
      ...notification, 
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
  };

  // Initialize activitiesAPI with auth token
  useEffect(() => {
    if (user?.token) {
      activitiesAPI.setAuthToken(user.token);
    }
  }, [user]);

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
    navigate('/profile');
  };
  
  // Handler for upload resume
  const handleUploadResume = () => {
    setActiveTab('documents');
  };
    
  // Handler for Chat History
  const handleChatClick = (chat) => {
    handleTrackActivity('view', 'chat_history', `Opened chat: ${chat.name}`, null, { chat_id: chat.id });
    navigate(`/chat/messages?session_id=${chat.id}`);
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
      name: 'Career Agent Insights', 
      icon: Lightbulb,
      hasSubTabs: true,
      disabled: false 
    },
    { 
      id: 'travel-agent', 
      name: 'Travel Agent', 
      icon: Plane,
      preview: true,
      disabled: false,
      isAgentPreview: true,
      agentName: 'Travel Agent'
    },
    { 
      id: 'body-agent', 
      name: 'Body Agent', 
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
      name: 'Chat History & Activity', 
      icon: MessageSquare,
      disabled: false 
    }
  ];

  // Insights sub-tabs configuration
  const insightsSubTabs = [
    { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
    { id: 'work', label: 'Work Experience Analysis', section: 'workExperience' },
    { id: 'salary', label: 'Salary Analysis', section: 'salaryAnalysis' },
    { id: 'skills', label: 'Skills Analysis', section: 'skillsAnalysis' },
    { id: 'market', label: 'Market Position Analysis', section: 'marketPosition' }
  ];

  // Sidebar handlers
  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarExpanded(!sidebarExpanded);
    }
  };

  const handleInsightsToggle = () => {
    setShowInsightsSubTabs(!showInsightsSubTabs);
    if (!showInsightsSubTabs) {
      setActiveTab('career-insights');
    }
  };

  const handleInsightsSubTabChange = (subTabId) => {
    setInsightsTab(subTabId);
    setActiveTab('career-insights');
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleTabChange = (tab) => {
    if (tab.isAgentPreview) {
      handleOpenAgentModal(tab.agentName);
      setMobileMenuOpen(false);
      return;
    }

    setActiveTab(tab.id);
    
    if (tab.id !== 'career-insights') {
      setShowInsightsSubTabs(false);
    }

    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleOpenAgentModal = (agentName) => {
    if (agentName === 'Travel Agent') {
      setSelectedAgent({
        title: 'Travel Agent (Preview)',
        imageSrc: 'TravelAgent'
      });
      setAgentModalOpen(true);
    } else if (agentName === 'Body Agent') {
      setSelectedAgent({
        title: 'Body Agent (Preview)',
        imageSrc: '/design/Body Agent 3.0.png'
      });
      setAgentModalOpen(true);
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'landing':
        return (
          <PersonalLandingPage
            onUploadResume={handleUploadResume}
            onCustomizeProfile={handleAccount}
          />
        );
    
      case 'career-insights':
        return (
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Career Agent Insights</h1>
            <p className="text-gray-600">Viewing: {insightsSubTabs.find(t => t.id === insightsTab)?.label}</p>
          </div>
        );
      
      case 'documents':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Career Documents</h2>
                  <p className="text-gray-600">Manage your professional documents and certifications</p>
                </div>
              </div>
              <Documents
                analysisProgress={analysisProgress}
                setAnalysisProgress={setAnalysisProgress}
                setSectionStatus={setSectionStatus}
                setProfessionalData={setProfessionalData}
                addNotification={addNotification}
                setLastAnalyzedDocumentId={setLastAnalyzedDocumentId}
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
            insightsSubTabs={insightsSubTabs}
            showInsightsSubTabs={showInsightsSubTabs}
            insightsTab={insightsTab}
            sectionStatus={sectionStatus}
            analysisProgress={analysisProgress}
            onToggleSidebar={toggleSidebar}
            onCloseMobileMenu={() => setMobileMenuOpen(false)}
            onTabChange={handleTabChange}
            onInsightsToggle={handleInsightsToggle}
            onInsightsSubTabChange={handleInsightsSubTabChange}
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
    </>
  );
}