import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  // Navigation & Layout 
  LightBulbIcon,  
  ListBulletIcon,
  // Actions
  PlusIcon,
  ArrowPathIcon,  
  ChevronLeftIcon,
  ChevronRightIcon, 
  ChevronDownIcon,  
  SparklesIcon,  
  PaperAirplaneIcon,
  ArrowUturnLeftIcon, 
  DocumentDuplicateIcon,  
  // Status & Priority
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,  
  // Sources
  EnvelopeIcon,  
  ChatBubbleLeftRightIcon,  
  CalendarIcon,  
  // Other  
  BoltIcon,
  DocumentTextIcon, 
  TrashIcon,
  PencilIcon,
  EyeIcon, 
  LinkIcon, 
  CheckIcon,
  XMarkIcon,
  PaperClipIcon,
  TagIcon,
 // AI Features 
  ShieldExclamationIcon,  
  ArrowDownTrayIcon,
  MicrophoneIcon,  
} from '@heroicons/react/24/outline';
import {  todos,  taskSolver, solverSessions } from '../../services/workApi';
import { useVoiceDictation } from '../../hooks/useVoiceDictation';
import { usePressTalk } from '../../hooks/usePressTalk';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import MessageRenderer from '../chat/MessageRenderer';
import { useBullets, AISummarySection } from './AISummarySection';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import sanitizeDescriptionHtml from './Utils/SanitizeDescriptionHTML';
import MarkdownEditor from './Utils/MarkdownEditor';


