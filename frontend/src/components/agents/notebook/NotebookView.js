/**
 * NotebookView - Main container component for the Notebook tool
 *
 * Three-panel layout:
 * - Left: NotebookSidebar (notebooks list)
 * - Center: NotesList (notes in selected notebook)
 * - Right: NoteEditor (Tiptap rich text editor)
 *
 * Optimizations:
 * - Client-side note content cache to avoid repeated API calls
 * - Memoized callbacks to prevent unnecessary re-renders
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { notebooks as notebooksApi, notes as notesApi, noteTemplates } from '../../../services/workApi';
import NotebookSidebar from './NotebookSidebar';
import NotesList from './NotesList';
import NoteEditor from './NoteEditor';
import TemplateSelector from './TemplateSelector';
import MoveNoteModal from './MoveNoteModal';

const NotebookView = () => {
  const { user } = useAuth();
  const userId = user?.id;

  // Data state
  const [notebooks, setNotebooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [stats, setStats] = useState({ all_notes: 0, archived: 0, trashed: 0 });

  // Client-side cache for note content (avoids repeated API calls)
  const notesCacheRef = useRef(new Map());

  // UI state
  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showTrashed, setShowTrashed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [noteToMove, setNoteToMove] = useState(null); // For move note modal

  // Loading states
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch notebooks and stats on mount
  useEffect(() => {
    if (!userId) return;
    fetchNotebooks();
    fetchStats();
    fetchTemplates();
  }, [userId]);

  // Fetch notes when filters change
  useEffect(() => {
    if (!userId) return;
    fetchNotes();
  }, [userId, selectedNotebookId, showArchived, showTrashed, searchQuery]);

  // ==================== API Calls ====================

  const fetchNotebooks = async () => {
    if (!userId) return;
    setLoadingNotebooks(true);
    try {
      const response = await notebooksApi.getAll(userId);
      setNotebooks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch notebooks:', error);
    } finally {
      setLoadingNotebooks(false);
    }
  };

  const fetchStats = async () => {
    if (!userId) return;
    try {
      const response = await notebooksApi.getStats(userId);
      setStats(response.data || { all_notes: 0, archived: 0, trashed: 0 });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchNotes = async () => {
    if (!userId) return;
    setLoadingNotes(true);
    try {
      const options = {
        archived: showArchived,
        trashed: showTrashed,
      };
      if (selectedNotebookId && !showTrashed) {
        options.notebook_id = selectedNotebookId;
      }
      if (searchQuery) {
        options.search = searchQuery;
      }
      const response = await notesApi.getAll(userId, options);
      setNotes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await noteTemplates.getAll();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchNote = useCallback(async (noteId) => {
    if (!userId) return null;

    // Check cache first
    const cached = notesCacheRef.current.get(noteId);
    if (cached) {
      setSelectedNote(cached);
      return cached;
    }

    try {
      const response = await notesApi.get(noteId, userId);
      const note = response.data;
      // Store in cache
      notesCacheRef.current.set(noteId, note);
      setSelectedNote(note);
      return note;
    } catch (error) {
      console.error('Failed to fetch note:', error);
      return null;
    }
  }, [userId]);

  // ==================== Notebook Actions ====================

  const handleCreateNotebook = async (data) => {
    if (!userId) return;
    try {
      await notebooksApi.create(data, userId);
      fetchNotebooks();
    } catch (error) {
      console.error('Failed to create notebook:', error);
    }
  };

  const handleUpdateNotebook = async (notebookId, data) => {
    if (!userId) return;
    try {
      await notebooksApi.update(notebookId, data, userId);
      fetchNotebooks();
    } catch (error) {
      console.error('Failed to update notebook:', error);
    }
  };

  const handleDeleteNotebook = async (notebookId) => {
    if (!userId) return;
    try {
      await notebooksApi.delete(notebookId, userId);
      if (selectedNotebookId === notebookId) {
        setSelectedNotebookId(null);
      }
      fetchNotebooks();
      fetchNotes();
    } catch (error) {
      console.error('Failed to delete notebook:', error);
    }
  };

  const handleSelectNotebook = (notebook) => {
    setSelectedNotebookId(notebook.id);
    setShowArchived(false);
    setShowTrashed(false);
    setSelectedNote(null);
  };

  const handleSelectInbox = () => {
    setSelectedNotebookId(null);
    setShowArchived(false);
    setShowTrashed(false);
    setSelectedNote(null);
  };

  const handleSelectArchived = () => {
    setShowArchived(true);
    setShowTrashed(false);
    setSelectedNotebookId(null);
    setSelectedNote(null);
  };

  const handleSelectTrash = () => {
    setShowTrashed(true);
    setShowArchived(false);
    setSelectedNotebookId(null);
    setSelectedNote(null);
  };

  // ==================== Note Actions ====================

  const handleCreateNote = () => {
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = async (template) => {
    setShowTemplateSelector(false);
    if (!userId) return;

    try {
      const data = {
        title: template ? `New ${template.name}` : 'Untitled Note',
        notebook_id: selectedNotebookId,
        template_id: template?.id,
      };

      // If template selected, get template content
      if (template) {
        const templateResponse = await noteTemplates.get(template.id);
        data.content = templateResponse.data?.content || '';
      }

      const response = await notesApi.create(data, userId);
      await fetchNotes();
      fetchStats(); // Refresh stats after create
      fetchNotebooks(); // Refresh notebook counts
      setSelectedNote(response.data);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  // Optimized: Check cache first, then fetch if needed
  const handleSelectNote = useCallback((note) => {
    // Check cache first (instant)
    const cached = notesCacheRef.current.get(note.id);
    if (cached) {
      setSelectedNote(cached);
      return;
    }
    // Fetch if not in cache
    fetchNote(note.id);
  }, [fetchNote]);

  const handleSaveNote = useCallback(async (updates) => {
    if (!selectedNote || !userId) return;
    setSaving(true);
    try {
      const response = await notesApi.update(selectedNote.id, updates, userId);
      const updatedNote = response.data;
      // Update cache
      notesCacheRef.current.set(updatedNote.id, updatedNote);
      setSelectedNote(updatedNote);
      // Update notes list if title changed
      if (updates.title) {
        fetchNotes();
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  }, [selectedNote, userId]);

  const handleTitleChange = useCallback(async (newTitle) => {
    if (!selectedNote || !userId) return;
    setSaving(true);
    try {
      const response = await notesApi.update(selectedNote.id, { title: newTitle }, userId);
      const updatedNote = response.data;
      // Update cache
      notesCacheRef.current.set(updatedNote.id, updatedNote);
      setSelectedNote(updatedNote);
      fetchNotes();
    } catch (error) {
      console.error('Failed to update title:', error);
    } finally {
      setSaving(false);
    }
  }, [selectedNote, userId]);

  const handleTogglePin = async (noteId) => {
    if (!userId) return;
    try {
      const response = await notesApi.togglePin(noteId, userId);
      // Update cache
      notesCacheRef.current.set(noteId, response.data);
      fetchNotes();
      if (selectedNote?.id === noteId) {
        setSelectedNote(response.data);
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleToggleArchive = async (noteId) => {
    if (!userId) return;
    try {
      await notesApi.toggleArchive(noteId, userId);
      // Invalidate cache for archived note
      notesCacheRef.current.delete(noteId);
      fetchNotes();
      fetchStats(); // Refresh stats after archive toggle
      fetchNotebooks(); // Refresh notebook counts
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('Failed to toggle archive:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!userId) return;
    try {
      await notesApi.delete(noteId, userId);
      // Remove from cache
      notesCacheRef.current.delete(noteId);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      fetchNotes();
      fetchStats(); // Refresh stats after delete
      fetchNotebooks(); // Refresh notebook counts
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleMoveNote = async (noteId, targetNotebookId) => {
    if (!userId) return;
    try {
      const response = await notesApi.update(noteId, { notebook_id: targetNotebookId }, userId);
      // Update cache
      notesCacheRef.current.set(noteId, response.data);
      // Refresh notes list and counts
      fetchNotes();
      fetchStats();
      fetchNotebooks();
      // Update selected note if it's the one being moved
      if (selectedNote?.id === noteId) {
        setSelectedNote(response.data);
      }
    } catch (error) {
      console.error('Failed to move note:', error);
    }
  };

  // ==================== Trash Actions ====================

  const handleMoveToTrash = async (noteId) => {
    if (!userId) return;
    try {
      await notesApi.moveToTrash(noteId, userId);
      // Remove from cache
      notesCacheRef.current.delete(noteId);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      fetchNotes();
      fetchStats();
      fetchNotebooks();
    } catch (error) {
      console.error('Failed to move note to trash:', error);
    }
  };

  const handleRestoreFromTrash = async (noteId) => {
    if (!userId) return;
    try {
      const response = await notesApi.restore(noteId, userId);
      // Update cache with restored note
      notesCacheRef.current.set(noteId, response.data);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      fetchNotes();
      fetchStats();
      fetchNotebooks();
    } catch (error) {
      console.error('Failed to restore note:', error);
    }
  };

  const handlePermanentDelete = async (noteId) => {
    if (!userId) return;
    try {
      await notesApi.permanentDelete(noteId, userId);
      // Remove from cache
      notesCacheRef.current.delete(noteId);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      fetchNotes();
      fetchStats();
    } catch (error) {
      console.error('Failed to permanently delete note:', error);
    }
  };

  // ==================== Render ====================

  return (
    <div className="h-full flex bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Left: Notebooks Sidebar */}
      <NotebookSidebar
        notebooks={notebooks}
        selectedNotebookId={selectedNotebookId}
        showArchived={showArchived}
        showTrashed={showTrashed}
        stats={stats}
        onSelectNotebook={handleSelectNotebook}
        onSelectInbox={handleSelectInbox}
        onSelectArchived={handleSelectArchived}
        onSelectTrash={handleSelectTrash}
        onCreateNotebook={handleCreateNotebook}
        onUpdateNotebook={handleUpdateNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        loading={loadingNotebooks}
      />

      {/* Center: Notes List */}
      <NotesList
        notes={notes}
        selectedNoteId={selectedNote?.id}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onMoveToTrash={handleMoveToTrash}
        onRestore={handleRestoreFromTrash}
        onPermanentDelete={handlePermanentDelete}
        onMoveNote={(note) => setNoteToMove(note)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loadingNotes}
        showArchived={showArchived}
        showTrashed={showTrashed}
      />

      {/* Right: Note Editor */}
      <NoteEditor
        note={selectedNote}
        onSave={handleSaveNote}
        onTitleChange={handleTitleChange}
        saving={saving}
      />

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        templates={templates}
        onSelect={handleTemplateSelect}
        onClose={() => setShowTemplateSelector(false)}
        loading={loadingTemplates}
      />

      {/* Move Note Modal */}
      <MoveNoteModal
        isOpen={noteToMove !== null}
        note={noteToMove}
        notebooks={notebooks}
        onMove={handleMoveNote}
        onClose={() => setNoteToMove(null)}
      />
    </div>
  );
};

export default NotebookView;
