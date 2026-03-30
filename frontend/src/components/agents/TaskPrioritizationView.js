/**
 * TaskPrioritizationView - Full Page Task Prioritization
 *
 * Strictly follows Plane's UI patterns:
 * - Multiple views: List, Kanban, Spreadsheet, Calendar
 * - 5-level priority system with Lucide signal icons (same as Plane)
 * - Task detail sidebar panel
 * - Display properties configuration
 * - Drag-and-drop reordering
 */
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  // Layout & Navigation
  Bars3Icon,
  Squares2X2Icon,
  TableCellsIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XMarkIcon,
  ArrowPathIcon,
  FunnelIcon,
  EllipsisHorizontalIcon,
  AdjustmentsHorizontalIcon,
  // Actions
  PlusIcon,
  CheckIcon,
  // Status
  ClockIcon,
  // Other
  SparklesIcon,
  UserCircleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
} from '@heroicons/react/24/solid';
// Plane uses Lucide icons for priority - exact same library and icons
import {
  AlertCircle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Ban,
} from 'lucide-react';
import { taskPrioritization } from '../../services/workApi';

// ============================================================================
// PLANE-STYLE CONSTANTS
// ============================================================================

// 5-level priority system (Plane exact)
const PRIORITIES = {
  urgent: {
    key: 'urgent',
    label: 'Urgent',
    icon: 'alert',
    color: '#ef4444',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-500',
    hoverBg: 'hover:bg-red-100',
  },
  high: {
    key: 'high',
    label: 'High',
    icon: 'signal-high',
    color: '#f97316',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500',
    hoverBg: 'hover:bg-orange-100',
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    icon: 'signal-medium',
    color: '#eab308',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600',
    borderColor: 'border-yellow-500',
    hoverBg: 'hover:bg-yellow-100',
  },
  low: {
    key: 'low',
    label: 'Low',
    icon: 'signal-low',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    hoverBg: 'hover:bg-blue-100',
  },
  none: {
    key: 'none',
    label: 'None',
    icon: 'ban',
    color: '#6b7280',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-300',
    hoverBg: 'hover:bg-gray-100',
  },
};

// Status/State system
const STATES = {
  backlog: { label: 'Backlog', color: '#6b7280', icon: 'circle' },
  todo: { label: 'To Do', color: '#3b82f6', icon: 'circle' },
  in_progress: { label: 'In Progress', color: '#eab308', icon: 'half-circle' },
  review: { label: 'In Review', color: '#8b5cf6', icon: 'three-quarter' },
  done: { label: 'Done', color: '#22c55e', icon: 'check' },
  cancelled: { label: 'Cancelled', color: '#ef4444', icon: 'x' },
};

// View types
const VIEW_TYPES = [
  { id: 'list', label: 'List', icon: Bars3Icon },
  { id: 'kanban', label: 'Board', icon: Squares2X2Icon },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: TableCellsIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDaysIcon },
];

// Display properties (Plane exact)
const DISPLAY_PROPERTIES = [
  { key: 'key', label: 'ID', default: true },
  { key: 'priority', label: 'Priority', default: true },
  { key: 'state', label: 'State', default: true },
  { key: 'assignee', label: 'Assignee', default: true },
  { key: 'due_date', label: 'Due Date', default: true },
  { key: 'start_date', label: 'Start Date', default: false },
  { key: 'estimate', label: 'Estimate', default: true },
  { key: 'labels', label: 'Labels', default: false },
  { key: 'source', label: 'Source', default: true },
  { key: 'created_at', label: 'Created', default: false },
  { key: 'updated_at', label: 'Updated', default: false },
];

// Group by options
const GROUP_BY_OPTIONS = [
  { id: 'none', label: 'No grouping' },
  { id: 'priority', label: 'Priority' },
  { id: 'state', label: 'State' },
  { id: 'source', label: 'Source' },
  { id: 'assignee', label: 'Assignee' },
];

