import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  X
} from 'lucide-react';

export default function Sidebar({
  sidebarExpanded,
  mobileMenuOpen,
  isMobile,
  activeTab,
  mainTabs,
  insightsSubTabs,
  showInsightsSubTabs,
  insightsTab,
  sectionStatus,
  analysisProgress,
  onToggleSidebar,
  onCloseMobileMenu,
  onTabChange,
  onInsightsToggle,
  onInsightsSubTabChange
}) {
  return (
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
            onClick={onCloseMobileMenu}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Collapse/Expand Button - Desktop only */}
      {!isMobile && (
        <button
          onClick={onToggleSidebar}
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
                  onClick={() => !isDisabled && onTabChange(tab)}
                  disabled={isDisabled}
                  className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isDisabled
                      ? 'text-gray-300 cursor-not-allowed opacity-50'
                      : isActive
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title={tab.name}
                  aria-label={tab.name}
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
                        onInsightsToggle();
                      } else {
                        onTabChange(tab);
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
                        Preview
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
                          onClick={() => onInsightsSubTabChange(item.id)}
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
              © 2025 Idii.
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
  );
}