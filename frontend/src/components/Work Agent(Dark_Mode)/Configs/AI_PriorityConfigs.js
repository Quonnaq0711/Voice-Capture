import {
    CheckCircle2,
    Mail,
    MessageSquare,
    Ticket,
    CalendarDays,
    User,
    Zap, 
} from 'lucide-react';

export const PRIORITIES = {
  urgent: {
    label: 'Urgent',
    shortLabel: 'P0',
    color: 'red',
    borderColor: 'border-l-red-400/50',
    bgColor: 'bg-red-500/[0.06]',
    textColor: 'text-red-400/80',
    badgeBg: 'bg-red-500/[0.08]',
    badgeBorder: 'border-red-400/20',
    iconBg: 'bg-red-500/40',
    score: 1.0,
  },
  high: {
    label: 'High',
    shortLabel: 'P1',
    color: 'orange',
    borderColor: 'border-l-orange-400/50',
    bgColor: 'bg-orange-500/[0.06]',
    textColor: 'text-orange-400/80',
    badgeBg: 'bg-orange-500/[0.08]',
    badgeBorder: 'border-orange-400/20',
    iconBg: 'bg-orange-500/40',
    score: 0.75,
  },
  medium: {
    label: 'Medium',
    shortLabel: 'P2',
    color: 'blue',
    borderColor: 'border-l-blue-400/50',
    bgColor: 'bg-blue-500/[0.06]',
    textColor: 'text-blue-400/80',
    badgeBg: 'bg-blue-500/[0.08]',
    badgeBorder: 'border-blue-400/20',
    iconBg: 'bg-blue-500/40',
    score: 0.5,
  },
  low: {
    label: 'Low',
    shortLabel: 'P3',
    color: 'gray',
    borderColor: 'border-l-slate-500/40',
    bgColor: 'bg-white/[0.03]',
    textColor: 'text-slate-500',
    badgeBg: 'bg-white/[0.05]',
    badgeBorder: 'border-white/[0.07]',
    iconBg: 'bg-slate-500/40',
    score: 0.25,
  },
};

export const SOURCE_CONFIG = {
  gmail:     { icon: Mail,          color: 'text-red-400/70',    bg: 'bg-red-500/[0.08]',    label: 'Gmail'     },
  email:     { icon: Mail,          color: 'text-red-400/70',    bg: 'bg-red-500/[0.08]',    label: 'Email'     },
  slack:     { icon: MessageSquare, color: 'text-purple-400/70', bg: 'bg-purple-500/[0.08]', label: 'Slack'     },
  jira:      { icon: Ticket,        color: 'text-blue-400/70',   bg: 'bg-blue-500/[0.08]',   label: 'Jira'      },
  calendar:  { icon: CalendarDays,  color: 'text-emerald-400/70',bg: 'bg-emerald-500/[0.08]',label: 'Calendar'  },
  manual:    { icon: User,          color: 'text-orange-400/70', bg: 'bg-orange-500/[0.08]', label: 'Manual'    },
  todo:      { icon: CheckCircle2,  color: 'text-slate-400',     bg: 'bg-white/[0.06]',      label: 'Todo'      },
  extracted: { icon: Zap,           color: 'text-amber-400/70',  bg: 'bg-amber-500/[0.08]',  label: 'Extracted' },
};

export const dayOptions = [
  { key: 'mon', label: 'Mon', full: 'Monday'    },
  { key: 'tue', label: 'Tue', full: 'Tuesday'   },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday'  },
  { key: 'fri', label: 'Fri', full: 'Friday'    },
  { key: 'sat', label: 'Sat', full: 'Saturday'  },
  { key: 'sun', label: 'Sun', full: 'Sunday'    },
];

// Priority Change Arrow
export function PriorityChangeIndicator({ from, to }) {
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

// Source Icon Badge
export function SourceBadge({ source, taskType }) {
  const effectiveSource = taskType === 'extracted' ? 'extracted' : (source || 'todo');
  const config = SOURCE_CONFIG[effectiveSource] || SOURCE_CONFIG.todo;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center justify-center w-6 h-6 rounded ${config.bg}`} title={config.label}>
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
    </div>
  );
};

// Plane-style Priority Badge
export function PriorityBadge({ priority, showLabel = true, size = 'sm' }) {
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
export function PriorityScoreBar({ score, className = '' }) {
  const percentage = Math.round((score || 0) * 100);
  const getColor = (score) => {
    if (score >= 0.8) return 'bg-red-500';
    if (score >= 0.6) return 'bg-orange-500';
    if (score >= 0.4) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-sky-950/95 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
    </div>
  );
};

