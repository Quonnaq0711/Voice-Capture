import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePasswordCountDown } from '../../contexts/PasswordReset';
import { useAuth } from '../../contexts/AuthContext';
import { profile as profileAPI, auth } from '../../services/api';
import { oauth } from '../../services/workApi';
import {
  UserCircleIcon,
  KeyIcon,
  PhotoIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  HeartIcon,
  MapPinIcon,
  AcademicCapIcon,
  HomeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  PlusIcon,
  LinkIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  TicketIcon,
  HashtagIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

// Toast notification component
// Uses ref to avoid re-triggering timer when onClose changes
const Toast = ({ message, type, onClose }) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, []); // Empty deps - timer only starts once on mount

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
      <div className="flex items-center">
        {type === 'success' ? (
          <CheckIcon className="h-5 w-5 mr-2" />
        ) : (
          <XMarkIcon className="h-5 w-5 mr-2" />
        )}
        {message}
      </div>
    </div>
  );
};

// Confirmation dialog component
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onCancel}></div>

        {/* Dialog panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onConfirm}
            >
              Delete
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Available integrations for Applications tab
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
    name: 'Task Trackers',
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

// Applications Tab Component - Manage connected OAuth accounts
const ApplicationsTab = () => {
  const { user } = useAuth();
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [connectingSource, setConnectingSource] = useState(null);
  const [oauthError, setOauthError] = useState(null);
  const [oauthSuccess, setOauthSuccess] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('email');

  // Fetch connected accounts on mount
  useEffect(() => {
    const fetchConnectedAccounts = async () => {
      if (!user?.id) return;
      try {
        setAccountsLoading(true);
        const accounts = await oauth.getAccounts(user.id);
        // Transform backend response to match our UI format
        const transformedAccounts = (accounts || []).map(acc => ({
          id: String(acc.id),
          sourceId: acc.provider === 'google' ? 'gmail' : acc.provider,
          email: acc.account_email,
          name: acc.account_name,
          connectedAt: acc.created_at?.split('T')[0],
          avatar: null,
          isValid: acc.is_valid,
        }));
        setConnectedAccounts(transformedAccounts);
      } catch (error) {
        console.error('Failed to fetch connected accounts:', error);
        setConnectedAccounts([]);
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchConnectedAccounts();
  }, [user?.id]);

  // Handle OAuth callback from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const provider = urlParams.get('provider');

    if (oauthStatus === 'success' && provider) {
      setOauthSuccess(`Successfully connected ${provider === 'google' ? 'Gmail' : provider}!`);
      // Refresh accounts list
      if (user?.id) {
        oauth.getAccounts(user.id).then(accounts => {
          // Transform backend response to match our UI format
          const transformedAccounts = (accounts || []).map(acc => ({
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
      }
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setOauthSuccess(null), 5000);
    } else if (oauthStatus === 'error') {
      const errorMsg = urlParams.get('error') || 'OAuth connection failed';
      setOauthError(errorMsg);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setOauthError(null), 5000);
    }
  }, [user?.id]);

  // Get accounts connected for a specific source
  const getConnectedAccountsForSource = useCallback((sourceId) => {
    return connectedAccounts.filter(acc => acc.sourceId === sourceId);
  }, [connectedAccounts]);

  // Check if a source has any connected accounts
  const isSourceConnected = useCallback((sourceId) => {
    return connectedAccounts.some(acc => acc.sourceId === sourceId);
  }, [connectedAccounts]);

  // Get total connected accounts count
  const getTotalConnectedCount = useCallback(() => connectedAccounts.length, [connectedAccounts]);

  // Handle OAuth connection
  const handleConnectSource = async (integration) => {
    if (integration.comingSoon) {
      setOauthError(`${integration.name} integration coming soon!`);
      setTimeout(() => setOauthError(null), 3000);
      return;
    }

    setConnectingSource(integration.id);

    try {
      let provider = integration.id;
      if (integration.id === 'gmail' || integration.id === 'google_calendar') {
        provider = 'google';
      }

      if (provider === 'google') {
        const authData = await oauth.getGoogleAuthUrl(user.id);
        if (authData.authorization_url) {
          sessionStorage.setItem('oauth_state', authData.state);
          sessionStorage.setItem('oauth_provider', provider);

          // Fix for remote dev: If URL is localhost:6004, rewrite to /api/work proxy
          let authUrl = authData.authorization_url;
          if (authUrl.includes('localhost:6004')) {
            authUrl = authUrl.replace('http://localhost:6004', '/api/work');
          }
          window.location.href = authUrl;
        } else {
          throw new Error('Failed to get authorization URL');
        }
      } else {
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

  // Handle disconnecting an account
  const handleDisconnectAccount = async (accountId) => {
    if (!user?.id) return;
    try {
      await oauth.disconnectAccount(accountId, user.id);
      setConnectedAccounts(prev => prev.filter(acc => acc.id !== accountId));
      setOauthSuccess('Account disconnected successfully');
      setTimeout(() => setOauthSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      setOauthError('Failed to disconnect account. Please try again.');
      setTimeout(() => setOauthError(null), 5000);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      red: { bg: 'bg-red-100', text: 'text-red-600' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Status Messages */}
      {oauthError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <XMarkIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{oauthError}</span>
        </div>
      )}
      {oauthSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircleSolidIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-green-800">{oauthSuccess}</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(AVAILABLE_INTEGRATIONS).map(([key, category]) => {
          const Icon = category.icon;
          const isActive = selectedCategory === key;
          const connectedCount = category.integrations.filter(i => isSourceConnected(i.id)).length;

          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Icon className="w-4 h-4" />
              {category.name}
              {connectedCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-green-100 text-green-700'
                  }`}>
                  {connectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Integrations Content */}
      {accountsLoading ? (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-6">
            {AVAILABLE_INTEGRATIONS[selectedCategory].description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_INTEGRATIONS[selectedCategory].integrations.map(integration => {
              const Icon = integration.icon;
              const accounts = getConnectedAccountsForSource(integration.id);
              const isConnecting = connectingSource === integration.id;
              const hasAccounts = accounts.length > 0;
              const colorClasses = getColorClasses(integration.color);

              return (
                <div
                  key={integration.id}
                  className={`border rounded-2xl overflow-hidden transition-all ${integration.comingSoon
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : hasAccounts
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                    }`}
                >
                  {/* Integration Header */}
                  <div className="p-4 flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${colorClasses.bg}`}>
                      <Icon className={`w-6 h-6 ${colorClasses.text}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                        {integration.comingSoon && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                            Coming Soon
                          </span>
                        )}
                        {hasAccounts && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <CheckCircleSolidIcon className="w-3 h-3" />
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{integration.description}</p>
                    </div>
                    {!integration.comingSoon && (
                      <button
                        onClick={() => handleConnectSource(integration)}
                        disabled={isConnecting}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${isConnecting
                          ? 'bg-gray-100 text-gray-400 cursor-wait'
                          : hasAccounts
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                          }`}
                      >
                        {isConnecting ? (
                          <>
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            Connecting...
                          </>
                        ) : hasAccounts ? (
                          <>
                            <PlusIcon className="w-4 h-4" />
                            Add Another
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4" />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Connected Accounts List */}
                  {hasAccounts && (
                    <div className="border-t border-green-200 bg-white">
                      {accounts.map(account => (
                        <div
                          key={account.id}
                          className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                            {(account.name || account.email || account.workspace || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {account.email || account.workspace || account.site || account.organization}
                            </p>
                            <p className="text-xs text-gray-500">
                              Connected {account.connectedAt}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDisconnectAccount(account.id)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Individual Agent Profile Components
const CareerProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Handle comma-separated input by storing as string during editing
  const handleArrayInputChange = (field, value) => {
    // Store the raw string value directly without processing
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Convert string to array when input loses focus
  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  // Helper to get display value for array fields
  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      {/* Basic Career Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
        <div className="flex items-center mb-4">
          <BriefcaseIcon className="h-6 w-6 text-blue-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Basic Career Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Job</label>
            <input
              type="text"
              value={profile.current_job || ''}
              onChange={(e) => handleInputChange('current_job', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
            <input
              type="text"
              value={profile.company || ''}
              onChange={(e) => handleInputChange('company', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Google, Microsoft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
            <select
              value={profile.industry || ''}
              onChange={(e) => handleInputChange('industry', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Industry</option>
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Education">Education</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Retail">Retail</option>
              <option value="Consulting">Consulting</option>
              <option value="Media & Entertainment">Media & Entertainment</option>
              <option value="Government">Government</option>
              <option value="Non-profit">Non-profit</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
            <select
              value={profile.experience || ''}
              onChange={(e) => handleInputChange('experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Experience</option>
              <option value="Entry Level (0-2 years)">Entry Level (0-2 years)</option>
              <option value="Mid Level (3-5 years)">Mid Level (3-5 years)</option>
              <option value="Senior Level (6-10 years)">Senior Level (6-10 years)</option>
              <option value="Lead/Principal (10+ years)">Lead/Principal (10+ years)</option>
              <option value="Executive/C-Level">Executive/C-Level</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Style Preference</label>
            <select
              value={profile.work_style || ''}
              onChange={(e) => handleInputChange('work_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Work Style</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leadership Experience</label>
            <select
              value={profile.leadership_experience || ''}
              onChange={(e) => handleInputChange('leadership_experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Leadership Level</option>
              <option value="No leadership experience">No leadership experience</option>
              <option value="Team lead (2-5 people)">Team lead (2-5 people)</option>
              <option value="Manager (5-15 people)">Manager (5-15 people)</option>
              <option value="Senior Manager (15+ people)">Senior Manager (15+ people)</option>
              <option value="Director/VP">Director/VP</option>
              <option value="C-Level Executive">C-Level Executive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills & Competencies */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-100">
        <div className="flex items-center mb-4">
          <AcademicCapIcon className="h-6 w-6 text-purple-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Skills & Competencies</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Technical Skills (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('skills')}
              onChange={(e) => handleArrayInputChange('skills', e.target.value)}
              onBlur={(e) => handleArrayBlur('skills', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., JavaScript, Python, Project Management, Data Analysis"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Soft Skills (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('soft_skills')}
              onChange={(e) => handleArrayInputChange('soft_skills', e.target.value)}
              onBlur={(e) => handleArrayBlur('soft_skills', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Communication, Leadership, Problem Solving, Teamwork"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Certifications & Achievements (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('certifications')}
              onChange={(e) => handleArrayInputChange('certifications', e.target.value)}
              onBlur={(e) => handleArrayBlur('certifications', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., PMP, AWS Certified, MBA, Published Research"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Skill Development (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('skill_gaps')}
              onChange={(e) => handleArrayInputChange('skill_gaps', e.target.value)}
              onBlur={(e) => handleArrayBlur('skill_gaps', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Machine Learning, Public Speaking, Strategic Planning"
            />
          </div>
        </div>
      </div>

      {/* Career Goals & Aspirations */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-xl border border-green-100">
        <div className="flex items-center mb-4">
          <SparklesIcon className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Career Goals & Aspirations</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Short-term Goals (1-2 years)</label>
            <textarea
              value={profile.short_term_goals || ''}
              onChange={(e) => handleInputChange('short_term_goals', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="What do you want to achieve in the next 1-2 years?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Long-term Career Vision (5-10 years)</label>
            <textarea
              value={profile.career_goals || ''}
              onChange={(e) => handleInputChange('career_goals', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="Describe your long-term career aspirations and vision..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Career Path</label>
            <select
              value={profile.career_path_preference || ''}
              onChange={(e) => handleInputChange('career_path_preference', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="">Select Career Path</option>
              <option value="Individual Contributor">Individual Contributor</option>
              <option value="People Management">People Management</option>
              <option value="Technical Leadership">Technical Leadership</option>
              <option value="Entrepreneurship">Entrepreneurship</option>
              <option value="Consulting">Consulting</option>
              <option value="Academia/Research">Academia/Research</option>
              <option value="Cross-functional">Cross-functional</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industries of Interest (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('target_industries')}
              onChange={(e) => handleArrayInputChange('target_industries', e.target.value)}
              onBlur={(e) => handleArrayBlur('target_industries', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="e.g., FinTech, HealthTech, AI/ML, Sustainability"
            />
          </div>
        </div>
      </div>

      {/* Work Preferences & Values */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-100">
        <div className="flex items-center mb-4">
          <HeartIcon className="h-6 w-6 text-orange-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Work Preferences & Values</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work-Life Balance Priority</label>
            <select
              value={profile.work_life_balance_priority || ''}
              onChange={(e) => handleInputChange('work_life_balance_priority', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Priority</option>
              <option value="Work-focused">Work-focused</option>
              <option value="Balanced">Balanced</option>
              <option value="Life-focused">Life-focused</option>
              <option value="Flexible/Seasonal">Flexible/Seasonal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Size Preference</label>
            <select
              value={profile.company_size_preference || ''}
              onChange={(e) => handleInputChange('company_size_preference', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Company Size</option>
              <option value="Startup (1-50)">Startup (1-50)</option>
              <option value="Small (51-200)">Small (51-200)</option>
              <option value="Medium (201-1000)">Medium (201-1000)</option>
              <option value="Large (1000+)">Large (1000+)</option>
              <option value="No preference">No preference</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Tolerance in Career</label>
            <select
              value={profile.career_risk_tolerance || ''}
              onChange={(e) => handleInputChange('career_risk_tolerance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Risk Tolerance</option>
              <option value="Conservative">Conservative (Stable, established companies)</option>
              <option value="Moderate">Moderate (Mix of stability and growth)</option>
              <option value="Aggressive">Aggressive (High-growth, high-risk opportunities)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Geographic Flexibility</label>
            <select
              value={profile.geographic_flexibility || ''}
              onChange={(e) => handleInputChange('geographic_flexibility', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Flexibility</option>
              <option value="Local only">Local only</option>
              <option value="Regional">Regional</option>
              <option value="National">National</option>
              <option value="International">International</option>
              <option value="Fully remote">Fully remote</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Core Work Values (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('work_values')}
            onChange={(e) => handleArrayInputChange('work_values', e.target.value)}
            onBlur={(e) => handleArrayBlur('work_values', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="e.g., Innovation, Impact, Autonomy, Collaboration, Growth"
          />
        </div>
      </div>

      {/* Career Challenges & Development */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-center mb-4">
          <PuzzlePieceIcon className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Career Challenges & Development</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Career Challenges</label>
            <textarea
              value={profile.career_challenges || ''}
              onChange={(e) => handleInputChange('career_challenges', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What challenges are you currently facing in your career?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Professional Strengths (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('professional_strengths')}
              onChange={(e) => handleArrayInputChange('professional_strengths', e.target.value)}
              onBlur={(e) => handleArrayBlur('professional_strengths', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Strategic thinking, Team building, Technical expertise"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Professional Growth (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('growth_areas')}
              onChange={(e) => handleArrayInputChange('growth_areas', e.target.value)}
              onBlur={(e) => handleArrayBlur('growth_areas', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Executive presence, Cross-cultural communication, Data science"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Learning & Development Methods (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('learning_preferences')}
              onChange={(e) => handleArrayInputChange('learning_preferences', e.target.value)}
              onBlur={(e) => handleArrayBlur('learning_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Mentoring, Online courses, Conferences, On-the-job training"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Career Profile'}
        </button>
      </div>
    </div>
  );
};

const MoneyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
        <div className="flex items-center mb-4">
          <CurrencyDollarIcon className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Financial Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Income Range</label>
            <select
              value={profile.income_range || ''}
              onChange={(e) => handleInputChange('income_range', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="">Select Income Range</option>
              <option value="Under $30k">Under $30k</option>
              <option value="$30k-$50k">$30k-$50k</option>
              <option value="$50k-$75k">$50k-$75k</option>
              <option value="$75k-$100k">$75k-$100k</option>
              <option value="$100k-$150k">$100k-$150k</option>
              <option value="Over $150k">Over $150k</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Investment Experience</label>
            <select
              value={profile.investment_experience || ''}
              onChange={(e) => handleInputChange('investment_experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="">Select Experience</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Tolerance</label>
            <select
              value={profile.risk_tolerance || ''}
              onChange={(e) => handleInputChange('risk_tolerance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="">Select Risk Tolerance</option>
              <option value="Conservative">Conservative</option>
              <option value="Moderate">Moderate</option>
              <option value="Aggressive">Aggressive</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Financial Goals</label>
          <textarea
            value={profile.financial_goals || ''}
            onChange={(e) => handleInputChange('financial_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            placeholder="Describe your financial goals and objectives..."
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Financial Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BodyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-100">
        <div className="flex items-center mb-4">
          <HeartIcon className="h-6 w-6 text-red-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Health & Fitness</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fitness Level</label>
            <select
              value={profile.fitness_level || ''}
              onChange={(e) => handleInputChange('fitness_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            >
              <option value="">Select Fitness Level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Athlete">Athlete</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Preferences</label>
            <select
              value={profile.dietary_preferences || ''}
              onChange={(e) => handleInputChange('dietary_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            >
              <option value="">Select Dietary Preference</option>
              <option value="No Restrictions">No Restrictions</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Keto">Keto</option>
              <option value="Paleo">Paleo</option>
              <option value="Mediterranean">Mediterranean</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Exercise Preferences (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('exercise_preferences')}
              onChange={(e) => handleArrayInputChange('exercise_preferences', e.target.value)}
              onBlur={(e) => handleArrayBlur('exercise_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="e.g., Running, Weight Training, Yoga"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Health Goals</label>
          <textarea
            value={profile.health_goals || ''}
            onChange={(e) => handleInputChange('health_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            placeholder="Describe your health and fitness goals..."
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Health Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TravelProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-100">
        <div className="flex items-center mb-4">
          <MapPinIcon className="h-6 w-6 text-purple-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Travel Preferences</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Style</label>
            <select
              value={profile.travel_style || ''}
              onChange={(e) => handleInputChange('travel_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="">Select Travel Style</option>
              <option value="Budget">Budget</option>
              <option value="Mid-range">Mid-range</option>
              <option value="Luxury">Luxury</option>
              <option value="Adventure">Adventure</option>
              <option value="Cultural">Cultural</option>
              <option value="Relaxation">Relaxation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Budget</label>
            <select
              value={profile.travel_budget || ''}
              onChange={(e) => handleInputChange('travel_budget', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="">Select Budget Range</option>
              <option value="Under $1000">Under $1000</option>
              <option value="$1000-$3000">$1000-$3000</option>
              <option value="$3000-$5000">$3000-$5000</option>
              <option value="$5000-$10000">$5000-$10000</option>
              <option value="Over $10000">Over $10000</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Frequency</label>
            <select
              value={profile.travel_frequency || ''}
              onChange={(e) => handleInputChange('travel_frequency', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="">Select Frequency</option>
              <option value="Rarely">Rarely</option>
              <option value="Once a year">Once a year</option>
              <option value="2-3 times a year">2-3 times a year</option>
              <option value="Monthly">Monthly</option>
              <option value="Frequently">Frequently</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Destinations (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('preferred_destinations')}
              onChange={(e) => handleArrayInputChange('preferred_destinations', e.target.value)}
              onBlur={(e) => handleArrayBlur('preferred_destinations', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Europe, Asia, Beach destinations"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Travel Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MindProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-center mb-4">
          <AcademicCapIcon className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Personal Development</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learning Style</label>
            <select
              value={profile.learning_style || ''}
              onChange={(e) => handleInputChange('learning_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">Select Learning Style</option>
              <option value="Visual">Visual</option>
              <option value="Auditory">Auditory</option>
              <option value="Kinesthetic">Kinesthetic</option>
              <option value="Reading/Writing">Reading/Writing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Personality Type</label>
            <input
              type="text"
              value={profile.personality_type || ''}
              onChange={(e) => handleInputChange('personality_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., INTJ, ENFP (Myers-Briggs)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Strengths (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('strengths')}
              onChange={(e) => handleArrayInputChange('strengths', e.target.value)}
              onBlur={(e) => handleArrayBlur('strengths', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Communication, Problem-solving, Leadership"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Improvement (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('areas_for_improvement')}
              onChange={(e) => handleArrayInputChange('areas_for_improvement', e.target.value)}
              onBlur={(e) => handleArrayBlur('areas_for_improvement', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Time management, Public speaking"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Mind Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FamilyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
        <div className="flex items-center mb-4">
          <HomeIcon className="h-6 w-6 text-orange-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Family & Lifestyle</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Family Status</label>
            <select
              value={profile.family_status || ''}
              onChange={(e) => handleInputChange('family_status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Family Status</option>
              <option value="Single">Single</option>
              <option value="In a relationship">In a relationship</option>
              <option value="Married">Married</option>
              <option value="Married with children">Married with children</option>
              <option value="Single parent">Single parent</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work-Life Balance</label>
            <select
              value={profile.work_life_balance || ''}
              onChange={(e) => handleInputChange('work_life_balance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Balance Level</option>
              <option value="Work-focused">Work-focused</option>
              <option value="Balanced">Balanced</option>
              <option value="Life-focused">Life-focused</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Goals</label>
          <textarea
            value={profile.relationship_goals || ''}
            onChange={(e) => handleInputChange('relationship_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="Describe your relationship and family goals..."
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Family Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const HobbyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-6 rounded-xl border border-pink-100">
        <div className="flex items-center mb-4">
          <PuzzlePieceIcon className="h-6 w-6 text-pink-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Hobbies & Interests</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hobbies (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('hobbies')}
              onChange={(e) => handleArrayInputChange('hobbies', e.target.value)}
              onBlur={(e) => handleArrayBlur('hobbies', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Reading, Photography, Cooking, Gaming"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('interests')}
              onChange={(e) => handleArrayInputChange('interests', e.target.value)}
              onBlur={(e) => handleArrayBlur('interests', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Technology, Art, Music, Sports"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Creative Pursuits (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('creative_pursuits')}
              onChange={(e) => handleArrayInputChange('creative_pursuits', e.target.value)}
              onBlur={(e) => handleArrayBlur('creative_pursuits', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Writing, Painting, Music composition, Crafting"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Hobby Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const KnowledgeProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-xl border border-teal-100">
        <div className="flex items-center mb-4">
          <BookOpenIcon className="h-6 w-6 text-teal-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Education & Learning</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
            <select
              value={profile.education_level || ''}
              onChange={(e) => handleInputChange('education_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            >
              <option value="">Select Education Level</option>
              <option value="High School">High School</option>
              <option value="Associate Degree">Associate Degree</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
              <option value="Master's Degree">Master's Degree</option>
              <option value="Doctorate">Doctorate</option>
              <option value="Professional Certification">Professional Certification</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Learning Methods (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('preferred_learning_methods')}
              onChange={(e) => handleArrayInputChange('preferred_learning_methods', e.target.value)}
              onBlur={(e) => handleArrayBlur('preferred_learning_methods', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="e.g., Online courses, Books, Workshops, Mentoring"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Learning Goals (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('learning_goals')}
            onChange={(e) => handleArrayInputChange('learning_goals', e.target.value)}
            onBlur={(e) => handleArrayBlur('learning_goals', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            placeholder="e.g., Learn new programming language, Improve communication skills"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Knowledge Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SpiritualProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-100">
        <div className="flex items-center mb-4">
          <SparklesIcon className="h-6 w-6 text-yellow-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Spiritual & Mindfulness</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mindfulness Level</label>
            <select
              value={profile.mindfulness_level || ''}
              onChange={(e) => handleInputChange('mindfulness_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
            >
              <option value="">Select Mindfulness Level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Spiritual Practices (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('spiritual_practices')}
              onChange={(e) => handleArrayInputChange('spiritual_practices', e.target.value)}
              onBlur={(e) => handleArrayBlur('spiritual_practices', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
              placeholder="e.g., Meditation, Prayer, Yoga, Journaling"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Stress Management Techniques (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('stress_management')}
            onChange={(e) => handleArrayInputChange('stress_management', e.target.value)}
            onBlur={(e) => handleArrayBlur('stress_management', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
            placeholder="e.g., Deep breathing, Exercise, Music, Nature walks"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Spiritual Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Profile Component
const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('account');
  const [activeAgentTab, setActiveAgentTab] = useState('career');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { banner, daysLeft, closeBanner } = usePasswordCountDown();

  // User data state
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isImgError, setImgError] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    // Career fields
    current_job: '',
    industry: '',
    experience: '',
    career_goals: '',
    skills: [],

    // Money fields
    income_range: '',
    financial_goals: '',
    investment_experience: '',
    risk_tolerance: '',

    // Body fields
    fitness_level: '',
    health_goals: '',
    dietary_preferences: '',
    exercise_preferences: [],

    // Travel fields
    travel_style: '',
    preferred_destinations: [],
    travel_budget: '',
    travel_frequency: '',

    // Mind fields
    learning_style: '',
    personality_type: '',
    strengths: [],
    areas_for_improvement: [],

    // Family Life fields
    family_status: '',
    relationship_goals: '',
    work_life_balance: '',

    // Hobby fields
    hobbies: [],
    interests: [],
    creative_pursuits: [],

    // Knowledge fields
    education_level: '',
    learning_goals: [],
    preferred_learning_methods: [],

    // Spiritual fields
    spiritual_practices: [],
    mindfulness_level: '',
    stress_management: []
  });

  useEffect(() => {
    fetchUserData();
    fetchUserProfile();
    fetchAvatar();
  }, []);

  // Handle navigation with state (e.g., from Dashboard "Customize Profile" button)
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      setUserData({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const data = await profileAPI.getProfile();
      setProfile(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchAvatar = async () => {
    try {
      const data = await profileAPI.getAvatarUrl();
      let url = data.url;

      // Fix: Do not manually prepend backend URL for relative paths.
      // Let the proxy handle it, just like in UnifiedSidebar.js.
      // if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
      //   const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      //   url = backendUrl + url;
      // }

      if (url) {
        const timestamp = new Date().getTime();
        const urlWithTimestamp = url.includes('?')
          ? `${url}&t=${timestamp}`
          : `${url}?t=${timestamp}`;
        setAvatarUrl(urlWithTimestamp);
        setImgError(false);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      console.error("Error fetching avatar:", error);
      setImgError(true);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await profileAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setMessage('Password updated successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setShowPasswordChange(false);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      e.target.value = ''; // Reset file input
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      e.target.value = ''; // Reset file input
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await profileAPI.uploadAvatar(file);

      // Add cache-busting timestamp to force browser to reload the image
      const timestamp = new Date().getTime();
      let url = data.url;

      // In development mode, prepend backend URL to relative avatar paths
      if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        url = backendUrl + url;
      }

      // Add cache-busting parameter
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}t=${timestamp}`;

      // Reset image error state before setting new avatar
      setImgError(false);
      setAvatarUrl(url);
      setMessage('Avatar updated successfully');
    } catch (error) {
      // Handle specific error cases
      let errorMessage = 'Failed to upload avatar';
      if (error.response) {
        if (error.response.status === 413) {
          errorMessage = 'Image is too large. Maximum size is 5MB.';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.status === 400) {
          errorMessage = 'Invalid image format. Please upload JPG, PNG, or GIF files only.';
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input for next upload
    }
  };

  const handleAvatarDelete = async () => {
    setLoading(true);
    setImgError(true);
    setMessage('');

    try {
      await profileAPI.deleteAvatar();
      setAvatarUrl(null);
      setMessage('Avatar deleted successfully');
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await profileAPI.saveProfile(profile);
      setMessage('Profile saved successfully');
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const agentTabs = [
    { id: 'career', name: 'Career', icon: BriefcaseIcon, color: 'blue' },
    { id: 'money', name: 'Money', icon: CurrencyDollarIcon, color: 'green' },
    { id: 'body', name: 'Wellness', icon: HeartIcon, color: 'red' },
    { id: 'travel', name: 'Travel', icon: MapPinIcon, color: 'purple' },
    { id: 'mind', name: 'Mind', icon: AcademicCapIcon, color: 'indigo' },
    { id: 'family', name: 'Family', icon: HomeIcon, color: 'orange' },
    { id: 'hobby', name: 'Hobby', icon: PuzzlePieceIcon, color: 'pink' },
    { id: 'knowledge', name: 'Knowledge', icon: BookOpenIcon, color: 'teal' },
    { id: 'spiritual', name: 'Spiritual', icon: SparklesIcon, color: 'yellow' }
  ];

  const renderAgentProfile = () => {
    switch (activeAgentTab) {
      case 'career':
        return <CareerProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'money':
        return <MoneyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'body':
        return <BodyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'travel':
        return <TravelProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'mind':
        return <MindProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'family':
        return <FamilyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'hobby':
        return <HobbyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'knowledge':
        return <KnowledgeProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'spiritual':
        return <SpiritualProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      default:
        return <div className="text-center py-8 text-gray-500">Coming Soon...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and personal profile</p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckIcon className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800">{message}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <XMarkIcon className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {banner && (
          <div className="relative bg-yellow-200 text-yellow-900 px-4 py-3 border border-black flex items-center justify-between rounded-md">
            <p className="text-sm sm:text-base">
              ⚠️ Your password needs to be updated in {daysLeft} day {daysLeft !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={closeBanner}
              className="absolute right-4 top-3 bg-transparent border-0 text-yellow-900 hover:text-yellow-950 cursor-pointer text-lg leading-none"
              aria-label="Close banner"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden top-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('account')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'account'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <UserCircleIcon className="h-5 w-5 inline mr-2" />
                Account Settings
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <UserCircleIcon className="h-5 w-5 inline mr-2" />
                Personal Profile
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'applications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Squares2X2Icon className="h-5 w-5 inline mr-2" />
                Applications
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'account' && (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Welcome Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                    <UserCircleIcon className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h2>
                  <p className="text-gray-600">Manage your personal assistant profile and preferences</p>
                </div>

                {/* User Profile Card */}
                <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {avatarUrl && !isImgError ? (
                          <img
                            src={avatarUrl}
                            alt="Profile"
                            onError={() => setImgError(true)}
                            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-blue-100"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-4 border-white shadow-lg ring-4 ring-blue-100">
                            <UserCircleIcon className="h-14 w-14 text-white" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{userData.first_name || 'User'}</h3>
                        <p className="text-gray-600">{userData.email}</p>
                        <div className="flex items-center mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm text-green-600 font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <label className="cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                        <PhotoIcon className="h-5 w-5 inline mr-2" />
                        Upload Avatar
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500 text-center px-2">
                        JPG, PNG, GIF, or WebP up to 5MB
                      </p>
                      {avatarUrl && (
                        <button
                          onClick={handleAvatarDelete}
                          className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <TrashIcon className="h-5 w-5 inline mr-2" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Information Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center mr-4">
                        <UserCircleIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                        <p className="text-sm text-gray-600">Your account details</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">First Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={userData.first_name}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Last Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={userData.last_name || ''}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>


                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            value={userData.email}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                        <KeyIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Security</h3>
                        <p className="text-sm text-gray-600">Password and security settings</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                          <div>
                            <p className="font-semibold text-gray-900">Password Protection</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowPasswordChange(!showPasswordChange)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <KeyIcon className="h-4 w-4 inline mr-2" />
                          Change Password
                        </button>
                      </div>

                      {showPasswordChange && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 mt-6">
                          <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                              <input
                                type="password"
                                value={passwordData.current_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Enter current password"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                              <input
                                type="password"
                                value={passwordData.new_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Enter new password"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                              <input
                                type="password"
                                value={passwordData.confirm_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Confirm new password"
                                required
                              />
                            </div>
                            <div className="flex space-x-4 pt-4">
                              <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                {loading ? 'Updating...' : 'Update Password'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPasswordChange(false)}
                                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>


              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                {/* Agent Tabs */}
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-1 overflow-x-auto">
                      {agentTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeAgentTab === tab.id;

                        // Define color classes for each tab
                        const getTabClasses = () => {
                          if (!isActive) {
                            return 'text-gray-500 hover:text-gray-700 hover:bg-gray-50';
                          }

                          switch (tab.color) {
                            case 'blue':
                              return 'bg-blue-50 text-blue-700 border-b-2 border-blue-500';
                            case 'green':
                              return 'bg-green-50 text-green-700 border-b-2 border-green-500';
                            case 'red':
                              return 'bg-red-50 text-red-700 border-b-2 border-red-500';
                            case 'purple':
                              return 'bg-purple-50 text-purple-700 border-b-2 border-purple-500';
                            case 'indigo':
                              return 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500';
                            case 'orange':
                              return 'bg-orange-50 text-orange-700 border-b-2 border-orange-500';
                            case 'pink':
                              return 'bg-pink-50 text-pink-700 border-b-2 border-pink-500';
                            case 'teal':
                              return 'bg-teal-50 text-teal-700 border-b-2 border-teal-500';
                            case 'yellow':
                              return 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500';
                            default:
                              return 'bg-gray-50 text-gray-700 border-b-2 border-gray-500';
                          }
                        };

                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveAgentTab(tab.id)}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${getTabClasses()}`}
                          >
                            <Icon className="h-4 w-4 mr-2" />
                            {tab.name}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>

                {/* Agent Profile Content */}
                <div>
                  {renderAgentProfile()}
                </div>
              </div>
            )}

            {activeTab === 'applications' && (
              <ApplicationsTab />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;