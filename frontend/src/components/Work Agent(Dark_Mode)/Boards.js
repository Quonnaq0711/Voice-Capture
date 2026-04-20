import { useState, } from 'react';
import { todos } from '../../services/workApi';
import Board from '../../assets/kanbanboard2.png';
import Refresh from '../../assets/refresh2.png';

export default function Boards({ activeSubTab = 'backlog' }) {
    //   const { user } = useAuth();
      const [priorityFilter, setPriorityFilter] = useState('all');
      const [statusFilter, setStatusFilter] = useState('all');
      const [searchQuery, setSearchQuery] = useState('');
      const [sortBy, setSortBy] = useState('priority'); // priority, due_date, estimated, created, title
      const [sortDir, setSortDir] = useState('asc');    // asc, desc
      const [selectedTasks, setSelectedTasks] = useState([]);
      const [expandedGroups, setExpandedGroups] = useState({ none: true, todo: true, in_progress: true, review: true, done: false, delayed: false });
      // Backlog grouping: 'status' (default) or 'priority' (Plane-style)
      const [backlogGroupBy, setBacklogGroupBy] = useState('status');
      // Backlog layout: 'list' (spreadsheet) or 'board' (kanban)
      const [backlogLayout, setBacklogLayout] = useState('list');
    
    // AI Prioritization state
      const [showPrioritizeModal, setShowPrioritizeModal] = useState(false);
      const [selectedUnprioritized, setSelectedUnprioritized] = useState([]); // Selected tasks to prioritize
      const [isPrioritizing, setIsPrioritizing] = useState(false); // Loading state for AI prioritization
     // Modal states
      const [showTaskModal, setShowTaskModal] = useState(false);
      const [editingTask, setEditingTask] = useState(null);
      const [selectedTask, setSelectedTask] = useState(null);
    
      // Drag and drop state
      const [draggedTask, setDraggedTask] = useState(null);
      const [dragOverColumn, setDragOverColumn] = useState(null);
      const [dragOverCardId, setDragOverCardId] = useState(null);
      const [dragOverPosition, setDragOverPosition] = useState(null); // 'before' | 'after'
    
    // Task data state — shared with ScheduleView via context
      const { tasks, setTasks, refreshTasks: sharedRefreshTasks } = useContext(SharedTasksContext);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
    
    // CRUD Operations
      const userId = user?.id || 1;
    
      const handleCreateTask = async (taskData) => {
        const newTask = await todos.create(taskData, userId);
        setTasks(prev => [newTask, ...prev]);
      };
    
      const handleUpdateTask = async (taskId, taskData) => {
        const updated = await todos.update(taskId, taskData, userId);
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        if (selectedTask?.id === taskId) {
          setSelectedTask(updated);
        }
      };
    
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        await todos.delete(taskId, userId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        if (selectedTask?.id === taskId) {
          setSelectedTask(null);
        }
        setSelectedTasks(prev => prev.filter(id => id !== taskId));
      };
    
      const handleCompleteTask = async (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
    
        const newStatus = task.status === 'done' ? 'todo' : 'done';
        await handleUpdateTask(taskId, { status: newStatus });
      };
    
      // Bulk actions — use allSettled so partial failures don't lose successful updates
      const handleBulkComplete = async () => {
        const results = await Promise.allSettled(selectedTasks.map(taskId =>
          handleUpdateTask(taskId, { status: 'done' })
        ));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) fetchTasks(); // Re-sync on partial failure
        setSelectedTasks([]);
      };
    
      const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedTasks.length} tasks?`)) return;
        const results = await Promise.allSettled(selectedTasks.map(taskId => todos.delete(taskId, userId)));
        const succeeded = new Set();
        results.forEach((r, i) => { if (r.status === 'fulfilled') succeeded.add(selectedTasks[i]); });
        setTasks(prev => prev.filter(t => !succeeded.has(t.id)));
        if (succeeded.size < selectedTasks.length) fetchTasks(); // Re-sync on partial failure
        setSelectedTasks([]);
      };
    
      // Filter tasks (memoized to stabilize downstream callbacks)
      const filteredTasks = useMemo(() => tasks.filter(task => {
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }), [tasks, priorityFilter, statusFilter, searchQuery]);
    
      // Group tasks by status for Kanban Board - sorted by ai_suggested_order for drag reordering
      const orderSort = (a, b) => {
        const oa = a.ai_suggested_order ?? Infinity;
        const ob = b.ai_suggested_order ?? Infinity;
        if (oa !== ob) return oa - ob;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      };
      const getTasksByStatus = useCallback((status) => {
        return filteredTasks.filter(t => t.status === status).sort(orderSort);
      }, [filteredTasks]);
    
      // Pre-computed column→tasks map — avoids re-filtering per column in render
      const tasksByColumn = useMemo(() => {
        const map = {};
        KANBAN_COLUMNS.forEach(col => { map[col.id] = []; });
        filteredTasks.forEach(t => { if (map[t.status]) map[t.status].push(t); });
        Object.values(map).forEach(arr => arr.sort(orderSort));
        return map;
      }, [filteredTasks]);
    
      // Drag and drop handlers with improved UX
      const dragCounterRef = useRef(0);
    
      const handleDragStart = useCallback((e, task) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id.toString());
    
        const dragElement = e.currentTarget.cloneNode(true);
        dragElement.style.position = 'absolute';
        dragElement.style.top = '-1000px';
        dragElement.style.opacity = '0.9';
        dragElement.style.transform = 'rotate(3deg)';
        dragElement.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        dragElement.style.width = `${e.currentTarget.offsetWidth}px`;
        document.body.appendChild(dragElement);
        e.dataTransfer.setDragImage(dragElement, e.currentTarget.offsetWidth / 2, 20);
        setTimeout(() => document.body.removeChild(dragElement), 0);
    
        requestAnimationFrame(() => setDraggedTask(task));
      }, []);
    
      const handleDragEnter = useCallback((e, columnId) => {
        e.preventDefault();
        dragCounterRef.current++;
        setDragOverColumn(columnId);
      }, []);
    
      const handleDragOver = useCallback((e, columnId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(prev => prev !== columnId ? columnId : prev);
      }, []);
    
      const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
          setDragOverColumn(null);
        }
      }, []);
    
      // Card-level drag: detect before/after based on cursor Y position
      const handleCardDragOver = useCallback((e, task) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (draggedTask && task.id === draggedTask.id) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = e.clientY < midY ? 'before' : 'after';
        setDragOverCardId(task.id);
        setDragOverPosition(pos);
      }, [draggedTask]);
    
      const handleCardDragLeave = useCallback((e) => {
        // Only clear if actually leaving the card (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragOverCardId(null);
          setDragOverPosition(null);
        }
      }, []);
    
      const handleDrop = useCallback(async (e, columnId) => {
        e.preventDefault();
        dragCounterRef.current = 0;
    
        const droppedTask = draggedTask;
        const targetCardId = dragOverCardId;
        const position = dragOverPosition;
    
        setDragOverColumn(null);
        setDragOverCardId(null);
        setDragOverPosition(null);
        setDraggedTask(null);
    
        if (!droppedTask) return;
    
        const statusChanged = droppedTask.status !== columnId;
    
        // Get the current ordered list for the target column
        const columnTasks = getTasksByStatus(columnId).filter(t => t.id !== droppedTask.id);
    
        // Compute insertion index
        let insertIndex = columnTasks.length; // default: end
        if (targetCardId) {
          const targetIdx = columnTasks.findIndex(t => t.id === targetCardId);
          if (targetIdx !== -1) {
            insertIndex = position === 'before' ? targetIdx : targetIdx + 1;
          }
        }
    
        // Early return: dropped in same column at same position — no-op
        if (!statusChanged) {
          const oldTasks = getTasksByStatus(columnId);
          const oldIdx = oldTasks.findIndex(t => t.id === droppedTask.id);
          if (oldIdx === insertIndex) return;
        }
    
        // Insert the dragged task at the right position
        const movedTask = statusChanged ? { ...droppedTask, status: columnId } : droppedTask;
        columnTasks.splice(insertIndex, 0, movedTask);
    
        // Assign sequential order values + build lookup map for O(n) update
        const orderMap = new Map();
        columnTasks.forEach((t, i) => orderMap.set(t.id, i + 1));
        const orderUpdates = columnTasks.map((t, i) => ({
          taskId: t.id,
          suggestedOrder: i + 1,
        }));
    
        // Optimistic UI update — update order + status in tasks state
        setTasks(prev => prev.map(t => {
          const newOrder = orderMap.get(t.id);
          if (t.id === droppedTask.id && statusChanged) {
            return { ...t, status: columnId, ai_suggested_order: newOrder ?? t.ai_suggested_order };
          }
          if (newOrder !== undefined) {
            return { ...t, ai_suggested_order: newOrder };
          }
          return t;
        }));
    
        // Persist to backend
        try {
          if (statusChanged) {
            await todos.update(droppedTask.id, { status: columnId }, userId);
          }
          await taskPrioritization.saveReorder(userId, orderUpdates);
        } catch (err) {
          console.error('Failed to persist drag reorder:', err);
          fetchTasks();
        }
      }, [draggedTask, dragOverCardId, dragOverPosition, getTasksByStatus, user, fetchTasks]);
    
      const handleDragEnd = useCallback(() => {
        dragCounterRef.current = 0;
        setDraggedTask(null);
        setDragOverColumn(null);
        setDragOverCardId(null);
        setDragOverPosition(null);
      }, []);
    
      // Sort tasks — nulls always sort to end regardless of direction
      const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      const sortedTasks = [...filteredTasks].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortBy) {
          case 'priority':
            return dir * ((PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));
          case 'due_date': {
            const ha = !!a.due_date, hb = !!b.due_date;
            if (ha !== hb) return ha ? -1 : 1; // nulls to end
            if (!ha) return 0;
            return dir * (new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          }
          case 'estimated': {
            const ha = a.ai_estimated_minutes != null, hb = b.ai_estimated_minutes != null;
            if (ha !== hb) return ha ? -1 : 1; // nulls to end
            if (!ha) return 0;
            return dir * (a.ai_estimated_minutes - b.ai_estimated_minutes);
          }
          case 'created':
            return dir * (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          case 'title':
            return dir * a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
    
      // Toggle sort — click same column flips direction, different column resets to asc
      const handleSort = (field) => {
        if (sortBy === field) {
          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
          setSortBy(field);
          setSortDir('asc');
        }
      };
    
      // Split tasks into prioritized (has ai_last_analyzed) and unprioritized
      const prioritizedTasks = filteredTasks.filter(t => t.ai_last_analyzed);
      const unprioritizedTasks = filteredTasks.filter(t => !t.ai_last_analyzed);
    
      // Handle AI prioritization - works with specified task IDs or all filtered tasks
      // Backend auto-saves priorities to DB (no separate apply-priorities call needed)
      const handlePrioritize = async (taskIds = null) => {
        const idsToAnalyze = taskIds || filteredTasks.map(t => t.id);
        if (idsToAnalyze.length === 0) return;
    
        setIsPrioritizing(true);
        try {
          const response = await taskPrioritization.analyze({
            userId: user?.id || 1,
            taskIds: idsToAnalyze,
            includeTriage: false,
            mode: 'auto',
            context: {
              workHoursPerDay: 8,
              workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
              preferredStartTime: '09:00',
              scheduleStartDate: new Date().toISOString().split('T')[0],
              scheduleDays: 7,
            },
          });
    
          if (response.method) {
            console.log(`Prioritization method: ${response.method}`);
          }
    
          // Refresh tasks (backend already saved priorities)
          await fetchTasks();
          setSelectedUnprioritized([]);
        } catch (err) {
          console.error('Failed to prioritize tasks:', err);
          setError(err.message || 'Failed to prioritize tasks');
        } finally {
          setIsPrioritizing(false);
        }
      };
    
      // Convenience wrappers for backward compatibility with UI handlers
      const handlePrioritizeSelected = () => {
        if (selectedUnprioritized.length === 0) return;
        return handlePrioritize(selectedUnprioritized);
      };
    
      const handlePrioritizeAll = () => handlePrioritize();
    
      // Toggle selection for unprioritized task
      const toggleUnprioritizedSelection = (taskId) => {
        setSelectedUnprioritized(prev =>
          prev.includes(taskId)
            ? prev.filter(id => id !== taskId)
            : [...prev, taskId]
        );
      };
    
      // Select/deselect all unprioritized tasks
      const toggleSelectAllUnprioritized = () => {
        if (selectedUnprioritized.length === unprioritizedTasks.length) {
          setSelectedUnprioritized([]);
        } else {
          setSelectedUnprioritized(unprioritizedTasks.map(t => t.id));
        }
      };
    
      // Calculate stats
      const stats = {
        total: tasks.length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        dueToday: tasks.filter(t => {
          if (!t.due_date) return false;
          const today = new Date();
          const dueDate = new Date(t.due_date);
          return dueDate.toDateString() === today.toDateString() && t.status !== 'done';
        }).length,
        overdue: tasks.filter(t => {
          if (!t.due_date) return false;
          return new Date(t.due_date) < new Date() && t.status !== 'done';
        }).length,
        completed: tasks.filter(t => t.status === 'done').length,
      };
    
    // Get prioritized tasks grouped by priority (Plane-style)
    const getTasksByPriority = (priorityId) => {
    return prioritizedTasks.filter(t => {
      const taskPriority = t.priority || 'none';
      return taskPriority === priorityId || (priorityId === 'none' && !t.priority);
    });
  };

    
    
  return (
    <div className="w-full min-h-screen bg-sky-950 text-white">

      {/* Header */}
      <header className="flex items-center justify-between px-10 pt-6">
        <span className="font-['Space_Mono'] text-2xl font-bold">Work</span>
        <span className="text-sm text-white/60">Account</span>
      </header>

      {/* Header */}
      <div className="flex items-center gap-2 px-10 pt-7 mt-20">
        <img src={Board} alt="Boards" className="w-4 h-4" />
        <span className="text-sm font-semibold font-['Inter']">Boards</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[500px] px-10 py-5">
        <div className="relative w-[500px]">
          <input
            type="text"
            placeholder="Search"
            className="w-full bg-white/5 border border-white/10 rounded-[10px] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none"
          />
              </div>
             <div className="flex items-end gap-3">
        <select className="bg-sky-950/95 border border-white/10 rounded-lg py-2 px-3 text-sm text-white outline-none min-w-[120px]">
          <option value="" className=''>Priority</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <button className="bg-white/5 border border-white/20 rounded-lg p-2">
          <img src={Refresh} alt="Refresh" className="w-5 h-5" />
        </button>
              </div>
              </div>

      {/* Board columns */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 px-10 pb-10">
        {/* Column components here */}
      </div>

    </div>
  );
}