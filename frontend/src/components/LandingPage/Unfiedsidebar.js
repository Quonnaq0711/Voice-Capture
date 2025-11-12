import { useState, useEffect } from 'react';
import { 
  Home, 
  Lightbulb, 
  FileText, 
  MessageSquare,
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  X,
  Menu,
  Plane,
  Activity,
  UserCircle,
  LogOut
} from 'lucide-react';
import PersonalLandingPage from './PersonalLandingPage';
import ChatHistoryActivities from './ChatHistoryActivities';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Documents from './Documents';
import profileAPI from '../../services/api'

export default function UnifiedSidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('landing');
  const [showInsightsSubTabs, setShowInsightsSubTabs] = useState(false);
  const [insightsTab, setInsightsTab] = useState('identity');
  const [analysisProgress] = useState({ isAnalyzing: false });
  const [sectionStatus] = useState({
    professionalIdentity: 'completed',
    workExperience: 'completed',
    salaryAnalysis: 'pending',
    skillsAnalysis: 'pending',
    marketPosition: 'pending'
  });

  // Modal state for agent previews
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Chat History & Activity state
  //const [chatHistoryTab, setChatHistoryTab] = useState('history'); // 'history' or 'activity'

  // User data state
  const [userData, setUserData] = useState({ first_name: '', email: ''});
  const [isImgError, setImgError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Activities API (passed as prop or configured here)
    const [activitiesAPI, setActivitiesAPI] = useState(null);
    
    

    const handleUploadResume = () => {
        setActiveTab('documents');
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
      // console.log('Activity tracked:', { activityType, activitySource, title, description, metadata });
    // Additional tracking logic can go here
  };
    
    useEffect(() => {
        fetchUserData()
        fetchAvatar()
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
    

  const fetchUserData = async () => {
        try {
          const data = await profileAPI.getCurrentUser();
          setUserData({
            first_name: data.first_name,
            email: data.email
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
  };
    
    const fetchAvatar = async () => {
      try {
        const data = await profileAPI.getAvatarUrl();
        // In development mode, prepend backend URL to relative avatar paths
        let url = data.url;
        if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
          url = backendUrl + url;
        }
        
        // Add timestamp to force cache refresh
        const timestamp = new Date().getTime();
        const urlWithTimestamp = url.includes('?') 
          ? `${url}&t=${timestamp}` 
          : `${url}?t=${timestamp}`;
        
        setAvatarUrl(urlWithTimestamp);
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };


    // Handler for account/profile
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAccount = () => {
    navigate('/profile');
  };
    
   // Handler for Chat History
   const handleChatClick = (chat) => {
  handleTrackActivity('view', 'chat_history', `Opened chat: ${chat.name}`, null, { chat_id: chat.id });
  
  // Navigate to chat messages with session_id query parameter
  navigate(`/chat/messages?session_id=${chat.id}`);
};
    

  const mainTabs = [
    { 
      id: 'landing', 
      name: 'Personal Landing Page', 
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

  const insightsSubTabs = [
    { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
    { id: 'work', label: 'Work Experience Analysis', section: 'workExperience' },
    { id: 'salary', label: 'Salary Analysis', section: 'salaryAnalysis' },
    { id: 'skills', label: 'Skills Analysis', section: 'skillsAnalysis' },
    { id: 'market', label: 'Market Position Analysis', section: 'marketPosition' }
  ];

  // Mock chat history data
  const chatHistory = [
    { id: 1, date: '1/1', name: 'Name of chat or preview' },
    { id: 2, date: '1/1', name: 'Name of chat or preview' },
    { id: 3, date: '1/1', name: 'Name of chat or preview' },
    { id: 4, date: '1/1', name: 'Name of chat or preview' },
    { id: 5, date: '1/1', name: 'Name of chat or preview' },
    { id: 6, date: '1/1', name: 'Name of chat or preview' },
    { id: 7, date: '1/1', name: 'Name of chat or preview' },
    { id: 8, date: '1/1', name: 'Name of chat or preview' },
    { id: 9, date: '1/1', name: 'Name of chat or preview' },
    { id: 10, date: '1/1', name: 'Name of chat or preview' }
  ];

  // Mock activity data
  const activityDates = [
    'January 1, 2026',
    'January 2, 2026',
    'January 3, 2026',
    'January 4, 2026',
    'January 6, 2026',
    'January 7, 2026',
    'January 8, 2026',
    'January 9, 2026',
    'January 10, 2026',
    'January 11, 2026',
    'January 12, 2026',
    'January 13, 2026',
    'January 14, 2026',
    'January 15, 2026'
  ];

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarExpanded(!sidebarExpanded);
    }
  };

  const handleInsightsToggle = () => {
    setShowInsightsSubTabs(!showInsightsSubTabs);
  };

  const handleInsightsSubTabChange = (subTabId) => {
    setInsightsTab(subTabId);
    setActiveTab('career-insights');
    // Close mobile menu after navigation
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleTabChange = (tab) => {
    // If it's an agent preview, open the modal instead
    if (tab.isAgentPreview) {
      handleOpenAgentModal(tab.agentName);
      setMobileMenuOpen(false);
      return;
    }

    setActiveTab(tab.id);
    
    // Collapse insights subtabs when navigating away from career insights
    if (tab.id !== 'career-insights') {
      setShowInsightsSubTabs(false);
    }

    // Close mobile menu after navigation
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // Handler for opening agent design modal
  const handleOpenAgentModal = (agentName) => {
    if (agentName === 'Travel Agent') {
      setSelectedAgent({
        title: 'Travel Agent (Preview)',
        imageSrc: '/design/Travel Agent 4.0.png'
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
                  setAnalysisProgress={Documents.setAnalysisProgress}
                  setSectionStatus={Documents.setSectionStatus}
                  setProfessionalData={Documents.setProfessionalData}
                  addNotification={Documents.addNotification}
                  setLastAnalyzedDocumentId={Documents.setLastAnalyzedDocumentId}onUploadClick={() => handleTrackActivity('upload', 'documents', 'Document upload initiated')}
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
        return <PersonalLandingPage />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navigation Bar */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              {/* Left side - Logo and branding */}
              <div className="flex items-center space-x-4">
                {/* Mobile menu button - only show on mobile */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="h-6 w-6 text-gray-600" />
                </button>

                {/* Logo and title */}
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">I</span>
                  </div>
                  <h1 className="text-xl font-semibold text-gray-900">Idii.</h1>
                </div>
                <div className="hidden lg:flex items-center text-sm text-gray-500">
                  <span>Personal Lifestyle Platform</span>
                </div>
              </div>

              {/* Right side - User profile and logout */}
              <div className="flex items-center space-x-3">
                {/* User Profile */}
                <button
                  onClick={handleAccount}
                  className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex-shrink-0">
                    {avatarUrl && !isImgError ? (
                      <img
                        src={avatarUrl}
                        alt="User Avatar"
                        onError={() => setImgError(true)}
                        className="h-8 w-8 rounded-full object-cover border-2 border-blue-200"
                      />
                    ) : (
                      <UserCircle className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {userData.first_name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-32">
                      {userData.email || ''}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
                </button>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  <LogOut className="w-4 h-4 mr-0 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile Menu Overlay */}
          {isMobile && mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 mt-16"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 relative
            ${isMobile 
              ? `fixed top-16 bottom-0 left-0 z-50 w-64 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
              : sidebarExpanded ? 'w-64' : 'w-16'
            }`}>
          {/* Close button for mobile */}
          {isMobile && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          )}

          {/* Collapse/Expand Button - Desktop only */}
          {!isMobile && (
            <button
              onClick={toggleSidebar}
              className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md z-50"
              aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? (
                <ChevronLeft className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {!sidebarExpanded && !isMobile ? (
              // Collapsed sidebar - icon only (desktop only)
              <div className="space-y-2">
                {mainTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDisabled = tab.disabled;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && handleTabChange(tab)}
                      disabled={isDisabled}
                      className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        isDisabled
                          ? 'text-gray-300 cursor-not-allowed opacity-50'
                          : isActive
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title={tab.name}
                    >
                      <IconComponent className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            ) : (
              // Expanded sidebar - full labels (mobile always shows this)
              <div className="space-y-1">{mainTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDisabled = tab.disabled;
                  const hasSubTabs = tab.hasSubTabs;

                  return (
                    <div key={tab.id}>
                      <button
                        onClick={() => {
                          if (hasSubTabs) {
                            handleInsightsToggle();
                            if (!showInsightsSubTabs) {
                              setActiveTab('career-insights');
                            }
                          } else {
                            handleTabChange(tab);
                          }
                        }}
                        disabled={isDisabled}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                          isDisabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : isActive
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <IconComponent className={`h-5 w-5 flex-shrink-0 ${
                          isDisabled
                            ? 'text-gray-300'
                            : isActive ? 'text-white' : 'text-gray-500'
                        }`} />
                        <span className="font-medium flex-1 text-sm md:text-base">{tab.name}</span>
                        {tab.preview && !isDisabled && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 whitespace-nowrap">
                            preview
                          </span>
                        )}
                        {hasSubTabs && (
                          showInsightsSubTabs ? (
                            <ChevronUp className={`h-4 w-4 ${
                              isActive ? 'text-white' : 'text-gray-400'
                            }`} />
                          ) : (
                            <ChevronDown className={`h-4 w-4 ${
                              isActive ? 'text-white' : 'text-gray-400'
                            }`} />
                          )
                        )}
                      </button>

                      {/* Career Insights Sub-tabs */}
                      {hasSubTabs && showInsightsSubTabs && (
                        <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                          {insightsSubTabs.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleInsightsSubTabChange(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-md text-xs md:text-sm transition-all duration-200 flex items-center ${
                                insightsTab === item.id && activeTab === 'career-insights'
                                  ? 'bg-orange-100 text-orange-600 font-semibold' 
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {sectionStatus[item.section] === 'completed' ? (
                                <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : analysisProgress.isAnalyzing ? (
                                <svg className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : null}
                              <span className="break-words">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className={`p-4 border-t border-gray-200 ${!sidebarExpanded && !isMobile ? 'px-2' : ''}`}>
            {(sidebarExpanded || isMobile) ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-xs text-gray-500">
                  © 2025 Idii
                </div>
                <button className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-300 hover:border-gray-400 transition-colors whitespace-nowrap">
                  Report Bugs
                </button>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50">
          {renderTabContent()}
        </div>
        </div>
      </div>

      {/* Agent Preview Modal */}
      {agentModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate pr-2">{selectedAgent.title}</h2>
              <button
                onClick={() => setAgentModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-3 sm:p-6 overflow-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
              <img 
                src={selectedAgent.imageSrc} 
                alt={selectedAgent.title}
                className="w-full h-auto rounded-lg shadow-sm"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML += '<div class="bg-gray-100 rounded-lg p-8 text-center text-gray-500">Preview image not found</div>';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}