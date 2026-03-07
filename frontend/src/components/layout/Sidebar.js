import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,

  X,
  Bug
} from 'lucide-react';

export default function Sidebar({
  sidebarExpanded,
  mobileMenuOpen,
  isMobile,
  activeTab,
  mainTabs,
  careerSubTabs,
  showCareerSubTabs,
  careerSubTab,
  careerInsightsSubTab,
  isInsightsExpanded,
  workSubTabs,
  showWorkSubTabs,
  workSubTab,
  inboxSubTab,
  tasksSubTab,
  toolsSubTab,
  isInboxExpanded,
  isTasksExpanded,
  isToolsExpanded,
  onToggleSidebar,
  onCloseMobileMenu,
  onTabChange,
  onCareerSubTabClick,
  onCareerInsightsSubClick,
  onWorkSubTabClick,
  onInboxSubTabClick,
  onTasksSubTabClick,
  onToolsSubTabClick,
  analysisProgress,
  sectionStatus
}) {
  return (
    <div className={`bg-gradient-to-b from-white to-gray-50 shadow-xl border-r border-gray-200/80 flex flex-col transition-all duration-300 relative backdrop-blur-sm
      ${isMobile
        ? `fixed top-16 bottom-0 left-0 z-50 w-64 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
        : sidebarExpanded ? 'w-64' : 'w-16'
      }`}>
      {/* Close button for mobile */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/80 bg-gradient-to-b from-white to-gray-50/50">
          <h2 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">Menu</h2>
          <button
            onClick={onCloseMobileMenu}
            className="p-2 hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 rounded-lg transition-all duration-300 group"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-500 group-hover:text-orange-600 transition-colors" />
          </button>
        </div>
      )}

      {/* Collapse/Expand Button - Desktop only */}
      {!isMobile && (
        <button
          onClick={onToggleSidebar}
          className="absolute -right-3 top-6 w-7 h-7 bg-gradient-to-br from-white to-gray-50 border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:from-orange-50 hover:to-orange-100 hover:border-orange-300 hover:text-orange-600 hover:shadow-lg transition-all duration-300 shadow-lg z-50 group"
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarExpanded ? (
            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
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
                  className={`w-full h-11 rounded-xl flex items-center justify-center transition-all duration-300 group ${isDisabled
                    ? 'text-gray-300 cursor-not-allowed opacity-50'
                    : isActive
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 scale-105'
                      : 'text-gray-500 hover:text-orange-600 hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-100 hover:shadow-md hover:scale-105'
                    }`}
                  title={tab.name}
                  aria-label={tab.name}
                >
                  <IconComponent className="h-5 w-5 transition-transform group-hover:scale-110" />
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
              const isCareerTab = tab.id === 'career-insights';
              const isWorkTab = tab.id === 'work-agent';
              const hasSubTabs = tab.hasSubTabs;

              return (
                <div key={tab.id}>
                  {/* Level 1: Main Tab Button - ORANGE */}
                  <button
                    onClick={() => onTabChange(tab)}
                    disabled={isDisabled}
                    className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-left transition-all duration-300 group ${isDisabled
                      ? 'text-gray-400 cursor-not-allowed opacity-50'
                      : isActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 scale-[1.02]'
                        : 'text-gray-700 hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-100 hover:shadow-md hover:scale-[1.02]'
                      }`}
                  >
                    <IconComponent className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 ${isDisabled
                      ? 'text-gray-300'
                      : isActive ? 'text-white' : 'text-gray-500 group-hover:text-orange-600'
                      }`} />
                    <span className="font-semibold flex-1 text-sm md:text-base">{tab.name}</span>
                    {tab.preview && !isDisabled && (
                      <span className="text-xs font-medium text-orange-600 bg-gradient-to-r from-orange-50 to-amber-50 px-2.5 py-1 rounded-lg border border-orange-200 whitespace-nowrap shadow-sm">
                        Preview
                      </span>
                    )}
                    {hasSubTabs && (
                      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${(isCareerTab && showCareerSubTabs) || (isWorkTab && showWorkSubTabs) ? 'transform rotate-180' : ''
                        } ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'}`} />
                    )}
                  </button>

                  {/* Career Sub-tabs - Level 2: INDIGO */}
                  {isCareerTab && showCareerSubTabs && activeTab === 'career-insights' && (
                    <div className="ml-3 pl-3 border-l-2 space-y-1 py-2 mt-2 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-indigo-400 before:via-indigo-300 before:to-transparent before:rounded-full">
                      {careerSubTabs.map((subTab) => {
                        const isSubActive = careerSubTab === subTab.id;
                        const showInsightsSubMenu = subTab.hasSubMenu && subTab.id === 'insights' && careerSubTab === 'insights' && isInsightsExpanded;
                        const isComingSoon = subTab.comingSoon;

                        return (
                          <div key={subTab.id}>
                            {/* Level 2: Career Sub-tab Button - INDIGO */}
                            <button
                              onClick={() => !isComingSoon && onCareerSubTabClick(subTab.id)}
                              disabled={isComingSoon}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-300 group ${isComingSoon
                                ? 'text-gray-400 cursor-not-allowed opacity-60'
                                : isSubActive
                                  ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-200/50'
                                  : 'text-gray-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-white hover:text-indigo-600 hover:shadow-sm'
                                }`}
                            >
                              <span className="font-medium">{subTab.name}</span>
                              <div className="flex items-center space-x-2">
                                {isComingSoon && (
                                  <span className="text-xs font-medium text-gray-500 bg-gradient-to-r from-gray-100 to-gray-50 px-2.5 py-1 rounded-md border border-gray-200 whitespace-nowrap shadow-sm">
                                    Coming Soon
                                  </span>
                                )}
                                {subTab.hasSubMenu && !isComingSoon && (
                                  <ChevronDown className={`h-3.5 w-3.5 transition-all duration-300 ${isSubActive && isInsightsExpanded ? 'transform rotate-180' : ''
                                    } ${isSubActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                                )}
                              </div>
                            </button>

                            {/* Level 3: Career Insights Sub-items - TEAL */}
                            {showInsightsSubMenu && (
                              <div className="ml-0 space-y-1 py-1.5">
                                {subTab.subItems.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => onCareerInsightsSubClick(item.id)}
                                    className={`w-full text-left pl-1.5 pr-3 py-2 rounded-lg text-xs transition-all duration-300 flex items-center group ${careerInsightsSubTab === item.id
                                      ? 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 font-semibold shadow-sm border border-teal-100'
                                      : 'text-gray-500 hover:bg-gradient-to-r hover:from-teal-50 hover:to-white hover:text-teal-600 hover:shadow-sm'
                                      }`}
                                  >
                                    <span className="inline-flex w-3.5 mr-1.5 flex-shrink-0">
                                      {sectionStatus && item.section && sectionStatus[item.section] === 'completed' ? (
                                        <svg className="w-3 h-3 text-emerald-500 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      ) : analysisProgress && analysisProgress.isAnalyzing ? (
                                        <svg className="w-3 h-3 text-teal-500 animate-spin drop-shadow-sm" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      ) : null}
                                    </span>
                                    <span className="font-medium">{item.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Work Sub-tabs - Level 2: INDIGO */}
                  {isWorkTab && showWorkSubTabs && activeTab === 'work-agent' && workSubTabs && (
                    <div className="ml-3 pl-3 border-l-2 space-y-1 py-2 mt-2 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-indigo-400 before:via-indigo-300 before:to-transparent before:rounded-full">
                      {workSubTabs.map((subTab) => {
                        const isSubActive = workSubTab === subTab.id;
                        const SubTabIcon = subTab.icon;
                        const showInboxSubMenu = subTab.hasSubMenu && subTab.id === 'inbox' && workSubTab === 'inbox' && isInboxExpanded;
                        const showTasksSubMenu = subTab.hasSubMenu && subTab.id === 'tasks' && workSubTab === 'tasks' && isTasksExpanded;
                        const showToolsSubMenu = subTab.hasSubMenu && subTab.id === 'tools' && workSubTab === 'tools' && isToolsExpanded;

                        return (
                          <div key={subTab.id}>
                            {/* Level 2: Work Sub-tab Button - INDIGO */}
                            <button
                              onClick={() => onWorkSubTabClick(subTab.id)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-300 group ${isSubActive
                                ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-200/50'
                                : 'text-gray-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-white hover:text-indigo-600 hover:shadow-sm'
                                }`}
                            >
                              <div className="flex items-center space-x-2">
                                {SubTabIcon && (
                                  <SubTabIcon className={`h-4 w-4 flex-shrink-0 ${isSubActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                    }`} />
                                )}
                                <span className="font-medium">{subTab.name}</span>
                              </div>
                              {subTab.hasSubMenu && (
                                <ChevronDown className={`h-3.5 w-3.5 transition-all duration-300 ${
                                  (subTab.id === 'inbox' && isSubActive && isInboxExpanded) ||
                                  (subTab.id === 'tasks' && isSubActive && isTasksExpanded) ||
                                  (subTab.id === 'tools' && isSubActive && isToolsExpanded)
                                    ? 'transform rotate-180' : ''
                                  } ${isSubActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                              )}
                            </button>

                            {/* Level 3: Inbox Sub-items - TEAL */}
                            {showInboxSubMenu && subTab.subItems && (
                              <div className="ml-0 space-y-1 py-1.5">
                                {subTab.subItems.map((item) => {
                                  const ItemIcon = item.icon;
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => onInboxSubTabClick(item.id)}
                                      className={`w-full text-left pl-3 pr-3 py-2 rounded-lg text-xs transition-all duration-300 flex items-center gap-2 group ${inboxSubTab === item.id
                                        ? 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 font-semibold shadow-sm border border-teal-100'
                                        : 'text-gray-500 hover:bg-gradient-to-r hover:from-teal-50 hover:to-white hover:text-teal-600 hover:shadow-sm'
                                        }`}
                                    >
                                      {ItemIcon && (
                                        <ItemIcon className={`h-3.5 w-3.5 flex-shrink-0 ${inboxSubTab === item.id ? 'text-teal-600' : 'text-gray-400 group-hover:text-teal-500'
                                          }`} />
                                      )}
                                      <span className="font-medium">{item.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Level 3: Tasks Sub-items - TEAL */}
                            {showTasksSubMenu && subTab.subItems && (
                              <div className="ml-0 space-y-1 py-1.5">
                                {subTab.subItems.map((item) => {
                                  const ItemIcon = item.icon;
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => onTasksSubTabClick(item.id)}
                                      className={`w-full text-left pl-3 pr-3 py-2 rounded-lg text-xs transition-all duration-300 flex items-center gap-2 group ${tasksSubTab === item.id
                                        ? 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 font-semibold shadow-sm border border-teal-100'
                                        : 'text-gray-500 hover:bg-gradient-to-r hover:from-teal-50 hover:to-white hover:text-teal-600 hover:shadow-sm'
                                        }`}
                                    >
                                      {ItemIcon && (
                                        <ItemIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tasksSubTab === item.id ? 'text-teal-600' : 'text-gray-400 group-hover:text-teal-500'
                                          }`} />
                                      )}
                                      <span className="font-medium">{item.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Level 3: Tools Sub-items - TEAL */}
                            {showToolsSubMenu && subTab.subItems && (
                              <div className="ml-0 space-y-1 py-1.5">
                                {subTab.subItems.map((item) => {
                                  const ItemIcon = item.icon;
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => onToolsSubTabClick(item.id)}
                                      className={`w-full text-left pl-3 pr-3 py-2 rounded-lg text-xs transition-all duration-300 flex items-center gap-2 group ${toolsSubTab === item.id
                                        ? 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 font-semibold shadow-sm border border-teal-100'
                                        : 'text-gray-500 hover:bg-gradient-to-r hover:from-teal-50 hover:to-white hover:text-teal-600 hover:shadow-sm'
                                        }`}
                                    >
                                      {ItemIcon && (
                                        <ItemIcon className={`h-3.5 w-3.5 flex-shrink-0 ${toolsSubTab === item.id ? 'text-teal-600' : 'text-gray-400 group-hover:text-teal-500'
                                          }`} />
                                      )}
                                      <span className="font-medium">{item.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer - Restored to Sidebar Bottom */}
      <div className={`p-4 border-t border-gray-200/80 bg-white/50 backdrop-blur-sm ${!sidebarExpanded && !isMobile ? 'px-2 flex justify-center' : ''}`}>
        {(sidebarExpanded || isMobile) ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-gray-400">
              © 2025 Idii.
            </span>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 bg-transparent hover:bg-gray-100 rounded-md transition-all duration-200 active:scale-95 active:bg-gray-200 group"
              data-tally-open="PdRqlB"
              data-tally-layout="modal"
              data-tally-emoji-text="👋🏽"
              data-tally-emoji-animation="wave"
            >
              <Bug className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" />
              <span>Report Bug</span>
            </button>
          </div>
        ) : (
          <button
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            title="Report Bug"
            data-tally-open="PdRqlB"
            data-tally-layout="modal"
            data-tally-emoji-text="👋🏽"
            data-tally-emoji-animation="wave"
          >
            <Bug className="w-4 h-4" />
          </button>
        )}
      </div>


    </div>
  );
}
