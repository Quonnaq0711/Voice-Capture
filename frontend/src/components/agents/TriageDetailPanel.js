import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  PlusIcon,
  XMarkIcon,
  EnvelopeIcon,
  CalendarIcon,
  CheckCircleIcon,
  TicketIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  SparklesIcon,
  ChevronDoubleRightIcon,
  ArrowUturnLeftIcon,
  EnvelopeOpenIcon,
} from '@heroicons/react/24/outline';
import { taskExtraction, gmail } from '../../services/workApi';
import { useBullets, AISummarySection } from './AISummarySection';
import inboxIcon from '../../assets/mail-in1.png';

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const SOURCE_CONFIGS = {
  email: { icon: EnvelopeIcon, color: 'text-slate-300', label: 'Email' },
  calendar: { icon: CalendarIcon, color: 'text-slate-300', label: 'Calendar' },
  gtask: { icon: CheckCircleIcon, color: 'text-slate-300', label: 'Google Tasks' },
  jira: { icon: TicketIcon, color: 'text-slate-300', label: 'Jira' },
  slack: { icon: ChatBubbleLeftRightIcon, color: 'text-slate-300', label: 'Slack' },
};

const formatDateTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Sanitize HTML email content for iframe srcDoc — defense-in-depth.
 * The iframe sandbox already blocks script execution, but we strip
 * dangerous patterns as an extra layer. We KEEP <style> blocks
 * since they're isolated inside the iframe and needed for proper rendering.
 */
const sanitizeEmailHtml = (html) => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']\/\/([^"']+)["']/gi, 'src="https://$1"')
    .replace(/src\s*=\s*["']http:\/\/([^"']+)["']/gi, 'src="https://$1"');
};