// ============================================================================
// PRIORITY ICON COMPONENT (Plane exact)
// ============================================================================

const PriorityIcon = ({ priority, size = 16, withContainer = false, className = '' }) => {
  const config = PRIORITIES[priority] || PRIORITIES.none;

  // Plane uses Lucide icons for priority - exact same icons
  const renderIcon = () => {
    const iconProps = { size, strokeWidth: 2 };

    switch (priority) {
      case 'urgent':
        // Plane uses AlertCircle (lucide) for urgent priority
        return <AlertCircle {...iconProps} />;
      case 'high':
        // Plane uses SignalHigh (lucide) for high priority
        return <SignalHigh {...iconProps} />;
      case 'medium':
        // Plane uses SignalMedium (lucide) for medium priority
        return <SignalMedium {...iconProps} />;
      case 'low':
        // Plane uses SignalLow (lucide) for low priority
        return <SignalLow {...iconProps} />;
      default: // none
        // Plane uses Ban (lucide) for no priority
        return <Ban {...iconProps} />;
    }
  };

  if (withContainer) {
    return (
      <div
        className={`flex items-center justify-center w-5 h-5 rounded border ${config.bgColor} ${config.borderColor} ${className}`}
        style={{ color: config.color }}
      >
        {renderIcon()}
      </div>
    );
  }

  return (
    <span className={className} style={{ color: config.color }}>
      {renderIcon()}
    </span>
  );
};

// ============================================================================
// STATE ICON COMPONENT
// ============================================================================

const StateIcon = ({ state, size = 14 }) => {
  const config = STATES[state] || STATES.backlog;

  switch (config.icon) {
    case 'check':
      return <CheckCircleSolidIcon className="w-4 h-4" style={{ color: config.color }} />;
    case 'half-circle':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: config.color }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 2a6 6 0 010 12" fill="currentColor" />
        </svg>
      );
    case 'three-quarter':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: config.color }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 2a6 6 0 110 12 6 6 0 010-12z" fill="currentColor" clipPath="url(#clip)" />
        </svg>
      );
    case 'x':
      return <XMarkIcon className="w-4 h-4" style={{ color: config.color }} />;
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: config.color }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
};

// ============================================================================
// PRIORITY DROPDOWN (Plane exact)
// ============================================================================

