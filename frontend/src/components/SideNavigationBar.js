import React, { useState } from 'react';
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
  Sun,
} from 'lucide-react';

export default function UnifiedSidebar() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('welcome');
  const [activeDashboardTab, setActiveDashboardTab] = useState('insights');
  const [showSubTabs, setShowSubTabs] = useState(true);
  const [isInsightsMenuOpen, setIsInsightsMenuOpen] = useState(false);
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
    { id: 'insights', name: 'Career Insights', icon: Lightbulb, disabled: false },
    { id: 'planning', name: 'Career Planning', icon: Map, disabled: true },
    { id: 'job-search', name: 'Job Search', icon: Briefcase, disabled: true },
    { id: 'resume-builder', name: 'Resume Builder', icon: FileText, disabled: true },
    { id: 'documents', name: 'Documents', icon: FileText, disabled: true }
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

  const handleDashboardSectionsToggle = () => {
    setShowSubTabs(!showSubTabs);
    if (activeTab !== 'welcome') {
      setActiveTab('welcome');
    }
  };

  const handleDashboardTabChange = (tabId) => {
    setActiveDashboardTab(tabId);
    setActiveTab('welcome');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'insights') {
      setIsInsightsMenuOpen(true);
    } else {
      setIsInsightsMenuOpen(false);
    }
  };

  const handleInsightsClick = () => {
    setActiveTab('insights');
    setIsInsightsMenuOpen(!isInsightsMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b border-gray-200 transition-all duration-300 ${
          !sidebarExpanded ? 'px-3 py-4' : ''
        }`}>
          {sidebarExpanded ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">I</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Idii.</h1>
                <p className="text-xs text-gray-500">Career Agent</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">I</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <div className="absolute right-0 top-20 transform translate-x-1/2 z-50">
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 bg-white border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md"
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
                          {sidebarExpanded ? (
              <ChevronLeft className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {!sidebarExpanded ? (
            /* Collapsed Sidebar - Show only icons */
            <div className="space-y-2">
              {/* Dashboard Icon */}
              <button
                onClick={handleDashboardSectionsToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Dashboard"
              >
                <Home className="h-5 w-5" />
              </button>

              {/* Tab Icons */}
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
            /* Expanded Sidebar - Show full navigation */
            <div className="space-y-1">
              {/* Dashboard Button */}
              <button
                onClick={handleDashboardSectionsToggle}
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
                {showSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {/* Sub-tabs */}
              {showSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1">
                  {/* Dashboard Sub-sections */}
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

                  {/* Divider */}
                  <div className="my-2 border-t border-gray-200"></div>

                  {/* Career Tools Sub-tabs */}
                  {tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    const isDisabled = tab.disabled;

                    if (tab.id === 'insights') {
                      return (
                        <div key={tab.id}>
                          <button
                            onClick={handleInsightsClick}
                            className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                              activeTab === tab.id
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <IconComponent className={`h-5 w-5 ${
                                activeTab === tab.id ? 'text-white' : 'text-gray-500'
                              }`} />
                              <span className="font-medium">{tab.name}</span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isInsightsMenuOpen ? 'transform rotate-180' : ''
                              } ${
                                activeTab === tab.id ? 'text-white' : 'text-gray-500'
                              }`}
                            />
                          </button>

                          {/* Insights Sub-menu */}
                          {isInsightsMenuOpen && activeTab === 'insights' && (
                            <div className="ml-6 mt-2 space-y-1">
                              {insightsSubTabs.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => setInsightsTab(item.id)}
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
                        </div>
                      );
                    }

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
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}