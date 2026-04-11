/**
 * MoveNoteModal - Modal dialog to move a note to a different notebook
 *
 * Following notesnook's pattern: shows list of notebooks, allows moving
 * to any notebook or "Inbox" (no notebook).
 */
import React, { useState } from 'react';
import {
  XMarkIcon,
  FolderIcon,
  InboxIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const MoveNoteModal = ({
  isOpen,
  note,
  notebooks = [],
  onMove,
  onClose,
}) => {
  const [selectedNotebookId, setSelectedNotebookId] = useState(note?.notebook_id || null);

  if (!isOpen || !note) return null;

  const handleMove = () => {
    onMove(note.id, selectedNotebookId);
    onClose();
  };

  const getColorStyle = (color) => {
    if (!color) return {};
    return { borderLeftColor: color };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Move Note</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Note Info */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">Moving:</p>
          <p className="font-medium text-gray-900 truncate">{note.title || 'Untitled'}</p>
          {note.notebook_title && (
            <p className="text-xs text-gray-500 mt-1">
              Currently in: {note.notebook_title}
            </p>
          )}
        </div>

        {/* Notebook List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Inbox Option */}
          <button
            onClick={() => setSelectedNotebookId(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
              selectedNotebookId === null
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <InboxIcon className="w-5 h-5" />
            <span className="flex-1 font-medium">Inbox</span>
            <span className="text-xs text-gray-400">(No folder)</span>
            {selectedNotebookId === null && (
              <CheckIcon className="w-5 h-5 text-indigo-600" />
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-gray-200 my-2" />

          {/* Notebooks */}
          {notebooks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No notebooks yet
            </p>
          ) : (
            notebooks.map((notebook) => (
              <button
                key={notebook.id}
                onClick={() => setSelectedNotebookId(notebook.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1 border-l-4 ${
                  selectedNotebookId === notebook.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                style={getColorStyle(notebook.color)}
              >
                <FolderIcon className="w-5 h-5" />
                <span className="flex-1 font-medium truncate">{notebook.title}</span>
                <span className="text-xs text-gray-400">{notebook.note_count || 0}</span>
                {selectedNotebookId === notebook.id && (
                  <CheckIcon className="w-5 h-5 text-indigo-600" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={selectedNotebookId === note.notebook_id}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              selectedNotebookId === note.notebook_id
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveNoteModal;