/** Build a complete HTML document for iframe srcDoc */
const buildSrcDoc = (html) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>
body{margin:0;padding:12px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#374151;word-wrap:break-word;overflow-wrap:break-word;}
img{max-width:100%;height:auto;}
table{border-collapse:collapse;max-width:100%;}
td,th{padding:6px;vertical-align:top;}
a{color:#1a73e8;text-decoration:none;}
a:hover{text-decoration:underline;}
blockquote{border-left:3px solid #dadce0;margin:0 0 0 8px;padding-left:12px;color:#6b7280;}
p{margin:0 0 8px 0;}
ul,ol{margin:0 0 8px 0;padding-left:20px;}
hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0;}
</style></head><body>${sanitizeEmailHtml(html)}</body></html>`;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** A single property row — Linear / Notion style key-value */
const PropertyRow = ({ icon: Icon, label, children }) => {
  if (!children) return null;
  return (
    <div className="flex items-start py-2 gap-3">
      <div className="flex items-center gap-2 w-28 flex-shrink-0 pt-0.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

/** Always-visible original email — auto-fetches on mount, renders HTML in sandboxed iframe */
const OriginalEmailSection = React.memo(({ task, connectedAccounts, userId, emailCacheRef }) => {
  const [emailData, setEmailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const accountId = useMemo(() => {
    if (!task.source_account || !connectedAccounts?.length) return null;
    const account = connectedAccounts.find(a => a.email === task.source_account);
    return account?.id || null;
  }, [task.source_account, connectedAccounts]);

  // Auto-fetch on mount — checks hover prefetch cache first for instant loading
  useEffect(() => {
    if (!accountId || !task.source_id || !userId) return;

    // Check prefetch cache first (populated by hover on triage row)
    const cached = emailCacheRef?.current?.get(task.source_id);
    if (cached) {
      setEmailData(cached);
      emailCacheRef.current.delete(task.source_id);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    gmail.getMessage(task.source_id, accountId, userId)
      .then(message => { if (!cancelled) setEmailData(message); })
      .catch(err => {
        console.error('Error fetching original email:', err);
        if (!cancelled) setError('Could not load original email');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, task.source_id, userId, emailCacheRef]);

  // Auto-resize iframe to fit content
  const handleIframeLoad = useCallback((e) => {
    const iframe = e.target;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body) {
        // Observe size changes (images loading, fonts, etc.)
        const resize = () => {
          const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
          iframe.style.height = Math.min(h, 600) + 'px';
        };
        resize();
        // Re-measure after images load
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
          if (!img.complete) img.addEventListener('load', resize, { once: true });
        });
      }
    } catch (err) {
      iframe.style.height = '300px';
    }
  }, []);

  const senderStr = useMemo(() => {
    if (!emailData?.from) return null;
    if (typeof emailData.from === 'object') {
      return emailData.from.name || emailData.from.email || '';
    }
    return String(emailData.from);
  }, [emailData?.from]);

  const emailContent = useMemo(() => {
    if (!emailData) return null;
    const htmlContent = emailData.body_html || '';
    const plainContent = emailData.body_plain || emailData.body || emailData.snippet || '';
    const isHtml = emailData.is_html || Boolean(htmlContent);
    return { isHtml, htmlContent, plainContent };
  }, [emailData]);

  // Don't render if no account mapping
  if (!accountId) return null;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 px-5 py-3">
        <EnvelopeOpenIcon className="w-4 h-4 text-slate-200 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Original Email</span>
        {!emailData && !loading && task.source_subject && (
          <span className="text-xs text-slate-200 truncate ml-1">— {task.source_subject}</span>
        )}  
      </div>

      <div className="px-5 pb-4">
        {loading && (
          <div className="animate-pulse space-y-2 py-2">
            <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            <div className="h-3 bg-slate-200 rounded w-full"></div>
            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
            <div className="h-3 bg-slate-200 rounded w-full"></div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 py-2">{error}</p>
        )}

        {emailData && (
          <div className="rounded-lg overflow-hidden">
            {/* Email header */}
            <div className="px-4 py-3 bg-white/10 space-y-1">
              {senderStr && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-slate-300 uppercase w-12 flex-shrink-0">From</span>
                  <span className="text-sm font-medium text-slate-300 truncate">{senderStr}</span>
                </div>
              )}
              {emailData.subject && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-slate-300 uppercase w-12 flex-shrink-0">Subject</span>
                  <span className="text-sm text-slate-300 truncate">{emailData.subject}</span>
                </div>
              )}
              {emailData.date && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-slate-300 uppercase w-12 flex-shrink-0">Date</span>
                  <span className="text-xs text-slate-300">{formatDateTime(emailData.date)}</span>
                </div>
              )}
            </div>

            {/* Email body */}
            {emailContent?.isHtml && emailContent.htmlContent ? (
              <iframe
                sandbox="allow-same-origin allow-popups"
                srcDoc={buildSrcDoc(emailContent.htmlContent)}
                onLoad={handleIframeLoad}
                title="Original email content"
                className="w-full border-none"
                style={{ minHeight: '80px', maxHeight: '600px' }}
              />
            ) : emailContent?.plainContent ? (
              <div className="px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                {emailContent.plainContent}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-slate-300 italic">No content available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function TriageDetailPanel({ task, onAddToTasks, onDismiss, onRevert, onClose, actionLoading, userId, connectedAccounts, onSummaryGenerated, emailCacheRef }) {
  // AI Summary via shared hook
  const { bullets, bulletsLoading, bulletsError, fetchBullets } = useBullets({
    taskId: task?.id || null,
    aiSummary: task?.ai_summary,
    describeFn: taskExtraction.describe,
    userId,
    onSummaryGenerated,
  });

  if (!task) return null;

  const sourceConfig = SOURCE_CONFIGS[task.source_type || task.source] || SOURCE_CONFIGS.email;
  const SourceIcon = sourceConfig.icon;
  const confidence = task.confidence != null ? Math.round(task.confidence * 100) : null;
  const isAdded = task.status === 'added';
  const isEmail = (task.source_type || task.source) === 'email';

  return (
         
    <div className ="w-44 h-0 left-0 top-[20px] absolute outline outline-1 outline-white">
        <div className="w-8 h-8 left-[180px] top-1 absolute bg-pink-600" />
      <div className="left-[230px] top-[4px] absolute justify-start text-white text-2xl font-bold font-['Space_Mono']">Work</div>
      
      <div className="left-[85px] top-[134px] absolute justify-start text-white text-sm font-semibold font-['Inter']">Incoming</div>
      <img className="w-6 h-6 left-[48px] top-[125px] absolute origin-top-left" src={inboxIcon} Alt="Incoming"/>
      
 

      <div className="h-full flex flex-col bg-sky-950 text-slate-300">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50/50">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-600 hover:bg-white/10 rounded-md transition-colors"
          title="Close panel (Esc)"
        >
          <ChevronDoubleRightIcon className="w-4 h-4" />
          <span>Close</span>
        </button>
        <div className="flex items-center gap-1.5">
          {isAdded ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-400 hover:bg-white/10 rounded-lg">
                <CheckCircleIcon className="w-4 h-4" />
                Added to Backlog
              </span>
              <button
                onClick={() => onRevert?.(task.added_todo_id, task.id)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 rounded-lg hover:bg-white/10 transition-colors"
                title="Undo — return to pending"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" />
                Undo
              </button>
            </>
          ) : (
            <button
              onClick={() => onAddToTasks(task)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-400 rounded-lg hover:bg-white/10 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add to Backlog
            </button>
          )}
          <button
            onClick={() => onDismiss(task.id)}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
            Dismiss
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        {/* Title */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-lg font-semibold text-slate-400 leading-snug">
            {task.title}
          </h2>
        </div>

        {/* Properties table */}
        <div className="px-5 pb-4 bg-sky-950">
          <div >
            {/* Source */}
            <PropertyRow icon={SourceIcon} label="Source">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${sourceConfig.bg} ${sourceConfig.color}`}>
                  <SourceIcon className="w-3.5 h-3.5" />
                  {sourceConfig.label}
                </div>
                {task.source_account && (
                  <span className="text-xs text-slate-400 truncate">{task.source_account}</span>
                )}
              </div>
            </PropertyRow>

            {/* Confidence */}
            {confidence != null && (
              <PropertyRow icon={SparklesIcon} label="Confidence">
                <div className="flex items-center gap-2.5">
                  <div className="w-24 h-2 bg-sky-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        confidence >= 80 ? 'bg-green-500' : confidence >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${
                    confidence >= 80 ? 'text-green-700' : confidence >= 50 ? 'text-yellow-700' : 'text-red-600'
                  }`}>
                    {confidence}%
                  </span>
                </div>
              </PropertyRow>
            )}

            {/* Source Date */}
            {task.source_date && (
              <PropertyRow icon={ClockIcon} label="Source Date">
                <span className="text-sm text-slate-400">{formatDateTime(task.source_date)}</span>
              </PropertyRow>
            )}

            {/* Extracted At */}
            {task.extracted_at && (
              <PropertyRow icon={SparklesIcon} label="Extracted">
                <span className="text-sm text-slate-400">{formatDateTime(task.extracted_at)}</span>
              </PropertyRow>
            )}
          </div>
        </div>

        {/* AI Description — LLM-generated bullet points */}
        <div className="px-5 py-4">
          <AISummarySection
            taskId={task.id}
            bullets={bullets}
            loading={bulletsLoading}
            error={bulletsError}
            fetchBullets={fetchBullets}
            showGenerateButton={false}
          />
        </div>

        {/* Original Email — always visible, auto-fetches */}
        {isEmail && (
          <OriginalEmailSection
            key={task.id}
            task={task}
            connectedAccounts={connectedAccounts}
            userId={userId}
            emailCacheRef={emailCacheRef}
          />
        )}
      </div>
      </div>
      </div>
  
  
  );
}

export default React.memo(TriageDetailPanel);
