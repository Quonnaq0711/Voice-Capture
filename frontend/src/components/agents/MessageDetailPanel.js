/**
 * WorkAgent Component - Enterprise Work Management System
 *
 * 6 Subtabs Architecture:
 * 1. Inbox - Unified message center (Gmail, Slack, Jira notifications) with AI
 * 2. Tasks - Multi-source task center (Gmail, Slack, Jira, Calendar, Manual)
 * 3. Schedule - Calendar with AI scheduling
 * 4. Insights - Action Explorer and decision support
 * 5. Projects - Project templates and mini-projects
 * 6. Automations - Rule-based automation center
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  StarIcon as StarSolidIcon,
  FlagIcon as FlagSolidIcon,
  EnvelopeIcon as EnvelopeSolidIcon,
  InboxIcon as InboxSolidIcon,
} from '@heroicons/react/24/solid';
import { oauth, gmail, calendar as calendarApi, sources as sourcesApi, emailAI } from '../../services/workApi';
import MessageRenderer from '../chat/MessageRenderer';
import { toast } from 'react-toastify';

// ============================================================================
// CONSTANTS
// ============================================================================

// Static CSS for email HTML rendering — defined once to avoid re-injecting on every render
const EMAIL_HTML_STYLES = `
.email-html-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.email-html-content img {
  max-width: 100%;
  height: auto;
  display: inline-block;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.email-html-content img:hover {
  opacity: 0.9;
}
.email-html-content table {
  border-collapse: collapse;
  max-width: 100%;
}
.email-html-content td, .email-html-content th {
  padding: 8px;
  vertical-align: top;
}
.email-html-content a {
  color: #1a73e8;
  text-decoration: none;
}
.email-html-content a:hover {
  text-decoration: underline;
}
.email-html-content blockquote {
  border-left: 3px solid #dadce0;
  margin: 0 0 0 8px;
  padding-left: 12px;
  color: #5f6368;
}
.email-html-content h1, .email-html-content h2, .email-html-content h3 {
  margin: 16px 0 8px 0;
  font-weight: 600;
}
.email-html-content p {
  margin: 0 0 12px 0;
}
.email-html-content ul, .email-html-content ol {
  margin: 0 0 12px 0;
  padding-left: 24px;
}
.email-html-content li {
  margin-bottom: 4px;
}
.email-html-content hr {
  border: none;
  border-top: 1px solid #dadce0;
  margin: 16px 0;
}
.email-html-content pre {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: monospace;
}
.email-html-content code {
  background: #f1f3f4;
  padding: 2px 4px;
  border-radius: 2px;
  font-family: monospace;
  font-size: 13px;
}`;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract only the latest reply from an email thread.
 * Strips quoted reply history so the content stays short enough for
 * the GET-based streaming endpoint (EventSource URL length limits)
 * and avoids exceeding LLM context windows.
 */
const extractLatestReply = (content) => {
  if (!content) return '';

  // Reply-chain separator patterns (single-line, tested per line)
  const separatorPatterns = [
    /^On .+wrote:\s*$/i,                                // Gmail / Apple Mail
    /^-{3,}\s*Original Message\s*-{3,}/i,              // Outlook
    /^_{3,}\s*$/,                                       // Outlook underscores
    /^-{5,}\s*Forwarded message\s*-{5,}/i,             // Gmail forwarded
    /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s.+<.+@.+>\s*:?\s*$/, // date + sender
    /^Sent from (?:my |Mail for |Outlook)/i,            // mobile signatures
  ];

  const lines = content.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip already-quoted lines
    if (trimmed.startsWith('>')) continue;

    // Check single-line separator patterns
    let isSeparator = false;
    for (const pat of separatorPatterns) {
      if (pat.test(trimmed)) { isSeparator = true; break; }
    }

    // Two-line "On ...\n... wrote:" check (Gmail wraps long lines)
    if (!isSeparator && trimmed.toLowerCase().startsWith('on ') && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (next.endsWith('wrote:') || next.endsWith('wrote: ')) {
        isSeparator = true;
      }
    }

    // Two-line "From: <email>\nSent: <date>" check (Outlook forwarded)
    if (!isSeparator && /^From:\s+.+@/i.test(trimmed) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^(Sent|Date):\s+/i.test(next)) {
        isSeparator = true;
      }
    }

    if (isSeparator) break;
    result.push(line);
  }

  return result.join('\n').trim();
};

/**
 * Sanitize HTML email content — remove dangerous elements while keeping
 * inline styles needed for proper email formatting.
 * Defined at module level so it can be used inside useMemo without
 * being recreated on every render.
 */
const sanitizeEmailHtml = (html, attachments) => {
  let sanitized = html
    // Remove dangerous elements
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    // Remove event handlers
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Remove external style blocks (can break page layout)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Handle cid: references (inline embedded images)
  if (attachments && attachments.length > 0) {
    sanitized = sanitized.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (match, contentId) => {
      const attachment = attachments.find(att =>
        att.content_id === contentId ||
        att.content_id === `<${contentId}>` ||
        att.contentId === contentId
      );
      if (attachment && attachment.data) {
        const mimeType = attachment.mime_type || attachment.mimeType || 'image/png';
        return `src="data:${mimeType};base64,${attachment.data}"`;
      }
      return match;
    });
  }

  // Convert protocol-relative and http URLs to https
  sanitized = sanitized.replace(/src\s*=\s*["']\/\/([^"']+)["']/gi, 'src="https://$1"');
  sanitized = sanitized.replace(/src\s*=\s*["']http:\/\/([^"']+)["']/gi, 'src="https://$1"');

  return sanitized;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUBTABS = [
  { id: 'tasks', name: 'Tasks', icon: ClipboardDocumentListIcon, description: 'All your tasks from every source' },
  { id: 'schedule', name: 'Scheduler', icon: CalendarDaysIcon, description: 'Calendar & AI scheduling' },
  { id: 'insights', name: 'Insights', icon: LightBulbIcon, description: 'Action analysis & decisions' },
  { id: 'projects', name: 'Projects', icon: FolderIcon, description: 'Project templates & tracking' },
  { id: 'automations', name: 'Automations', icon: CogIcon, description: 'Automated workflows' },
];

const TASK_SOURCES = [
  { id: 'all', name: 'All Sources', icon: Squares2X2Icon, color: 'gray' },
  { id: 'gmail', name: 'Gmail', icon: EnvelopeIcon, color: 'red' },
  { id: 'slack', name: 'Slack', icon: ChatBubbleLeftRightIcon, color: 'purple' },
  { id: 'jira', name: 'Jira', icon: TicketIcon, color: 'blue' },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon, color: 'green' },
  { id: 'manual', name: 'Manual', icon: UserIcon, color: 'orange' },
];

