import {
  useState,
  useRef,
  useCallback,
  useContext,
  createContext,
} from "react";
import DatePicker from "react-datepicker";
import { ChevronDownIcon, XMarkIcon, ExclamationTriangleIcon, SparklesIcon, ArrowRightIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import TriageRow, { TRIAGE_COLUMNS } from "./IncomingRowDetail";

import { taskExtraction } from "../../services/workApi";
import inboxIcon from "../../assets/mail-in1.png";

// ─── Shared context (consumed by ScheduleView too) ────────────────────────────

export const SharedTasksContext = createContext({
  tasks: [],
  setTasks: () => {},
  refreshTasks: () => {},
});

// ─── Column header labels ─────────────────────────────────────────────────────

const COL_HEADERS = ["DATE", "SOURCE", "ACCOUNT", "TASK", "ACTIONS"];

// ============================================================================
// HELPERS
// ============================================================================

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Helper to add days to a date
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Date range preset options for extraction settings
  const DATE_RANGE_PRESETS = [
    { id: 'today', label: 'Today', getDates: () => ({ start: formatDate(new Date()), end: formatDate(new Date()) }) },
    { id: 'yesterday', label: 'Yesterday', getDates: () => ({ start: formatDate(addDays(new Date(), -1)), end: formatDate(addDays(new Date(), -1)) }) },
    { id: 'last_7_days', label: 'Last 7 days', getDates: () => ({ start: formatDate(addDays(new Date(), -7)), end: formatDate(new Date()) }) },
    { id: 'last_14_days', label: 'Last 14 days', getDates: () => ({ start: formatDate(addDays(new Date(), -14)), end: formatDate(new Date()) }) },
    { id: 'last_30_days', label: 'Last 30 days', getDates: () => ({ start: formatDate(addDays(new Date(), -30)), end: formatDate(new Date()) }) },
    { id: 'this_week', label: 'This week', getDates: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = addDays(now, -dayOfWeek);
      return { start: formatDate(startOfWeek), end: formatDate(now) };
    }},
    { id: 'custom', label: 'Custom range', getDates: () => null },
  ];

// ─── TriageStandalone ─────────────────────────────────────────────────────────
//
// Page-level component. Owns all triage state and passes per-row handlers down
// to <TriageRow> via props. Nothing page-level lives inside TriageRow.

