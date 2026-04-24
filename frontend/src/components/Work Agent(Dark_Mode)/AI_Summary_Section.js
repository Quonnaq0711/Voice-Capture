/**
 * Shared AI Summary hook and UI component.
 *
 * Used by TaskModal, TaskDetailPanel (WorkAgent.js) and TriageDetailPanel.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Skeleton placeholder (shimmer) while bullets are loading
// ---------------------------------------------------------------------------
const BulletSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-start gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08] mt-2 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-white/[0.05] rounded-md" style={{ width: `${75 + i * 5}%` }} />
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Hook: useBullets
// ---------------------------------------------------------------------------
/**
 * Manages AI-summary bullet state with race-condition-safe fetching.
 *
 * @param {Object}   opts
 * @param {number}   opts.taskId           – Task / ExtractedTask ID
 * @param {string[]} opts.aiSummary        – Cached ai_summary from task object (skip fetch if present)
 * @param {Function} opts.describeFn       – (id, userId, force) => Promise<{success, bullets}>
 * @param {number}   opts.userId           – Current user ID
 * @param {Function} [opts.onSummaryGenerated] – Optional callback(taskId, bullets) after generation
 */
export function useBullets({ taskId, aiSummary, describeFn, userId, onSummaryGenerated }) {
  const [bullets, setBullets] = useState(null);
  const [bulletsLoading, setBulletsLoading] = useState(false);
  const [bulletsError, setBulletsError] = useState(null);
  const fetchIdRef = useRef(0);

  const fetchBullets = useCallback(async (id, force = false) => {
    const fetchId = ++fetchIdRef.current;
    setBulletsLoading(true);
    setBulletsError(null);
    if (force) setBullets(null); // show skeleton immediately on regenerate
    try {
      const result = await describeFn(id, userId || 1, force);
      if (fetchIdRef.current !== fetchId) return; // stale guard
      if (result.success && result.bullets?.length > 0) {
        setBullets(result.bullets);
        onSummaryGenerated?.(id, result.bullets);
      } else {
        setBullets(null);
      }
    } catch (err) {
      if (fetchIdRef.current !== fetchId) return;
      setBulletsError(err?.response?.data?.detail || err.message || 'Failed to generate summary');
    } finally {
      if (fetchIdRef.current === fetchId) setBulletsLoading(false);
    }
  }, [describeFn, userId, onSummaryGenerated]);

  // Auto-load: use cached ai_summary or fetch from backend
  useEffect(() => {
    if (!taskId) {
      setBullets(null);
      setBulletsLoading(false);
      setBulletsError(null);
      return;
    }
    if (aiSummary && aiSummary.length > 0) {
      setBullets(aiSummary);
      setBulletsLoading(false);
      setBulletsError(null);
      return;
    }
    fetchBullets(taskId);
  }, [taskId, aiSummary, fetchBullets]);

  return { bullets, bulletsLoading, bulletsError, fetchBullets };
}

// ---------------------------------------------------------------------------
// Component: AISummarySection
// ---------------------------------------------------------------------------
/**
 * Renders the AI Summary block: header + loading / error / bullets / empty.
 *
 * @param {Object}   props
 * @param {number}   props.taskId
 * @param {string[]} props.bullets
 * @param {boolean}  props.loading
 * @param {string}   props.error
 * @param {Function} props.fetchBullets      – (id, force?) => void
 * @param {boolean}  [props.showGenerateButton=true] – Show "Generate" button when empty (false → shows italic text)
 * @param {boolean}  [props.inForm=false]    – When true, buttons get type="button" to prevent form submission
 */
export function AISummarySection({ taskId, bullets, loading, error, fetchBullets, showGenerateButton = true, inForm = false }) {
  const btnType = inForm ? 'button' : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Summary</h3>
        </div>
        {bullets && !loading && (
          <button
            type={btnType}
            onClick={() => fetchBullets(taskId, true)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] rounded transition-colors"
            title="Regenerate"
          >
            <ArrowPathIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {loading ? (
        <BulletSkeleton />
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{error}</span>
          <button
            type={btnType}
            onClick={() => fetchBullets(taskId)}
            className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded px-1 font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      ) : bullets && bullets.length > 0 ? (
        <ul className="space-y-2.5">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/[0.15] mt-[7px] flex-shrink-0" />
              <span className="text-sm text-slate-400 leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      ) : showGenerateButton ? (
        <button
          type={btnType}
          onClick={() => fetchBullets(taskId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-colors"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Generate AI Summary
        </button>
      ) : (
        <p className="text-sm text-slate-600 italic">No description available</p>
      )}
    </div>
  );
}

export default AISummarySection;