const PRIORITIES = {
  urgent: { label: 'Urgent', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  high: { label: 'High', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  low: { label: 'Low', color: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
};

const KANBAN_COLUMNS = [
  { id: 'backlog', name: 'Backlog', color: 'gray' },
  { id: 'todo', name: 'To Do', color: 'blue' },
  { id: 'in_progress', name: 'In Progress', color: 'yellow' },
  { id: 'review', name: 'Review', color: 'purple' },
  { id: 'done', name: 'Done', color: 'green' },
];

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_TASKS = [
  { id: 1, title: 'Review Q4 budget proposal', description: 'Finance team needs feedback by Friday', priority: 'urgent', status: 'todo', source: 'gmail', dueDate: '2024-12-11', project: 'Q4 Planning', tags: ['finance', 'review'] },
  { id: 2, title: 'Prepare presentation for client meeting', description: 'Include latest metrics and roadmap', priority: 'high', status: 'in_progress', source: 'slack', dueDate: '2024-12-12', project: 'Client A', tags: ['presentation', 'client'] },
  { id: 3, title: 'Fix authentication bug in mobile app', description: 'Users reporting login failures on iOS', priority: 'urgent', status: 'in_progress', source: 'jira', dueDate: '2024-12-10', project: 'Mobile App', tags: ['bug', 'mobile'] },
  { id: 4, title: 'Team standup meeting', description: 'Daily sync with engineering team', priority: 'medium', status: 'todo', source: 'calendar', dueDate: '2024-12-10', project: null, tags: ['meeting'] },
  { id: 5, title: 'Update documentation for API v2', description: 'Document new endpoints and deprecations', priority: 'medium', status: 'backlog', source: 'manual', dueDate: '2024-12-15', project: 'API v2', tags: ['docs', 'api'] },
  { id: 6, title: 'Code review for feature branch', description: 'Review PR #234 - new dashboard widgets', priority: 'high', status: 'review', source: 'slack', dueDate: '2024-12-11', project: 'Dashboard', tags: ['review', 'code'] },
  { id: 7, title: 'Respond to customer support tickets', description: '5 pending tickets need attention', priority: 'medium', status: 'todo', source: 'gmail', dueDate: '2024-12-10', project: null, tags: ['support'] },
  { id: 8, title: 'Deploy staging environment', description: 'Prepare for QA testing next week', priority: 'low', status: 'backlog', source: 'jira', dueDate: '2024-12-16', project: 'DevOps', tags: ['deploy', 'staging'] },
  { id: 9, title: 'Write blog post about new features', description: 'Marketing requested for launch', priority: 'low', status: 'done', source: 'manual', dueDate: '2024-12-08', project: 'Marketing', tags: ['content', 'marketing'] },
  { id: 10, title: 'Security audit review meeting', description: 'Review findings from external audit', priority: 'high', status: 'done', source: 'calendar', dueDate: '2024-12-09', project: 'Security', tags: ['security', 'meeting'] },
];

const MOCK_CALENDAR_EVENTS = [
  { id: 1, title: 'Team Standup', start: '09:00', end: '09:30', type: 'meeting', color: 'blue' },
  { id: 2, title: 'Deep Work Block', start: '10:00', end: '12:00', type: 'focus', color: 'purple' },
  { id: 3, title: 'Lunch Break', start: '12:00', end: '13:00', type: 'break', color: 'gray' },
  { id: 4, title: 'Client Call', start: '14:00', end: '15:00', type: 'meeting', color: 'green' },
  { id: 5, title: 'Code Review', start: '15:30', end: '16:30', type: 'task', color: 'orange' },
  { id: 6, title: 'Planning Session', start: '16:30', end: '17:30', type: 'meeting', color: 'blue' },
];

const MOCK_PROJECTS = [
  { id: 1, name: 'Q4 Planning', status: 'active', progress: 65, tasks: 12, completed: 8, dueDate: '2024-12-31', members: 4, color: 'blue' },
  { id: 2, name: 'Mobile App v2', status: 'active', progress: 40, tasks: 24, completed: 10, dueDate: '2025-01-15', members: 6, color: 'purple' },
  { id: 3, name: 'API Documentation', status: 'active', progress: 80, tasks: 8, completed: 6, dueDate: '2024-12-20', members: 2, color: 'green' },
  { id: 4, name: 'Security Audit', status: 'completed', progress: 100, tasks: 15, completed: 15, dueDate: '2024-12-09', members: 3, color: 'red' },
];

const MOCK_AUTOMATIONS = [
  { id: 1, name: 'Email to Task', trigger: 'New email from VIP contacts', action: 'Create high-priority task', enabled: true, runs: 156 },
  { id: 2, name: 'Slack Mention Alert', trigger: '@mention in #urgent channel', action: 'Create task + push notification', enabled: true, runs: 89 },
  { id: 3, name: 'Jira Sync', trigger: 'Issue assigned to me', action: 'Sync to Schedule', enabled: true, runs: 234 },
  { id: 4, name: 'Weekly Summary', trigger: 'Every Friday at 6pm', action: 'Generate weekly report', enabled: true, runs: 12 },
  { id: 5, name: 'Idle Time Optimizer', trigger: 'Free time > 2 hours', action: 'Schedule highest priority task', enabled: false, runs: 45 },
];

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

// Note: Static mock messages removed - now using real data from connected accounts only

const MOCK_MESSAGES_REMOVED = [
  {
    id: 1,
    source: 'gmail',
    type: 'email',
    from: { name: 'Sarah Chen', email: 'sarah.chen@acmecorp.com', avatar: null, isVIP: true },
    to: ['me'],
    subject: 'Q4 Budget Review - Action Required',
    preview: 'Hi team, Please review the attached Q4 budget proposal and provide your feedback by Friday. We need to finalize...',
    body: `Hi team,

Please review the attached Q4 budget proposal and provide your feedback by Friday. We need to finalize the numbers before the board meeting next week.

Key points to review:
1. Marketing spend increase (+15%)
2. Engineering headcount projections
3. Infrastructure costs for cloud migration

Let me know if you have any questions.

Best regards,
Sarah`,
    timestamp: '2024-12-11T09:30:00',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [{ name: 'Q4_Budget_Proposal.xlsx', size: '2.4 MB', type: 'spreadsheet' }],
    category: 'action_required',
    categoryConfidence: 94,
    priority: 'high',
    thread: { count: 3, participants: ['Sarah Chen', 'Mike Johnson', 'You'] },
    aiSummary: {
      short: 'Budget review needed by Friday for board meeting.',
      standard: 'Sarah requests feedback on Q4 budget proposal focusing on marketing spend (+15%), engineering headcount, and cloud infrastructure costs. Deadline: Friday before board meeting.',
      detailed: 'Finance team lead Sarah Chen is requesting review of the Q4 budget proposal. Three key areas need attention: 1) Marketing budget increase of 15%, 2) Engineering team headcount projections for next quarter, 3) Infrastructure costs related to the ongoing cloud migration project. Response required by end of Friday to allow time for revisions before the upcoming board meeting.',
    },
    suggestedActions: ['Review attachment', 'Schedule review meeting', 'Reply with feedback'],
  },
  {
    id: 2,
    source: 'slack',
    type: 'thread',
    channel: '#engineering',
    from: { name: 'Alex Rivera', username: '@alex.rivera', avatar: null, isVIP: false },
    subject: 'Mentioned you in #engineering',
    preview: '@you Can you review the PR #234 for the new dashboard widgets? Need your input on the state management approach.',
    body: '@you Can you review the PR #234 for the new dashboard widgets? Need your input on the state management approach. The team is blocked on this.',
    timestamp: '2024-12-11T10:15:00',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    category: 'action_required',
    categoryConfidence: 88,
    priority: 'high',
    thread: { count: 5, participants: ['Alex Rivera', 'Emma Watson', 'You', 'Dev Team'] },
    reactions: [{ emoji: '👀', count: 2 }, { emoji: '🔥', count: 1 }],
    aiSummary: {
      short: 'PR #234 code review requested - team blocked.',
      standard: 'Alex needs your review on PR #234 for dashboard widgets. Focus on state management approach. Team is currently blocked waiting for this review.',
      detailed: 'Engineering team member Alex Rivera has requested an urgent code review for Pull Request #234, which implements new dashboard widgets. The specific area requiring attention is the state management architecture. This is a blocking issue for the team, suggesting it should be prioritized.',
    },
    suggestedActions: ['Open PR #234', 'Reply in thread', 'Create review task'],
  },
  {
    id: 3,
    source: 'gmail',
    type: 'email',
    from: { name: 'Jennifer Wu', email: 'j.wu@clienta.io', avatar: null, isVIP: true },
    to: ['me'],
    subject: 'Re: Project Timeline Discussion',
    preview: 'Thanks for the update! The new timeline looks reasonable. Could we schedule a quick call tomorrow to discuss the...',
    body: `Thanks for the update! The new timeline looks reasonable.

Could we schedule a quick call tomorrow to discuss the resource allocation for Phase 2? I want to make sure we're aligned before the kickoff.

Available times:
- Tomorrow 2:00 PM - 3:00 PM
- Tomorrow 4:00 PM - 5:00 PM

Let me know what works for you.

Jennifer`,
    timestamp: '2024-12-11T08:45:00',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    category: 'meeting',
    categoryConfidence: 91,
    priority: 'medium',
    thread: { count: 4, participants: ['Jennifer Wu', 'You'] },
    aiSummary: {
      short: 'Client wants to schedule call about Phase 2 resources.',
      standard: 'Jennifer Wu (Client A) accepts the new timeline and requests a meeting tomorrow (2-3 PM or 4-5 PM) to discuss Phase 2 resource allocation before kickoff.',
      detailed: 'VIP client Jennifer Wu from Client A has responded positively to the project timeline update. She is requesting a meeting tomorrow to discuss resource allocation for the upcoming Phase 2. Two time slots are proposed: 2:00-3:00 PM or 4:00-5:00 PM. The purpose is to ensure alignment before the Phase 2 kickoff.',
    },
    suggestedActions: ['Accept 2 PM slot', 'Propose alternate time', 'Add to calendar'],
  },
  {
    id: 4,
    source: 'jira',
    type: 'notification',
    from: { name: 'Jira', avatar: null },
    subject: 'PROJ-456 assigned to you',
    preview: 'High priority bug: Authentication fails on iOS 17.2 devices. Users report being logged out after app backgrounding.',
    body: `Issue: PROJ-456
Type: Bug
Priority: High
Reporter: QA Team

Description:
Authentication fails on iOS 17.2 devices. Users report being logged out after app backgrounding for more than 5 minutes. This affects approximately 15% of our mobile user base.

Steps to Reproduce:
1. Login to the app on iOS 17.2
2. Background the app for 5+ minutes
3. Return to app
4. User is logged out

Expected: User should remain logged in
Actual: User is logged out and session is invalidated`,
    timestamp: '2024-12-11T07:20:00',
    isRead: true,
    isStarred: true,
    hasAttachments: false,
    category: 'action_required',
    categoryConfidence: 96,
    priority: 'urgent',
    issueKey: 'PROJ-456',
    issueType: 'bug',
    aiSummary: {
      short: 'Critical iOS 17.2 auth bug affecting 15% of users.',
      standard: 'High priority bug assigned: iOS 17.2 users are logged out after backgrounding the app for 5+ minutes. Affects 15% of mobile users. Needs immediate attention.',
      detailed: 'A high-priority bug has been assigned regarding authentication failures on iOS 17.2 devices. The issue causes users to be logged out when the app is backgrounded for more than 5 minutes, with sessions being invalidated. Impact assessment shows this affects approximately 15% of the mobile user base. Steps to reproduce have been documented by the QA team.',
    },
    suggestedActions: ['View in Jira', 'Create fix branch', 'Assign to sprint'],
  },
  {
    id: 5,
    source: 'gmail',
    type: 'email',
    from: { name: 'TechNews Weekly', email: 'newsletter@technews.com', avatar: null, isVIP: false },
    to: ['me'],
    subject: 'This Week in Tech: AI Breakthroughs and More',
    preview: 'Top stories: New GPT-5 rumors, Apple Vision Pro updates, and the latest in quantum computing research...',
    body: 'Newsletter content...',
    timestamp: '2024-12-11T06:00:00',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    category: 'newsletter',
    categoryConfidence: 99,
    priority: 'low',
    aiSummary: {
      short: 'Weekly tech newsletter - AI and hardware news.',
      standard: 'TechNews Weekly newsletter covering GPT-5 rumors, Apple Vision Pro updates, and quantum computing research developments.',
      detailed: 'Regular weekly technology newsletter from TechNews covering major industry developments including speculation about GPT-5, updates on Apple Vision Pro, and recent advances in quantum computing research.',
    },
    suggestedActions: ['Read later', 'Archive', 'Unsubscribe'],
  },
  {
    id: 6,
    source: 'slack',
    type: 'direct',
    from: { name: 'Mike Johnson', username: '@mike.j', avatar: null, isVIP: false },
    subject: 'Direct message from Mike Johnson',
    preview: 'Hey! Quick question - do you have the credentials for the staging environment? Need to test the new deployment.',
    body: 'Hey! Quick question - do you have the credentials for the staging environment? Need to test the new deployment.',
    timestamp: '2024-12-11T10:45:00',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    category: 'action_required',
    categoryConfidence: 72,
    priority: 'medium',
    aiSummary: {
      short: 'Mike needs staging environment credentials.',
      standard: 'Mike Johnson is requesting staging environment credentials for testing a new deployment.',
      detailed: 'Team member Mike Johnson has sent a direct message requesting access credentials for the staging environment. The purpose is to test a new deployment. This may require sharing sensitive information through secure channels.',
    },
    suggestedActions: ['Share via 1Password', 'Reply with instructions', 'Schedule call'],
  },
  {
    id: 7,
    source: 'work_agent',
    type: 'notification',
    from: { name: 'Work Agent', avatar: null },
    subject: 'Daily Summary Ready',
    preview: 'Your daily productivity summary is ready. You completed 8 tasks yesterday and have 5 high-priority items pending.',
    body: `Daily Summary - December 10, 2024

Completed Yesterday:
✅ 8 tasks completed
✅ 3 meetings attended
✅ 12 emails processed

Pending Today:
⚠️ 5 high-priority tasks
📅 4 meetings scheduled
📧 23 unread messages

Focus Recommendation:
Based on your calendar, you have a 2-hour deep work window from 10 AM to 12 PM. Consider tackling the iOS authentication bug during this time.`,
    timestamp: '2024-12-11T07:00:00',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    category: 'fyi',
    categoryConfidence: 100,
    priority: 'low',
    aiSummary: {
      short: 'Yesterday: 8 tasks done. Today: 5 high-priority pending.',
      standard: 'Daily summary shows 8 tasks completed yesterday. Today has 5 high-priority tasks, 4 meetings, and 23 unread messages. Recommended focus time: 10 AM - 12 PM.',
      detailed: 'System-generated daily productivity summary. Yesterday\'s accomplishments include 8 completed tasks, 3 meetings, and 12 processed emails. Today\'s pending items include 5 high-priority tasks, 4 scheduled meetings, and 23 unread messages. AI recommends using the 10 AM - 12 PM deep work window for the iOS authentication bug fix.',
    },
    suggestedActions: ['View full report', 'Adjust schedule', 'Start focus mode'],
  },
  // Outlook Messages
  {
    id: 8,
    source: 'outlook',
    type: 'email',
    from: { name: 'David Park', email: 'david.park@partnercorp.com', avatar: null, isVIP: true },
    to: ['me'],
    subject: 'Partnership Agreement Draft - Review Needed',
    preview: 'Hi, Please find attached the draft partnership agreement. Legal has reviewed and we need your sign-off before Friday...',
    body: `Hi,

Please find attached the draft partnership agreement. Legal has reviewed and we need your sign-off before Friday to meet the Q1 launch timeline.

Key terms:
- Revenue share: 70/30 split
- Territory: North America and Europe
- Duration: 2 years with renewal option

Please review Section 4.2 (Exclusivity) carefully as this has implications for our other partnerships.

Thanks,
David`,
    timestamp: '2024-12-11T11:30:00',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [{ name: 'Partnership_Agreement_Draft_v3.pdf', size: '1.8 MB', type: 'pdf' }],
    category: 'legal',
    categoryConfidence: 92,
    priority: 'high',
    thread: { count: 2, participants: ['David Park', 'You'] },
    aiSummary: {
      short: 'Partnership agreement draft needs review by Friday.',
      standard: 'David Park (Partner Corp) sent partnership agreement draft requiring sign-off by Friday. Key terms: 70/30 revenue split, NA+EU territory, 2-year duration. Focus on Section 4.2 (Exclusivity).',
      detailed: 'VIP contact David Park from Partner Corp has sent the third revision of the partnership agreement draft. Legal has completed their review. Key terms include a 70/30 revenue split in your favor, coverage for North America and Europe, and a 2-year initial term with renewal options. Special attention is requested for Section 4.2 regarding exclusivity provisions due to potential conflicts with existing partnerships. Sign-off deadline is Friday to meet Q1 launch commitments.',
    },
    suggestedActions: ['Review attachment', 'Forward to legal', 'Schedule call with David'],
  },
  {
    id: 9,
    source: 'outlook',
    type: 'email',
    from: { name: 'HR Department', email: 'hr@company.com', avatar: null, isVIP: false },
    to: ['all-staff'],
    subject: 'Reminder: Year-End Performance Reviews Due Dec 15',
    preview: 'This is a reminder that all year-end performance reviews must be submitted by December 15th. Please ensure...',
    body: `Dear Team,

This is a friendly reminder that year-end performance reviews must be submitted by December 15th.

Action Required:
1. Complete self-assessment
2. Submit peer feedback (if applicable)
3. Schedule 1:1 with your manager

Resources are available on the HR portal.

Best regards,
HR Department`,
    timestamp: '2024-12-11T08:00:00',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    category: 'action_required',
    categoryConfidence: 85,
    priority: 'medium',
    aiSummary: {
      short: 'Performance reviews due Dec 15.',
      standard: 'HR reminder: Year-end performance reviews due December 15. Complete self-assessment, peer feedback, and schedule manager 1:1.',
      detailed: 'Company-wide HR reminder about year-end performance review deadline. Three required actions: complete self-assessment form, submit peer feedback if applicable to your role, and schedule a one-on-one meeting with your direct manager. All materials available on the HR portal. Deadline is December 15th.',
    },
    suggestedActions: ['Open HR portal', 'Schedule manager meeting', 'Add to calendar'],
  },
  // Microsoft Teams Messages
  {
    id: 10,
    source: 'teams',
    type: 'channel',
    channel: 'Product Team',
    from: { name: 'Lisa Wang', username: '@lisa.wang', avatar: null, isVIP: false },
    subject: 'New message in Product Team',
    preview: '@team Quick update on the roadmap changes. We need to reprioritize Q1 features based on customer feedback...',
    body: `@team Quick update on the roadmap changes.

Based on customer feedback from last week's survey, we need to reprioritize Q1 features:

🔴 P0 (Must Have):
- API rate limiting improvements
- Dashboard performance fixes

🟡 P1 (Should Have):
- New reporting module
- Mobile app updates

Can everyone review and add comments by EOD? We have the planning meeting tomorrow at 2 PM.`,
    timestamp: '2024-12-11T09:15:00',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    category: 'action_required',
    categoryConfidence: 80,
    priority: 'high',
    thread: { count: 8, participants: ['Lisa Wang', 'Product Team', 'You'] },
    reactions: [{ emoji: '👍', count: 4 }, { emoji: '👀', count: 2 }],
    aiSummary: {
      short: 'Q1 roadmap reprioritization - feedback needed by EOD.',
      standard: 'Lisa shared Q1 roadmap changes based on customer feedback. P0: API rate limiting, dashboard performance. P1: reporting module, mobile updates. Comments needed by EOD for tomorrow\'s 2 PM planning meeting.',
      detailed: 'Product Team lead Lisa Wang has posted roadmap updates following customer feedback analysis. Q1 priorities have been restructured with two P0 (must-have) items: API rate limiting improvements and dashboard performance fixes. P1 (should-have) items include a new reporting module and mobile app updates. Team input is requested by end of day to prepare for the planning meeting scheduled for tomorrow at 2 PM.',
    },
    suggestedActions: ['Add comments', 'Join planning meeting', 'Review customer feedback'],
  },
  {
    id: 11,
    source: 'teams',
    type: 'direct',
    from: { name: 'Tom Chen', username: '@tom.chen', avatar: null, isVIP: false },
    subject: 'Direct message from Tom Chen',
    preview: 'Hey, are you available for a quick sync? I have some concerns about the timeline we discussed yesterday.',
    body: 'Hey, are you available for a quick sync? I have some concerns about the timeline we discussed yesterday. The dependencies on the backend team might cause delays.',
    timestamp: '2024-12-11T10:30:00',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    category: 'meeting',
    categoryConfidence: 75,
    priority: 'medium',
    aiSummary: {
      short: 'Tom wants to discuss timeline concerns.',
      standard: 'Tom Chen requesting sync to discuss timeline concerns. Worried about backend team dependencies causing potential delays.',
      detailed: 'Team member Tom Chen has reached out via direct message to request a synchronization meeting. The topic of concern is the project timeline discussed in a previous meeting, specifically potential delays due to dependencies on the backend development team.',
    },
    suggestedActions: ['Start call', 'Propose meeting time', 'Reply with availability'],
  },
];

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
// Helper functions
const getSourceIcon = (source) => {
  const icons = {
    // Email
    gmail: EnvelopeIcon,
    outlook: EnvelopeIcon,
    // Team Chat
    slack: HashtagIcon,
    teams: ChatBubbleLeftRightIcon,
    // Project Management
    jira: TicketIcon,
    // System
    work_agent: SparklesIcon,
  };
  return icons[source] || InboxIcon;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function MessageDetailPanel({
  message,
  bodyLoading = false,
  selectedFolder,
  handleReply,
  handleReplyAll,
  handleForward,
  handleArchiveMessage,
  handleUntrashMessage,
  handleTrashMessage,
  handleStarMessage,
  actionLoading,
  onCreateTask,
}) {
  const { user } = useAuth();

  // Local state (migrated from InboxView to prevent re-renders of parent)
  const [recipientsExpanded, setRecipientsExpanded] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [translationStreamingText, setTranslationStreamingText] = useState('');
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showAIComposer, setShowAIComposer] = useState(false);
  const [composerMode, setComposerMode] = useState('reply'); // 'reply' or 'polish'
  const [replyInstructions, setReplyInstructions] = useState('');
  const [composerText, setComposerText] = useState('');
  const [selectedTone, setSelectedTone] = useState('formal');
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);

  // Ref to track active EventSource (summarize/translate streams) for cleanup on message change
  const activeEventSourceRef = useRef(null);

  // Memoize expensive email body sanitization — only recompute when message content changes
  const sanitizedEmailBody = useMemo(() => {
    if (!message) return null;
    const htmlContent = message.body_html || '';
    const plainContent = message.body_plain || message.body || message.preview || '';
    const hasHtmlBody = Boolean(htmlContent);
    const bodyLooksLikeHtml = !hasHtmlBody && /<[a-z][\s\S]*>/i.test(plainContent);
    const isHTML = hasHtmlBody || bodyLooksLikeHtml || message.is_html;
    const content = hasHtmlBody ? htmlContent : plainContent;

    if (isHTML && content) {
      return { isHTML: true, html: sanitizeEmailHtml(content, message.attachments), plain: null };
    }
    return { isHTML: false, html: null, plain: content };
  }, [message?.id, message?.body_html, message?.body, message?.body_plain, message?.attachments]);

  // Stable image-click handler for the email content area
  const handleEmailContentClick = useCallback((e) => {
    if (e.target.tagName === 'IMG') {
      const img = e.target;
      if (img.naturalWidth > 50 && img.naturalHeight > 50) {
        setLightboxImage({ src: img.src, alt: img.alt || 'Email image' });
      }
    }
  }, []);

  // Handle attachment download
  const handleDownloadAttachment = useCallback(async (attachment) => {
    if (!message || !user?.id) return;

    const accountId = message.accountId || message.account_id;
    if (!accountId) {
      toast.error('Unable to download: Account not found');
      return;
    }

    // Use attachment_id as the unique identifier for loading state
    const attachmentKey = attachment.attachment_id || attachment.name;
    setDownloadingAttachmentId(attachmentKey);

    try {
      await gmail.downloadAttachment(message.id, attachment, accountId, user.id);
      toast.success(`Downloaded: ${attachment.name}`);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error(`Failed to download ${attachment.name}`);
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, [message, user?.id]);

  // Tones with Emojis
  const AI_TONES = [
    { id: 'formal', name: 'Professional', emoji: '👔' },
    { id: 'casual', name: 'Friendly', emoji: '👋' },
    { id: 'urgent', name: 'Direct/Urgent', emoji: '⏩' },
    { id: 'empathetic', name: 'Empathetic', emoji: '❤️' },
  ];

  // Ref for translation menu
  const translateMenuRef = useRef(null);

  // Click outside handler for translation menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (translateMenuRef.current && !translateMenuRef.current.contains(event.target)) {
        setAiInsights(prev => {
          if (prev?.showTranslateMenu) {
            return { ...prev, showTranslateMenu: false };
          }
          return prev;
        });
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset state when message changes — close any active AI stream
  useEffect(() => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }
    setAiInsights(null);
    setShowAIInsights(false);
    setStreamingText('');
    setTranslationStreamingText('');
    setAiInsightsLoading(null);
    setShowAIComposer(false);
    setComposerText('');
    setRecipientsExpanded(false);
    setShowSnoozeMenu(false);
  }, [message?.id]);

  // AI Assistant Handlers
  const generateAIReply = async () => {
    if (!replyInstructions.trim()) return;

    setAiInsightsLoading('drafting');
    setComposerText('');

    const senderName = user?.name || 'Me';
    const recipientName = message.from.name || message.from.email.split('@')[0];
    const context = message.body_plain || message.body || '';

    try {
      emailAI.draftStream(
        replyInstructions + ` Tone: ${selectedTone}`,
        context,
        senderName,
        recipientName,
        (token) => {
          setComposerText(prev => prev + token);
        },
        (completeText) => {
          setAiInsightsLoading(null);
        },
        (error) => {
          console.error('Drafting failed:', error);
          setAiInsightsLoading(null);
          toast.error('Failed to generate draft.');
        }
      );
    } catch (e) {
      console.error(e);
      setAiInsightsLoading(null);
    }
  };

  const handlePolish = (goal) => {
    if (!composerText) return;
    setAiInsightsLoading('polishing');
    const originalText = composerText;
    setComposerText('');

    emailAI.polishStream(
      originalText,
      selectedTone,
      goal,
      (token) => setComposerText(prev => prev + token),
      () => setAiInsightsLoading(null),
      (err) => {
        console.error(err);
        setComposerText(originalText);
        setAiInsightsLoading(null);
      }
    );
  };

  const handleInsertDraft = () => {
    handleReply({
      ...message,
      aiDraft: composerText
    });
    setShowAIComposer(false);
  };

  const handleApplyPolish = () => {
    navigator.clipboard.writeText(composerText);
    toast.success('Polished text copied to clipboard!');
    setShowAIComposer(false);
  };

  if (!message) {
    return (
      <div className="h-full flex items-center justify-center bg-sky-950 text-slate-400">
        <div className="text-center px-8">
          <EnvelopeOpenIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-500 ">Select a message to view</p>
          <p className="text-sm ">Click on any message from the list</p>
        </div>
      </div>
    );
  }

  const SourceIcon = getSourceIcon(message.source);
  const CategoryInfo = MESSAGE_CATEGORIES[message.category];

  // Helper function to format recipient with consistent display
  // Collapsed: show only name (or derive from email)
  // Expanded: always show "Name <email>" format
  // If recipient email matches accountEmail, show "me" instead of name
 const formatRecipient = (recipient, showEmail = false, accountEmail = null) => {
  if (!recipient) return '';

  let name = '';
  let email = '';

  const parts = recipient.match(/^([^<]*)<([^>]+)>/);
  if (parts) {
    name = parts[1].trim();
    email = parts[2].trim();
    if (!name) name = email.split('@')[0].replace(/[._-]/g, ' ');
  } else {
    email = recipient.trim();
    name = email.split('@')[0].replace(/[._-]/g, ' ');
  }

  const isMe = accountEmail && email.toLowerCase() === accountEmail.toLowerCase();
  const displayName = isMe ? 'me' : name;

  return showEmail && !isMe ? `${displayName} <${email}>` : displayName;
};

  return (
    <div className="h-full flex flex-col bg-sky-950 overflow-hidden">
      {/* Gmail-Style Header with Actions */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        {/* Action Toolbar - Gmail Style Compact */}
        <div className="px-2 py-1 flex items-center justify-end border-b border-gray-100">
          <div className="flex items-center">
            {/* Reply */}
            <button
              onClick={() => handleReply(message)}
              className="p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors"
              title="Reply"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            {/* Reply All */}
            <button
              onClick={() => handleReplyAll(message)}
              className="p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors"
              title="Reply all"
            >
              <ArrowPathRoundedSquareIcon className="w-4 h-4" />
            </button>
            {/* Forward */}
            <button
              onClick={() => handleForward(message)}
              className="p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors"
              title="Forward"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>

            {/* Separator */}
            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Create Task from Email */}
            {onCreateTask && (
              <button
                onClick={() => onCreateTask(message)}
                className="p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors"
                title="Create Task from Email"
              >
                <ClipboardDocumentListIcon className="w-4 h-4" />
              </button>
            )}

            {/* Separator */}
            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Archive button - only show if not in trash/archive */}
            {selectedFolder !== 'TRASH' && selectedFolder !== 'ARCHIVE' && (
              <button
                onClick={() => handleArchiveMessage(message)}
                disabled={actionLoading === 'archive'}
                className={`p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors ${actionLoading === 'archive' ? 'opacity-50' : ''
                  }`}
                title="Archive"
              >
                <ArchiveBoxIcon className="w-4 h-4" />
              </button>
            )}
            {/* Delete/Restore button */}
            {selectedFolder === 'TRASH' ? (
              <button
                onClick={() => handleUntrashMessage(message)}
                disabled={actionLoading === 'untrash'}
                className={`p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors ${actionLoading === 'untrash' ? 'opacity-50' : ''
                  }`}
                title="Move to Inbox"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleTrashMessage(message)}
                disabled={actionLoading === 'trash'}
                className={`p-1.5 text-slate-300 hover:bg-white/10 rounded-full transition-colors ${actionLoading === 'trash' ? 'opacity-50' : ''
                  }`}
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
            {/* Star button */}
            <button
              onClick={() => handleStarMessage(message)}
              disabled={actionLoading === 'star'}
              className={`p-1.5 rounded-full transition-colors ${message.isStarred
                ? 'text-amber-500 hover:bg-gray-100'
                : 'text-gray-600 hover:bg-gray-100'
                } ${actionLoading === 'star' ? 'opacity-50' : ''}`}
              title={message.isStarred ? 'Unstar' : 'Star'}
            >
              {message.isStarred ? <StarSolidIcon className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
            </button>
            {/* More actions */}
            <div className="relative">
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="More"
              >
                <EllipsisHorizontalIcon className="w-4 h-4" />
              </button>
              {showSnoozeMenu && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                  {SNOOZE_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {option.time && <span className="text-xs text-gray-400">{option.time}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subject Line - Compact */}
        <div className="px-4 pt-2 pb-1">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">
            {message.subject || '(No subject)'}
          </h2>
        </div>

        {/* Sender Info Row - Gmail/Outlook Style Compact */}
        <div className="px-4 pb-2">
          <div className="flex items-start gap-2.5">
            {/* Avatar - Smaller */}
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm flex-shrink-0">
              {message.from?.email === (message.accountEmail || message.account_email) ? 'M' : (message.from?.name?.charAt(0)?.toUpperCase() || '?')}
            </div>

            {/* Sender Details - Compact */}
            <div className="flex-1 min-w-0">
              {/* Name + Email + Time Row */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-sm text-gray-900">{message.from?.email === (message.accountEmail || message.account_email) ? 'me' : (message.from?.name || 'Unknown')}</span>
                  {message.from?.isVIP && <StarSolidIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                  <span className="text-xs text-gray-500 truncate">
                    &lt;{message.from?.email || ''}&gt;
                  </span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {message.timestamp ? new Date(message.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) : ''}
                </span>
              </div>

              {/* To Recipients - Gmail Style with Expand/Collapse */}
              <div className="mt-0.5 text-xs text-gray-600">
                <span className="text-gray-500">to </span>
                {message.to && message.to.length > 0 ? (
                  recipientsExpanded ? (
                    // Expanded view - show all recipients with full email
                    <span className="text-gray-700">
                      {message.to.map((recipient, idx) => (
                        <span key={idx} className="inline-block">
                          {idx > 0 && <span className="text-gray-400">, </span>}
                          <span className="text-gray-700" title={recipient}>
                            {formatRecipient(recipient, true, message.accountEmail || message.account_email)}
                          </span>
                        </span>
                      ))}
                      {message.cc && message.cc.length > 0 && (
                        <>
                          <span className="text-gray-500 ml-2">cc: </span>
                          {message.cc.map((recipient, idx) => (
                            <span key={idx} className="inline-block">
                              {idx > 0 && <span className="text-gray-400">, </span>}
                              <span className="text-gray-700" title={recipient}>
                                {formatRecipient(recipient, true, message.accountEmail || message.account_email)}
                              </span>
                            </span>
                          ))}
                        </>
                      )}
                      <button
                        onClick={() => setRecipientsExpanded(false)}
                        className="ml-1.5 inline-flex items-center text-gray-400 hover:text-gray-600"
                        title="Hide details"
                      >
                        <ChevronUpIcon className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : (
                    // Collapsed view - clickable to expand
                    <button
                      onClick={() => setRecipientsExpanded(true)}
                      className="inline-flex items-center text-gray-700 hover:text-gray-900 group"
                      title="Click to see full email addresses"
                    >
                      <span>
                        {message.to.slice(0, 3).map((recipient, idx) => (
                          <span key={idx}>
                            {idx > 0 && ', '}
                            {formatRecipient(recipient, false, message.accountEmail || message.account_email)}
                          </span>
                        ))}
                        {message.to.length > 3 && (
                          <span className="text-blue-600 ml-1">
                            and {message.to.length - 3} more
                          </span>
                        )}
                      </span>
                      {message.cc && message.cc.length > 0 && (
                        <span className="ml-1">
                          <span className="text-gray-500">cc: </span>
                          {message.cc.slice(0, 2).map((recipient, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {formatRecipient(recipient, false, message.accountEmail || message.account_email)}
                            </span>
                          ))}
                          {message.cc.length > 2 && (
                            <span className="text-blue-600 ml-1">+{message.cc.length - 2}</span>
                          )}
                        </span>
                      )}
                      <ChevronDownIcon className="w-3.5 h-3.5 ml-1 text-gray-400 group-hover:text-gray-600" />
                    </button>
                  )
                ) : (
                  <span className="text-gray-700">me</span>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Attachments Inline - Compact */}
        {(message.hasAttachments || message.has_attachments) && message.attachments?.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-1.5 border-t border-gray-100 pt-1.5">
            <PaperClipIcon className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex flex-wrap gap-1.5">
              {message.attachments
                .filter(att => !att.is_inline) // Only show non-inline attachments
                .map((att, idx) => {
                  const attachmentKey = att.attachment_id || att.name;
                  const isDownloading = downloadingAttachmentId === attachmentKey;
                  const hasDownloadData = att.attachment_id || att.data;

                  return (
                    <button
                      key={idx}
                      onClick={() => hasDownloadData && handleDownloadAttachment(att)}
                      disabled={isDownloading || !hasDownloadData}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 transition-colors group ${hasDownloadData
                          ? 'hover:bg-blue-50 hover:text-blue-700 cursor-pointer'
                          : 'cursor-not-allowed opacity-60'
                        } ${isDownloading ? 'bg-blue-50' : ''}`}
                      title={hasDownloadData ? `Download ${att.name}` : 'Download not available'}
                    >
                      {isDownloading ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                      ) : (
                        <DocumentTextIcon className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      <span className="max-w-[150px] truncate">{att.name}</span>
                      {att.size > 0 && (
                        <span className="text-gray-400 text-[10px]">
                          ({att.size >= 1024 * 1024
                            ? `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                            : att.size >= 1024
                              ? `${Math.round(att.size / 1024)} KB`
                              : `${att.size} B`
                          })
                        </span>
                      )}
                      {hasDownloadData && !isDownloading && (
                        <ArrowDownTrayIcon className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* AI Insights Toolbar - Compact */}
        <div className="px-4 py-1.5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-1">
            {/* AI Summary Button */}
            <button
              onClick={async () => {
                // Always ensure panel is open when clicking Summarize
                if (!showAIInsights) {
                  setShowAIInsights(true);
                }

                // If we already have a summary, clicking this just ensures it's visible (via the setShowAIInsights above)
                // If we DON'T have a summary, we fetch it using streaming API.

                if (!aiInsights?.summary && !aiInsightsLoading) {
                  setAiInsightsLoading('summary');
                  setStreamingText(''); // Reset streaming text

                  try {
                    // Get email content — prefer plain text, extract only the latest reply
                    // to avoid exceeding URL length limits (EventSource uses GET) and LLM context
                    const rawContent = message.body_plain || message.body || message.preview || '';
                    const latestReply = extractLatestReply(rawContent);
                    // Truncate to 3000 chars max to stay within safe URL length for GET/EventSource
                    const emailContent = latestReply.length > 3000
                      ? latestReply.substring(0, 3000) + '...'
                      : latestReply;

                    // Handle sender (which might be an object or string)
                    // message.from is usually an object { name, email, is_vip } from our backend
                    let sender = '';
                    if (message.from && typeof message.from === 'object') {
                      sender = message.from.name && message.from.email
                        ? `${message.from.name} <${message.from.email}>`
                        : (message.from.name || message.from.email || '');
                    } else {
                      sender = message.from || message.sender || '';
                    }

                    const subject = message.subject || '';

                    console.log('[Email AI] Streaming summarize email:', {
                      rawLength: rawContent.length,
                      latestReplyLength: latestReply.length,
                      contentLength: emailContent.length,
                      sender,
                      subject
                    });

                    // Use streaming API with callbacks (EventSource-based, same as personal assistant chat)
                    // Close any previous stream before starting a new one
                    if (activeEventSourceRef.current) {
                      activeEventSourceRef.current.close();
                      activeEventSourceRef.current = null;
                    }
                    activeEventSourceRef.current = emailAI.summarizeStream(
                      {
                        content: emailContent,
                        sender,
                        subject,
                      },
                      // onToken callback - update streaming text progressively
                      (token) => {
                        setStreamingText(prev => prev + token);
                      },
                      // onComplete callback - set final parsed result
                      (result) => {
                        console.log('[Email AI] Streaming summarization complete:', result);
                        activeEventSourceRef.current = null;
                        setAiInsights(prev => ({
                          ...prev,
                          summary: result.summary,
                          keyPoints: result.key_points || [],
                          sentiment: result.sentiment || 'neutral',
                        }));
                        // Don't clear streamingText - keep displaying the markdown for visual consistency
                        setAiInsightsLoading(null);
                      },
                      // onError callback
                      (error) => {
                        console.error('Email summarization streaming failed:', error);
                        activeEventSourceRef.current = null;
                        setAiInsights(prev => ({
                          ...prev,
                          summary: 'Failed to analyze email. Please try again.',
                          keyPoints: [],
                          sentiment: 'neutral',
                        }));
                        setStreamingText('');
                        setAiInsightsLoading(null);
                      }
                    );
                  } catch (error) {
                    console.error('Email summarization failed:', error);
                    setAiInsights(prev => ({
                      ...prev,
                      summary: 'Failed to analyze email. Please try again.',
                      keyPoints: [],
                      sentiment: 'neutral',
                    }));
                    setStreamingText('');
                    setAiInsightsLoading(null);
                  }
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAIInsights && aiInsights?.summary
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
              title="AI Summary with Key Points & Sentiment"
              disabled={aiInsightsLoading === 'summary'}
            >
              <DocumentMagnifyingGlassIcon className="w-4 h-4" />
              {aiInsightsLoading === 'summary' ? 'Analyzing...' : 'Summarize'}
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Translate Button with Language Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!aiInsights?.showTranslateMenu) {
                    setAiInsights(prev => ({
                      ...prev,
                      showTranslateMenu: true,
                    }));
                  } else {
                    setAiInsights(prev => ({
                      ...prev,
                      showTranslateMenu: false,
                    }));
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${aiInsights?.translation?.translated
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
                title="Translate Email"
                disabled={aiInsightsLoading === 'translation'}
              >
                <LanguageIcon className="w-4 h-4" />
                {aiInsightsLoading === 'translation' ? 'Translating...' : 'Translate'}
                <ChevronDownIcon className="w-3 h-3" />
              </button>

              {/* Language Dropdown Menu */}
              {aiInsights?.showTranslateMenu && (
                <div
                  ref={translateMenuRef}
                  className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 overflow-y-auto max-h-64"
                >
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'zh', name: '中文 (Chinese Simplified)' },
                    { code: 'zh-TW', name: '繁體中文 (Chinese Traditional)' },
                    { code: 'es', name: 'Español (Spanish)' },
                    { code: 'fr', name: 'Français (French)' },
                    { code: 'de', name: 'Deutsch (German)' },
                    { code: 'ja', name: '日本語 (Japanese)' },
                    { code: 'ko', name: '한국어 (Korean)' },
                    { code: 'pt', name: 'Português (Portuguese)' },
                    { code: 'ru', name: 'Русский (Russian)' },
                    { code: 'ar', name: 'العربية (Arabic)' },
                    { code: 'it', name: 'Italiano (Italian)' },
                    { code: 'nl', name: 'Nederlands (Dutch)' },
                    { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
                    { code: 'th', name: 'ไทย (Thai)' },
                  ].map(lang => (
                    <button
                      key={lang.code}
                      onClick={async () => {
                        setAiInsights(prev => ({ ...prev, showTranslateMenu: false }));
                        // Ensure panel is open when translation starts
                        if (!showAIInsights) {
                          setShowAIInsights(true);
                        }
                        setAiInsightsLoading('translation');
                        setTranslationStreamingText(''); // Reset streaming text

                        try {
                          const rawContent = message.body_plain || message.body || message.preview || '';
                          const latestReply = extractLatestReply(rawContent);
                          const emailContent = latestReply.length > 3000
                            ? latestReply.substring(0, 3000) + '...'
                            : latestReply;
                          const subject = message.subject || '';

                          // Close any previous stream before starting translation
                          if (activeEventSourceRef.current) {
                            activeEventSourceRef.current.close();
                            activeEventSourceRef.current = null;
                          }
                          activeEventSourceRef.current = emailAI.translateStream(
                            {
                              content: emailContent,
                              targetLanguage: lang.code,
                              subject,
                            },
                            // onToken
                            (token) => {
                              setTranslationStreamingText(prev => prev + token);
                            },
                            // onComplete
                            (result) => {
                              setAiInsights(prev => ({
                                ...prev,
                                translation: {
                                  targetLanguage: lang.name,
                                  translatedContent: result.translated_content,
                                  translatedSubject: result.translated_subject,
                                  detectedLanguage: result.detected_language,
                                },
                              }));
                              activeEventSourceRef.current = null;
                              setAiInsightsLoading(null);
                            },
                            // onError
                            (error) => {
                              console.error('Email translation failed:', error);
                              activeEventSourceRef.current = null;
                              setAiInsights(prev => ({
                                ...prev,
                                translation: {
                                  error: 'Translation failed. Please try again.',
                                },
                              }));
                              setTranslationStreamingText('');
                              setAiInsightsLoading(null);
                            }
                          );
                        } catch (error) {
                          console.error('Email translation failed:', error);
                          setAiInsights(prev => ({
                            ...prev,
                            translation: {
                              error: 'Translation failed. Please try again.',
                            },
                          }));
                          setTranslationStreamingText('');
                          setAiInsightsLoading(null);
                        }
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show Sentiment Badge if available */}
            {aiInsights?.sentiment && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${aiInsights.sentiment === 'urgent' ? 'bg-red-100 text-red-700' :
                aiInsights.sentiment === 'friendly' ? 'bg-green-100 text-green-700' :
                  aiInsights.sentiment === 'professional' ? 'bg-blue-100 text-blue-700' :
                    aiInsights.sentiment === 'frustrated' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                }`}>
                {aiInsights.sentiment.charAt(0).toUpperCase() + aiInsights.sentiment.slice(1)}
              </span>
            )}
          </div>


        </div>
      </div>

      {/* Email Body - Large & Clear (Main Focus) */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* AI Insights Panel - Inline with Scroll */}
        {showAIInsights && (
          <div className="px-4 py-3 space-y-3 bg-gray-50 border-b border-gray-100">
            {/* Summary Section */}
            {/* Summary & Key Points Section (Sticky Note Theme) */}
            {(aiInsightsLoading === 'summary' || aiInsights?.summary) && (
              <div className="relative p-3 bg-amber-50 rounded-lg border border-amber-200/60 shadow-sm group">
                {/* Close Button */}
                {!aiInsightsLoading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Close summary and clear streaming text
                      setStreamingText('');
                      setAiInsights(prev => {
                        const newState = { ...prev, summary: null, keyPoints: null };
                        // If both are closed, close the main panel
                        if (!newState.translation?.translatedContent) {
                          setShowAIInsights(false);
                        }
                        return newState;
                      });
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full text-amber-400/80 hover:text-amber-700 hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-all"
                    title="Close Summary"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center gap-1.5 mb-2 pr-6">
                  <DocumentMagnifyingGlassIcon className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Summary</span>
                </div>
                {streamingText ? (
                  // Show streaming text with real-time markdown rendering (same as personal assistant chat)
                  <MessageRenderer
                    content={streamingText}
                    className="text-amber-950/90 text-sm"
                    isStreaming={aiInsightsLoading === 'summary'}
                  />
                ) : aiInsightsLoading === 'summary' ? (
                  // Show loading state when waiting for first token
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Analyzing email...
                  </div>
                ) : aiInsights?.summary ? (
                  // Fallback: structured view (only if no streamingText and summary exists)
                  <>
                    <p className="text-sm text-amber-950/90 leading-relaxed">{aiInsights.summary}</p>

                    {/* Key Points merged inside */}
                    {aiInsights?.keyPoints?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200/60">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ListBulletIcon className="w-3.5 h-3.5 text-amber-700/80" />
                          <span className="text-[10px] font-bold text-amber-800/70 uppercase tracking-wide">Key Points</span>
                        </div>
                        <ul className="space-y-2">
                          {aiInsights.keyPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${point.type === 'action' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                point.type === 'deadline' ? 'bg-red-100 text-red-700 border border-red-200' :
                                  'bg-white text-amber-700 border border-amber-200'
                                }`}>
                                {point.type === 'action' ? '!' : point.type === 'deadline' ? '⏰' : 'ℹ'}
                              </span>
                              <span className="text-amber-950/90">{point.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Translation Section (Sky Blue Theme) */}
            {(aiInsightsLoading === 'translation' || aiInsights?.translation?.translatedContent) && (
              <div className="relative p-3 bg-sky-50 rounded-lg border border-sky-100 shadow-sm group w-full min-w-0 overflow-hidden">
                {/* Close Button */}
                {!aiInsightsLoading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Close translation and check if summary is also closed
                      setTranslationStreamingText('');
                      setAiInsights(prev => {
                        const newState = { ...prev, translation: null };
                        // If both are closed, close the main panel
                        if (!newState.summary && !newState.keyPoints) {
                          setShowAIInsights(false);
                        }
                        return newState;
                      });
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full text-sky-400 hover:text-sky-700 hover:bg-sky-100 opacity-0 group-hover:opacity-100 transition-all"
                    title="Close Translation"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center justify-between mb-2 pr-6">
                  <div className="flex items-center gap-1.5">
                    <LanguageIcon className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-sky-700 uppercase tracking-wide">Translation</span>
                  </div>
                  {aiInsights?.translation?.targetLanguage && !aiInsightsLoading && (
                    <span className="text-xs text-sky-600 font-medium">
                      {aiInsights.translation.detectedLanguage} → {aiInsights.translation.targetLanguage}
                    </span>
                  )}
                </div>
                {translationStreamingText ? (
                  <MessageRenderer
                    content={translationStreamingText}
                    className="text-slate-800 text-sm"
                    isStreaming={aiInsightsLoading === 'translation'}
                  />
                ) : aiInsightsLoading === 'translation' ? (
                  <div className="flex items-center gap-2 text-sm text-sky-600">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Translating...
                  </div>
                ) : aiInsights?.translation?.error ? (
                  <p className="text-sm text-red-600">{aiInsights.translation.error}</p>
                ) : (
                  <div className="space-y-3">
                    {/* Attempt to parse JSON content or use direct properties */}
                    {(() => {
                      let subject = aiInsights.translation.translatedSubject;
                      let content = aiInsights.translation.translatedContent;

                      // Try to parse content if it looks like JSON (some models return JSON string inside content)
                      if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('```json'))) {
                        try {
                          const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
                          const parsed = JSON.parse(cleanJson);
                          if (parsed.translated_content) content = parsed.translated_content;
                          if (parsed.translated_subject) subject = parsed.translated_subject;
                        } catch (e) {
                          // JSON.parse failed (likely due to newlines or format), try regex extraction
                          const contentMatch = content.match(/"translated_content"\s*:\s*"([\s\S]*?)(?<!\\)"/);
                          if (contentMatch) {
                            content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                          }



                          const subjectMatch = content.match(/"translated_subject"\s*:\s*"([\s\S]*?)(?<!\\)"/);
                          if (subjectMatch) {
                            subject = subjectMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                          }
                        }
                      }

                      // Clean up raw headers/metadata from the content for display
                      if (content && typeof content === 'string') {
                        // Remove "**Detected Language:** ..." (usually at end)
                        content = content.replace(/\*\*Detected Language:\*\*.*\n?/gmi, '');

                        // Remove "**Subject:** ..." (usually at start)
                        content = content.replace(/\*\*Subject:\*\*.*\n?/gmi, '');

                        // Remove "**Translation:**" header
                        content = content.replace(/\*\*Translation:\*\*\s*\n?/gmi, '');

                        content = content.trim();
                      }

                      return (
                        <>
                          {subject && (
                            <div className="pb-2 border-b border-sky-200">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">
                                <span className="text-sky-600 font-medium mr-1">Subject:</span>
                                {subject}
                              </p>
                            </div>
                          )}

                          <p className="text-sm font-semibold text-slate-800 mb-1 mt-3">Translation:</p>
                          <div
                            className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words break-all"
                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                          >
                            {content}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="px-4 py-3">
          {/* Email Content - Gmail/Outlook Style Rendering */}
          {(() => {
            // Show loading skeleton while fetching full message content
            if (bodyLoading) {
              return (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              );
            }

            // Show loading state if no content at all
            if (!sanitizedEmailBody?.html && !sanitizedEmailBody?.plain && !message.preview) {
              return (
                <p className="text-gray-500 italic">No content</p>
              );
            }

            if (sanitizedEmailBody?.isHTML && sanitizedEmailBody.html) {
              return (
                <>
                  <style>{EMAIL_HTML_STYLES}</style>
                  <div
                    className="email-html-content"
                    onClick={handleEmailContentClick}
                    dangerouslySetInnerHTML={{ __html: sanitizedEmailBody.html }}
                  />
                </>
              );
            } else {
              // Plain text email - convert line breaks to paragraphs
              const paragraphs = (sanitizedEmailBody?.plain || '').split(/\n\n+/).filter(p => p.trim());

              if (paragraphs.length === 0) {
                return (
                  <p className="text-gray-500 italic">No content</p>
                );
              }

              return (
                <div className="space-y-4">
                  {paragraphs.map((paragraph, idx) => {
                    // Check if this is a quoted reply (lines starting with >)
                    const lines = paragraph.split('\n');
                    const isQuote = lines.every(line => line.trim().startsWith('>') || line.trim() === '');

                    if (isQuote) {
                      return (
                        <blockquote key={idx} className="border-l-4 border-gray-300 pl-4 text-gray-600 italic">
                          {lines.map((line, lineIdx) => (
                            <p key={lineIdx} className="my-1">
                              {line.replace(/^>\s*/, '')}
                            </p>
                          ))}
                        </blockquote>
                      );
                    }

                    return (
                      <p key={idx} className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {lines.map((line, lineIdx) => (
                          <span key={lineIdx}>
                            {lineIdx > 0 && <br />}
                            {line}
                          </span>
                        ))}
                      </p>
                    );
                  })}
                </div>
              );
            }
          })()}

          {/* Slack Reactions */}
          {message.reactions && (
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100">
              {message.reactions.map((reaction, idx) => (
                <button key={idx} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200 transition-colors">
                  <span>{reaction.emoji}</span>
                  <span className="text-gray-600">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAIComposer && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl m-4 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-600" />
                <span className="font-bold text-gray-900 text-lg">AI Assistant</span>
              </div>
              <button
                onClick={() => setShowAIComposer(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 shrink-0">
              <button
                onClick={() => setComposerMode('reply')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${composerMode === 'reply'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Draft Reply
              </button>
              <button
                onClick={() => {
                  setComposerMode('polish');
                  if (!composerText && message.replyBody) {
                    setComposerText(message.replyBody); // Pre-fill with existing reply draft if available
                  }
                }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${composerMode === 'polish'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Polish & Refine
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {composerMode === 'reply' ? (
                /* Reply Mode */
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions</label>
                    <textarea
                      value={replyInstructions}
                      onChange={(e) => setReplyInstructions(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm placeholder-gray-400"
                      placeholder="e.g. Reject the offer politely but ask to keep in touch..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {AI_TONES.map(tone => (
                        <button
                          key={tone.id}
                          onClick={() => setSelectedTone(tone.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedTone === tone.id
                            ? 'bg-purple-600 text-white shadow-md transform scale-105'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          {tone.emoji} {tone.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {composerText && (
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 animate-fadeIn">
                      <label className="block text-xs font-bold text-purple-800 mb-2 uppercase tracking-wide">Generated Draft</label>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{composerText}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* Polish Mode */
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Text to Polish</label>
                    <textarea
                      value={composerText} // Re-using composerText for input/output for simplicity, or we separate
                      onChange={(e) => setComposerText(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                      placeholder="Paste text here or draft a reply..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Refinement Goal</label>
                    <div className="flex flex-wrap gap-2">
                      {['Fix Grammar', 'Make Professional', 'Make Friendly', 'Shorten', 'Expand'].map(goal => (
                        <button
                          key={goal}
                          onClick={() => {
                            // Set logic to trigger polish with this goal
                            handlePolish(goal);
                          }}
                          disabled={aiInsightsLoading === 'polishing'}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-purple-300 hover:text-purple-600 transition-colors"
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center shrink-0">
              {/* Shortcuts or Status */}
              <div className="text-xs text-gray-500">
                {aiInsightsLoading ? (
                  <span className="flex items-center gap-2 text-purple-600 font-medium">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    {aiInsightsLoading === 'drafting' ? 'Drafting...' : 'Polishing...'}
                  </span>
                ) : (
                  <span className="italic">Powered by Work Agent AI</span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAIComposer(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Cancel
                </button>

                {composerMode === 'reply' ? (
                  <button
                    onClick={generateAIReply}
                    disabled={!replyInstructions || aiInsightsLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-xl font-medium shadow-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {composerText ? <ArrowPathIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                    {composerText ? 'Regenerate' : 'Generate Draft'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      // Insert the polished text back to main composer
                      // Implementation might vary depending on how we want "Insert" to behave
                      // For now we just close and copy? Or maybe "Apply"
                      handleApplyPolish();
                    }}
                    disabled={!composerText || aiInsightsLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-xl font-medium shadow-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Apply Changes
                  </button>
                )}

                {/* Insert Button for Reply Mode */}
                {composerMode === 'reply' && composerText && (
                  <button
                    onClick={handleInsertDraft}
                    className="px-6 py-2 bg-green-600 text-white rounded-xl font-medium shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
                  >
                    <PaperAirplaneIcon className="w-4 h-4 -rotate-45" />
                    Insert
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Panel */}
      {showKeyboardShortcuts && (
        <div className="absolute top-20 right-4 w-64 bg-gray-900 text-white rounded-xl shadow-xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Keyboard Shortcuts</span>
            <button onClick={() => setShowKeyboardShortcuts(false)} className="text-gray-400 hover:text-white">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {KEYBOARD_SHORTCUTS.map(shortcut => (
              <div key={shortcut.key} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{shortcut.action}</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs font-mono">{shortcut.key}</kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-opacity"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-sm"
            />
            <button
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
              onClick={() => setLightboxImage(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(MessageDetailPanel);
