/**
 * WorkAgent Component - Enterprise Work Management System
 *
 * Subtabs Architecture:
 * 1. Inbox - Unified message center (Email, Communication, Task Tracker)
 * 2. Tasks - Multi-source task center with Triage, Backlog, Board views
 * 3. Scheduler - Full calendar view with AI scheduling
 * 4. Tools - Work tools (Notebook, etc.)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import {
  // Navigation & Layout
  InboxIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  LightBulbIcon,
  FolderIcon,
  CogIcon,
  Squares2X2Icon,
  ListBulletIcon,
  // Actions
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  EllipsisHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  PlayIcon,
  PauseIcon,
  PaperAirplaneIcon,
  ArrowUturnLeftIcon,
  ArchiveBoxIcon,
  BellSnoozeIcon,
  DocumentDuplicateIcon,
  PencilSquareIcon,
  // Status & Priority
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  // Sources
  EnvelopeIcon,
  EnvelopeOpenIcon,
  ChatBubbleLeftRightIcon,
  TicketIcon,
  CalendarIcon,
  UserIcon,
  UsersIcon,

  BellIcon,
  HashtagIcon,
  AtSymbolIcon,
  // Other
  ArrowsRightLeftIcon,
  ChartBarIcon,
  BoltIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  AdjustmentsHorizontalIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  LinkIcon,
  BeakerIcon,
  CheckIcon,
  XMarkIcon,
  PaperClipIcon,
  PhotoIcon,
  StarIcon,
  TagIcon,
  HandThumbUpIcon,
  ArrowPathRoundedSquareIcon,
  // AI Features
  LanguageIcon,
  ShieldExclamationIcon,
  DocumentMagnifyingGlassIcon,
  FaceSmileIcon,
  AcademicCapIcon,
  ScissorsIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckBadgeIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  MicrophoneIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  StarIcon as StarSolidIcon,
  FlagIcon as FlagSolidIcon,
  EnvelopeIcon as EnvelopeSolidIcon,
  InboxIcon as InboxSolidIcon,
} from '@heroicons/react/24/solid';
import { oauth, gmail, calendar as calendarApi, sources as sourcesApi, emailAI, todos, taskExtraction, taskPrioritization, taskScheduler, taskSolver, solverSessions } from '../../services/workApi';
import { useVoiceDictation } from '../../hooks/useVoiceDictation';
import { usePressTalk } from '../../hooks/usePressTalk';
import axios from 'axios';
import MessageRenderer from '../chat/MessageRenderer';
import MessageDetailPanel from './MessageDetailPanel';
import TriageDetailPanel from './TriageDetailPanel';
import CalendarView from './CalendarView';
import AIPrioritizeModal from './AIPrioritizeModal';
import { useBullets, AISummarySection } from './AISummarySection';
import TaskPrioritizationView from './TaskPrioritizationView';
import { NotebookView } from './notebook';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
// Lucide icons for priority (Plane-style)
import {
  AlertCircle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Ban,
  ListFilter
} from 'lucide-react';
import emailIcon from '../../assets/email10.png';
import composeIcon from '../../assets/pencil1.png';
import inboxIcon from '../../assets/mail-in1.png';

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

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUBTABS = [
  { id: 'tasks', name: 'Tasks', icon: ClipboardDocumentListIcon, description: 'All your tasks from every source' },
  { id: 'schedule', name: 'Scheduler', icon: CalendarDaysIcon, description: 'Calendar & AI scheduling' },
];

// Task sources - must match backend source_type values
const TASK_SOURCES = [
  { id: 'all', name: 'All Sources', icon: Squares2X2Icon, color: 'gray' },
  { id: 'email', name: 'Email', icon: EnvelopeIcon, color: 'red' },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon, color: 'green' },
  { id: 'gtask', name: 'Google Tasks', icon: ClipboardDocumentListIcon, color: 'blue' },
];

const PRIORITIES = {
  urgent: { label: 'Urgent', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  high: { label: 'High', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  low: { label: 'Low', color: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  none: { label: 'None', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

// Plane-style priority groups for backlog grouping
const PRIORITY_GROUPS = [
  { id: 'urgent', label: 'Urgent', color: '#ef4444', bgClass: 'bg-red-100 text-red-700' },
  { id: 'high', label: 'High', color: '#f97316', bgClass: 'bg-orange-100 text-orange-700' },
  { id: 'medium', label: 'Medium', color: '#eab308', bgClass: 'bg-amber-100 text-amber-700' },
  { id: 'low', label: 'Low', color: '#22c55e', bgClass: 'bg-green-100 text-green-700' },
  { id: 'none', label: 'No Priority', color: '#6b7280', bgClass: 'bg-gray-100 text-gray-500' },
];

const KANBAN_COLUMNS = [
  { id: 'todo', name: 'To Do', color: 'blue' },
  { id: 'in_progress', name: 'In Progress', color: 'yellow' },
  { id: 'review', name: 'Review', color: 'purple' },
  { id: 'done', name: 'Done', color: 'green' },
  { id: 'delayed', name: 'Delayed', color: 'gray' },
];

// Statuses eligible for AI scheduling (excludes done, delayed)
const SCHEDULABLE_STATUSES = new Set(['todo', 'in_progress', 'review']);

// ============================================================================
// NOTE: Mock data has been removed - all components now use real API data
// ============================================================================

// Shared task state across TasksView and ScheduleView
const SharedTasksContext = createContext({ tasks: [], setTasks: () => {}, refreshTasks: () => {} });

// Inbox Configuration - 4 Main Categories with Dropdown Sources
const SOURCE_CATEGORIES = [
  {
    id: 'email',
    name: 'Email',
    icon: EnvelopeIcon,
    color: 'red',
    bgColor: 'bg-red-50',
    activeColor: 'bg-red-500',
    sources: [
      { id: 'gmail', name: 'Gmail', icon: EnvelopeIcon, color: 'red', status: 'connected' },
      { id: 'outlook', name: 'Outlook', icon: EnvelopeIcon, color: 'blue', status: 'connected' },
      // Future: Yahoo, ProtonMail, iCloud Mail, etc.
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: CalendarIcon,
    color: 'green',
    bgColor: 'bg-green-50',
    activeColor: 'bg-green-500',
    sources: [
      { id: 'google_calendar', name: 'Google Calendar', icon: CalendarIcon, color: 'blue', status: 'connected' },
      { id: 'outlook_calendar', name: 'Outlook Calendar', icon: CalendarIcon, color: 'blue', status: 'not_connected' },
      // Future: Apple Calendar, etc.
    ],
  },
  {
    id: 'communication',
    name: 'Communication',
    icon: ChatBubbleLeftRightIcon,
    color: 'purple',
    bgColor: 'bg-purple-50',
    activeColor: 'bg-purple-500',
    sources: [
      { id: 'slack', name: 'Slack', icon: HashtagIcon, color: 'purple', status: 'connected' },
      { id: 'teams', name: 'Microsoft Teams', icon: ChatBubbleLeftRightIcon, color: 'indigo', status: 'connected' },
      // Future: Discord, Google Chat, WhatsApp Business, etc.
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: TicketIcon,
    color: 'blue',
    bgColor: 'bg-blue-50',
    activeColor: 'bg-blue-500',
    sources: [
      { id: 'jira', name: 'Jira', icon: TicketIcon, color: 'blue', status: 'connected' },
      { id: 'github', name: 'GitHub', icon: TicketIcon, color: 'gray', status: 'not_connected' },
      // Future: Asana, Trello, Linear, Notion, etc.
    ],
  },
];

// System notifications (always included, not filterable)
const SYSTEM_SOURCE = { id: 'work_agent', name: 'System', icon: SparklesIcon, color: 'orange' };

// All available integrations for "Add Sources" modal
const AVAILABLE_INTEGRATIONS = {
  email: {
    name: 'Email Providers',
    description: 'Connect your email accounts to see messages in your inbox',
    icon: EnvelopeIcon,
    color: 'red',
    integrations: [
      { id: 'gmail', name: 'Gmail', description: 'Google Workspace & personal accounts', icon: EnvelopeIcon, color: 'red', authType: 'oauth', oauthProvider: 'google' },
      { id: 'outlook', name: 'Outlook', description: 'Microsoft 365 & Outlook.com', icon: EnvelopeIcon, color: 'blue', authType: 'oauth', oauthProvider: 'microsoft' },
      { id: 'yahoo', name: 'Yahoo Mail', description: 'Yahoo personal & business', icon: EnvelopeIcon, color: 'purple', authType: 'oauth', oauthProvider: 'yahoo', comingSoon: true },
      { id: 'protonmail', name: 'ProtonMail', description: 'Encrypted email service', icon: EnvelopeIcon, color: 'indigo', authType: 'oauth', oauthProvider: 'proton', comingSoon: true },
    ],
  },
  calendar: {
    name: 'Calendar',
    description: 'Sync your calendars for scheduling and meeting notifications',
    icon: CalendarIcon,
    color: 'green',
    integrations: [
      { id: 'google_calendar', name: 'Google Calendar', description: 'Google Workspace calendars', icon: CalendarIcon, color: 'blue', authType: 'oauth', oauthProvider: 'google' },
      { id: 'outlook_calendar', name: 'Outlook Calendar', description: 'Microsoft 365 calendars', icon: CalendarIcon, color: 'blue', authType: 'oauth', oauthProvider: 'microsoft' },
      { id: 'apple_calendar', name: 'Apple Calendar', description: 'iCloud calendars', icon: CalendarIcon, color: 'gray', authType: 'oauth', oauthProvider: 'apple', comingSoon: true },
    ],
  },
  communication: {
    name: 'Communication Platforms',
    description: 'Get notified about messages and mentions from team chat',
    icon: ChatBubbleLeftRightIcon,
    color: 'purple',
    integrations: [
      { id: 'slack', name: 'Slack', description: 'Channels, DMs, and mentions', icon: HashtagIcon, color: 'purple', authType: 'oauth', oauthProvider: 'slack' },
      { id: 'teams', name: 'Microsoft Teams', description: 'Teams chats and channels', icon: ChatBubbleLeftRightIcon, color: 'indigo', authType: 'oauth', oauthProvider: 'microsoft' },
      { id: 'discord', name: 'Discord', description: 'Server messages and DMs', icon: ChatBubbleLeftRightIcon, color: 'indigo', authType: 'oauth', oauthProvider: 'discord', comingSoon: true },
    ],
  },
  projects: {
    name: 'Project Management',
    description: 'Track issues, tasks, and project updates',
    icon: TicketIcon,
    color: 'blue',
    integrations: [
      { id: 'jira', name: 'Jira', description: 'Atlassian Jira issues', icon: TicketIcon, color: 'blue', authType: 'oauth', oauthProvider: 'atlassian' },
      { id: 'github', name: 'GitHub', description: 'Issues, PRs, and notifications', icon: TicketIcon, color: 'gray', authType: 'oauth', oauthProvider: 'github' },
      { id: 'asana', name: 'Asana', description: 'Tasks and projects', icon: TicketIcon, color: 'orange', authType: 'oauth', oauthProvider: 'asana', comingSoon: true },
      { id: 'linear', name: 'Linear', description: 'Modern issue tracking', icon: TicketIcon, color: 'indigo', authType: 'oauth', oauthProvider: 'linear', comingSoon: true },
      { id: 'notion', name: 'Notion', description: 'Database and page updates', icon: TicketIcon, color: 'gray', authType: 'oauth', oauthProvider: 'notion', comingSoon: true },
    ],
  },
};

// Get all source IDs for quick lookup
const getAllSourceIds = () => {
  const ids = ['work_agent'];
  SOURCE_CATEGORIES.forEach(cat => {
    cat.sources.forEach(s => ids.push(s.id));
  });
  return ids;
};

const MESSAGE_CATEGORIES = {
  action_required: { label: 'Action Required', color: 'red', icon: ExclamationCircleIcon },
  meeting: { label: 'Meeting', color: 'blue', icon: CalendarIcon },
  invoice: { label: 'Invoice', color: 'green', icon: DocumentTextIcon },
  fyi: { label: 'FYI', color: 'gray', icon: InformationCircleIcon },
  newsletter: { label: 'Newsletter', color: 'purple', icon: EnvelopeIcon },
  legal: { label: 'Legal', color: 'yellow', icon: ShieldCheckIcon },
  personal: { label: 'Personal', color: 'pink', icon: UserIcon },
};

const AI_TONES = [
  { id: 'formal', name: 'Formal', description: 'Professional and business-like' },
  { id: 'concise', name: 'Concise', description: 'Brief and to the point' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and approachable' },
  { id: 'technical', name: 'Technical', description: 'Detailed and precise' },
];

// Note: All mock data has been removed - components now use real API data

const SNOOZE_OPTIONS = [
  { id: 'later_today', label: 'Later Today', time: '4 hours' },
  { id: 'tomorrow', label: 'Tomorrow', time: '9:00 AM' },
  { id: 'next_week', label: 'Next Week', time: 'Monday 9:00 AM' },
  { id: 'custom', label: 'Custom...', time: null },
];

const KEYBOARD_SHORTCUTS = [
  { key: 'j', action: 'Next message' },
  { key: 'k', action: 'Previous message' },
  { key: 'r', action: 'Reply' },
  { key: 'a', action: 'Archive' },
  { key: 's', action: 'Snooze' },
  { key: 't', action: 'Create task' },
  { key: '/', action: 'Search' },
  { key: 'Esc', action: 'Close panel' },
];

// ============================================================================
// SUBTAB COMPONENTS
// ============================================================================

// --------------------------------------------------------------------------
// INBOX SUBTAB
// --------------------------------------------------------------------------
const InboxView = ({ activeInboxSubtab = 'email' }) => {
  // Get current user from AuthContext
  const { user } = useAuth();

  // Selected sources per category (multi-select within each dropdown)
  const [selectedSources, setSelectedSources] = useState(() => {
    // Default: all connected sources are selected
    const initial = {};
    SOURCE_CATEGORIES.forEach(cat => {
      initial[cat.id] = cat.sources.filter(s => s.status === 'connected').map(s => s.id);
    });
    return initial;
  });
  const [openDropdown, setOpenDropdown] = useState(null); // Which dropdown is open
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageBodyLoading, setMessageBodyLoading] = useState(false); // Loading state for full message content
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryLength, setSummaryLength] = useState('standard');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [smartFilter, setSmartFilter] = useState('all'); // all, important_urgent, high_impact

  // Image Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState(null); // { src, alt } or null
  const [connectingSource, setConnectingSource] = useState(null); // Source currently being connected
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Real Gmail messages state
  const [realMessages, setRealMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [oauthError, setOauthError] = useState(null);
  const [oauthSuccess, setOauthSuccess] = useState(null);
  const [accountErrors, setAccountErrors] = useState([]); // [{email, error, is_revoked}]

  // Outlook-style folder and account selection
  const [selectedFolder, setSelectedFolder] = useState('INBOX'); // INBOX, SENT, DRAFT, TRASH, SPAM, STARRED, IMPORTANT, ARCHIVE
  const [selectedAccountId, setSelectedAccountId] = useState('all'); // 'all' or specific account id
  const [folderCounts, setFolderCounts] = useState({}); // Unread counts per folder

  // Pagination state
  const [nextPageToken, setNextPageToken] = useState(null); // For loading more messages (single account)
  const [accountPageTokens, setAccountPageTokens] = useState(null); // For multi-account pagination (All Accounts)
  const [hasMoreMessages, setHasMoreMessages] = useState(false); // Whether more messages can be loaded
  const [loadingMore, setLoadingMore] = useState(false);

  // Compose modal state
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeMode, setComposeMode] = useState('new'); // 'new', 'reply', 'replyAll', 'forward'
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    replyToMessageId: null,
    threadId: null,
    originalMessage: null,
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'star', 'trash', 'archive', etc.

  // Restore to original - tracks the initial body when compose modal opens
  const [initialComposeBody, setInitialComposeBody] = useState('');

  // Text selection popup state
  const [textSelectionPopup, setTextSelectionPopup] = useState({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
  });
  const composeTextareaRef = useRef(null);

  // AI Preview Modal state - shows before/after with Replace/Discard
  const [aiPreviewModal, setAiPreviewModal] = useState({
    visible: false,
    originalText: '',
    modifiedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    isStreaming: false,
    actionType: '', // 'polish', 'concise', 'expand', 'spelling'
  });

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);

  // Recipient autocomplete state
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [activeRecipientField, setActiveRecipientField] = useState(null); // 'to', 'cc', 'bcc'
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [allKnownRecipients, setAllKnownRecipients] = useState([]); // Cached from all emails

  // AI Features State - Reading

  // AI Features State - Composing
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiAssistLoading, setAiAssistLoading] = useState(null);
  const [composerText, setComposerText] = useState('');

  // AI Features State - Reading
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(null);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [selectedLength, setSelectedLength] = useState('medium');
  const [selectedFormat, setSelectedFormat] = useState('paragraph');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedIntent, setSelectedIntent] = useState('Response');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showToneDropdown, setShowToneDropdown] = useState(false);
  const [showLengthDropdown, setShowLengthDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showIntentDropdown, setShowIntentDropdown] = useState(false);

  // Task from Email Modal State
  const [showTaskFromEmailModal, setShowTaskFromEmailModal] = useState(false);
  const [taskFromEmailData, setTaskFromEmailData] = useState(null);

  // Resizable panel widths
  const [sidebarWidth, setSidebarWidth] = useState(180); // Left sidebar (Accounts + Folders) - minimal
  const [messageListWidth, setMessageListWidth] = useState(300); // Message list panel - moderate

  // Refs for resize handling
  const resizeRef = useRef({
    isResizing: false,
    resizeType: null, // 'sidebar' or 'messageList'
    startX: 0,
    startWidth: 0,
  });

  // Refs for infinite scroll
  const scrollSentinelRef = useRef(null);
  const messageListContainerRef = useRef(null); // Scroll container for infinite scroll
  const isLoadingMoreRef = useRef(false); // Prevent race conditions
  const canLoadMoreRef = useRef(true); // Cooldown flag to prevent rapid triggers

  // Prefetch cache — stores full message bodies fetched on hover (keyed by message id)
  // Uses a ref so prefetches never trigger re-renders
  const prefetchCacheRef = useRef(new Map());
  const prefetchInFlightRef = useRef(new Set()); // Prevent duplicate fetches
  const expectedMessageIdRef = useRef(null); // Guards against stale fetchFullMessage overwrites

  // AbortController for email fetching — prevents stale responses from overwriting
  // fresh data when user switches accounts/folders quickly
  const emailFetchControllerRef = useRef(null);

  // Handle resize start
  const handleResizeStart = useCallback((e, type) => {
    e.preventDefault();
    resizeRef.current = {
      isResizing: true,
      resizeType: type,
      startX: e.clientX,
      startWidth: type === 'sidebar' ? sidebarWidth : messageListWidth,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, messageListWidth]);



  // Handle panel resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizeRef.current.isResizing) return;

      const { resizeType, startX, startWidth } = resizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = startWidth + delta;

      if (resizeType === 'sidebar') {
        setSidebarWidth(Math.max(180, Math.min(350, newWidth)));
      } else if (resizeType === 'messageList') {
        setMessageListWidth(Math.max(280, Math.min(550, newWidth)));
      }
    };

    const handleMouseUp = () => {
      if (resizeRef.current.isResizing) {
        resizeRef.current.isResizing = false;
        resizeRef.current.resizeType = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Fetch connected accounts from backend
  useEffect(() => {
    const fetchConnectedAccounts = async () => {
      if (!user?.id) return; // Don't fetch if user not logged in
      try {
        setAccountsLoading(true);
        const accounts = await oauth.getAccounts(user.id);
        // Transform backend response to match our UI format
        const transformedAccounts = accounts.map(acc => ({
          id: String(acc.id),
          sourceId: acc.provider === 'google' ? 'gmail' : acc.provider,
          email: acc.account_email,
          name: acc.account_name,
          connectedAt: acc.created_at?.split('T')[0],
          avatar: null,
          isValid: acc.is_valid,
          isRevoked: acc.is_revoked || false,
          revokedReason: acc.revoked_reason || null,
        }));
        setConnectedAccounts(transformedAccounts);
      } catch (error) {
        console.error('Error fetching connected accounts:', error);
        // Keep empty array on error
        setConnectedAccounts([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    fetchConnectedAccounts();
  }, [user?.id]);

  // Handle OAuth callback - check URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const provider = urlParams.get('provider');
    const errorMsg = urlParams.get('error');

    if (oauthStatus === 'success' && provider && user?.id) {
      setOauthSuccess(`Successfully connected ${provider === 'google' ? 'Gmail' : provider}!`);
      // Refresh connected accounts
      oauth.getAccounts(user.id).then(accounts => {
        const transformedAccounts = accounts.map(acc => ({
          id: String(acc.id),
          sourceId: acc.provider === 'google' ? 'gmail' : acc.provider,
          email: acc.account_email,
          name: acc.account_name,
          connectedAt: acc.created_at?.split('T')[0],
          avatar: null,
          isValid: acc.is_valid,
        }));
        setConnectedAccounts(transformedAccounts);
      }).catch(console.error);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Auto-dismiss success message
      setTimeout(() => setOauthSuccess(null), 5000);
    } else if (oauthStatus === 'error') {
      setOauthError(errorMsg || 'OAuth connection failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setOauthError(null), 5000);
    }
  }, [user?.id]);

  // Cache helper functions
  const getCacheKey = (folder, accountId) => `gmail_cache_${user?.id}_${folder}_${accountId}`;

  const getCachedMessages = (folder, accountId) => {
    try {
      const key = getCacheKey(folder, accountId);
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache valid for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
    return null;
  };

  const setCachedMessages = (folder, accountId, messages) => {
    try {
      const key = getCacheKey(folder, accountId);
      sessionStorage.setItem(key, JSON.stringify({
        data: messages,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore cache errors (quota exceeded, etc.)
    }
  };

  // Transform Gmail API response to match our UI format
  const transformGmailMessages = (messages) => {
    return messages.map(msg => ({
      id: msg.id,
      source: 'gmail',
      type: 'email',
      accountId: msg.account_id,
      accountEmail: msg.account_email,
      from: {
        name: msg.from?.name || msg.from?.email?.split('@')[0] || 'Unknown',
        email: msg.from?.email || '',
        avatar: null,
        isVIP: msg.from?.is_vip || false,
      },
      to: msg.to || ['me'],
      cc: msg.cc || [],
      subject: msg.subject || '(No subject)',
      preview: msg.preview || msg.snippet || '',
      body: msg.body || '',
      body_html: msg.body_html || '',
      body_plain: msg.body_plain || '',
      timestamp: msg.timestamp || msg.date,
      isRead: msg.is_read,
      isStarred: msg.is_starred || false,
      hasAttachments: msg.has_attachments || false,
      attachments: msg.attachments || [],
      category: categorizeEmail(msg),
      categoryConfidence: 75,
      priority: determinePriority(msg),
      thread: { count: 1, participants: [msg.from?.name || 'Unknown', 'You'] },
      aiSummary: {
        short: (msg.preview || msg.snippet || '').substring(0, 50) + '...',
        standard: msg.preview || msg.snippet || '',
        detailed: (msg.body || '').substring(0, 300) || '',
      },
      suggestedActions: ['Reply', 'Archive', 'Create Task'],
      labels: msg.labels || [],
      threadId: msg.thread_id,
    }));
  };

  // Fetch real Gmail messages with caching and optimistic loading
  useEffect(() => {
    // Abort any in-flight fetch from the previous account/folder switch
    if (emailFetchControllerRef.current) {
      emailFetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    emailFetchControllerRef.current = controller;

    // Clear prefetch cache — old account's message bodies are no longer valid
    prefetchCacheRef.current.clear();
    prefetchInFlightRef.current.clear();

    // Clear selected message to prevent showing stale content from old account
    setSelectedMessage(null);

    const fetchGmailMessages = async () => {
      if (!user?.id) return;
      const gmailAccounts = connectedAccounts.filter(acc => acc.sourceId === 'gmail' && acc.isValid !== false);
      if (gmailAccounts.length === 0) {
        setRealMessages([]);
        return;
      }

      // Reset pagination state when folder/account changes
      setNextPageToken(null);
      setAccountPageTokens(null);
      setHasMoreMessages(false);
      canLoadMoreRef.current = true; // Reset cooldown for new folder

      // OPTIMISTIC LOADING: Show cached data immediately
      const cachedData = getCachedMessages(selectedFolder, selectedAccountId);
      if (cachedData && cachedData.length > 0) {
        setRealMessages(cachedData);
        // Still fetch fresh data in background, but don't show loading spinner
      } else {
        // No valid cache — clear stale messages and show spinner
        setRealMessages([]);
        setMessagesLoading(true);
      }

      try {
        // Build query options based on selected folder and account
        const options = {
          maxResults: 50,
          includePagination: true, // Get nextPageToken for "Load More"
        };

        // Handle Archive folder specially - it's not a Gmail label
        if (selectedFolder === 'ARCHIVE') {
          options.query = '-in:inbox -in:trash -in:spam -in:sent -in:drafts';
        } else {
          options.labelIds = selectedFolder;
        }

        // If specific account selected, filter by account (required for pagination)
        if (selectedAccountId !== 'all') {
          options.accountId = selectedAccountId;
        }

        const result = await gmail.getMessages(user.id, options);

        // If this fetch was aborted (user switched away), discard the result
        if (controller.signal.aborted) return;

        const transformedMessages = transformGmailMessages(result.messages || []);

        // Detect account errors (revoked tokens, refresh failures) and update UI
        const failedAccounts = (result.accounts || []).filter(acc => acc.error);
        if (failedAccounts.length > 0) {
          setAccountErrors(failedAccounts.map(acc => ({
            id: acc.id,
            email: acc.email,
            error: acc.error,
            is_revoked: acc.is_revoked,
          })));
          // Mark revoked/failed accounts in connectedAccounts so sidebar shows "Reconnect"
          setConnectedAccounts(prev => prev.map(acc => {
            const failed = failedAccounts.find(f => String(f.id) === acc.id);
            if (failed) {
              return { ...acc, isValid: false, isRevoked: true, revokedReason: failed.error };
            }
            return acc;
          }));
        } else {
          setAccountErrors([]);
        }

        // Update cache
        setCachedMessages(selectedFolder, selectedAccountId, transformedMessages);

        // Update UI with fresh data
        setRealMessages(transformedMessages);

        // Store pagination tokens for "Load More"
        // Single account: use nextPageToken
        // Multi-account: use accountPageTokens
        setNextPageToken(result.nextPageToken || null);
        setAccountPageTokens(result.accountPageTokens || null);
        setHasMoreMessages(result.hasMore || !!result.nextPageToken);

        // Update folder unread count (for current folder)
        if (selectedFolder === 'INBOX') {
          const unreadCount = transformedMessages.filter(m => !m.isRead && !m.is_read).length;
          setFolderCounts(prev => ({ ...prev, INBOX: unreadCount }));
        }
      } catch (error) {
        if (controller.signal.aborted) return; // Ignore aborted fetches
        console.error('Error fetching Gmail messages:', error);
        // Only clear if we don't have cached data
        if (!cachedData) {
          setRealMessages([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setMessagesLoading(false);
        }
      }
    };

    if (!accountsLoading && user?.id) {
      fetchGmailMessages();
    }

    return () => { controller.abort(); };
  }, [connectedAccounts, accountsLoading, user?.id, selectedFolder, selectedAccountId]);

  // Fetch INBOX unread count on mount and when accounts change (industry standard: always show inbox count)
  useEffect(() => {
    const fetchInboxUnreadCount = async () => {
      if (!user?.id || accountsLoading) return;
      const gmailAccounts = connectedAccounts.filter(acc => acc.sourceId === 'gmail' && acc.isValid !== false);
      if (gmailAccounts.length === 0) {
        setFolderCounts(prev => ({ ...prev, INBOX: 0 }));
        return;
      }

      // First check cache for INBOX
      const cachedInbox = getCachedMessages('INBOX', selectedAccountId);
      if (cachedInbox && cachedInbox.length > 0) {
        const unreadCount = cachedInbox.filter(m => !m.isRead && !m.is_read).length;
        setFolderCounts(prev => ({ ...prev, INBOX: unreadCount }));
        return; // Cache is fresh enough
      }

      // If not viewing INBOX and no cache, fetch count in background
      if (selectedFolder !== 'INBOX') {
        try {
          const options = {
            maxResults: 50,
            labelIds: 'INBOX',
            accountId: selectedAccountId !== 'all' ? selectedAccountId : undefined,
          };
          const messages = await gmail.getMessages(user.id, options);
          const unreadCount = messages.filter(m => !m.is_read).length;
          setFolderCounts(prev => ({ ...prev, INBOX: unreadCount }));
        } catch (error) {
          console.error('Error fetching inbox unread count:', error);
        }
      }
    };

    fetchInboxUnreadCount();
  }, [user?.id, connectedAccounts, accountsLoading, selectedAccountId]);

  // Load more messages (pagination) - industry standard infinite scroll
  // Supports both single account (nextPageToken) and multi-account (accountPageTokens) modes
  const loadMoreMessages = useCallback(async () => {
    // Use ref to prevent race conditions (state might be stale in callback)
    // Check if we have any pagination tokens (single or multi-account)
    const hasSingleAccountToken = selectedAccountId !== 'all' && nextPageToken;
    const hasMultiAccountTokens = selectedAccountId === 'all' && accountPageTokens && Object.keys(accountPageTokens).length > 0;

    if (isLoadingMoreRef.current || !user?.id || (!hasSingleAccountToken && !hasMultiAccountTokens)) {
      return;
    }

    isLoadingMoreRef.current = true;
    setLoadingMore(true);

    // Snapshot the current controller — if the user switches accounts/folders
    // while loading, a new controller is created and this one becomes stale
    const activeController = emailFetchControllerRef.current;

    try {
      const options = {
        maxResults: 50, // Load 50 messages per batch (industry standard)
        includePagination: true,
      };

      // Handle Archive folder specially
      if (selectedFolder === 'ARCHIVE') {
        options.query = '-in:inbox -in:trash -in:spam -in:sent -in:drafts';
      } else {
        options.labelIds = selectedFolder;
      }

      // Single account pagination: use pageToken
      if (selectedAccountId !== 'all') {
        options.accountId = selectedAccountId;
        options.pageToken = nextPageToken;
      } else {
        // Multi-account pagination: use accountPageTokens
        options.accountPageTokens = accountPageTokens;
      }

      const result = await gmail.getMessages(user.id, options);

      // If account/folder changed while loading, discard stale results
      if (activeController !== emailFetchControllerRef.current) return;

      const newMessages = transformGmailMessages(result.messages || []);

      // Append to existing messages (don't replace)
      // Note: Appending to bottom doesn't change scrollTop - this is standard behavior
      setRealMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...uniqueNewMessages];
      });

      // Update pagination tokens for next batch
      // Single account: use nextPageToken
      // Multi-account: use accountPageTokens
      setNextPageToken(result.nextPageToken || null);
      setAccountPageTokens(result.accountPageTokens || null);
      setHasMoreMessages(result.hasMore || !!result.nextPageToken);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [nextPageToken, accountPageTokens, user?.id, selectedFolder, selectedAccountId]);

  // Infinite scroll - Using scroll event with throttle (industry standard)
  // Key: Only trigger ONCE per scroll-to-bottom action, with cooldown period
  useEffect(() => {
    const container = messageListContainerRef.current;
    if (!container) return;

    let throttleTimer = null;

    const handleScroll = () => {
      // Throttle: only process every 100ms
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        throttleTimer = null;

        // Don't trigger if:
        // 1. Already loading
        // 2. No more pages (check hasMoreMessages for both single and multi-account modes)
        // 3. Initial loading
        // 4. In cooldown period
        if (isLoadingMoreRef.current || !hasMoreMessages || messagesLoading || !canLoadMoreRef.current) {
          return;
        }

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Trigger when within 200px of bottom
        if (distanceFromBottom < 200) {
          // Set cooldown - prevent loading again until user scrolls away
          canLoadMoreRef.current = false;
          loadMoreMessages();

          // Reset cooldown after 1 second (allows next load after user scrolls more)
          setTimeout(() => {
            canLoadMoreRef.current = true;
          }, 1000);
        }
      }, 100);
    };

    // Use passive listener for better scroll performance
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [hasMoreMessages, messagesLoading, loadMoreMessages]);

  // Keyboard handler for lightbox (ESC to close)
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  // Helper function to categorize emails (basic implementation)
  const categorizeEmail = (msg) => {
    const subject = (msg.subject || '').toLowerCase();
    const body = (msg.body || '').toLowerCase();

    if (subject.includes('action') || subject.includes('urgent') || subject.includes('required')) {
      return 'action_required';
    }
    if (subject.includes('meeting') || subject.includes('invite') || subject.includes('calendar')) {
      return 'meeting';
    }
    if (subject.includes('invoice') || subject.includes('payment') || subject.includes('receipt')) {
      return 'invoice';
    }
    if (subject.includes('newsletter') || subject.includes('unsubscribe') || body.includes('unsubscribe')) {
      return 'newsletter';
    }
    return 'general';
  };

  // Helper function to determine email priority (basic implementation)
  const determinePriority = (msg) => {
    const subject = (msg.subject || '').toLowerCase();
    const isVIP = msg.from?.is_vip;

    if (subject.includes('urgent') || subject.includes('asap')) {
      return 'urgent';
    }
    if (isVIP || subject.includes('important')) {
      return 'high';
    }
    if (subject.includes('fyi') || subject.includes('newsletter')) {
      return 'low';
    }
    return 'medium';
  };

  // Get all currently selected source IDs
  const getAllSelectedSources = () => {
    const sources = ['work_agent']; // System always included
    Object.values(selectedSources).forEach(arr => {
      sources.push(...arr);
    });
    return sources;
  };

  // Get message count for a source (from real messages only)
  const getSourceCount = (sourceId) => {
    return realMessages.filter(m => m.source === sourceId).length;
  };

  // Get total count for a category
  const getCategoryCount = (categoryId) => {
    const category = SOURCE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.sources.reduce((sum, s) => sum + getSourceCount(s.id), 0);
  };

  // Get selected count for a category
  const getSelectedCount = (categoryId) => {
    const selected = selectedSources[categoryId] || [];
    return selected.reduce((sum, sourceId) => sum + getSourceCount(sourceId), 0);
  };

  // ==================== Email Action Handlers ====================

  // Refresh messages after action
  const refreshMessages = useCallback(async () => {
    if (!user?.id || connectedAccounts.length === 0) return;

    try {
      const options = { maxResults: 50 };
      if (selectedFolder === 'ARCHIVE') {
        options.query = '-in:inbox -in:trash -in:spam -in:sent -in:drafts';
      } else {
        options.labelIds = selectedFolder;
      }
      if (selectedAccountId !== 'all') {
        options.accountId = selectedAccountId;
      }

      const messages = await gmail.getMessages(user.id, options);
      setRealMessages(transformGmailMessages(messages));
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  }, [user?.id, connectedAccounts, selectedFolder, selectedAccountId]);

  // Star/Unstar message
  const handleStarMessage = useCallback(async (message) => {
    if (!user?.id || !message) return;

    setActionLoading('star');
    try {
      const newStarred = !message.isStarred;
      await gmail.starMessage(message.id, message.accountId, user.id, newStarred);

      // Update local state
      setRealMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, isStarred: newStarred } : m
      ));
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(prev => ({ ...prev, isStarred: newStarred }));
      }
    } catch (error) {
      console.error('Error starring message:', error);
      alert('Failed to update star status');
    } finally {
      setActionLoading(null);
    }
  }, [user?.id, selectedMessage]);

  // Delete message (move to trash)
  const handleTrashMessage = useCallback(async (message) => {
    if (!user?.id || !message) return;

    setActionLoading('trash');
    try {
      await gmail.trashMessage(message.id, message.accountId, user.id);

      // Remove from local state and clear selection
      setRealMessages(prev => prev.filter(m => m.id !== message.id));
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    } finally {
      setActionLoading(null);
    }
  }, [user?.id, selectedMessage]);

  // Restore message from trash
  const handleUntrashMessage = useCallback(async (message) => {
    if (!user?.id || !message) return;

    setActionLoading('untrash');
    try {
      await gmail.untrashMessage(message.id, message.accountId, user.id);
      await refreshMessages();
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error restoring message:', error);
      alert('Failed to restore message');
    } finally {
      setActionLoading(null);
    }
  }, [user?.id, selectedMessage, refreshMessages]);

  // Archive message
  const handleArchiveMessage = useCallback(async (message) => {
    if (!user?.id || !message) return;

    setActionLoading('archive');
    try {
      await gmail.archiveMessage(message.id, message.accountId, user.id);

      // Remove from inbox view
      setRealMessages(prev => prev.filter(m => m.id !== message.id));
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error archiving message:', error);
      alert('Failed to archive message');
    } finally {
      setActionLoading(null);
    }
  }, [user?.id, selectedMessage]);

  // Select message and mark as read (industry standard behavior)
  // Fetch full message body + inline attachments and return the merged result.
  // Shared by both prefetch (hover) and select (click) paths.
  const fetchFullMessage = useCallback(async (messageId, accountId) => {
    const fullMessage = await gmail.getMessage(messageId, accountId, user?.id);
    if (!fullMessage) return null;

    // Fetch inline attachments in parallel
    const attachments = fullMessage.attachments || [];
    const inlineToFetch = attachments.filter(att =>
      att.is_inline && att.attachment_id && !att.data && att.content_id
    );
    if (inlineToFetch.length > 0) {
      const fetched = await Promise.all(
        inlineToFetch.map(async (att) => {
          try {
            const data = await gmail.getAttachment(fullMessage.id, att.attachment_id, accountId, user?.id);
            return { ...att, data: data?.data };
          } catch { return att; }
        })
      );
      fullMessage.attachments = attachments.map(att => {
        const f = fetched.find(x => x.attachment_id === att.attachment_id);
        return f || att;
      });
    }
    return fullMessage;
  }, [user?.id]);

  // Prefetch a message body on hover — fire-and-forget, never triggers re-render
  const handlePrefetchMessage = useCallback((message) => {
    if (!message || !user?.id) return;
    const id = message.id;
    // Skip if already have body data, already cached, or already in-flight
    if (message.body || message.body_html) return;
    if (prefetchCacheRef.current.has(id)) return;
    if (prefetchInFlightRef.current.has(id)) return;

    const accountId = message.accountId || message.account_id;
    if (!accountId) return;

    prefetchInFlightRef.current.add(id);
    fetchFullMessage(id, accountId)
      .then(full => {
        if (full) {
          // Cap cache at 50 entries to prevent unbounded memory growth
          if (prefetchCacheRef.current.size >= 50) {
            const oldest = prefetchCacheRef.current.keys().next().value;
            prefetchCacheRef.current.delete(oldest);
          }
          prefetchCacheRef.current.set(id, full);
        }
      })
      .catch(() => {}) // Silently ignore prefetch errors
      .finally(() => prefetchInFlightRef.current.delete(id));
  }, [user?.id, fetchFullMessage]);

  const handleSelectMessage = useCallback(async (message) => {
    if (!message) return;

    const accountId = message.accountId || message.account_id;
    const needsFullContent = !message.body && !message.body_html;

    // Set selected immediately (shows preview content right away)
    expectedMessageIdRef.current = message.id;
    setSelectedMessage(message);
    if (needsFullContent) {
      setMessageBodyLoading(true);
    }

    // Fetch full message content if body is not available
    if (needsFullContent && user?.id && accountId) {
      try {
        // Check prefetch cache first (populated by hover)
        let fullMessage = prefetchCacheRef.current.get(message.id) || null;

        if (!fullMessage) {
          fullMessage = await fetchFullMessage(message.id, accountId);
        } else {
          // Used from cache — clean up
          prefetchCacheRef.current.delete(message.id);
        }

        // Guard: if user clicked a different message while we were fetching, discard
        if (expectedMessageIdRef.current !== message.id) {
          return;
        }

        if (fullMessage) {
          const mergedMessage = {
            ...message,
            ...fullMessage,
            isRead: true,
            is_read: true,
          };
          setSelectedMessage(mergedMessage);

          // Update realMessages to cache the fetched body (prevents re-fetching)
          setRealMessages(prev => prev.map(m =>
            m.id === message.id ? mergedMessage : m
          ));

          // Update sessionStorage cache — use selectedAccountId for the cache key
          // (matches the key used by the main fetch that populated this cache)
          try {
            const cacheKey = getCacheKey(selectedFolder, selectedAccountId);
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              const { data, timestamp } = JSON.parse(cached);
              const updatedData = data.map(m =>
                m.id === message.id ? mergedMessage : m
              );
              sessionStorage.setItem(cacheKey, JSON.stringify({ data: updatedData, timestamp }));
            }
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (error) {
        console.error('Error fetching full message:', error);
      } finally {
        setMessageBodyLoading(false);
      }
    }

    // If message is unread, mark it as read
    const isUnread = !message.isRead && !message.is_read;
    if (isUnread && user?.id && accountId) {
      // Optimistically update UI first (instant feedback)
      const updatedMessage = { ...message, isRead: true, is_read: true };
      setSelectedMessage(prev => ({ ...prev, isRead: true, is_read: true }));
      setRealMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, isRead: true, is_read: true } : m
      ));

      // Update cache with new read status
      try {
        const cacheKey = getCacheKey(selectedFolder, selectedAccountId);
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const updatedData = data.map(m =>
            m.id === message.id ? { ...m, isRead: true, is_read: true } : m
          );
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: updatedData, timestamp }));
        }
      } catch (e) {
        // Ignore cache errors
      }

      // Update folder unread count (decrement by 1)
      setFolderCounts(prev => ({
        ...prev,
        [selectedFolder]: Math.max(0, (prev[selectedFolder] || 0) - 1)
      }));

      // Call API in background (don't block UI)
      gmail.markAsRead(message.id, accountId, user.id).catch(error => {
        console.error('Error marking message as read:', error);
        // Don't revert - the message was still read by the user
      });
    }
  }, [user?.id, selectedFolder, selectedAccountId, fetchFullMessage]);

  // Search Bar Filters 
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
  status: null,      // 'unread' | 'starred' | 'archived' | 'sent' | null
  account: null,     // account id or null
  dateRange: null,   // 'today' | 'week' | 'month' | 'year' | null
  });
  
  const filterRef = useRef(null);
  const searchQueryMessages = useMemo(() => {
  let result = realMessages;

  // Search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(msg =>
      [msg.subject, msg.sender, msg.from, msg.body, msg.snippet, msg.to, msg.recipient]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(q))
    );
  }

    // Status filter
    if (filters.status === 'read')      result = result.filter(msg => msg.is_read || msg.isRead);
    if (filters.status === 'unread')    result = result.filter(msg => !msg.is_read && !msg.isRead);
    if (filters.status === 'starred')   result = result.filter(msg => msg.is_starred || msg.isStarred);
    if (filters.status === 'archived')  result = result.filter(msg => msg.is_archived || msg.isArchived);
    if (filters.status === 'sent') result = result.filter(msg => msg.is_sent || msg.isSent);
    if (filters.status === 'draft') result = result.filter(msg => msg.is_draft || msg.isDraft);
    if (filters.status === 'trash') result = result.filter(msg => msg.is_trashed || msg.isTrashed);
    if (filters.status === 'spam') result = result.filter(msg => msg.is_spam || msg.isSpam);
    if (filters.status === 'important') result = result.filter(msg => msg.priority === 'high' || msg.is_important || msg.isImportant);
    if (filters.status === 'sender') result = result.filter(msg => msg.from?.email === searchQuery || msg.from?.name === searchQuery);
    if (filters.status === 'keyword') result = result.filter(msg => (msg.body || '').toLowerCase().includes(searchQuery.toLowerCase()));

    // Account filter
    if (filters.account) {
      result = result.filter(msg => msg.account_id === filters.account || msg.accountId === filters.account);
    }

  // Date range filter
  if (filters.dateRange) {
    const now = new Date();
    const cutoff = {
      today: new Date(now.setHours(0, 0, 0, 0)),
      week:  new Date(now.setDate(now.getDate() - 7)),
      month: new Date(now.setMonth(now.getMonth() - 1)),
      year:  new Date(now.setFullYear(now.getFullYear() - 1)),
    }[filters.dateRange];
    result = result.filter(msg => new Date(msg.date || msg.created_at) >= cutoff);
  }

  return result;
}, [realMessages, searchQuery, filters]);
  

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
      setFiltersOpen(false);
    }
  };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => setFilters({ status: null, account: null, dateRange: null });

  // ==================== Compose Helper Functions ====================

  // Extract all known recipients from messages for autocomplete
  const extractKnownRecipients = useCallback(() => {
    const recipientMap = new Map();

    realMessages.forEach(msg => {
      // Add sender
      if (msg.from?.email) {
        const key = msg.from.email.toLowerCase();
        if (!recipientMap.has(key)) {
          recipientMap.set(key, {
            email: msg.from.email,
            name: msg.from.name || msg.from.email.split('@')[0],
            count: 1,
          });
        } else {
          recipientMap.get(key).count++;
        }
      }

      // Add recipients from 'to' field
      (msg.to || []).forEach(email => {
        if (email && typeof email === 'string') {
          const key = email.toLowerCase();
          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              email: email,
              name: email.split('@')[0],
              count: 1,
            });
          } else {
            recipientMap.get(key).count++;
          }
        }
      });

      // Add CC recipients if available
      (msg.cc || []).forEach(email => {
        if (email && typeof email === 'string') {
          const key = email.toLowerCase();
          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              email: email,
              name: email.split('@')[0],
              count: 1,
            });
          } else {
            recipientMap.get(key).count++;
          }
        }
      });
    });

    // Sort by frequency
    const sortedRecipients = Array.from(recipientMap.values())
      .sort((a, b) => b.count - a.count);

    setAllKnownRecipients(sortedRecipients);
  }, [realMessages]);

  // Update known recipients when messages change
  useEffect(() => {
    extractKnownRecipients();
  }, [extractKnownRecipients]);

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file selection for attachments
  const handleFileSelect = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Check total size limit (25MB for Gmail)
    const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
    const currentTotalSize = attachments.reduce((sum, a) => sum + a.size, 0);

    const newAttachments = [];
    let newTotalSize = currentTotalSize;

    for (const file of files) {
      if (newTotalSize + file.size > MAX_TOTAL_SIZE) {
        alert(`Cannot add ${file.name}: Total attachment size would exceed 25MB limit.`);
        continue;
      }

      newAttachments.push({
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // Store the actual File object for upload
      });
      newTotalSize += file.size;
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachments]);

  // Remove attachment
  const removeAttachment = useCallback((attachmentId) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);

  // Handle text selection in compose textarea for inline AI tools
  // Using onSelect event for reliable text selection detection
  const handleTextSelection = useCallback((event) => {
    const textarea = event.target;

    // Use setTimeout to ensure the selection state is fully updated
    // This is especially important for double-click word selection and drag selection
    setTimeout(() => {
      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

      if (selectedText.trim().length > 0) {
        // Get cursor position for popup placement
        // Use getBoundingClientRect of the textarea and estimate position
        const rect = textarea.getBoundingClientRect();
        const lineHeight = 20; // Approximate line height

        // Calculate rough position
        const textBeforeSelection = textarea.value.substring(0, textarea.selectionStart);
        const linesBeforeSelection = textBeforeSelection.split('\n').length - 1;
        const lastLineLength = textBeforeSelection.split('\n').pop().length;

        // Position popup near the end of selection
        const x = rect.left + Math.min(lastLineLength * 7, rect.width - 200);
        const y = rect.top + (linesBeforeSelection + 1) * lineHeight - textarea.scrollTop + 60;

        setTextSelectionPopup({
          visible: true,
          x: Math.min(x, window.innerWidth - 320),
          y: Math.min(Math.max(y, rect.top + 20), window.innerHeight - 60),
          selectedText: selectedText,
          selectionStart: textarea.selectionStart,
          selectionEnd: textarea.selectionEnd,
        });
      } else {
        setTextSelectionPopup(prev => ({ ...prev, visible: false }));
      }
    }, 10); // Small delay to ensure selection is complete
  }, []);

  // Hide popup when starting a new mouse selection
  const handleTextSelectionStart = useCallback(() => {
    setTextSelectionPopup(prev => ({ ...prev, visible: false }));
  }, []);

  // Close text selection popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside the popup and not on the textarea
      const popup = document.querySelector('[data-text-selection-popup]');
      const textarea = composeTextareaRef.current;

      if (textSelectionPopup.visible && popup && !popup.contains(event.target) &&
        textarea && !textarea.contains(event.target)) {
        setTextSelectionPopup(prev => ({ ...prev, visible: false }));
      }
    };

    if (textSelectionPopup.visible) {
      // Use a small delay to avoid closing immediately on the same click that opens it
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [textSelectionPopup.visible]);

  // Apply AI transformation to selected text - opens preview modal with streaming
  const applyAIToSelection = useCallback(async (action) => {
    if (!textSelectionPopup.selectedText) return;

    const { selectionStart, selectionEnd, selectedText } = textSelectionPopup;

    // Close the selection popup and open preview modal
    setTextSelectionPopup(prev => ({ ...prev, visible: false }));
    setAiPreviewModal({
      visible: true,
      originalText: selectedText,
      modifiedText: '',
      selectionStart,
      selectionEnd,
      isStreaming: true,
      actionType: action,
    });
    setAiAssistLoading(`selection_${action}`);

    // Define instruction based on action
    let instruction = '';
    switch (action) {
      case 'polish':
        instruction = `Fix grammar, improve fluency, and make it ${selectedTone}`;
        break;
      case 'concise':
        instruction = 'Make this text more concise and to the point. Remove unnecessary words.';
        break;
      case 'expand':
        instruction = 'Expand on this text to provide more detail and context.';
        break;
      case 'spelling':
        instruction = 'Strictly fix ONLY spelling and basic grammar errors. Do not change the tone or structure.';
        break;
      default:
        instruction = 'Improve this text.';
    }

    try {
      await emailAI.polishStream(
        selectedText,
        selectedTone,
        instruction,
        (token) => {
          // Stream tokens into preview modal
          setAiPreviewModal(prev => ({
            ...prev,
            modifiedText: prev.modifiedText + token,
          }));
        },
        () => {
          // Streaming complete
          setAiPreviewModal(prev => ({
            ...prev,
            isStreaming: false,
          }));
          setAiAssistLoading(null);
        },
        (err) => {
          console.error('Selection AI error:', err);
          setAiPreviewModal(prev => ({
            ...prev,
            isStreaming: false,
            modifiedText: prev.modifiedText || 'Error generating content. Please try again.',
          }));
          setAiAssistLoading(null);
        }
      );
    } catch (error) {
      console.error('Error applying AI to selection:', error);
      setAiPreviewModal(prev => ({
        ...prev,
        isStreaming: false,
        modifiedText: 'Error generating content. Please try again.',
      }));
      setAiAssistLoading(null);
    }
  }, [textSelectionPopup, selectedTone]);

  // Handle Replace action from AI preview modal
  const handleAIPreviewReplace = useCallback(() => {
    const { selectionStart, selectionEnd, modifiedText } = aiPreviewModal;
    const newBody = composeData.body.substring(0, selectionStart) +
      modifiedText +
      composeData.body.substring(selectionEnd);
    setComposeData(prev => ({ ...prev, body: newBody }));
    setAiPreviewModal(prev => ({ ...prev, visible: false }));
  }, [aiPreviewModal, composeData.body]);

  // Handle Discard action from AI preview modal
  const handleAIPreviewDiscard = useCallback(() => {
    setAiPreviewModal(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle Regenerate action from AI preview modal
  const handleAIPreviewRegenerate = useCallback(async () => {
    const { originalText, actionType, selectionStart, selectionEnd } = aiPreviewModal;

    // Reset modified text and start streaming again
    setAiPreviewModal(prev => ({
      ...prev,
      modifiedText: '',
      isStreaming: true,
    }));
    setAiAssistLoading(`selection_${actionType}`);

    // Define instruction based on action type
    let instruction = '';
    switch (actionType) {
      case 'polish':
        instruction = `Fix grammar, improve fluency, and make it ${selectedTone}`;
        break;
      case 'concise':
        instruction = 'Make this text more concise and to the point. Remove unnecessary words.';
        break;
      case 'expand':
        instruction = 'Expand on this text to provide more detail and context.';
        break;
      case 'spelling':
        instruction = 'Strictly fix ONLY spelling and basic grammar errors. Do not change the tone or structure.';
        break;
      default:
        instruction = 'Improve this text.';
    }

    try {
      await emailAI.polishStream(
        originalText,
        selectedTone,
        instruction,
        (token) => {
          setAiPreviewModal(prev => ({
            ...prev,
            modifiedText: prev.modifiedText + token,
          }));
        },
        () => {
          setAiPreviewModal(prev => ({
            ...prev,
            isStreaming: false,
          }));
          setAiAssistLoading(null);
        },
        (err) => {
          console.error('Regenerate AI error:', err);
          setAiPreviewModal(prev => ({
            ...prev,
            isStreaming: false,
            modifiedText: prev.modifiedText || 'Error generating content. Please try again.',
          }));
          setAiAssistLoading(null);
        }
      );
    } catch (error) {
      console.error('Error regenerating AI content:', error);
      setAiPreviewModal(prev => ({
        ...prev,
        isStreaming: false,
        modifiedText: 'Error generating content. Please try again.',
      }));
      setAiAssistLoading(null);
    }
  }, [aiPreviewModal, selectedTone]);

  // Search recipients for autocomplete
  const searchRecipients = useCallback((query, field) => {
    if (!query || query.length < 1) {
      setRecipientSuggestions([]);
      setActiveRecipientField(null);
      return;
    }

    const queryLower = query.toLowerCase();
    const matches = allKnownRecipients
      .filter(r =>
        r.email.toLowerCase().includes(queryLower) ||
        r.name.toLowerCase().includes(queryLower)
      )
      .slice(0, 8); // Limit to 8 suggestions

    setRecipientSuggestions(matches);
    setActiveRecipientField(field);
    setRecipientSearchQuery(query);
  }, [allKnownRecipients]);

  // Add recipient from suggestion
  const addRecipient = useCallback((email, field) => {
    setComposeData(prev => {
      const currentValue = prev[field] || '';
      // Parse existing emails
      const existingEmails = currentValue
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      // Check if already added
      if (existingEmails.some(e => e.toLowerCase() === email.toLowerCase())) {
        return prev;
      }

      // Add new email
      const newValue = [...existingEmails, email].join(', ');
      return { ...prev, [field]: newValue };
    });

    setRecipientSuggestions([]);
    setActiveRecipientField(null);
    setRecipientSearchQuery('');
  }, []);

  // Parse recipients from input (comma-separated)
  const parseRecipients = useCallback((value) => {
    return value
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));
  }, []);

  // Handle recipient input change
  const handleRecipientInputChange = useCallback((value, field) => {
    setComposeData(prev => ({ ...prev, [field]: value }));

    // Get the last part after comma for autocomplete
    const parts = value.split(',');
    const lastPart = parts[parts.length - 1].trim();
    searchRecipients(lastPart, field);
  }, [searchRecipients]);

  // ==================== Compose Modal Handlers ====================

  // Open compose modal for Reply
  const handleReply = useCallback((message) => {
    if (!message) return;

    const replySubject = message.subject?.startsWith('Re:')
      ? message.subject
      : `Re: ${message.subject || ''}`;

    setComposeMode('reply');

    // Use plain text body for quoted reply (avoid raw HTML in textarea)
    const quotedContent = message.body_plain || message.preview || message.body || '';
    let bodyContent = `\n\n--- Original Message ---\nFrom: ${message.from?.name} <${message.from?.email}>\nDate: ${new Date(message.timestamp).toLocaleString()}\nSubject: ${message.subject}\n\n${quotedContent}`;

    // Check if there is an AI draft passed from the assistant
    if (message.aiDraft) {
      bodyContent = `${message.aiDraft}\n${bodyContent}`;
    }

    setComposeData({
      to: message.from?.email || '',
      cc: '',
      bcc: '',
      subject: replySubject,
      body: bodyContent,
      replyToMessageId: message.id,
      threadId: message.threadId,
      originalMessage: message,
    });
    setInitialComposeBody(bodyContent);
    setAttachments([]);
    setShowComposeModal(true);
  }, []);

  // Open compose modal for Reply All
  const handleReplyAll = useCallback((message) => {
    if (!message) return;

    const replySubject = message.subject?.startsWith('Re:')
      ? message.subject
      : `Re: ${message.subject || ''}`;

    // Include all original To + CC recipients in CC (except current user and the sender we're replying to)
    const allRecipients = [...(message.to || []), ...(message.cc || [])].filter(
      email => email !== message.accountEmail && email !== message.from?.email
    );

    const quotedContent = message.body_plain || message.preview || message.body || '';
    const replyAllBody = `\n\n--- Original Message ---\nFrom: ${message.from?.name} <${message.from?.email}>\nDate: ${new Date(message.timestamp).toLocaleString()}\nSubject: ${message.subject}\n\n${quotedContent}`;
    setComposeMode('replyAll');
    setComposeData({
      to: message.from?.email || '',
      cc: allRecipients.join(', '),
      bcc: '',
      subject: replySubject,
      body: replyAllBody,
      replyToMessageId: message.id,
      threadId: message.threadId,
      originalMessage: message,
    });
    setInitialComposeBody(replyAllBody);
    setAttachments([]);
    setShowComposeModal(true);
  }, []);

  // Open compose modal for Forward
  const handleForward = useCallback((message) => {
    if (!message) return;

    const fwdSubject = message.subject?.startsWith('Fwd:')
      ? message.subject
      : `Fwd: ${message.subject || ''}`;

    const quotedContent = message.body_plain || message.preview || message.body || '';
    const forwardBody = `\n\n--- Forwarded Message ---\nFrom: ${message.from?.name} <${message.from?.email}>\nDate: ${new Date(message.timestamp).toLocaleString()}\nSubject: ${message.subject}\nTo: ${(message.to || []).join(', ')}\n\n${quotedContent}`;
    setComposeMode('forward');
    setComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: fwdSubject,
      body: forwardBody,
      replyToMessageId: null,
      threadId: null,
      originalMessage: message,
    });
    setInitialComposeBody(forwardBody);
    setAttachments([]);
    setShowComposeModal(true);
  }, []);

  // Open compose modal for New Email
  const handleNewEmail = useCallback(() => {
    setComposeMode('new');
    setComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      replyToMessageId: null,
      threadId: null,
      originalMessage: null,
    });
    setInitialComposeBody('');
    setAttachments([]);
    setShowComposeModal(true);
  }, []);

  // Create Task from Email
  const handleCreateTaskFromEmail = useCallback((message) => {
    if (!message) return;

    // Pre-fill task data from email
    const taskData = {
      title: message.subject || 'Task from email',
      description: `From: ${message.from?.name || message.from?.email}\n\n${message.preview || message.body_plain || ''}`,
      priority: message.isImportant ? 'high' : 'medium',
      status: 'todo',
      category: 'Email',
      external_source: 'email',
      external_id: message.id,
      external_url: `https://mail.google.com/mail/u/0/#inbox/${message.threadId || message.id}`,
    };

    setTaskFromEmailData(taskData);
    setShowTaskFromEmailModal(true);
  }, []);

  // Send email
  const handleSendEmail = useCallback(async () => {
    if (!user?.id || !composeData.to) return;

    // Get account ID - use the first connected account if none specified
    const accountId = composeData.originalMessage?.accountId
      || (connectedAccounts.length > 0 ? connectedAccounts[0].id : null);

    if (!accountId) {
      alert('No email account connected');
      return;
    }

    setSendingEmail(true);
    try {
      // Convert attachments to base64 for upload
      let attachmentData = null;
      if (attachments.length > 0) {
        attachmentData = await Promise.all(
          attachments.map(async (att) => {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
              };
              reader.onerror = reject;
              reader.readAsDataURL(att.file);
            });
            return {
              filename: att.name,
              mime_type: att.type || 'application/octet-stream',
              data: base64,
            };
          })
        );
      }

      await gmail.sendEmail({
        to: composeData.to,
        subject: composeData.subject,
        body: composeData.body,
        cc: composeData.cc ? composeData.cc.split(',').map(s => s.trim()) : undefined,
        bcc: composeData.bcc ? composeData.bcc.split(',').map(s => s.trim()) : undefined,
        replyToMessageId: composeData.replyToMessageId,
        threadId: composeData.threadId,
        attachments: attachmentData,
      }, accountId, user.id);

      setShowComposeModal(false);
      setComposeData({
        to: '', cc: '', bcc: '', subject: '', body: '',
        replyToMessageId: null, threadId: null, originalMessage: null,
      });
      setAttachments([]); // Clear attachments after send

      // Refresh if in sent folder
      if (selectedFolder === 'SENT') {
        await refreshMessages();
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  }, [user?.id, composeData, connectedAccounts, selectedFolder, refreshMessages, attachments]);

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    if (!user?.id) return;

    const accountId = composeData.originalMessage?.accountId
      || (connectedAccounts.length > 0 ? connectedAccounts[0].id : null);

    if (!accountId) {
      alert('No email account connected');
      return;
    }

    try {
      await gmail.createDraft({
        to: composeData.to,
        subject: composeData.subject,
        body: composeData.body,
        cc: composeData.cc ? composeData.cc.split(',').map(s => s.trim()) : undefined,
        bcc: composeData.bcc ? composeData.bcc.split(',').map(s => s.trim()) : undefined,
        replyToMessageId: composeData.replyToMessageId,
        threadId: composeData.threadId,
      }, accountId, user.id);

      setShowComposeModal(false);
      setComposeData({
        to: '', cc: '', bcc: '', subject: '', body: '',
        replyToMessageId: null, threadId: null, originalMessage: null,
      });

      // Refresh if in drafts folder
      if (selectedFolder === 'DRAFT') {
        await refreshMessages();
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    }
  }, [user?.id, composeData, connectedAccounts, selectedFolder, refreshMessages]);

  // Toggle source selection
  const toggleSource = (categoryId, sourceId) => {
    setSelectedSources(prev => {
      const current = prev[categoryId] || [];
      if (current.includes(sourceId)) {
        return { ...prev, [categoryId]: current.filter(id => id !== sourceId) };
      } else {
        return { ...prev, [categoryId]: [...current, sourceId] };
      }
    });
  };

  // Select/deselect all in category
  const toggleAllInCategory = (categoryId) => {
    const category = SOURCE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    setSelectedSources(prev => {
      const current = prev[categoryId] || [];
      const allIds = category.sources.map(s => s.id);
      const allSelected = allIds.every(id => current.includes(id));

      if (allSelected) {
        return { ...prev, [categoryId]: [] };
      } else {
        return { ...prev, [categoryId]: allIds };
      }
    });
  };

  // Only show real messages from connected accounts (no mock data)
  const combinedMessages = realMessages;

  // Filter messages based on selected sources
  const filteredMessages = combinedMessages.filter(msg => {
    // Source filter
    const allSelected = getAllSelectedSources();
    if (!allSelected.includes(msg.source)) return false;
    // Message category filter (action_required, meeting, etc.)
    if (selectedCategories.length > 0 && !selectedCategories.includes(msg.category)) return false;
    // Search
    if (searchQuery && !msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !msg.preview.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Smart filters
    if (smartFilter === 'important_urgent' && msg.priority !== 'urgent' && msg.priority !== 'high') return false;
    if (smartFilter === 'high_impact' && !msg.from.isVIP) return false;
    return true;
  });

  const getSourceColor = (source) => {
    const colors = {
      // Email
      gmail: 'text-red-500 bg-red-50',
      outlook: 'text-blue-600 bg-blue-50',
      // Team Chat
      slack: 'text-purple-500 bg-purple-50',
      teams: 'text-indigo-500 bg-indigo-50',
      // Project Management
      jira: 'text-blue-500 bg-blue-50',
      // System
      work_agent: 'text-orange-500 bg-orange-50',
    };
    return colors[source] || 'text-gray-500 bg-gray-50';
  };


  const getSourceLabel = (source) => {
    const labels = {
      gmail: 'Gmail',
      outlook: 'Outlook',
      slack: 'Slack',
      teams: 'Teams',
      jira: 'Jira',
      work_agent: 'Work Agent',
    };
    return labels[source] || source;
  };

  const getPriorityStyles = (priority) => {
    const styles = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-amber-100 text-amber-700 border-amber-200',
      low: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return styles[priority] || styles.medium;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };


  // ==== Connected Accounts Helper Functions ====

  // Get accounts connected for a specific source
  const getConnectedAccountsForSource = (sourceId) => {
    return connectedAccounts.filter(acc => acc.sourceId === sourceId);
  };

  // Check if a source has any connected accounts
  const isSourceConnected = (sourceId) => {
    return connectedAccounts.some(acc => acc.sourceId === sourceId);
  };

  // Get total connected accounts count
  const getTotalConnectedCount = () => connectedAccounts.length;

  // Handle OAuth connection - Redirect to real OAuth flow
  const handleConnectSource = async (integration) => {
    if (integration.comingSoon) {
      setOauthError(`${integration.name} integration coming soon!`);
      setTimeout(() => setOauthError(null), 3000);
      return;
    }

    setConnectingSource(integration.id);

    try {
      // Determine the provider based on integration id
      let provider = integration.id;
      if (integration.id === 'gmail' || integration.id === 'google_calendar') {
        provider = 'google';
      }

      // For supported providers, redirect to OAuth flow
      if (provider === 'google') {
        // Get OAuth authorization URL from backend
        const authData = await oauth.getGoogleAuthUrl(user.id);
        if (authData.authorization_url) {
          // Store state in sessionStorage for CSRF validation
          sessionStorage.setItem('oauth_state', authData.state);
          sessionStorage.setItem('oauth_provider', provider);
          // Redirect to Google OAuth consent screen
          window.location.href = authData.authorization_url;
        } else {
          throw new Error('Failed to get authorization URL');
        }
      } else {
        // For unsupported providers, show coming soon message
        setOauthError(`${integration.name} integration coming soon!`);
        setConnectingSource(null);
        setTimeout(() => setOauthError(null), 3000);
      }
    } catch (error) {
      console.error('OAuth connection failed:', error);
      setOauthError(error.message || 'Failed to initiate OAuth flow. Please try again.');
      setConnectingSource(null);
      setTimeout(() => setOauthError(null), 5000);
    }
  };

  // Handle disconnecting an account - Call real API
  const handleDisconnectAccount = async (accountId) => {
    if (!user?.id) return;
    try {
      await oauth.disconnectAccount(accountId, user.id);
      setConnectedAccounts(prev => prev.filter(acc => acc.id !== accountId));
      // Also clear real messages if it was a Gmail account
      const disconnectedAccount = connectedAccounts.find(acc => acc.id === accountId);
      if (disconnectedAccount?.sourceId === 'gmail') {
        // Refresh messages after disconnecting
        const remainingGmailAccounts = connectedAccounts.filter(
          acc => acc.sourceId === 'gmail' && acc.id !== accountId
        );
        if (remainingGmailAccounts.length === 0) {
          setRealMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      setOauthError('Failed to disconnect account. Please try again.');
      setTimeout(() => setOauthError(null), 5000);
    }
  };

  // Refresh Gmail messages manually - respects current folder and account selection
  const handleRefreshMessages = async () => {
    if (!user?.id) return;
    const gmailAccounts = connectedAccounts.filter(acc => acc.sourceId === 'gmail' && acc.isValid !== false);
    if (gmailAccounts.length === 0) return;

    try {
      setMessagesLoading(true);
      const options = { maxResults: 50 };
      if (selectedFolder === 'ARCHIVE') {
        options.query = '-in:inbox -in:trash -in:spam -in:sent -in:drafts';
      } else {
        options.labelIds = selectedFolder;
      }
      if (selectedAccountId !== 'all') {
        options.accountId = selectedAccountId;
      }
      const messages = await gmail.getMessages(user.id, options);
      setRealMessages(transformGmailMessages(messages));
    } catch (error) {
      console.error('Error refreshing messages:', error);
      setOauthError('Failed to refresh messages. Please try again.');
      setTimeout(() => setOauthError(null), 5000);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Get account color based on account email (consistent colors for each account)
  const getAccountColor = (email) => {
    if (!email) return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400' };
    const colors = [
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
      { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
      { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
      { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
      { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' },
      { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
    ];
    // Simple hash based on email to get consistent color
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Message List Item - Compact Gmail-style layout
  const MessageListItem = ({ message, isSelected, showAccountBadge = true }) => {
    const accountColor = getAccountColor(message.accountEmail || message.account_email);
    const isUnread = !message.isRead && !message.is_read;
    const hasAttachment = message.hasAttachments || message.has_attachments;
    const isStarred = message.isStarred || message.is_starred;

    return (
      <div
        onClick={() => handleSelectMessage(message)}
        onMouseEnter={() => handlePrefetchMessage(message)}
        className={`group relative cursor-pointer transition-all border-b border-gray-100
          ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : isUnread ? 'bg-white' : 'bg-gray-50/50'}
          hover:bg-gray-100/80`}
      >
        <div className="flex items-start py-2 px-3 gap-2">
          {/* Left: Unread dot + Avatar */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Unread indicator */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? 'bg-blue-500' : 'bg-transparent'}`} />

            {/* Compact Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
              ${isUnread ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {message.from?.email === (message.accountEmail || message.account_email) ? 'M' : (message.from?.name?.charAt(0)?.toUpperCase() || message.from?.email?.charAt(0)?.toUpperCase() || '?')}
            </div>
          </div>

          {/* Content area - full width */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {/* Row 1: Sender + Time/Actions */}
            <div className="flex items-center justify-between gap-1">
              <span className={`text-sm truncate flex-1 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                {message.from?.email === (message.accountEmail || message.account_email) ? 'me' : (message.from?.name || message.from?.email?.split('@')[0] || 'Unknown')}
              </span>
              {/* Time/Actions container - actions replace time on hover */}
              <div className="relative flex-shrink-0">
                {/* Time - hidden on hover */}
                <span className="text-[11px] text-gray-400 tabular-nums group-hover:invisible">
                  {formatTime(message.timestamp)}
                </span>
                {/* Quick actions - shown on hover, positioned over time */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0 invisible group-hover:visible bg-gray-100/80 rounded">
                  <button
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Archive"
                    onClick={(e) => { e.stopPropagation(); handleArchiveMessage(message); }}
                  >
                    <ArchiveBoxIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleTrashMessage(message); }}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-amber-500 hover:bg-amber-100 rounded transition-colors"
                    title="Star"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStarMessage(message);
                    }}
                  >
                    <StarIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Subject + Indicators */}
            <div className="flex items-center gap-1">
              <h4 className={`text-[13px] truncate flex-1 ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                {message.subject || '(No subject)'}
              </h4>
              {/* Inline indicators */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {hasAttachment && <PaperClipIcon className="w-3.5 h-3.5 text-gray-400" />}
                {isStarred && <StarSolidIcon className="w-3.5 h-3.5 text-amber-400" />}
              </div>
            </div>

            {/* Row 3: Preview - 2 lines */}
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {message.preview || message.snippet || ''}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Message Detail Panel

  // Calendar view has been merged into the Scheduler tab

  if (activeInboxSubtab === 'communication') {
    return (
      <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Communication</h3>
            <p className="text-gray-500 text-sm max-w-md">
              Communication hub coming soon. Connect Slack, Teams, and other messaging platforms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeInboxSubtab === 'issue-tracker') {
    return (
      <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <TicketIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Issue Tracker</h3>
            <p className="text-gray-500 text-sm max-w-md">
              Issue tracking coming soon. Connect Jira, GitHub Issues, and other project management tools.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: Email view
  return (
  
    < div className="w-full h-screen relative bg-sky-950 overflow-y-auto">
      {/* OAuth Success/Error Notifications */}
       {oauthSuccess && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-green-100 border border-green-300 text-green-800 rounded-xl shadow-lg animate-fade-in">
          <CheckCircleIcon className="w-5 h-5" />
          <span className="text-sm font-medium">{oauthSuccess}</span>
          <button onClick={() => setOauthSuccess(null)} className="ml-2 text-green-600 hover:text-green-800">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {oauthError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-red-100 border border-red-300 text-red-800 rounded-xl shadow-lg animate-fade-in">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="text-sm font-medium">{oauthError}</span>
          <button onClick={() => setOauthError(null)} className="ml-2 text-red-600 hover:text-red-800">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Header */}
    <div className="w-[1340px] h-16 left-0 top-[25px] absolute ">
        <div className="left-[1379px] top-[14px] absolute justify-start text-white text-base font-normal font-['Open_Sans']">Account</div>
        {/* Smartie Icon */}
        {/* <div className="w-14 h-12 left-[1196px] top-[1px] absolute">
            <div className="w-9 h-7 left-[7.82px] top-[18.05px] absolute bg-slate-500 rounded-2xl" />
            <div className="w-7 h-6 left-[11.73px] top-[5.72px] absolute bg-slate-400 rounded-xl" />
            <div className="w-1.5 h-4 left-[47.35px] top-[25.10px] absolute bg-slate-400 rounded-[10px]" />
            <div className="w-1.5 h-4 left-0 top-[25.10px] absolute bg-slate-400 rounded-[10px]" />
            <div className="w-2 h-2 left-[15.21px] top-[10.13px] absolute bg-white rounded-full" />
            <div className="w-2 h-2 left-[30.41px] top-[10.13px] absolute bg-white rounded-full" />
            <div className="w-1 h-1 left-[17.38px] top-[12.33px] absolute bg-neutral-400 rounded-full" />
            <div className="w-1 h-1 left-[32.58px] top-[12.33px] absolute bg-neutral-400 rounded-full" />
            <div className="w-0.5 h-1.5 left-[26.07px] top-0 absolute bg-slate-400" />
        </div> */}

        {/* Work Icon */}
        <div className="w-44 h-0 left-0 top-[20px] absolute outline outline-1 outline-white"></div>
        <div className="w-8 h-8 left-[180px] top-1 absolute bg-pink-600" />
        <div className="left-[230px] top-[4px] absolute justify-start text-white text-2xl font-bold font-['Space_Mono']">Work</div>
      </div>

      {/* Email Section Tag*/}
      <div className="left-[85px] top-[134px] absolute justify-start text-white text-sm font-semibold font-['Inter']">Email</div>
    <img className="w-6 h-6 left-[48px] top-[125px] absolute origin-top-left" src={emailIcon} Alt="Email"/>
      

      {/* Search Bar - Simplified */}
        <div className=" flex items-center px-3 py-2">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[1317px] h-6 left-[37px] top-[175px] absolute bg-white/10 rounded-[10px] text-sm font-normal font-['Inter'] placeholder-slate-500 
              focus:ring-2 focus:ring-slate-500 focus:border-transparent pl-10 pr-3 py-2 focus:bg-white/100
              transition-colors"
        />
        {/* Results found indicator */}
        <div className="absolute left-[337px] top-[207px] mt-1 px-3 py-1 bg-sky-950 text-slate-400 text-sm rounded flex items-center gap-1">
        {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-5 text-slate-400 hover:text-slate-200 transition-colors"
    >
      <XMarkIcon className="w-6 h-6" />
    </button>
          )}
          
  {/* Filter button */}
          <div ref={filterRef} className="absolute left-[1020px]  top-[-25px] -translate-y-1/2 z-50">
    <button
      onClick={() => setFiltersOpen(prev => !prev)}
      className={`relative p-1 rounded transition-colors ${
        filtersOpen || activeFilterCount > 0
          ? 'text-blue-400 bg-white/10'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
      }`}
      title="Filter messages"
    >
      <ListFilter className="w-4 h-4" />
      {activeFilterCount > 0 && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {activeFilterCount}
        </span>
      )}
    </button>

    {/* Dropdown */}
    {filtersOpen && (
      <div className="absolute right-0 top-full mt-2 w-56 bg-sky-950 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">

        {/* Status */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</p>
          <div className="flex flex-wrap gap-1">
            {['read','unread', 'starred', 'archived', 'sent', 'important', 'sender', 'keyword', 'spam', 'trash', 'draft'].map(s => (
              <button
                key={s}
                onClick={() => setFilters(f => ({ ...f, status: f.status === s ? null : s }))}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors capitalize ${
                  filters.status === s
                     ? 'bg-white/100 text-blue-700 font-medium border border-blue-300 '
                    : 'bg-white/20 text-slate-200 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 mx-3 my-2" />

        {/* Account */}
        <div className="px-3 pb-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Account</p>
          <div className="flex flex-col gap-1">
            {connectedAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setFilters(f => ({ ...f, account: f.account === acc.id ? null : acc.id }))}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors ${
                  filters.account === acc.id
                    ? 'bg-white/100 text-blue-700 font-medium border border-blue-300 '
                    : 'bg-white/20 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                {acc.email || acc.name}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 mx-3 my-2" />

        {/* Date range */}
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</p>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'Today', value: 'today' },
              { label: 'This Week', value: 'week' },
              { label: 'This Month', value: 'month' },
              { label: 'This Year', value: 'year' },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setFilters(f => ({ ...f, dateRange: f.dateRange === value ? null : value }))}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  filters.dateRange === value
                    ? 'bg-white/100 text-blue-700 font-medium border border-blue-300 '
                    : 'bg-white/20 text-slate-200 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <div className="border-t border-white/10 px-3 py-2">
            <button
              onClick={clearFilters}
              className="w-full text-xs text-red-400 hover:text-red-300 transition-colors text-center"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    )}
  </div>
        
        {/*No results found message */}
        {searchQueryMessages.length === 0 && searchQuery && (
          <div className="absolute left-0 top-full mt-1 w-full bg-sky-950 text-slate-400 text-sm p-2 z-40 rounded">
            No messages found.
          </div>
        )}
      <button
        onClick={() => setSearchQuery('')}
        className="absolute right-2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        {/* <XMarkIcon className="w-6 h-6  top-[186px] left-[68px] absolute" /> */}
      </button>
        </div>
        </div>
  
     

     {/* Main Content with Sidebar - Outlook Style */}
        <div className="flex w-[1480px] h-[calc(100vh-295px)] left-[37px] top-[250px] pr-6 absolute bg-sky-950 rounded-lg shadow">
        {/* Left Sidebar - Folders & Accounts (Resizable) */}
        <div
          className="flex flex-col flex-shrink-0 h-full"
          style={{ width: sidebarWidth }}
        >
          {/* Scrollable Content */}
          <div className="bg-sky-950 flex-1 "
            // overflow-y-auto"
            // style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.3), 12px 0 24px rgba(0,0,0,0.15)' }}
          >
            <div className="flex flex-col justify-start items-start gap-2.5  border-b-slate-200">
              
              {/* All Accounts option */}
              <span className="justify-center px-4 text-slate-200 text-sm font-bold font-['Open_Sans']">All Accounts</span>
              <span className="text-xs px-2 text-slate-200 flex-shrink-0">{connectedAccounts.filter(a => a.sourceId === 'gmail').length === 0
                ? "No accounts" : `${connectedAccounts.filter(a => a.sourceId === 'gmail').length} accounts`}</span>
              <button
                onClick={() => setSelectedAccountId('all')}
                className={`max-w-screen- xl rounded-lg text-sm font-medium text-left flex items-center gap-2 mb-1 transition-colors
                ${selectedAccountId === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-200 hover:bg-slate-100'}`}
              >
              </button>
              
              {/* Individual accounts - Full email display */}
              {connectedAccounts.filter(a => a.sourceId === 'gmail').map(acc => {
                const color = getAccountColor(acc.email);
                const isRevoked = acc.isRevoked || !acc.isValid;
                return (
                  <div key={acc.id} className="mb-1">
                    <button
                      onClick={() => !isRevoked && setSelectedAccountId(acc.id)}
                      className={`w-full px-2 py-2 rounded-lg text-sm text-left flex items-center gap-2 transition-colors
                      ${isRevoked
                        ? 'bg-red-50 text-red-600 cursor-default'
                        : selectedAccountId === acc.id
                          ? `${color.bg} ${color.text} font-medium`
                          : 'text-gray-600 hover:bg-gray-100'}`}
                      title={isRevoked ? `${acc.email} - Access revoked. Click Reconnect.` : acc.email}
                    >
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isRevoked ? 'bg-red-400' : color.dot}`} />
                      <span className="truncate text-xs flex-1">{acc.email}</span>
                      {isRevoked && (
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </button>
                    {isRevoked && (
                      <button
                        onClick={() => {
                          const gmailIntegration = SOURCE_CATEGORIES.flatMap(cat => cat.sources).find(s => s.id === 'gmail');
                          if (gmailIntegration) handleConnectSource(gmailIntegration);
                        }}
                        className="w-full mt-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reconnect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Folder List - No scroll, display all */}
            <div className="flex-shrink-0 py-2 flex-1 flex-col justify-start items-start gap-2.5 ">
              <div className="px-3 py-1.5">
                <div className="text-xs font-medium text-slate-200 uppercase tracking-wider">Folders</div>
              </div>
              {[
                { id: 'INBOX', name: 'Inbox', icon: InboxIcon },
                { id: 'STARRED', name: 'Starred', icon: StarIcon },
                { id: 'SENT', name: 'Sent', icon: PaperAirplaneIcon },
                { id: 'DRAFT', name: 'Drafts', icon: DocumentDuplicateIcon },
                { id: 'ARCHIVE', name: 'Archive', icon: ArchiveBoxIcon },
                { id: 'IMPORTANT', name: 'Important', icon: ExclamationCircleIcon },
                { id: 'SPAM', name: 'Spam', icon: ExclamationTriangleIcon },
                { id: 'TRASH', name: 'Trash', icon: TrashIcon },
              ].map(folder => {
                const FolderIcon = folder.icon;
                const isActive = selectedFolder === folder.id;
                // Use folderCounts state for unread count (industry standard: only show for INBOX)
                const count = folder.id === 'INBOX' ? (folderCounts.INBOX || 0) : 0;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full px-4 py-1.5 flex items-center gap-3 text-sm transition-colors ${isActive
                      ? 'bg-blue-100 text-blue-700 font-medium border-r-2 border-blue-600'
                      : 'text-slate-200 hover:bg-white/10'
                      }`}
                  >
                    <FolderIcon className="w-4 h-4" />
                    <span className="flex-1 text-left">{folder.name}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-200'
                        }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            </div>


          {/* New Email Button */}
          <div className="p-3 bg-sky-950 flex-shrink-0">
            <button
              onClick={handleNewEmail}
              disabled={connectedAccounts.length === 0}
              className="w-full flex items-end justify-center"
              >
              <img src={composeIcon} alt="Compose New Email" className="w-4 h-4 left-[60px]" />
            </button>
          </div>
        </div>

        {/* Resize Handle - Sidebar */}
        <div
          className="w-1 bg-slate-200cursor-col-resize flex-shrink-0 transition-colors active:bg-slate-300 h-full"
          onMouseDown={(e) => handleResizeStart(e, 'sidebar')}
        />

        {/* Message List (Resizable) */}
        <div
          className="flex flex-col bg-sky-950 flex-shrink-0 h-full"
          style={{ width: messageListWidth }}
        >
          {/* Actions Bar */}
          {/* <div className="px-3 py-2 border-b border-gray-100 bg-sky-950 flex items-center gap-1">
            {/* Refresh button */}
            {/* {connectedAccounts.length > 0 && (
              <button
                onClick={handleRefreshMessages}
                disabled={messagesLoading}
                className={`p-1.5 rounded transition-colors ${messagesLoading
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                title="Refresh messages"
              >
                <ArrowPathIcon className={`w-4 h-4 ${messagesLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Mark all as read">
              <CheckCircleIcon className="w-4 h-4" />
            </button>
          </div> */} 
          
          <div ref={messageListContainerRef} className="flex-1 overflow-y-auto"
            // style={{ overflowAnchor: 'none', boxShadow: '4px 0 8px rgba(0,0,0,0.3), 12px 0 24px rgba(0,0,0,0.15)' }}
          >
            {/* Account error banner - shown when token refresh fails */}
            {accountErrors.length > 0 && (
              <div className="mx-2 mt-2 mb-1">
                {accountErrors.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2 px-3 py-2 mb-1 bg-red-50 border border-red-200 rounded-lg text-xs">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-red-700 truncate">
                      <strong>{acc.email}</strong> — access expired, please reconnect
                    </span>
                    <button
                      onClick={() => {
                        const gmailIntegration = SOURCE_CATEGORIES.flatMap(cat => cat.sources).find(s => s.id === 'gmail');
                        if (gmailIntegration) handleConnectSource(gmailIntegration);
                      }}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex-shrink-0 font-medium"
                    >
                      Reconnect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Loading state for initial load */}
            {!accountsLoading && (     // Remove bang from accountsLoading
              <div className="flex flex-col items-center justify-center h-32 text-slate-200">
                <ArrowPathIcon className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Loading accounts...</p>
              </div>
            )}
            {!accountsLoading && filteredMessages.map(message => (
              <MessageListItem
                key={message.id}
                message={message}
                isSelected={selectedMessage?.id === message.id}
              />
            ))}

            {/* Infinite scroll sentinel - triggers auto-load when visible (Outlook style) */}
            {accountsLoading && filteredMessages.length > 0 && (
              <div ref={scrollSentinelRef} className="h-1" />
            )}

            {/* Loading more indicator at bottom */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4 text-slate-400">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-sm">Loading more messages...</span>
              </div>
            )}

            {/* End of messages indicator */}
            {!accountsLoading && filteredMessages.length > 0 && !hasMoreMessages && !loadingMore && (
              <div className="flex items-center justify-center py-3 text-slate-400 text-xs">
                — End of messages —
              </div>
            )}

            {accountsLoading && filteredMessages.length === 0 && (  //Add bang to accountsLoading
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                <InboxIcon className="w-12 h-12 mb-3" />
                {connectedAccounts.length === 0 ? (
                  <>
                    <p className="text-lg font-medium text-slate-500">No accounts connected</p>
                    <p className="text-sm mb-4">Connect your Gmail account to see your emails here</p>
                    <button
                      onClick={() => {
                        const gmailIntegration = SOURCE_CATEGORIES
                          .flatMap(cat => cat.sources)
                          .find(s => s.id === 'gmail');
                        if (gmailIntegration) handleConnectSource(gmailIntegration);
                      }}
                      className="px-4 py-2 bg-white/10 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Connect Gmail
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-slate-500">No messages found</p>
                    <p className="text-sm">Your inbox is empty or try adjusting your filters</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle - Message List */}
        <div
          className="w-1 bg-slate-200cursor-col-resize flex-shrink-0 transition-colors active:bg-slate-300 h-full"
          onMouseDown={(e) => handleResizeStart(e, 'messageList')}
        />

        {/* Message Detail - Takes remaining space */}
        <div className="flex-1 min-w-0 h-full overflow-hidden"
          // style={{ boxShadow: '4px 0 8px rgba(0.3,0,0,0.3), 12px 0 24px rgba(0.15,0,0,0.15)' }}
        >
          <MessageDetailPanel
            message={selectedMessage}
            bodyLoading={messageBodyLoading}
            selectedFolder={selectedFolder}
            handleReply={handleReply}
            handleReplyAll={handleReplyAll}
            handleForward={handleForward}
            handleArchiveMessage={handleArchiveMessage}
            handleUntrashMessage={handleUntrashMessage}
            handleTrashMessage={handleTrashMessage}
            handleStarMessage={handleStarMessage}
            actionLoading={actionLoading}
            onCreateTask={handleCreateTaskFromEmail}
          />
        </div>
      </div>

      {/* Compose Email Modal - Side-by-Side Layout */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {composeMode === 'new' ? 'New Email' :
                  composeMode === 'reply' ? 'Reply' :
                    composeMode === 'replyAll' ? 'Reply All' :
                      composeMode === 'forward' ? 'Forward' : 'Compose'}
              </h3>
              <button
                onClick={() => {
                  setShowComposeModal(false);
                  setComposeData({
                    to: '', cc: '', bcc: '', subject: '', body: '',
                    replyToMessageId: null, threadId: null, originalMessage: null,
                  });
                  setAttachments([]);
                  setAiSuggestions(null);
                  setShowAIAssist(false);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Two-Column Layout */}
            <div className="flex-1 flex min-h-0">
              {/* Left Panel - Email Form */}
              <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* To Field with Autocomplete */}
                  <div className="flex items-start gap-2 relative">
                    <label className="w-14 text-sm font-medium text-gray-500 flex-shrink-0 pt-2">To</label>
                    <div className="flex-1 relative">
                      <div className="flex flex-wrap gap-1 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white min-h-[40px]">
                        {/* Display existing recipients as tags */}
                        {parseRecipients(composeData.to).map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                          >
                            {email}
                            <button
                              onClick={() => {
                                const emails = parseRecipients(composeData.to).filter((_, i) => i !== idx);
                                setComposeData(prev => ({ ...prev, to: emails.join(', ') }));
                              }}
                              className="hover:text-blue-600"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={recipientSearchQuery && activeRecipientField === 'to' ? recipientSearchQuery : ''}
                          onChange={(e) => handleRecipientInputChange(
                            [...parseRecipients(composeData.to), e.target.value].join(', '),
                            'to'
                          )}
                          onFocus={() => setActiveRecipientField('to')}
                          onBlur={() => setTimeout(() => {
                            if (activeRecipientField === 'to') {
                              setRecipientSuggestions([]);
                              setActiveRecipientField(null);
                            }
                          }, 200)}
                          placeholder={parseRecipients(composeData.to).length === 0 ? "Type email address..." : ""}
                          className="flex-1 min-w-[150px] border-none outline-none text-sm bg-transparent"
                        />
                      </div>
                      {/* Autocomplete dropdown */}
                      {activeRecipientField === 'to' && recipientSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {recipientSuggestions.map((recipient, idx) => (
                            <button
                              key={idx}
                              onClick={() => addRecipient(recipient.email, 'to')}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {recipient.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{recipient.name}</div>
                                <div className="text-xs text-gray-500 truncate">{recipient.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CC Field with Autocomplete */}
                  <div className="flex items-start gap-2 relative">
                    <label className="w-14 text-sm font-medium text-gray-500 flex-shrink-0 pt-2">CC</label>
                    <div className="flex-1 relative">
                      <div className="flex flex-wrap gap-1 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white min-h-[40px]">
                        {parseRecipients(composeData.cc).map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"
                          >
                            {email}
                            <button
                              onClick={() => {
                                const emails = parseRecipients(composeData.cc).filter((_, i) => i !== idx);
                                setComposeData(prev => ({ ...prev, cc: emails.join(', ') }));
                              }}
                              className="hover:text-green-600"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={recipientSearchQuery && activeRecipientField === 'cc' ? recipientSearchQuery : ''}
                          onChange={(e) => handleRecipientInputChange(
                            [...parseRecipients(composeData.cc), e.target.value].join(', '),
                            'cc'
                          )}
                          onFocus={() => setActiveRecipientField('cc')}
                          onBlur={() => setTimeout(() => {
                            if (activeRecipientField === 'cc') {
                              setRecipientSuggestions([]);
                              setActiveRecipientField(null);
                            }
                          }, 200)}
                          placeholder={parseRecipients(composeData.cc).length === 0 ? "Type email address..." : ""}
                          className="flex-1 min-w-[150px] border-none outline-none text-sm bg-transparent"
                        />
                      </div>
                      {activeRecipientField === 'cc' && recipientSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {recipientSuggestions.map((recipient, idx) => (
                            <button
                              key={idx}
                              onClick={() => addRecipient(recipient.email, 'cc')}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {recipient.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{recipient.name}</div>
                                <div className="text-xs text-gray-500 truncate">{recipient.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BCC Field with Autocomplete */}
                  <div className="flex items-start gap-2 relative">
                    <label className="w-14 text-sm font-medium text-gray-500 flex-shrink-0 pt-2">BCC</label>
                    <div className="flex-1 relative">
                      <div className="flex flex-wrap gap-1 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white min-h-[40px]">
                        {parseRecipients(composeData.bcc).map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs"
                          >
                            {email}
                            <button
                              onClick={() => {
                                const emails = parseRecipients(composeData.bcc).filter((_, i) => i !== idx);
                                setComposeData(prev => ({ ...prev, bcc: emails.join(', ') }));
                              }}
                              className="hover:text-orange-600"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={recipientSearchQuery && activeRecipientField === 'bcc' ? recipientSearchQuery : ''}
                          onChange={(e) => handleRecipientInputChange(
                            [...parseRecipients(composeData.bcc), e.target.value].join(', '),
                            'bcc'
                          )}
                          onFocus={() => setActiveRecipientField('bcc')}
                          onBlur={() => setTimeout(() => {
                            if (activeRecipientField === 'bcc') {
                              setRecipientSuggestions([]);
                              setActiveRecipientField(null);
                            }
                          }, 200)}
                          placeholder={parseRecipients(composeData.bcc).length === 0 ? "Type email address..." : ""}
                          className="flex-1 min-w-[150px] border-none outline-none text-sm bg-transparent"
                        />
                      </div>
                      {activeRecipientField === 'bcc' && recipientSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {recipientSuggestions.map((recipient, idx) => (
                            <button
                              key={idx}
                              onClick={() => addRecipient(recipient.email, 'bcc')}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {recipient.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{recipient.name}</div>
                                <div className="text-xs text-gray-500 truncate">{recipient.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="w-14 text-sm font-medium text-gray-500 flex-shrink-0">Subject</label>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={composeData.subject}
                          onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Subject"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button
                          onClick={async () => {
                            if (!composeData.body && !composeData.originalMessage) {
                              // Can't generate without context
                              return;
                            }
                            setAiAssistLoading('subject_gen');
                            try {
                              const context = composeData.body || composeData.originalMessage?.body || '';
                              const originalSubject = composeData.originalMessage?.subject || '';
                              const start = Date.now();
                              // Mock delay if needed, but we have real API
                              const subjects = await emailAI.getReplySubjects(context, originalSubject, selectedIntent, selectedTone);
                              setAiSuggestions(prev => ({ ...prev, subjects }));
                            } catch (e) {
                              console.error(e);
                            }
                            setAiAssistLoading(null);
                          }}
                          disabled={aiAssistLoading === 'subject_gen'}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                          title="Generate 3 subject options"
                        >
                          <SparklesIcon className={`w-5 h-5 ${aiAssistLoading === 'subject_gen' ? 'animate-spin text-blue-600' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {/* Subject Suggestions */}
                    {aiSuggestions?.subjects && (
                      <div className="ml-16 flex flex-wrap gap-2 animate-fade-in">
                        {aiSuggestions.subjects.map((subj, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setComposeData(prev => ({ ...prev, subject: subj }));
                              setAiSuggestions(prev => ({ ...prev, subjects: null }));
                            }}
                            className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100 hover:border-purple-300 transition-colors text-left max-w-md truncate"
                          >
                            {subj}
                          </button>
                        ))}
                        <button
                          onClick={() => setAiSuggestions(prev => ({ ...prev, subjects: null }))}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  {attachments.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                          <PaperClipIcon className="w-3.5 h-3.5" />
                          Attachments ({attachments.length})
                        </span>
                        <span className="text-xs text-gray-500">
                          Total: {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg group hover:border-gray-300 transition-colors"
                          >
                            <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-700 max-w-[150px] truncate">
                                {attachment.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatFileSize(attachment.size)}
                              </span>
                            </div>
                            <button
                              onClick={() => removeAttachment(attachment.id)}
                              className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Body - Takes remaining space */}
                  <div className="flex-1 flex flex-col min-h-[300px] relative">
                    <textarea
                      ref={composeTextareaRef}
                      value={composeData.body}
                      onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                      onSelect={handleTextSelection}
                      onMouseUp={handleTextSelection}
                      onMouseDown={handleTextSelectionStart}
                      onKeyUp={handleTextSelection}
                      placeholder="Write your message... (Select text to access AI tools)"
                      className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    />

                    {/* Text Selection Popup */}
                    {textSelectionPopup.visible && (
                      <div
                        data-text-selection-popup
                        className="fixed bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 flex gap-1 z-50 animate-fade-in"
                        style={{
                          left: `${textSelectionPopup.x}px`,
                          top: `${textSelectionPopup.y}px`,
                        }}
                      >
                        <button
                          onClick={() => applyAIToSelection('polish')}
                          disabled={aiAssistLoading?.startsWith('selection_')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Polish selected text"
                        >
                          {aiAssistLoading === 'selection_polish' ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <SparklesIcon className="w-3.5 h-3.5" />
                          )}
                          Polish
                        </button>
                        <button
                          onClick={() => applyAIToSelection('concise')}
                          disabled={aiAssistLoading?.startsWith('selection_')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Make more concise"
                        >
                          {aiAssistLoading === 'selection_concise' ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ScissorsIcon className="w-3.5 h-3.5" />
                          )}
                          Concise
                        </button>
                        <button
                          onClick={() => applyAIToSelection('expand')}
                          disabled={aiAssistLoading?.startsWith('selection_')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Explain more"
                        >
                          {aiAssistLoading === 'selection_expand' ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
                          )}
                          Expand
                        </button>
                        <button
                          onClick={() => applyAIToSelection('spelling')}
                          disabled={aiAssistLoading?.startsWith('selection_')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Fix spelling"
                        >
                          {aiAssistLoading === 'selection_spelling' ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckBadgeIcon className="w-3.5 h-3.5" />
                          )}
                          Spelling
                        </button>
                        <button
                          onClick={() => setTextSelectionPopup(prev => ({ ...prev, visible: false }))}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Attach Files */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="*/*"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                      title="Attach files (max 25MB total)"
                    >
                      <PaperClipIcon className="w-4 h-4" />
                      Attach
                    </button>

                    <button
                      onClick={handleSaveDraft}
                      className="px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Save Draft
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowComposeModal(false);
                        setComposeData({
                          to: '', cc: '', bcc: '', subject: '', body: '',
                          replyToMessageId: null, threadId: null, originalMessage: null,
                        });
                        setAttachments([]);
                        setAiSuggestions(null);
                        setShowAIAssist(false);
                      }}
                      className="px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={!composeData.to || sendingEmail}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingEmail ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <PaperAirplaneIcon className="w-4 h-4" />
                          Send
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel - AI Assistant */}
              <div className="w-[380px] flex flex-col bg-gray-50 flex-shrink-0 border-l border-gray-200 h-full">
                {/* AI Panel Header */}
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-800">AI Assistant</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-200 flex flex-col">

                  {/* Top section - Settings and Custom Instructions */}
                  <div className="flex flex-col flex-1 min-h-0">
                  {/* 1. Global Controls - Settings (Compact) */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Settings</span>
                    </div>
                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Intent Selector */}
                      <div className="relative group">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Intent</label>
                        <div className="relative">
                          <button
                            onClick={() => setShowIntentDropdown(!showIntentDropdown)}
                            className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-all font-medium text-gray-700 text-left capitalize focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          >
                            <span className="truncate">{selectedIntent}</span>
                            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                          </button>
                          <FlagIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 group-hover:text-blue-500 transition-colors pointer-events-none" />

                          {/* Intent Dropdown Menu */}
                          {showIntentDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setShowIntentDropdown(false)}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 w-[180px]">
                                {[
                                  'Response',
                                  'Request',
                                  'Follow-up',
                                  'Reminder',
                                  'Thank you',
                                  'Apology',
                                  'Decline / Reject',
                                  'Negotiate',
                                  'Persuade',
                                  'Inform / Update'
                                ].map(i => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setSelectedIntent(i);
                                      setShowIntentDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${selectedIntent === i ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'}`}
                                  >
                                    <span className="truncate">{i}</span>
                                    {selectedIntent === i && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tone Selector */}
                      <div className="relative group">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Tone</label>
                        <div className="relative">
                          <button
                            onClick={() => setShowToneDropdown(!showToneDropdown)}
                            className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-all font-medium text-gray-700 text-left capitalize focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          >
                            <span className="truncate">{selectedTone}</span>
                            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                          </button>
                          <FaceSmileIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 group-hover:text-blue-500 transition-colors pointer-events-none" />

                          {/* Tone Dropdown Menu */}
                          {showToneDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setShowToneDropdown(false)}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                                {[
                                  'professional',
                                  'friendly',
                                  'direct',
                                  'urgent',
                                  'empathetic',
                                  'persuasive',
                                  'appreciative',
                                  'apologetic',
                                  'formal',
                                  'casual'
                                ].map(t => (
                                  <button
                                    key={t}
                                    onClick={() => {
                                      setSelectedTone(t);
                                      setShowToneDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors capitalize flex items-center justify-between ${selectedTone === t ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'}`}
                                  >
                                    {t}
                                    {selectedTone === t && <CheckIcon className="w-3.5 h-3.5" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Length Selector */}
                      <div className="relative group">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Length</label>
                        <div className="relative">
                          <button
                            onClick={() => setShowLengthDropdown(!showLengthDropdown)}
                            className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-all font-medium text-gray-700 text-left capitalize focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          >
                            <span className="truncate">{selectedLength}</span>
                            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                          </button>
                          <ListBulletIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 group-hover:text-blue-500 transition-colors pointer-events-none" />

                          {/* Length Dropdown Menu */}
                          {showLengthDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setShowLengthDropdown(false)}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                                {['short', 'medium', 'long'].map(l => (
                                  <button
                                    key={l}
                                    onClick={() => {
                                      setSelectedLength(l);
                                      setShowLengthDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors capitalize flex items-center justify-between ${selectedLength === l ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'}`}
                                  >
                                    {l}
                                    {selectedLength === l && <CheckIcon className="w-3.5 h-3.5" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Language Selector */}
                      <div className="relative group">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Language</label>
                        <div className="relative">
                          <button
                            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                            className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs flex items-center justify-between hover:bg-blue-50 hover:border-blue-200 transition-all font-medium text-gray-700 text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          >
                            <span className="truncate">{selectedLanguage}</span>
                            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                          </button>
                          <LanguageIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 group-hover:text-blue-500 transition-colors pointer-events-none" />

                          {/* Dropdown Menu */}
                          {showLanguageDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setShowLanguageDropdown(false)}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                                {[
                                  'English',
                                  'Chinese (Simplified)',
                                  'Chinese (Traditional)',
                                  'Spanish',
                                  'French',
                                  'German',
                                  'Japanese',
                                  'Korean',
                                  'Portuguese',
                                  'Russian',
                                  'Arabic',
                                  'Italian',
                                  'Dutch',
                                  'Vietnamese',
                                  'Thai'
                                ].map(l => (
                                  <button
                                    key={l}
                                    onClick={() => {
                                      setSelectedLanguage(l);
                                      setShowLanguageDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${selectedLanguage === l ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'}`}
                                  >
                                    {l}
                                    {selectedLanguage === l && <CheckIcon className="w-3.5 h-3.5" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Custom Generation Input (Flexible height) */}
                  <div className="flex flex-col flex-1 min-h-0 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Custom Instructions</label>
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-medium">Optional</span>
                      </div>
                    </div>
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder="Describe what you want to write..."
                      className="w-full flex-1 min-h-[100px] px-3 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm shadow-sm placeholder-gray-400 mb-3"
                    />
                    <button
                      onClick={() => {
                        // Allow generation even if text is empty
                        setAiAssistLoading('compose');

                        // Preserve the original email quote
                        const fullBody = composeData.body || '';
                        const separator = '--- Original Message ---';
                        const sepIndex = fullBody.indexOf(separator);
                        const originalQuote = sepIndex !== -1 ? fullBody.substring(sepIndex) : '';

                        setComposeData(prev => ({ ...prev, body: '' }));

                        const context = composeData.originalMessage
                          ? (typeof composeData.originalMessage.body === 'string' ? composeData.originalMessage.body : '')
                          : '';
                        const senderName = user?.name || user?.email || 'Me';
                        const recipientName = composeData.originalMessage?.from?.name || 'Recipient';

                        // Improved prompt construction
                        let instructions = "";
                        if (composerText.trim()) {
                          instructions += `${composerText}\n\n`;
                        } else {
                          // If no custom text, rely on context and settings
                          instructions += `Write a response enabling me to reply to this email.\n`;
                        }

                        instructions += `Intent: ${selectedIntent}\nTone: ${selectedTone}\nLength: ${selectedLength}\nOutput Language: ${selectedLanguage}`;

                        emailAI.draftStream(
                          instructions,
                          context,
                          senderName,
                          recipientName,
                          (token) => {
                            setComposeData(prev => ({ ...prev, body: (prev.body || '') + token }));
                          },
                          () => {
                            // Append original quote after draft generation
                            if (originalQuote) {
                              setComposeData(prev => ({ ...prev, body: prev.body + '\n\n' + originalQuote }));
                            }
                            setAiAssistLoading(null);
                            setComposerText('');
                          },
                          (error) => {
                            console.error('Draft error:', error);
                            // Restore original body on error
                            setComposeData(prev => ({ ...prev, body: fullBody }));
                            setAiAssistLoading(null);
                          }
                        );
                      }}
                      disabled={!!aiAssistLoading}
                      className="w-full py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98] flex-shrink-0"
                    >
                      {aiAssistLoading === 'compose' ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <PencilSquareIcon className="w-4 h-4" />
                          <span>Generate Draft</span>
                        </>
                      )}
                    </button>

                    {/* Restore Original Button - Always renders but disabled when not needed */}
                    <button
                      onClick={() => {
                        setComposeData(prev => ({ ...prev, body: initialComposeBody }));
                      }}
                      disabled={aiAssistLoading || initialComposeBody === composeData.body}
                      className="w-full py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98] flex-shrink-0 mt-2"
                      title="Restore to original email content"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      <span>Restore Original</span>
                    </button>
                  </div>
                  </div>

                  {/* Bottom section - 4 action buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {/* Polish */}
                    <button
                      onClick={() => {
                        if (!composeData.body.trim()) return;
                        setAiAssistLoading('polish');
                        const fullBody = composeData.body;
                        // Separate user input from original email quote
                        const separator = '--- Original Message ---';
                        const sepIndex = fullBody.indexOf(separator);
                        const userInput = sepIndex !== -1 ? fullBody.substring(0, sepIndex).trim() : fullBody;
                        const originalQuote = sepIndex !== -1 ? fullBody.substring(sepIndex) : '';

                        if (!userInput.trim()) {
                          setAiAssistLoading(null);
                          return;
                        }
                        setComposeData(prev => ({ ...prev, body: '' }));

                        emailAI.polishStream(
                          userInput,
                          selectedTone,
                          `Fix grammar, improve fluency, and make it ${selectedTone}`,
                          (token) => setComposeData(prev => ({ ...prev, body: (prev.body || '') + token })),
                          () => {
                            // Append original quote after polishing
                            if (originalQuote) {
                              setComposeData(prev => ({ ...prev, body: prev.body + '\n\n' + originalQuote }));
                            }
                            setAiAssistLoading(null);
                          },
                          (err) => {
                            console.error(err);
                            setComposeData(prev => ({ ...prev, body: fullBody }));
                            setAiAssistLoading(null);
                          }
                        );
                      }}
                      disabled={aiAssistLoading === 'polish' || !composeData.body.trim()}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50/50 hover:shadow-sm transition-all text-center"
                    >
                      {aiAssistLoading === 'polish' ? (
                        <ArrowPathIcon className="w-5 h-5 text-green-600 animate-spin" />
                      ) : (
                        <SparklesIcon className="w-5 h-5 text-green-600" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">Polish</span>
                    </button>

                    {/* Make Concise */}
                    <button
                      onClick={() => {
                        if (!composeData.body.trim()) return;
                        setAiAssistLoading('concise');
                        const fullBody = composeData.body;
                        // Separate user input from original email quote
                        const separator = '--- Original Message ---';
                        const sepIndex = fullBody.indexOf(separator);
                        const userInput = sepIndex !== -1 ? fullBody.substring(0, sepIndex).trim() : fullBody;
                        const originalQuote = sepIndex !== -1 ? fullBody.substring(sepIndex) : '';

                        if (!userInput.trim()) {
                          setAiAssistLoading(null);
                          return;
                        }
                        setComposeData(prev => ({ ...prev, body: '' }));

                        emailAI.polishStream(
                          userInput,
                          selectedTone,
                          `Make this text more concise and to the point. Remove unnecessary words.`,
                          (token) => setComposeData(prev => ({ ...prev, body: (prev.body || '') + token })),
                          () => {
                            // Append original quote after processing
                            if (originalQuote) {
                              setComposeData(prev => ({ ...prev, body: prev.body + '\n\n' + originalQuote }));
                            }
                            setAiAssistLoading(null);
                          },
                          (err) => {
                            console.error(err);
                            setComposeData(prev => ({ ...prev, body: fullBody }));
                            setAiAssistLoading(null);
                          }
                        );
                      }}
                      disabled={aiAssistLoading === 'concise' || !composeData.body.trim()}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-sm transition-all text-center"
                    >
                      {aiAssistLoading === 'concise' ? (
                        <ArrowPathIcon className="w-5 h-5 text-purple-600 animate-spin" />
                      ) : (
                        <ScissorsIcon className="w-5 h-5 text-purple-600" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">Make Concise</span>
                    </button>



                    {/* Explain More */}
                    <button
                      onClick={() => {
                        if (!composeData.body.trim()) return;
                        setAiAssistLoading('expand');
                        const fullBody = composeData.body;
                        // Separate user input from original email quote
                        const separator = '--- Original Message ---';
                        const sepIndex = fullBody.indexOf(separator);
                        const userInput = sepIndex !== -1 ? fullBody.substring(0, sepIndex).trim() : fullBody;
                        const originalQuote = sepIndex !== -1 ? fullBody.substring(sepIndex) : '';

                        if (!userInput.trim()) {
                          setAiAssistLoading(null);
                          return;
                        }
                        setComposeData(prev => ({ ...prev, body: '' }));

                        emailAI.polishStream(
                          userInput,
                          selectedTone,
                          `Expand on this text to provide more detail and context.`,
                          (token) => setComposeData(prev => ({ ...prev, body: (prev.body || '') + token })),
                          () => {
                            // Append original quote after processing
                            if (originalQuote) {
                              setComposeData(prev => ({ ...prev, body: prev.body + '\n\n' + originalQuote }));
                            }
                            setAiAssistLoading(null);
                          },
                          (err) => {
                            console.error(err);
                            setComposeData(prev => ({ ...prev, body: fullBody }));
                            setAiAssistLoading(null);
                          }
                        );
                      }}
                      disabled={aiAssistLoading === 'expand' || !composeData.body.trim()}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm transition-all text-center"
                    >
                      {aiAssistLoading === 'expand' ? (
                        <ArrowPathIcon className="w-5 h-5 text-indigo-600 animate-spin" />
                      ) : (
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-indigo-600" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">Explain More</span>
                    </button>

                    {/* Fix Spelling Only */}
                    <button
                      onClick={() => {
                        if (!composeData.body.trim()) return;
                        setAiAssistLoading('spelling');
                        const fullBody = composeData.body;
                        // Separate user input from original email quote
                        const separator = '--- Original Message ---';
                        const sepIndex = fullBody.indexOf(separator);
                        const userInput = sepIndex !== -1 ? fullBody.substring(0, sepIndex).trim() : fullBody;
                        const originalQuote = sepIndex !== -1 ? fullBody.substring(sepIndex) : '';

                        if (!userInput.trim()) {
                          setAiAssistLoading(null);
                          return;
                        }
                        setComposeData(prev => ({ ...prev, body: '' }));

                        emailAI.polishStream(
                          userInput,
                          selectedTone,
                          `Strictly fix ONLY spelling and basic grammar errors. Do not change the tone or structure.`,
                          (token) => setComposeData(prev => ({ ...prev, body: (prev.body || '') + token })),
                          () => {
                            // Append original quote after processing
                            if (originalQuote) {
                              setComposeData(prev => ({ ...prev, body: prev.body + '\n\n' + originalQuote }));
                            }
                            setAiAssistLoading(null);
                          },
                          (err) => {
                            console.error(err);
                            setComposeData(prev => ({ ...prev, body: fullBody }));
                            setAiAssistLoading(null);
                          }
                        );
                      }}
                      disabled={aiAssistLoading === 'spelling' || !composeData.body.trim()}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-sm transition-all text-center"
                    >
                      {aiAssistLoading === 'spelling' ? (
                        <ArrowPathIcon className="w-5 h-5 text-amber-600 animate-spin" />
                      ) : (
                        <CheckBadgeIcon className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">Fix Spelling</span>
                    </button>
                  </div>

                </div>



                {/* AI Results/Suggestions */}
                {showAIAssist === true && aiSuggestions && (
                  <div className="space-y-3">
                    {/* Subject Suggestions */}
                    {aiSuggestions.subjects && (
                      <div className="bg-white border border-yellow-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
                          <span className="text-xs font-medium text-yellow-800 flex items-center gap-1.5">
                            <LightBulbIcon className="w-4 h-4" />
                            Subject Suggestions
                          </span>
                          <button onClick={() => setAiSuggestions(prev => ({ ...prev, subjects: null }))} className="text-yellow-600 hover:text-yellow-800">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2 space-y-1">
                          {aiSuggestions.subjects.map((subj, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setComposeData(prev => ({ ...prev, subject: subj }));
                                setAiSuggestions(prev => ({ ...prev, subjects: null }));
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                            >
                              {subj}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grammar Results */}
                    {aiSuggestions.grammar && (
                      <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-green-50 border-b border-green-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AcademicCapIcon className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-green-800">Grammar & Style</span>
                            <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-xs rounded">{aiSuggestions.grammar.score}/100</span>
                          </div>
                          <button onClick={() => setAiSuggestions(prev => ({ ...prev, grammar: null }))} className="text-green-600 hover:text-green-800">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {aiSuggestions.grammar.corrections.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded text-xs">
                              <span className="text-red-600 line-through">{c.original}</span>
                              <ArrowRightIcon className="w-3 h-3 text-gray-400" />
                              <span className="text-green-700 font-medium">{c.suggestion}</span>
                              <button
                                onClick={() => setComposeData(prev => ({ ...prev, body: prev.body.replace(c.original, c.suggestion) }))}
                                className="ml-auto px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Fix
                              </button>
                            </div>
                          ))}
                          {aiSuggestions.grammar.improvements.map((imp, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                              <LightBulbIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              <span>{imp.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tone Rewrite */}
                    {aiSuggestions.tone && (
                      <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
                          <span className="text-xs font-medium text-purple-800 flex items-center gap-1.5">
                            <FaceSmileIcon className="w-4 h-4" />
                            {aiSuggestions.tone.suggested.charAt(0).toUpperCase() + aiSuggestions.tone.suggested.slice(1)} Tone
                          </span>
                          <button onClick={() => setAiSuggestions(prev => ({ ...prev, tone: null }))} className="text-purple-600 hover:text-purple-800">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-purple-800 mb-3">{aiSuggestions.tone.rewrite}</p>
                          <button
                            onClick={() => {
                              setComposeData(prev => ({ ...prev, body: aiSuggestions.tone.rewrite }));
                              setAiSuggestions(prev => ({ ...prev, tone: null }));
                            }}
                            className="w-full py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Use This Version
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Improved Version */}
                    {aiSuggestions.improved && (
                      <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
                            <SparklesIcon className="w-4 h-4" />
                            Improved Version
                          </span>
                          <button onClick={() => setAiSuggestions(prev => ({ ...prev, improved: null }))} className="text-blue-600 hover:text-blue-800">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-blue-800 mb-2">{aiSuggestions.improved.improved}</p>
                          <div className="flex items-center gap-1 flex-wrap mb-3">
                            {aiSuggestions.improved.changes.map((c, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">✓ {c}</span>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              setComposeData(prev => ({ ...prev, body: aiSuggestions.improved.improved }));
                              setAiSuggestions(prev => ({ ...prev, improved: null }));
                            }}
                            className="w-full py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Apply Improvements
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Preview Modal - Shows before/after with Replace/Discard */}
      {aiPreviewModal.visible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                  <SparklesIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">AI Preview</h3>
                  <p className="text-xs text-gray-500">
                    {aiPreviewModal.actionType === 'polish' && 'Polishing your text...'}
                    {aiPreviewModal.actionType === 'concise' && 'Making text more concise...'}
                    {aiPreviewModal.actionType === 'expand' && 'Expanding with more detail...'}
                    {aiPreviewModal.actionType === 'spelling' && 'Fixing spelling errors...'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleAIPreviewDiscard}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Original Text */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded uppercase">Original</span>
                  <span className="text-xs text-gray-400">{aiPreviewModal.originalText.length} characters</span>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {aiPreviewModal.originalText}
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                  <ArrowPathIcon className={`w-5 h-5 text-blue-600 ${aiPreviewModal.isStreaming ? 'animate-spin' : ''}`} />
                </div>
              </div>

              {/* Modified Text */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold rounded uppercase">Modified</span>
                  <span className="text-xs text-gray-400">
                    {aiPreviewModal.modifiedText.length} characters
                    {aiPreviewModal.isStreaming && (
                      <span className="ml-2 text-blue-500 animate-pulse">● Generating...</span>
                    )}
                  </span>
                </div>
                <div className={`p-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl min-h-[100px] ${aiPreviewModal.isStreaming ? 'border-blue-300' : ''}`}>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {aiPreviewModal.modifiedText || (
                      <span className="text-gray-400 italic">Waiting for AI response...</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">
                {aiPreviewModal.modifiedText && !aiPreviewModal.isStreaming && (
                  <span className="text-green-600">
                    ✓ {aiPreviewModal.modifiedText.length - aiPreviewModal.originalText.length > 0 ? '+' : ''}{aiPreviewModal.modifiedText.length - aiPreviewModal.originalText.length} characters
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAIPreviewDiscard}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleAIPreviewRegenerate}
                  disabled={aiPreviewModal.isStreaming}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate a different version"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${aiPreviewModal.isStreaming ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={handleAIPreviewReplace}
                  disabled={aiPreviewModal.isStreaming || !aiPreviewModal.modifiedText}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                >
                  <CheckIcon className="w-4 h-4" />
                  Replace Text
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {
        lightboxImage && (
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
            onClick={() => setLightboxImage(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            {/* Image container */}
            <div
              className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Image alt text / caption */}
            {lightboxImage.alt && lightboxImage.alt !== 'Email image' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white text-sm rounded-lg">
                {lightboxImage.alt}
              </div>
            )}

            {/* Keyboard hint */}
            <div className="absolute bottom-4 right-4 text-white/50 text-xs">
              Press ESC or click outside to close
            </div>
          </div>
        )
      }

      {/* Task from Email Modal */}
      {showTaskFromEmailModal && taskFromEmailData && (
        <TaskFromEmailModal
          isOpen={showTaskFromEmailModal}
          onClose={() => {
            setShowTaskFromEmailModal(false);
            setTaskFromEmailData(null);
          }}
          taskData={taskFromEmailData}
        />
      )}
    </div >
    
  );
};

// Task from Email Modal Component
const TaskFromEmailModal = ({ isOpen, onClose, taskData }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    category: '',
    external_source: '',
    external_id: '',
    external_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (taskData) {
      setFormData({
        title: taskData.title || '',
        description: taskData.description || '',
        priority: taskData.priority || 'medium',
        status: taskData.status || 'todo',
        due_date: taskData.due_date || '',
        category: taskData.category || '',
        external_source: taskData.external_source || '',
        external_id: taskData.external_id || '',
        external_url: taskData.external_url || '',
      });
    }
  }, [taskData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      await todos.create(formData, user?.id);
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardDocumentListIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Task from Email</h2>
              <p className="text-sm text-gray-500">Convert this email into an actionable task</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Email Source Badge */}
          {formData.external_source && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <EnvelopeIcon className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-600">Source: Gmail</span>
              {formData.external_url && (
                <a
                  href={formData.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  View Email
                </a>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Add more details..."
            />
          </div>

          {/* Priority & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="none">No Status</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
          </div>

          {/* Due Date & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <DatePicker
                selected={formData.due_date ? new Date(formData.due_date + 'T00:00:00') : null}
                onChange={(date) => setFormData(prev => ({ ...prev, due_date: date ? formatDate(date) : '' }))}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select date"
                isClearable
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                calendarClassName="extraction-datepicker"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Work, Personal"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.title.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// TASKS SUBTAB - Jira-like Task Management
// --------------------------------------------------------------------------

// --- Markdown Toolbar for Notes textarea ---
const MD_ICONS = {
  bold: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h6a4 4 0 014 4 4 4 0 01-1.5 3.12A4.5 4.5 0 0115 14.5 4.5 4.5 0 0110.5 19H4a1 1 0 01-1-1V4zm4 5h2a2 2 0 100-4H7v4zm0 2v4h3.5a2.5 2.5 0 100-5H7z" /></svg>,
  italic: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M8 3a1 1 0 011-1h6a1 1 0 110 2h-2.268l-2 14H13a1 1 0 110 2H7a1 1 0 110-2h2.268l2-14H9a1 1 0 01-1-1z" /></svg>,
  strike: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M10 3a4 4 0 00-4 4h2a2 2 0 114 0 2 2 0 01-.586 1.414l-.707.707A4 4 0 006 13v1h2v-1a2 2 0 01.586-1.414l.707-.707A4 4 0 0010 3z" /></svg>,
  code: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  h1: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><text x="2" y="15" fontSize="14" fontWeight="bold" fontFamily="sans-serif">H1</text></svg>,
  h2: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><text x="2" y="15" fontSize="14" fontWeight="bold" fontFamily="sans-serif">H2</text></svg>,
  h3: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><text x="2" y="15" fontSize="14" fontWeight="bold" fontFamily="sans-serif">H3</text></svg>,
  bulletList: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" /></svg>,
  orderedList: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4.5a.5.5 0 01.5-.5H4a.5.5 0 01.5.5v2H5a.5.5 0 010 1H3a.5.5 0 010-1h.5v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5.5a.5.5 0 01.5-.5h1a1 1 0 010 2H4v.5a.5.5 0 01-1 0v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5.5a.5.5 0 01.5-.5h1a1 1 0 010 2H4v.5a.5.5 0 01-1 0v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" /></svg>,
  taskList: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  quote: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h8a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm5 0a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  codeBlock: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  hr: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  link: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
};

const mdToolbarBtnStyle = {
  padding: '6px',
  margin: 0,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  color: '#4b5563',
  transition: 'background-color 0.1s',
};

const insertMarkdown = (textareaEl, type, value, setValue) => {
  if (!textareaEl) return;
  const { selectionStart: s, selectionEnd: e } = textareaEl;
  const text = value || '';
  const selected = text.substring(s, e);
  let newText, selStart, selEnd;

  const wrapWith = (before, after) => {
    const closing = after || before;
    if (selected) {
      newText = text.substring(0, s) + before + selected + closing + text.substring(e);
      selStart = selEnd = s + before.length + selected.length + closing.length;
    } else {
      const placeholder = 'text';
      newText = text.substring(0, s) + before + placeholder + closing + text.substring(e);
      selStart = s + before.length;
      selEnd = selStart + placeholder.length; // select placeholder for easy replacement
    }
  };

  const prefixLine = (prefix) => {
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    selStart = selEnd = s + prefix.length;
  };

  switch (type) {
    case 'bold': wrapWith('**'); break;
    case 'italic': wrapWith('*'); break;
    case 'strike': wrapWith('~~'); break;
    case 'code': wrapWith('`'); break;
    case 'h1': prefixLine('# '); break;
    case 'h2': prefixLine('## '); break;
    case 'h3': prefixLine('### '); break;
    case 'bullet': prefixLine('- '); break;
    case 'ordered': prefixLine('1. '); break;
    case 'task': prefixLine('- [ ] '); break;
    case 'quote': prefixLine('> '); break;
    case 'codeBlock': wrapWith('```\n', '\n```'); break;
    case 'hr':
      newText = text.substring(0, s) + '\n---\n' + text.substring(e);
      selStart = selEnd = s + 5;
      break;
    case 'link':
      if (selected) {
        newText = text.substring(0, s) + '[' + selected + '](url)' + text.substring(e);
        selStart = s + selected.length + 3;
        selEnd = selStart + 3; // select "url" placeholder
      } else {
        newText = text.substring(0, s) + '[text](url)' + text.substring(e);
        selStart = s + 1;
        selEnd = selStart + 4; // select "text" placeholder
      }
      break;
    default: return;
  }

  setValue(newText);
  requestAnimationFrame(() => {
    textareaEl.focus();
    textareaEl.setSelectionRange(selStart, selEnd);
  });
};

const MD_TOOLBAR_BUTTONS = [
  { type: 'bold', icon: MD_ICONS.bold, title: 'Bold' },
  { type: 'italic', icon: MD_ICONS.italic, title: 'Italic' },
  { type: 'strike', icon: MD_ICONS.strike, title: 'Strikethrough' },
  { type: 'code', icon: MD_ICONS.code, title: 'Inline Code' },
  'divider',
  { type: 'h1', icon: MD_ICONS.h1, title: 'Heading 1' },
  { type: 'h2', icon: MD_ICONS.h2, title: 'Heading 2' },
  { type: 'h3', icon: MD_ICONS.h3, title: 'Heading 3' },
  'divider',
  { type: 'bullet', icon: MD_ICONS.bulletList, title: 'Bullet List' },
  { type: 'ordered', icon: MD_ICONS.orderedList, title: 'Ordered List' },
  { type: 'task', icon: MD_ICONS.taskList, title: 'Task List' },
  'divider',
  { type: 'quote', icon: MD_ICONS.quote, title: 'Blockquote' },
  { type: 'codeBlock', icon: MD_ICONS.codeBlock, title: 'Code Block' },
  { type: 'hr', icon: MD_ICONS.hr, title: 'Horizontal Rule' },
  { type: 'link', icon: MD_ICONS.link, title: 'Link' },
];

const mdTabStyle = (active) => ({
  padding: '4px 12px',
  fontSize: '13px',
  fontWeight: active ? 600 : 400,
  color: active ? '#1d4ed8' : '#6b7280',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'color 0.15s',
});

const MarkdownEditor = ({ textareaRef, value, onValueChange, rows, placeholder }) => {
  const [preview, setPreview] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
      {/* Tab bar + toolbar row */}
      <div style={{ backgroundColor: '#f9fafb' }}>
        {/* Edit / Preview tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid #e5e7eb' }}>
          <button type="button" style={mdTabStyle(!preview)} onClick={() => setPreview(false)}>Edit</button>
          <button type="button" style={mdTabStyle(preview)} onClick={() => setPreview(true)}>Preview</button>
        </div>
        {/* Toolbar — only in edit mode */}
        {!preview && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '6px 8px',
            flexWrap: 'wrap',
            borderBottom: '1px solid #e5e7eb',
          }}>
            {MD_TOOLBAR_BUTTONS.map((btn, i) =>
              btn === 'divider' ? (
                <div key={`d${i}`} style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db', margin: '0 4px', flexShrink: 0 }} />
              ) : (
                <button
                  type="button"
                  key={btn.type}
                  tabIndex={-1}
                  title={btn.title}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMarkdown(textareaRef.current, btn.type, value, onValueChange);
                  }}
                  style={mdToolbarBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {btn.icon}
                </button>
              )
            )}
          </div>
        )}
      </div>
      {/* Content area */}
      {preview ? (
        <div className="px-4 py-2.5 prose prose-sm max-w-none text-gray-700" style={{ minHeight: `${(rows || 4) * 1.5 + 1.25}rem` }}>
          {value ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="text-gray-400 italic">Nothing to preview</p>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          rows={rows || 4}
          className="w-full px-4 py-2.5 resize-none outline-none"
          placeholder={placeholder || 'Add more details...'}
        />
      )}
    </div>
  );
};

// Task Modal Component for Create/Edit
const TaskModal = ({ isOpen, onClose, task, onSave, isLoading, onSummaryGenerated }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(null); // null | 'generate' | 'steps' | 'refine' | 'concise' | 'smart'
  const [aiError, setAiError] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false); // true after first successful generation
  const notesTextareaRef = useRef(null);

  // AI Summary via shared hook
  const { bullets, bulletsLoading, bulletsError, fetchBullets } = useBullets({
    taskId: task?.id || null,
    aiSummary: task?.ai_summary,
    describeFn: todos.describe,
    userId: user?.id,
    onSummaryGenerated,
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.status || 'todo',
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        category: task.category || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        due_date: '',
        category: '',
      });
    }
    setAiInput('');
    setAiGenerating(null);
    setAiError('');
    setAiGenerated(false);
  }, [task, isOpen]);

  // Keep formData.description in sync with AI summary — prevents saving stale
  // description that would overwrite the backend's AI-synced value
  useEffect(() => {
    if (bullets?.length > 0) {
      setFormData(prev => ({ ...prev, description: bullets.map(b => `• ${b}`).join('\n') }));
    }
  }, [bullets]);

  const handleAiAction = async (actionType = 'generate') => {
    if (aiGenerating) return;

    let prompt;
    let fieldsToUpdate;

    switch (actionType) {
      case 'generate':
        if (!aiInput.trim()) return;
        prompt = aiInput.trim();
        fieldsToUpdate = ['title', 'description', 'priority', 'due_date', 'category'];
        break;
      case 'steps':
        prompt = `Break this task into detailed actionable steps with numbered sub-tasks:\nTitle: ${formData.title}\nCurrent description: ${formData.description}\nKeep the same title. Expand description with clear numbered steps.`;
        fieldsToUpdate = ['description'];
        break;
      case 'refine':
        prompt = `Improve and polish this task to be more specific, professional, and actionable:\nTitle: ${formData.title}\nDescription: ${formData.description}\nRefine both title and description.`;
        fieldsToUpdate = ['title', 'description'];
        break;
      case 'concise':
        prompt = `Simplify this task. Make the title shorter (max 6 words) and description more concise (max 2 bullet points):\nTitle: ${formData.title}\nDescription: ${formData.description}`;
        fieldsToUpdate = ['title', 'description'];
        break;
      case 'smart':
        prompt = `Analyze this task and suggest the optimal priority, due date, and category. Be smart about urgency based on keywords. Suggest a realistic due date within the next 2 weeks if applicable:\nTitle: ${formData.title}\nDescription: ${formData.description}`;
        fieldsToUpdate = ['priority', 'due_date', 'category'];
        break;
      default:
        return;
    }

    setAiGenerating(actionType);
    setAiError('');

    try {
      await todos.generateFromAI(
        prompt,
        formData.status || 'todo',
        (content) => {
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            setFormData(prev => {
              const updated = { ...prev };
              fieldsToUpdate.forEach(field => {
                if (parsed[field] != null) updated[field] = parsed[field];
              });
              return updated;
            });
            setAiGenerated(true);
          } catch (parseErr) {
            setAiError('Failed to parse AI response');
          }
          setAiGenerating(null);
        },
        (err) => {
          setAiError(err || 'AI generation failed');
          setAiGenerating(null);
        }
      );
    } catch (err) {
      setAiError(err.message || 'AI generation failed');
      setAiGenerating(null);
    }
  };

  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    setSaveError('');
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      const detail = error?.response?.data?.detail;
      console.error('Save task error detail:', JSON.stringify(detail));
      if (typeof detail === 'string') {
        setSaveError(detail);
      } else if (Array.isArray(detail)) {
        setSaveError(detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join('; '));
      } else {
        setSaveError(error?.message || 'Failed to save task');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isCreateMode = !task?.id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col ${isCreateMode ? 'max-w-4xl max-h-[90vh]' : 'max-w-lg max-h-[90vh]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isCreateMode ? 'Create Task' : 'Edit Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body: 2-panel in create mode, single-panel in edit mode */}
        <div className={`flex-1 flex min-h-0 ${!isCreateMode ? 'overflow-y-auto' : ''}`}>
          {/* Left Panel — Task Form */}
          <div className={`flex flex-col ${isCreateMode ? 'flex-1 border-r border-gray-200 min-w-0' : 'w-full'}`}>
            <form onSubmit={handleSubmit} className={`flex flex-col ${isCreateMode ? 'flex-1 min-h-0' : ''}`}>
              <div className={`${isCreateMode ? 'overflow-y-auto' : ''} p-5 space-y-4`}>
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="What needs to be done?"
                    autoFocus
                  />
                </div>

                {/* AI Summary (existing tasks only) */}
                {task?.id && (
                  <AISummarySection
                    taskId={task.id}
                    bullets={bullets}
                    loading={bulletsLoading}
                    error={bulletsError}
                    fetchBullets={fetchBullets}
                    inForm
                  />
                )}

                {/* Notes */}
                {(!task?.id || (!bullets?.length && !bulletsLoading)) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes
                    </label>
                    <MarkdownEditor
                      textareaRef={notesTextareaRef}
                      value={formData.description}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, description: v }))}
                      rows={isCreateMode ? 5 : 3}
                    />
                  </div>
                )}

                {/* AI Priority Reasoning (shown when task has been AI-prioritized) */}
                {task?.ai_priority_reasoning && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl">
                    <LightBulbIcon className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-violet-700 leading-relaxed">{task.ai_priority_reasoning}</p>
                  </div>
                )}

                {/* Priority & Status Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="none">No Status</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                      <option value="delayed">Delayed</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Category Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                    <DatePicker
                      selected={formData.due_date ? new Date(formData.due_date + 'T00:00:00') : null}
                      onChange={(date) => setFormData(prev => ({ ...prev, due_date: date ? formatDate(date) : '' }))}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Select date"
                      isClearable
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      calendarClassName="extraction-datepicker"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Work, Personal"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 rounded-bl-2xl">
                {saveError && (
                  <div className="px-5 pt-2">
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{saveError}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.title.trim()}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    {isCreateMode ? 'Create Task' : 'Update Task'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Panel — AI Assistant (create mode only) */}
          {isCreateMode && (
            <div className="w-[340px] flex flex-col bg-gray-50 flex-shrink-0 h-full">
              {/* AI Panel Header — matching email AI panel exactly */}
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">AI Assistant</span>
                </div>
                {aiGenerated && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircleIcon className="w-3 h-3" />
                    Applied
                  </span>
                )}
              </div>

              {/* AI Panel Content — fills remaining height, flex-col for textarea growth */}
              <div className="flex-1 min-h-0 p-5 flex flex-col">
                {/* Top section — input and generate */}
                <div className="mb-3">
                  {/* Custom Instructions label — matching email panel */}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Describe your task</label>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-medium">⌘ Enter</span>
                  </div>

                  {/* Textarea */}
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAiAction('generate');
                      }
                    }}
                    rows={13}
                    className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm shadow-sm placeholder-gray-400 mb-3"
                    placeholder="Describe what you need to do..."
                    disabled={!!aiGenerating}
                  />

                  {/* Error Display */}
                  {aiError && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg mb-3">
                      <ExclamationCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600">{aiError}</p>
                    </div>
                  )}

                  {/* Generate Button — matching "Generate Draft" exactly */}
                  <button
                    type="button"
                    onClick={() => handleAiAction('generate')}
                    disabled={!!aiGenerating || !aiInput.trim()}
                    className="w-full py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98]"
                  >
                    {aiGenerating === 'generate' ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <PencilSquareIcon className="w-4 h-4" />
                        <span>Generate Task</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bottom section — 4 action buttons, fixed at bottom */}
                <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                  {/* Steps — indigo (matches Explain More) */}
                  <button
                    type="button"
                    onClick={() => handleAiAction('steps')}
                    disabled={!!aiGenerating || !formData.title.trim()}
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating === 'steps' ? (
                      <ArrowPathIcon className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : (
                      <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-indigo-600" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Add Steps</span>
                  </button>

                  {/* Refine — green (matches Polish) */}
                  <button
                    type="button"
                    onClick={() => handleAiAction('refine')}
                    disabled={!!aiGenerating || !formData.title.trim()}
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50/50 hover:shadow-sm transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating === 'refine' ? (
                      <ArrowPathIcon className="w-5 h-5 text-green-600 animate-spin" />
                    ) : (
                      <SparklesIcon className="w-5 h-5 text-green-600" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Refine</span>
                  </button>

                  {/* Concise — purple (matches Make Concise) */}
                  <button
                    type="button"
                    onClick={() => handleAiAction('concise')}
                    disabled={!!aiGenerating || !formData.title.trim()}
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-sm transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating === 'concise' ? (
                      <ArrowPathIcon className="w-5 h-5 text-purple-600 animate-spin" />
                    ) : (
                      <ScissorsIcon className="w-5 h-5 text-purple-600" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Make Concise</span>
                  </button>

                  {/* Smart Fill — amber (matches Fix Spelling) */}
                  <button
                    type="button"
                    onClick={() => handleAiAction('smart')}
                    disabled={!!aiGenerating || !formData.title.trim()}
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-sm transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating === 'smart' ? (
                      <ArrowPathIcon className="w-5 h-5 text-amber-600 animate-spin" />
                    ) : (
                      <LightBulbIcon className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Smart Fill</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// DOM-based HTML sanitizer: whitelist-only tags and attributes (no regex edge cases)
const ALLOWED_TAGS = new Set(['B','I','EM','STRONG','U','BR','P','UL','OL','LI','A','SPAN','DIV','BLOCKQUOTE','H1','H2','H3','H4','H5','H6']);
const SAFE_URI_RE = /^(?:https?|mailto):/i;
const sanitizeDescriptionHtml = (html) => {
  if (!html) return '';
  // Check if content has any HTML tags at all — if plain text, escape & return
  if (!/[<&]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (parent) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 3) continue; // text nodes are safe
      if (node.nodeType !== 1) { node.remove(); continue; } // remove comments, etc.
      // Depth-first: clean children BEFORE unwrapping, so promoted children are already safe
      clean(node);
      if (!ALLOWED_TAGS.has(node.tagName)) {
        // Unwrap: keep (already-cleaned) children, drop the tag
        node.replaceWith(...node.childNodes);
        continue;
      }
      // Strip all attributes except href on <a>
      for (const attr of [...node.attributes]) {
        if (node.tagName === 'A' && attr.name === 'href') {
          if (!SAFE_URI_RE.test(attr.value.trim())) {
            node.removeAttribute('href');
          }
        } else {
          node.removeAttribute(attr.name);
        }
      }
      // Force links to open safely in new tab
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
};

// Task Detail Panel (Jira-style centered modal with tabs)
const DETAIL_ITEMS_PER_PAGE = 10;
const TaskDetailPanel = ({ task, onClose, onUpdate, onDelete, onSummaryGenerated }) => {
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

const TasksView = ({ activeSubTab = 'backlog' }) => {
  const { user } = useAuth();
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

  // Connected accounts state for extraction settings
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  // Task data state — shared with ScheduleView via context
  const { tasks, setTasks, refreshTasks: sharedRefreshTasks } = useContext(SharedTasksContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extracted tasks state (from email/calendar)
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractionSummary, setExtractionSummary] = useState(null);
  const [accountsMissingTasksScope, setAccountsMissingTasksScope] = useState([]);
  const [lastExtractionTime, setLastExtractionTime] = useState(null);
  const [showExtractionSettings, setShowExtractionSettings] = useState(false);
  const [selectedTriageTask, setSelectedTriageTask] = useState(null);
  const [triageActionLoading, setTriageActionLoading] = useState(false);

  // Triage email prefetch cache — pre-loads original emails on hover over triage rows
  const triageEmailCacheRef = useRef(new Map());
  const triageEmailInFlightRef = useRef(new Set());
  const triageActionInFlightRef = useRef(new Set()); // Dedup guard for add/dismiss

  // Close triage detail panel on Escape key
  useEffect(() => {
    if (!selectedTriageTask) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setSelectedTriageTask(null); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedTriageTask]);

  // AI Prioritization state
  const [showPrioritizeModal, setShowPrioritizeModal] = useState(false);
  const [selectedUnprioritized, setSelectedUnprioritized] = useState([]); // Selected tasks to prioritize
  const [isPrioritizing, setIsPrioritizing] = useState(false); // Loading state for AI prioritization

  // Pagination state for extracted tasks
  const [extractedTasksPage, setExtractedTasksPage] = useState(1);
  const [extractedTasksTotal, setExtractedTasksTotal] = useState(0);
  const [extractedTasksPendingCount, setExtractedTasksPendingCount] = useState(0);
  const [extractedTasksTotalPages, setExtractedTasksTotalPages] = useState(1);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const EXTRACTED_TASKS_PAGE_SIZE = 10;
  const extractionInProgress = useRef(false); // Ref for deduplication
  const extractionSettingsRef = useRef(null); // Always-latest settings (avoids stale closures)
  const settingsChangedSinceExtraction = useRef(false); // Track if user changed settings since last extraction
  const pagesCache = useRef(new Map()); // Cache for paginated data

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

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Drag and drop state
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [dragOverCardId, setDragOverCardId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null); // 'before' | 'after'

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

  // fetchTasks wraps shared refresh with local loading/error state
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await sharedRefreshTasks();
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [sharedRefreshTasks]);

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

  // Clear page cache (call after add/dismiss/extract operations)
  const clearPagesCache = () => {
    pagesCache.current.clear();
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

  // Handle page change for extracted tasks
  const handleExtractedTasksPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= extractedTasksTotalPages && newPage !== extractedTasksPage) {
      // Optimistic update - change page number immediately
      setExtractedTasksPage(newPage);
      loadExtractedTasks(newPage);
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

  // Add extracted task to saved tasks (converts to permanent task via API)
  const handleAddExtractedTask = async (extractedTask) => {
    if (triageActionInFlightRef.current.has(extractedTask.id)) return; // Dedup rapid clicks
    triageActionInFlightRef.current.add(extractedTask.id);
    try {
      setTriageActionLoading(true);
      // Use API to add task (converts in backend)
      const result = await taskExtraction.addToTodos(extractedTask.id, user?.id || 1);

      if (result.success) {
        // Update the task in extractedTasks locally — mark as "added" for immediate visual feedback
        setExtractedTasks(prev => prev.map(t =>
          t.id === extractedTask.id
            ? { ...t, status: 'added', added_todo_id: result.todo_id }
            : t
        ));
        // Update the selected triage task if it's the one we just added
        setSelectedTriageTask(prev =>
          prev?.id === extractedTask.id
            ? { ...prev, status: 'added', added_todo_id: result.todo_id }
            : prev
        );

        // Only update tasks list and counts if this was a new add (not a duplicate)
        if (!result.already_added) {
          setExtractedTasksPendingCount(prev => Math.max(0, prev - 1));
          if (result.todo) {
            setTasks(prev => [result.todo, ...prev]);
          } else {
            fetchTasks();
          }
        }
        // Clear cache so next page load gets fresh data
        clearPagesCache();
      }
    } catch (err) {
      console.error('Error adding extracted task:', err);
    } finally {
      triageActionInFlightRef.current.delete(extractedTask.id);
      setTriageActionLoading(false);
    }
  };

  // Revert an added extracted task: delete Todo, restore to Triage as pending.
  // Called from both Triage side (knows extractedTaskId) and Backlog side (only knows todoId).
  const handleRevertExtractedTask = async (todoId, extractedTaskId = null) => {
    const dedupKey = `revert-${todoId}`;
    if (triageActionInFlightRef.current.has(dedupKey)) return; // Dedup rapid clicks
    triageActionInFlightRef.current.add(dedupKey);
    try {
      setTriageActionLoading(true);
      const result = await taskExtraction.revert(todoId, user?.id || 1);
      if (result.success) {
        const resolvedId = extractedTaskId || result.extracted_task_id;
        // Restore the extracted task to pending locally
        const revertFields = { status: 'pending', added_todo_id: null };
        setExtractedTasks(prev => prev.map(t =>
          t.id === resolvedId ? { ...t, ...revertFields } : t
        ));
        setSelectedTriageTask(prev =>
          prev?.id === resolvedId ? { ...prev, ...revertFields } : prev
        );
        setExtractedTasksPendingCount(prev => prev + 1);
        // Remove the todo from tasks list
        setTasks(prev => prev.filter(t => t.id !== todoId));
        if (selectedTask?.id === todoId) setSelectedTask(null);
        clearPagesCache();
      }
    } catch (err) {
      console.error('Error reverting extracted task:', err);
    } finally {
      triageActionInFlightRef.current.delete(dedupKey);
      setTriageActionLoading(false);
    }
  };

  // Dismiss extracted task (marks as dismissed in DB)
  const handleDismissExtractedTask = async (taskId) => {
    if (triageActionInFlightRef.current.has(taskId)) return; // Dedup rapid clicks
    triageActionInFlightRef.current.add(taskId);
    try {
      setTriageActionLoading(true);
      // Clear selection since this task is being removed from triage
      setSelectedTriageTask(prev => prev?.id === taskId ? null : prev);
      await taskExtraction.dismiss(taskId, user?.id || 1);
      // Clear cache and reload — auto-navigate to previous page if current page would be empty
      clearPagesCache();
      const isLastItemOnPage = extractedTasks.filter(t => t.status === 'pending' && t.id !== taskId).length === 0;
      const targetPage = (isLastItemOnPage && extractedTasksPage > 1) ? extractedTasksPage - 1 : extractedTasksPage;
      await loadExtractedTasks(targetPage, { skipCache: true });
    } catch (err) {
      console.error('Error dismissing task:', err);
    } finally {
      triageActionInFlightRef.current.delete(taskId);
      setTriageActionLoading(false);
    }
  };

  // Prefetch original email on hover over triage row — eliminates loading delay on click
  const handleTriagePrefetch = useCallback((task) => {
    if (!task || !user?.id || !connectedAccounts?.length) return;
    if ((task.source_type || task.source) !== 'email') return;
    if (!task.source_id || !task.source_account) return;

    const cacheKey = task.source_id;
    if (triageEmailCacheRef.current.has(cacheKey)) return;
    if (triageEmailInFlightRef.current.has(cacheKey)) return;

    const account = connectedAccounts.find(a => a.email === task.source_account);
    if (!account?.id) return;

    triageEmailInFlightRef.current.add(cacheKey);
    gmail.getMessage(task.source_id, account.id, user.id)
      .then(message => { if (message) triageEmailCacheRef.current.set(cacheKey, message); })
      .catch(() => {}) // Silently ignore prefetch errors
      .finally(() => triageEmailInFlightRef.current.delete(cacheKey));
  }, [user?.id, connectedAccounts]);

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

  // Patch ai_summary into React state after generation — eliminates redundant API calls.
  // IMPORTANT: Only update `tasks` array (source of truth). Do NOT update `selectedTask`
  // or `editingTask` — that would change the task prop reference, triggering child
  // useEffects that reset local form state (formData, editedTask, isEditing).
  // The useBullets hook already has the bullets in its own local state, so the child
  // components don't need a prop update to display them. Next time the user opens the
  // same task, it will be read from the updated `tasks` array with ai_summary cached.
  const handleTaskSummaryGenerated = useCallback((taskId, bullets) => {
    const desc = bullets.map(b => `• ${b}`).join('\n');
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ai_summary: bullets, description: desc } : t
    ));
  }, []);

  // Same for triage tasks (memoized to prevent useBullets useEffect re-triggers)
  const handleTriageSummaryGenerated = useCallback((taskId, bullets) => {
    setExtractedTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ai_summary: bullets } : t
    ));
    setSelectedTriageTask(prev =>
      prev?.id === taskId ? { ...prev, ai_summary: bullets } : prev
    );
  }, []);

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

  // Task Card Component - Jira Style
  const TaskCard = ({ task, isDragging = false }) => {
    const isSelected = selectedTasks.includes(task.id);
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    const isExtracted = task.isExtracted;
    const isGoogleTask = task.source === 'gtask';
    const isAIExtracted = isExtracted && !isGoogleTask;

    // Priority left-border colors — aligned with Backlog priority colors
    const priorityBorder = {
      urgent: 'border-l-red-500',
      high: 'border-l-orange-500',
      medium: 'border-l-amber-400',
      low: 'border-l-green-500',
      none: 'border-l-gray-300',
    }[task.priority] || 'border-l-gray-300';

    const priorityIcon = {
      urgent: <ExclamationCircleIcon className="w-4 h-4 text-red-500" />,
      high: <ChevronUpIcon className="w-4 h-4 text-orange-500" />,
      medium: <span className="w-4 h-4 flex items-center justify-center text-amber-500 font-bold text-xs">=</span>,
      low: <ChevronDownIcon className="w-4 h-4 text-green-500" />,
    }[task.priority] || null;

    const priorityLabel = {
      urgent: { text: 'text-red-700', bg: 'bg-red-50/15', label: 'Urgent' },
      high: { text: 'text-orange-700', bg: 'bg-orange-50/15', label: 'High' },
      medium: { text: 'text-amber-700', bg: 'bg-amber-50/15', label: 'Medium' },
      low: { text: 'text-green-700', bg: 'bg-green-50/15', label: 'Low' },
    }[task.priority] || null;

    const taskKey = isGoogleTask
      ? `GT-${String(task.id).slice(-4)}`
      : isAIExtracted
        ? `AI-${String(task.id).slice(-4)}`
        : `TASK-${task.id}`;

    const showDropBefore = dragOverCardId === task.id && dragOverPosition === 'before';
    const showDropAfter = dragOverCardId === task.id && dragOverPosition === 'after';

    return (
      <div
        onDragOver={(e) => handleCardDragOver(e, task)}
        onDragLeave={handleCardDragLeave}
      >
        {/* Drop indicator — before */}
        {showDropBefore && (
          <div className="h-0.5 bg-blue-500 rounded-full mx-1 mb-1 shadow-sm shadow-blue-300" />
        )}
        <div
          draggable={!isExtracted}
          onDragStart={(e) => {
            if (isExtracted || e.target.closest('button')) {
              e.preventDefault();
              return;
            }
            handleDragStart(e, task);
          }}
          onDragEnd={handleDragEnd}
          onClick={() => !isExtracted && setSelectedTask(task)}
          className={`group bg-white rounded-lg border border-l-[3px] ${priorityBorder} shadow-sm hover:shadow-md transition-all select-none ${
            isGoogleTask
              ? 'border-t-green-200 border-r-green-200 border-b-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/50'
              : isAIExtracted
                ? 'border-t-purple-200 border-r-purple-200 border-b-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/50'
                : isSelected
                  ? 'border-t-blue-500 border-r-blue-500 border-b-blue-500 ring-1 ring-blue-500'
                  : 'border-t-gray-200 border-r-gray-200 border-b-gray-200 hover:border-t-gray-300 hover:border-r-gray-300 hover:border-b-gray-300'
          } ${isDragging ? 'opacity-60 rotate-1 shadow-xl' : isExtracted ? 'cursor-default' : 'cursor-pointer'}`}
        >
        {/* Card Content */}
        <div className="p-3">
          {/* Top Row: Task Key + Priority */}
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-mono font-medium ${
              isGoogleTask ? 'text-green-600' : isAIExtracted ? 'text-purple-600' : 'text-blue-600'
            } hover:underline`}>
              {taskKey}
            </span>
            <div className="flex items-center gap-1">
              {isGoogleTask && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300">
                  <CheckCircleIcon className="w-3 h-3" />
                  Tasks
                </span>
              )}
              {isAIExtracted && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300">
                  <SparklesIcon className="w-3 h-3" />
                  AI
                </span>
              )}
              {task.scheduled_start && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300">
                  <CalendarIcon className="w-3 h-3" />
                  Scheduled
                </span>
              )}
              {priorityLabel ? (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityLabel.bg} ${priorityLabel.text}`}>
                  {priorityIcon}
                  {priorityLabel.label}
                </span>
              ) : priorityIcon}
            </div>
          </div>

          {/* Title */}
          <h3 className={`text-sm font-medium text-slate-400 mb-2 line-clamp-2 ${task.status === 'done' ? 'line-through text-slate-500' : ''}`}>
            {task.title}
          </h3>

          {/* Source info for extracted tasks */}
          {isExtracted && (
            <div className="text-xs text-slate-400 mb-2 space-y-0.5">
              {task.source_subject && (
                <p className="flex items-center gap-1 line-clamp-1">
                  {task.source === 'email' ? <EnvelopeIcon className="w-3 h-3 flex-shrink-0" /> :
                   task.source === 'gtask' ? <CheckCircleIcon className="w-3 h-3 flex-shrink-0" /> :
                   <CalendarIcon className="w-3 h-3 flex-shrink-0" />}
                  <span className="truncate">{task.source_subject}</span>
                </p>
              )}
              {(task.source_account || task.source_date) && (
                <p className="flex items-center gap-2 text-slate-400 text-[10px]">
                  {task.source_account && (
                    <span className="truncate max-w-[120px]" title={task.source_account}>
                      {task.source_account}
                    </span>
                  )}
                  {task.source_date && (
                    <span className="flex-shrink-0">
                      {new Date(task.source_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Scheduled Time Slot */}
          {task.scheduled_start && (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-sky-950">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-200 flex-shrink-0" />
              <span className="text-[11px] text-slate-300 font-medium">
                {new Date(task.scheduled_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {', '}
                {new Date(task.scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                {task.scheduled_end && (
                  <> – {new Date(task.scheduled_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                )}
              </span>
            </div>
          )}

          {/* Bottom Row: Labels + Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Category Tag */}
              {task.category && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-950 text-slate-300">
                  {task.category}
                </span>
              )}
              {/* Due Date */}
              {task.due_date && (
                <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue && !isExtracted ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                  <ClockIcon className="w-3 h-3" />
                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            {/* Actions - Show on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isExtracted ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddExtractedTask(task); }}
                    className="p-1 text-slate-300 hover:bg-white/10 hover:text-blue-600 rounded transition-colors"
                    title="Add to Backlog"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismissExtractedTask(task.id); }}
                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-white/10 rounded transition-colors"
                    title="Dismiss"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
                    className={`p-1 rounded transition-colors ${task.status === 'done' ? 'text-slate-200' : 'text-slate-300 hover:text-blue-600'}`}
                    title={task.status === 'done' ? 'Reopen' : 'Done'}
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); setShowTaskModal(true); }}
                    className="p-1 text-slate-300 hover:text-blue-600 rounded transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
        {/* Drop indicator — after */}
        {showDropAfter && (
          <div className="h-0.5 bg-blue-500 rounded-full mx-1 mt-1 shadow-sm shadow-blue-300" />
        )}
      </div>
    );
  };

  // Kanban Column Component - Jira Style
  const KanbanColumn = ({ column, columnTasks }) => {
    const columnColors = {
      none: { bg: 'bg-white/10', header: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-300' },
      backlog: { bg: 'bg-white/10', header: 'bg-pink-100', border: 'border-slate-200', text: 'text-slate-300' },
      todo: { bg: 'bg-white/10', header: 'bg-blue-100', border: 'border-slate-200', text: 'text-slate-300'},
      in_progress: { bg: 'bg-white/10', header: 'bg-amber-100', border: 'border-slate-200', text: 'text-slate-300'},
      review: { bg: 'bg-white/10', header: 'bg-purple-100', border: 'border-slate-200', text: 'text-slate-300'},
      done: { bg: 'bg-white/10', header: 'bg-green-100', border: 'border-slate-200', text: 'text-slate-300'},
      delayed: { bg: 'bg-white/10', header: 'bg-gray-100', border: 'border-slate-200', text: 'text-slate-300'},
    };

    const colors = columnColors[column.id];
    const isDropTarget = dragOverColumn === column.id;

    return (
      <div
        className="w-[280px] flex-shrink-0 flex flex-col h-full bg-sky-950/95 rounded-lg "
        onDragEnter={(e) => handleDragEnter(e, column.id)}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        {/* Column Header - Jira Style */}
        <div className={`flex-shrink-0 flex items-center justify-between px-3 py-2.5 ${colors.header} rounded-t-lg border-b ${colors.border}`}>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold uppercase tracking-wide ${colors.text}`}>{column.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors.text} bg-white/60`}>
              {columnTasks.length}
            </span>
          </div>
          <button
            onClick={() => {
              setEditingTask({ status: column.id });
              setShowTaskModal(true);
            }}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title={`Add task to ${column.name}`}
          >
            <PlusIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tasks - Scrollable Drop Zone */}
        <div className={`flex-1 overflow-y-auto p-2 space-y-2 transition-all duration-150 ${
          isDropTarget && !dragOverCardId
            ? 'bg-blue-100/50 ring-2 ring-inset ring-blue-400'
            : ''
        }`}>
          {columnTasks.map(task => (
            <TaskCard
              key={task.isExtracted ? `extracted-${task.id}` : `task-${task.id}`}
              task={task}
              isDragging={draggedTask?.id === task.id}
            />
          ))}
          {columnTasks.length === 0 && (
            <div className={`p-4 border-2 border-dashed rounded-lg text-center text-xs transition-colors ${
              isDropTarget
                ? 'border-blue-400 text-blue-500 bg-blue-100/50'
                : 'border-gray-300 text-gray-400'
            }`}>
              {isDropTarget ? 'Drop here' : 'No tasks'}
            </div>
          )}
        </div>
      </div>
    );
  };



  // Jira-style status groups for backlog (colors match KANBAN_COLUMNS)
  const STATUS_GROUPS = [
    { id: 'none', label: 'No Status', color: 'gray', icon: InboxIcon },
    { id: 'todo', label: 'To Do', color: 'blue', icon: ClipboardDocumentListIcon },
    { id: 'in_progress', label: 'In Progress', color: 'yellow', icon: ClockIcon },
    { id: 'review', label: 'Review', color: 'purple', icon: EyeIcon },
    { id: 'done', label: 'Done', color: 'green', icon: CheckCircleIcon },
    { id: 'cancelled', label: 'Cancelled', color: 'red', icon: ClockIcon },
  ];

  // Get tasks grouped by status for Jira-style backlog
  const getGroupedTasks = (groupId) => {
    return filteredTasks.filter(t => t.status === groupId);
  };

  // Get prioritized tasks grouped by priority (Plane-style)
  const getTasksByPriority = (priorityId) => {
    return prioritizedTasks.filter(t => {
      const taskPriority = t.priority || 'none';
      return taskPriority === priorityId || (priorityId === 'none' && !t.priority);
    });
  };

  // Filter extracted tasks for Triage view
  const filteredExtractedTasks = extractedTasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Format date as mm/dd/yyyy
  const formatTriageDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Get source icon and color for Triage items
  const getSourceConfig = (sourceType) => {
    const configs = {
      email: { icon: EnvelopeIcon, color: 'text-slate-300', bg: 'bg-white/10', label: 'Email' },
      calendar: { icon: CalendarIcon, color: 'text-slate-300', bg: 'bg-white/10', label: 'Calendar' },
      gtask: { icon: CheckCircleIcon, color: 'text-slate-300', bg: 'bg-white/10', label: 'Google Tasks' },
      jira: { icon: TicketIcon, color: 'text-slate-300', bg: 'bg-white/10', label: 'Jira' },
      slack: { icon: ChatBubbleLeftRightIcon, color: 'text-slate-300', bg: 'bg-white/10', label: 'Slack' },
    };
    return configs[sourceType] || configs.email;
  };

  // Triage Row Component - clean, minimal design
  const TriageRow = ({ task, isSelected, onClick, onMouseEnter }) => {
    const sourceConfig = getSourceConfig(task.source_type || task.source);
    const SourceIcon = sourceConfig.icon;
    const displayDate = formatTriageDate(task.source_date || task.extracted_at);
    const isAdded = task.status === 'added';

    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
          isSelected
            ? `bg-purple-50 border-l-2 border-l-purple-500${isAdded ? ' opacity-70' : ''}`
            : isAdded ? 'bg-green-50/40 opacity-60' : 'hover:bg-white/10'
        }`}
      >
        {/* Date */}
        <span className={`text-xs font-medium w-20 flex-shrink-0 ${isAdded ? 'text-slate-200' : 'text-slate-300'}`}>
          {displayDate}
        </span>

        {/* Source Badge */}
        <div className="w-24 flex-shrink-0">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${sourceConfig.bg}`}>
            <SourceIcon className={`w-3.5 h-3.5 ${sourceConfig.color}`} />
            <span className={`text-xs font-medium ${sourceConfig.color}`}>{sourceConfig.label}</span>
          </div>
        </div>

        {/* Account */}
        <span className={`text-xs truncate w-32 flex-shrink-0 ${isAdded ? 'text-slate-300' : 'text-slate-400'}`} title={task.source_account}>
          {task.source_account || '-'}
        </span>

        {/* Task Summary + Status Badge */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`text-sm truncate ${isAdded ? 'text-slate-200' : 'text-slate-400'}`} title={task.title}>
            {task.title}
          </span>
          {isAdded && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-600 flex-shrink-0">
              <CheckCircleIcon className="w-3 h-3" />
              Added
            </span>
          )}
        </div>

        {/* Actions — always visible, consistent style */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isAdded ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleRevertExtractedTask(task.added_todo_id, task.id); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-600 bg-white/10 hover:bg-amber-100 border  rounded-md transition-colors"
              title="Undo — return to pending"
            >
              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
              Undo
            </button>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddExtractedTask(task); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-white/10 hover:bg-green-100  rounded-md transition-colors"
                title="Add to Backlog"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Backlog
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDismissExtractedTask(task.id); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-200  rounded-md transition-colors"
                title="Dismiss"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Jira-style Backlog Row Component
  const BacklogRow = ({ task, isExtracted = false }) => {
    const isGoogleTask = task.source === 'gtask';
    const isAIExtracted = isExtracted && !isGoogleTask;
    const taskKey = isGoogleTask
      ? `GT-${String(task.id).slice(-4)}`
      : isAIExtracted || isExtracted
        ? `AI-${String(task.id).slice(-4)}`
        : `TASK-${task.id}`;

    // Plane-style priority config with Lucide icons
    const priorityConfigs = {
      urgent: { Icon: AlertCircle, color: '#ef4444', bg: 'bg-red-50', label: 'Urgent' },
      high: { Icon: SignalHigh, color: '#f97316', bg: 'bg-orange-50', label: 'High' },
      medium: { Icon: SignalMedium, color: '#eab308', bg: 'bg-amber-50', label: 'Medium' },
      low: { Icon: SignalLow, color: '#22c55e', bg: 'bg-green-50', label: 'Low' },
      none: { Icon: Ban, color: '#6b7280', bg: 'bg-gray-50', label: 'None' },
    };
    const priorityConfig = priorityConfigs[task.priority] || priorityConfigs.medium;

    return (
      <div
        className={`group flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
          isExtracted ? 'bg-gradient-to-r from-purple-50/30 to-transparent' : ''
        }`}
        onClick={() => !isExtracted && setSelectedTask(task)}
      >
        {/* Checkbox */}
        {!isExtracted && (
          <input
            type="checkbox"
            checked={selectedTasks.includes(task.id)}
            onChange={(e) => {
              e.stopPropagation();
              setSelectedTasks(prev =>
                prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
              );
            }}
            className="w-4 h-4 rounded text-slate-400 hover:bg-white/10"
          />
        )}

        {/* Task Key */}
        <span className={`text-xs font-mono font-medium w-20 flex-shrink-0 ${
          isGoogleTask ? 'text-green-600' : isExtracted ? 'text-purple-600' : 'text-blue-600'
        }`}>
          {taskKey}
        </span>

        {/* Type Badge */}
        {isGoogleTask && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-green-700">
            <CheckCircleIcon className="w-3 h-3" />
          </span>
        )}
        {isAIExtracted && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-pink-700">
            <SparklesIcon className="w-3 h-3" />
          </span>
        )}

        {/* Title + Source Info */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-slate-300 truncate font-medium block">
            {task.title}
          </span>
          {isExtracted && (task.source_account || task.source_date) && (
            <div className="flex items-center gap-2 text-[10px] text-slate-300 mt-0.5">
              {task.source === 'email' ? <EnvelopeIcon className="w-3 h-3 flex-shrink-0" /> :
               task.source === 'gtask' ? <CheckCircleIcon className="w-3 h-3 flex-shrink-0" /> :
               <CalendarIcon className="w-3 h-3 flex-shrink-0" />}
              {task.source_account && (
                <span className="truncate max-w-[100px]" title={task.source_account}>
                  {task.source_account}
                </span>
              )}
              {task.source_date && (
                <span className="flex-shrink-0">
                  {new Date(task.source_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status Dropdown (for non-extracted tasks) - syncs with Board columns */}
        {!isExtracted && (
          <select
            value={task.status}
            onChange={(e) => {
              e.stopPropagation();
              handleUpdateTask(task.id, { status: e.target.value }).catch(err =>
                console.error('Failed to update status:', err)
              );
            }}
            className="text-xs px-2 py-1 rounded bg-white/10 text-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="none">No Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}

        {/* Priority - Plane-style Lucide icon */}
        <div
          className={`flex items-center justify-center w-6 h-6 rounded border ${priorityConfig.bg}`}
          title={`Priority: ${priorityConfig.label}`}
        >
          <priorityConfig.Icon size={14} strokeWidth={2} style={{ color: priorityConfig.color }} />
        </div>

        {/* Due Date */}
        {task.due_date && (
          <span className={`text-xs w-20 text-right ${
            new Date(task.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-slate-300'
          }`}>
            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Actions for extracted tasks */}
        {isExtracted && task.status === 'added' ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-green-400">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              Added
            </span>
          </div>
        ) : isExtracted ? (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddExtractedTask(task);
              }}
              className="p-1.5 text-cyan-600 hover:bg-white/10 rounded"
              title="Add to Backlog"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismissExtractedTask(task.id);
              }}
              className="p-1.5 text-slate-400 hover:bg-white/10 rounded"
              title="Dismiss"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="w-[1440px] h-[1024px] relative bg-sky-950 overflow-hidden">
      <div className="w-44 h-0 left-0 top-[25px] absolute outline outline-1 outline-white"></div>
<div className="w-12 h-12 left-[180px] top-0 absolute bg-pink-600" />
<div className="left-[240px] top-[3px] absolute justify-start text-white text-3xl font-bold font-['Space_Mono']">Work</div>

      {/* Triage View - AI Extracted Tasks */}
      {activeSubTab === 'triage' && (
        <>
          {/* Triage Header */}
          <div className="flex-shrink-0 bg-sky-950 rounded-t-xl  p-3">
            <div className="flex items-center justify-between gap-4">
              {/* Title & Description */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <SparklesIcon className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <div className="left-[85px] top-[154px] absolute justify-start text-white text-sm font-semibold font-['Inter']">Incoming</div>
                  <img className="w-6 h-6 left-[50px] top-[150px] absolute" src={inboxIcon} alt="Inbox" />
                  <div className="left-[50px] top-[200px] absolute justify-start text-white text-sm font-normal font-['Inter']">Review and manage AI-discovered tasks from connected sources</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="left-[1080px] top-[190px] absolute justify-start text-white/60 text-sm font-normal font-['Inter']"
                  />
                </div>

                {/* AI Extract Button - Split Button Pattern (Linear/Notion style) */}
                {/* <div className="relative"> */}
                  <div className="inline-flex items-center rounded-lg bg-sky-950 shadow-sm overflow-hidden">
                    {/* Main Extract Button */}
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
              </div>
            </div>
          {/* </div> */}

          {/* Warning: Accounts missing Google Tasks scope */}
          {accountsMissingTasksScope.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Google Tasks not syncing
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {accountsMissingTasksScope.length === 1
                    ? `Account ${accountsMissingTasksScope[0]} needs re-authorization to sync Google Tasks.`
                    : `${accountsMissingTasksScope.length} accounts need re-authorization to sync Google Tasks.`
                  }
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Go to <span className="font-medium">My Account → Applications</span> to disconnect and reconnect your Google account.
                </p>
              </div>
              <button
                onClick={() => setAccountsMissingTasksScope([])}
                className="p-1 hover:bg-amber-100 rounded text-amber-500"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Extraction Summary Toast */}
          {extractionSummary && (
            <div className={`mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3${extractionLoading ? '' : ' animate-fade-in'}`}>
              {extractionLoading ? (
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
              ) : (
                <SparklesIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
              )}
              <span className="text-sm text-purple-700 flex-1">{extractionSummary}</span>
              {!extractionLoading && (
                <button
                  onClick={() => setExtractionSummary(null)}
                  className="p-1 hover:bg-purple-100 rounded text-purple-400"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Triage Split Pane: List + Detail Panel */}
          <div className="flex-1 flex overflow-hidden border border-gray-200 rounded-b-xl bg-white">
            {/* Left: Task List — full width when no task selected */}
            <div className={`${selectedTriageTask ? 'w-[45%] border-r border-gray-200' : 'w-full'} flex flex-col overflow-hidden transition-all`}>
              {loading ? (
                <div className="p-8 text-center flex-1">
                  <ArrowPathIcon className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : filteredExtractedTasks.length > 0 ? (
                <div className="flex flex-col h-full">
                  {/* Header Row */}
                  <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="w-20 flex-shrink-0">Date</span>
                    <span className="w-24 flex-shrink-0">Source</span>
                    <span className="w-32 flex-shrink-0">Account</span>
                    <span className="flex-1">Task</span>
                    <span className="flex-shrink-0 text-right">Actions</span>
                  </div>

                  {/* Task Rows */}
                  <div className="flex-1 overflow-auto">
                    {filteredExtractedTasks.map(task => (
                      <TriageRow
                        key={`triage-${task.id}`}
                        task={task}
                        isSelected={selectedTriageTask?.id === task.id}
                        onClick={() => setSelectedTriageTask(prev => prev?.id === task.id ? null : task)}
                        onMouseEnter={() => handleTriagePrefetch(task)}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      {paginationLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        <>
                          Showing <span className="font-medium text-gray-900">{((extractedTasksPage - 1) * EXTRACTED_TASKS_PAGE_SIZE) + 1}</span> to{' '}
                          <span className="font-medium text-gray-900">{Math.min(extractedTasksPage * EXTRACTED_TASKS_PAGE_SIZE, extractedTasksTotal)}</span> of{' '}
                          <span className="font-medium text-gray-900">{extractedTasksTotal}</span> results
                          {extractedTasksPendingCount < extractedTasksTotal && (
                            <span className="text-gray-400 ml-1">({extractedTasksPendingCount} pending)</span>
                          )}
                        </>
                      )}
                    </div>
                    <nav className="flex items-center gap-1">
                      <button
                        onClick={() => handleExtractedTasksPageChange(extractedTasksPage - 1)}
                        disabled={extractedTasksPage === 1 || paginationLoading}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      >
                        Previous
                      </button>
                      {/* Page Numbers */}
                      {(() => {
                        const pages = [];
                        const totalPages = extractedTasksTotalPages;
                        const current = extractedTasksPage;

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (current <= 3) {
                            pages.push(1, 2, 3, 4, '...', totalPages);
                          } else if (current >= totalPages - 2) {
                            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                          } else {
                            pages.push(1, '...', current - 1, current, current + 1, '...', totalPages);
                          }
                        }

                        return pages.map((page, idx) => (
                          page === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-500">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => handleExtractedTasksPageChange(page)}
                              disabled={paginationLoading}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                page === current
                                  ? 'bg-purple-600 text-white'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {page}
                            </button>
                          )
                        ));
                      })()}
                      <button
                        onClick={() => handleExtractedTasksPageChange(extractedTasksPage + 1)}
                        disabled={extractedTasksPage === extractedTasksTotalPages || paginationLoading}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
                  <div className="p-4 bg-purple-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks to triage</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                    Click "Extract" to discover actionable tasks from your connected sources.
                  </p>
                  <button
                    onClick={() => extractTasksFromSources()}
                    disabled={extractionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 text-sm font-medium"
                  >
                    {extractionLoading ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <SparklesIcon className="w-4 h-4" />
                    )}
                    Extract Tasks
                  </button>
                </div>
              )}
            </div>

            {/* Right: Detail Panel — only shown when a task is selected */}
            {selectedTriageTask && (
              <div className="flex-1 overflow-hidden">
                <TriageDetailPanel
                  task={selectedTriageTask}
                  onAddToTasks={handleAddExtractedTask}
                  onDismiss={handleDismissExtractedTask}
                  onRevert={handleRevertExtractedTask}
                  onClose={() => setSelectedTriageTask(null)}
                  actionLoading={triageActionLoading}
                  userId={user?.id}
                  connectedAccounts={connectedAccounts}
                  onSummaryGenerated={handleTriageSummaryGenerated}
                  emailCacheRef={triageEmailCacheRef}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Backlog View - Main AI Prioritization Interface */}
      {activeSubTab === 'backlog' && (
        <>
          {/* Backlog Header - Plane-style */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between h-12 px-4">
              {/* Left: Task Count & Refresh */}
              <div className="flex items-center gap-2">
                {/* Refresh */}
                <button
                  onClick={fetchTasks}
                  disabled={loading}
                  className="inline-flex items-center justify-center h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 transition-colors"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {filteredTasks.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 px-2 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                    {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                )}
                {selectedTasks.length > 0 && (
                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                    <span className="text-xs font-medium text-blue-600">{selectedTasks.length} selected</span>
                    <button
                      onClick={handleBulkComplete}
                      className="h-6 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Complete
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="h-6 px-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedTasks([])}
                      className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5">
                {/* Layout Selector - Plane style */}
                <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-md">
                  <button
                    onClick={() => setBacklogLayout('list')}
                    className={`inline-flex items-center justify-center h-6 w-7 rounded transition-colors ${
                      backlogLayout === 'list'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="List view"
                  >
                    <ListBulletIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setBacklogLayout('board')}
                    className={`inline-flex items-center justify-center h-6 w-7 rounded transition-colors ${
                      backlogLayout === 'board'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Board view"
                  >
                    <Squares2X2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Divider */}
                <div className="h-4 w-px bg-gray-200 mx-1" />

                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 w-40 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>

                {/* Divider */}
                <div className="h-4 w-px bg-gray-200 mx-1" />

                {/* Filters */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className={`h-8 pl-2 pr-7 text-xs border rounded-md appearance-none bg-[length:16px_16px] bg-[position:right_4px_center] bg-no-repeat transition-colors ${
                    priorityFilter !== 'all'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E\")" }}
                >
                  <option value="all">Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="none">No Priority</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`h-8 pl-2 pr-7 text-xs border rounded-md appearance-none bg-[length:16px_16px] bg-[position:right_4px_center] bg-no-repeat transition-colors ${
                    statusFilter !== 'all'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E\")" }}
                >
                  <option value="all">Status</option>
                  <option value="none">No Status</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                  <option value="delayed">Delayed</option>
                </select>
                {(priorityFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    onClick={() => { setPriorityFilter('all'); setStatusFilter('all'); }}
                    className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="Clear filters"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Divider */}
                <div className="h-4 w-px bg-gray-200 mx-1" />

                {/* Create Task - Blue primary */}
                <button
                  onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>

                {/* AI Prioritize - Purple accent */}
                <button
                  onClick={handlePrioritizeAll}
                  disabled={isPrioritizing || filteredTasks.length === 0}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Run AI analysis on all tasks"
                >
                  {isPrioritizing ? (
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Prioritize</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content - Plane-style Spreadsheet View */}
          <div className="flex-1 overflow-auto bg-white">
            {loading ? (
              <div className="p-8 text-center">
                <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading tasks...</p>
              </div>
            ) : isPrioritizing ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-3 px-4 py-3 bg-violet-50 rounded border border-violet-100">
                  <ArrowPathIcon className="w-4 h-4 text-violet-500 animate-spin" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-violet-700">AI is analyzing your tasks...</p>
                    <p className="text-xs text-violet-500">This may take a few seconds</p>
                  </div>
                </div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
                  <ClipboardDocumentListIcon className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No tasks yet</h3>
                <p className="text-xs text-gray-500 mb-4">Create your first task to get started</p>
                <button
                  onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Create Task
                </button>
              </div>
            ) : backlogLayout === 'list' ? (
              /* Plane-style Spreadsheet Table */
              <table className="w-full">
                {/* Sortable Table Header */}
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    <th className="w-24 px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    {[
                      { key: 'title', label: 'Task', className: '' },
                      { key: 'priority', label: 'Priority', className: 'w-24' },
                      { key: null, label: 'Status', className: 'w-28' },
                      { key: 'due_date', label: 'Due', className: 'w-24' },
                      { key: 'estimated', label: 'Est.', className: 'w-20' },
                    ].map(col => (
                      <th
                        key={col.label}
                        className={`${col.className} px-4 py-2.5 text-xs font-medium uppercase tracking-wider ${
                          col.key ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors' : ''
                        } ${sortBy === col.key ? 'text-blue-600' : 'text-gray-500'}`}
                        onClick={() => col.key && handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.key && sortBy === col.key && (
                            <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody className="divide-y divide-gray-100">
                  {sortedTasks.map(task => {
                    const taskKey = `TASK-${task.id}`;
                    const priorityConfig = {
                      urgent: { Icon: AlertCircle, color: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', label: 'Urgent' },
                      high: { Icon: SignalHigh, color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', label: 'High' },
                      medium: { Icon: SignalMedium, color: '#eab308', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Medium' },
                      low: { Icon: SignalLow, color: '#22c55e', bg: 'bg-green-50', text: 'text-green-700', label: 'Low' },
                      none: { Icon: Ban, color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-500', label: 'None' },
                    }[task.priority] || { Icon: Ban, color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-500', label: 'None' };

                    const statusConfig = {
                      none: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'No Status' },
                      todo: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'To Do' },
                      in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
                      review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Review' },
                      done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
                      delayed: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'Delayed' },
                    }[task.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: task.status };

                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

                    return (
                      <tr
                        key={task.id}
                        className="group hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => { setEditingTask(task); setShowTaskModal(true); }}
                      >
                        {/* ID */}
                        <td className="px-4 py-2.5 border-r border-gray-100">
                          <span className="text-xs font-mono text-gray-400">{taskKey}</span>
                        </td>
                        {/* Task Title */}
                        <td className="px-4 py-2.5 border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 truncate">{task.title}</span>
                            {task.created_at && (Date.now() - new Date(task.created_at).getTime() < 86400000) && (
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-medium">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Priority */}
                        <td className="px-4 py-2.5 border-r border-gray-100">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${priorityConfig.bg} border-transparent`}>
                            <priorityConfig.Icon size={12} style={{ color: priorityConfig.color }} />
                            <span className={`text-xs font-medium ${priorityConfig.text}`}>{priorityConfig.label}</span>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-2.5 border-r border-gray-100">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        {/* Due Date */}
                        <td className="px-4 py-2.5 border-r border-gray-100">
                          {task.due_date ? (
                            <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        {/* Estimated Time */}
                        <td className="px-4 py-2.5">
                          {task.ai_estimated_minutes ? (
                            <span className="text-xs text-gray-500">{task.ai_estimated_minutes}m</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Plane-style Kanban Board View - Grouped by Priority */
              <div className="flex gap-3 p-4 h-full overflow-x-auto">
                {/* Priority Columns */}
                {[
                  { id: 'urgent', label: 'Urgent', Icon: AlertCircle, color: '#ef4444', bgHeader: 'bg-red-50', borderColor: 'border-red-200', dropBg: 'bg-red-100' },
                  { id: 'high', label: 'High', Icon: SignalHigh, color: '#f97316', bgHeader: 'bg-orange-50', borderColor: 'border-orange-200', dropBg: 'bg-orange-100' },
                  { id: 'medium', label: 'Medium', Icon: SignalMedium, color: '#eab308', bgHeader: 'bg-amber-50', borderColor: 'border-amber-200', dropBg: 'bg-amber-100' },
                  { id: 'low', label: 'Low', Icon: SignalLow, color: '#22c55e', bgHeader: 'bg-green-50', borderColor: 'border-green-200', dropBg: 'bg-green-100' },
                ].map(column => {
                  const columnTasks = filteredTasks.filter(t => t.priority === column.id);
                  const isDropTarget = dragOverColumn === column.id;

                  return (
                    <div
                      key={column.id}
                      className={`flex-shrink-0 w-72 flex flex-col rounded-lg transition-colors ${
                        isDropTarget ? column.dropBg : 'bg-gray-50'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverColumn(column.id);
                      }}
                      onDragLeave={() => setDragOverColumn(null)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setDragOverColumn(null);
                        if (draggedTask && draggedTask.priority !== column.id) {
                          try {
                            await handleUpdateTask(draggedTask.id, { priority: column.id });
                          } catch (err) {
                            console.error('Failed to update priority:', err);
                          }
                        }
                        setDraggedTask(null);
                      }}
                    >
                      {/* Column Header */}
                      <div className={`flex items-center justify-between px-3 py-2.5 ${column.bgHeader} rounded-t-lg border-b ${column.borderColor}`}>
                        <div className="flex items-center gap-2">
                          <column.Icon size={14} style={{ color: column.color }} />
                          <span className="text-sm font-medium text-gray-900">{column.label}</span>
                          <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">{columnTasks.length}</span>
                        </div>
                        <button
                          onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Column Body */}
                      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
                        {columnTasks.length === 0 ? (
                          <div className={`flex items-center justify-center h-24 text-xs text-gray-400 border-2 border-dashed rounded-lg ${
                            isDropTarget ? 'border-gray-400' : 'border-transparent'
                          }`}>
                            {isDropTarget ? 'Drop here' : 'No tasks'}
                          </div>
                        ) : (
                          columnTasks.map(task => {
                            const statusConfig = {
                              none: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'No Status' },
                              todo: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'To Do' },
                              in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
                              review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Review' },
                              done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
                              delayed: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'Delayed' },
                            }[task.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: task.status };

                            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                            const isDragging = draggedTask?.id === task.id;

                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedTask(task);
                                }}
                                onDragEnd={() => {
                                  setDraggedTask(null);
                                  setDragOverColumn(null);
                                }}
                                onClick={() => { setEditingTask(task); setShowTaskModal(true); }}
                                className={`group bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow-sm transition-all ${
                                  isDragging ? 'opacity-50 shadow-lg' : ''
                                }`}
                              >
                                {/* Task ID */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-mono text-gray-400">TASK-{task.id}</span>
                                  {task.created_at && (Date.now() - new Date(task.created_at).getTime() < 86400000) && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-medium">
                                      NEW
                                    </span>
                                  )}
                                </div>

                                {/* Task Title */}
                                <p className="text-sm text-gray-900 font-medium line-clamp-2 mb-2">
                                  {task.title}
                                </p>

                                {/* Task Meta */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Status */}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusConfig.bg} ${statusConfig.text}`}>
                                    {statusConfig.label}
                                  </span>

                                  {/* Due Date */}
                                  {task.due_date && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                      {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}

                                  {/* Estimated Time */}
                                  {task.ai_estimated_minutes && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">
                                      {task.ai_estimated_minutes}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Board View (Kanban) */}
      {activeSubTab === 'board' && (
        <>
          {/* Board Header */}
          <div className="flex-shrink-0 bg-white rounded-xl border border-gray-200 p-3 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search board..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="none">No Priority</option>
                </select>

                <button
                  onClick={fetchTasks}
                  disabled={loading}
                  className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                >
                  <ArrowPathIcon className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <ArrowPathIcon className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-x-auto pb-4">
              <div className="flex gap-3 h-full min-w-max">
                {KANBAN_COLUMNS.map(column => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    columnTasks={tasksByColumn[column.id] || []}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={editingTask?.id ? (data) => handleUpdateTask(editingTask.id, data) : handleCreateTask}
        onSummaryGenerated={handleTaskSummaryGenerated}
      />

      {/* AI Prioritize Modal */}
      <AIPrioritizeModal
        isOpen={showPrioritizeModal}
        onClose={() => setShowPrioritizeModal(false)}
        userId={user?.id || 1}
        onPrioritiesApplied={() => fetchTasks()}
      />

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onSummaryGenerated={handleTaskSummaryGenerated}
        />
      )}
    </div>
  );
};

// --------------------------------------------------------------------------
// SCHEDULE SUBTAB — Uses CalendarView + AI Scheduler panel
// --------------------------------------------------------------------------

const ScheduleView = () => {
  const { user } = useAuth();
  const { tasks: userTasks, refreshTasks: sharedRefreshTasks } = useContext(SharedTasksContext);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarError, setCalendarError] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [scheduleError, setScheduleError] = useState(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Preview-then-confirm state
  const [previewSlots, setPreviewSlots] = useState([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewWarnings, setPreviewWarnings] = useState([]);
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editSlotError, setEditSlotError] = useState('');

  // AI Scheduler panel collapsed state (persisted in localStorage)
  const [schedulerPanelOpen, setSchedulerPanelOpen] = useState(
    () => localStorage.getItem('scheduler_panel_open') !== 'false'
  );
  useEffect(() => {
    localStorage.setItem('scheduler_panel_open', schedulerPanelOpen);
  }, [schedulerPanelOpen]);

  // Locally-scheduled tasks (accepted but not necessarily pushed to Google Calendar)
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [showScheduledTasks, setShowScheduledTasks] = useState(true);
  // Push-to-calendar state
  const [pushingTaskIds, setPushingTaskIds] = useState(null); // task IDs currently being pushed (null = not pushing)
  const [pushAccountPicker, setPushAccountPicker] = useState(null); // { taskIds: [...] } when open
  // Task from calendar event modal
  const [showTaskFromEmailModal, setShowTaskFromEmailModal] = useState(false);
  const [taskFromEmailData, setTaskFromEmailData] = useState(null);

  // Manual drag-and-drop scheduling state
  const dragTaskRef = useRef(null);

  // Scheduler settings
  const [scheduleMode, setScheduleMode] = useState('weekdays'); // 'weekdays' | 'weekends' | 'custom'
  const [customDays, setCustomDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [schedulerInstructions, setSchedulerInstructions] = useState(
    () => localStorage.getItem('scheduler_instructions') || ''
  );
  useEffect(() => {
    localStorage.setItem('scheduler_instructions', schedulerInstructions);
  }, [schedulerInstructions]);

  // Derived work days from schedule mode
  const activeWorkDays = useMemo(() => {
    if (scheduleMode === 'weekdays') return ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (scheduleMode === 'weekends') return ['sat', 'sun'];
    return customDays;
  }, [scheduleMode, customDays]);

  // Date range tracking for CalendarView → fetch events
  const [calendarDateRange, setCalendarDateRange] = useState(null);

  // Fetch connected accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user?.id) return;
      try {
        const accounts = await oauth.getAccounts(user.id);
        const transformed = (accounts || []).map(acc => ({
          id: String(acc.id),
          email: acc.account_email,
          account_email: acc.account_email,
          provider: acc.provider,
          is_revoked: acc.is_revoked || false,
        }));
        setConnectedAccounts(transformed);
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };
    fetchAccounts();
  }, [user?.id]);

  // Tasks come from shared context
  const fetchTasks = sharedRefreshTasks;

  // Fetch calendar events when CalendarView reports a date range change
  const fetchCalendarEvents = useCallback(async (forceRefresh = false) => {
    if (!user?.id || !calendarDateRange) return;

    const bufferDays = 7;
    const startDate = new Date(calendarDateRange.start);
    startDate.setDate(startDate.getDate() - bufferDays);
    const endDate = new Date(calendarDateRange.end);
    endDate.setDate(endDate.getDate() + bufferDays);

    try {
      setCalendarError(null);
      const calendarResult = await calendarApi.getEvents(user.id, {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 2500,
      });
      setCalendarEvents(calendarResult.events || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      const detail = error.response?.data?.detail;
      let errorMessage = 'Failed to load calendar events';
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0]?.msg || detail[0]?.message || errorMessage;
      } else if (detail?.message) {
        errorMessage = detail.message;
      }
      setCalendarError(errorMessage);
    }
  }, [user?.id, calendarDateRange]);

  // Fetch locally-scheduled tasks from DB
  const fetchScheduledTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await taskScheduler.getScheduledEvents(user.id);
      setScheduledTasks(result.scheduled_events || []);
    } catch (error) {
      console.error('Error fetching scheduled tasks:', error);
    }
  }, [user?.id]);

  // Combined fetch for manual refresh + post-confirm
  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTasks(), fetchCalendarEvents(true), fetchScheduledTasks()]);
    setLoading(false);
  }, [fetchTasks, fetchCalendarEvents, fetchScheduledTasks]);

  // Fetch calendar events + scheduled tasks on mount/date range change
  useEffect(() => {
    if (!calendarDateRange) return;
    Promise.all([fetchCalendarEvents(), fetchScheduledTasks()]).finally(() => setLoading(false));
    setScheduleError(null);
    setScheduleSuccess(null);
    setEditingSlotIndex(null);
    setEditPopoverRect(null);
  }, [fetchCalendarEvents, fetchScheduledTasks, calendarDateRange]);

  // Schedule tasks handler — now preview-only
  const handleScheduleTasks = useCallback(async (taskIds = null) => {
    if (!user?.id) return;
    if (activeWorkDays.length === 0) {
      setScheduleError('No work days selected. Please select at least one day.');
      return;
    }
    setScheduling(true);
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      const accounts = await oauth.getAccounts(user.id);
      const account = (accounts || []).find(a => a.provider === 'google' && !a.is_revoked);
      if (!account) {
        setScheduleError('No connected Google account found. Please connect a Google account first.');
        return;
      }

      // Always schedule from today forward (not from the displayed week's start)
      // so that past days (e.g. last Sunday) are never scheduled.
      const today = new Date();
      const pad2 = n => String(n).padStart(2, '0');
      const startDateStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

      const result = await taskScheduler.preview({
        userId: user.id,
        taskIds: taskIds,
        accountId: account.id,
        scheduleStartDate: startDateStr,
        scheduleDays: 7,
        preferredStartTime: workStartTime,
        preferredEndTime: workEndTime,
        workDays: activeWorkDays,
        schedulerInstructions: schedulerInstructions.trim() || null,
      });

      if (result.scheduled_slots && result.scheduled_slots.length > 0) {
        setPreviewSlots(result.scheduled_slots);
        setIsPreviewMode(true);
        setEditingSlotIndex(null);
        setEditPopoverRect(null);
        setSelectedTaskIds(new Set());
        // Collect warnings visible during preview mode
        const warnings = [];
        if (result.skipped_tasks?.length > 0) {
          warnings.push(`Skipped: ${result.skipped_tasks.map(t => t.title).join(', ')}`);
        }
        if (result.warnings?.length > 0) {
          warnings.push(...result.warnings);
        }
        setPreviewWarnings(warnings);
      } else {
        setScheduleError(result.warnings?.join('. ') || 'No tasks could be scheduled.');
        if (result.skipped_tasks?.length > 0) {
          const skippedNames = result.skipped_tasks.map(t => t.title).join(', ');
          setScheduleError(prev => `${prev || ''}${prev ? ' ' : ''}Skipped: ${skippedNames}`);
        }
      }
    } catch (error) {
      console.error('Scheduling preview failed:', error);
      setScheduleError(error?.response?.data?.detail || error.message || 'Failed to generate schedule preview.');
    } finally {
      setScheduling(false);
    }
  }, [user?.id, workStartTime, workEndTime, activeWorkDays, schedulerInstructions]);

  // Accept schedule — save slots locally (no Google Calendar)
  const handleAcceptSchedule = useCallback(async () => {
    if (!user?.id || previewSlots.length === 0) return;
    setConfirming(true);
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      const result = await taskScheduler.accept({
        userId: user.id,
        slots: previewSlots,
      });

      if (result.success && result.accepted_count > 0) {
        let msg = `Accepted ${result.accepted_count} task(s) to your schedule.`;
        if (result.warnings?.length > 0) {
          msg += ` (${result.warnings.join('. ')})`;
        }
        setScheduleSuccess(msg);
        setPreviewWarnings([]);
        setEditingSlotIndex(null);
        setEditPopoverRect(null);
        await fetchData();
        setPreviewSlots([]);
        setIsPreviewMode(false);
        window.dispatchEvent(new Event('tasks-schedule-changed'));
      } else {
        setPreviewWarnings(result.warnings?.length > 0 ? result.warnings : ['Failed to accept schedule.']);
      }
    } catch (error) {
      console.error('Schedule accept failed:', error);
      const msg = error?.response?.data?.detail || error.message || 'Failed to accept schedule.';
      setPreviewWarnings([msg]);
    } finally {
      setConfirming(false);
    }
  }, [user?.id, previewSlots, fetchData]);

  // Push locally-accepted tasks to Google Calendar
  const handlePushToCalendar = useCallback(async (taskIds, accountId) => {
    if (!user?.id || !taskIds?.length || !accountId) return;
    setPushAccountPicker(null); // close picker immediately so it doesn't drift on re-render
    setPushingTaskIds(taskIds);
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      const result = await taskScheduler.pushToCalendar({
        userId: user.id,
        accountId,
        taskIds,
      });

      if (result.scheduled_events && result.scheduled_events.length > 0) {
        let msg = `Pushed ${result.scheduled_events.length} event(s) to Google Calendar!`;
        if (result.warnings?.length > 0) {
          msg += ` (${result.warnings.join('. ')})`;
        }
        setScheduleSuccess(msg);
        await fetchData();
        window.dispatchEvent(new Event('tasks-schedule-changed'));
      } else {
        setScheduleError(result.warnings?.length > 0 ? result.warnings.join('. ') : 'Failed to push to calendar.');
      }
    } catch (error) {
      console.error('Push to calendar failed:', error);
      setScheduleError(error?.response?.data?.detail || error.message || 'Failed to push to Google Calendar.');
    } finally {
      setPushingTaskIds(null);
    }
  }, [user?.id, fetchData]);

  // Cancel preview
  const handleCancelPreview = useCallback(() => {
    setPreviewSlots([]);
    setIsPreviewMode(false);
    setEditingSlotIndex(null);
    setEditPopoverRect(null);
    setPreviewWarnings([]);
  }, []);

  // Delete a preview slot
  const handleDeletePreviewSlot = useCallback((index) => {
    setPreviewSlots(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setIsPreviewMode(false);
      return next;
    });
    setEditingSlotIndex(prev => {
      if (prev === null) return null;
      if (prev === index) { setEditPopoverRect(null); return null; }
      if (prev > index) return prev - 1;     // shift down after deletion
      return prev;
    });
  }, []);

  // --- Manual drag-and-drop handler (CalendarView handles drag UI) ---
  const handleCalendarDrop = useCallback((taskData, dayDate, hours, mins) => {
    const task = taskData;
    if (!task) return;

    const duration = task.ai_estimated_minutes || 60;
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;

    const startHH = String(hours).padStart(2, '0');
    const startMM = String(mins).padStart(2, '0');
    const endTotalMins = hours * 60 + mins + duration;
    const endHours = Math.min(23, Math.floor(endTotalMins / 60));
    const endMins = endTotalMins >= 24 * 60 ? 59 : endTotalMins % 60;
    const endHH = String(endHours).padStart(2, '0');
    const endMM = String(endMins).padStart(2, '0');

    const startMinsTotal = hours * 60 + mins;
    const endMinsTotal = endHours * 60 + endMins;

    // Check overlap with existing preview slots on the same day
    const overlapsPreview = previewSlots.some(slot => {
      if (slot.date !== dateStr) return false;
      const os = parseInt(slot.start_time.split(':')[0]) * 60 + parseInt(slot.start_time.split(':')[1]);
      const oe = parseInt(slot.end_time.split(':')[0]) * 60 + parseInt(slot.end_time.split(':')[1]);
      return startMinsTotal < oe && endMinsTotal > os;
    });
    if (overlapsPreview) {
      setScheduleError('Cannot drop here — overlaps with another scheduled slot');
      setTimeout(() => setScheduleError(prev => prev === 'Cannot drop here — overlaps with another scheduled slot' ? null : prev), 4000);
      return;
    }

    // Check overlap with calendar events on the same day
    const slotDayStr = dayDate.toDateString();
    const overlapsCalendar = calendarEvents.some(ev => {
      if (ev.is_all_day || ev.all_day || ev.isHoliday || !ev.start || !ev.end) return false;
      const evStart = new Date(ev.start);
      if (evStart.toDateString() !== slotDayStr) return false;
      const evEnd = new Date(ev.end);
      const evStartMins = evStart.getHours() * 60 + evStart.getMinutes();
      const evEndMins = evEnd.getHours() * 60 + evEnd.getMinutes();
      return startMinsTotal < evEndMins && endMinsTotal > evStartMins;
    });
    if (overlapsCalendar) {
      setScheduleError('Cannot drop here — overlaps with a calendar event');
      setTimeout(() => setScheduleError(prev => prev === 'Cannot drop here — overlaps with a calendar event' ? null : prev), 4000);
      return;
    }

    // Check overlap with locally-scheduled (accepted) tasks on the same day
    const overlapsScheduled = scheduledTasks.some(st => {
      if (st.date !== dateStr || st.has_calendar_event) return false;
      const stStart = parseInt(st.start_time.split(':')[0]) * 60 + parseInt(st.start_time.split(':')[1]);
      const stEnd = parseInt(st.end_time.split(':')[0]) * 60 + parseInt(st.end_time.split(':')[1]);
      return startMinsTotal < stEnd && endMinsTotal > stStart;
    });
    if (overlapsScheduled) {
      setScheduleError('Cannot drop here — overlaps with an already-scheduled task');
      setTimeout(() => setScheduleError(prev => prev === 'Cannot drop here — overlaps with an already-scheduled task' ? null : prev), 4000);
      return;
    }

    const newSlot = {
      task_id: task.id,
      task_title: task.title,
      date: dateStr,
      start_time: `${startHH}:${startMM}`,
      end_time: `${endHH}:${endMM}`,
      estimated_minutes: duration,
      priority: task.priority || 'medium',
    };

    // Use functional updater to avoid stale closure on previewSlots
    setPreviewSlots(prev => {
      if (prev.some(s => s.task_id === task.id)) return prev; // prevent duplicate
      return [...prev, newSlot];
    });
    setIsPreviewMode(true);
  }, [previewSlots, scheduledTasks, calendarEvents]);

  // Remove an AI-scheduled event from Google Calendar and reset task
  const [removingEventId, setRemovingEventId] = useState(null);
  const handleRemoveScheduledEvent = useCallback(async (event) => {
    // Extract Task ID from summary [Task-123] or fallback to description (old format)
    const summaryMatch = (event.summary || '').match(/^\[Task-(\d+)]/);
    const descMatch = !summaryMatch && (event.description || '').match(/Task ID:\s*(\d+)/);
    const taskId = summaryMatch ? parseInt(summaryMatch[1], 10) : descMatch ? parseInt(descMatch[1], 10) : null;
    if (!taskId || !user?.id) return;

    // Match the account that owns this event (by email), fall back to first Google account
    const validAccounts = connectedAccounts.filter(a => a.provider === 'google' && !a.is_revoked);
    const account = validAccounts.find(a => a.email === event.account_email) || validAccounts[0];
    if (!account) {
      setScheduleError('No connected Google account found. Please reconnect.');
      return;
    }

    setRemovingEventId(event.id);
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      await taskScheduler.remove({
        userId: user.id,
        accountId: Number(account.id),
        calendarEventId: event.id,
        taskId,
      });
      await fetchData();
      // Notify other views (e.g. Board) to refresh task data
      window.dispatchEvent(new Event('tasks-schedule-changed'));
    } catch (err) {
      console.error('Failed to remove scheduled event:', err);
      setScheduleError(err?.response?.data?.detail || err.message || 'Failed to remove scheduled event');
    } finally {
      setRemovingEventId(null);
    }
  }, [user?.id, fetchData, connectedAccounts]);

  // Remove a locally-scheduled task (unaccept — no Google Calendar involved)
  const [unacceptingTaskId, setUnacceptingTaskId] = useState(null);
  const handleUnacceptTask = useCallback(async (taskId) => {
    if (!user?.id || !taskId) return;
    setUnacceptingTaskId(taskId);
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      await taskScheduler.unaccept({ userId: user.id, taskId });
      await fetchData();
      window.dispatchEvent(new Event('tasks-schedule-changed'));
    } catch (err) {
      console.error('Failed to unaccept task:', err);
      setScheduleError(err?.response?.data?.detail || err.message || 'Failed to remove from schedule');
    } finally {
      setUnacceptingTaskId(null);
    }
  }, [user?.id, fetchData]);

  // Open edit popover for a preview slot
  const [editPopoverRect, setEditPopoverRect] = useState(null);

  // Close edit popover on window resize (rect becomes stale)
  useEffect(() => {
    if (!editPopoverRect) return;
    const close = () => { setEditingSlotIndex(null); setEditPopoverRect(null); };
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [editPopoverRect]);

  // Close account picker popover on window resize (rect becomes stale)
  useEffect(() => {
    if (!pushAccountPicker) return;
    const close = () => setPushAccountPicker(null);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [pushAccountPicker]);

  const handleEditPreviewSlot = useCallback((index, e) => {
    const slot = previewSlots[index];
    setEditingSlotIndex(index);
    setEditStartTime(slot.start_time);
    setEditEndTime(slot.end_time);
    setEditSlotError('');
    // Capture the clicked element's position for portal popover
    const target = e?.currentTarget;
    if (target) {
      setEditPopoverRect(target.getBoundingClientRect());
    }
  }, [previewSlots]);

  // Save edited slot (validates end > start + no overlaps with other slots or calendar events)
  const handleSaveSlotEdit = useCallback(() => {
    if (editingSlotIndex === null) return;
    setEditSlotError('');
    const s = editStartTime.split(':');
    const e = editEndTime.split(':');
    const startMins = parseInt(s[0]) * 60 + parseInt(s[1]);
    const endMins = parseInt(e[0]) * 60 + parseInt(e[1]);
    if (endMins <= startMins) {
      setEditSlotError('End time must be after start time');
      return;
    }

    const editedSlot = previewSlots[editingSlotIndex];

    // Check overlap with other preview slots on the same day
    const overlapsPreview = previewSlots.some((slot, i) => {
      if (i === editingSlotIndex) return false;
      if (slot.date !== editedSlot.date) return false;
      const os = parseInt(slot.start_time.split(':')[0]) * 60 + parseInt(slot.start_time.split(':')[1]);
      const oe = parseInt(slot.end_time.split(':')[0]) * 60 + parseInt(slot.end_time.split(':')[1]);
      return startMins < oe && endMins > os;
    });
    if (overlapsPreview) {
      setEditSlotError('Overlaps with another scheduled slot');
      return;
    }

    // Check overlap with real calendar events on the same day (exclude same-task events when rescheduling)
    const slotDayStr = new Date(editedSlot.date + 'T00:00:00').toDateString();
    const overlapsCalendar = calendarEvents.some(ev => {
      if (ev.is_all_day || ev.all_day || ev.isHoliday || !ev.start || !ev.end) return false;
      if (new Date(ev.start).toDateString() !== slotDayStr) return false;
      // Skip calendar events that belong to the same task (rescheduling scenario)
      if (ev.isAIScheduled && (ev.summary || '').includes(`[Task-${editedSlot.task_id}]`)) return false;
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      const evStartMins = evStart.getHours() * 60 + evStart.getMinutes();
      const evEndMins = evEnd.getHours() * 60 + evEnd.getMinutes();
      return startMins < evEndMins && endMins > evStartMins;
    });
    if (overlapsCalendar) {
      setEditSlotError('Overlaps with a calendar event');
      return;
    }

    // Check overlap with locally-scheduled (accepted) tasks on the same day
    const overlapsScheduled = scheduledTasks.some(st => {
      if (st.date !== editedSlot.date || st.has_calendar_event) return false;
      const stStart = parseInt(st.start_time.split(':')[0]) * 60 + parseInt(st.start_time.split(':')[1]);
      const stEnd = parseInt(st.end_time.split(':')[0]) * 60 + parseInt(st.end_time.split(':')[1]);
      return startMins < stEnd && endMins > stStart;
    });
    if (overlapsScheduled) {
      setEditSlotError('Overlaps with an already-scheduled task');
      return;
    }

    setPreviewSlots(prev => prev.map((slot, i) => {
      if (i !== editingSlotIndex) return slot;
      return { ...slot, start_time: editStartTime, end_time: editEndTime, estimated_minutes: endMins - startMins };
    }));
    setEditingSlotIndex(null);
    setEditPopoverRect(null);
  }, [editingSlotIndex, editStartTime, editEndTime, previewSlots, calendarEvents, scheduledTasks]);

  // Toggle task selection for scheduling
  const toggleTaskSelection = useCallback((taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // CalendarView handles event filtering, holiday merging, all-day events,
  // and timed event layout internally — no duplicate memos needed here.

  // Calculate available work time this week
  // Unscheduled tasks — only actionable statuses, exclude calendar-sourced and already scheduled
  const pendingTasks = useMemo(() => {
    return userTasks.filter(t => {
      // Only include actionable statuses (excludes done, delayed, etc.)
      if (!SCHEDULABLE_STATUSES.has(t.status)) return false;
      // Tasks originating from calendar are already on the calendar
      if (t.external_source === 'calendar' || t.external_source === 'ai_extracted_calendar') return false;
      // Tasks already placed on calendar via AI scheduler
      if (t.is_scheduled) return false;
      return true;
    });
  }, [userTasks]);

  // Locally-scheduled tasks not yet pushed to Google Calendar
  const unpushedLocalTasks = useMemo(() =>
    scheduledTasks.filter(t => !t.has_calendar_event),
  [scheduledTasks]);

  // Task IDs currently in preview slots (for checkbox state during preview mode)
  const previewedTaskIds = useMemo(() =>
    new Set(previewSlots.map(s => s.task_id)),
  [previewSlots]);

  // Clean up stale selections when pendingTasks changes (e.g. task got scheduled)
  useEffect(() => {
    setSelectedTaskIds(prev => {
      const validIds = new Set(pendingTasks.map(t => t.id));
      const cleaned = new Set([...prev].filter(id => validIds.has(id)));
      return cleaned.size === prev.size ? prev : cleaned;
    });
  }, [pendingTasks]);

  // Meeting prep handler for CalendarView
  const handleFetchMeetingPrep = useCallback(async (event) => {
    if (!user?.id || !event) return null;
    const googleAccounts = connectedAccounts.filter(a => a.provider === 'google' && !a.is_revoked);
    const accountId = event.account_id || googleAccounts[0]?.id;
    if (!accountId) throw new Error('No connected Google account found. Please connect one first.');
    return await calendarApi.getMeetingPrep(user.id, event, accountId);
  }, [user?.id, connectedAccounts]);

  // Create task from calendar event handler for CalendarView
  const handleCreateTaskFromEvent = useCallback((event) => {
    if (!event) return;
    const eventStart = new Date(event.start);
    const dueDate = eventStart.toISOString().split('T')[0];
    const taskData = {
      title: event.summary || 'Task from calendar',
      description: event.description
        ? `Meeting: ${event.summary}\nTime: ${eventStart.toLocaleString()}\n\n${event.description.replace(/<[^>]*>/g, '')}`
        : `Meeting: ${event.summary}\nTime: ${eventStart.toLocaleString()}`,
      priority: event.attendees?.length > 3 ? 'high' : 'medium',
      status: 'todo',
      due_date: dueDate,
      category: 'Meeting',
      external_source: 'calendar',
      external_id: event.id,
      external_url: event.htmlLink || `https://calendar.google.com/calendar/event?eid=${event.id}`,
    };
    setTaskFromEmailData(taskData);
    setShowTaskFromEmailModal(true);
  }, []);

  // Push a single locally-scheduled task to Google Calendar
  const handlePushSingleTask = useCallback((taskId, anchorEl) => {
    const validAccounts = connectedAccounts.filter(a => a.provider === 'google' && !a.is_revoked);
    if (validAccounts.length === 0) {
      setScheduleError('No connected Google account. Please connect one first.');
    } else if (validAccounts.length === 1) {
      handlePushToCalendar([taskId], Number(validAccounts[0].id));
    } else {
      setPushAccountPicker({ taskIds: [taskId], anchorEl });
    }
  }, [connectedAccounts, handlePushToCalendar]);

  // Handle clicking on a locally-scheduled task in CalendarView
  const handleLocalScheduledClick = useCallback((task) => {
    if (task) setSelectedTask(task);
  }, []);

  // Connect Google account — redirect to OAuth flow
  const handleShowAddAccount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const authData = await oauth.getGoogleAuthUrl(user.id);
      if (authData.authorization_url) {
        sessionStorage.setItem('oauth_state', authData.state);
        sessionStorage.setItem('oauth_provider', 'google');
        window.location.href = authData.authorization_url;
      }
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      setScheduleError('Failed to start Google account connection. Please try again.');
    }
  }, [user?.id]);

  return (
    <div className="h-full flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ===== CalendarView (full-featured) with scheduling overlays ===== */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <CalendarView
          events={calendarEvents}
          accounts={connectedAccounts}
          loading={loading}
          error={calendarError}
          onRefresh={fetchData}
          onDateRangeChange={setCalendarDateRange}
          onShowAddAccount={handleShowAddAccount}
          onFetchMeetingPrep={handleFetchMeetingPrep}
          onCreateTask={handleCreateTaskFromEvent}
          userId={user?.id}
          schedulingMode={true}
          scheduledTasks={scheduledTasks}
          previewSlots={previewSlots}
          isPreviewMode={isPreviewMode}
          showScheduledTasks={showScheduledTasks}
          onToggleScheduledTasks={() => setShowScheduledTasks(prev => !prev)}
          dragEnabled={!isPreviewMode && !scheduling}
          onTaskDrop={handleCalendarDrop}
          onRemoveScheduledTask={handleUnacceptTask}
          onPushSingleTask={handlePushSingleTask}
          onRemovePreviewSlot={handleDeletePreviewSlot}
          onEditPreviewSlot={handleEditPreviewSlot}
          onScheduledEventClick={(task) => {
            if (task) setSelectedTask(task);
          }}
          onLocalScheduledClick={handleLocalScheduledClick}
          statusMessage={scheduleError ? { type: 'error', text: scheduleError } : scheduleSuccess ? { type: 'success', text: scheduleSuccess } : null}
          pushingTaskIds={pushingTaskIds}
          userTasks={userTasks}
          onRemoveScheduledEvent={handleRemoveScheduledEvent}
          removingEventId={removingEventId}
          unacceptingTaskId={unacceptingTaskId}
        />

        {/* Preview Confirm/Cancel Toolbar — overlays bottom of CalendarView */}
        {/* Edit Time Portal Popover — renders outside calendar overflow context */}
        {editingSlotIndex !== null && editPopoverRect && createPortal(
          <>
            {/* Backdrop — click / scroll to close */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => { setEditingSlotIndex(null); setEditPopoverRect(null); }}
              onWheel={() => { setEditingSlotIndex(null); setEditPopoverRect(null); }}
            />
            <div
              className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-52 animate-fade-in"
              style={(() => {
                const popoverH = editSlotError ? 210 : 180;
                const spaceBelow = window.innerHeight - editPopoverRect.bottom;
                const placeAbove = spaceBelow < popoverH + 8 && editPopoverRect.top > popoverH + 8;
                return {
                  left: Math.min(editPopoverRect.left, window.innerWidth - 220),
                  top: placeAbove
                    ? editPopoverRect.top - popoverH - 4
                    : editPopoverRect.bottom + 4,
                };
              })()}
            >
              <p className="text-xs font-semibold text-gray-700 mb-3">Edit time</p>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide">Start</label>
                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide">End</label>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none" />
                </div>
                {editSlotError && <p className="text-[11px] text-red-500 font-medium">{editSlotError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSaveSlotEdit} className="flex-1 text-xs font-medium bg-purple-600 text-white rounded-lg px-3 py-1.5 hover:bg-purple-700 transition-colors">Save</button>
                  <button onClick={() => { setEditingSlotIndex(null); setEditPopoverRect(null); }} className="flex-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-200 transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Account Picker Popover for Push to Google Calendar */}
        {pushAccountPicker && createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setPushAccountPicker(null)}
            />
            <div
              className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-56 animate-fade-in"
              style={{
                left: Math.min((pushAccountPicker.anchorEl?.getBoundingClientRect()?.left || 100), window.innerWidth - 240),
                top: (pushAccountPicker.anchorEl?.getBoundingClientRect()?.bottom || 100) + 4,
              }}
            >
              <p className="text-xs font-semibold text-gray-700 mb-2">Push to Google Calendar</p>
              <div className="space-y-1">
                {connectedAccounts.filter(a => a.provider === 'google' && !a.is_revoked).map(account => (
                  <button
                    key={account.id}
                    onClick={() => handlePushToCalendar(pushAccountPicker.taskIds, Number(account.id))}
                    disabled={!!pushingTaskIds}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="truncate">{account.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Preview Confirm/Cancel Toolbar */}
        {isPreviewMode && (
          <div className="border-t border-purple-200 bg-white p-3 flex-shrink-0">
            {previewWarnings.length > 0 && (
              <p className="text-xs text-amber-600 mb-2 text-center">{previewWarnings.join('. ')}</p>
            )}
            <div className="flex items-center justify-between">
              <button onClick={handleCancelPreview} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">
                Cancel
              </button>
              <div className="flex items-center gap-2 text-sm text-purple-700 font-medium">
                <SparklesIcon className="w-4 h-4" />
                {previewSlots.length} slot{previewSlots.length !== 1 ? 's' : ''} ready
              </div>
              <button
                onClick={handleAcceptSchedule}
                disabled={confirming || previewSlots.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 font-medium text-sm disabled:opacity-50"
              >
                {confirming ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {confirming ? 'Accepting...' : 'Accept Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Right Panel — AI Scheduler + Task Cards (collapsible) ===== */}
      <div
        className={`border-l border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          schedulerPanelOpen ? 'w-96' : 'w-12'
        }`}
        style={{ background: 'linear-gradient(180deg, #faf5ff 0%, #f5f3ff 40%, #f9fafb 100%)' }}
      >
        {schedulerPanelOpen ? (
          <>
          {/* AI Scheduler header + settings + action */}
          <div className="px-5 pt-5 pb-3">
            {/* Title row */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md shadow-purple-200">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 flex-1">AI Scheduler</h3>
              <button
                onClick={() => setSchedulerPanelOpen(false)}
                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Collapse panel"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Schedule settings */}
            <div className="mb-3 p-3 rounded-xl bg-white border border-gray-200/80 space-y-3">
                {/* Mode — segmented control */}
                <div>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Days</label>
                  <div className="flex mt-1.5 p-0.5 bg-gray-100 rounded-lg">
                    {[
                      { id: 'weekdays', label: 'Weekdays' },
                      { id: 'weekends', label: 'Weekends' },
                      { id: 'custom', label: 'Custom' },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setScheduleMode(mode.id)}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                          scheduleMode === mode.id
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom day pills */}
                {scheduleMode === 'custom' && (
                  <div className="flex justify-between px-0.5">
                    {[
                      { id: 'mon', label: 'Mo' },
                      { id: 'tue', label: 'Tu' },
                      { id: 'wed', label: 'We' },
                      { id: 'thu', label: 'Th' },
                      { id: 'fri', label: 'Fr' },
                      { id: 'sat', label: 'Sa' },
                      { id: 'sun', label: 'Su' },
                    ].map(day => {
                      const isActive = customDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          onClick={() => setCustomDays(prev => {
                            if (isActive) {
                              // Prevent deselecting the last day
                              if (prev.length <= 1) return prev;
                              return prev.filter(d => d !== day.id);
                            }
                            return [...prev, day.id];
                          })}
                          className={`w-8 h-8 rounded-full text-[11px] font-semibold transition-all ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Work hours */}
                <div>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Hours</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="time"
                      value={workStartTime}
                      onChange={e => setWorkStartTime(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white text-center"
                    />
                    <span className="text-xs text-gray-300 font-medium">to</span>
                    <input
                      type="time"
                      value={workEndTime}
                      onChange={e => setWorkEndTime(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white text-center"
                    />
                  </div>
                </div>

                {/* Scheduler instructions */}
                <div>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Instructions</label>
                  <textarea
                    value={schedulerInstructions}
                    onChange={e => setSchedulerInstructions(e.target.value)}
                    placeholder={"• Skip 12–1 PM for lunch\n• 30-min breaks between tasks\n• Deep work before noon"}
                    rows={3}
                    maxLength={500}
                    className="w-full mt-1.5 px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white resize-y placeholder:text-gray-300"
                  />
                </div>
              </div>

            {/* AI Auto-Schedule button */}
            <button
              onClick={() => handleScheduleTasks([...selectedTaskIds])}
              disabled={scheduling || selectedTaskIds.size === 0 || isPreviewMode}
              className={`flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-2xl transition-all ${
                selectedTaskIds.size === 0 || isPreviewMode
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg'
              }`}
            >
              {scheduling ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <SparklesIcon className="w-5 h-5" />
              )}
              <span className="text-sm font-semibold">
                {scheduling ? 'Scheduling...' : selectedTaskIds.size > 0 ? `Schedule ${selectedTaskIds.size} Task${selectedTaskIds.size !== 1 ? 's' : ''}` : 'Select Tasks to Schedule'}
              </span>
            </button>

            {/* Push All to Google Calendar — shown when there are unpushed local tasks */}
            {unpushedLocalTasks.length > 0 && !isPreviewMode && (
              <button
                onClick={(e) => {
                  const taskIds = unpushedLocalTasks.map(t => t.task_id);
                  const validAccounts = connectedAccounts.filter(a => a.provider === 'google' && !a.is_revoked);
                  if (validAccounts.length === 0) {
                    setScheduleError('No connected Google account. Please connect one first.');
                  } else if (validAccounts.length === 1) {
                    handlePushToCalendar(taskIds, Number(validAccounts[0].id));
                  } else {
                    setPushAccountPicker({ taskIds, anchorEl: e.currentTarget });
                  }
                }}
                disabled={!!pushingTaskIds}
                className="flex items-center justify-center gap-2 w-full mt-2 px-4 py-2.5 rounded-xl border-2 border-purple-200 text-purple-700 hover:bg-purple-50 transition-all text-sm font-medium disabled:opacity-50"
              >
                {pushingTaskIds ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l1.5 1.5L9 10m-5 6h16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>
                )}
                Push {unpushedLocalTasks.length} to Google Calendar
              </button>
            )}
          </div>

          <div className="border-t border-gray-200/60 mx-5" />

          {/* Task list header */}
          <div className="flex items-center justify-between px-5 py-2.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{pendingTasks.length} Unscheduled</p>
            {pendingTasks.length > 0 && !isPreviewMode && !scheduling && !confirming && (
              <button
                onClick={() => {
                  const allSelected = pendingTasks.length > 0 && pendingTasks.every(t => selectedTaskIds.has(t.id));
                  setSelectedTaskIds(allSelected ? new Set() : new Set(pendingTasks.map(t => t.id)));
                }}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-0.5 rounded-lg hover:bg-purple-50 transition-colors"
              >
                {pendingTasks.every(t => selectedTaskIds.has(t.id)) ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {/* Task Cards — scrollable */}
          <div className="flex-1 overflow-auto px-4 pb-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowPathIcon className="w-6 h-6 text-purple-400 animate-spin mb-2" />
                <p className="text-xs text-gray-400">Loading tasks...</p>
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <CheckCircleIcon className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">All caught up!</p>
                <p className="text-xs text-gray-300 mt-1">No pending tasks to schedule</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map(task => {
                  const isPreviewed = isPreviewMode && previewedTaskIds.has(task.id);
                  const isSelected = isPreviewed || selectedTaskIds.has(task.id);
                  const isDisabled = isPreviewMode || scheduling || confirming;
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

                  const priorityBorder = {
                    urgent: 'border-l-red-500', high: 'border-l-orange-500',
                    medium: 'border-l-amber-400', low: 'border-l-green-500', none: 'border-l-gray-300',
                  }[task.priority] || 'border-l-gray-300';

                  const priorityLabel = {
                    urgent: { text: 'text-red-700', bg: 'bg-red-50', label: 'Urgent', icon: <ExclamationCircleIcon className="w-3 h-3" /> },
                    high: { text: 'text-orange-700', bg: 'bg-orange-50', label: 'High', icon: <ChevronUpIcon className="w-3 h-3" /> },
                    medium: { text: 'text-amber-700', bg: 'bg-amber-50', label: 'Medium', icon: <span className="w-3 h-3 flex items-center justify-center font-bold text-[9px]">=</span> },
                    low: { text: 'text-green-700', bg: 'bg-green-50', label: 'Low', icon: <ChevronDownIcon className="w-3 h-3" /> },
                  }[task.priority] || null;

                  return (
                    <div
                      key={task.id}
                      draggable={!isPreviewed && !scheduling && !confirming}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify(task));
                        e.dataTransfer.effectAllowed = 'copy';
                        dragTaskRef.current = task;
                        const ghost = e.currentTarget.cloneNode(true);
                        ghost.style.position = 'absolute';
                        ghost.style.top = '-1000px';
                        ghost.style.width = '220px';
                        ghost.style.opacity = '0.85';
                        ghost.style.transform = 'rotate(-2deg)';
                        ghost.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                        document.body.appendChild(ghost);
                        e.dataTransfer.setDragImage(ghost, 110, 20);
                        requestAnimationFrame(() => document.body.removeChild(ghost));
                      }}
                      onDragEnd={() => { dragTaskRef.current = null; }}
                      onClick={() => !isDisabled && toggleTaskSelection(task.id)}
                      className={`group bg-white rounded-lg border border-l-[3px] ${priorityBorder} shadow-sm hover:shadow-md transition-all select-none ${
                        isPreviewed
                          ? 'ring-1 ring-purple-200/60 opacity-75 cursor-default'
                          : (scheduling || confirming)
                            ? 'opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'cursor-pointer ring-1 ring-purple-300 shadow-purple-100'
                              : isPreviewMode
                                ? 'cursor-grab border-t-gray-200 border-r-gray-200 border-b-gray-200'
                                : 'cursor-pointer border-t-gray-200 border-r-gray-200 border-b-gray-200'
                      }`}
                    >
                      <div className="p-3">
                        {/* Top Row: Checkbox + Task Key + Priority — matches Board */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex-shrink-0 w-[16px] h-[16px] rounded border-2 flex items-center justify-center transition-colors ${
                                isPreviewed ? 'bg-purple-400 border-purple-400'
                                  : isSelected ? 'bg-purple-600 border-purple-600'
                                  : isDisabled ? 'border-gray-200 bg-gray-100'
                                  : 'border-gray-300 group-hover:border-purple-400'
                              }`}
                            >
                              {(isSelected || isPreviewed) && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs font-mono font-medium text-blue-600">TASK-{task.id}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {priorityLabel && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityLabel.bg} ${priorityLabel.text}`}>
                                {priorityLabel.icon}
                                {priorityLabel.label}
                              </span>
                            )}
                            {task.ai_estimated_minutes && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                <ClockIcon className="w-3 h-3" />
                                {task.ai_estimated_minutes}m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{task.title}</h3>

                        {/* Bottom Row: Labels + Meta — matches Board */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {task.category && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                {task.category}
                              </span>
                            )}
                            {task.due_date && (
                              <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                <ClockIcon className="w-3 h-3" />
                                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                            className="p-1 text-gray-300 hover:text-blue-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="View details"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        ) : (
          /* Collapsed rail — icon + vertical label + expand button */
          <button
            onClick={() => setSchedulerPanelOpen(true)}
            className="flex flex-col items-center w-full pt-4 pb-4 gap-3 hover:bg-purple-50/50 transition-colors cursor-pointer group"
            title="Expand AI Scheduler"
          >
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md shadow-purple-200 group-hover:shadow-lg transition-shadow">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-[11px] font-bold text-gray-500 group-hover:text-purple-600 tracking-wider uppercase transition-colors"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              AI Scheduler
            </span>
            <ChevronLeftIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </button>
        )}
      </div>

    {/* Task from Calendar Event Modal */}
    {showTaskFromEmailModal && taskFromEmailData && (
      <TaskFromEmailModal
        isOpen={showTaskFromEmailModal}
        onClose={() => {
          setShowTaskFromEmailModal(false);
          setTaskFromEmailData(null);
        }}
        taskData={taskFromEmailData}
      />
    )}

    {/* Task Detail Panel */}
    {selectedTask && (
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={async (taskId, data) => {
          await todos.update(taskId, data, user?.id);
          await sharedRefreshTasks();
          setSelectedTask(prev => prev?.id === taskId ? { ...prev, ...data } : prev);
        }}
        onDelete={async (taskId) => {
          await todos.delete(taskId, user?.id);
          await sharedRefreshTasks();
          setSelectedTask(null);
        }}
      />
    )}
    </div>
  );
};

// --------------------------------------------------------------------------
// INSIGHTS SUBTAB
// --------------------------------------------------------------------------
const InsightsView = () => {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const tasksData = await todos.getAll(user?.id, { sort: 'prioritized', limit: 100 });
        setUserTasks(tasksData || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [user?.id]);

  // Filter tasks by priority
  const getTasksByPriority = (priority) => {
    return userTasks.filter(t => t.priority === priority && t.status !== 'done');
  };

  return (
    <div className="space-y-4">
      {/* Action Explorer */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl">
            <LightBulbIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Action Explorer</h2>
            <p className="text-gray-500">Deep analysis and strategic insights for your tasks</p>
          </div>
        </div>

        {/* Task Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select a task to analyze</label>
          {loading ? (
            <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl">
              <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
              <span className="text-gray-500">Loading tasks...</span>
            </div>
          ) : (
            <select
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onChange={(e) => setSelectedTask(userTasks.find(t => t.id === parseInt(e.target.value)))}
            >
              <option value="">Choose a task...</option>
              {userTasks.filter(t => t.status !== 'done').map(task => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          )}
        </div>

        {selectedTask && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Task Analysis */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <BeakerIcon className="w-5 h-5" />
                Task Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Estimated Time</span>
                  <span className="font-medium text-gray-900">2-3 hours</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Complexity Score</span>
                  <span className="font-medium text-orange-600">7/10</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Dependencies</span>
                  <span className="font-medium text-gray-900">2 tasks</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Risk Level</span>
                  <span className="font-medium text-yellow-600">Medium</span>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                AI Recommendations
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Best time to work: Tomorrow 9-11 AM (high energy period)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Break into 3 sub-tasks for better progress tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <span>Complete "Review Q4 budget" first (dependency)</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Combined Actions Strategy */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ArrowsRightLeftIcon className="w-5 h-5 text-blue-500" />
          Combined Actions Strategy
        </h3>
        <p className="text-gray-500 mb-6">Analyze how multiple tasks work together and find optimal execution paths</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Strategy Card 1 */}
          <div className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <RocketLaunchIcon className="w-5 h-5 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900">Speed Run</h4>
            </div>
            <p className="text-sm text-gray-500 mb-3">Complete all urgent tasks in parallel for fastest delivery</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">4 hours</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk</span><span className="font-medium text-orange-600">Medium</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Energy</span><span className="font-medium text-red-600">High</span></div>
            </div>
          </div>

          {/* Strategy Card 2 */}
          <div className="p-4 border-2 border-blue-500 rounded-xl bg-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="font-medium text-gray-900">Recommended</h4>
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">Best</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">Balanced approach with dependencies respected</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">6 hours</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk</span><span className="font-medium text-green-600">Low</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Energy</span><span className="font-medium text-green-600">Sustainable</span></div>
            </div>
          </div>

          {/* Strategy Card 3 */}
          <div className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ArrowTrendingUpIcon className="w-5 h-5 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900">Deep Focus</h4>
            </div>
            <p className="text-sm text-gray-500 mb-3">Sequential execution with full focus on each task</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">8 hours</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk</span><span className="font-medium text-green-600">Very Low</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Energy</span><span className="font-medium text-blue-600">Low</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* What-If Simulator */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-indigo-500" />
          What-If Simulator
        </h3>
        <p className="text-gray-500 mb-4">Explore different scenarios and see their impact</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl">
            <p className="text-sm font-medium text-gray-700 mb-2">If I prioritize client work...</p>
            <div className="text-sm text-gray-600">
              <p>+ Client A deadline met 2 days early</p>
              <p className="text-red-600">- Internal docs delayed by 3 days</p>
              <p>+ Revenue impact: +$5,000</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-sm font-medium text-gray-700 mb-2">If I focus on bug fixes first...</p>
            <div className="text-sm text-gray-600">
              <p>+ Mobile app stability improved</p>
              <p>+ Support tickets reduced by 40%</p>
              <p className="text-red-600">- Client presentation needs weekend work</p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Matrix (Eisenhower) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-green-500" />
          Eisenhower Priority Matrix
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Urgent & Important */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <h4 className="font-medium text-red-800 mb-2">Do First</h4>
            <p className="text-xs text-red-600 mb-3">Urgent & Important</p>
            <div className="space-y-2">
              {loading ? (
                <div className="p-2 text-gray-400 text-sm">Loading...</div>
              ) : getTasksByPriority('urgent').length === 0 ? (
                <div className="p-2 text-gray-400 text-sm italic">No urgent tasks</div>
              ) : getTasksByPriority('urgent').slice(0, 2).map(task => (
                <div key={task.id} className="p-2 bg-white rounded-lg text-sm">{task.title}</div>
              ))}
            </div>
          </div>

          {/* Important, Not Urgent */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">Schedule</h4>
            <p className="text-xs text-blue-600 mb-3">Important, Not Urgent</p>
            <div className="space-y-2">
              {loading ? (
                <div className="p-2 text-gray-400 text-sm">Loading...</div>
              ) : getTasksByPriority('high').length === 0 ? (
                <div className="p-2 text-gray-400 text-sm italic">No high priority tasks</div>
              ) : getTasksByPriority('high').slice(0, 2).map(task => (
                <div key={task.id} className="p-2 bg-white rounded-lg text-sm">{task.title}</div>
              ))}
            </div>
          </div>

          {/* Urgent, Not Important */}
          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <h4 className="font-medium text-yellow-800 mb-2">Delegate</h4>
            <p className="text-xs text-yellow-600 mb-3">Urgent, Not Important</p>
            <div className="space-y-2">
              {loading ? (
                <div className="p-2 text-gray-400 text-sm">Loading...</div>
              ) : getTasksByPriority('medium').length === 0 ? (
                <div className="p-2 text-gray-400 text-sm italic">No medium priority tasks</div>
              ) : getTasksByPriority('medium').slice(0, 2).map(task => (
                <div key={task.id} className="p-2 bg-white rounded-lg text-sm">{task.title}</div>
              ))}
            </div>
          </div>

          {/* Neither */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">Eliminate</h4>
            <p className="text-xs text-gray-600 mb-3">Not Urgent, Not Important</p>
            <div className="space-y-2">
              {loading ? (
                <div className="p-2 text-gray-400 text-sm">Loading...</div>
              ) : getTasksByPriority('low').length === 0 ? (
                <div className="p-2 text-gray-400 text-sm italic">No low priority tasks</div>
              ) : getTasksByPriority('low').slice(0, 2).map(task => (
                <div key={task.id} className="p-2 bg-white rounded-lg text-sm">{task.title}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// PROJECTS SUBTAB
// --------------------------------------------------------------------------
const ProjectsView = () => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const PROJECT_TEMPLATES = [
    { id: 1, name: 'Product Launch', icon: RocketLaunchIcon, tasks: 15, duration: '4 weeks', color: 'blue' },
    { id: 2, name: 'Client Onboarding', icon: UserIcon, tasks: 8, duration: '1 week', color: 'green' },
    { id: 3, name: 'Feature Development', icon: CogIcon, tasks: 12, duration: '3 weeks', color: 'purple' },
    { id: 4, name: 'Marketing Campaign', icon: ChartBarIcon, tasks: 10, duration: '2 weeks', color: 'pink' },
    { id: 5, name: 'Documentation', icon: DocumentTextIcon, tasks: 6, duration: '1 week', color: 'orange' },
    { id: 6, name: 'Sprint Planning', icon: CalendarDaysIcon, tasks: 5, duration: '3 days', color: 'cyan' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Projects</h2>
            <p className="text-gray-500">Manage your projects and use templates for quick setup</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">
              <PlusIcon className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* AI Project Generator */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <SparklesIcon className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">AI Project Generator</h3>
            <p className="text-gray-600 mt-1">Describe your project and let AI create a complete plan</p>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                placeholder="e.g., 'Launch new product feature with beta testing'"
                className="flex-1 px-4 py-2.5 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
              />
              <button className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Projects */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Active Projects</h3>
        <div className="text-center py-12">
          <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h4>
          <p className="text-gray-500 mb-4">Create your first project to start organizing your tasks.</p>
          <p className="text-sm text-blue-600 bg-blue-50 inline-block px-4 py-2 rounded-lg">
            Project management features coming soon
          </p>
        </div>
      </div>

      {/* Project Templates */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Quick Start Templates</h3>
        <p className="text-gray-500 text-sm mb-4">Start a new project from a pre-configured template</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PROJECT_TEMPLATES.map(template => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-center group"
              >
                <div className={`w-10 h-10 mx-auto mb-2 rounded-lg bg-${template.color}-100 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 text-${template.color}-600`} />
                </div>
                <p className="font-medium text-gray-900 text-sm mb-1">{template.name}</p>
                <p className="text-xs text-gray-500">{template.tasks} tasks • {template.duration}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Project Activity</h3>
        <div className="space-y-3">
          {[
            { action: 'Task completed', project: 'Q4 Planning', task: 'Review Q4 budget proposal', time: '2 hours ago', icon: CheckCircleIcon, color: 'green' },
            { action: 'Comment added', project: 'Mobile App v2', task: 'Fix authentication bug', time: '4 hours ago', icon: ChatBubbleLeftRightIcon, color: 'blue' },
            { action: 'Task created', project: 'API Documentation', task: 'Document new endpoints', time: '1 day ago', icon: PlusIcon, color: 'purple' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`p-2 rounded-lg bg-${activity.color}-100`}>
                <activity.icon className={`w-4 h-4 text-${activity.color}-600`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.action}</span> in {activity.project}
                </p>
                <p className="text-xs text-gray-500">{activity.task}</p>
              </div>
              <span className="text-xs text-gray-400">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// AUTOMATIONS SUBTAB
// --------------------------------------------------------------------------
const AutomationsView = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const AUTOMATION_TEMPLATES = [
    { id: 1, name: 'Email to Task', description: 'Create task from important emails', trigger: 'New email from VIP', action: 'Create high-priority task', icon: EnvelopeIcon, color: 'red' },
    { id: 2, name: 'Slack Alerts', description: 'Never miss important mentions', trigger: '@mention in channels', action: 'Create task + notify', icon: ChatBubbleLeftRightIcon, color: 'purple' },
    { id: 3, name: 'Jira Sync', description: 'Keep Jira issues in sync', trigger: 'Issue assigned', action: 'Sync to schedule', icon: TicketIcon, color: 'blue' },
    { id: 4, name: 'Weekly Summary', description: 'Automated progress reports', trigger: 'Every Friday 6pm', action: 'Generate report', icon: ChartBarIcon, color: 'green' },
    { id: 5, name: 'Smart Scheduling', description: 'Optimize your free time', trigger: 'Free time > 2hrs', action: 'Schedule priority task', icon: CalendarDaysIcon, color: 'orange' },
    { id: 6, name: 'Deadline Alert', description: 'Never miss a deadline', trigger: '24hrs before due', action: 'Push notification', icon: ExclamationTriangleIcon, color: 'yellow' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Automations</h2>
            <p className="text-gray-500">Set up rules to automate your workflow</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: 4, icon: BoltIcon, color: 'blue' },
          { label: 'Tasks Created', value: 156, icon: ClipboardDocumentListIcon, color: 'green' },
          { label: 'Time Saved', value: '12h', icon: ClockIcon, color: 'purple' },
          { label: 'This Week', value: 23, icon: ArrowTrendingUpIcon, color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${stat.color}-100`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Automations */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Active Automations</h3>
        <div className="text-center py-12">
          <BoltIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Automations Yet</h4>
          <p className="text-gray-500 mb-4">Create your first automation to streamline your workflow.</p>
          <p className="text-sm text-blue-600 bg-blue-50 inline-block px-4 py-2 rounded-lg">
            Automation features coming soon
          </p>
        </div>
      </div>

      {/* Automation Templates */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Quick Setup Templates</h3>
        <p className="text-gray-500 text-sm mb-4">Start with a pre-configured automation</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUTOMATION_TEMPLATES.map(template => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-${template.color}-100 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 text-${template.color}-600`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    <div className="mt-2 text-xs text-gray-400">
                      <span className="text-blue-500">{template.trigger}</span>
                      <span className="mx-1">→</span>
                      <span className="text-green-500">{template.action}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Connected Services</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Gmail', icon: EnvelopeIcon, connected: true, color: 'red' },
            { name: 'Slack', icon: ChatBubbleLeftRightIcon, connected: true, color: 'purple' },
            { name: 'Jira', icon: TicketIcon, connected: false, color: 'blue' },
            { name: 'Google Calendar', icon: CalendarIcon, connected: true, color: 'green' },
          ].map((service, i) => (
            <div key={i} className={`p-4 rounded-xl border-2 ${service.connected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${service.color}-100`}>
                  <service.icon className={`w-5 h-5 text-${service.color}-600`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{service.name}</p>
                  <p className={`text-xs ${service.connected ? 'text-green-600' : 'text-gray-500'}`}>
                    {service.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {!service.connected && (
                <button className="mt-3 w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WorkAgent({ activeSubtab = 'inbox', activeInboxSubtab = 'email', activeTasksSubtab = 'backlog', activeToolsSubtab = 'notebook' }) {
  const { user } = useAuth();
  const [sharedTasks, setSharedTasks] = useState([]);

  const refreshTasks = useCallback(async () => {
    if (!user?.id) return;
    const data = await todos.getAll(user.id, { sort: 'prioritized', limit: 100 });
    setSharedTasks(data || []);
  }, [user?.id]);

  // Fetch on mount / user change
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const tasksCtx = useMemo(() => ({
    tasks: sharedTasks, setTasks: setSharedTasks, refreshTasks,
  }), [sharedTasks, refreshTasks]);

  const renderSubtabContent = () => {
    switch (activeSubtab) {
      case 'inbox':
        return <InboxView activeInboxSubtab={activeInboxSubtab} />;
      case 'tasks':
        return <TasksView activeSubTab={activeTasksSubtab} />;
      case 'schedule':
        return <ScheduleView />;
      case 'tools':
        // Render tools based on activeToolsSubtab
        switch (activeToolsSubtab) {
          case 'notebook':
          default:
            return <NotebookView />;
        }
      case 'insights':
        return <InsightsView />;
      case 'projects':
        return <ProjectsView />;
      case 'automations':
        return <AutomationsView />;
      default:
        return <InboxView activeInboxSubtab={activeInboxSubtab} />;
    }
  };

  return (
    <SharedTasksContext.Provider value={tasksCtx}>
      <div className="h-full flex flex-col overflow-hidden">
        {renderSubtabContent()}
      </div>
    </SharedTasksContext.Provider>
  );
}
