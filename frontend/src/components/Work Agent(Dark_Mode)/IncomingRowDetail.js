import {
  EnvelopeIcon,
  CalendarIcon,
  CheckCircleIcon,
  TicketIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatTriageDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

export const getSourceConfig = (sourceType) => {
  const configs = {
    email:    { icon: EnvelopeIcon,              color: 'text-slate-300', bg: 'bg-white/10', label: 'Email' },
    calendar: { icon: CalendarIcon,              color: 'text-slate-300', bg: 'bg-white/10', label: 'Calendar' },
    gtask:    { icon: CheckCircleIcon,           color: 'text-slate-300', bg: 'bg-white/10', label: 'G-Tasks' },
    jira:     { icon: TicketIcon,                color: 'text-slate-300', bg: 'bg-white/10', label: 'Jira' },
    slack:    { icon: ChatBubbleLeftRightIcon,   color: 'text-slate-300', bg: 'bg-white/10', label: 'Slack' },
  };
  return configs[sourceType] || configs.email;
};

// ─── Column header labels (consumed by both TriageRow and TriageStandalone) ───

export const TRIAGE_COLUMNS = 'grid-cols-[90px_110px_160px_1fr_200px]';

// ─── TriageRow ─────────────────────────────────────────────────────────────────
//
// Renders a single triage row. All state and handlers live in TriageStandalone;
// this component only receives what it needs via props.
//
// Props:
//   task             — extracted task object
//   isSelected       — whether this row is the active/selected row
//   onClick          — called when the row is clicked (select)
//   onMouseEnter     — called on hover (used for email prefetch)
//   onAdd            — called when "Backlog" button is clicked
//   onDismiss        — called when "Dismiss" button is clicked
//   onRevert         — called when "Undo" button is clicked (added → pending)
//   actionLoading    — disables action buttons while a request is in-flight

export default function TriageRow({
  task,
  isSelected,
  onClick,
  onMouseEnter,
  onAdd,
  onDismiss,
  onRevert,
  actionLoading,
}) {
  const sourceConfig = getSourceConfig(task.source_type || task.source);
  const SourceIcon   = sourceConfig.icon;
  const displayDate  = formatTriageDate(task.source_date || task.extracted_at);
  const isAdded      = task.status === 'added';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        group grid ${TRIAGE_COLUMNS} items-center
        px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${isSelected
          ? `bg-purple-500/15 border-l-2 border-purple-500 ${isAdded ? 'opacity-70' : ''}`
          : isAdded
            ? 'bg-green-500/10 opacity-60'
            : 'hover:bg-white/10'
        }
      `}
    >
      {/* ── Date ── */}
      <span className={`text-xs font-medium truncate ${isAdded ? 'text-slate-200' : 'text-slate-300'}`}>
        {displayDate}
      </span>

      {/* ── Source badge ── */}
      <div className="flex items-center">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${sourceConfig.bg}`}>
          <SourceIcon className={`w-3.5 h-3.5 flex-shrink-0 ${sourceConfig.color}`} />
          <span className={`text-xs font-medium ${sourceConfig.color}`}>{sourceConfig.label}</span>
        </div>
      </div>

      {/* ── Account ── */}
      <span
        className={`text-xs truncate ${isAdded ? 'text-slate-300' : 'text-slate-400'}`}
        title={task.source_account}
      >
        {task.source_account || '—'}
      </span>

      {/* ── Task title + "Added" badge ── */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-sm truncate ${isAdded ? 'text-slate-200' : 'text-slate-300'}`}
          title={task.title}
        >
          {task.title}
        </span>

        {isAdded && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
            text-[10px] font-medium bg-green-500/20 text-green-400 flex-shrink-0">
            <CheckCircleIcon className="w-3 h-3" />
            Added to Backlog
          </span>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-1.5">
        {isAdded ? (
          <button
            disabled={actionLoading}
            onClick={(e) => { e.stopPropagation(); onRevert?.(); }}
            title="Undo — return to pending"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium
              text-amber-400 bg-white/10 hover:bg-amber-400/10 rounded-md
              transition-colors disabled:opacity-40"
          >
            <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
            Undo
          </button>
        ) : (
          <>
            <button
              disabled={actionLoading}
              onClick={(e) => { e.stopPropagation(); onAdd?.(); }}
              title="Add to Backlog"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium
                text-green-400 bg-white/10 hover:bg-green-400/10 rounded-md
                transition-colors disabled:opacity-40"
            >
              <PlusIcon className="w-3.5 h-3.5" />
               Add to Backlog
            </button>

            <button
              disabled={actionLoading}
              onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
              title="Dismiss"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium
                text-slate-400 hover:bg-white/10 rounded-md
                transition-colors disabled:opacity-40"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
