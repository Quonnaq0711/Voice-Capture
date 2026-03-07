/**
 * AI Task Prioritization Modal
 *
 * Enhanced UI following Plane's patterns:
 * - Priority badges with border colors (Plane-style)
 * - Priority score visualization with progress bars
 * - Better task cards with source icons
 * - Improved schedule timeline view
 * - Drag-and-drop task reordering with framer-motion
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Sparkles, Clock, Calendar, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ArrowUpDown, Loader2, RefreshCw,
  AlertCircle, Info, Timer, Mail, MessageSquare,
  Ticket, CalendarDays, User, GripVertical, Zap, Target, BarChart3
} from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { taskPrioritization } from '../../services/workApi';

// ============================================================================
// PLANE-STYLE PRIORITY CONFIGURATION
// ============================================================================

const PRIORITIES = {
  urgent: {
    label: 'Urgent',
    shortLabel: 'P0',
    color: 'red',
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeBorder: 'border-red-200',
    iconBg: 'bg-red-500',
    score: 1.0,
  },
  high: {
    label: 'High',
    shortLabel: 'P1',
    color: 'orange',
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    badgeBg: 'bg-orange-100',
    badgeBorder: 'border-orange-200',
    iconBg: 'bg-orange-500',
    score: 0.75,
  },
  medium: {
    label: 'Medium',
    shortLabel: 'P2',
    color: 'blue',
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-200',
    iconBg: 'bg-blue-500',
    score: 0.5,
  },
  low: {
    label: 'Low',
    shortLabel: 'P3',
    color: 'gray',
    borderColor: 'border-l-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    badgeBg: 'bg-gray-100',
    badgeBorder: 'border-gray-200',
    iconBg: 'bg-gray-400',
    score: 0.25,
  },
};

// Source icons mapping
const SOURCE_CONFIG = {
  gmail: { icon: Mail, color: 'text-red-500', bg: 'bg-red-100', label: 'Gmail' },
  email: { icon: Mail, color: 'text-red-500', bg: 'bg-red-100', label: 'Email' },
  slack: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Slack' },
  jira: { icon: Ticket, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Jira' },
  calendar: { icon: CalendarDays, color: 'text-green-500', bg: 'bg-green-100', label: 'Calendar' },
  manual: { icon: User, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Manual' },
  todo: { icon: CheckCircle2, color: 'text-indigo-500', bg: 'bg-indigo-100', label: 'Todo' },
  extracted: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Extracted' },
};

// Day abbreviations
const dayOptions = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Plane-style Priority Badge
const PriorityBadge = ({ priority, showLabel = true, size = 'sm' }) => {
  const config = PRIORITIES[priority] || PRIORITIES.medium;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded border ${config.badgeBg} ${config.badgeBorder} ${config.textColor} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${config.iconBg}`} />
      {showLabel && config.label}
    </span>
  );
};

// Priority Score Bar (0-1 visualization)
const PriorityScoreBar = ({ score, className = '' }) => {
  const percentage = Math.round((score || 0) * 100);
  const getColor = (score) => {
    if (score >= 0.8) return 'bg-red-500';
    if (score >= 0.6) return 'bg-orange-500';
    if (score >= 0.4) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
    </div>
  );
};

// Source Icon Badge
const SourceBadge = ({ source, taskType }) => {
  const effectiveSource = taskType === 'extracted' ? 'extracted' : (source || 'todo');
  const config = SOURCE_CONFIG[effectiveSource] || SOURCE_CONFIG.todo;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center justify-center w-6 h-6 rounded ${config.bg}`} title={config.label}>
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
    </div>
  );
};

// Priority Change Arrow
const PriorityChangeIndicator = ({ from, to }) => {
  const fromConfig = PRIORITIES[from] || PRIORITIES.medium;
  const toConfig = PRIORITIES[to] || PRIORITIES.medium;
  const isUpgrade = (PRIORITIES[to]?.score || 0) > (PRIORITIES[from]?.score || 0);

  return (
    <div className="flex items-center gap-1.5">
      <span className={`px-1.5 py-0.5 text-xs rounded border line-through opacity-60 ${fromConfig.badgeBg} ${fromConfig.badgeBorder} ${fromConfig.textColor}`}>
        {fromConfig.shortLabel}
      </span>
      <span className={`text-xs ${isUpgrade ? 'text-red-500' : 'text-green-500'}`}>
        {isUpgrade ? '↑' : '↓'}
      </span>
      <span className={`px-1.5 py-0.5 text-xs rounded border font-medium ${toConfig.badgeBg} ${toConfig.badgeBorder} ${toConfig.textColor}`}>
        {toConfig.shortLabel}
      </span>
    </div>
  );
};

// Task Card (Plane-style with left border)
const TaskCard = ({
  task,
  index,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  formatDuration,
  dragControls,
  isDraggable = false
}) => {
  const config = PRIORITIES[task.suggested_priority] || PRIORITIES.medium;
  const priorityChanged = task.original_priority !== task.suggested_priority;

  return (
    <div
      className={`border-l-4 ${config.borderColor} bg-white hover:bg-gray-50 transition-colors`}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Drag Handle */}
        {isDraggable && dragControls && (
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-gray-100 rounded touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
        />

        {/* Order Number */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600 flex-shrink-0">
          {task.suggested_order || index + 1}
        </div>

        {/* Source Icon */}
        <SourceBadge source={task.source} taskType={task.task_type} />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
          <div className="flex items-center gap-3 mt-1">
            {/* Priority Badge/Change */}
            {priorityChanged ? (
              <PriorityChangeIndicator from={task.original_priority} to={task.suggested_priority} />
            ) : (
              <PriorityBadge priority={task.suggested_priority} />
            )}

            {/* Duration */}
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Timer className="w-3 h-3" />
              {formatDuration(task.estimated_minutes)}
            </span>

            {/* Due Date if exists */}
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Priority Score */}
        <div className="w-20 flex-shrink-0 hidden sm:block">
          <PriorityScoreBar score={task.priority_score} />
        </div>

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {/* Expanded Reasoning */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="ml-14 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-800 mb-1">AI Analysis</p>
                <p className="text-sm text-blue-700">{task.reasoning}</p>
              </div>
            </div>
            {/* Priority Score Detail */}
            <div className="mt-3 pt-3 border-t border-blue-100 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700">
                  Score: <strong>{Math.round((task.priority_score || 0) * 100)}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700">
                  Est: <strong>{formatDuration(task.estimated_minutes)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Draggable Task Item wrapper for Reorder
const DraggableTaskItem = ({
  task,
  index,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  formatDuration
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      id={String(task.task_id)}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        zIndex: 50,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <TaskCard
        task={task}
        index={index}
        isSelected={isSelected}
        isExpanded={isExpanded}
        onToggleSelect={onToggleSelect}
        onToggleExpand={onToggleExpand}
        formatDuration={formatDuration}
        dragControls={dragControls}
        isDraggable={true}
      />
    </Reorder.Item>
  );
};

// Summary Stat Card
const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, valueColorClass }) => (
  <div className={`rounded-xl p-4 ${bgClass}`}>
    <div className={`flex items-center gap-2 ${colorClass} mb-2`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${valueColorClass || colorClass}`}>
      {value}
    </p>
  </div>
);

// Schedule Day Card
const ScheduleDayCard = ({ date, tasks, isExpanded, onToggle, formatDuration }) => {
  // Parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const dayDate = new Date(year, month - 1, day);
  const isToday = new Date().toDateString() === dayDate.toDateString();
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  return (
    <div className={`border rounded-lg overflow-hidden ${isToday ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="text-xs font-medium">{dayDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <span className="text-sm font-bold leading-none">{dayDate.getDate()}</span>
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
              {dayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              {isToday && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Today</span>}
            </p>
            <p className="text-xs text-gray-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {formatDuration(totalMinutes)}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 space-y-2">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2 rounded-lg border-l-4 bg-white ${PRIORITIES[task.priority || 'medium']?.borderColor || 'border-l-gray-300'}`}
            >
              <div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {task.suggested_start}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{task.title}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatDuration(task.estimated_minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIPrioritizeModal({
  isOpen,
  onClose,
  userId,
  onPrioritiesApplied
}) {
  // State
  const [step, setStep] = useState('settings'); // 'settings' | 'analyzing' | 'results'
  const [includeTriage, setIncludeTriage] = useState(false);
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [workDays, setWorkDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [preferredStartTime, setPreferredStartTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState(7);

  // Results state
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState([]);
  const [applying, setApplying] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'priority'
  const [orderedTasks, setOrderedTasks] = useState([]);
  const [hasReordered, setHasReordered] = useState(false);

  // Handle task reordering via drag-and-drop
  const handleReorder = useCallback((newOrder) => {
    // Update order numbers based on new positions
    const reorderedTasks = newOrder.map((task, idx) => ({
      ...task,
      suggested_order: idx + 1,
    }));
    setOrderedTasks(reorderedTasks);
    setHasReordered(true);
  }, []);

  // Track whether modal is still mounted to prevent setState after close
  const [aborted, setAborted] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAborted(false);
      setStep('settings');
      setError(null);
      setResults(null);
      setExpandedTask(null);
      setExpandedDays(new Set());
      setSelectedUpdates([]);
      setViewMode('list');
      setOrderedTasks([]);
      setHasReordered(false);
    } else {
      setAborted(true);
    }
  }, [isOpen]);

  // Sync orderedTasks with results
  useEffect(() => {
    if (results?.prioritized_tasks) {
      setOrderedTasks(results.prioritized_tasks);
    }
  }, [results?.prioritized_tasks]);

  // Group tasks by priority for priority view (using orderedTasks)
  const groupedByPriority = useMemo(() => {
    if (!orderedTasks.length) return {};
    return orderedTasks.reduce((acc, task) => {
      const priority = task.suggested_priority || 'medium';
      if (!acc[priority]) acc[priority] = [];
      acc[priority].push(task);
      return acc;
    }, {});
  }, [orderedTasks]);

  // Toggle work day
  const toggleWorkDay = (day) => {
    setWorkDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Toggle schedule day expansion
  const toggleScheduleDay = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Run analysis
  const runAnalysis = async () => {
    setStep('analyzing');
    setError(null);

    try {
      const scheduleStart = new Date();
      const response = await taskPrioritization.analyze({
        userId,
        taskIds: null,
        includeTriage,
        mode: 'ai',
        context: {
          workHoursPerDay,
          workDays,
          preferredStartTime,
          scheduleStartDate: scheduleStart.toISOString().split('T')[0],
          scheduleDays,
        },
      });

      // Guard: don't update state if modal was closed during analysis
      if (aborted) return;

      setResults(response);

      // Pre-select all suggested updates
      const updates = (response.prioritized_tasks || []).map(task => ({
        taskId: task.task_id,
        taskType: task.task_type,
        priority: task.suggested_priority,
        estimatedMinutes: task.estimated_minutes,
        selected: true,
      }));
      setSelectedUpdates(updates);

      // Auto-expand today in schedule
      const today = new Date().toISOString().split('T')[0];
      if (response.schedule?.[today]) {
        setExpandedDays(new Set([today]));
      }

      setStep('results');
    } catch (err) {
      console.error('Prioritization error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to analyze tasks');
      setStep('settings');
    }
  };

  // Toggle task selection
  const toggleTaskSelection = (taskId) => {
    setSelectedUpdates(prev =>
      prev.map(u => u.taskId === taskId ? { ...u, selected: !u.selected } : u)
    );
  };

  // Select/deselect all
  const toggleAllSelections = (selected) => {
    setSelectedUpdates(prev => prev.map(u => ({ ...u, selected })));
  };

  // Apply priorities - backend already saved during analysis.
  // If user manually reordered via drag-and-drop, persist the new order first.
  const applyPriorities = async () => {
    setApplying(true);
    try {
      if (hasReordered && orderedTasks.length > 0) {
        await taskPrioritization.saveReorder(
          userId,
          orderedTasks.map(t => ({
            taskId: t.task_id,
            suggestedOrder: t.suggested_order,
          }))
        );
      }
      onPrioritiesApplied?.();
      onClose();
    } catch (err) {
      console.error('Failed to save reorder:', err);
      setError(err.message || 'Failed to save task order');
    } finally {
      setApplying(false);
    }
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get warning icon
  const getWarningIcon = (type) => {
    switch (type) {
      case 'overdue': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'overload': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'conflict': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'deadline': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 via-blue-50 to-purple-50">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-purple-200">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Task Prioritization</h2>
              <p className="text-sm text-gray-500">
                {step === 'settings' && 'Configure your work preferences'}
                {step === 'analyzing' && 'AI is analyzing your tasks...'}
                {step === 'results' && (
                  <>
                    {results?.prioritized_tasks?.length || 0} tasks prioritized
                    {results?.method && results.method !== 'full_llm' && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {results.method === 'cached' ? 'from cache' : results.method === 'heuristic' ? 'instant' : results.method === 'batch_llm' ? 'parallel AI' : 'incremental'}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Settings Step */}
          {step === 'settings' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              {/* Task Scope */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Task Scope
                </h3>
                <label className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 transition-all">
                  <input
                    type="checkbox"
                    checked={includeTriage}
                    onChange={(e) => setIncludeTriage(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Include Extracted Tasks</p>
                    <p className="text-xs text-gray-500">Also analyze AI-extracted tasks from emails and calendar</p>
                  </div>
                </label>
              </div>

              {/* Work Preferences */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  Work Preferences
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Hours per day</label>
                    <select
                      value={workHoursPerDay}
                      onChange={(e) => setWorkHoursPerDay(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {[4, 5, 6, 7, 8, 9, 10, 12].map(h => (
                        <option key={h} value={h}>{h} hours</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Start time</label>
                    <select
                      value={preferredStartTime}
                      onChange={(e) => setPreferredStartTime(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Schedule days</label>
                    <select
                      value={scheduleDays}
                      onChange={(e) => setScheduleDays(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {[3, 5, 7, 14, 21, 30].map(d => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Work Days */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-3">Work days</label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map(({ key, label, full }) => (
                    <button
                      key={key}
                      onClick={() => toggleWorkDay(key)}
                      title={full}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        workDays.includes(key)
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 shadow-sm'
                          : 'bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-purple-500 animate-pulse" />
              </div>
              <p className="mt-8 text-xl font-semibold text-gray-900">Analyzing Tasks</p>
              <p className="mt-3 text-sm text-gray-500 text-center max-w-md">
                AI is evaluating your tasks based on due dates, descriptions, dependencies, and your work preferences...
              </p>
            </div>
          )}

          {/* Results Step */}
          {step === 'results' && results && (
            <div className="space-y-6">
              {/* Summary Cards - Plane Style */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  icon={BarChart3}
                  label="Total Tasks"
                  value={results.summary?.total_tasks || 0}
                  colorClass="text-gray-500"
                  valueColorClass="text-gray-700"
                  bgClass="bg-gray-50"
                />
                <StatCard
                  icon={AlertCircle}
                  label="Urgent"
                  value={results.summary?.urgent || 0}
                  colorClass="text-red-500"
                  valueColorClass="text-red-700"
                  bgClass="bg-red-50"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="High"
                  value={results.summary?.high || 0}
                  colorClass="text-orange-500"
                  valueColorClass="text-orange-700"
                  bgClass="bg-orange-50"
                />
                <StatCard
                  icon={Target}
                  label="Medium"
                  value={results.summary?.medium || 0}
                  colorClass="text-blue-500"
                  valueColorClass="text-blue-700"
                  bgClass="bg-blue-50"
                />
                <StatCard
                  icon={Timer}
                  label="Est. Hours"
                  value={`${results.summary?.total_estimated_hours || 0}h`}
                  colorClass="text-purple-500"
                  valueColorClass="text-purple-700"
                  bgClass="bg-purple-50"
                />
              </div>

              {/* Warnings */}
              {results.warnings && results.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Attention Required
                  </h4>
                  <div className="space-y-2">
                    {results.warnings.map((warning, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                        {getWarningIcon(warning.type)}
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prioritized Tasks - with view toggle */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-purple-500" />
                    Prioritized Tasks
                    {hasReordered && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        Reordered
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        List
                      </button>
                      <button
                        onClick={() => setViewMode('priority')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          viewMode === 'priority' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        By Priority
                      </button>
                    </div>
                    {/* Reset Order Button */}
                    {hasReordered && (
                      <button
                        onClick={() => {
                          setOrderedTasks(results.prioritized_tasks);
                          setHasReordered(false);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset Order
                      </button>
                    )}
                    {/* Selection Controls */}
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => toggleAllSelections(true)}
                        className="text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => toggleAllSelections(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        None
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {orderedTasks.length > 0 ? (
                    viewMode === 'list' ? (
                      // List View with Drag-and-Drop
                      <Reorder.Group
                        axis="y"
                        values={orderedTasks}
                        onReorder={handleReorder}
                        className="divide-y divide-gray-100 max-h-80 overflow-auto"
                        layoutScroll
                      >
                        {orderedTasks.map((task, idx) => {
                          const updateEntry = selectedUpdates.find(u => u.taskId === task.task_id);
                          return (
                            <DraggableTaskItem
                              key={task.task_id}
                              task={task}
                              index={idx}
                              isSelected={updateEntry?.selected || false}
                              isExpanded={expandedTask === task.task_id}
                              onToggleSelect={() => toggleTaskSelection(task.task_id)}
                              onToggleExpand={() => setExpandedTask(expandedTask === task.task_id ? null : task.task_id)}
                              formatDuration={formatDuration}
                            />
                          );
                        })}
                      </Reorder.Group>
                    ) : (
                      // Priority Grouped View (Kanban-like)
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100 max-h-80 overflow-auto">
                        {['urgent', 'high', 'medium', 'low'].map(priority => {
                          const tasks = groupedByPriority[priority] || [];
                          const config = PRIORITIES[priority];
                          return (
                            <div key={priority} className="min-h-[200px]">
                              <div className={`sticky top-0 px-3 py-2 ${config.bgColor} border-b border-gray-100`}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full ${config.iconBg}`} />
                                  <span className={`text-xs font-semibold ${config.textColor}`}>
                                    {config.label}
                                  </span>
                                  <span className="text-xs text-gray-400">({tasks.length})</span>
                                </div>
                              </div>
                              <div className="p-2 space-y-2">
                                {tasks.map((task) => {
                                  const updateEntry = selectedUpdates.find(u => u.taskId === task.task_id);
                                  return (
                                    <div
                                      key={`priority-${task.task_id}`}
                                      className={`p-2 bg-white rounded-lg border ${
                                        updateEntry?.selected ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200'
                                      } cursor-pointer hover:shadow-sm transition-all`}
                                      onClick={() => toggleTaskSelection(task.task_id)}
                                    >
                                      <p className="text-xs font-medium text-gray-900 line-clamp-2">{task.title}</p>
                                      <div className="flex items-center justify-between mt-2">
                                        <SourceBadge source={task.source} taskType={task.task_type} />
                                        <span className="text-xs text-gray-400">{formatDuration(task.estimated_minutes)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {tasks.length === 0 && (
                                  <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-sm text-gray-500">No tasks to prioritize</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule - Enhanced Timeline View */}
              {results.schedule && Object.keys(results.schedule).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    Suggested Schedule
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(results.schedule).map(([date, tasks]) => (
                      <ScheduleDayCard
                        key={date}
                        date={date}
                        tasks={tasks}
                        isExpanded={expandedDays.has(date)}
                        onToggle={() => toggleScheduleDay(date)}
                        formatDuration={formatDuration}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar Events - Compact View */}
              {results.calendar_events && results.calendar_events.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Existing Calendar Events
                    <span className="text-xs font-normal text-gray-400">({results.calendar_events.length})</span>
                  </h3>
                  <div className="border border-gray-200 rounded-xl p-4 max-h-40 overflow-auto bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {results.calendar_events.slice(0, 10).map((event, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm p-2 bg-white rounded-lg">
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {event.date?.slice(5)}
                          </span>
                          <span className="text-xs text-gray-400">{event.start}</span>
                          <span className="text-gray-700 truncate flex-1">{event.title}</span>
                        </div>
                      ))}
                    </div>
                    {results.calendar_events.length > 10 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        + {results.calendar_events.length - 10} more events
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === 'settings' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                disabled={workDays.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-200"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Tasks
              </button>
            </>
          )}

          {step === 'analyzing' && (
            <div className="w-full text-center">
              <span className="text-sm text-gray-500">Please wait while AI analyzes your tasks...</span>
            </div>
          )}

          {step === 'results' && (
            <>
              <button
                onClick={() => setStep('settings')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {selectedUpdates.filter(u => u.selected).length} of {selectedUpdates.length} selected
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={applyPriorities}
                  disabled={applying || selectedUpdates.filter(u => u.selected).length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-200"
                >
                  {applying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Apply Priorities
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
