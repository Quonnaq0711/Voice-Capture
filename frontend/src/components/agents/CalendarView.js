/**
 * CalendarView Component
 *
 * A Google Calendar-style calendar view with:
 * - Mini calendar sidebar
 * - Account filtering with color coding
 * - Support for multiple calendars (including holidays)
 * - Day/Week/Month views
 * - Initial scroll to business hours (7am-8pm)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon,
  ExclamationCircleIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  UsersIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  EnvelopeIcon,
  LightBulbIcon,
  DocumentDuplicateIcon,
  BookOpenIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  XCircleIcon as XCircleSolidIcon,
  SparklesIcon as SparklesSolidIcon,
} from '@heroicons/react/24/solid';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { calendar } from '../../services/workApi';

// Account color palette - matches email page colors
const ACCOUNT_COLORS = [
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', hex: '#3b82f6', lightHex: '#dbeafe', textHex: '#1d4ed8' },
  { name: 'green', bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', hex: '#22c55e', lightHex: '#dcfce7', textHex: '#15803d' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', hex: '#a855f7', lightHex: '#f3e8ff', textHex: '#7e22ce' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', hex: '#f97316', lightHex: '#ffedd5', textHex: '#c2410c' },
  { name: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', hex: '#ec4899', lightHex: '#fce7f3', textHex: '#be185d' },
  { name: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', hex: '#14b8a6', lightHex: '#ccfbf1', textHex: '#0f766e' },
];

// Holiday calendar color
const HOLIDAY_COLOR = { name: 'red', bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', hex: '#ef4444', lightHex: '#fee2e2', textHex: '#b91c1c' };

// DOM-based HTML sanitizer (whitelist-only tags/attributes, prevents XSS)
const ALLOWED_TAGS = new Set(['B','I','EM','STRONG','U','BR','P','UL','OL','LI','A','SPAN','DIV','BLOCKQUOTE','H1','H2','H3','H4','H5','H6']);
const SAFE_URI_RE = /^(?:https?|mailto):/i;
const sanitizeHtml = (html) => {
  if (!html) return '';
  if (!/[<&]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (parent) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 3) continue;
      if (node.nodeType !== 1) { node.remove(); continue; }
      clean(node);
      if (!ALLOWED_TAGS.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      for (const attr of [...node.attributes]) {
        if (node.tagName === 'A' && attr.name === 'href') {
          if (!SAFE_URI_RE.test(attr.value.trim())) node.removeAttribute('href');
        } else {
          node.removeAttribute(attr.name);
        }
      }
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
};

// Get consistent color for an email
const getAccountColor = (email, accountList = []) => {
  if (!email) return ACCOUNT_COLORS[0];
  const index = accountList.findIndex(acc => acc.email === email || acc.account_email === email);
  if (index >= 0) return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
  // Fallback: hash-based
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ACCOUNT_COLORS[hash % ACCOUNT_COLORS.length];
};

// Mini Calendar Component
const MiniCalendar = ({ selectedDate, onDateSelect, events = [] }) => {
  const [displayMonth, setDisplayMonth] = useState(new Date(selectedDate));

  useEffect(() => {
    setDisplayMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const getDaysInMonth = () => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const hasEvents = (date) => {
    return events.some(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const navigateMonth = (direction) => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + direction, 1));
  };

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-medium text-gray-700">
          {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {getDaysInMonth().map(({ date, isCurrentMonth }, idx) => (
          <button
            key={idx}
            onClick={() => onDateSelect(date)}
            className={`
              w-7 h-7 text-xs rounded-full flex items-center justify-center relative
              transition-colors
              ${isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
              ${isSelected(date) ? 'bg-blue-500 text-white' : ''}
              ${isToday(date) && !isSelected(date) ? 'bg-blue-100 text-blue-600 font-semibold' : ''}
              ${!isSelected(date) && !isToday(date) ? 'hover:bg-gray-100' : ''}
            `}
          >
            {date.getDate()}
            {hasEvents(date) && !isSelected(date) && (
              <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Calendar Sidebar Component
const CalendarSidebar = ({
  selectedDate,
  onDateSelect,
  events,
  accounts,
  visibleAccounts,
  onToggleAccount,
  showHolidays,
  onToggleHolidays,
  onCreateEvent,
  showAnalytics,
  onToggleAnalytics,
  // Scheduling integration props
  schedulingMode = false,
  showScheduledTasks,
  onToggleScheduledTasks,
  statusMessage,
}) => {
  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
      {/* Create button — hidden in scheduling mode (scheduler has its own controls) */}
      {!schedulingMode && (
        <div className="p-4">
          <button
            onClick={onCreateEvent}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow w-full"
          >
            <PlusIcon className="w-6 h-6 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Create</span>
          </button>
        </div>
      )}

      {/* Mini calendar */}
      <div className={`px-4 ${schedulingMode ? 'pt-4' : ''} pb-4`}>
        <MiniCalendar
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          events={events}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* My calendars section */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            My calendars
          </h3>
          <div className="space-y-1">
            {accounts.map((account, idx) => {
              const color = getAccountColor(account.email || account.account_email, accounts);
              const isVisible = visibleAccounts.includes(String(account.id));
              return (
                <button
                  key={account.id}
                  onClick={() => onToggleAccount(account.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${isVisible ? color.bg : 'bg-gray-200'}`}>
                    {isVisible && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {account.email || account.account_email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Other calendars section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Other calendars
          </h3>
          <div className="space-y-1">
            <button
              onClick={onToggleHolidays}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center ${showHolidays ? HOLIDAY_COLOR.bg : 'bg-gray-200'}`}>
                {showHolidays && <CheckIcon className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-gray-700">Holidays in United States</span>
            </button>
            {/* Scheduled Tasks toggle — only in scheduling mode */}
            {onToggleScheduledTasks && (
              <button
                onClick={onToggleScheduledTasks}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: showScheduledTasks ? '#8b5cf6' : '#e5e7eb' }}>
                  {showScheduledTasks && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700">Scheduled Tasks</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics section at bottom — hidden in scheduling mode */}
      {!schedulingMode && (
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onToggleAnalytics}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all ${
              showAnalytics
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ChartBarIcon className={`w-5 h-5 ${showAnalytics ? 'text-white' : 'text-indigo-500'}`} />
            <span className="text-sm font-medium">Analytics</span>
            {showAnalytics && (
              <SparklesIcon className="w-4 h-4 ml-auto text-white/80" />
            )}
          </button>
        </div>
      )}

      {/* Status messages — only in scheduling mode */}
      {statusMessage && (
        <div className="border-t border-gray-200 p-4">
          <p className={`text-xs text-center ${statusMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {statusMessage.text}
          </p>
        </div>
      )}
    </div>
  );
};

// Time grid helper - generates hour slots
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BUSINESS_HOURS_START = 7; // 7 AM
const HOUR_HEIGHT = 48; // pixels per hour

// Format time label
const formatHourLabel = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

/**
 * Calculate layout for overlapping events (Google Calendar style)
 * Returns events with additional layout properties: column, totalColumns, width, left
 */
const calculateEventLayout = (events) => {
  if (!events.length) return [];

  // Sort by start time, then by duration (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    const startA = new Date(a.start).getTime();
    const startB = new Date(b.start).getTime();
    if (startA !== startB) return startA - startB;
    // Longer events first
    const durationA = new Date(a.end).getTime() - startA;
    const durationB = new Date(b.end).getTime() - startB;
    return durationB - durationA;
  });

  // Group overlapping events
  const groups = [];
  let currentGroup = [];

  sortedEvents.forEach(event => {
    const eventStart = new Date(event.start).getTime();
    const eventEnd = new Date(event.end).getTime();

    // Check if this event overlaps with any event in the current group
    const overlapsWithGroup = currentGroup.some(groupEvent => {
      const groupStart = new Date(groupEvent.start).getTime();
      const groupEnd = new Date(groupEvent.end).getTime();
      return eventStart < groupEnd && eventEnd > groupStart;
    });

    if (overlapsWithGroup || currentGroup.length === 0) {
      currentGroup.push(event);
    } else {
      // Start a new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [event];
    }
  });

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Calculate columns within each group
  const layoutEvents = [];

  groups.forEach(group => {
    // Track which columns are occupied at each time point
    const columns = [];

    group.forEach(event => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();

      // Find the first available column
      let column = 0;
      while (true) {
        const isColumnFree = !columns[column] || columns[column].every(occupiedEvent => {
          const occupiedEnd = new Date(occupiedEvent.end).getTime();
          const occupiedStart = new Date(occupiedEvent.start).getTime();
          return eventStart >= occupiedEnd || eventEnd <= occupiedStart;
        });

        if (isColumnFree) {
          break;
        }
        column++;
      }

      // Add event to the column
      if (!columns[column]) {
        columns[column] = [];
      }
      columns[column].push(event);

      layoutEvents.push({
        ...event,
        column,
        groupSize: group.length,
      });
    });

    // Calculate total columns for this group and update events
    const totalColumns = columns.length;
    const groupEventIds = new Set(group.map(ge => ge.id));
    layoutEvents.forEach(e => {
      if (groupEventIds.has(e.id)) {
        e.totalColumns = totalColumns;
      }
    });
  });

  // Set totalColumns for all events in each group
  layoutEvents.forEach(event => {
    if (!event.totalColumns) {
      event.totalColumns = 1;
    }
    // Calculate width and left position
    event.width = (100 / event.totalColumns);
    event.left = event.column * event.width;
  });

  return layoutEvents;
};

// Week View Component
const WeekView = ({
  date, events, accounts, visibleAccounts, showHolidays, holidays, onEventClick, onDayClick, onSlotClick,
  // Scheduling integration props
  scheduledTasks = [], previewSlots = [], isPreviewMode = false, showScheduledTasks = true,
  dragEnabled = false, onTaskDrop, onRemoveScheduledTask, onPushScheduledTask,
  onRemovePreviewSlot, onEditPreviewSlot, onLocalScheduledClick, onScheduledEventClick,
  pushingTaskIds, userTasks = [], connectedAccounts = [],
  onRemoveScheduledEvent, removingEventId, unacceptingTaskId,
  onPushSingleTask,
}) => {
  const scrollRef = useRef(null);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);

  // Get week days
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Scroll to business hours on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = BUSINESS_HOURS_START * HOUR_HEIGHT;
    }
  }, []);

  // Update current time indicator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimePosition(now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const isToday = (d) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  // Helper to get date only (no time) for comparison
  // Handles both date-only strings ("2024-12-23") and datetime strings
  const getDateOnly = (d) => {
    if (!d) return new Date();

    // If it's already a Date object
    if (d instanceof Date) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const str = String(d);

    // For date-only strings (YYYY-MM-DD), parse as local date to avoid timezone issues
    // This is important for all-day events from Google Calendar
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    // For ISO datetime strings, extract just the date part
    // to avoid timezone conversion issues
    if (str.includes('T')) {
      const datePart = str.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    // Fallback: parse as Date and extract local date
    const date = new Date(d);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Filter events by visible accounts
  // Note: account IDs may be strings or numbers, so we compare as strings
  const filteredEvents = useMemo(() => {
    let result = events.filter(event => {
      const accountId = String(event.account_id);
      return visibleAccounts.includes(accountId);
    });

    // Add holidays if enabled
    if (showHolidays && holidays) {
      result = [...result, ...holidays];
    }

    return result;
  }, [events, visibleAccounts, showHolidays, holidays]);

  // Get all-day/multi-day events that span across the week
  // These will be displayed as horizontal bars at the top (like Google Calendar)
  const getSpanningAllDayEvents = useMemo(() => {
    const spanningEvents = [];
    const weekStartDate = getDateOnly(weekStart);
    const weekEndDate = getDateOnly(weekEnd);

    filteredEvents.forEach(event => {
      // Only process all-day events and holidays
      const isAllDay = event.all_day || event.is_all_day || event.isHoliday;
      if (!isAllDay) return;

      const eventStart = getDateOnly(event.start);

      // Google Calendar API returns all-day event end dates as EXCLUSIVE
      // (the day AFTER the actual last day). We need to subtract 1 day.
      let eventEnd = eventStart;
      if (event.end) {
        eventEnd = getDateOnly(event.end);
        // For all-day events, end date is exclusive, so subtract 1 day
        // But only if it's actually a different day (not same-day event)
        if (eventEnd > eventStart) {
          eventEnd = new Date(eventEnd.getTime() - 24 * 60 * 60 * 1000);
        }
      }

      // Check if event overlaps with the current week
      if (eventEnd < weekStartDate || eventStart > weekEndDate) return;

      // Calculate which day columns this event spans (0-6)
      // Use the weekDays array for accurate column mapping
      let startCol = -1;
      let endCol = -1;

      for (let i = 0; i < 7; i++) {
        const dayDate = getDateOnly(weekDays[i]);

        // Find start column
        if (startCol === -1) {
          if (eventStart <= dayDate) {
            startCol = i;
          }
        }

        // Find end column
        if (eventEnd >= dayDate) {
          endCol = i;
        }
      }

      // If event starts before this week, start at column 0
      if (startCol === -1) startCol = 0;
      // If event ends after this week, end at column 6
      if (endCol === -1) endCol = 6;

      // Clamp to valid range
      startCol = Math.max(0, Math.min(6, startCol));
      endCol = Math.max(0, Math.min(6, endCol));

      // Ensure endCol >= startCol
      if (endCol < startCol) endCol = startCol;

      spanningEvents.push({
        ...event,
        startCol,
        endCol,
        span: endCol - startCol + 1,
      });
    });

    // Sort: by start column first, then longer events first (they should appear on top)
    spanningEvents.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.span - a.span;
    });

    // Assign rows to prevent overlapping events
    const rows = [];
    spanningEvents.forEach(event => {
      let rowIndex = 0;
      while (true) {
        if (!rows[rowIndex]) rows[rowIndex] = [];
        // Check if this event can fit in the current row (no overlap with existing events)
        const canFit = !rows[rowIndex].some(e =>
          !(event.endCol < e.startCol || event.startCol > e.endCol)
        );
        if (canFit) {
          rows[rowIndex].push(event);
          event.row = rowIndex;
          break;
        }
        rowIndex++;
      }
    });

    return { events: spanningEvents, rowCount: rows.length };
  }, [filteredEvents, weekDays, weekStart, weekEnd]);

  // Drag-drop state for scheduling
  const dragRafRef = useRef(null);
  const [dropIndicator, setDropIndicator] = useState(null);

  // Get timed events for a day (non all-day events) + merge scheduling overlays
  const getTimedEventsWithScheduling = useMemo(() => {
    const map = {};
    weekDays.forEach(d => {
      const dayKey = d.toDateString();
      const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Regular timed events
      const dayEvents = filteredEvents
        .filter(event => {
          if (event.all_day || event.is_all_day || event.isHoliday) return false;
          const eventStart = new Date(event.start);
          return eventStart.toDateString() === dayKey;
        })
        .map(event => ({
          ...event,
          summary: event.summary || '(No title)',
          account_email: event.account_email || event.organizer?.email,
          isAIScheduled: /^\[Task-\d+\]/.test(event.summary || '') || /Scheduled by (AI )?Task Scheduler/.test(event.description || ''),
        }));

      // Merge locally-scheduled tasks
      if (showScheduledTasks && scheduledTasks.length > 0) {
        scheduledTasks.forEach(st => {
          if (st.date !== dayStr || st.has_calendar_event) return;
          const alreadyShown = dayEvents.some(e => e.isAIScheduled && ((e.summary || '').includes(`[Task-${st.task_id}]`) || (e.description || '').includes(`Task ID: ${st.task_id}`)));
          if (alreadyShown) return;
          dayEvents.push({
            id: `local-${st.task_id}`,
            summary: st.title,
            start: `${st.date}T${st.start_time}:00`,
            end: `${st.date}T${st.end_time}:00`,
            isLocalScheduled: true,
            taskId: st.task_id,
            priority: st.priority,
            has_calendar_event: false,
          });
        });
      }

      // Merge preview slots
      if (isPreviewMode && previewSlots.length > 0) {
        previewSlots.forEach((slot, idx) => {
          if (slot.date === dayStr) {
            dayEvents.push({
              id: `preview-${idx}`,
              summary: slot.task_title,
              start: `${slot.date}T${slot.start_time}:00`,
              end: `${slot.date}T${slot.end_time}:00`,
              isPreview: true,
              previewIndex: idx,
              priority: slot.priority,
            });
          }
        });
      }

      map[dayKey] = dayEvents;
    });
    return map;
  }, [filteredEvents, weekDays, scheduledTasks, showScheduledTasks, isPreviewMode, previewSlots]);

  // Calculate event position and color
  const getEventStyle = (event) => {
    const startTime = new Date(event.start);
    const endTime = new Date(event.end);
    const top = (startTime.getHours() + startTime.getMinutes() / 60) * HOUR_HEIGHT;
    const duration = (endTime - startTime) / (1000 * 60 * 60);
    const height = Math.max(duration * HOUR_HEIGHT, 24);

    let color;
    if (event.isHoliday) {
      color = HOLIDAY_COLOR;
    } else {
      color = getAccountColor(event.account_email, accounts);
    }

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: color.hex,
    };
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header row with day names and dates - clickable like Google Calendar */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="w-16 flex-shrink-0 border-r border-gray-200" />
        {weekDays.map((day, idx) => (
          <div
            key={idx}
            onClick={() => onDayClick && onDayClick(day)}
            className={`flex-1 text-center py-2 border-r border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${isToday(day) ? 'bg-white' : ''}`}
          >
            <div className="text-xs text-gray-500 uppercase">
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className={`
              w-10 h-10 mx-auto flex items-center justify-center rounded-full text-xl transition-colors
              ${isToday(day) ? 'bg-blue-500 text-white font-semibold' : 'text-gray-800 hover:bg-gray-100'}
            `}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events row - Google Calendar style with spanning events */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex">
          <div className="w-16 flex-shrink-0 border-r border-gray-200 text-right pr-2 py-1">
            <span className="text-xs text-gray-500">All day</span>
          </div>
          {/* Grid overlay for day columns */}
          <div className="flex-1 relative" style={{ minHeight: Math.max(24, getSpanningAllDayEvents.rowCount * 24 + 4) }}>
            {/* Day column borders */}
            <div className="absolute inset-0 flex">
              {weekDays.map((_, idx) => (
                <div key={idx} className="flex-1 border-r border-gray-200" />
              ))}
            </div>
            {/* Spanning all-day events */}
            {getSpanningAllDayEvents.events.map((event, idx) => {
              const color = event.isHoliday ? HOLIDAY_COLOR : getAccountColor(event.account_email, accounts);
              const columnWidth = 100 / 7;
              const left = event.startCol * columnWidth;
              const width = event.span * columnWidth;

              return (
                <div
                  key={idx}
                  onClick={() => onEventClick(event)}
                  className="absolute text-xs px-2 py-0.5 rounded cursor-pointer hover:shadow-md transition-shadow font-medium truncate"
                  style={{
                    backgroundColor: color.hex,
                    color: '#fff',
                    left: `calc(${left}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                    top: event.row * 24 + 2,
                    height: 20,
                    zIndex: 10 + event.row,
                  }}
                  title={event.summary}
                >
                  {event.summary}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-white">
            {HOURS.map(hour => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2.5 right-2 text-xs text-gray-500">
                  {hour > 0 && formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const timedEvents = getTimedEventsWithScheduling[day.toDateString()] || [];
            const layoutEvents = calculateEventLayout(timedEvents);
            const showCurrentTime = isToday(day);

            return (
              <div
                key={dayIdx}
                className="flex-1 border-r border-gray-200 relative"
                onDragOver={dragEnabled ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  if (dragRafRef.current) return;
                  const col = e.currentTarget;
                  const clientY = e.clientY;
                  dragRafRef.current = requestAnimationFrame(() => {
                    dragRafRef.current = null;
                    const rect = col.getBoundingClientRect();
                    const y = clientY - rect.top;
                    const totalMinutes = (y / HOUR_HEIGHT) * 60;
                    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes / 15) * 15));
                    const hours = Math.floor(snapped / 60);
                    const mins = snapped % 60;
                    const topPx = (snapped / 60) * HOUR_HEIGHT;
                    const label = `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
                    setDropIndicator({ dayIdx, top: topPx, timeLabel: label });
                  });
                } : undefined}
                onDragLeave={dragEnabled ? (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDropIndicator(null);
                } : undefined}
                onDrop={dragEnabled ? (e) => {
                  e.preventDefault();
                  setDropIndicator(null);
                  if (!onTaskDrop) return;
                  try {
                    const taskData = JSON.parse(e.dataTransfer.getData('application/json'));
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const totalMinutes = (y / HOUR_HEIGHT) * 60;
                    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes / 15) * 15));
                    const hours = Math.floor(snapped / 60);
                    const mins = snapped % 60;
                    onTaskDrop(taskData, day, hours, mins);
                  } catch (err) {
                    console.error('Drop parse error:', err);
                  }
                } : undefined}
              >
                {/* Hour grid lines - clickable for creating events */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => onSlotClick && onSlotClick(day, hour)}
                  />
                ))}

                {/* Drop indicator line */}
                {dropIndicator && dropIndicator.dayIdx === dayIdx && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: dropIndicator.top }}
                  >
                    <div className="flex-1 h-0.5 bg-purple-500" />
                    <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full ml-1 whitespace-nowrap">
                      {dropIndicator.timeLabel}
                    </span>
                  </div>
                )}

                {/* Current time indicator */}
                {showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: currentTimePosition }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}

                {/* Events - with overlap handling */}
                {layoutEvents.map((event, eventIdx) => {
                  const startTime = new Date(event.start);
                  const endTime = new Date(event.end);
                  const top = (startTime.getHours() + startTime.getMinutes() / 60) * HOUR_HEIGHT;
                  const duration = (endTime - startTime) / (1000 * 60 * 60);
                  const height = Math.max(duration * HOUR_HEIGHT, 24);
                  const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  const endTimeStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                  const padding = 2;
                  const totalWidth = 100;
                  const eventWidth = (totalWidth / event.totalColumns) - 1;
                  const eventLeft = event.column * (totalWidth / event.totalColumns);

                  // Preview slot rendering
                  if (event.isPreview) {
                    return (
                      <div
                        key={eventIdx}
                        onClick={(e) => onEditPreviewSlot && onEditPreviewSlot(event.previewIndex, e)}
                        className="absolute rounded-lg px-2 py-1 cursor-pointer text-xs border-2 border-dashed border-purple-400 hover:border-purple-600 transition-colors"
                        style={{
                          top: `${top}px`, height: `${height}px`,
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          left: `calc(${eventLeft}% + ${padding}px)`,
                          width: `calc(${eventWidth}% - ${padding}px)`,
                          zIndex: event.column + 5,
                        }}
                        title={`Preview: ${event.summary}`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemovePreviewSlot && onRemovePreviewSlot(event.previewIndex); }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-purple-500 text-white rounded-full hover:bg-purple-700 z-10"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                        <div className="font-semibold text-purple-800 truncate pr-5">{event.summary}</div>
                        {height > 30 && (
                          <div className="text-purple-600 truncate text-[10px]">{timeStr} – {endTimeStr}</div>
                        )}
                      </div>
                    );
                  }

                  // Locally-scheduled task rendering
                  if (event.isLocalScheduled) {
                    const isUnaccepting = unacceptingTaskId === event.taskId;
                    return (
                      <div
                        key={eventIdx}
                        className="group absolute rounded-lg px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden text-xs border-l-4"
                        style={{
                          top: `${top}px`, height: `${height}px`,
                          backgroundColor: '#ede9fe',
                          borderLeftColor: '#8b5cf6',
                          color: '#6d28d9',
                          left: `calc(${eventLeft}% + ${padding}px)`,
                          width: `calc(${eventWidth}% - ${padding}px)`,
                          zIndex: event.column + 2,
                        }}
                        title={`${event.summary} (Local)\n${timeStr} – ${endTimeStr}`}
                        onClick={() => {
                          if (onLocalScheduledClick) {
                            const task = userTasks.find(t => t.id === event.taskId);
                            if (task) onLocalScheduledClick(task);
                          }
                        }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveScheduledTask && onRemoveScheduledTask(event.taskId); }}
                          disabled={isUnaccepting}
                          className="absolute top-0.5 right-0.5 w-4 h-4 items-center justify-center bg-violet-500 text-white rounded-full hover:bg-red-600 z-10 hidden group-hover:flex"
                          style={{ display: isUnaccepting ? 'flex' : undefined }}
                          title="Remove from schedule"
                        >
                          {isUnaccepting
                            ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                            : <XMarkIcon className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onPushSingleTask && onPushSingleTask(event.taskId, e); }}
                          disabled={!!pushingTaskIds}
                          className="absolute top-0.5 right-5 w-4 h-4 items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-700 z-10 hidden group-hover:flex"
                          title="Push to Google Calendar"
                        >
                          {pushingTaskIds?.includes(event.taskId)
                            ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                            : <CalendarIcon className="w-3 h-3" />}
                        </button>
                        <div className="font-semibold truncate pr-10">{event.summary}</div>
                        {height > 30 && <div className="opacity-70 truncate text-[10px]">{timeStr} – {endTimeStr}</div>}
                      </div>
                    );
                  }

                  // Regular event or AI-scheduled event
                  const color = event.isHoliday ? HOLIDAY_COLOR : getAccountColor(event.account_email, accounts);
                  return (
                    <div
                      key={eventIdx}
                      onClick={() => {
                        if (event.isAIScheduled && onScheduledEventClick) {
                          const m = (event.summary || '').match(/^\[Task-(\d+)]/) || (event.description || '').match(/Task ID:\s*(\d+)/);
                          if (m) {
                            const task = userTasks.find(t => t.id === parseInt(m[1], 10));
                            if (task) { onScheduledEventClick(task); return; }
                          }
                        }
                        onEventClick(event);
                      }}
                      className="group absolute rounded-lg px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden text-xs border-l-4"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: color.lightHex,
                        borderLeftColor: color.hex,
                        color: color.textHex,
                        left: `calc(${eventLeft}% + ${padding}px)`,
                        width: `calc(${eventWidth}% - ${padding}px)`,
                        zIndex: event.column + 1,
                      }}
                      title={`${event.summary}\n${timeStr}`}
                    >
                      {event.isAIScheduled && onRemoveScheduledEvent && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveScheduledEvent(event); }}
                          disabled={removingEventId === event.id}
                          className="absolute top-0.5 right-0.5 w-4 h-4 items-center justify-center text-white rounded-full hover:opacity-80 z-10 hidden group-hover:flex"
                          style={{ backgroundColor: color.hex, display: removingEventId === event.id ? 'flex' : undefined }}
                          title="Remove from calendar"
                        >
                          {removingEventId === event.id
                            ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                            : <XMarkIcon className="w-3 h-3" />}
                        </button>
                      )}
                      <div className={`font-semibold truncate ${event.isAIScheduled ? 'pr-5' : ''}`}>
                        {event.isAIScheduled ? event.summary.replace(/^\[Task(?:-\d+)?]\s*/, '') : event.summary}
                      </div>
                      {height > 30 && (
                        <div className="opacity-70 truncate text-gray-600">{timeStr}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Day View Component
const DayView = ({
  date, events, accounts, visibleAccounts, showHolidays, holidays, onEventClick, onSlotClick,
  // Scheduling integration props
  scheduledTasks = [], previewSlots = [], isPreviewMode = false, showScheduledTasks = true,
  dragEnabled = false, onTaskDrop, onRemoveScheduledTask, onPushScheduledTask,
  onRemovePreviewSlot, onEditPreviewSlot, onLocalScheduledClick, onScheduledEventClick,
  pushingTaskIds, userTasks = [], connectedAccounts = [],
  onRemoveScheduledEvent, removingEventId, unacceptingTaskId,
  onPushSingleTask,
}) => {
  const scrollRef = useRef(null);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [dropIndicator, setDropIndicator] = useState(null);
  const dragRafRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = BUSINESS_HOURS_START * HOUR_HEIGHT;
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimePosition(now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const isToday = date.toDateString() === new Date().toDateString();

  const filteredEvents = useMemo(() => {
    let result = events.filter(event => {
      const eventDate = new Date(event.start);
      if (eventDate.toDateString() !== date.toDateString()) return false;
      return visibleAccounts.includes(String(event.account_id));
    });

    if (showHolidays && holidays) {
      const dayHolidays = holidays.filter(h => {
        const hDate = new Date(h.start);
        return hDate.toDateString() === date.toDateString();
      });
      result = [...result, ...dayHolidays];
    }

    return result;
  }, [events, date, visibleAccounts, showHolidays, holidays]);

  const allDayEvents = filteredEvents.filter(e => e.all_day || e.is_all_day || e.isHoliday);

  // Merge timed events with scheduling overlays
  const timedEvents = useMemo(() => {
    const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const result = filteredEvents
      .filter(e => !e.all_day && !e.is_all_day && !e.isHoliday)
      .map(e => ({
        ...e,
        isAIScheduled: /^\[Task-\d+\]/.test(e.summary || '') || /Scheduled by (AI )?Task Scheduler/.test(e.description || ''),
      }));

    // Merge locally-scheduled tasks
    if (showScheduledTasks && scheduledTasks.length > 0) {
      scheduledTasks.forEach(st => {
        if (st.date !== dayStr || st.has_calendar_event) return;
        const alreadyShown = result.some(e => e.isAIScheduled && ((e.summary || '').includes(`[Task-${st.task_id}]`) || (e.description || '').includes(`Task ID: ${st.task_id}`)));
        if (alreadyShown) return;
        result.push({
          id: `local-${st.task_id}`,
          summary: st.title,
          start: `${st.date}T${st.start_time}:00`,
          end: `${st.date}T${st.end_time}:00`,
          isLocalScheduled: true,
          taskId: st.task_id,
          priority: st.priority,
        });
      });
    }

    // Merge preview slots
    if (isPreviewMode && previewSlots.length > 0) {
      previewSlots.forEach((slot, idx) => {
        if (slot.date === dayStr) {
          result.push({
            id: `preview-${idx}`,
            summary: slot.task_title,
            start: `${slot.date}T${slot.start_time}:00`,
            end: `${slot.date}T${slot.end_time}:00`,
            isPreview: true,
            previewIndex: idx,
            priority: slot.priority,
          });
        }
      });
    }

    return result;
  }, [filteredEvents, date, scheduledTasks, showScheduledTasks, isPreviewMode, previewSlots]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day header */}
      <div className="py-4 px-6 border-b border-gray-200 bg-white">
        <div className="text-xs text-gray-500 uppercase">
          {date.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
        <div className={`text-3xl font-light ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
          {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((event, idx) => {
              const color = event.isHoliday ? HOLIDAY_COLOR : getAccountColor(event.account_email, accounts);
              return (
                <div
                  key={idx}
                  onClick={() => onEventClick(event)}
                  className="px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 font-medium"
                  style={{
                    backgroundColor: color.lightHex,
                    borderLeftColor: color.hex,
                    color: color.textHex
                  }}
                >
                  {event.summary}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-20 flex-shrink-0 bg-white">
            {HOURS.map(hour => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2.5 right-4 text-xs text-gray-500">
                  {hour > 0 && formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Events column */}
          <div
            className="flex-1 border-l border-gray-200 relative"
            onDragOver={dragEnabled ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dragRafRef.current) return;
              const col = e.currentTarget;
              const clientY = e.clientY;
              dragRafRef.current = requestAnimationFrame(() => {
                dragRafRef.current = null;
                const rect = col.getBoundingClientRect();
                const y = clientY - rect.top;
                const totalMinutes = (y / HOUR_HEIGHT) * 60;
                const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes / 15) * 15));
                const hours = Math.floor(snapped / 60);
                const mins = snapped % 60;
                const topPx = (snapped / 60) * HOUR_HEIGHT;
                const label = `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
                setDropIndicator({ top: topPx, timeLabel: label });
              });
            } : undefined}
            onDragLeave={dragEnabled ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDropIndicator(null);
            } : undefined}
            onDrop={dragEnabled ? (e) => {
              e.preventDefault();
              setDropIndicator(null);
              if (!onTaskDrop) return;
              try {
                const taskData = JSON.parse(e.dataTransfer.getData('application/json'));
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const totalMinutes = (y / HOUR_HEIGHT) * 60;
                const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes / 15) * 15));
                const hours = Math.floor(snapped / 60);
                const mins = snapped % 60;
                onTaskDrop(taskData, date, hours, mins);
              } catch (err) {
                console.error('Drop parse error:', err);
              }
            } : undefined}
          >
            {HOURS.map(hour => (
              <div
                key={hour}
                className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                style={{ height: HOUR_HEIGHT }}
                onClick={() => onSlotClick && onSlotClick(date, hour)}
              />
            ))}

            {/* Drop indicator line */}
            {dropIndicator && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: dropIndicator.top }}
              >
                <div className="flex-1 h-0.5 bg-purple-500" />
                <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full ml-1 whitespace-nowrap">
                  {dropIndicator.timeLabel}
                </span>
              </div>
            )}

            {/* Current time indicator */}
            {isToday && (
              <div
                className="absolute left-0 right-0 z-10 flex items-center"
                style={{ top: currentTimePosition }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            )}

            {/* Events - with overlap handling + scheduling overlays */}
            {calculateEventLayout(timedEvents).map((event, idx) => {
              const startTime = new Date(event.start);
              const endTime = new Date(event.end);
              const top = (startTime.getHours() + startTime.getMinutes() / 60) * HOUR_HEIGHT;
              const duration = (endTime - startTime) / (1000 * 60 * 60);
              const height = Math.max(duration * HOUR_HEIGHT, 36);
              const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const endTimeStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

              const padding = 4;
              const totalWidth = 100;
              const eventWidth = (totalWidth / event.totalColumns) - 0.5;
              const eventLeft = event.column * (totalWidth / event.totalColumns);

              // Preview slot
              if (event.isPreview) {
                return (
                  <div
                    key={idx}
                    onClick={(e) => onEditPreviewSlot && onEditPreviewSlot(event.previewIndex, e)}
                    className="absolute rounded-lg px-3 py-1.5 cursor-pointer text-xs border-2 border-dashed border-purple-400 hover:border-purple-600 transition-colors"
                    style={{
                      top: `${top}px`, height: `${height}px`,
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      left: `calc(${eventLeft}% + ${padding}px)`,
                      width: `calc(${eventWidth}% - ${padding * 2}px)`,
                      zIndex: event.column + 5,
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemovePreviewSlot && onRemovePreviewSlot(event.previewIndex); }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-purple-500 text-white rounded-full hover:bg-purple-700 z-10"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                    <div className="font-semibold text-purple-800 truncate pr-5">{event.summary}</div>
                    {height > 40 && <div className="text-purple-600 text-[10px]">{timeStr} – {endTimeStr}</div>}
                  </div>
                );
              }

              // Locally-scheduled task
              if (event.isLocalScheduled) {
                const isUnaccepting = unacceptingTaskId === event.taskId;
                return (
                  <div
                    key={idx}
                    className="group absolute rounded-lg px-3 py-1.5 cursor-pointer hover:shadow-md transition-shadow overflow-hidden border-l-4"
                    style={{
                      top: `${top}px`, height: `${height}px`,
                      backgroundColor: '#ede9fe', borderLeftColor: '#8b5cf6', color: '#6d28d9',
                      left: `calc(${eventLeft}% + ${padding}px)`,
                      width: `calc(${eventWidth}% - ${padding * 2}px)`,
                      zIndex: event.column + 2,
                    }}
                    onClick={() => {
                      if (onLocalScheduledClick) {
                        const task = userTasks.find(t => t.id === event.taskId);
                        if (task) onLocalScheduledClick(task);
                      }
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveScheduledTask && onRemoveScheduledTask(event.taskId); }}
                      disabled={isUnaccepting}
                      className="absolute top-0.5 right-0.5 w-4 h-4 items-center justify-center bg-violet-500 text-white rounded-full hover:bg-red-600 z-10 hidden group-hover:flex"
                      style={{ display: isUnaccepting ? 'flex' : undefined }}
                    >
                      {isUnaccepting ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <XMarkIcon className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onPushSingleTask && onPushSingleTask(event.taskId, e); }}
                      disabled={!!pushingTaskIds}
                      className="absolute top-0.5 right-5 w-4 h-4 items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-700 z-10 hidden group-hover:flex"
                      title="Push to Google Calendar"
                    >
                      {pushingTaskIds?.includes(event.taskId)
                        ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                        : <CalendarIcon className="w-3 h-3" />}
                    </button>
                    <div className="font-semibold truncate pr-10">{event.summary}</div>
                    {height > 40 && <div className="text-sm opacity-70">{timeStr} – {endTimeStr}</div>}
                  </div>
                );
              }

              // Regular / AI-scheduled event
              const color = event.isHoliday ? HOLIDAY_COLOR : getAccountColor(event.account_email, accounts);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (event.isAIScheduled && onScheduledEventClick) {
                      const m = (event.summary || '').match(/^\[Task-(\d+)]/) || (event.description || '').match(/Task ID:\s*(\d+)/);
                      if (m) {
                        const task = userTasks.find(t => t.id === parseInt(m[1], 10));
                        if (task) { onScheduledEventClick(task); return; }
                      }
                    }
                    onEventClick(event);
                  }}
                  className="group absolute rounded-lg px-3 py-1.5 cursor-pointer hover:shadow-md transition-shadow overflow-hidden border-l-4"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: color.lightHex,
                    borderLeftColor: color.hex,
                    color: color.textHex,
                    left: `calc(${eventLeft}% + ${padding}px)`,
                    width: `calc(${eventWidth}% - ${padding * 2}px)`,
                    zIndex: event.column + 1,
                  }}
                >
                  {event.isAIScheduled && onRemoveScheduledEvent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveScheduledEvent(event); }}
                      disabled={removingEventId === event.id}
                      className="absolute top-0.5 right-0.5 w-4 h-4 items-center justify-center text-white rounded-full hover:opacity-80 z-10 hidden group-hover:flex"
                      style={{ backgroundColor: color.hex, display: removingEventId === event.id ? 'flex' : undefined }}
                    >
                      {removingEventId === event.id ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <XMarkIcon className="w-3 h-3" />}
                    </button>
                  )}
                  <div className={`font-semibold ${event.isAIScheduled ? 'pr-5' : ''}`}>
                    {event.isAIScheduled ? (event.summary || '').replace(/^\[Task(?:-\d+)?]\s*/, '') : event.summary}
                  </div>
                  {height > 40 && <div className="text-sm text-gray-600">{timeStr}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Month View Component
const MonthView = ({ date, events, accounts, visibleAccounts, showHolidays, holidays, onEventClick, onDateClick,
  scheduledTasks = [], previewSlots = [], isPreviewMode = false, showScheduledTasks = true,
}) => {
  const getMonthDays = () => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days = [];

    // Previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const filteredEvents = useMemo(() => {
    let result = events.filter(event => visibleAccounts.includes(String(event.account_id)));
    if (showHolidays && holidays) {
      result = [...result, ...holidays];
    }
    return result;
  }, [events, visibleAccounts, showHolidays, holidays]);

  const getEventsForDay = (d) => {
    const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const result = filteredEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === d.toDateString();
    });

    // Merge locally-scheduled tasks (accepted, not yet pushed to calendar)
    if (showScheduledTasks && scheduledTasks.length > 0) {
      scheduledTasks.forEach(st => {
        if (st.date !== dayStr || st.has_calendar_event) return;
        // Dedup: skip if already visible as a Google Calendar event (race condition safety)
        const alreadyShown = result.some(e =>
          /^\[Task-\d+\]/.test(e.summary || '') && ((e.summary || '').includes(`[Task-${st.task_id}]`) || (e.description || '').includes(`Task ID: ${st.task_id}`))
        );
        if (alreadyShown) return;
        result.push({
          id: `local-${st.task_id}`,
          summary: st.title,
          start: `${st.date}T${st.start_time}:00`,
          _isScheduled: true,
        });
      });
    }

    // Merge preview slots
    if (isPreviewMode && previewSlots.length > 0) {
      previewSlots.forEach((slot, idx) => {
        if (slot.date !== dayStr) return;
        result.push({
          id: `preview-${idx}`,
          summary: slot.task_title,
          start: `${slot.date}T${slot.start_time}:00`,
          _isPreview: true,
        });
      });
    }

    return result;
  };

  const isToday = (d) => d.toDateString() === new Date().toDateString();

  return (
    <div className="flex-1 flex flex-col p-4 overflow-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {getMonthDays().map(({ date: d, isCurrentMonth }, idx) => {
          const dayEvents = getEventsForDay(d);
          return (
            <div
              key={idx}
              onClick={() => onDateClick(d)}
              className={`
                min-h-[100px] p-1 border rounded-lg cursor-pointer transition-colors
                ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'}
                ${isToday(d) ? 'border-blue-500 border-2' : 'border-gray-200'}
              `}
            >
              <div className={`
                w-6 h-6 flex items-center justify-center rounded-full text-sm mb-1
                ${isToday(d) ? 'bg-blue-500 text-white font-semibold' : isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}
              `}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event, eventIdx) => {
                  const color = event._isScheduled
                    ? { lightHex: '#ede9fe', hex: '#8b5cf6', textHex: '#6d28d9' }
                    : event._isPreview
                      ? { lightHex: '#f5f3ff', hex: '#a78bfa', textHex: '#7c3aed' }
                      : event.isHoliday ? HOLIDAY_COLOR : getAccountColor(event.account_email, accounts);
                  return (
                    <div
                      key={eventIdx}
                      onClick={(e) => { e.stopPropagation(); if (!event._isScheduled && !event._isPreview) onEventClick(event); }}
                      className="text-xs px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:shadow-sm transition-shadow border-l-2 font-medium"
                      style={{
                        backgroundColor: color.lightHex,
                        borderLeftColor: color.hex,
                        color: color.textHex,
                        ...(event._isPreview ? { borderLeftStyle: 'dashed' } : {}),
                      }}
                      title={event.summary}
                    >
                      {event.summary}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 px-1.5">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// MEETING LINK DETECTION UTILITIES
// ============================================================================

/**
 * Detect meeting links from event data
 * Supports: Google Meet, Zoom, Microsoft Teams, Webex, GoToMeeting
 */
const detectMeetingLinks = (event) => {
  const links = [];

  // 1. Check hangout_link (Google Meet direct link)
  if (event.hangout_link) {
    links.push({
      type: 'google_meet',
      url: event.hangout_link,
      label: 'Join with Google Meet',
      icon: 'meet',
    });
  }

  // 2. Check conference_data (structured conference info)
  if (event.conference_data?.entryPoints) {
    event.conference_data.entryPoints.forEach(entry => {
      if (entry.entryPointType === 'video' && entry.uri) {
        // Avoid duplicate Google Meet links
        if (!links.some(l => l.url === entry.uri)) {
          const type = detectLinkType(entry.uri);
          links.push({
            type,
            url: entry.uri,
            label: entry.label || getDefaultLabel(type),
            icon: type,
          });
        }
      }
    });
  }

  // 3. Parse location for meeting URLs
  if (event.location) {
    const locationLinks = extractMeetingUrls(event.location);
    locationLinks.forEach(link => {
      if (!links.some(l => l.url === link.url)) {
        links.push(link);
      }
    });
  }

  // 4. Parse description for meeting URLs
  if (event.description) {
    const descLinks = extractMeetingUrls(event.description);
    descLinks.forEach(link => {
      if (!links.some(l => l.url === link.url)) {
        links.push(link);
      }
    });
  }

  return links;
};

const detectLinkType = (url) => {
  if (!url) return 'generic';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('meet.google.com') || lowerUrl.includes('hangouts.google.com')) return 'google_meet';
  if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoomgov.com')) return 'zoom';
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) return 'teams';
  if (lowerUrl.includes('webex.com')) return 'webex';
  if (lowerUrl.includes('gotomeeting.com') || lowerUrl.includes('gotomeet.me')) return 'gotomeeting';
  if (lowerUrl.includes('whereby.com')) return 'whereby';
  if (lowerUrl.includes('bluejeans.com')) return 'bluejeans';
  return 'generic';
};

const getDefaultLabel = (type) => {
  const labels = {
    google_meet: 'Join with Google Meet',
    zoom: 'Join Zoom Meeting',
    teams: 'Join Microsoft Teams',
    webex: 'Join Webex Meeting',
    gotomeeting: 'Join GoToMeeting',
    whereby: 'Join Whereby',
    bluejeans: 'Join BlueJeans',
    generic: 'Join Video Call',
  };
  return labels[type] || 'Join Meeting';
};

const extractMeetingUrls = (text) => {
  if (!text) return [];
  const links = [];

  // URL patterns for common meeting providers
  const patterns = [
    { regex: /https?:\/\/meet\.google\.com\/[a-z-]+/gi, type: 'google_meet' },
    { regex: /https?:\/\/[a-z0-9]+\.zoom\.us\/j\/\d+(\?[^\s"<>]*)*/gi, type: 'zoom' },
    { regex: /https?:\/\/zoom\.us\/j\/\d+(\?[^\s"<>]*)*/gi, type: 'zoom' },
    { regex: /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/gi, type: 'teams' },
    { regex: /https?:\/\/[a-z0-9]+\.webex\.com\/[^\s"<>]+/gi, type: 'webex' },
    { regex: /https?:\/\/(?:www\.)?gotomeet\.me\/[^\s"<>]+/gi, type: 'gotomeeting' },
    { regex: /https?:\/\/(?:global\.)?gotomeeting\.com\/join\/\d+/gi, type: 'gotomeeting' },
  ];

  patterns.forEach(({ regex, type }) => {
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(url => {
        if (!links.some(l => l.url === url)) {
          links.push({
            type,
            url,
            label: getDefaultLabel(type),
            icon: type,
          });
        }
      });
    }
  });

  return links;
};

// Meeting provider icons/colors
const getMeetingProviderStyle = (type) => {
  const styles = {
    google_meet: { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'Google Meet' },
    zoom: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'Zoom' },
    teams: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'Microsoft Teams' },
    webex: { bg: 'bg-green-600', hover: 'hover:bg-green-700', text: 'Webex' },
    gotomeeting: { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'GoToMeeting' },
    whereby: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', text: 'Whereby' },
    bluejeans: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'BlueJeans' },
    generic: { bg: 'bg-gray-600', hover: 'hover:bg-gray-700', text: 'Video Call' },
  };
  return styles[type] || styles.generic;
};

// ============================================================================
// MEETING PREP PANEL COMPONENT (AI-powered meeting preparation)
// ============================================================================

/**
 * MeetingPrepPanel - AI-powered meeting preparation assistant
 *
 * Features:
 * - Recent email exchanges with attendees
 * - AI-generated discussion points
 * - Related documents/attachments
 * - Previous meeting context
 */
const MeetingPrepPanel = ({ event, onFetchMeetingPrep }) => {
  const [prepData, setPrepData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null); // Backend warning (e.g. token expired)
  const [activeSection, setActiveSection] = useState('points'); // points, emails, docs, history
  const [expandedEmails, setExpandedEmails] = useState(new Set()); // Track expanded email items
  const [expandedMeetings, setExpandedMeetings] = useState(new Set()); // Track expanded meeting history items
  const currentEventIdRef = useRef(null); // Track current event to prevent stale data from in-flight requests

  // Reset state when event changes (prevents stale data from previous event)
  useEffect(() => {
    currentEventIdRef.current = event?.id || null;
    setPrepData(null);
    setLoading(false);
    setError(null);
    setWarning(null);
    setActiveSection('points');
    setExpandedEmails(new Set());
    setExpandedMeetings(new Set());
  }, [event?.id]);

  // Note: We intentionally don't auto-fetch on mount
  // User clicks "Generate AI Prep" button to start
  // This avoids unnecessary API calls and gives user control

  /**
   * Format email date to user's local timezone with relative time
   * Handles various date formats from Gmail API
   * Always displays in English regardless of browser locale
   */
  const formatEmailDate = (dateStr) => {
    if (!dateStr) return '';

    try {
      // Try parsing the date string
      let date;

      // Handle RFC 2822 format: "Mon, 16 Dec 2024 10:30:00 +0000"
      // Handle ISO format: "2024-12-16T10:30:00Z"
      // Handle simple format: "Dec 16, 2024"
      date = new Date(dateStr);

      if (isNaN(date.getTime())) {
        // Try parsing as timestamp
        const timestamp = parseInt(dateStr, 10);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          return dateStr; // Return original if unparseable
        }
      }

      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Format time in English (force en-US locale)
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      // Today: show "Today at 3:30 PM"
      if (diffDays === 0 && date.toDateString() === now.toDateString()) {
        return `Today at ${timeStr}`;
      }

      // Yesterday: show "Yesterday at 3:30 PM"
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${timeStr}`;
      }

      // Within last 7 days: show "Monday at 3:30 PM"
      if (diffDays < 7 && diffDays > 0) {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
        }) + ` at ${timeStr}`;
      }

      // This year: show "Dec 16 at 3:30 PM"
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }) + ` at ${timeStr}`;
      }

      // Older: show "Dec 16, 2023 at 3:30 PM"
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) + ` at ${timeStr}`;

    } catch (e) {
      console.warn('Failed to parse date:', dateStr, e);
      return dateStr;
    }
  };

  /**
   * Toggle email expansion
   */
  const toggleEmailExpand = (idx) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  /**
   * Toggle meeting history expansion
   */
  const toggleMeetingExpand = (idx) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  /**
   * Format meeting date for display
   * Always displays in English regardless of browser locale
   */
  const formatMeetingDate = (dateStr) => {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const now = new Date();

      // Format time in English (force en-US locale)
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      // Format weekday + date in English
      const dateFormatted = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Add year if different
      if (date.getFullYear() !== now.getFullYear()) {
        return `${dateFormatted}, ${date.getFullYear()} at ${timeStr}`;
      }

      return `${dateFormatted} at ${timeStr}`;
    } catch (e) {
      return dateStr;
    }
  };

  /**
   * Clean and format email snippet for display
   */
  const formatSnippet = (snippet) => {
    if (!snippet) return '';
    // Remove excessive whitespace and clean up
    return snippet
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .substring(0, 300);
  };

  /**
   * Strip HTML tags for plain text preview
   */
  const stripHtml = (html) => {
    if (!html) return '';
    // Use DOMParser (safer than innerHTML — doesn't execute scripts in the parsing context)
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch {
      return html.replace(/<[^>]*>/g, '');
    }
  };

  /**
   * Sanitize and format HTML content for safe rendering
   * Converts common patterns and ensures basic formatting
   */
  const formatHtmlContent = (content) => {
    if (!content) return '';

    // If content looks like plain text (no HTML tags), convert line breaks
    if (!/<[^>]+>/.test(content)) {
      return content
        .replace(/\n/g, '<br/>')
        .replace(/\r/g, '');
    }

    // For HTML content, preserve it but ensure safe rendering
    return content;
  };

  /**
   * Extract sender name from email address or name
   */
  const formatSender = (from) => {
    if (!from) return 'Unknown';
    if (typeof from === 'object') {
      return from.name || from.email || 'Unknown';
    }
    // Try to extract name from "Name <email@example.com>" format
    const match = from.match(/^([^<]+)</);
    if (match) {
      return match[1].trim();
    }
    // Return email or full string
    return from;
  };

  const fetchPrepData = async () => {
    if (!event || !onFetchMeetingPrep) return;

    const requestEventId = event.id; // Capture event ID at request time
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const data = await onFetchMeetingPrep(event);

      // Guard: if user switched events while request was in-flight, discard stale result
      if (currentEventIdRef.current !== requestEventId) return;

      if (!data) {
        setError('No data returned. Please try again.');
        return;
      }

      // Show backend warning (e.g. token expired → partial results)
      if (data.warning) {
        setWarning(data.warning);
      }

      setPrepData({
        aiSummary: data.aiSummary ?? '',
        discussionPoints: Array.isArray(data.discussionPoints) ? data.discussionPoints : [],
        recentEmails: Array.isArray(data.recentEmails) ? data.recentEmails : [],
        relatedDocs: Array.isArray(data.relatedDocs) ? data.relatedDocs : [],
        meetingHistory: Array.isArray(data.meetingHistory) ? data.meetingHistory : [],
      });
    } catch (err) {
      // Guard: discard error if event already changed
      if (currentEventIdRef.current !== requestEventId) return;
      console.error('Failed to fetch meeting prep:', err);
      setError(err?.message || 'Failed to load AI meeting prep. Please try again.');
    } finally {
      // Guard: only clear loading if still on same event
      if (currentEventIdRef.current === requestEventId) {
        setLoading(false);
      }
    }
  };

  // Get attendee emails (excluding self)
  const attendeeEmails = event?.attendees?.map(a => a.email).filter(Boolean) || [];

  // Section tabs configuration
  const sections = [
    { id: 'points', label: 'Discussion Points', icon: LightBulbIcon },
    { id: 'emails', label: 'Recent Emails', icon: EnvelopeIcon },
    { id: 'docs', label: 'Documents', icon: DocumentDuplicateIcon },
    { id: 'history', label: 'Meeting History', icon: BookOpenIcon },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-purple-100 border-t-purple-500 animate-spin" />
          <SparklesSolidIcon className="w-5 h-5 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-sm text-gray-600">AI is preparing your meeting...</p>
        <p className="text-xs text-gray-400 mt-1">Analyzing attendees, emails, and context</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <ExclamationCircleIcon className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-sm text-red-600 text-center">{error}</p>
        <button
          onClick={fetchPrepData}
          className="mt-4 px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Initial state - prompt to generate
  if (!prepData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">AI Meeting Prep</h4>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">
          Get AI-powered insights for your meeting with {attendeeEmails.length} attendee{attendeeEmails.length !== 1 ? 's' : ''}.
        </p>
        <button
          onClick={fetchPrepData}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <SparklesIcon className="w-5 h-5" />
          Generate AI Prep
        </button>
        <div className="mt-6 text-xs text-gray-400 text-center">
          <p>AI will analyze:</p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <span className="px-2 py-1 bg-gray-100 rounded">Email history</span>
            <span className="px-2 py-1 bg-gray-100 rounded">Meeting topic</span>
            <span className="px-2 py-1 bg-gray-100 rounded">Attendee context</span>
          </div>
        </div>
      </div>
    );
  }

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'points':
        return (
          <div className="space-y-3">
            {prepData.discussionPoints?.length > 0 ? (
              prepData.discussionPoints.map((point, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-medium">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{point.title}</p>
                    {point.context && (
                      <p className="text-xs text-gray-500 mt-1">{point.context}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No discussion points generated yet.
              </p>
            )}
          </div>
        );

      case 'emails':
        return (
          <div className="space-y-2">
            {prepData.recentEmails?.length > 0 ? (
              prepData.recentEmails.map((email, idx) => {
                const isExpanded = expandedEmails.has(idx);
                const senderName = formatSender(email.from);
                const recipientName = formatSender(email.to);
                const formattedDate = formatEmailDate(email.date);
                const cleanSnippet = formatSnippet(email.snippet);

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg transition-all duration-200 ${
                      isExpanded
                        ? 'border-blue-200 bg-blue-50/30 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Clickable header */}
                    <button
                      onClick={() => toggleEmailExpand(idx)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {senderName.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row: sender and time */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {senderName}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                {formattedDate}
                              </span>
                              <ChevronDownIcon
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>

                          {/* Subject */}
                          <p className={`text-sm text-gray-800 ${isExpanded ? '' : 'truncate'}`}>
                            {email.subject || '(No subject)'}
                          </p>

                          {/* Preview snippet (collapsed only) */}
                          {!isExpanded && cleanSnippet && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {cleanSnippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-gray-100 mt-0">
                        {/* Email metadata */}
                        <div className="ml-11 space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-gray-600 pt-2">
                            <span className="font-medium text-gray-500 w-12">From:</span>
                            <span className="truncate">
                              {typeof email.from === 'object'
                                ? `${email.from.name || ''} <${email.from.email || ''}>`
                                : email.from}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="font-medium text-gray-500 w-12">To:</span>
                            <span className="truncate">
                              {typeof email.to === 'object'
                                ? `${email.to.name || ''} <${email.to.email || ''}>`
                                : email.to}
                            </span>
                          </div>

                          {/* Full snippet */}
                          {cleanSnippet && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-1.5">Preview:</p>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {cleanSnippet}
                              </p>
                            </div>
                          )}

                          {/* Relevance note */}
                          <div className="mt-3 flex items-start gap-2 p-2 bg-purple-50 rounded-lg">
                            <SparklesIcon className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-purple-700">
                              This email involves meeting attendee <span className="font-medium">{recipientName}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <EnvelopeIcon className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 text-center">
                  No recent emails with attendees found
                </p>
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Emails from the past 30 days with meeting participants will appear here
                </p>
              </div>
            )}
          </div>
        );

      case 'docs':
        return (
          <div className="space-y-3">
            {prepData.relatedDocs?.length > 0 ? (
              prepData.relatedDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <DocumentDuplicateIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.source} • {doc.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No related documents found.
              </p>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="space-y-2">
            {prepData.meetingHistory?.length > 0 ? (
              prepData.meetingHistory.map((meeting, idx) => {
                const isExpanded = expandedMeetings.has(idx);
                const formattedDate = formatMeetingDate(meeting.date);

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg transition-all duration-200 ${
                      isExpanded
                        ? 'border-green-200 bg-green-50/30 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Clickable header */}
                    <button
                      onClick={() => toggleMeetingExpand(idx)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                          <CalendarIcon className="w-4 h-4 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row: title and expand icon */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {meeting.title || '(No title)'}
                            </span>
                            <ChevronDownIcon
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </div>

                          {/* Date */}
                          <p className="text-xs text-gray-500">
                            {formattedDate}
                          </p>

                          {/* Preview (collapsed only) - strip HTML for plain text */}
                          {!isExpanded && meeting.summary && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {stripHtml(meeting.summary)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-gray-100 mt-0">
                        <div className="ml-11">
                          {/* Summary/Description - render HTML content */}
                          {meeting.summary && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-1.5">Notes:</p>
                              <div
                                className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none
                                  [&_a]:text-blue-600 [&_a]:underline
                                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1
                                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1
                                  [&_li]:my-0.5
                                  [&_p]:my-1
                                  [&_br]:leading-tight"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatHtmlContent(meeting.summary)) }}
                              />
                            </div>
                          )}

                          {/* Context note */}
                          <div className="mt-3 flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                            <BookOpenIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-green-700">
                              Previous meeting with the same attendees
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <BookOpenIcon className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 text-center">
                  No previous meetings found
                </p>
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Past meetings with these attendees will appear here for context
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* AI Summary Card */}
      {prepData.aiSummary && (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
              <SparklesSolidIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-purple-900">AI Summary</h4>
              <p className="text-sm text-purple-800 mt-1">{prepData.aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const count = prepData[section.id === 'points' ? 'discussionPoints' :
                        section.id === 'emails' ? 'recentEmails' :
                        section.id === 'docs' ? 'relatedDocs' : 'meetingHistory']?.length || 0;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{section.label.split(' ')[0]}</span>
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Warning banner (e.g. token expired, partial results) */}
      {warning && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <ExclamationCircleIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{warning}</p>
        </div>
      )}

      {/* Section Content */}
      <div className="flex-1 overflow-auto">
        {renderSectionContent()}
      </div>

      {/* Regenerate Button */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={fetchPrepData}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            loading ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:bg-purple-50'
          }`}
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating...' : 'Regenerate AI Prep'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// EVENT DETAIL MODAL COMPONENT
// ============================================================================

const EventDetailModal = ({ event, onClose, accountColor, onFetchMeetingPrep, onCreateTask }) => {
  const [activeTab, setActiveTab] = useState('details'); // details, aiPrep

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Reset tab when event changes
  useEffect(() => {
    setActiveTab('details');
  }, [event?.id]);

  if (!event) return null;

  // Clean up Task Scheduler events (both old [Task] and new [Task-N] formats)
  const isScheduledTask = /^\[Task-\d+\]/.test(event.summary || '');
  const displaySummary = isScheduledTask
    ? (event.summary || '').replace(/^\[Task(?:-\d+)?]\s*/, '')
    : (event.summary || '');
  const displayDescription = isScheduledTask && event.description
    ? event.description
        .replace(/Scheduled by (AI )?Task Scheduler(<br>|\n)?/g, '')
        .replace(/Task ID:\s*\d+(<br>|\n)?/g, '')
        .trim() || null
    : event.description;

  const meetingLinks = detectMeetingLinks(event);
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const hasAttendees = event.attendees && event.attendees.length > 0;
  const isHoliday = event.isHoliday || event.all_day || event.is_all_day;

  // Format time display
  const formatEventTime = () => {
    if (event.all_day || event.is_all_day || event.isHoliday) {
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    const sameDay = startDate.toDateString() === endDate.toDateString();

    if (sameDay) {
      return `${startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })} · ${startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    }

    return `${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  };

  // Get organizer info
  const organizer = event.organizer?.email || event.creator?.email;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with color stripe */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: accountColor?.hex || '#3b82f6' }}
        />

        {/* Header Section - Fixed */}
        <div className="px-6 pt-4 pb-0">
          {/* Action buttons */}
          <div className="flex justify-end mb-2 gap-1">
            {/* Create Task button */}
            {onCreateTask && !isHoliday && (
              <button
                onClick={() => onCreateTask(event)}
                className="p-1.5 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors text-gray-500"
                title="Create Task from Event"
              >
                <ClipboardDocumentListIcon className="w-5 h-5" />
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Event title */}
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {displaySummary || '(No title)'}
          </h3>

          {/* Tabs - only show if event has attendees (meetings) */}
          {hasAttendees && !isHoliday && (
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Details
              </button>
              <button
                onClick={() => setActiveTab('aiPrep')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'aiPrep'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <SparklesIcon className="w-4 h-4" />
                AI Prep
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'aiPrep' && hasAttendees && !isHoliday ? (
          <div className="flex-1 overflow-auto px-6 pb-6">
            <MeetingPrepPanel event={event} onFetchMeetingPrep={onFetchMeetingPrep} />
          </div>
        ) : (
        /* Details Tab Content */
        <div className="flex-1 overflow-auto p-6 pt-0">

          {/* Time */}
          <div className="flex items-start gap-3 text-gray-600 mb-4">
            <ClockIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">{formatEventTime()}</div>
              {event.timezone && (
                <div className="text-sm text-gray-500">{event.timezone}</div>
              )}
            </div>
          </div>

          {/* Meeting links - prominent display */}
          {meetingLinks.length > 0 && (
            <div className="mb-4">
              {meetingLinks.map((link, idx) => {
                const style = getMeetingProviderStyle(link.type);
                return (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-4 py-3 ${style.bg} ${style.hover} text-white rounded-lg transition-colors mb-2`}
                  >
                    <VideoCameraIcon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Location */}
          {event.location && !meetingLinks.some(l => event.location.includes(l.url)) && (
            <div className="flex items-start gap-3 text-gray-600 mb-4">
              <MapPinIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Organizer */}
          {organizer && (
            <div className="flex items-start gap-3 text-gray-600 mb-4">
              <UserIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm text-gray-500">Organized by</div>
                <div>{event.organizer?.displayName || organizer}</div>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="mb-4">
              {/* Header with summary stats */}
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <UsersIcon className="w-5 h-5" />
                <div>
                  <span className="font-medium">{event.attendees.length} guests</span>
                  {(() => {
                    const accepted = event.attendees.filter(a => a.response_status === 'accepted').length;
                    const declined = event.attendees.filter(a => a.response_status === 'declined').length;
                    const awaiting = event.attendees.filter(a => a.response_status === 'needsAction' || !a.response_status).length;
                    const tentative = event.attendees.filter(a => a.response_status === 'tentative').length;
                    const parts = [];
                    if (accepted > 0) parts.push(`${accepted} yes`);
                    if (declined > 0) parts.push(`${declined} no`);
                    if (tentative > 0) parts.push(`${tentative} maybe`);
                    if (awaiting > 0) parts.push(`${awaiting} awaiting`);
                    return parts.length > 0 && (
                      <div className="text-xs text-gray-500">{parts.join(', ')}</div>
                    );
                  })()}
                </div>
              </div>
              {/* Attendees list - fully expanded */}
              <div className="ml-7 space-y-3">
                {event.attendees.map((attendee, idx) => {
                  // Avatar colors based on name/email hash
                  const avatarColors = [
                    'bg-blue-500', 'bg-green-500', 'bg-purple-500',
                    'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
                    'bg-indigo-500', 'bg-red-500', 'bg-amber-500'
                  ];
                  const colorIndex = (attendee.name || attendee.email || '').split('')
                    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
                  const avatarColor = avatarColors[colorIndex];

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      {/* Avatar with status badge */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-sm font-medium text-white`}>
                          {(attendee.name || attendee.email || '?').charAt(0).toUpperCase()}
                        </div>
                        {/* Status badge */}
                        {attendee.response_status === 'accepted' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <CheckCircleSolidIcon className="w-3.5 h-3.5 text-green-500" />
                          </div>
                        )}
                        {attendee.response_status === 'declined' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <XCircleSolidIcon className="w-3.5 h-3.5 text-red-500" />
                          </div>
                        )}
                        {attendee.response_status === 'tentative' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <QuestionMarkCircleIcon className="w-3.5 h-3.5 text-yellow-500" />
                          </div>
                        )}
                      </div>
                      {/* Name and role */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">
                          {attendee.name || attendee.email}
                        </div>
                        {attendee.is_organizer && (
                          <div className="text-xs text-gray-500">Organizer</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {displayDescription && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <DocumentTextIcon className="w-5 h-5" />
                <span className="font-medium">Description</span>
              </div>
              <div
                className="ml-7 text-sm text-gray-600 description-content"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(displayDescription),
                }}
              />
              <style>{`
                .description-content {
                  line-height: 1.6;
                  white-space: pre-line;
                }
                .description-content ul, .description-content ol {
                  margin: 0.5rem 0;
                  padding-left: 1.5rem;
                }
                .description-content ul {
                  list-style-type: disc;
                }
                .description-content ul ul {
                  list-style-type: circle;
                  margin: 0.25rem 0;
                }
                .description-content ul ul ul {
                  list-style-type: square;
                }
                .description-content ol {
                  list-style-type: decimal;
                }
                .description-content li {
                  margin: 0.25rem 0;
                  display: list-item;
                }
                .description-content a {
                  color: #2563eb;
                  text-decoration: none;
                }
                .description-content a:hover {
                  text-decoration: underline;
                }
                .description-content br {
                  display: block;
                  margin: 0.25rem 0;
                  content: "";
                }
              `}</style>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

// Helper: Calculate visible date range based on view type (Google Calendar style)
const getVisibleDateRange = (date, viewType) => {
  const d = new Date(date);
  let start, end;

  if (viewType === 'day') {
    // Day view: just the selected day
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } else if (viewType === 'week') {
    // Week view: Sunday to Saturday of the week containing the date
    const dayOfWeek = d.getDay();
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dayOfWeek));
  } else {
    // Month view: first day to last day of the month (including overflow weeks)
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    // Include previous month's visible days
    const startPadding = firstOfMonth.getDay();
    start = new Date(firstOfMonth);
    start.setDate(start.getDate() - startPadding);
    // Include next month's visible days (6 weeks total = 42 days)
    end = new Date(start);
    end.setDate(end.getDate() + 42);
  }

  return { start, end };
};

// Chart colors
const CHART_COLORS = {
  meeting: '#3b82f6',  // blue-500
  focus: '#22c55e',    // green-500
  trend: '#6366f1',    // indigo-500
  partner: '#8b5cf6',  // violet-500
};

// Health score color based on value
const getHealthScoreColor = (score) => {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getHealthScoreBg = (score) => {
  if (score >= 70) return 'bg-green-100';
  if (score >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
};

// Calendar Analytics Panel Component
const CalendarAnalyticsPanel = ({ userId, accounts }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  // Fetch analytics when period or accounts change
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!userId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await calendar.getCalendarAnalytics(userId, { days: period });
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch calendar analytics:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userId, period, accounts.length]);

  // Period selector options
  const periodOptions = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
  ];

  // Prepare pie chart data
  const pieData = analytics?.meeting_vs_focus ? [
    { name: 'Meetings', value: analytics.meeting_vs_focus.meeting_hours, color: CHART_COLORS.meeting },
    { name: 'Focus Time', value: analytics.meeting_vs_focus.focus_hours, color: CHART_COLORS.focus },
  ] : [];

  // Prepare daily trends data (only workdays)
  const trendData = analytics?.daily_trends
    ?.filter(d => d.is_workday)
    ?.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: d.meeting_hours,
      count: d.meeting_count,
    })) || [];

  // Prepare top partners data
  const partnerData = analytics?.top_partners?.slice(0, 8).map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    meetings: p.meeting_count,
    hours: p.total_hours,
  })) || [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Analyzing calendar data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => setPeriod(period)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No analytics data available</p>
        </div>
      </div>
    );
  }

  const { summary, health_score, recommendations } = analytics;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Period Selector - title is in the header, so just show period selector here */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Analysis Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-800">{summary?.total_meetings || 0}</div>
          <div className="text-sm text-gray-500">Total Meetings</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{summary?.meeting_hours || 0}h</div>
          <div className="text-sm text-gray-500">Meeting Hours</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{summary?.focus_hours || 0}h</div>
          <div className="text-sm text-gray-500">Focus Hours</div>
        </div>
        <div className={`rounded-xl border border-gray-200 p-4 shadow-sm ${getHealthScoreBg(health_score?.score || 0)}`}>
          <div className={`text-2xl font-bold ${getHealthScoreColor(health_score?.score || 0)}`}>
            {health_score?.score || 0}/100
          </div>
          <div className="text-sm text-gray-500">Health Score</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Meeting vs Focus Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Time Distribution</h3>
          {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}h`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No data for this period
            </div>
          )}
        </div>

        {/* Daily Trends Line Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Meeting Hours Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => `${value}h`} />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke={CHART_COLORS.trend}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.trend, strokeWidth: 0, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Top Partners Bar Chart */}
      {partnerData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Top Meeting Partners</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={partnerData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(value, name) => [
                  name === 'meetings' ? `${value} meetings` : `${value}h`,
                  name === 'meetings' ? 'Meetings' : 'Hours'
                ]}
              />
              <Bar dataKey="meetings" fill={CHART_COLORS.partner} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Health Score Details */}
      {health_score?.factors?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Health Score Factors</h3>
          <div className="space-y-2">
            {health_score.factors.map((factor, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm text-gray-700">{factor.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{factor.detail}</span>
                </div>
                <span className={`text-sm font-medium ${factor.impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {factor.impact >= 0 ? '+' : ''}{factor.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {recommendations?.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
          <h3 className="text-sm font-medium text-indigo-800 mb-4 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4" />
            AI Recommendations
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="bg-white/80 backdrop-blur rounded-lg p-3 border border-indigo-100"
              >
                <div className="flex items-start gap-3">
                  <LightBulbIcon className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{rec.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CREATE EVENT MODAL COMPONENT
// ============================================================================

const CreateEventModal = ({
  isOpen,
  onClose,
  onSave,
  accounts = [],
  initialDate = null,
  initialHour = null,
  saving = false
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [attendees, setAttendees] = useState('');
  const [errors, setErrors] = useState({});

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = initialDate || new Date();
      const hour = initialHour !== null ? initialHour : now.getHours();

      // Format date as YYYY-MM-DD
      const formatDateStr = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Format time as HH:MM
      const formatTimeStr = (h, m = 0) => {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      setStartDate(formatDateStr(now));
      setEndDate(formatDateStr(now));
      setStartTime(formatTimeStr(hour, 0));
      setEndTime(formatTimeStr(hour + 1, 0));
      setTitle('');
      setDescription('');
      setLocation('');
      setIsAllDay(false);
      setAttendees('');
      setErrors({});

      // Set first account as default
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(String(accounts[0].id));
      }
    }
  }, [isOpen, initialDate, initialHour, accounts]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!selectedAccountId) {
      newErrors.account = 'Please select a calendar';
    }

    if (!isAllDay) {
      if (!startTime) newErrors.startTime = 'Start time is required';
      if (!endTime) newErrors.endTime = 'End time is required';

      // Validate end time is after start time
      if (startDate === endDate && startTime && endTime) {
        if (startTime >= endTime) {
          newErrors.endTime = 'End time must be after start time';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Get user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Build event data
    let start, end;

    if (isAllDay) {
      start = startDate;
      end = endDate || startDate;
    } else {
      start = `${startDate}T${startTime}:00`;
      end = `${endDate}T${endTime}:00`;
    }

    const eventData = {
      summary: title.trim(),
      start,
      end,
      description: description.trim(),
      location: location.trim(),
      is_all_day: isAllDay,
      attendees: attendees.split(',').map(e => e.trim()).filter(e => e && e.includes('@')),
      timezone: userTimezone,
    };

    await onSave(eventData, parseInt(selectedAccountId));
  };

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => String(a.id) === selectedAccountId);
  const accountColor = selectedAccount
    ? getAccountColor(selectedAccount.email || selectedAccount.account_email, accounts)
    : ACCOUNT_COLORS[0];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with color stripe */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: accountColor.hex }}
        />

        {/* Header */}
        <div className="px-6 pt-4 pb-0 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Create Event</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className={`w-full px-3 py-2 text-lg font-medium border-b-2 focus:outline-none transition-colors ${
                errors.title ? 'border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
              autoFocus
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Calendar Selection */}
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.account ? 'border-red-500' : 'border-gray-200'
              }`}
            >
              <option value="">Select calendar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email || account.account_email}
                </option>
              ))}
            </select>
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-3">
            <ClockIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">All day</span>
            </label>
          </div>

          {/* Date and Time */}
          <div className="pl-8 space-y-3">
            {/* Start */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.startTime ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
              )}
            </div>

            {/* End */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!isAllDay && (
                <>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.endTime ? 'border-red-500' : 'border-gray-200'
                    }`}
                  />
                  {errors.endTime && <p className="text-red-500 text-xs">{errors.endTime}</p>}
                </>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3">
            <MapPinIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Attendees */}
          <div className="flex items-start gap-3">
            <UsersIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Add guests (comma-separated emails)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div className="flex items-start gap-3">
            <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main CalendarView Component
const CalendarView = ({
  events = [],
  accounts = [],
  loading = false,
  error = null,
  onRefresh,
  onDateRangeChange, // Callback when visible date range changes
  onShowAddAccount,
  onEventClick,
  onCreateEvent,
  onFetchMeetingPrep, // AI Meeting Prep callback
  onCreateTask, // Create task from calendar event
  userId, // User ID for analytics
  // Scheduling integration props (all optional, backward-compatible)
  schedulingMode = false,
  scheduledTasks = [],
  previewSlots = [],
  isPreviewMode = false,
  showScheduledTasks: showScheduledTasksProp,
  onToggleScheduledTasks,
  dragEnabled = false,
  onTaskDrop,
  onRemoveScheduledTask,
  onPushScheduledTask,
  onRemovePreviewSlot,
  onEditPreviewSlot,
  onScheduledEventClick,
  onLocalScheduledClick,
  statusMessage,
  pushingTaskIds,
  userTasks = [],
  onRemoveScheduledEvent,
  removingEventId,
  unacceptingTaskId,
  onPushSingleTask,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('week'); // day, week, month
  const [visibleAccounts, setVisibleAccounts] = useState([]);
  const [showHolidays, setShowHolidays] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false); // Header date picker dropdown
  const [showAnalytics, setShowAnalytics] = useState(false); // Analytics panel toggle

  // Create event modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEventDate, setCreateEventDate] = useState(null);
  const [createEventHour, setCreateEventHour] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);

  // Notify parent when visible date range changes (Google Calendar style)
  useEffect(() => {
    if (onDateRangeChange) {
      const { start, end } = getVisibleDateRange(selectedDate, view);
      onDateRangeChange({ start, end, view });
    }
  }, [selectedDate, view, onDateRangeChange]);

  // Handle event click - show detail modal
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    // Note: CalendarView now handles event detail modal internally
    // Parent handler is not called to avoid duplicate modals
  };

  // Get color for selected event
  const getSelectedEventColor = () => {
    if (!selectedEvent) return null;
    if (selectedEvent.isHoliday) return HOLIDAY_COLOR;
    return getAccountColor(selectedEvent.account_email, accounts);
  };

  // Handle opening create event modal from Create button
  const handleOpenCreateModal = () => {
    setCreateEventDate(selectedDate);
    setCreateEventHour(null); // Let modal use current hour
    setShowCreateModal(true);
  };

  // Handle opening create event modal from calendar slot click
  const handleSlotClick = (date, hour) => {
    setCreateEventDate(date);
    setCreateEventHour(hour);
    setShowCreateModal(true);
  };

  // Handle saving a new event
  const handleSaveEvent = async (eventData, accountId) => {
    if (!userId) {
      console.error('No user ID for creating event');
      return;
    }

    setSavingEvent(true);
    try {
      await calendar.createEvent(eventData, accountId, userId);
      setShowCreateModal(false);
      // Refresh calendar to show new event
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      // Keep modal open on error so user can retry
      throw error;
    } finally {
      setSavingEvent(false);
    }
  };

  // Initialize visible accounts when accounts change
  // Note: Store as strings for consistent comparison with event.account_id
  useEffect(() => {
    if (accounts.length > 0) {
      const accountIds = accounts.map(a => String(a.id));
      setVisibleAccounts(accountIds);
    }
  }, [accounts]);

  // Generate US holidays for the current year
  useEffect(() => {
    const year = selectedDate.getFullYear();

    // Helper to get nth weekday of a month
    const getNthWeekday = (year, month, weekday, n) => {
      const firstDay = new Date(year, month, 1);
      let dayOffset = weekday - firstDay.getDay();
      if (dayOffset < 0) dayOffset += 7;
      return new Date(year, month, 1 + dayOffset + (n - 1) * 7);
    };

    // Helper to get last weekday of a month
    const getLastWeekday = (year, month, weekday) => {
      const lastDay = new Date(year, month + 1, 0);
      let dayOffset = lastDay.getDay() - weekday;
      if (dayOffset < 0) dayOffset += 7;
      return new Date(year, month + 1, -dayOffset);
    };

    const usHolidays = [
      { name: "New Year's Day", date: new Date(year, 0, 1) },
      { name: "Martin Luther King Jr. Day", date: getNthWeekday(year, 0, 1, 3) }, // 3rd Monday of Jan
      { name: "Presidents' Day", date: getNthWeekday(year, 1, 1, 3) }, // 3rd Monday of Feb
      { name: "Memorial Day", date: getLastWeekday(year, 4, 1) }, // Last Monday of May
      { name: "Independence Day", date: new Date(year, 6, 4) },
      { name: "Labor Day", date: getNthWeekday(year, 8, 1, 1) }, // 1st Monday of Sep
      { name: "Columbus Day", date: getNthWeekday(year, 9, 1, 2) }, // 2nd Monday of Oct
      { name: "Veterans Day", date: new Date(year, 10, 11) },
      { name: "Thanksgiving Day", date: getNthWeekday(year, 10, 4, 4) }, // 4th Thursday of Nov
      { name: "Christmas Eve", date: new Date(year, 11, 24) },
      { name: "Christmas Day", date: new Date(year, 11, 25) },
      { name: "New Year's Eve", date: new Date(year, 11, 31) },
    ];

    const holidayEvents = usHolidays.map(h => ({
      id: `holiday-${h.name}-${year}`,
      summary: h.name,
      start: h.date.toISOString(),
      end: new Date(h.date.getFullYear(), h.date.getMonth(), h.date.getDate() + 1).toISOString(), // Exclusive end date
      all_day: true,
      isHoliday: true,
    }));

    setHolidays(holidayEvents);
  }, [selectedDate]);

  const toggleAccount = (accountId) => {
    const id = String(accountId);
    setVisibleAccounts(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const navigateCalendar = (direction) => {
    const newDate = new Date(selectedDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getHeaderTitle = () => {
    if (view === 'month') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      } else {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    } else {
      return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  // No accounts connected
  if (!loading && accounts.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Connect Your Calendar</h3>
            <p className="text-gray-500 text-sm max-w-md mb-4">
              Connect your Google account to view and manage your calendar events.
            </p>
            <button
              onClick={onShowAddAccount}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto"
            >
              <PlusIcon className="w-4 h-4" />
              Connect Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left Sidebar */}
      <CalendarSidebar
        selectedDate={selectedDate}
        onDateSelect={(d) => {
          setSelectedDate(d);
          setShowAnalytics(false);
          setView('day');
        }}
        events={events}
        accounts={accounts}
        visibleAccounts={visibleAccounts}
        onToggleAccount={toggleAccount}
        showHolidays={showHolidays}
        onToggleHolidays={() => setShowHolidays(!showHolidays)}
        onCreateEvent={handleOpenCreateModal}
        showAnalytics={showAnalytics}
        onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
        schedulingMode={schedulingMode}
        showScheduledTasks={showScheduledTasksProp}
        onToggleScheduledTasks={onToggleScheduledTasks}
        statusMessage={statusMessage}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
          {showAnalytics ? (
            /* Analytics header with back button */
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAnalytics(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Back to Calendar"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 text-xl font-normal text-gray-800">
                <ChartBarIcon className="w-6 h-6 text-indigo-500" />
                <span>Calendar Analytics</span>
              </div>
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">AI Powered</span>
            </div>
          ) : (
            /* Calendar header with date navigation */
            <div className="flex items-center gap-2">
              <button
                onClick={goToToday}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateCalendar(-1)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => navigateCalendar(1)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-600" />
              </button>
              {/* Clickable header title with date picker dropdown - Google Calendar style */}
              <div className="relative ml-4">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-xl font-normal text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                  {getHeaderTitle()}
                  <ChevronLeftIcon className={`w-4 h-4 transition-transform ${showDatePicker ? 'rotate-90' : '-rotate-90'}`} />
                </button>
                {/* Date picker dropdown */}
                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
                    <MiniCalendar
                      selectedDate={selectedDate}
                      onDateSelect={(date) => {
                        setSelectedDate(date);
                        setShowDatePicker(false);
                      }}
                      events={events}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* View toggle - only show when not in analytics mode */}
            {!showAnalytics && (
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                {['Day', 'Week', 'Month'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v.toLowerCase())}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      view === v.toLowerCase()
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            {/* Refresh button - only show for calendar view */}
            {!showAnalytics && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Calendar content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Loading calendar...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-2" />
              <p className="text-red-600 text-sm mb-4">
                {typeof error === 'string' ? error : 'Failed to load calendar'}
              </p>
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : showAnalytics ? (
          <CalendarAnalyticsPanel
            userId={userId}
            accounts={accounts}
          />
        ) : view === 'week' ? (
          <WeekView
            date={selectedDate}
            events={events}
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            showHolidays={showHolidays}
            holidays={holidays}
            onEventClick={handleEventClick}
            onDayClick={(day) => {
              setSelectedDate(day);
              setView('day');
            }}
            onSlotClick={handleSlotClick}
            scheduledTasks={scheduledTasks}
            previewSlots={previewSlots}
            isPreviewMode={isPreviewMode}
            showScheduledTasks={showScheduledTasksProp !== undefined ? showScheduledTasksProp : true}
            dragEnabled={dragEnabled}
            onTaskDrop={onTaskDrop}
            onRemoveScheduledTask={onRemoveScheduledTask}
            onPushScheduledTask={onPushScheduledTask}
            onRemovePreviewSlot={onRemovePreviewSlot}
            onEditPreviewSlot={onEditPreviewSlot}
            onLocalScheduledClick={onLocalScheduledClick}
            onScheduledEventClick={onScheduledEventClick}
            pushingTaskIds={pushingTaskIds}
            userTasks={userTasks}
            connectedAccounts={accounts}
            onRemoveScheduledEvent={onRemoveScheduledEvent}
            removingEventId={removingEventId}
            unacceptingTaskId={unacceptingTaskId}
            onPushSingleTask={onPushSingleTask}
          />
        ) : view === 'day' ? (
          <DayView
            date={selectedDate}
            events={events}
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            showHolidays={showHolidays}
            holidays={holidays}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
            scheduledTasks={scheduledTasks}
            previewSlots={previewSlots}
            isPreviewMode={isPreviewMode}
            showScheduledTasks={showScheduledTasksProp !== undefined ? showScheduledTasksProp : true}
            dragEnabled={dragEnabled}
            onTaskDrop={onTaskDrop}
            onRemoveScheduledTask={onRemoveScheduledTask}
            onPushScheduledTask={onPushScheduledTask}
            onRemovePreviewSlot={onRemovePreviewSlot}
            onEditPreviewSlot={onEditPreviewSlot}
            onLocalScheduledClick={onLocalScheduledClick}
            onScheduledEventClick={onScheduledEventClick}
            pushingTaskIds={pushingTaskIds}
            userTasks={userTasks}
            connectedAccounts={accounts}
            onRemoveScheduledEvent={onRemoveScheduledEvent}
            removingEventId={removingEventId}
            unacceptingTaskId={unacceptingTaskId}
            onPushSingleTask={onPushSingleTask}
          />
        ) : (
          <MonthView
            date={selectedDate}
            events={events}
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            showHolidays={showHolidays}
            holidays={holidays}
            onEventClick={handleEventClick}
            onDateClick={(d) => {
              setSelectedDate(d);
              setView('day');
            }}
            scheduledTasks={scheduledTasks}
            previewSlots={previewSlots}
            isPreviewMode={isPreviewMode}
            showScheduledTasks={showScheduledTasksProp !== undefined ? showScheduledTasksProp : true}
          />
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          accountColor={getSelectedEventColor()}
          onFetchMeetingPrep={onFetchMeetingPrep}
          onCreateTask={onCreateTask}
        />
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleSaveEvent}
        accounts={accounts}
        initialDate={createEventDate}
        initialHour={createEventHour}
        saving={savingEvent}
      />
    </div>
  );
};

export default CalendarView;
export { EventDetailModal, detectMeetingLinks, getMeetingProviderStyle };
