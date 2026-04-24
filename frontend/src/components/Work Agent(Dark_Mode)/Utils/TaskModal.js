import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { todos } from "../../../services/workApi";
import MarkdownEditor from "./MarkdownEditor";

import {
  // Navigation & Layout  
  LightBulbIcon,
  // Actions
  ArrowPathIcon,
  SparklesIcon,
  PencilSquareIcon,
  // Status & Priority
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  // AI Features
  ScissorsIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { useBullets, AISummarySection } from '../AI_Summary_Section';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Task Modal Component for Create/Edit
export default function TaskModal({ isOpen, onClose, task, onSave, isLoading, onSummaryGenerated }) {
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