const PRIORITIES = {
  urgent: { label: 'Urgent', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  high: { label: 'High', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  low: { label: 'Low', color: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  none: { label: 'None', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};


// Task Detail Panel (Jira-style centered modal with tabs)
const DETAIL_ITEMS_PER_PAGE = 10;


export default function TaskDetailPanel({ task, onClose, onUpdate, onDelete, onSummaryGenerated }) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [activeTab, setActiveTab] = useState('details'); // details, comments, attachments, activity
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [detailDataLoaded, setDetailDataLoaded] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [attachmentsPage, setAttachmentsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const uploadDragCounter = useRef(0);
  const detailNotesRef = useRef(null);

  // AI Solver state
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiStreamingContent, setAiStreamingContent] = useState('');
  const [aiError, setAiError] = useState(null);
  const [activeToolCalls, setActiveToolCalls] = useState([]);
  const aiAbortControllerRef = useRef(null);
  const aiMessagesEndRef = useRef(null);
  const aiAccumulatedRef = useRef('');
  const aiTextareaRef = useRef(null);

  // Solver session state
  const [solverSessionsList, setSolverSessionsList] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [solverInitialLoading, setSolverInitialLoading] = useState(true);
  const sessionDropdownRef = useRef(null);
  const initialSessionLoadedRef = useRef(false);
  // Ref tracks the active session in real-time — used by streaming callbacks
  // to discard tokens that belong to a session the user has already left (mirrors PA's currentSessionRef)
  const activeSessionRef = useRef(null);
  // Edit & copy state (mirrors PA's ChatDialog pattern)
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [copiedMessageIds, setCopiedMessageIds] = useState([]);
  const [aiUserScrolled, setAiUserScrolled] = useState(false);
  const aiChatContainerRef = useRef(null);
  // Optimize input state — mirrors PA's optimize pattern
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiOptimized, setAiOptimized] = useState(false);
  const [aiOriginalInput, setAiOriginalInput] = useState('');
  // Voice input state — mirrors PA's ChatDialog pattern
  const [voiceError, setVoiceError] = useState(null);
  const voiceErrorTimer = useRef(null);
  const pressTimerRef = useRef(null);
  const pttGestureRef = useRef(false);
  const handleAiSendRef = useRef(null);

  const voiceErrorCb = useCallback((msg) => {
    console.error('[Voice]', msg);
    setVoiceError(msg);
    clearTimeout(voiceErrorTimer.current);
    voiceErrorTimer.current = setTimeout(() => setVoiceError(null), 4000);
  }, []);

  const voiceTranscript = useCallback((text) => {
    setAiInput(prev => prev ? prev + ' ' + text : text);
  }, []);

  const voicePTTTranscript = useCallback((text) => {
    if (!text.trim()) return;
    setAiInput(text);
    handleAiSendRef.current?.(text);
  }, []);

  const { isRecording, isProcessing, toggleRecording } = useVoiceDictation({
    chunkInterval: 3000,
    onTranscript: voiceTranscript,
    onError: voiceErrorCb,
  });

  const {
    isRecording: isPTTRecording,
    isProcessing: pttProcessing,
    start: startPTT,
    stop: stopPTT,
  } = usePressTalk({ onTranscript: voicePTTTranscript, onError: voiceErrorCb });

  const voiceActive = isRecording || isPTTRecording || isProcessing || pttProcessing;
  const micDisabled = aiStreaming || aiOptimizing;

  const handleMicDown = useCallback((e) => {
    e.preventDefault();
    if (micDisabled || isProcessing || pttProcessing || isPTTRecording) return;
    if (isRecording) return;

    e.target.setPointerCapture(e.pointerId);
    pttGestureRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      pttGestureRef.current = true;
      startPTT();
    }, 300);
  }, [micDisabled, isProcessing, pttProcessing, isRecording, isPTTRecording, startPTT]);

  const handleMicUp = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      toggleRecording();
      return;
    }
    if (pttGestureRef.current) {
      pttGestureRef.current = false;
      stopPTT();
      return;
    }
    if (isRecording) {
      toggleRecording();
    }
  }, [isRecording, toggleRecording, stopPTT]);

  const handleMicLeave = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // Client-side session messages cache — instant switch for previously-loaded sessions
  const sessionMessagesCacheRef = useRef({});
  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);
  // Keep cache in sync: whenever messages change for the active session, update the cache
  useEffect(() => {
    if (activeSessionId && aiMessages.length > 0) {
      sessionMessagesCacheRef.current[activeSessionId] = aiMessages;
    }
  }, [activeSessionId, aiMessages]);

  // Derive activities from already-loaded data — no API call needed
  const activities = useMemo(() => {
    if (!task) return [];
    const items = [];
    if (task.created_at) {
      items.push({ type: 'created', user: 'You', timestamp: task.created_at, description: 'created this task' });
    }
    for (const c of comments) {
      const preview = c.content?.length > 80 ? c.content.slice(0, 80) + '...' : c.content;
      items.push({ type: 'commented', user: 'You', timestamp: c.created_at, description: `commented: "${preview}"` });
    }
    for (const a of attachments) {
      items.push({ type: 'attachment', user: 'You', timestamp: a.created_at, description: `uploaded ${a.original_filename}` });
    }
    for (const s of solverSessionsList) {
      items.push({ type: 'solver', user: 'AI Solver', timestamp: s.created_at, description: `started conversation: "${s.title}"` });
    }
    if (task.ai_last_analyzed) {
      items.push({ type: 'ai_prioritized', user: 'AI', timestamp: task.ai_last_analyzed, description: `analyzed and suggested priority: ${task.priority}` });
    }
    if (task.completed_at) {
      items.push({ type: 'completed', user: 'You', timestamp: task.completed_at, description: 'marked this task as done' });
    }
    items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return items.map((item, i) => ({ ...item, id: i + 1 }));
  }, [task, comments, attachments, solverSessionsList]);

  // Sorted + paginated slices (newest-first, 10 per page)
  const sortedComments = useMemo(() => [...comments].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [comments]);
  const sortedAttachments = useMemo(() => [...attachments].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [attachments]);
  const pagedComments = useMemo(() => sortedComments.slice((commentsPage - 1) * DETAIL_ITEMS_PER_PAGE, commentsPage * DETAIL_ITEMS_PER_PAGE), [sortedComments, commentsPage]);
  const pagedAttachments = useMemo(() => sortedAttachments.slice((attachmentsPage - 1) * DETAIL_ITEMS_PER_PAGE, attachmentsPage * DETAIL_ITEMS_PER_PAGE), [sortedAttachments, attachmentsPage]);
  const pagedActivities = useMemo(() => activities.slice((activityPage - 1) * DETAIL_ITEMS_PER_PAGE, activityPage * DETAIL_ITEMS_PER_PAGE), [activities, activityPage]);

  // Auto-resize AI solver textarea — mirrors PA's autoResizeTextarea
  const autoResizeAiTextarea = useCallback(() => {
    if (aiTextareaRef.current) {
      aiTextareaRef.current.style.height = 'auto';
      aiTextareaRef.current.style.height = Math.min(aiTextareaRef.current.scrollHeight, 150) + 'px';
    }
  }, []);
  useEffect(() => { autoResizeAiTextarea(); }, [aiInput, autoResizeAiTextarea]);

  // Optimize input — mirrors PA's optimizeInput / revertOptimization
  const optimizeAiInput = useCallback(async () => {
    if (!aiInput.trim() || aiOptimizing) return;
    setAiOptimizing(true);
    setAiOriginalInput(aiInput);
    try {
      // Use proxy path /api/pa/optimize → PA's /api/chat/optimize (via setupProxy.js)
      const response = await axios.post('/api/pa/optimize', { query: aiInput.trim() });
      const data = response.data;
      if (data.status === 'success' && data.optimized_query) {
        setAiInput(data.optimized_query);
        setAiOptimized(true);
      }
    } catch (err) {
      console.error('Failed to optimize input:', err);
    } finally {
      setAiOptimizing(false);
    }
  }, [aiInput, aiOptimizing]);

  const revertAiOptimization = useCallback(() => {
    if (aiOptimized && aiOriginalInput) {
      setAiInput(aiOriginalInput);
      setAiOptimized(false);
      setAiOriginalInput('');
    }
  }, [aiOptimized, aiOriginalInput]);

  // Reset optimization state when user manually edits input — mirrors PA's handleInputChange
  const handleAiInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setAiInput(newValue);
    if (aiOptimized) {
      setAiOptimized(false);
      setAiOriginalInput('');
    }
  }, [aiOptimized]);

  // AI Summary via shared hook
  const { bullets, bulletsLoading, bulletsError, fetchBullets } = useBullets({
    taskId: task?.id || null,
    aiSummary: task?.ai_summary,
    describeFn: todos.describe,
    userId: user?.id,
    onSummaryGenerated,
  });

  useEffect(() => {
    let cancelled = false;
    setEditedTask(task);
    setIsEditing(false);
    setDetailDataLoaded(false);
    setCommentsPage(1);
    setAttachmentsPage(1);
    setActivityPage(1);
    setComments([]);
    setAiMessages([]);
    setAiInput('');
    setAiStreaming(false);
    setAiStreamingContent('');
    setAiError(null);
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    aiAccumulatedRef.current = '';
    setSolverSessionsList([]);
    setActiveSessionId(null);
    setSessionSearch('');
    setShowSessionDropdown(false);
    initialSessionLoadedRef.current = false;
    setSolverInitialLoading(true);
    setEditingMessageIndex(null);
    setEditInput('');
    setCopiedMessageIds([]);
    if (task) {
      Promise.all([
        todos.getComments(task.id, user?.id || 1).catch(() => []),
        todos.getAttachments(task.id, user?.id || 1).catch(() => []),
        solverSessions.list(task.id, user?.id || 1, '').catch(() => []),
      ]).then(([commentsData, attachmentsData, sessionsData]) => {
        if (cancelled) return;
        setComments(commentsData);
        setAttachments(attachmentsData);
        setSolverSessionsList(sessionsData);
        setDetailDataLoaded(true);
      });
    }
    return () => { cancelled = true; };
  }, [task]);

  // Keep editedTask.description in sync with AI summary — prevents saving stale
  // description that would overwrite the backend's AI-synced value
  useEffect(() => {
    if (bullets?.length > 0) {
      setEditedTask(prev => prev ? { ...prev, description: bullets.map(b => `• ${b}`).join('\n') } : prev);
    }
  }, [bullets]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Detect if description contains real HTML markup (vs plain text with angle brackets)
  const descriptionIsHtml = useMemo(
    () => task?.description ? /<(?:p|div|br|table|ul|ol|li|h[1-6]|span|em|strong|a|blockquote)\b/i.test(task.description) : false,
    [task?.description]
  );
  // Memoize sanitized HTML so DOMParser doesn't re-run on every render
  const sanitizedDescription = useMemo(
    () => (task?.description && descriptionIsHtml) ? sanitizeDescriptionHtml(task.description) : '',
    [task?.description, descriptionIsHtml]
  );

  // Abort any in-flight AI solver stream — called on session switch, new session, clear
  const abortAiStream = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiStreaming(false);
    setAiStreamingContent('');
    aiAccumulatedRef.current = '';
  }, []);

  // Copy message to clipboard — mirrors PA's copyToClipboard
  const copyToClipboard = useCallback(async (text, msgIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIds(prev => prev.includes(msgIndex) ? prev : [...prev, msgIndex]);
      setTimeout(() => {
        setCopiedMessageIds(prev => prev.filter(id => id !== msgIndex));
      }, 1500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(textArea);
    }
  }, []);

  // Edit message — mirrors PA's startEditMessage / submitEditedMessage
  const startEditMessage = useCallback((index, messageText) => {
    setEditingMessageIndex(index);
    setEditInput(messageText);
  }, []);

  const cancelEditMessage = useCallback(() => {
    setEditingMessageIndex(null);
    setEditInput('');
  }, []);

  // Submit edited message — mirrors PA: abort stream, truncate DB messages, re-send
  const submitEditedMessage = async (index) => {
    const trimmedEdit = editInput.trim();
    if (!trimmedEdit) return;

    // Abort any in-flight stream before starting a new one
    abortAiStream();

    // Truncate: keep messages up to edited index, replace edited message content
    const truncated = aiMessages.slice(0, index).concat({ role: 'user', content: trimmedEdit });
    setAiMessages(truncated);

    const sessionAtSendTime = activeSessionId;

    // Sync with DB: delete messages from the edited index (inclusive) so streaming recreates with edited content
    if (sessionAtSendTime && task?.id && user?.id) {
      try {
        await solverSessions.deleteMessagesFromIndex(task.id, sessionAtSendTime, user.id, index);
      } catch (err) {
        console.warn('Failed to delete messages from index in database:', err);
      }
    }

    // Update session title if editing the first user message
    if (index === 0 && sessionAtSendTime && task?.id && user?.id) {
      const newTitle = trimmedEdit.length > 50 ? trimmedEdit.substring(0, 50) + '...' : trimmedEdit;
      solverSessions.rename(task.id, sessionAtSendTime, user.id, newTitle).then(() => {
        loadSolverSessions();
      }).catch(() => {});
    }

    // Clear edit state
    setEditingMessageIndex(null);
    setEditInput('');

    // Re-send the edited message with truncated history
    setAiStreaming(true);
    setAiStreamingContent('');
    setAiError(null);
    setAiUserScrolled(false);
    aiAccumulatedRef.current = '';

    const history = truncated.slice(0, -1); // everything except the new user message

    const controller = taskSolver.chatStream(
      {
        taskId: task?.id,
        userId: user?.id || 1,
        message: trimmedEdit,
        conversationHistory: history,
        sessionId: sessionAtSendTime,
      },
      (token) => {
        if (activeSessionRef.current !== sessionAtSendTime) return;
        aiAccumulatedRef.current += token;
        setAiStreamingContent(prev => prev + token);
      },
      (fullContent) => {
        if (sessionAtSendTime) loadSolverSessions();
        if (activeSessionRef.current !== sessionAtSendTime) return;
        const content = fullContent || aiAccumulatedRef.current;
        if (content) {
          setAiMessages(msgs => [...msgs, { role: 'assistant', content }]);
        }
        setAiStreamingContent('');
        setAiStreaming(false);
        aiAbortControllerRef.current = null;
      },
      (errorMsg) => {
        if (!aiAbortControllerRef.current) return;
        if (activeSessionRef.current !== sessionAtSendTime) return;
        if (aiAccumulatedRef.current) {
          setAiMessages(msgs => [...msgs, { role: 'assistant', content: aiAccumulatedRef.current }]);
        }
        setAiError(typeof errorMsg === 'string' ? errorMsg : 'An error occurred');
        setAiStreaming(false);
        setAiStreamingContent('');
        aiAbortControllerRef.current = null;
      }
    );
    aiAbortControllerRef.current = controller;
  };

  // Load solver sessions — defined before handleAiSend which depends on it
  const loadSolverSessions = useCallback(async (search = '') => {
    if (!task?.id || !user?.id) return;
    setSessionsLoading(true);
    try {
      const sessions = await solverSessions.list(task.id, user.id, search);
      setSolverSessionsList(sessions);
    } catch (e) {
      console.error('Failed to load solver sessions:', e);
    } finally {
      setSessionsLoading(false);
    }
  }, [task?.id, user?.id]);

  // AI Solver handlers (must be before early return to satisfy Rules of Hooks)
  const handleAiSend = useCallback(async (messageText, quickAction = null) => {
    const text = quickAction ? '' : (messageText || aiInput).trim();
    if (!text && !quickAction) return;

    if (!quickAction) {
      setAiInput('');
      setAiOptimized(false);
      setAiOriginalInput('');
    }
    setAiError(null);
    setAiUserScrolled(false);

    const userLabel = quickAction
      ? { suggest_approach: 'Suggest Approach', break_down: 'Break Down Task', estimate_time: 'Estimate Time', identify_blockers: 'Identify Blockers' }[quickAction] || quickAction
      : text;

    // Auto-create session if none active — title from first message (mirrors PA pattern)
    let sessionId = activeSessionId;
    if (!sessionId && task?.id && user?.id) {
      try {
        const sessionTitle = userLabel.length > 50 ? userLabel.substring(0, 50) + '...' : userLabel;
        const newSession = await solverSessions.create(task.id, user.id, sessionTitle);
        sessionId = newSession.id;
        // Sync ref immediately so streaming callbacks see the correct session
        // (setActiveSessionId triggers useEffect which is async/batched — too late for first tokens)
        activeSessionRef.current = sessionId;
        setActiveSessionId(sessionId);
        setSolverSessionsList(prev => [newSession, ...prev]);
      } catch (e) {
        console.error('Failed to create solver session:', e);
      }
    }

    setAiMessages(prev => [...prev, { role: 'user', content: userLabel }]);
    setAiStreaming(true);
    setAiStreamingContent('');
    setActiveToolCalls([]);

    const history = [...aiMessages];
    aiAccumulatedRef.current = '';

    // Capture session at send time — callbacks discard tokens if user switched away (mirrors PA pattern)
    const sessionAtSendTime = sessionId;

    const controller = taskSolver.chatStream(
      {
        taskId: task?.id,
        userId: user?.id || 1,
        message: text || userLabel,
        conversationHistory: history,
        quickAction,
        sessionId,
      },
      (token) => {
        // Discard tokens if user switched to a different session
        if (activeSessionRef.current !== sessionAtSendTime) return;
        aiAccumulatedRef.current += token;
        setAiStreamingContent(prev => prev + token);
      },
      (fullContent) => {
        // Always refresh session list (message count changed in DB), but only update UI if still on same session
        if (sessionId) loadSolverSessions();
        if (activeSessionRef.current !== sessionAtSendTime) return;
        const content = fullContent || aiAccumulatedRef.current;
        if (content) {
          setAiMessages(msgs => [...msgs, { role: 'assistant', content }]);
        }
        setAiStreamingContent('');
        setAiStreaming(false);
        aiAbortControllerRef.current = null;
      },
      (errorMsg) => {
        // If controller was already cleared by handleAiCancel, this is a late abort echo — ignore
        if (!aiAbortControllerRef.current) return;
        if (activeSessionRef.current !== sessionAtSendTime) return;
        if (aiAccumulatedRef.current) {
          setAiMessages(msgs => [...msgs, { role: 'assistant', content: aiAccumulatedRef.current }]);
        }
        setAiError(typeof errorMsg === 'string' ? errorMsg : 'An error occurred');
        setAiStreaming(false);
        setAiStreamingContent('');
        setActiveToolCalls([]);
        aiAbortControllerRef.current = null;
      },
      // Tool calling callbacks
      (toolCall) => {
        if (activeSessionRef.current !== sessionAtSendTime) return;
        setActiveToolCalls(prev => [...prev, { name: toolCall.name, status: 'calling', id: Date.now() + '_' + prev.length }]);
      },
      (toolResult) => {
        if (activeSessionRef.current !== sessionAtSendTime) return;
        setTimeout(() => {
          let matchedId = null;
          setActiveToolCalls(prev => {
            let matched = false;
            return prev.map(tc => {
              if (!matched && tc.name === toolResult.name && tc.status === 'calling') {
                matched = true;
                matchedId = tc.id;
                return { ...tc, status: 'done' };
              }
              return tc;
            });
          });
          // Show checkmark, then fade out, then remove
          setTimeout(() => {
            setActiveToolCalls(prev => prev.map(tc => tc.id === matchedId ? { ...tc, status: 'fading' } : tc));
            setTimeout(() => setActiveToolCalls(prev => prev.filter(tc => tc.id !== matchedId)), 300);
          }, 600);
        }, 800);
      }
    );

    aiAbortControllerRef.current = controller;
  }, [aiInput, aiMessages, task?.id, user?.id, activeSessionId, loadSolverSessions]);

  // Keep ref in sync so PTT auto-submit can call handleAiSend without stale closures
  useEffect(() => { handleAiSendRef.current = handleAiSend; }, [handleAiSend]);

  const handleAiCancel = useCallback(() => {
    // Keep partial content as-is (no marker text) — mirrors PA cancel pattern
    if (aiAccumulatedRef.current) {
      setAiMessages(msgs => [...msgs, { role: 'assistant', content: aiAccumulatedRef.current }]);
    }
    setActiveToolCalls([]);
    abortAiStream();
  }, [abortAiStream]);

  // Load most recent conversation when AI Solver tab is first opened
  // (session list already loaded in the main Promise.all above)
  const solverSessionsRef = useRef(solverSessionsList);
  solverSessionsRef.current = solverSessionsList;

  useEffect(() => {
    if (activeTab !== 'ai-solver' || !task?.id || !user?.id) return;
    if (initialSessionLoadedRef.current) return;

    let cancelled = false;
    initialSessionLoadedRef.current = true;
    setSolverInitialLoading(true);

    (async () => {
      try {
        // Use already-loaded sessions from Promise.all, fallback to fetch
        const cached = solverSessionsRef.current;
        const sessions = cached.length > 0
          ? cached
          : await solverSessions.list(task.id, user.id, '').catch(() => []);
        if (cancelled) return;
        if (sessions !== cached) setSolverSessionsList(sessions);

        if (sessions.length > 0 && sessions[0].message_count > 0) {
          const mostRecent = sessions[0];
          const data = await solverSessions.get(task.id, mostRecent.id, user.id);
          if (cancelled) return;
          setActiveSessionId(mostRecent.id);
          setAiMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
        }
      } catch (e) {
        console.error('Failed to load solver sessions:', e);
      } finally {
        if (!cancelled) setSolverInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, task?.id, user?.id]);

  const handleSwitchSession = useCallback(async (sessionId) => {
    if (sessionId === activeSessionId) {
      setShowSessionDropdown(false);
      return;
    }
    // Abort any in-flight stream before switching — mirrors PA's switchToSession
    abortAiStream();
    // Optimistically update ref so late callbacks from the old stream are discarded
    activeSessionRef.current = sessionId;
    setActiveSessionId(sessionId);
    setAiError(null);
    setAiUserScrolled(false);
    setShowSessionDropdown(false);

    // Use cache if available — instant switch
    const cached = sessionMessagesCacheRef.current[sessionId];
    if (cached) {
      setAiMessages(cached);
      return;
    }

    // Otherwise fetch from API
    try {
      const data = await solverSessions.get(task.id, sessionId, user.id);
      // Guard: user may have switched again while we were loading
      if (activeSessionRef.current !== sessionId) return;
      const msgs = data.messages.map(m => ({ role: m.role, content: m.content }));
      setAiMessages(msgs);
      // Cache sync handled by useEffect on [activeSessionId, aiMessages]
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }, [activeSessionId, task?.id, user?.id, abortAiStream]);

  const handleNewSession = useCallback(() => {
    abortAiStream();
    setActiveSessionId(null);
    setAiMessages([]);
    setAiError(null);
    setAiUserScrolled(false);
    setShowSessionDropdown(false);
  }, [abortAiStream]);

  const handleDeleteSession = useCallback(async (e, sessionId) => {
    e.stopPropagation();
    try {
      await solverSessions.delete(task.id, sessionId, user.id);
      setSolverSessionsList(prev => prev.filter(s => s.id !== sessionId));
      delete sessionMessagesCacheRef.current[sessionId];
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setAiMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [task?.id, user?.id, activeSessionId]);

  // Close session dropdown on outside click
  useEffect(() => {
    if (!showSessionDropdown) return;
    const handleClick = (e) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target)) {
        setShowSessionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSessionDropdown]);

  // Auto-scroll AI messages — mirrors PA: only scroll if user hasn't scrolled up
  useEffect(() => {
    if (!aiUserScrolled && aiMessagesEndRef.current) {
      aiMessagesEndRef.current.scrollIntoView({ behavior: aiStreaming ? 'auto' : 'smooth' });
    }
  }, [aiMessages, aiStreamingContent, aiStreaming, aiUserScrolled]);

  if (!task) return null;

  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  const handleSave = async () => {
    // Normalize due_date: YYYY-MM-DD for valid dates, "clear" to remove, omit if unchanged
    const rawDate = editedTask.due_date;
    let dueDate;
    if (rawDate && typeof rawDate === 'string' && rawDate.includes('T')) {
      dueDate = rawDate.split('T')[0];
    } else if (rawDate) {
      dueDate = rawDate;
    } else if (task.due_date && !rawDate) {
      // User cleared the date — tell backend to remove it
      dueDate = 'clear';
    }
    // else: both null/empty → omit (no change)

    const payload = {
      title: editedTask.title,
      description: editedTask.description || null,
      status: editedTask.status,
      priority: editedTask.priority,
      category: editedTask.category || null,
    };
    if (dueDate !== undefined) payload.due_date = dueDate;

    await onUpdate(task.id, payload);
    setIsEditing(false);
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    setNewComment('');
    try {
      const saved = await todos.addComment(task.id, text, user?.id || 1);
      setComments(prev => [...prev, saved]);
      setCommentsPage(1);
    } catch (err) {
      setNewComment(text);
      console.error('Failed to save comment:', err);
    }
  };

  const processFiles = async (files) => {
    if (!files.length) return;
    setUploadingAttachment(true);
    try {
      const results = await Promise.allSettled(
        files.map(file => todos.uploadAttachment(task.id, user?.id || 1, file))
      );
      const succeeded = [];
      const failed = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          succeeded.push(result.value);
        } else {
          failed.push(files[i].name);
        }
      });
      if (succeeded.length) {
        setAttachments(prev => [...prev, ...succeeded]);
        setAttachmentsPage(1);
      }
      if (failed.length) {
        alert(`Failed to upload: ${failed.join(', ')}`);
      }
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e) => {
    processFiles(Array.from(e.target.files));
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounter.current = 0;
    setDragOverUpload(false);
    if (uploadingAttachment) return;
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleUploadDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverUpload(true);
    }
  };

  const handleUploadDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleUploadDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounter.current--;
    if (uploadDragCounter.current === 0) {
      setDragOverUpload(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      await todos.deleteAttachment(task.id, attachmentId, user?.id || 1);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      setAttachmentsPage(prev => {
        const maxPage = Math.ceil((attachments.length - 1) / DETAIL_ITEMS_PER_PAGE) || 1;
        return prev > maxPage ? maxPage : prev;
      });
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const handlePreviewAttachment = (attachment) => {
    const newTab = window.open('', '_blank');
    fetch(attachment.url)
      .then(r => r.blob())
      .then(blob => { newTab.location = URL.createObjectURL(blob); })
      .catch(() => { newTab.location = attachment.url; });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusLabel = (status) => {
    const labels = {
      none: 'No Status',
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done',
      delayed: 'Delayed',
    };
    return labels[status] || status;
  };

  const tabs = [
    { id: 'details', label: 'Details', icon: DocumentTextIcon },
    { id: 'ai-solver', label: 'AI Solver', icon: SparklesIcon },
    { id: 'comments', label: 'Comments', icon: ChatBubbleLeftRightIcon, count: detailDataLoaded ? comments.length : undefined },
    { id: 'attachments', label: 'Attachments', icon: PaperClipIcon, count: detailDataLoaded ? attachments.length : undefined },
    { id: 'activity', label: 'Activities', icon: ClockIcon, count: detailDataLoaded ? activities.length : undefined },
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <span className="text-sm font-mono font-semibold text-gray-700">TASK-{task.id}</span>
              </div>
              {task.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold capitalize">
                  {(task.external_source === 'gmail' || task.external_source === 'ai_extracted_email') && <EnvelopeIcon className="w-3 h-3 text-red-500" />}
                  {(task.external_source === 'calendar' || task.external_source === 'ai_extracted_calendar') && <CalendarIcon className="w-3 h-3 text-blue-500" />}
                  {task.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {getStatusLabel(task.status)}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${priority.bg} ${priority.text}`}>
                <FlagIcon className="w-3 h-3" />
                {priority.label}
              </span>
              {task.external_source && !task.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                  {(task.external_source === 'gmail' || task.external_source === 'ai_extracted_email') && <EnvelopeIcon className="w-3 h-3 text-red-500" />}
                  {(task.external_source === 'calendar' || task.external_source === 'ai_extracted_calendar') && <CalendarIcon className="w-3 h-3 text-blue-500" />}
                  <span className="capitalize">
                    {task.external_source.replace('ai_extracted_', '').replace('_', ' ')}
                  </span>
                </span>
              )}
              {task.external_url && (
                <a href={task.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1.5 text-blue-500 hover:text-blue-700">
                  <LinkIcon className="w-3.5 h-3.5" />
                </a>
              )}
              {isOverdue && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Overdue
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2.5 rounded-lg transition-colors ${isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                title="Edit"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this task?')) {
                    onDelete(task.id);
                  }
                }}
                className="p-2.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <TrashIcon className="w-5 h-5 text-red-500" />
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close (ESC)"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="px-5 pb-4">
            {isEditing ? (
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full text-2xl font-semibold text-gray-900 border-b-2 border-blue-500 focus:outline-none pb-1 bg-transparent"
                autoFocus
              />
            ) : (
              <h2 className="text-2xl font-semibold text-gray-900">{task.title}</h2>
            )}
          </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Task metadata — unified compact grid */}
            <div className="grid grid-cols-3 gap-3">
              {/* Status */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ListBulletIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</span>
                </div>
                {isEditing ? (
                  <select
                    value={editedTask.status}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{getStatusLabel(task.status)}</p>
                )}
              </div>
              {/* Priority */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <FlagIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Priority</span>
                </div>
                {isEditing ? (
                  <select
                    value={editedTask.priority}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                ) : (
                  <p className={`text-sm font-medium ${priority.text}`}>{priority.label}</p>
                )}
              </div>
              {/* Due Date */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Due</span>
                </div>
                {isEditing ? (
                  <DatePicker
                    selected={editedTask.due_date ? new Date(editedTask.due_date) : null}
                    onChange={(date) => setEditedTask(prev => ({ ...prev, due_date: date ? formatDate(date) : '' }))}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Select"
                    isClearable
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                    calendarClassName="extraction-datepicker"
                  />
                ) : (
                  <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : <span className="text-gray-300 font-normal">—</span>
                    }
                  </p>
                )}
              </div>
              {/* Category */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Category</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTask.category || ''}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                    placeholder="Category"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800">
                    {task.category || <span className="text-gray-300 font-normal">—</span>}
                  </p>
                )}
              </div>
              {/* Created */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Created</span>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {task.created_at
                    ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'
                  }
                </p>
              </div>
            </div>

            {/* AI Priority Reasoning */}
            {task.ai_priority_reasoning && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl">
                <LightBulbIcon className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-violet-700 leading-relaxed">{task.ai_priority_reasoning}</p>
              </div>
            )}

            {/* Notes — always shown when description exists or editing */}
            {(isEditing || task.description) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                {isEditing ? (
                  <MarkdownEditor
                    textareaRef={detailNotesRef}
                    value={editedTask.description || ''}
                    onValueChange={(v) => setEditedTask(prev => ({ ...prev, description: v }))}
                    rows={4}
                  />
                ) : descriptionIsHtml ? (
                  <div
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                  />
                ) : (
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 prose prose-sm max-w-none">
                    <ReactMarkdown>{task.description}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* AI Summary */}
            <AISummarySection
              taskId={task.id}
              bullets={bullets}
              loading={bulletsLoading}
              error={bulletsError}
              fetchBullets={fetchBullets}
            />
          </div>
        )}

        {/* AI Solver Tab */}
        {activeTab === 'ai-solver' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Session Bar */}
            {solverSessionsList.length > 0 && (
              <div className="relative flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex-shrink-0" ref={sessionDropdownRef}>
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <button
                  onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                  className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 truncate min-w-0 flex-1"
                >
                  <span className="truncate">
                    {activeSessionId
                      ? (solverSessionsList.find(s => s.id === activeSessionId)?.title || 'Conversation')
                      : 'New conversation'}
                  </span>
                  <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${showSessionDropdown ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={handleNewSession}
                  className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors flex-shrink-0"
                  title="New conversation"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>

                {/* Session Dropdown */}
                {showSessionDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-0.5 mx-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={sessionSearch}
                        onChange={(e) => {
                          setSessionSearch(e.target.value);
                          loadSolverSessions(e.target.value);
                        }}
                        placeholder="Search conversations..."
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {sessionsLoading ? (
                        <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading...</div>
                      ) : solverSessionsList.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-gray-400 text-center">No conversations found</div>
                      ) : (
                        solverSessionsList.map(session => (
                          <div
                            key={session.id}
                            onClick={() => handleSwitchSession(session.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                              session.id === activeSessionId ? 'bg-purple-50' : ''
                            }`}
                            role="option"
                            aria-selected={session.id === activeSessionId}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-gray-700 truncate">{session.title}</div>
                              <div className="text-xs text-gray-400">{session.message_count} messages</div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0 ml-2"
                              title="Delete conversation"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions — shown only when conversation is empty and not loading */}
            {aiMessages.length === 0 && !aiStreaming && !solverInitialLoading && (
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'suggest_approach', label: 'Suggest Approach', icon: LightBulbIcon, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
                    { key: 'break_down', label: 'Break Down', icon: ListBulletIcon, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
                    { key: 'estimate_time', label: 'Estimate Time', icon: ClockIcon, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' },
                    { key: 'identify_blockers', label: 'Identify Blockers', icon: ShieldExclamationIcon, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
                  ].map(action => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.key}
                        onClick={() => handleAiSend(null, action.key)}
                        className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border rounded-lg transition-colors ${action.color}`}
                      >
                        <ActionIcon className="w-4 h-4 flex-shrink-0" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div
              ref={aiChatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              onScroll={() => {
                const container = aiChatContainerRef.current;
                if (container) {
                  const { scrollTop, scrollHeight, clientHeight } = container;
                  const isAtBottom = scrollHeight - scrollTop <= clientHeight + 5;
                  setAiUserScrolled(!isAtBottom);
                }
              }}
            >
              {aiMessages.length === 0 && !aiStreaming && (
                solverInitialLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-3" />
                    <p className="text-xs text-gray-400">Loading conversation...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <SparklesIcon className="w-10 h-10 mb-3 text-purple-300" />
                    <p className="text-sm font-medium text-gray-500">AI Task Solver</p>
                    <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
                      Ask questions about this task, get suggestions, or use quick actions above.
                    </p>
                  </div>
                )
              )}

              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <SparklesIcon className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                  )}
                  <div className={`flex flex-col min-w-0 ${msg.role === 'user' ? 'items-end flex-1' : 'items-start flex-1'}`}>
                    {/* Edit mode for user messages — mirrors PA's inline edit */}
                    {editingMessageIndex === idx && msg.role === 'user' ? (
                      <div className="w-full px-3.5 py-2.5 rounded-2xl rounded-br-md bg-blue-600 text-white">
                        <textarea
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEditedMessage(idx); }
                            if (e.key === 'Escape') cancelEditMessage();
                          }}
                          className="w-full bg-white text-gray-800 p-3 rounded-lg border-none resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm leading-relaxed"
                          rows={Math.max(4, Math.min(12, editInput.split('\n').length))}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={cancelEditMessage} className="px-3 py-1.5 text-xs bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">Cancel</button>
                          <button onClick={() => submitEditedMessage(idx)} disabled={!editInput.trim()} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md max-w-[85%] w-fit'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md max-w-[85%]'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <MessageRenderer content={msg.content} className="text-sm" />
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>
                    )}
                    {/* Action buttons — mirrors PA: copy (all), edit (user only) */}
                    {editingMessageIndex !== idx && (
                      <div className={`mt-1 flex space-x-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <button
                          onClick={() => copyToClipboard(msg.content, idx)}
                          className={`p-1 rounded transition-colors ${copiedMessageIds.includes(idx) ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'}`}
                          title="Copy message"
                        >
                          {copiedMessageIds.includes(idx) ? (
                            <CheckIcon className="w-3.5 h-3.5" />
                          ) : (
                            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {msg.role === 'user' && (
                          <button
                            onClick={() => startEditMessage(idx, msg.content)}
                            disabled={aiStreaming}
                            className={`p-1 rounded transition-colors ${aiStreaming ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'}`}
                            title={aiStreaming ? 'Cannot edit while generating' : 'Edit message'}
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Tool call indicators — vertical, slide-in/out like ChatGPT */}
              {activeToolCalls.length > 0 && (
                <div className="flex justify-start mb-1">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    <SparklesIcon className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                  </div>
                  <div className="overflow-hidden">
                    {activeToolCalls.map((tc) => (
                      <div
                        key={tc.id}
                        className={`flex items-center gap-2 h-6 text-xs transition-all duration-300 ${
                          tc.status === 'fading' ? 'opacity-0 -translate-y-1' : 'opacity-100 animate-slide-in'
                        }`}
                      >
                        {tc.status === 'calling' ? (
                          <ArrowPathIcon className="w-3 h-3 text-purple-500 animate-spin flex-shrink-0" />
                        ) : (
                          <CheckCircleIcon className="w-3 h-3 text-green-500 flex-shrink-0" />
                        )}
                        <span className={tc.status === 'calling' ? 'text-gray-600' : 'text-green-600'}>{
                          ({
                            ReadAttachment: tc.status === 'calling' ? 'Reading attachment…' : 'Read attachment',
                            GetTaskComments: tc.status === 'calling' ? 'Loading comments…' : 'Loaded comments',
                            SearchRelatedTasks: tc.status === 'calling' ? 'Searching related tasks…' : 'Searched related tasks',
                            GetTaskDetails: tc.status === 'calling' ? 'Loading task details…' : 'Loaded task details',
                            fallback: 'Responding directly…',
                          })[tc.name] || tc.name
                        }</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming indicator */}
              {aiStreaming && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <SparklesIcon className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                  </div>
                  <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 text-sm leading-relaxed">
                    {aiStreamingContent ? (
                      <MessageRenderer content={aiStreamingContent} className="text-sm" isStreaming />
                    ) : (
                      activeToolCalls.length === 0 && (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {aiError && (
                <div className="flex justify-center">
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    {aiError}
                  </div>
                </div>
              )}

              <div ref={aiMessagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-gray-200 p-3">
              <div className="flex items-end gap-1.5">
                <textarea
                  ref={aiTextareaRef}
                  value={aiInput}
                  onChange={handleAiInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!aiStreaming && !voiceActive && aiInput.trim()) {
                        handleAiSend();
                      }
                    }
                  }}
                  placeholder="Ask about this task..."
                  rows={1}
                  disabled={aiStreaming || aiOptimizing || voiceActive}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm disabled:opacity-50 disabled:bg-gray-50"
                />
                {/* Optimize button — mirrors PA */}
                <button
                  onClick={aiOptimized ? revertAiOptimization : optimizeAiInput}
                  disabled={aiStreaming || aiOptimizing || !aiInput.trim()}
                  className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                    aiStreaming || aiOptimizing || !aiInput.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : aiOptimized
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  title={aiOptimizing ? 'Optimizing...' : aiOptimized ? 'Revert to original' : 'Optimize input'}
                >
                  {aiOptimizing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : aiOptimized ? (
                    <ArrowUturnLeftIcon className="w-4 h-4" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                </button>
                {/* Voice input — mirrors PA's ChatDialog mic button */}
                <button
                  onPointerDown={handleMicDown}
                  onPointerUp={handleMicUp}
                  onPointerLeave={handleMicLeave}
                  onPointerCancel={handleMicUp}
                  onContextMenu={(e) => e.preventDefault()}
                  type="button"
                  disabled={micDisabled}
                  className={`p-2.5 rounded-xl select-none touch-none transition-all duration-150 flex-shrink-0 ${
                    micDisabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : isPTTRecording
                      ? 'bg-blue-500 text-white scale-110 ring-2 ring-blue-300 animate-pulse'
                      : isRecording
                      ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                      : isProcessing || pttProcessing
                      ? 'bg-amber-500 text-white'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                  title={
                    isPTTRecording
                      ? 'Release to transcribe'
                      : isRecording
                      ? 'Click to stop dictation'
                      : isProcessing || pttProcessing
                      ? 'Processing speech...'
                      : 'Click: dictation | Hold: push-to-talk'
                  }
                >
                  {(isProcessing || pttProcessing) ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4" />
                  )}
                </button>
                {aiStreaming ? (
                  <button
                    onClick={handleAiCancel}
                    className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex-shrink-0"
                    title="Stop generating"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAiSend()}
                    disabled={!aiInput.trim()}
                    className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Send (Enter)"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              {voiceError && (
                <p className="text-xs text-red-500 mt-1 text-left">{voiceError}</p>
              )}
              <p className="text-xs text-gray-400 mt-1.5 text-right">Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Add Comment */}
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  Y
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto mb-2" />
                    <p>No comments yet</p>
                  </div>
                ) : (
                  pagedComments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        Y
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">You</span>
                          <span className="text-xs text-gray-500">
                            {comment.created_at && new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {comments.length > DETAIL_ITEMS_PER_PAGE && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">{(commentsPage - 1) * DETAIL_ITEMS_PER_PAGE + 1}–{Math.min(commentsPage * DETAIL_ITEMS_PER_PAGE, comments.length)} of {comments.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCommentsPage(p => p - 1)} disabled={commentsPage <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeftIcon className="w-4 h-4 text-gray-600" /></button>
                  <button onClick={() => setCommentsPage(p => p + 1)} disabled={commentsPage >= Math.ceil(comments.length / DETAIL_ITEMS_PER_PAGE)} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRightIcon className="w-4 h-4 text-gray-600" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachments Tab */}
        {activeTab === 'attachments' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Upload Area */}
              <div
                onClick={() => !uploadingAttachment && fileInputRef.current?.click()}
                onDragEnter={handleUploadDragEnter}
                onDragOver={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  uploadingAttachment ? 'border-blue-300 bg-blue-50/50 cursor-wait'
                  : dragOverUpload ? 'border-blue-500 bg-blue-100/60 scale-[1.02]'
                  : 'border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'
                }`}
              >
                {uploadingAttachment ? (
                  <>
                    <ArrowPathIcon className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-blue-600">Uploading...</p>
                  </>
                ) : dragOverUpload ? (
                  <>
                    <ArrowDownTrayIcon className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-bounce" />
                    <p className="text-sm text-blue-600 font-medium">Drop files here</p>
                  </>
                ) : (
                  <>
                    <PaperClipIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF, DOCX, TXT up to 10MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                />
              </div>

              {/* Attachments List */}
              <div className="space-y-2">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <PaperClipIcon className="w-8 h-8 mx-auto mb-2" />
                    <p>No attachments yet</p>
                  </div>
                ) : (
                  pagedAttachments.map(attachment => (
                    <div key={attachment.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{attachment.original_filename}</p>
                            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                              {attachment.created_at && (
                                <span>{new Date(attachment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              )}
                              {attachment.file_size && <span>{formatFileSize(attachment.file_size)}</span>}
                              <span className="uppercase font-medium">{attachment.file_type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={() => handlePreviewAttachment(attachment)}
                            className="inline-flex items-center px-2 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <EyeIcon className="h-3 w-3 mr-1" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="inline-flex items-center px-2 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
                          >
                            <TrashIcon className="h-3 w-3 mr-1" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {attachments.length > DETAIL_ITEMS_PER_PAGE && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">{(attachmentsPage - 1) * DETAIL_ITEMS_PER_PAGE + 1}–{Math.min(attachmentsPage * DETAIL_ITEMS_PER_PAGE, attachments.length)} of {attachments.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAttachmentsPage(p => p - 1)} disabled={attachmentsPage <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeftIcon className="w-4 h-4 text-gray-600" /></button>
                  <button onClick={() => setAttachmentsPage(p => p + 1)} disabled={attachmentsPage >= Math.ceil(attachments.length / DETAIL_ITEMS_PER_PAGE)} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRightIcon className="w-4 h-4 text-gray-600" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {pagedActivities.map(activity => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      {activity.type === 'created' && <PlusIcon className="w-4 h-4 text-green-600" />}
                      {activity.type === 'commented' && <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-600" />}
                      {activity.type === 'attachment' && <PaperClipIcon className="w-4 h-4 text-blue-600" />}
                      {activity.type === 'solver' && <BoltIcon className="w-4 h-4 text-indigo-600" />}
                      {activity.type === 'ai_prioritized' && <SparklesIcon className="w-4 h-4 text-amber-600" />}
                      {activity.type === 'completed' && <CheckCircleIcon className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">{activity.user}</span>
                        {' '}{activity.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {activities.length > DETAIL_ITEMS_PER_PAGE && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">{(activityPage - 1) * DETAIL_ITEMS_PER_PAGE + 1}–{Math.min(activityPage * DETAIL_ITEMS_PER_PAGE, activities.length)} of {activities.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setActivityPage(p => p - 1)} disabled={activityPage <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeftIcon className="w-4 h-4 text-gray-600" /></button>
                  <button onClick={() => setActivityPage(p => p + 1)} disabled={activityPage >= Math.ceil(activities.length / DETAIL_ITEMS_PER_PAGE)} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRightIcon className="w-4 h-4 text-gray-600" /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {isEditing && (
        <div className="flex-shrink-0 p-5 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => {
              setEditedTask(task);
              setIsEditing(false);
            }}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      )}
      </div>
    </div>
  );
};