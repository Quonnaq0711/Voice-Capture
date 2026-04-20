import {
  useState,
  useRef,
  useCallback,
  useContext,
  createContext,
} from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import TriageRow, { TRIAGE_COLUMNS } from "./IncomingRowDetail";
// import { memoryMonitor } from "../../utils/memoryMonitor";
// import { useEffect } from "react";
import { taskExtraction } from "../../services/workApi";
import inboxIcon from "../../assets/mail-in1.png";
import aiSparkles from "../../assets/aiSparkles.png";

// ─── Shared context (consumed by ScheduleView too) ────────────────────────────

export const SharedTasksContext = createContext({
  tasks: [],
  setTasks: () => {},
  refreshTasks: () => {},
});

// ─── Column header labels ─────────────────────────────────────────────────────

const COL_HEADERS = ["DATE", "SOURCE", "ACCOUNT", "TASK", "ACTIONS"];

// ─── TriageStandalone ─────────────────────────────────────────────────────────
//
// Page-level component. Owns all triage state and passes per-row handlers down
// to <TriageRow> via props. Nothing page-level lives inside TriageRow.

export default function Incoming() {
  const user = { id: 1, name: "Test User" };

  // ── Shared task list (also used by ScheduleView) ──
  const {
    tasks,
    setTasks,
    refreshTasks: sharedRefreshTasks,
  } = useContext(SharedTasksContext);

  // ── Local UI state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTriageTask, setSelectedTriageTask] = useState(null);
  const [triageActionLoading, setTriageActionLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Extracted tasks state ──
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractionSummary, setExtractionSummary] = useState(null);
  const [lastExtractionTime, setLastExtractionTime] = useState(null);
  const [accountsMissingScope, setAccountsMissingScope] = useState([]);

  // ── Pagination state ──
  const [extractedTasksPage, setExtractedTasksPage] = useState(1);
  const [extractedTasksTotal, setExtractedTasksTotal] = useState(0);
  const [extractedTasksPendingCount, setExtractedTasksPendingCount] =
    useState(0);
  const [extractedTasksTotalPages, setExtractedTasksTotalPages] = useState(1);
  const [paginationLoading, setPaginationLoading] = useState(false);

  const EXTRACTED_TASKS_PAGE_SIZE = 10;

  // ── Refs ──
  const extractionInProgress = useRef(false);
  const extractionSettingsRef = useRef(null);
  const settingsChangedSinceExtraction = useRef(false);
  const pagesCache = useRef(new Map());
  const triageActionInFlightRef = useRef(new Set());

  // ─── Derived: filtered task list ────────────────────────────────────────────

  const filteredExtractedTasks = extractedTasks.filter(
    (task) =>
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  // ─── Data loading ────────────────────────────────────────────────────────────

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

  const loadExtractedTasks = async (
    page = extractedTasksPage,
    options = {},
  ) => {
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

  // ─── Action handlers ─────────────────────────────────────────────────────────

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
          result.todo
            ? setTasks((prev) => [result.todo, ...prev])
            : fetchTasks();
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
          prev.map((t) =>
            t.id === resolvedId ? { ...t, ...revertFields } : t,
          ),
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
        extractedTasks.filter((t) => t.status === "pending" && t.id !== taskId)
          .length === 0;
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-screen bg-sky-950 overflow-auto">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-[50px] pt-[35px]">
        <span className="text-white text-3xl font-bold font-['Space_Mono']">
          Work
        </span>
        <span className="text-white text-base font-['Open_Sans']">Account</span>
      </div>

      {/* ── Section header + controls ── */}
      <div className="flex items-start justify-between px-[50px] mt-8">
        <div>
          <div className="flex items-center gap-2">
            <img src={inboxIcon} alt="Inbox" className="w-6 h-6" />
            <span className="text-white text-sm font-semibold font-['Inter']">
              Incoming
            </span>
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
              className="bg-transparent text-white/60 text-sm font-['Inter'] w-full
                outline-none placeholder:text-white/30"
            />
          </div>

          {/* AI Extract */}
          <button
            onClick={() => {
              /* extractTasksFromSources() */
            }}
            disabled={extractionLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px]
              outline outline-1 outline-pink-600 text-pink-600 text-sm font-['Inter']
              hover:bg-pink-600/10 transition-colors disabled:opacity-50"
          >
            <img src={aiSparkles} alt="AI Sparkles" className="w-3.5 h-3.5" />
            AI Extract
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div
        className={`grid ${TRIAGE_COLUMNS} mx-[50px] mt-5 rounded-md overflow-hidden`}
      >
        {COL_HEADERS.map((label, i) => (
          <div
            key={label}
            className={`bg-white/10 px-3 py-2 text-white/60 text-xs font-semibold
              font-['Inter'] tracking-wide
              ${i === COL_HEADERS.length - 1 ? "text-right" : ""}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Task list ── */}
      <div className="mx-[50px] mt-1 flex flex-col gap-0.5">
        {filteredExtractedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-white/50 text-sm">
              No tasks found. Connect a source to get started.
            </p>
            <button
              className="px-4 py-2 bg-pink-600 text-white text-sm rounded-lg
              hover:bg-pink-700 transition-colors"
            >
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
              onMouseEnter={() => {
                /* triageEmailCacheRef prefetch */
              }}
              onAdd={() => handleAddExtractedTask(task)}
              onDismiss={() => handleDismissExtractedTask(task.id)}
              onRevert={() =>
                handleRevertExtractedTask(task.added_todo_id, task.id)
              }
              actionLoading={triageActionLoading}
            />
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {extractedTasksTotalPages > 1 && (
        <div
          className="flex items-center justify-end gap-3 px-[50px] py-5
          text-white/40 text-xs"
        >
          <span>{extractedTasksPendingCount} pending</span>
          <button
            disabled={extractedTasksPage <= 1 || paginationLoading}
            onClick={() => loadExtractedTasks(extractedTasksPage - 1)}
            className="px-3 py-1.5 bg-white/10 rounded-md hover:bg-white/15
              transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span>
            Page {extractedTasksPage} of {extractedTasksTotalPages}
          </span>
          <button
            disabled={
              extractedTasksPage >= extractedTasksTotalPages ||
              paginationLoading
            }
            onClick={() => loadExtractedTasks(extractedTasksPage + 1)}
            className="px-3 py-1.5 bg-white/10 rounded-md hover:bg-white/15
              transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Extraction summary toast ── */}
      {extractionSummary && (
        <div
          className="fixed bottom-6 right-6 bg-sky-900/90 border border-white/10
          rounded-xl px-4 py-3 text-white text-sm shadow-xl backdrop-blur-sm"
        >
          {extractionSummary}
        </div>
      )}
    </div>
  );
}
