/**
 * NotebookSidebar - Left sidebar with notebooks list
 */
import React, { useState } from 'react';
import {
  FolderIcon,
  PlusIcon,
  InboxIcon,
  ArchiveBoxIcon,
  TrashIcon as TrashOutlineIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const NotebookSidebar = ({
  notebooks = [],
  selectedNotebookId,
  showArchived,
  showTrashed,
  stats = { all_notes: 0, archived: 0, trashed: 0 },
  onSelectNotebook,
  onSelectInbox,
  onSelectArchived,
  onSelectTrash,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  loading = false,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleStartEdit = (notebook) => {
    setEditingId(notebook.id);
    setEditTitle(notebook.title);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editingId) {
      onUpdateNotebook(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewTitle('');
  };

  const handleSaveCreate = () => {
    if (newTitle.trim()) {
      onCreateNotebook({ title: newTitle.trim() });
    }
    setIsCreating(false);
    setNewTitle('');
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewTitle('');
  };

  const getColorStyle = (color) => {
    if (!color) return {};
    return { borderLeftColor: color };
  };

  return (
    <div className="w-52 border-r border-gray-200 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Notebooks</h3>
        <button
          onClick={handleStartCreate}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="New notebook"
        >
          <PlusIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Default Items */}
      <div className="p-2">
        {/* Inbox (All notes without notebook) */}
        <button
          onClick={onSelectInbox}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            selectedNotebookId === null && !showArchived && !showTrashed
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <InboxIcon className="w-4 h-4" />
          <span className="flex-1 text-sm font-medium">All Notes</span>
          <span className="text-xs text-gray-400">{stats.all_notes}</span>
        </button>

        {/* Archived */}
        <button
          onClick={onSelectArchived}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            showArchived
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArchiveBoxIcon className="w-4 h-4" />
          <span className="flex-1 text-sm font-medium">Archived</span>
          <span className="text-xs text-gray-400">{stats.archived}</span>
        </button>

        {/* Trash */}
        <button
          onClick={onSelectTrash}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            showTrashed
              ? 'bg-red-100 text-red-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrashOutlineIcon className="w-4 h-4" />
          <span className="flex-1 text-sm font-medium">Trash</span>
          <span className="text-xs text-gray-400">{stats.trashed}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="px-3">
        <div className="border-t border-gray-200" />
      </div>

      {/* Notebooks List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* Create New Notebook Input */}
            {isCreating && (
              <div className="mb-2 p-2 bg-white rounded-lg border border-indigo-300 shadow-sm">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Notebook name..."
                  className="w-full text-sm border-none outline-none bg-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCreate();
                    if (e.key === 'Escape') handleCancelCreate();
                  }}
                />
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={handleSaveCreate}
                    className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    <CheckIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleCancelCreate}
                    className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Notebooks */}
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border-l-4 mb-1 ${
                  selectedNotebookId === notebook.id && !showArchived && !showTrashed
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                style={getColorStyle(notebook.color)}
                onClick={() => !editingId && onSelectNotebook(notebook)}
              >
                {editingId === notebook.id ? (
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-sm border-none outline-none bg-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        className="p-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        <CheckIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="p-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <FolderIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">
                      {notebook.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      {notebook.note_count || 0}
                    </span>
                    {/* Edit/Delete buttons on hover */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(notebook);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <PencilIcon className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${notebook.title}"?`)) {
                            onDeleteNotebook(notebook.id);
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <TrashIcon className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {notebooks.length === 0 && !isCreating && (
              <div className="text-center text-gray-400 text-sm py-4">
                No notebooks yet
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotebookSidebar;
