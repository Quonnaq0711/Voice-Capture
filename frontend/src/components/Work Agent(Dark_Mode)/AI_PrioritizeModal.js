import { useState, useCallback, useEffect, useMemo } from "react";
import { taskPrioritization } from "../../services/workApi";
import TaskCard from './Utils/TaskCard';
import ScheduleDayCard from "./Utils/ScheduleDayCard";
import { Reorder, useDragControls } from "framer-motion";
import { dayOptions, PRIORITIES, SourceBadge } from './Configs/AI_PriorityConfigs';
import {
  X, Sparkles, Clock, Calendar, AlertTriangle, CheckCircle2,
   ArrowUpDown, Loader2, RefreshCw,
  AlertCircle, Info, Timer, GripVertical, Target, BarChart3
} from 'lucide-react';

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


  if (!isOpen) return null;

    return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-sky-950 border border-white/[0.07] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] bg-white/[0.03]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/[0.07] rounded-xl">
              <Sparkles className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-200">AI Task Prioritization</h2>
              <p className="text-sm text-slate-500">
                {step === 'settings' && 'Configure your work preferences'}
                {step === 'analyzing' && 'AI is analyzing your tasks...'}
                {step === 'results' && (
                  <>
                    {results?.prioritized_tasks?.length || 0} tasks prioritized
                    {results?.method && results.method !== 'full_llm' && (
                      <span className="ml-2 text-xs bg-white/[0.07] text-slate-400 px-1.5 py-0.5 rounded">
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
            className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400/70 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300/80">Error</p>
                <p className="text-sm text-red-400/60">{error}</p>
              </div>
            </div>
          )}

          {/* Settings Step */}
          {step === 'settings' && (
            <div className="space-y-8 max-w-2xl mx-auto">

              {/* Task Scope */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-slate-500" />
                  Task Scope
                </h3>
                <label className="flex items-center gap-4 p-4 border border-white/[0.07] bg-white/[0.02] rounded-xl cursor-pointer hover:border-blue-400/25 hover:bg-blue-500/[0.04] transition-all">
                  <input
                    type="checkbox"
                    checked={includeTriage}
                    onChange={(e) => setIncludeTriage(e.target.checked)}
                    className="w-5 h-5 rounded accent-blue-400"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-300">Include Extracted Tasks</p>
                    <p className="text-xs text-slate-500">Also analyze AI-extracted tasks from emails and calendar</p>
                  </div>
                </label>
              </div>

              {/* Work Preferences */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Work Preferences
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Hours per day', value: workHoursPerDay, setter: (v) => setWorkHoursPerDay(Number(v)), options: [4,5,6,7,8,9,10,12].map(h => ({ val: h, label: `${h} hours` })) },
                    { label: 'Start time', value: preferredStartTime, setter: setPreferredStartTime, options: ['06:00','07:00','08:00','09:00','10:00','11:00'].map(t => ({ val: t, label: t })) },
                    { label: 'Schedule days', value: scheduleDays, setter: (v) => setScheduleDays(Number(v)), options: [3,5,7,14,21,30].map(d => ({ val: d, label: `${d} days` })) },
                  ].map(({ label, value, setter, options }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
                      <select
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40"
                      >
                        {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Days */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-3">Work days</label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map(({ key, label, full }) => (
                    <button
                      key={key}
                      onClick={() => toggleWorkDay(key)}
                      title={full}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        workDays.includes(key)
                          ? 'bg-blue-500/12 text-blue-300 border border-blue-400/30'
                          : 'bg-white/[0.04] text-slate-500 border border-white/[0.07] hover:bg-white/[0.07] hover:text-slate-400'
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
                <div className="w-20 h-20 border-4 border-white/[0.06] rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-slate-400 animate-pulse" />
              </div>
              <p className="mt-8 text-xl font-semibold text-slate-200">Analyzing Tasks</p>
              <p className="mt-3 text-sm text-slate-500 text-center max-w-md">
                AI is evaluating your tasks based on due dates, descriptions, dependencies, and your work preferences...
              </p>
            </div>
          )}

          {/* Results Step */}
          {step === 'results' && results && (
            <div className="space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard icon={BarChart3}     label="Total Tasks" value={results.summary?.total_tasks || 0}                     colorClass="text-slate-400"      bgClass="bg-white/[0.04]"            />
                <StatCard icon={AlertCircle}   label="Urgent"      value={results.summary?.urgent || 0}                          colorClass="text-red-400/70"     bgClass="bg-red-500/[0.06]"          />
                <StatCard icon={AlertTriangle} label="High"        value={results.summary?.high || 0}                            colorClass="text-orange-400/70"  bgClass="bg-orange-500/[0.06]"       />
                <StatCard icon={Target}        label="Medium"      value={results.summary?.medium || 0}                          colorClass="text-blue-400/70"    bgClass="bg-blue-500/[0.06]"         />
                <StatCard icon={Timer}         label="Est. Hours"  value={`${results.summary?.total_estimated_hours || 0}h`}     colorClass="text-slate-400"      bgClass="bg-white/[0.04]"            />
              </div>

              {/* Warnings */}
              {results.warnings && results.warnings.length > 0 && (
                <div className="bg-amber-500/[0.08] border border-amber-400/20 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-amber-300/80 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Attention Required
                  </h4>
                  <div className="space-y-2">
                    {results.warnings.map((warning, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-amber-400/60">
                        {getWarningIcon(warning.type)}
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prioritized Tasks */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-slate-500" />
                    Prioritized Tasks
                    {hasReordered && (
                      <span className="text-xs bg-amber-500/[0.08] text-amber-300/70 border border-amber-400/20 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        Reordered
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.07] rounded-lg">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          viewMode === 'list' ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        List
                      </button>
                      <button
                        onClick={() => setViewMode('priority')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          viewMode === 'priority' ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        By Priority
                      </button>
                    </div>
                    {/* Reset Order */}
                    {hasReordered && (
                      <button
                        onClick={() => { setOrderedTasks(results.prioritized_tasks); setHasReordered(false); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400/70 hover:text-amber-300/80 hover:bg-amber-400/10 rounded-md transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset Order
                      </button>
                    )}
                    {/* Selection Controls */}
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => toggleAllSelections(true)} className="text-blue-400/70 hover:text-blue-300 font-medium transition-colors">Select All</button>
                      <span className="text-white/20">|</span>
                      <button onClick={() => toggleAllSelections(false)} className="text-slate-500 hover:text-slate-400 transition-colors">None</button>
                    </div>
                  </div>
                </div>

                <div className="border border-white/[0.07] rounded-xl overflow-hidden">
                  {orderedTasks.length > 0 ? (
                    viewMode === 'list' ? (
                      <Reorder.Group
                        axis="y"
                        values={orderedTasks}
                        onReorder={handleReorder}
                        className="divide-y divide-white/[0.05] max-h-80 overflow-auto"
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.05] max-h-80 overflow-auto">
                        {['urgent', 'high', 'medium', 'low'].map(priority => {
                          const tasks = groupedByPriority[priority] || [];
                          const config = PRIORITIES[priority];
                          return (
                            <div key={priority} className="min-h-[200px]">
                              <div className="sticky top-0 px-3 py-2 bg-white/[0.03] border-b border-white/[0.05]">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${config.iconBg}`} />
                                  <span className={`text-xs font-semibold ${config.textColor}`}>{config.label}</span>
                                  <span className="text-xs text-slate-600">({tasks.length})</span>
                                </div>
                              </div>
                              <div className="p-2 space-y-2">
                                {tasks.map((task) => {
                                  const updateEntry = selectedUpdates.find(u => u.taskId === task.task_id);
                                  return (
                                    <div
                                      key={`priority-${task.task_id}`}
                                      className={`p-2 rounded-lg border cursor-pointer hover:bg-white/[0.04] transition-all ${
                                        updateEntry?.selected ? 'border-blue-400/25 bg-blue-500/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'
                                      }`}
                                      onClick={() => toggleTaskSelection(task.task_id)}
                                    >
                                      <p className="text-xs font-medium text-slate-300 line-clamp-2">{task.title}</p>
                                      <div className="flex items-center justify-between mt-2">
                                        <SourceBadge source={task.source} taskType={task.task_type} />
                                        <span className="text-xs text-slate-600">{formatDuration(task.estimated_minutes)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {tasks.length === 0 && (
                                  <p className="text-xs text-slate-600 text-center py-4">No tasks</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-sm text-slate-600">No tasks to prioritize</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Schedule */}
              {results.schedule && Object.keys(results.schedule).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-slate-500" />
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

              {/* Calendar Events */}
              {results.calendar_events && results.calendar_events.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Existing Calendar Events
                    <span className="text-xs font-normal text-slate-600">({results.calendar_events.length})</span>
                  </h3>
                  <div className="border border-white/[0.07] rounded-xl p-4 max-h-40 overflow-auto bg-white/[0.02]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {results.calendar_events.slice(0, 10).map((event, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm p-2 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                          <span className="text-xs text-slate-600 font-mono bg-white/[0.05] px-2 py-0.5 rounded">
                            {event.date?.slice(5)}
                          </span>
                          <span className="text-xs text-slate-600">{event.start}</span>
                          <span className="text-slate-400 truncate flex-1">{event.title}</span>
                        </div>
                      ))}
                    </div>
                    {results.calendar_events.length > 10 && (
                      <p className="text-xs text-slate-600 mt-2 text-center">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-black/[0.15]">
          {step === 'settings' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors">
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                disabled={workDays.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-700/75 hover:bg-blue-700/95 border border-blue-400/30 text-blue-200 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Tasks
              </button>
            </>
          )}

          {step === 'analyzing' && (
            <div className="w-full text-center">
              <span className="text-sm text-slate-500">Please wait while AI analyzes your tasks...</span>
            </div>
          )}

          {step === 'results' && (
            <>
              <button
                onClick={() => setStep('settings')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">
                  {selectedUpdates.filter(u => u.selected).length} of {selectedUpdates.length} selected
                </span>
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors">
                  Close
                </button>
                <button
                  onClick={applyPriorities}
                  disabled={applying || selectedUpdates.filter(u => u.selected).length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700/60 hover:bg-emerald-700/80 border border-emerald-400/25 text-emerald-200 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
