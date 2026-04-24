import { ChevronDown, ChevronUp } from "lucide-react";
import PRIORITIES from '../Configs/AI_PriorityConfigs';
// Schedule Day Card
export default function ScheduleDayCard({ date, tasks, isExpanded, onToggle, formatDuration }) {
  // Parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const dayDate = new Date(year, month - 1, day);
  const isToday = new Date().toDateString() === dayDate.toDateString();
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isToday ? 'border-blue-400/25 bg-blue-500/[0.04]' : 'border-white/[0.07]'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
            isToday ? 'bg-blue-500/20 text-blue-300' : 'bg-white/[0.06] text-slate-500'
          }`}>
            <span className="text-xs font-medium">{dayDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <span className="text-sm font-bold leading-none">{dayDate.getDate()}</span>
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${isToday ? 'text-blue-300/80' : 'text-slate-300'}`}>
              {dayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              {isToday && (
                <span className="ml-2 text-xs bg-blue-500/[0.08] border border-blue-400/20 text-blue-300/80 px-1.5 py-0.5 rounded">
                  Today
                </span>
              )}
            </p>
            <p className="text-xs text-slate-600">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {formatDuration(totalMinutes)}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.05] p-3 space-y-2">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2 rounded-lg border-l-4 bg-white/[0.02] ${
                PRIORITIES[task.priority || 'medium']?.borderColor || 'border-l-slate-500/40'
              }`}
            >
              <div className="text-xs font-mono text-slate-500 bg-white/[0.05] px-2 py-1 rounded">
                {task.suggested_start}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{task.title}</p>
              </div>
              <span className="text-xs text-slate-600 flex-shrink-0">
                {formatDuration(task.estimated_minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};