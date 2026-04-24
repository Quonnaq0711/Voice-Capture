import { PRIORITIES, PriorityChangeIndicator, PriorityBadge, PriorityScoreBar, SourceBadge } from '../Configs/AI_PriorityConfigs';
import {
  Sparkles, Calendar, Timer, GripVertical, Target, ChevronDown, ChevronUp
} from 'lucide-react';

// Task Card (Plane-style with left border)
export default function TaskCard({
  task,
  index,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  formatDuration,
  dragControls,
  isDraggable = false
}) {
  const config = PRIORITIES[task.suggested_priority] || PRIORITIES.medium;
  const priorityChanged = task.original_priority !== task.suggested_priority;

  return (
    <div
      className={`border-l-4 ${config.borderColor} bg-white/[0.02] hover:bg-white/[0.04] transition-colors`}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Drag Handle */}
        {isDraggable && dragControls && (
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-white/[0.06] rounded touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-slate-600" />
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
          className="w-4 h-4 rounded accent-blue-400 flex-shrink-0"
        />

        {/* Order Number */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.06] text-xs font-medium text-slate-500 flex-shrink-0">
          {task.suggested_order || index + 1}
        </div>

        {/* Source Icon */}
        <SourceBadge source={task.source} taskType={task.task_type} />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-300 truncate">{task.title}</p>
          <div className="flex items-center gap-3 mt-1">
            {/* Priority Badge/Change */}
            {priorityChanged ? (
              <PriorityChangeIndicator from={task.original_priority} to={task.suggested_priority} />
            ) : (
              <PriorityBadge priority={task.suggested_priority} />
            )}

            {/* Duration */}
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Timer className="w-3 h-3" />
              {formatDuration(task.estimated_minutes)}
            </span>

            {/* Due Date */}
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-slate-600">
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
          <ChevronUp className="w-4 h-4 text-slate-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-600 flex-shrink-0" />
        )}
      </div>

      {/* Expanded Reasoning */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="ml-14 p-3 bg-blue-500/[0.06] border border-blue-400/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400/70 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-300/80 mb-1">AI Analysis</p>
                <p className="text-sm text-slate-400">{task.reasoning}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-400/[0.12] flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400/60" />
                <span className="text-xs text-slate-500">
                  Score: <strong className="text-slate-400">{Math.round((task.priority_score || 0) * 100)}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-400/60" />
                <span className="text-xs text-slate-500">
                  Est: <strong className="text-slate-400">{formatDuration(task.estimated_minutes)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};