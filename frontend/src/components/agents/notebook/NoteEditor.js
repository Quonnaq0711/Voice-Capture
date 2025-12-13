/**
 * NoteEditor - Rich text editor using Tiptap
 *
 * Features (aligned with Notesnook):
 * - Text formatting: Bold, Italic, Underline, Strikethrough, Code, Sub/Superscript
 * - Headings: H1-H3
 * - Lists: Bullet, Numbered, Task/Check lists
 * - Links, Colors, Highlighting
 * - Text alignment
 * - Tables with full editing
 * - Images
 * - Code blocks, Blockquotes, Horizontal rules
 *
 * Optimizations:
 * - Single editor instance reused across note switches
 * - Debounced auto-save
 * - Memoized component
 */
import { useEffect, useCallback, useRef, useState, memo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import EditorToolbar from './EditorToolbar';

const NoteEditor = memo(({
  note,
  onSave,
  onTitleChange,
  saving = false,
  autoSaveDelay = 1000,
}) => {
  const [title, setTitle] = useState('');
  const lastSavedContentRef = useRef('');
  const lastNoteIdRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Create editor ONCE with all extensions and reuse it
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your note...',
      }),
      // Text formatting
      Underline,
      Subscript,
      Superscript,
      // Task lists
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      // Links
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline cursor-pointer hover:text-indigo-800',
        },
      }),
      // Colors
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      // Alignment
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      // Tables
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      // Images
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip if we're programmatically updating content
      if (isUpdatingRef.current) return;

      // Debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const html = editor.getHTML();
        if (html !== lastSavedContentRef.current && onSave) {
          onSave({ content: html });
          lastSavedContentRef.current = html;
        }
      }, autoSaveDelay);
    },
  }, []);  // Empty deps - editor created once

  // Update editor content when note changes - optimized
  useEffect(() => {
    if (!editor || !note) return;

    // Only update if note ID actually changed
    if (lastNoteIdRef.current === note.id) return;
    lastNoteIdRef.current = note.id;

    // Set flag to prevent onUpdate from firing during content switch
    isUpdatingRef.current = true;

    // Use requestAnimationFrame for smoother update
    requestAnimationFrame(() => {
      const newContent = note.content || '';
      editor.commands.setContent(newContent, false);  // false = don't emit update
      lastSavedContentRef.current = newContent;
      setTitle(note.title || '');

      // Reset flag after a tick
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    });
  }, [editor, note?.id, note?.content]);

  // Handle title change with debounce
  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (onTitleChange) {
        onTitleChange(newTitle);
      }
    }, autoSaveDelay);
  }, [onTitleChange, autoSaveDelay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">Select a note to edit</p>
          <p className="text-sm mt-1">Or create a new note to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header with title and status */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title..."
          className="flex-1 text-xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 placeholder-gray-400"
        />
        {saving && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </span>
        )}
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <style>{`
          .ProseMirror {
            min-height: 300px;
            padding: 1rem;
            outline: none;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            color: #9ca3af;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          /* Task list styles */
          .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding-left: 0;
          }
          .ProseMirror ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
          }
          .ProseMirror ul[data-type="taskList"] li > label {
            flex-shrink: 0;
            margin-top: 0.25rem;
          }
          .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
            width: 1rem;
            height: 1rem;
            border-radius: 0.25rem;
            border: 2px solid #6366f1;
            cursor: pointer;
          }
          .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
            background-color: #6366f1;
          }
          .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
            text-decoration: line-through;
            color: #9ca3af;
          }
          /* Table styles */
          .ProseMirror table {
            border-collapse: collapse;
            margin: 1rem 0;
            overflow: hidden;
            width: 100%;
          }
          .ProseMirror table td,
          .ProseMirror table th {
            border: 1px solid #d1d5db;
            padding: 0.5rem;
            position: relative;
            vertical-align: top;
            min-width: 100px;
          }
          .ProseMirror table th {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          .ProseMirror table .selectedCell {
            background-color: #e0e7ff;
          }
          /* Image styles */
          .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
          }
          .ProseMirror img.ProseMirror-selectednode {
            outline: 2px solid #6366f1;
          }
        `}</style>
        <EditorContent editor={editor} className="prose prose-sm sm:prose lg:prose-lg max-w-none" />
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <span>
          {note.notebook_title ? `In: ${note.notebook_title}` : 'Inbox'}
        </span>
        <span>
          Last updated: {note.updated_at ? new Date(note.updated_at).toLocaleString() : 'Never'}
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render when necessary
  return (
    prevProps.note?.id === nextProps.note?.id &&
    prevProps.note?.content === nextProps.note?.content &&
    prevProps.note?.title === nextProps.note?.title &&
    prevProps.saving === nextProps.saving
  );
});

NoteEditor.displayName = 'NoteEditor';

export default NoteEditor;