const PriorityDropdown = ({
  value,
  onChange,
  disabled = false,
  buttonVariant = 'border-with-text', // 'border-with-text' | 'border-without-text' | 'transparent-with-text'
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = PRIORITIES[value] || PRIORITIES.none;

  const handleSelect = (priority) => {
    onChange(priority);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 text-sm transition-colors
          ${buttonVariant === 'border-with-text' ? `px-2 py-1 border rounded ${config.bgColor} ${config.borderColor} ${config.textColor}` : ''}
          ${buttonVariant === 'border-without-text' ? `p-1 border rounded ${config.bgColor} ${config.borderColor}` : ''}
          ${buttonVariant === 'transparent-with-text' ? `px-2 py-1 rounded hover:bg-gray-100 ${config.textColor}` : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${buttonClassName}
        `}
      >
        <PriorityIcon priority={value} size={14} />
        {(buttonVariant === 'border-with-text' || buttonVariant === 'transparent-with-text') && (
          <span className="text-xs font-medium">{config.label}</span>
        )}
        <ChevronDownIcon className="w-3 h-3 opacity-60" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
            {Object.entries(PRIORITIES).map(([key, priority]) => (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors
                  ${value === key ? 'bg-gray-100' : 'hover:bg-gray-50'}
                `}
              >
                <PriorityIcon priority={key} size={14} />
                <span>{priority.label}</span>
                {value === key && <CheckIcon className="w-3.5 h-3.5 ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// VIEW HEADER (Plane style)
// ============================================================================

const ViewHeader = ({
  viewType,
  onViewChange,
  groupBy,
  onGroupByChange,
  displayProperties,
  onDisplayPropertiesChange,
  onRefresh,
  isLoading,
  taskCount,
}) => {
  const [showDisplayProps, setShowDisplayProps] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
      {/* Left: View tabs */}
      <div className="flex items-center gap-1">
        {VIEW_TYPES.map((view) => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${viewType === view.id
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {/* Task count */}
        <span className="text-sm text-gray-500">{taskCount} tasks</span>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Group by */}
        <div className="relative">
          <button
            onClick={() => setShowGroupBy(!showGroupBy)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <FunnelIcon className="w-4 h-4" />
            <span>Group</span>
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          {showGroupBy && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowGroupBy(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                {GROUP_BY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onGroupByChange(option.id);
                      setShowGroupBy(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 text-sm text-left transition-colors
                      ${groupBy === option.id ? 'bg-gray-100' : 'hover:bg-gray-50'}
                    `}
                  >
                    <span>{option.label}</span>
                    {groupBy === option.id && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Display properties */}
        <div className="relative">
          <button
            onClick={() => setShowDisplayProps(!showDisplayProps)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            <span>Display</span>
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          {showDisplayProps && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDisplayProps(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                <div className="px-3 pb-2 mb-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase">Properties</span>
                </div>
                {DISPLAY_PROPERTIES.map((prop) => (
                  <label
                    key={prop.key}
                    className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    <span>{prop.label}</span>
                    <input
                      type="checkbox"
                      checked={displayProperties[prop.key]}
                      onChange={(e) => onDisplayPropertiesChange(prop.key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LIST VIEW ROW (Plane exact)
// ============================================================================

const ListViewRow = ({
  task,
  displayProperties,
  isSelected,
  onSelect,
  onClick,
  onPriorityChange,
  onStateChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const stateConfig = STATES[task.status || 'todo'];

  return (
    <div
      className={`
        group flex items-center min-h-[44px] px-4 py-2 border-b border-gray-100 transition-colors cursor-pointer
        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Selection checkbox */}
      <div className={`w-6 mr-2 ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(!isSelected);
          }}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
      </div>

      {/* Task ID */}
      {displayProperties.key && (
        <div className="w-24 flex-shrink-0 mr-3">
          <span className="text-xs font-medium text-gray-500">
            {task.task_id || `TASK-${task.id}`}
          </span>
        </div>
      )}

      {/* Task title */}
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm text-gray-900 truncate">{task.title}</p>
      </div>

      {/* Properties */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* State */}
        {displayProperties.state && (
          <div className="flex items-center gap-1.5 w-28">
            <StateIcon state={task.status || 'todo'} />
            <span className="text-xs text-gray-600">{stateConfig.label}</span>
          </div>
        )}

        {/* Priority */}
        {displayProperties.priority && (
          <div onClick={(e) => e.stopPropagation()}>
            <PriorityDropdown
              value={task.suggested_priority || task.priority || 'none'}
              onChange={(val) => onPriorityChange(task, val)}
              buttonVariant="border-without-text"
            />
          </div>
        )}

        {/* Assignee */}
        {displayProperties.assignee && (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <UserCircleIcon className="w-4 h-4 text-gray-500" />
          </div>
        )}

        {/* Due date */}
        {displayProperties.due_date && task.due_date && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}

        {/* Estimate */}
        {displayProperties.estimate && task.estimated_minutes && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>{task.estimated_minutes}m</span>
          </div>
        )}

        {/* Source */}
        {displayProperties.source && task.source && (
          <div className="px-2 py-0.5 text-xs bg-gray-100 rounded text-gray-600">
            {task.source}
          </div>
        )}
      </div>

      {/* Quick actions on hover */}
      <div className={`flex items-center gap-1 ml-2 ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
          <EllipsisHorizontalIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// LIST VIEW GROUP (Plane exact)
// ============================================================================

const ListViewGroup = ({
  groupKey,
  groupLabel,
  groupColor,
  tasks,
  displayProperties,
  selectedTasks,
  onSelectTask,
  onTaskClick,
  onPriorityChange,
  onStateChange,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200">
      {/* Group header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <ChevronRightIcon
          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: groupColor }}
        />
        <span className="text-sm font-medium text-gray-700">{groupLabel}</span>
        <span className="text-xs text-gray-400 ml-1">({tasks.length})</span>
      </button>

      {/* Group content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tasks.map((task) => (
              <ListViewRow
                key={task.task_id || task.id}
                task={task}
                displayProperties={displayProperties}
                isSelected={selectedTasks.includes(task.task_id || task.id)}
                onSelect={(selected) => onSelectTask(task.task_id || task.id, selected)}
                onClick={() => onTaskClick(task)}
                onPriorityChange={onPriorityChange}
                onStateChange={onStateChange}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// KANBAN CARD (Plane exact)
// ============================================================================

const KanbanCard = ({
  task,
  displayProperties,
  isSelected,
  onClick,
}) => {
  const stateConfig = STATES[task.status || 'todo'];

  return (
    <div
      onClick={onClick}
      className={`
        group flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer
        hover:border-gray-300 hover:shadow-sm transition-all
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {/* Top row: state color indicator + ID */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-4 rounded-full"
          style={{ backgroundColor: stateConfig.color }}
        />
        <span className="text-xs font-medium text-gray-500">
          {task.task_id || `TASK-${task.id}`}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm text-gray-900 line-clamp-2">{task.title}</p>

      {/* Bottom row: properties */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {displayProperties.priority && (
            <PriorityIcon priority={task.suggested_priority || task.priority || 'none'} size={14} withContainer />
          )}
          {displayProperties.due_date && task.due_date && (
            <span className="text-xs text-gray-500">
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {displayProperties.assignee && (
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
            <UserCircleIcon className="w-3.5 h-3.5 text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// KANBAN COLUMN (Plane exact)
// ============================================================================

const KanbanColumn = ({
  columnKey,
  columnLabel,
  columnColor,
  tasks,
  displayProperties,
  selectedTasks,
  onTaskClick,
}) => {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] h-full bg-gray-50 rounded-lg">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: columnColor }}
          />
          <span className="text-sm font-medium text-gray-700">{columnLabel}</span>
          <span className="text-xs text-gray-400">({tasks.length})</span>
        </div>
        <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Column content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <KanbanCard
            key={task.task_id || task.id}
            task={task}
            displayProperties={displayProperties}
            isSelected={selectedTasks.includes(task.task_id || task.id)}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SPREADSHEET VIEW (Plane exact)
// ============================================================================

const SpreadsheetView = ({
  tasks,
  displayProperties,
  selectedTasks,
  onSelectTask,
  onTaskClick,
  onPriorityChange,
}) => {
  const columns = DISPLAY_PROPERTIES.filter(p => displayProperties[p.key]);

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-10 px-2 py-2 text-left">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
            </th>
            <th className="min-w-[300px] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Task
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className="min-w-[120px] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isSelected = selectedTasks.includes(task.task_id || task.id);
            return (
              <tr
                key={task.task_id || task.id}
                onClick={() => onTaskClick(task)}
                className={`
                  border-b border-gray-100 cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                `}
              >
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectTask(task.task_id || task.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {task.task_id || `TASK-${task.id}`}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{task.title}</span>
                  </div>
                </td>
                {displayProperties.key && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.task_id || `TASK-${task.id}`}
                  </td>
                )}
                {displayProperties.priority && (
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <PriorityDropdown
                      value={task.suggested_priority || task.priority || 'none'}
                      onChange={(val) => onPriorityChange(task, val)}
                      buttonVariant="transparent-with-text"
                      buttonClassName="text-left"
                    />
                  </td>
                )}
                {displayProperties.state && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <StateIcon state={task.status || 'todo'} />
                      <span className="text-xs text-gray-600">
                        {STATES[task.status || 'todo'].label}
                      </span>
                    </div>
                  </td>
                )}
                {displayProperties.assignee && (
                  <td className="px-4 py-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserCircleIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  </td>
                )}
                {displayProperties.due_date && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                  </td>
                )}
                {displayProperties.start_date && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}
                  </td>
                )}
                {displayProperties.estimate && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.estimated_minutes ? `${task.estimated_minutes}m` : '-'}
                  </td>
                )}
                {displayProperties.labels && (
                  <td className="px-4 py-2">
                    {task.tags?.map(tag => (
                      <span key={tag} className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 rounded mr-1">
                        {tag}
                      </span>
                    ))}
                  </td>
                )}
                {displayProperties.source && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.source || '-'}
                  </td>
                )}
                {displayProperties.created_at && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}
                  </td>
                )}
                {displayProperties.updated_at && (
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : '-'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// TASK DETAIL SIDEBAR (Plane exact)
// ============================================================================

const TaskDetailSidebar = ({
  task,
  onClose,
  onPriorityChange,
  onStateChange,
}) => {
  if (!task) return null;

  const stateConfig = STATES[task.status || 'todo'];

  return (
    <div className="w-[400px] h-full border-l border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">
          {task.task_id || `TASK-${task.id}`}
        </span>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
        </div>

        {/* Properties */}
        <div className="space-y-4">
          {/* State */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">State</span>
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
              <StateIcon state={task.status || 'todo'} />
              <span className="text-sm">{stateConfig.label}</span>
            </div>
          </div>

          {/* Priority */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Priority</span>
            <PriorityDropdown
              value={task.suggested_priority || task.priority || 'none'}
              onChange={(val) => onPriorityChange(task, val)}
              buttonVariant="border-with-text"
            />
          </div>

          {/* Assignee */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Assignee</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <UserCircleIcon className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-sm text-gray-600">Unassigned</span>
            </div>
          </div>

          {/* Due date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Due date</span>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>
                {task.due_date
                  ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Not set'
                }
              </span>
            </div>
          </div>

          {/* Estimate */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Estimate</span>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <ClockIcon className="w-4 h-4" />
              <span>{task.estimated_minutes ? `${task.estimated_minutes} minutes` : 'Not set'}</span>
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Source</span>
            <span className="px-2 py-0.5 text-xs bg-gray-100 rounded text-gray-600">
              {task.source || 'Manual'}
            </span>
          </div>

          {/* Labels/Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Labels</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                {task.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Reasoning (if available) */}
        {task.reasoning && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <SparklesIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-800 mb-1">AI Analysis</p>
                <p className="text-sm text-blue-700">{task.reasoning}</p>
                {task.priority_score !== undefined && (
                  <p className="text-xs text-blue-600 mt-2">
                    Priority Score: {Math.round(task.priority_score * 100)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
            <p className="text-sm text-gray-600">{task.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TaskPrioritizationView({
  userId,
  tasks: initialTasks = [],
  onClose,
  onPrioritiesApplied,
}) {
  // View state
  const [viewType, setViewType] = useState('list');
  const [groupBy, setGroupBy] = useState('priority');
  const [displayProperties, setDisplayProperties] = useState(
    DISPLAY_PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.key]: prop.default }), {})
  );

  // Data state
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await taskPrioritization.analyze({
        userId,
        taskIds: null,
        includeTriage: true,
        context: {
          workHoursPerDay: 8,
          workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
          preferredStartTime: '09:00',
          scheduleStartDate: new Date().toISOString().split('T')[0],
          scheduleDays: 7,
        },
      });
      setTasks(response.prioritized_tasks || []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  // Load tasks on mount if not provided
  useEffect(() => {
    if (initialTasks.length === 0 && !hasLoaded && !isLoading) {
      loadTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { all: tasks };
    }

    return tasks.reduce((groups, task) => {
      let key;
      switch (groupBy) {
        case 'priority':
          key = task.suggested_priority || task.priority || 'none';
          break;
        case 'state':
          key = task.status || 'todo';
          break;
        case 'source':
          key = task.source || 'manual';
          break;
        case 'assignee':
          key = task.assignee || 'unassigned';
          break;
        default:
          key = 'all';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [tasks, groupBy]);

  // Handlers
  const handleSelectTask = (taskId, selected) => {
    setSelectedTasks(prev =>
      selected
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const handlePriorityChange = (task, newPriority) => {
    setTasks(prev => prev.map(t =>
      (t.task_id || t.id) === (task.task_id || task.id)
        ? { ...t, suggested_priority: newPriority, priority: newPriority }
        : t
    ));
    if (selectedTask && (selectedTask.task_id || selectedTask.id) === (task.task_id || task.id)) {
      setSelectedTask({ ...selectedTask, suggested_priority: newPriority, priority: newPriority });
    }
  };

  const handleStateChange = (task, newState) => {
    setTasks(prev => prev.map(t =>
      (t.task_id || t.id) === (task.task_id || task.id)
        ? { ...t, status: newState }
        : t
    ));
  };

  const handleDisplayPropertyChange = (key, value) => {
    setDisplayProperties(prev => ({ ...prev, [key]: value }));
  };

  // Apply priorities to database
  const handleApplyPriorities = async () => {
    if (tasks.length === 0) return;

    setIsApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Build updates array from tasks
      const updates = tasks.map(task => {
        // Handle task_id which could be number or string like "TASK-123"
        let taskId = task.id;
        if (!taskId && task.task_id) {
          if (typeof task.task_id === 'number') {
            taskId = task.task_id;
          } else if (typeof task.task_id === 'string') {
            // Extract number from string like "TASK-123" or just parse "123"
            const match = task.task_id.match(/\d+/);
            taskId = match ? parseInt(match[0], 10) : 0;
          }
        }

        return {
          taskId: taskId || 0,
          taskType: task.source === 'extracted' || task.source === 'email' || task.source === 'calendar' ? 'extracted' : 'todo',
          priority: task.suggested_priority || task.priority || 'medium',
          estimatedMinutes: task.estimated_minutes || task.ai_estimated_minutes || null,
        };
      });

      // Call API to save priorities
      const result = await taskPrioritization.applyPriorities(userId, updates);

      if (result.success) {
        setSuccessMessage(`Successfully updated ${result.updated_count} task priorities!`);
        setHasApplied(true);

        // Call the callback to refresh backlog
        onPrioritiesApplied?.(tasks);

        // Auto-close after short delay to show success message
        setTimeout(() => {
          onClose?.();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to apply priorities');
    } finally {
      setIsApplying(false);
    }
  };

  // Get group config
  const getGroupConfig = (key) => {
    switch (groupBy) {
      case 'priority':
        return PRIORITIES[key] || PRIORITIES.none;
      case 'state':
        return STATES[key] || STATES.backlog;
      default:
        return { label: key, color: '#6b7280' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Compact Header - in-place style */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-violet-50/80 via-blue-50/80 to-purple-50/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white/60 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Back to Tasks</span>
          </button>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">AI Prioritization</span>
            {tasks.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                {tasks.length} tasks
              </span>
            )}
          </div>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm">
            <CheckIcon className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {/* Apply button */}
        <button
          onClick={handleApplyPriorities}
          disabled={isApplying || tasks.length === 0 || hasApplied}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all ${
            hasApplied
              ? 'bg-green-100 text-green-700 cursor-default'
              : isApplying
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
          }`}
        >
          {isApplying ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : hasApplied ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Applied!
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              Apply Priorities
            </>
          )}
        </button>
      </div>

      {/* View Header */}
      <ViewHeader
        viewType={viewType}
        onViewChange={setViewType}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        displayProperties={displayProperties}
        onDisplayPropertiesChange={handleDisplayPropertyChange}
        onRefresh={loadTasks}
        isLoading={isLoading}
        taskCount={tasks.length}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List/Board Area */}
        <div className={`flex-1 overflow-auto ${selectedTask ? '' : ''}`}>
          {error && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <ArrowPathIcon className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-sm text-gray-500">Analyzing tasks...</p>
              </div>
            </div>
          ) : (
            <>
              {/* List View */}
              {viewType === 'list' && (
                <div>
                  {groupBy === 'none' ? (
                    tasks.map((task) => (
                      <ListViewRow
                        key={task.task_id || task.id}
                        task={task}
                        displayProperties={displayProperties}
                        isSelected={selectedTasks.includes(task.task_id || task.id)}
                        onSelect={(selected) => handleSelectTask(task.task_id || task.id, selected)}
                        onClick={() => handleTaskClick(task)}
                        onPriorityChange={handlePriorityChange}
                        onStateChange={handleStateChange}
                      />
                    ))
                  ) : (
                    Object.entries(groupedTasks).map(([key, groupTasks]) => {
                      const config = getGroupConfig(key);
                      return (
                        <ListViewGroup
                          key={key}
                          groupKey={key}
                          groupLabel={config.label}
                          groupColor={config.color}
                          tasks={groupTasks}
                          displayProperties={displayProperties}
                          selectedTasks={selectedTasks}
                          onSelectTask={handleSelectTask}
                          onTaskClick={handleTaskClick}
                          onPriorityChange={handlePriorityChange}
                          onStateChange={handleStateChange}
                        />
                      );
                    })
                  )}
                </div>
              )}

              {/* Kanban View */}
              {viewType === 'kanban' && (
                <div className="flex gap-4 p-4 h-full overflow-x-auto">
                  {groupBy === 'priority' ? (
                    Object.entries(PRIORITIES).map(([key, config]) => (
                      <KanbanColumn
                        key={key}
                        columnKey={key}
                        columnLabel={config.label}
                        columnColor={config.color}
                        tasks={groupedTasks[key] || []}
                        displayProperties={displayProperties}
                        selectedTasks={selectedTasks}
                        onTaskClick={handleTaskClick}
                      />
                    ))
                  ) : groupBy === 'state' ? (
                    Object.entries(STATES).map(([key, config]) => (
                      <KanbanColumn
                        key={key}
                        columnKey={key}
                        columnLabel={config.label}
                        columnColor={config.color}
                        tasks={groupedTasks[key] || []}
                        displayProperties={displayProperties}
                        selectedTasks={selectedTasks}
                        onTaskClick={handleTaskClick}
                      />
                    ))
                  ) : (
                    Object.entries(groupedTasks).map(([key, groupTasks]) => {
                      const config = getGroupConfig(key);
                      return (
                        <KanbanColumn
                          key={key}
                          columnKey={key}
                          columnLabel={config.label || key}
                          columnColor={config.color || '#6b7280'}
                          tasks={groupTasks}
                          displayProperties={displayProperties}
                          selectedTasks={selectedTasks}
                          onTaskClick={handleTaskClick}
                        />
                      );
                    })
                  )}
                </div>
              )}

              {/* Spreadsheet View */}
              {viewType === 'spreadsheet' && (
                <SpreadsheetView
                  tasks={tasks}
                  displayProperties={displayProperties}
                  selectedTasks={selectedTasks}
                  onSelectTask={handleSelectTask}
                  onTaskClick={handleTaskClick}
                  onPriorityChange={handlePriorityChange}
                />
              )}

              {/* Calendar View - Simplified */}
              {viewType === 'calendar' && (
                <div className="p-4">
                  <p className="text-sm text-gray-500 text-center py-8">
                    Calendar view coming soon...
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Task Detail Sidebar */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <TaskDetailSidebar
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onPriorityChange={handlePriorityChange}
                onStateChange={handleStateChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
