import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, CheckSquare, StickyNote, Mail,
  MessageSquare, Map, BookUser, ChartNoAxesGantt,
  FileText, ChevronDown
} from 'lucide-react';

const NAV_GROUPS = [
  {
    items: [
      {
        label: 'Email',
        icon: Mail,
        path: '/work/email',
        color: 'text-purple-400',
        dropdowns: [
          { label: 'Generate email', path: '/work/email/generate' },
          { label: 'Reply to email',  path: '/work/email/reply'    },
        ],
      },
      {
        label: 'Communications',
        icon: MessageSquare,
        path: '/work/communications',
        color: 'text-purple-400',
        dropdowns: [
          { label: 'New message',    path: '/work/communications/new'     },
          { label: 'Channels',       path: '/work/communications/channels' },
        ],
      },
      {
        label: 'To Do',
        icon: CheckSquare,
        path: '/work/todo',
        color: 'text-orange-400',
        dropdowns: [
          { label: 'Add task',       path: '/work/todo/new'      },
          { label: 'View all',       path: '/work/todo/all'      },
        ],
      },
      {
        label: 'Scheduler',
        icon: CalendarDays,
        path: '/work/scheduler',
        color: 'text-white',
        dropdowns: [
          { label: 'New event',      path: '/work/scheduler/new' },
          { label: 'Week view',      path: '/work/scheduler/week' },
        ],
      },
      {
        label: 'Directory',
        icon: BookUser,
        path: '/work/directory',
        color: 'text-blue-400',
        dropdowns: [
          { label: 'Search people',  path: '/work/directory/search' },
          { label: 'My contacts',    path: '/work/directory/contacts' },
        ],
      },
      {
        label: 'Notes',
        icon: StickyNote,
        path: '/work/notes',
        color: 'text-yellow-400',
        dropdowns: [
          { label: 'Create new note', path: '/work/notes/new'  },
          { label: 'All notes',       path: '/work/notes/all'  },
        ],
      },
      {
        label: 'Maps',
        icon: Map,
        path: '/work/maps',
        color: 'text-white/30',
        dropdowns: [],
      },
    ],
  },
  {
  standalone: true,
  items: [
    {
      label: 'Documents',
      icon: FileText,
      path: '/work/documents',
      color: 'text-white',
      dropdowns: [
        { label: 'New document', path: '/work/documents/new' },
        { label: 'Recent', path: '/work/documents/recent' },
      ],
    },
    {
      label: 'Activity',
      icon: ChartNoAxesGantt,
      path: '/work/activity',
      color: 'text-white',
      dropdowns: [
        { label: 'Timeline', path: '/work/activity/timeline' },
        { label: 'My activity', path: '/work/activity/mine' },
      ],
    },
  ],
}
]


export default function Nav({ currentPath, onNavigate }) {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState(null);

  const handleNav = (path) => {
    onNavigate?.(path);
    navigate(path);
  };

  const toggleDropdown = (path) => {
    setOpenItem(prev => prev === path ? null : path);
  };

  return (
    <div className="h-full flex flex-col border-l border-white/[0.07] py-6 px-2 w-48 bg-sky-950 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi}>
          {group.standalone ? (
            /* Connector line + standalone rounded container */
            <div className="flex flex-col items-center">
              {/* Vertical connector line */}
              <div className="w-px h-3 bg-white/[0.12]" />

              {/* Standalone rounded container */}
              <div className="w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-1 py-1">
                {group.items.map(({ label, icon: Icon, path, color, dropdowns }) => {
                  const isActive  = currentPath === path || currentPath?.startsWith(path + '/');
                  const isOpen    = openItem === path;
                  const hasDropdown = dropdowns.length > 0;

                  return (
                    <div key={path}>
                      <div className={`flex items-center rounded-lg transition-colors ${
                        isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      }`}>
                        <button
                          onClick={() => handleNav(path)}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-left text-2xl font-semibold font-['Open_Sans'] transition-colors ${
                            isActive ? color : `${color} opacity-60 hover:opacity-100`
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {label}
                        </button>
                        {hasDropdown && (
                          <button
                            onClick={() => toggleDropdown(path)}
                            className="pr-2 pl-1 py-2 text-white/20 hover:text-white/50 transition-colors"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {hasDropdown && isOpen && (
                        <div className="ml-9 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-white/[0.07] pl-3">
                          {dropdowns.map(({ label: subLabel, path: subPath }) => (
                            <button
                              key={subPath}
                              onClick={() => handleNav(subPath)}
                              className={`text-left text-xs font-['Open_Sans'] py-1 transition-colors ${
                                currentPath === subPath
                                  ? `${color} font-medium`
                                  : 'text-white/40 hover:text-white/70'
                              }`}
                            >
                              {subLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Normal group */
            <div className="flex flex-col gap-0.5">
              {gi > 0 && <div className="my-2 mx-1 h-px bg-white/[0.07]" />}
              {group.items.map(({ label, icon: Icon, path, color, dropdowns }) => {
                const isActive  = currentPath === path || currentPath?.startsWith(path + '/');
                const isOpen    = openItem === path;
                const hasDropdown = dropdowns.length > 0;

                return (
                  <div key={path}>
                    <div className={`flex items-center rounded-lg transition-colors ${
                      isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}>
                      <button
                        onClick={() => handleNav(path)}
                        className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-left text-2xl font-semibold font-['Open_Sans'] transition-colors ${
                          isActive ? color : `${color} opacity-60 hover:opacity-100`
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </button>
                      {hasDropdown && (
                        <button
                          onClick={() => toggleDropdown(path)}
                          className="pr-2 pl-1 py-2 text-white/20 hover:text-white/50 transition-colors"
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {hasDropdown && isOpen && (
                      <div className="ml-9 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-white/[0.07] pl-3">
                        {dropdowns.map(({ label: subLabel, path: subPath }) => (
                          <button
                            key={subPath}
                            onClick={() => handleNav(subPath)}
                            className={`text-left text-xs font-['Open_Sans'] py-1 transition-colors ${
                              currentPath === subPath
                                ? `${color} font-medium`
                                : 'text-white/40 hover:text-white/70'
                            }`}
                          >
                            {subLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}