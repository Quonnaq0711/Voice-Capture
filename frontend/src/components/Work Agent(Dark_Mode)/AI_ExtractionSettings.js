import React, { useState, useEffect, useRef, useCallback } from 'react';
import { taskExtraction, oauth } from '../../services/api';
import { EXTRACTED_TASKS_PAGE_SIZE } from '../../services/constants';

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
export default function AI_ExtractionSettings({ user, onExtractedTasksChange }) {
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const extractionSettingsRef = useRef(extractionSettings); // for async access
  const settingsChangedSinceExtraction = useRef(false); // track unsaved changes
  const [extractedTasks, setExtractedTasks] = useState([]);
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