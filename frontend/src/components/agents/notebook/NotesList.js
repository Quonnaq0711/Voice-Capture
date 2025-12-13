/**
 * NotesList - List of notes with search and filtering
 */
import React from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  BookmarkIcon,
  ArchiveBoxIcon,
  FolderArrowDownIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';

const NotesList = ({
  notes = [],
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onToggleArchive,
  onMoveToTrash,
  onRestore,
  onPermanentDelete,
  onMoveNote,
  searchQuery,
  onSearchChange,
  loading = false,
  showArchived = false,
  showTrashed = false,
}) => {
  const pinnedNotes = notes.filter(note => note.is_pinned);
  const unpinnedNotes = notes.filter(note => !note.is_pinned);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const NoteItem = ({ note }) => {
    const isSelected = note.id === selectedNoteId;

    return (
      <div
        onClick={() => onSelectNote(note)}
        className={`group p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
        } ${showTrashed ? 'opacity-75' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium truncate ${isSelected ? 'text-indigo-700' : showTrashed ? 'text-gray-600' : 'text-gray-900'}`}>
              {note.title || 'Untitled'}
            </h4>
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {note.preview || 'No content'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {showTrashed && note.deleted_at
                ? `Deleted ${formatDate(note.deleted_at)}`
                : formatDate(note.updated_at)}
            </p>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {showTrashed ? (
              <>
                {/* Restore button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(note.id);
                  }}
                  className="p-1 hover:bg-green-100 rounded"
                  title="Restore note"
                >
                  <ArrowUturnLeftIcon className="w-4 h-4 text-green-600" />
                </button>
                {/* Permanent Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Permanently delete this note? This cannot be undone.')) {
                      onPermanentDelete(note.id);
                    }
                  }}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Delete permanently"
                >
                  <TrashIcon className="w-4 h-4 text-red-500" />
                </button>
              </>
            ) : (
              <>
                {/* Move button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveNote(note);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Move to folder"
                >
                  <FolderArrowDownIcon className="w-4 h-4 text-gray-400" />
                </button>
                {/* Pin button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(note.id);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                >
                  {note.is_pinned ? (
                    <BookmarkSolidIcon className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <BookmarkIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {/* Archive button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArchive(note.id);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title={showArchived ? 'Unarchive note' : 'Archive note'}
                >
                  <ArchiveBoxIcon className={`w-4 h-4 ${showArchived ? 'text-amber-500' : 'text-gray-400'}`} />
                </button>
                {/* Delete (move to trash) button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToTrash(note.id);
                  }}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Move to trash"
                >
                  <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-72 border-r border-gray-200 flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={showTrashed ? "Search trash..." : "Search notes..."}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          {!showTrashed && (
            <button
              onClick={onCreateNote}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title="New note"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 px-4">
            {showTrashed ? (
              <>
                <TrashIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm text-center">Trash is empty</p>
              </>
            ) : (
              <>
                <ArchiveBoxIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm text-center">
                  {searchQuery ? 'No notes found' : 'No notes yet'}
                </p>
                <button
                  onClick={onCreateNote}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Create your first note
                </button>
              </>
            )}
          </div>
        ) : showTrashed ? (
          // Trash view - no pinned/unpinned sections, just list all
          <div>
            {notes.map(note => (
              <NoteItem key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Pinned
                </div>
                {pinnedNotes.map(note => (
                  <NoteItem key={note.id} note={note} />
                ))}
              </div>
            )}

            {/* Other Notes */}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Notes
                  </div>
                )}
                {unpinnedNotes.map(note => (
                  <NoteItem key={note.id} note={note} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
        {notes.length} note{notes.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default NotesList;
