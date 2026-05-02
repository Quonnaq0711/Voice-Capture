import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { useState } from "react";
import { useNavigate } from "react-router-dom";


const NAV_ITEMS = [
  {
    label: 'Email',
    path: '/work/email',
    color: 'text-pink-500',
    dropdowns: [
      { label: 'Generate email', path: '/work/email/generate' },
      { label: 'Reply to email', path: '/work/email/reply'    },
    ],
  },
  {
    label: 'Communications',
    path: '/work/communications',
    color: 'text-purple-400',
    dropdowns: [
      { label: 'New message', path: '/work/communications/new'      },
      { label: 'Channels',    path: '/work/communications/channels' },
    ],
  },
  {
    label: 'To Do',
    path: '/work/todo',
    color: 'text-orange-400',
    dropdowns: [
      { label: 'Add task', path: '/work/todo/new' },
      { label: 'View all', path: '/work/todo/all' },
    ],
  },
  {
    label: 'Scheduler',
    path: '/work/scheduler',
    color: 'text-red-400',
    dropdowns: [
      { label: 'New event',  path: '/work/scheduler/new'  },
      { label: 'Week view',  path: '/work/scheduler/week' },
    ],
  },
  {
    label: 'Directory',
    path: '/work/directory',
    color: 'text-blue-400',
    dropdowns: [
      { label: 'Search people', path: '/work/directory/search'   },
      { label: 'My contacts',   path: '/work/directory/contacts' },
    ],
  },
  {
    label: 'Notes',
    path: '/work/notes',
    color: 'text-yellow-400',
    dropdowns: [
      { label: 'Create new note', path: '/work/notes/new' },
      { label: 'All notes',       path: '/work/notes/all' },
    ],
  },
  {
    label: 'Maps',
    path: '/work/maps',
    color: 'text-white/30',
    dropdowns: [],
  },
];

const SECONDARY_ITEMS = [
  {
    label: 'Documents',
    path: '/work/documents',
    color: 'text-white',
    dropdowns: [
      { label: 'New document', path: '/work/documents/new'    },
      { label: 'Recent',       path: '/work/documents/recent' },
    ],
  },
  {
    label: 'Activities',
    path: '/work/activity',
    color: 'text-green-400',
    dropdowns: [
      { label: 'Timeline',    path: '/work/activity/timeline' },
      { label: 'My activity', path: '/work/activity/mine'     },
    ],
  },
];


function NavItem({
  item,
  isOpen,
  isActive,
  onHover,
  onLeave,
  onToggle,
  onNavigate,
  loadItemRef,
  mode = 'nav',
}) {
  const hasDropdown = item.dropdowns.length > 0;
  const itemRef = useRef(null);

  // register for auto-scroll
  useEffect(() => {
    if (loadItemRef && itemRef.current) {
      loadItemRef(item.label, itemRef);
    }
  }, [item.label, loadItemRef]);

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={() => mode === 'nav' && onHover?.(item.label)}
      onMouseLeave={() => mode === 'nav' && onLeave?.(item.label)}
    >
      {/* Parent */}
      <button
        onClick={() => {
          if (hasDropdown) onToggle(item.label);
          else onNavigate(item.path);
        }}
        className={`flex items-center justify-between w-full
          text-right text-sm font-semibold font-['Open_Sans'] ml-[-12px] ${item.color}
          ${isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'}
        `}
      >
        <span>{item.label}</span>

        {hasDropdown && (
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <ChevronDown size={8} />
          </motion.div>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence initial={false}>
        {hasDropdown && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-2 border-l border-white/10 pl-3">
              {item.dropdowns.map((sub) => (
                <button
                  key={sub.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(sub.path);
                  }}
                  className={`block w-full text-left text-sm py-1
                    ${item.color} opacity-70 hover:opacity-100`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Nav({ currentPath }) {
  const navigate = useNavigate();
  const itemRefs = useRef({});

  const [hoveredItem, setHoveredItem] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [openSecondary, setOpenSecondary] = useState(null);

  const isOpen = (label) =>
    activeItem === label || hoveredItem === label;

  const handleToggle = (label) => {
    setActiveItem((prev) => (prev === label ? null : label));
  };

  const handleLeave = (label) => {
    setHoveredItem((current) =>
      current === label ? null : current
    );
  };

  const loadItemRef = (label, ref) => {
  itemRefs.current[label] = ref;
};

  useEffect(() => {
  const activeRef =
    itemRefs.current[activeItem] ||
    itemRefs.current[openSecondary];

  if (activeRef?.current) {
    activeRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}, [activeItem, openSecondary]);

  return (
    <div className="h-full flex flex-col py-2 px-2 w-40 mt-44 border-l border-white/[0.07] overflow-y-auto">

      {/* Main */}
      <div className="bg-white/10 rounded-[10px] outline outline-2 outline-white/10 px-3 py-4 flex flex-col gap-4">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            isOpen={isOpen(item.label)}
            isActive={activeItem === item.label}
            onToggle={handleToggle}
            onHover={setHoveredItem}
            onLeave={handleLeave}
            onNavigate={navigate}
            loadItemRef={loadItemRef}
          />
        ))}
      </div>

      {/* Connector */}
      <div className="self-center w-0.5 h-6 bg-white/10" />

      {/* Secondary */}
      <div className="bg-white/10 rounded-[10px] outline outline-2 outline-white/10 px-5 py-4 flex flex-col gap-4">
        {SECONDARY_ITEMS.map((item) => (
          <div key={item.label}>
              <NavItem
                item={item}
                isOpen={isOpen(item.label)}
                isActive={activeItem === item.label}
                onToggle={handleToggle}
                onHover={setHoveredItem}
                onLeave={handleLeave}
                onNavigate={navigate}
                loadItemRef={loadItemRef}              
              />
           </div>
        ))}
      </div>

    </div>
  );
}
