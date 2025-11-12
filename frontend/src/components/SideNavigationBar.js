import { useState } from 'react';
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
  Plane,
  Activity,
} from 'lucide-react';

import ChatHistoryActivities from './LandingPage/ChatHistoryActivities';

export default function UnifiedSidebar() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
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
  const [chatHistoryTab, setChatHistoryTab] = useState('history'); // 'history' or 'activity'
 
  // User Data
  const [userData, setUserData] = useState({ first_name: '', email: "" });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isImgError, setImgError] = useState(false);


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
    setSidebarExpanded(!sidebarExpanded);
  };

  const handleInsightsToggle = () => {
    setShowInsightsSubTabs(!showInsightsSubTabs);
  };

  const handleInsightsSubTabChange = (subTabId) => {
    setInsightsTab(subTabId);
    setActiveTab('career-insights');
  };

  const handleTabChange = (tab) => {
    // If it's an agent preview, open the modal instead
    if (tab.isAgentPreview) {
      handleOpenAgentModal(tab.agentName);
      return;
    }

    setActiveTab(tab.id);
    
    // Collapse insights subtabs when navigating away from career insights
    if (tab.id !== 'career-insights') {
      setShowInsightsSubTabs(false);
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
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Personal Landing Page</h1>
            <p className="text-gray-600">Welcome to your personal dashboard.</p>
          </div>
        );
      
      case 'career-insights':
        return (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Career Agent Insights</h1>
            <p className="text-gray-600">Viewing: {insightsSubTabs.find(t => t.id === insightsTab)?.label}</p>
          </div>
        );
      
      case 'documents':
        return (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Documents</h1>
            <p className="text-gray-600">Your document library.</p>
          </div>
        );
      
      case 'chat-history':
        return (
          <div className="bg-white rounded-lg shadow-sm h-full">
            {/* Chat History Header with Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setChatHistoryTab('history')}
                  className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                    chatHistoryTab === 'history'
                      ? 'text-gray-900 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Chat History
                </button>
                <button
                  onClick={() => setChatHistoryTab('activity')}
                  className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                    chatHistoryTab === 'activity'
                      ? 'text-gray-900 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Activity
                </button>
              </div>
            </div>

            {/* Chat History Content */}
            <div className="p-6">
              {chatHistoryTab === 'history' ? (
                <div className="space-y-2">
                  {chatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-500 w-8">{chat.date}</span>
                      <span className="text-sm text-gray-700">{chat.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {activityDates.map((date, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                    >
                      <span className="text-sm text-gray-700">{date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome</h1>
          </div>
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex">
        {/* Sidebar */}
        <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 relative ${
          sidebarExpanded ? 'w-64' : 'w-16'
        }`}>
          {/* Collapse/Expand Button */}
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

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {!sidebarExpanded ? (
              // Collapsed sidebar - icon only
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
              // Expanded sidebar - full labels
              <div className="space-y-1">
                {mainTabs.map((tab) => {
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
                        <span className="font-medium flex-1">{tab.name}</span>
                        {tab.preview && !isDisabled && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
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
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center ${
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
                              {item.label}
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
          <div className={`p-4 border-t border-gray-200 ${!sidebarExpanded ? 'px-2' : ''}`}>
            {sidebarExpanded ? (
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  © 2025 Idii
                </div>
                <button className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-300 hover:border-gray-400 transition-colors">
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
        <div className="flex-1 p-8">
          {renderTabContent()}
        </div>
      </div>

      {/* Agent Preview Modal */}
      {agentModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{selectedAgent.title}</h2>
              <button
                onClick={() => setAgentModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
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


        //Main Content Plugins
        
        // const renderTabContent = () => {
        //   switch (activeTab) {
        //     case 'welcome':
        //       return <WelcomePage />;
        //     case 'insights':
        //       return <PersonalizedInsights />;
        //     case 'achievements':
        //       return <AchievementsProgress />;
        //     case 'recommendations':
        //       return <TodaysRecommendations />;
        //     default:
        //       return <WelcomePage />;
        //   }
        // };