export default function Incoming() {
  const user = useAuth() || { id: 1, name: "Test User" };
  const {
    tasks,
    setTasks,
    refreshTasks: sharedRefreshTasks,
  } = useContext(SharedTasksContext);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTriageTask, setSelectedTriageTask] = useState(null);
  const [triageActionLoading, setTriageActionLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [extractedTasks, setExtractedTasks] = useState([]);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionSummary, setExtractionSummary] = useState(null);
  const [showExtractionSettings, setShowExtractionSettings] = useState(false);  
  const [extractionSettings, setExtractionSettings] = useState({});


  const [extractedTasksPage, setExtractedTasksPage] = useState(1);
  const [extractedTasksTotal, setExtractedTasksTotal] = useState(0);
  const [extractedTasksPendingCount, setExtractedTasksPendingCount] = useState(0);
  const [extractedTasksTotalPages, setExtractedTasksTotalPages] = useState(1);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [accountsMissingTasksScope, setAccountsMissingTasksScope] = useState([]);
  const [extractionError, setExtractionError] = useState();
  const [lastExtractionTime, setLastExtractionTime] = useState(null);
  const EXTRACTED_TASKS_PAGE_SIZE = 10;

  const extractionSettingsRef = useRef(null);
  const pagesCache = useRef(new Map());
  const triageActionInFlightRef = useRef(new Set());
  const extractionInProgress = useRef(false); // Ref for deduplication
  // const lastExtractionTime = useRef(null); // Ref to track last extraction time for cooldown
  const settingsChangedSinceExtraction = useRef(false); // Ref to track if settings changed since last extraction

  const filteredExtractedTasks = extractedTasks.filter(
    (task) =>
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const clearPagesCache = () => pagesCache.current.clear();

  const transformTask = (task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    ai_summary: task.ai_summary,
    priority: task.priority || "medium",
    status: task.status || "pending",
    added_todo_id: task.added_todo_id,
    due_date: task.due_date,
    category: task.source_type,
    source: task.source_type,
    source_id: task.source_id,
    source_subject: task.source_subject,
    source_account: task.source_account,
    source_date: task.source_date,
    confidence: task.confidence,
    isExtracted: true,
    extracted_at: task.extracted_at,
  });

  const prefetchPage = async (page) => {
    const cacheKey = `page-${page}`;
    if (pagesCache.current.has(cacheKey) || page < 1) return;
    try {
      const settings = extractionSettingsRef.current;
      const response = await taskExtraction.getExtracted(user.id, {
        startDate: settings?.email?.startDate,
        endDate: settings?.email?.endDate,
        page,
        pageSize: EXTRACTED_TASKS_PAGE_SIZE,
      });
      pagesCache.current.set(cacheKey, {
        tasks: (response.items || []).map(transformTask),
        page: response.page,
        total: response.total,
        pendingCount: response.pending_count ?? response.total,
        totalPages: response.total_pages,
      });
    } catch {
      // silently ignore prefetch errors
    }
  };

  const prefetchAdjacentPages = (currentPage, totalPages) => {
    if (currentPage < totalPages) prefetchPage(currentPage + 1);
    if (currentPage > 1) prefetchPage(currentPage - 1);
  };

  const loadExtractedTasks = async (page = extractedTasksPage, options = {}) => {
    const { skipCache = false, showLoading = true } = options;
    const cacheKey = `page-${page}`;

    if (!skipCache && pagesCache.current.has(cacheKey)) {
      const cached = pagesCache.current.get(cacheKey);
      setExtractedTasks(cached.tasks);
      setExtractedTasksPage(cached.page);
      setExtractedTasksTotal(cached.total);
      setExtractedTasksPendingCount(cached.pendingCount);
      setExtractedTasksTotalPages(cached.totalPages);
      return;
    }

    try {
      if (showLoading) setPaginationLoading(true);
      const settings = extractionSettingsRef.current;
      const response = await taskExtraction.getExtracted(user.id, {
        startDate: settings?.email?.startDate,
        endDate: settings?.email?.endDate,
        page,
        pageSize: EXTRACTED_TASKS_PAGE_SIZE,
      });

      const transformed = (response.items || []).map(transformTask);
      pagesCache.current.set(cacheKey, {
        tasks: transformed,
        page: response.page,
        total: response.total,
        pendingCount: response.pending_count ?? response.total,
        totalPages: response.total_pages,
      });

      setExtractedTasks(transformed);
      setExtractedTasksPage(response.page);
      setExtractedTasksTotal(response.total);
      setExtractedTasksPendingCount(response.pending_count ?? response.total);
      setExtractedTasksTotalPages(response.total_pages);
      prefetchAdjacentPages(response.page, response.total_pages);
    } catch (err) {
      console.error("Error loading extracted tasks:", err);
    } finally {
      if (showLoading) setPaginationLoading(false);
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await sharedRefreshTasks();
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [sharedRefreshTasks]);

  const handleAddExtractedTask = async (extractedTask) => {
    if (triageActionInFlightRef.current.has(extractedTask.id)) return;
    triageActionInFlightRef.current.add(extractedTask.id);
    try {
      setTriageActionLoading(true);
      const result = await taskExtraction.addToTodos(extractedTask.id, user.id);
      if (result.success) {
        setExtractedTasks((prev) =>
          prev.map((t) =>
            t.id === extractedTask.id
              ? { ...t, status: "added", added_todo_id: result.todo_id }
              : t,
          ),
        );
        setSelectedTriageTask((prev) =>
          prev?.id === extractedTask.id
            ? { ...prev, status: "added", added_todo_id: result.todo_id }
            : prev,
        );
        if (!result.already_added) {
          setExtractedTasksPendingCount((prev) => Math.max(0, prev - 1));
          result.todo ? setTasks((prev) => [result.todo, ...prev]) : fetchTasks();
        }
        clearPagesCache();
      }
    } catch (err) {
      console.error("Error adding extracted task:", err);
    } finally {
      triageActionInFlightRef.current.delete(extractedTask.id);
      setTriageActionLoading(false);
    }
  };

  const handleRevertExtractedTask = async (todoId, extractedTaskId = null) => {
    const dedupKey = `revert-${todoId}`;
    if (triageActionInFlightRef.current.has(dedupKey)) return;
    triageActionInFlightRef.current.add(dedupKey);
    try {
      setTriageActionLoading(true);
      const result = await taskExtraction.revert(todoId, user.id);
      if (result.success) {
        const resolvedId = extractedTaskId || result.extracted_task_id;
        const revertFields = { status: "pending", added_todo_id: null };
        setExtractedTasks((prev) =>
          prev.map((t) => (t.id === resolvedId ? { ...t, ...revertFields } : t)),
        );
        setSelectedTriageTask((prev) =>
          prev?.id === resolvedId ? { ...prev, ...revertFields } : prev,
        );
        setExtractedTasksPendingCount((prev) => prev + 1);
        setTasks((prev) => prev.filter((t) => t.id !== todoId));
        clearPagesCache();
      }
    } catch (err) {
      console.error("Error reverting extracted task:", err);
    } finally {
      triageActionInFlightRef.current.delete(dedupKey);
      setTriageActionLoading(false);
    }
  };

  const handleDismissExtractedTask = async (taskId) => {
    if (triageActionInFlightRef.current.has(taskId)) return;
    triageActionInFlightRef.current.add(taskId);
    try {
      setTriageActionLoading(true);
      setSelectedTriageTask((prev) => (prev?.id === taskId ? null : prev));
      await taskExtraction.dismiss(taskId, user.id);
      clearPagesCache();
      const isLastItemOnPage =
        extractedTasks.filter((t) => t.status === "pending" && t.id !== taskId).length === 0;
      const targetPage =
        isLastItemOnPage && extractedTasksPage > 1
          ? extractedTasksPage - 1
          : extractedTasksPage;
      await loadExtractedTasks(targetPage, { skipCache: true });
    } catch (err) {
      console.error("Error dismissing task:", err);
    } finally {
      triageActionInFlightRef.current.delete(taskId);
      setTriageActionLoading(false);
    }
  };

  // Extract tasks from emails using LLM (incremental + smart caching)
    // Past dates: instant from DB cache (emails are immutable once sent)
    // Today: always re-scanned (new emails arrive throughout the day)
    const extractTasksFromSources = async () => {
      // Deduplicate: skip if extraction is already in progress
      if (extractionInProgress.current) {
        console.log('Extraction already in progress, skipping duplicate request');
        return;
      }
  
      // Skip if extracted recently (cooldown: 30 seconds) unless settings changed
      if (!settingsChangedSinceExtraction.current && lastExtractionTime && (new Date() - lastExtractionTime) < 30000) {
        console.log('Extraction on cooldown, skipping');
        return;
      }
  
      let bgPolling = false;
      try {
        extractionInProgress.current = true;
        setExtractionLoading(true);
        setExtractionError(null);
  
        // Read from ref to always get latest settings (avoids stale closure issues)
        const settings = extractionSettingsRef.current;
        console.log(`🔍 Extracting: ${settings.email.startDate} to ${settings.email.endDate}`);
  
        const result = await taskExtraction.extract({
          sources: settings.sources,
          emailStartDate: settings.email.startDate,
          emailEndDate: settings.email.endDate,
          emailAccountIds: settings.selectedAccounts?.email || null,
        }, user?.id || 1);
  
        // If result is from cache with no new tasks, reload from DB instead of overwriting
        // This prevents a race condition where extract returns stale/empty results
        // and overwrites tasks that loadExtractedTasks already displayed
        if (result.from_cache && (result.new_tasks_count || 0) === 0) {
          clearPagesCache();
          await loadExtractedTasks(1, { skipCache: true, showLoading: false });
        } else {
          // Clear cache for fresh data
          clearPagesCache();
  
          // Use extract result directly (includes first page of paginated data)
          // This avoids an extra API call to getExtracted
          const transformed = (result.tasks || []).map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            ai_summary: task.ai_summary,
            priority: task.priority || 'medium',
            status: task.status || 'pending',
            added_todo_id: task.added_todo_id,
            due_date: task.due_date,
            category: task.source_type,
            source: task.source_type,
            source_id: task.source_id,
            source_subject: task.source_subject,
            source_account: task.source_account,
            source_date: task.source_date,
            confidence: task.confidence,
            isExtracted: true,
            extracted_at: task.extracted_at,
          }));
  
          // Set state directly from extract result
          const pendingCount = result.pending_count ?? result.total ?? transformed.length;
          setExtractedTasks(transformed);
          setExtractedTasksPage(result.page || 1);
          setExtractedTasksTotal(result.total || transformed.length);
          setExtractedTasksPendingCount(pendingCount);
          setExtractedTasksTotalPages(result.total_pages || 1);
  
          // Cache the first page
          pagesCache.current.set('page-1', {
            tasks: transformed,
            page: 1,
            total: result.total || transformed.length,
            pendingCount,
            totalPages: result.total_pages || 1,
          });
  
          // Prefetch page 2 in the background for faster navigation
          const totalPages = result.total_pages || 1;
          if (totalPages > 1) {
            prefetchPage(2);
          }
        }
  
        setLastExtractionTime(new Date());
        settingsChangedSinceExtraction.current = false;
  
        // Track accounts that need re-authorization for Google Tasks
        if (result.accounts_missing_tasks_scope?.length > 0) {
          setAccountsMissingTasksScope(result.accounts_missing_tasks_scope);
          console.log('Accounts missing Tasks scope:', result.accounts_missing_tasks_scope);
        } else {
          setAccountsMissingTasksScope([]);
        }
  
        // Log extraction results with 3-stage filtering stats
        const { emails = 0, events = 0, new_emails = 0, new_events = 0, google_tasks = 0, emails_filtered = 0, emails_low_priority = 0 } = result.sources_analyzed;
  
        // Log filter pipeline stats if available
        if (result.filter_stats) {
          const fs = result.filter_stats;
          console.log(`📧 Email Filtering Pipeline:
    Total input: ${fs.total_input}
    Stage 1 (blacklist filtered): ${fs.stage1_filtered}
    Stage 2 (actionable): ${fs.stage2_actionable}
    Stage 2 (maybe): ${fs.stage2_maybe}
    Stage 2 (skipped): ${fs.stage2_skipped}
    Final for LLM: ${fs.final_for_llm}`);
        }
  
        // Log if results are from cache
        if (result.from_cache) {
          console.log(`📦 Results from cache (no new extraction needed)`);
        }
  
        console.log(`✅ Extraction complete (${new_emails} new emails, ${new_events} new events, ${google_tasks} Google Tasks) in ${result.extraction_time}s`);
  
        // Handle background extraction (large batch offloaded to server)
        // Tasks are saved incrementally — each poll reloads from DB to show new tasks
        if (result.extraction_in_progress) {
          console.log('🔄 Large batch — extraction running in background, polling for completion...');
          setExtractionSummary('Analyzing emails in background...');
          bgPolling = true;  // Prevent finally block from turning off loading
          let lastTaskCount = 0;
          // Poll every 8s until done
          const pollInterval = setInterval(async () => {
            try {
              const status = await taskExtraction.getExtractionStatus(user?.id || 1);
              const currentTasks = status.new_tasks_count || 0;
  
              // Reload from DB if new tasks appeared (incremental loading)
              if (currentTasks > lastTaskCount) {
                lastTaskCount = currentTasks;
                clearPagesCache();
                await loadExtractedTasks(1, { skipCache: true, showLoading: false });
              }
  
              if (status.status === 'done') {
                clearInterval(pollInterval);
                console.log(`✅ Background extraction done: ${currentTasks} new tasks`);
                setExtractionSummary(`Found ${currentTasks} new task${currentTasks !== 1 ? 's' : ''}!`);
                setTimeout(() => setExtractionSummary(null), 5000);
                // Final reload
                clearPagesCache();
                await loadExtractedTasks(1, { skipCache: true, showLoading: false });
                extractionInProgress.current = false;
                setExtractionLoading(false);
              } else if (status.status === 'error') {
                clearInterval(pollInterval);
                console.error('Background extraction failed:', status.progress);
                setExtractionSummary(`Extraction error (${currentTasks} tasks saved before error)`);
                setTimeout(() => setExtractionSummary(null), 8000);
                extractionInProgress.current = false;
                setExtractionLoading(false);
              } else {
                setExtractionSummary(status.progress || 'Analyzing emails...');
              }
            } catch (pollErr) {
              console.warn('Poll error:', pollErr);
            }
          }, 8000);
          // Safety: stop polling after 15 minutes
          setTimeout(() => {
            clearInterval(pollInterval);
            extractionInProgress.current = false;
            setExtractionLoading(false);
          }, 900000);
          return;
        }
  
        // Show extraction summary toast
        const totalTasks = result.total || (result.tasks || []).length;
        const newCount = result.new_tasks_count || 0;
        if (result.from_cache) {
          setExtractionSummary(`No new emails/events. ${totalTasks} existing task${totalTasks !== 1 ? 's' : ''}`);
        } else if (newCount > 0) {
          setExtractionSummary(`Found ${newCount} new task${newCount !== 1 ? 's' : ''}! ${totalTasks} total`);
        } else {
          setExtractionSummary(`All sources already processed. ${totalTasks} existing task${totalTasks !== 1 ? 's' : ''}`);
        }
        setTimeout(() => setExtractionSummary(null), 5000);
      } catch (err) {
        console.error('Error extracting tasks:', err);
        setExtractionError('Failed to extract tasks from sources');
      } finally {
        if (!bgPolling) {
          extractionInProgress.current = false;
          setExtractionLoading(false);
        }
      }
    };

   return (
    <div className="w-full min-h-screen bg-sky-950 overflow-auto">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-[50px] pt-[35px]">
        <span className="text-white text-3xl font-bold font-['Space_Mono']">Work</span>
        <span className="text-white text-base font-['Open_Sans']">Account</span>
      </div>

      {/* ── Section header + controls ── */}
      <div className="flex items-start justify-between px-[50px] mt-8">
        <div>
          <div className="flex items-center gap-2">
            <img src={inboxIcon} alt="Inbox" className="w-6 h-6" />
            <span className="text-white text-sm font-semibold font-['Inter']">Incoming</span>
          </div>
          <p className="text-white/50 text-sm font-['Inter'] mt-1">
            Review and manage AI-discovered tasks from connected sources
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="bg-white/5 rounded-[10px] px-3 py-2 w-56">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent rounded-[10px] text-sm font-['Inter'] w-full placeholder:text-white/30"
            />
          </div>

          {/* AI Extract */}
          <button
            onClick={() => extractTasksFromSources()}
            disabled={extractionLoading}
            className={`group flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              extractionLoading
                ? 'bg-white/10 text-slate-300'
                : 'bg-white/10 text-slate-400 hover:bg-white/30'
            }`}
          >
            {extractionLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-slate-200">Extracting...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4 text-slate-200 group-hover:text-slate-200 transition-colors" />
                <span className="text-slate-200">AI Extract</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-500" />

          {/* Settings Toggle */}
          <button
            onClick={() => setShowExtractionSettings(!showExtractionSettings)}
            className={`p-2 transition-all ${
              showExtractionSettings
                ? 'bg-white/10 text-slate-300'
                : 'bg-white/10 text-slate-400 hover:bg-white/30'
            }`}
            title="Extraction settings"
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showExtractionSettings ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* ── Extraction Settings Popover ── */}
        {showExtractionSettings && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowExtractionSettings(false)} />

            <div className="absolute top-full right-0 mt-2 w-96 bg-sky-950 rounded-xl shadow-2xl border border-white/[0.07] z-50 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white/[0.07] rounded-lg">
                    <SparklesIcon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-300 text-sm">Extraction Settings</h4>
                    <p className="text-xs text-slate-500">Configure AI task extraction</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExtractionSettings(false)}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="p-4 space-y-5">

                {/* Data Sources */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-[10px] font-bold text-slate-500/70 uppercase tracking-widest">Data Sources</h5>
                    {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 0 && (
                      <span className="text-xs text-slate-600">
                        {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length} connected
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Email source row */}
                    <div className={`rounded-xl border transition-all ${
                      extractionSettings.sources.includes('email')
                        ? 'border-blue-400/25 bg-blue-500/[0.06]'
                        : 'border-white/[0.07] bg-white/[0.02]'
                    }`}>
                      <label className="flex items-center gap-3 p-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={extractionSettings.sources.includes('email')}
                          onChange={() => setExtractionSettings(prev => ({
                            ...prev,
                            sources: prev.sources.includes('email')
                              ? prev.sources.filter(s => s !== 'email')
                              : [...prev.sources, 'email']
                          }))}
                          className="w-4 h-4 rounded accent-blue-400 cursor-pointer"
                        />
                        <div className={`p-1.5 rounded-lg transition-colors ${
                          extractionSettings.sources.includes('email') ? 'bg-blue-400/15' : 'bg-white/[0.05]'
                        }`}>
                          <EnvelopeIcon className={`w-4 h-4 transition-colors ${
                            extractionSettings.sources.includes('email') ? 'text-blue-400' : 'text-slate-600'
                          }`} />
                        </div>
                        <span className={`text-sm font-medium transition-colors ${
                          extractionSettings.sources.includes('email') ? 'text-slate-300' : 'text-slate-600'
                        }`}>Email</span>
                        {extractionSettings.sources.includes('email') &&
                          connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 1 && (
                          <ChevronDownIcon className="w-4 h-4 text-slate-500 ml-auto" />
                        )}
                      </label>

                      {/* Sub-accounts */}
                      {extractionSettings.sources.includes('email') &&
                        connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 1 && (
                        <div className="px-3 pb-3">
                          <div className="pt-2 space-y-0.5 max-h-24 overflow-y-auto">
                            {connectedAccounts
                              .filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook')
                              .map(account => {
                                const isSelected = !extractionSettings.selectedAccounts?.email ||
                                  extractionSettings.selectedAccounts.email?.includes(account.id);
                                return (
                                  <label
                                    key={account.id}
                                    className="flex items-center gap-2 py-1.5 px-2 cursor-pointer text-xs hover:bg-white/[0.05] rounded-lg transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        setExtractionSettings(prev => {
                                          const allEmailAccounts = connectedAccounts
                                            .filter(a => a.sourceId === 'gmail' || a.sourceId === 'outlook')
                                            .map(a => a.id);
                                          const currentSelected = prev.selectedAccounts?.email || allEmailAccounts;
                                          let newSelected = e.target.checked
                                            ? [...new Set([...currentSelected, account.id])]
                                            : currentSelected.filter(id => id !== account.id);
                                          if (newSelected.length === 0) {
                                            return {
                                              ...prev,
                                              sources: prev.sources.filter(s => s !== 'email'),
                                              selectedAccounts: { ...prev.selectedAccounts, email: null }
                                            };
                                          }
                                          const isAllSelected = newSelected.length === allEmailAccounts.length;
                                          return {
                                            ...prev,
                                            selectedAccounts: {
                                              ...prev.selectedAccounts,
                                              email: isAllSelected ? null : newSelected
                                            }
                                          };
                                        });
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-blue-400"
                                    />
                                    <span className="text-slate-500 truncate">{account.email}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* No accounts warning */}
                    {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length === 0 && (
                      <div className="flex items-center gap-3 p-3.5 bg-amber-500/[0.08] border border-amber-400/20 rounded-xl">
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-400/70 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-300/80">No accounts connected</p>
                          <p className="text-xs text-amber-400/50 mt-0.5">Connect your email or calendar to extract tasks</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Time Range */}
                <div>
                  <h5 className="text-[10px] font-bold text-slate-500/70 uppercase tracking-widest mb-3">Time Range</h5>

                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {DATE_RANGE_PRESETS.filter(p => ['today', 'last_7_days', 'last_14_days', 'last_30_days'].includes(p.id)).map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          const dates = preset.getDates();
                          setExtractionSettings(prev => ({
                            ...prev,
                            dateRange: { preset: preset.id, startDate: dates.start, endDate: dates.end },
                            email: { startDate: dates.start, endDate: dates.end },
                          }));
                        }}
                        className={`px-2 py-2 text-xs rounded-lg font-medium transition-all ${
                          extractionSettings.dateRange?.preset === preset.id
                            ? 'bg-blue-500/12 text-blue-300 border border-blue-400/30'
                            : 'bg-white/[0.04] text-slate-500 border border-white/[0.07] hover:bg-white/[0.07] hover:text-slate-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1 px-1 tracking-wider uppercase">From</label>
                      <DatePicker
                        selected={extractionSettings.dateRange?.startDate ? new Date(extractionSettings.dateRange.startDate + 'T00:00:00') : new Date()}
                        onChange={(date) => {
                          const dateStr = date ? formatDate(date) : '';
                          setExtractionSettings(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, preset: 'custom', startDate: dateStr },
                            email: { ...prev.email, startDate: dateStr },
                          }));
                        }}
                        dateFormat="MMM d, yyyy"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/10 text-slate-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40"
                        calendarClassName="extraction-datepicker"
                        popperPlacement="bottom-start"
                      />
                    </div>
                    <ArrowRightIcon className="w-4 h-4 text-slate-600 mt-5 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1 px-1 tracking-wider uppercase">To</label>
                      <DatePicker
                        selected={extractionSettings.dateRange?.endDate ? new Date(extractionSettings.dateRange.endDate + 'T00:00:00') : new Date()}
                        onChange={(date) => {
                          const dateStr = date ? formatDate(date) : '';
                          setExtractionSettings(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, preset: 'custom', endDate: dateStr },
                            email: { ...prev.email, endDate: dateStr },
                          }));
                        }}
                        dateFormat="MMM d, yyyy"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/10 text-slate-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40"
                        calendarClassName="extraction-datepicker"
                        popperPlacement="bottom-start"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/[0.15] border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    const defaultDates = DATE_RANGE_PRESETS.find(p => p.id === 'last_7_days').getDates();
                    setExtractionSettings({
                      sources: ['email'],
                      selectedAccounts: { email: null },
                      dateRange: { preset: 'last_7_days', startDate: defaultDates.start, endDate: defaultDates.end },
                      email: { startDate: defaultDates.start, endDate: defaultDates.end },
                    });
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={() => {
                    extractTasksFromSources();
                    setShowExtractionSettings(false);
                  }}
                  disabled={extractionLoading || extractionSettings.sources.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700/75 hover:bg-blue-700/95 border border-blue-400/30 text-blue-200 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {extractionLoading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3.5 h-3.5" />
                      <span>Extract Tasks</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </>
        )}
      </div>

      {/* ── Google Tasks scope warning ── */}
      {accountsMissingTasksScope.length > 0 && (
        <div className="mx-[50px] mt-4 p-3 bg-amber-500/[0.08] border border-amber-400/20 rounded-lg flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-400/70 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300/80">Google Tasks not syncing</p>
            <p className="text-xs text-amber-400/60 mt-1">
              {accountsMissingTasksScope.length === 1
                ? `Account ${accountsMissingTasksScope[0]} needs re-authorization to sync Google Tasks.`
                : `${accountsMissingTasksScope.length} accounts need re-authorization to sync Google Tasks.`}
            </p>
            <p className="text-xs text-amber-400/50 mt-1">
              Go to{" "}
              <span className="font-medium text-amber-300/70">My Account → Applications</span>{" "}
              to disconnect and reconnect your Google account.
            </p>
          </div>
          <button
            onClick={() => setAccountsMissingTasksScope([])}
            className="p-1 hover:bg-amber-400/10 rounded text-amber-400/50 hover:text-amber-400/80 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Column headers ── */}
      <div className={`grid ${TRIAGE_COLUMNS} mx-[50px] mt-5 rounded-md overflow-hidden`}>
        {COL_HEADERS.map((label, i) => (
          <div
            key={label}
            className={`bg-white/10 px-3 py-2 text-white/60 text-xs font-semibold font-['Inter'] tracking-wide ${
              i === COL_HEADERS.length - 1 ? "text-right" : ""
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Task list ── */}
      <div className="mx-[50px] mt-1 flex flex-col gap-0.5">
        {filteredExtractedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-white/50 text-sm">No tasks found. Connect a source to get started.</p>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-lg border border-white/10 transition-colors">
              Connect Source
            </button>
          </div>
        ) : (
          filteredExtractedTasks.map((task) => (
            <TriageRow
              key={task.id}
              task={task}
              isSelected={selectedTriageTask?.id === task.id}
              onClick={() => setSelectedTriageTask(task)}
              onMouseEnter={() => {}}
              onAdd={() => handleAddExtractedTask(task)}
              onDismiss={() => handleDismissExtractedTask(task.id)}
              onRevert={() => handleRevertExtractedTask(task.added_todo_id, task.id)}
              actionLoading={triageActionLoading}
            />
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {extractedTasksTotalPages > 1 && (
        <div className="flex items-center justify-end gap-3 px-[50px] py-5 text-white/40 text-xs">
          <span>{extractedTasksPendingCount} pending</span>
          <button
            disabled={extractedTasksPage <= 1 || paginationLoading}
            onClick={() => loadExtractedTasks(extractedTasksPage - 1)}
            className="px-3 py-1.5 bg-white/10 rounded-md hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span>Page {extractedTasksPage} of {extractedTasksTotalPages}</span>
          <button
            disabled={extractedTasksPage >= extractedTasksTotalPages || paginationLoading}
            onClick={() => loadExtractedTasks(extractedTasksPage + 1)}
            className="px-3 py-1.5 bg-white/10 rounded-md hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Extraction summary toast ── */}
      {extractionSummary && (
        <div className="fixed bottom-6 right-6 bg-sky-900/90 border border-white/10 rounded-xl px-4 py-3 text-white text-sm shadow-xl backdrop-blur-sm">
          {extractionSummary}
        </div>
      )}

    </div>
  );
}