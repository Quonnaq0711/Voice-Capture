import { useState } from 'react';
import { 
  Home, 
  Lightbulb, 
  Map, 
  Briefcase, 
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Star,
  Sun
} from 'lucide-react';

export default function UnifiedSidebar() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('welcome');
  const [activeDashboardTab, setActiveDashboardTab] = useState('insights');
  const [showDashboardSubTabs, setShowDashboardSubTabs] = useState(true);
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

  const dashboardTabs = [
    {
      id: 'insights',
      name: 'AI Insights',
      icon: Lightbulb,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'achievements',
      name: 'Achievements',
      icon: Star,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      disabled: true
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      icon: Sun,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      preview: true
    }
  ];

  const tabs = [
    { id: 'planning', name: 'Career Planning', icon: Map, disabled: true },
    { id: 'job-search', name: 'Job Search', icon: Briefcase, disabled: true },
    { id: 'resume-builder', name: 'Resume Builder', icon: FileText, disabled: true },
    { id: 'documents', name: 'Documents', icon: FileText, disabled: false }
  ];

  const insightsSubTabs = [
    { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
    { id: 'work', label: 'Work Experience Analysis', section: 'workExperience' },
    { id: 'salary', label: 'Salary Analysis', section: 'salaryAnalysis' },
    { id: 'skills', label: 'Skills Analysis', section: 'skillsAnalysis' },
    { id: 'market', label: 'Market Position Analysis', section: 'marketPosition' }
  ];

 const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  const handleDashboardToggle = () => {
    setActiveTab('welcome');
    setShowDashboardSubTabs(!showDashboardSubTabs);
  };

  const handleInsightsToggle = () => {
    setActiveTab('insights');
    setShowInsightsSubTabs(!showInsightsSubTabs); // FIXED: Now uses correct state variable
  };

  const handleDashboardTabChange = (tabId) => {
    setActiveDashboardTab(tabId);
    setActiveTab('welcome');
  };

  const handleInsightsSubTabChange = (subTabId) => {
    setInsightsTab(subTabId);
    setActiveTab('insights');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };


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

 return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex">
      <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 relative ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}>
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

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {!sidebarExpanded ? (
            <div className="space-y-2">
              <button
                onClick={handleDashboardToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Dashboard"
              >
                <Home className="h-5 w-5" />
              </button>

              <button
                onClick={handleInsightsToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Career Insights"
              >
                <Lightbulb className="h-5 w-5" />
              </button>

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;
                const tabTitle = isDisabled ? `${tab.name} - Coming Soon` : tab.name;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={tabTitle}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={handleDashboardToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Home className={`h-5 w-5 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Dashboard</span>
                </div>
                {showDashboardSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {showDashboardSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {dashboardTabs.map((dashTab) => {
                    const DashIconComponent = dashTab.icon;
                    const isDashDisabled = dashTab.disabled;
                    const isPreview = dashTab.preview;

                    return (
                      <button
                        key={dashTab.id}
                        onClick={() => !isDashDisabled && handleDashboardTabChange(dashTab.id)}
                        disabled={isDashDisabled}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-all duration-200 text-sm ${
                          isDashDisabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome'
                            ? `${dashTab.bgColor} ${dashTab.color} border border-current`
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <DashIconComponent className={`h-4 w-4 flex-shrink-0 ${
                          isDashDisabled 
                            ? 'text-gray-300' 
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome' 
                            ? dashTab.color 
                            : 'text-gray-500'
                        }`} />
                        <span className="font-medium text-left flex-1">{dashTab.name}</span>
                        {isDashDisabled && (
                          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                        {isPreview && !isDashDisabled && (
                          <span className="ml-auto text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                            Preview Only
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleInsightsToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Lightbulb className={`h-5 w-5 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Career Insights</span>
                </div>
                {showInsightsSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {/* FIXED: Removed activeTab check for better UX */}
              {showInsightsSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {insightsSubTabs.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleInsightsSubTabChange(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center ${
                        insightsTab === item.id 
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

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className={`h-5 w-5 ${
                      isDisabled
                        ? 'text-gray-300'
                        : activeTab === tab.id ? 'text-white' : 'text-gray-500'
                    }`} />
                    <span className="font-medium">{tab.name}</span>
                    {isDisabled && (
                      <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className={`p-4 border-t border-gray-200 ${!sidebarExpanded ? 'px-2' : ''}`}>
          {sidebarExpanded ? (
            <div className="text-xs text-gray-500 text-center">
              © 2025 Idii
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-8">
        {/* {renderTabContent()} */}
      </div>
    </div>
  );
}