import React, { useState, useEffect, useRef } from 'react';
// import { taskExtraction, oauth } from '../../services/workApi';
// import { EXTRACTED_TASKS_PAGE_SIZE } from '../../services/constants';
import {
  // Navigation & Layout
  ChevronDownIcon,
  SparklesIcon,  
  ExclamationTriangleIcon,
  // Sources
  EnvelopeIcon,
  ArrowRightIcon,
  XMarkIcon,
  } from '@heroicons/react/24/outline';
import { oauth, taskExtraction } from '../../services/workApi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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

const PRIORITIES = {
  urgent: { label: 'Urgent', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  high: { label: 'High', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  low: { label: 'Low', color: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  none: { label: 'None', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
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

  
export default function AI_ExtractionSettings({ user, onExtractedTasksChange }) {
    const [connectedAccounts, setConnectedAccounts] = useState([]);
  const extractionSettingsRef = useRef(extractionSettings); // for async access
  const [showExtractionSettings, setShowExtractionSettings] = useState(false);
    const settingsChangedSinceExtraction = useRef(false); // track unsaved changes
    const [extractedTasks, setExtractedTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [extractionSettings, setExtractionSettings] = useState({
        sources: ['email'],
        // Account selection: null means all accounts, array means specific accounts
        selectedAccounts: {
            email: null, // null = all email accounts
        },
        // Date range with preset support
        dateRange: {
            preset: 'last_7_days', // preset id or 'custom'
            startDate: formatDate(addDays(new Date(), -7)),
            endDate: formatDate(new Date()),
        },
        // Legacy fields for backward compatibility
        email: {
            startDate: formatDate(addDays(new Date(), -7)),
            endDate: formatDate(new Date()),
        },
    });

      // Pagination state for extracted tasks
      const [extractedTasksPage, setExtractedTasksPage] = useState(1);
      const [extractedTasksTotal, setExtractedTasksTotal] = useState(0);
      const [extractedTasksPendingCount, setExtractedTasksPendingCount] = useState(0);
      const [extractedTasksTotalPages, setExtractedTasksTotalPages] = useState(1);
      const [paginationLoading, setPaginationLoading] = useState(false);
      const EXTRACTED_TASKS_PAGE_SIZE = 10;
      const extractionInProgress = useRef(false); // Ref for deduplication
    //   const extractionSettingsRef = useRef(null); // Always-latest settings (avoids stale closures)
    //   const settingsChangedSinceExtraction = useRef(false); // Track if user changed settings since last extraction
    const pagesCache = useRef(new Map()); // Cache for paginated data
    
      // Extracted tasks state (from email/calendar)
      const [lastExtractionTime, setLastExtractionTime] = useState(null); // For cooldown timer
      const [extractionLoading, setExtractionLoading] = useState(false);
      const [extractionError, setExtractionError] = useState(null);
      const [extractionSummary, setExtractionSummary] = useState(null); // For showing extraction results summary
      const [accountsMissingTasksScope, setAccountsMissingTasksScope] = useState([]); // For tracking accounts that need re-auth for Google Tasks
    
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

    // Keep extractionSettings ref in sync for use inside async closures
    extractionSettingsRef.current = extractionSettings;

    // Track when user changes extraction settings (skip initial mount)
    const initialSettingsMount = useRef(true);
    useEffect(() => {
        if (initialSettingsMount.current) {
            initialSettingsMount.current = false;
            return;
        }
        settingsChangedSinceExtraction.current = true;
    }, [extractionSettings.email.startDate, extractionSettings.email.endDate, extractionSettings.sources, extractionSettings.selectedAccounts]);


    // Fetch connected accounts for extraction settings
    useEffect(() => {
        const fetchConnectedAccounts = async () => {
            if (!user?.id) return;
            try {
                const accounts = await oauth.getAccounts(user.id);
                const transformedAccounts = accounts.map(acc => ({
                    id: String(acc.id),
                    sourceId: acc.provider === 'google' ? 'gmail' : acc.provider,
                    email: acc.account_email,
                    name: acc.account_name,
                }));
                setConnectedAccounts(transformedAccounts);
            } catch (error) {
                console.error('Error fetching connected accounts:', error);
            }
        };
        fetchConnectedAccounts();
    }, [user?.id]);
  
    // Load extracted tasks on mount (shared tasks already fetched by parent)
    useEffect(() => {
        setLoading(false); // parent already fetched tasks
        loadExtractedTasks();
        extractTasksFromSources();
    }, []);

    // Load existing extracted tasks from database with pagination and caching
    // Note: Triage shows ALL pending tasks (industry standard), no date filtering
    const loadExtractedTasks = async (page = extractedTasksPage, options = {}) => {
        const { skipCache = false, showLoading = true } = options;
        const cacheKey = `page-${page}`;
    
        // Check cache first (unless skipping) — cache is cleared on extract/settings change
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
    
            // Filter by current extraction date range so triage shows only tasks from selected period
            const settings = extractionSettingsRef.current;
            const response = await taskExtraction.getExtracted(user?.id || 1, {
                startDate: settings?.email?.startDate,
                endDate: settings?.email?.endDate,
                page: page,
                pageSize: EXTRACTED_TASKS_PAGE_SIZE,
            });
    
            const transformed = (response.items || []).map(task => ({
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
    
            // Update cache
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
    
            // Prefetch adjacent pages in the background for faster navigation
            prefetchAdjacentPages(response.page, response.total_pages);
        } catch (err) {
            console.error('Error loading extracted tasks:', err);
        } finally {
            if (showLoading) setPaginationLoading(false);
        }
    };

    // Prefetch a page silently (no loading state, no state updates)
    const prefetchPage = async (page) => {
        const cacheKey = `page-${page}`;
    
        // Skip if already cached or invalid page
        if (pagesCache.current.has(cacheKey) || page < 1) return;
    
        try {
            const settings = extractionSettingsRef.current;
            const response = await taskExtraction.getExtracted(user?.id || 1, {
                startDate: settings?.email?.startDate,
                endDate: settings?.email?.endDate,
                page: page,
                pageSize: EXTRACTED_TASKS_PAGE_SIZE,
            });
    
            const transformed = (response.items || []).map(task => ({
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
    
            // Cache silently
            pagesCache.current.set(cacheKey, {
                tasks: transformed,
                page: response.page,
                total: response.total,
                pendingCount: response.pending_count ?? response.total,
                totalPages: response.total_pages,
            });
        } catch (err) {
            // Silently ignore prefetch errors
        }
    };

        // Prefetch adjacent pages (next and previous)
    const prefetchAdjacentPages = (currentPage, totalPages) => {
        // Prefetch next page
        if (currentPage < totalPages) {
            prefetchPage(currentPage + 1);
        }
        // Prefetch previous page
        if (currentPage > 1) {
            prefetchPage(currentPage - 1);
        }
    };

      // Clear page cache (call after add/dismiss/extract operations)
    const clearPagesCache = () => {
    pagesCache.current.clear();
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
      <div>
         {/* Extraction Settings Popover - Modern Design */}
                          {showExtractionSettings && (
                            <>
                              {/* Backdrop for click-outside */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowExtractionSettings(false)}
                              />
        
                              <div className="absolute top-full right-0 mt-2 w-96 bg-sky-950 rounded-xl shadow-xl  z-50 overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-sky-950/95 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white/10 rounded-lg">
                                      <SparklesIcon className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-slate-300 text-sm">Extraction Settings</h4>
                                      <p className="text-xs text-slate-200">Configure AI task extraction</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setShowExtractionSettings(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                  >
                                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                                  </button>
                                </div>
        
                                <div className="p-4 space-y-5">
                                  {/* Data Sources Section */}
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Data Sources</h5>
                                      {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 0 && (
                                        <span className="text-xs text-slate-300">
                                          {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length} connected
                                        </span>
                                      )}
                                    </div>
        
                                    <div className="space-y-2">
                                      {/* Email Source */}
                                      <div className={`rounded-xl border-2 transition-all ${
                                        extractionSettings.sources.includes('email')
                                          ? 'border-white/20 bg-white/10'
                                          : 'bg-slate-400 hover:bg-white/10'
                                      }`}>
                                        <label
                                          className="flex items-center gap-3 p-3 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={extractionSettings.sources.includes('email')}
                                            onChange={() => setExtractionSettings(prev => ({
                                              ...prev,
                                              sources: prev.sources.includes('email')
                                                ? prev.sources.filter(s => s !== 'email')
                                                : [...prev.sources, 'email']
                                            }))}
                                            className="w-4 h-4 text-slate-300 rounded focus:ring-slate-500"
                                          />
                                          <div className={`p-2 rounded-lg ${
                                            extractionSettings.sources.includes('email')
                                              ? 'bg-slate-200'
                                              : 'bg-slate-400'
                                          }`}>
                                            <EnvelopeIcon className={`w-4 h-4 ${
                                              extractionSettings.sources.includes('email')
                                                ? 'text-slate-200'
                                                : 'text-slate-400'
                                            }`} />
                                          </div>
                                          {/* <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-medium ${
                                              extractionSettings.sources.includes('email')
                                                ? 'text-gray-900'
                                                : 'text-gray-600'
                                            }`}>Email</span>
                                            {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 0 && (
                                              <p className="text-xs text-gray-500 truncate">
                                                {!extractionSettings.sources.includes('email')
                                                  ? 'Disabled'
                                                  : !extractionSettings.selectedAccounts?.email
                                                    ? 'All accounts'
                                                    : `${extractionSettings.selectedAccounts.email.length} of ${connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length} accounts`}
                                              </p>
                                            )}
                                          </div> */}
                                          {extractionSettings.sources.includes('email') && connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 1 && (
                                            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                          )}
                                        </label>
        
                                        {/* Email Accounts - Only show when enabled and multiple accounts */}
                                        {extractionSettings.sources.includes('email') && connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length > 1 && (
                                          <div className="px-3 pb-3 ">
                                            <div className="pt-2 space-y-0.5 max-h-24 overflow-y-auto">
                                              {connectedAccounts
                                                .filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook')
                                                .map(account => {
                                                  const isSelected = !extractionSettings.selectedAccounts?.email ||
                                                    extractionSettings.selectedAccounts.email?.includes(account.id);
                                                  return (
                                                    <label
                                                      key={account.id}
                                                      className="flex items-center gap-2 py-1.5 px-2 cursor-pointer text-xs hover:bg-white/10 rounded-lg transition-colors"
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
        
                                                            // If no accounts selected, disable the source
                                                            if (newSelected.length === 0) {
                                                              return {
                                                                ...prev,
                                                                sources: prev.sources.filter(s => s !== 'email'),
                                                                selectedAccounts: {
                                                                  ...prev.selectedAccounts,
                                                                  email: null
                                                                }
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
                                                        className="w-3.5 h-3.5 text-slate-300 rounded focus:ring-slate-400"
                                                      />
                                                      <span className="text-slate-500 truncate">{account.email}</span>
                                                    </label>
                                                  );
                                                })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
        
                                      {/* No accounts message */}
                                      {connectedAccounts.filter(acc => acc.sourceId === 'gmail' || acc.sourceId === 'outlook').length === 0 && (
                                        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                                          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-amber-800">No accounts connected</p>
                                            <p className="text-xs text-amber-600">Connect your email or calendar to extract tasks</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
        
                                  {/* Date Range Section */}
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Time Range</h5>
        
                                    {/* Quick Presets */}
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
                                              ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                          }`}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
        
                                    {/* Custom Date Range */}
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                      <div className="flex-1">
                                        <label className="block text-[10px] font-medium text-gray-500 mb-1 px-1">From</label>
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
                                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                          calendarClassName="extraction-datepicker"
                                          popperPlacement="bottom-start"
                                        />
                                      </div>
                                      <ArrowRightIcon className="w-4 h-4 text-gray-400 mt-5" />
                                      <div className="flex-1">
                                        <label className="block text-[10px] font-medium text-gray-500 mb-1 px-1">To</label>
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
                                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                          calendarClassName="extraction-datepicker"
                                          popperPlacement="bottom-start"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
        
                                {/* Footer Actions */}
                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-t border-gray-100">
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
                                    className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                                  >
                                    Reset to defaults
                                  </button>
                                  <button
                                    onClick={() => {
                                      extractTasksFromSources();
                                      setShowExtractionSettings(false);
                                    }}
                                    disabled={extractionLoading || extractionSettings.sources.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
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
    )
};
