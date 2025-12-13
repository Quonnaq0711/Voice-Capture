/**
 * EditorToolbar - Comprehensive formatting toolbar for Tiptap editor
 *
 * Following Notesnook's optimization patterns:
 * - Custom React.memo comparison functions for performance
 * - useCallback for stable function references
 * - useMemo for expensive computations
 * - flexShrink: 0 on all buttons to prevent shrinking
 * - onMouseDown with preventDefault to prevent editor blur
 */
import React, { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';

// ==================== Constants ====================

// Color palette for text (following notesnook's DEFAULT_COLORS.text)
const TEXT_COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#F43F5E',
];

// Highlight colors (following notesnook's DEFAULT_COLORS.background)
const HIGHLIGHT_COLORS = [
  '#FEF08A', '#FDE68A', '#D9F99D', '#BBF7D0',
  '#A7F3D0', '#99F6E4', '#A5F3FC', '#BAE6FD',
  '#C7D2FE', '#DDD6FE', '#F5D0FE', '#FBCFE8',
];

// Palette button size (matches notesnook's PALETTE_SIZE)
const PALETTE_SIZE = 28;

// ==================== Utility Functions ====================

// Darken a hex color (simplified version of colord().darken())
const darkenColor = (hex, amount = 0.1) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

// ==================== ToolbarButton Component ====================
// Follows notesnook's ToolButton pattern with custom memo comparison

function _ToolbarButton({ onClick, isActive, disabled, title, children, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent editor blur (critical for mobile)
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      title={title}
      style={{
        padding: '6px',
        margin: 0,
        marginRight: '2px',
        borderRadius: '4px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isActive ? '#e0e7ff' : 'transparent',
        color: disabled ? '#d1d5db' : isActive ? '#4f46e5' : '#4b5563',
        transition: 'background-color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isActive) {
          e.currentTarget.style.backgroundColor = '#e5e7eb';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isActive ? '#e0e7ff' : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// Custom comparison function (following notesnook's pattern)
const ToolbarButton = memo(_ToolbarButton, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.disabled === next.disabled &&
    prev.onClick === next.onClick &&
    prev.title === next.title &&
    prev.children === next.children
  );
});
ToolbarButton.displayName = 'ToolbarButton';

// ==================== Divider Component ====================

const Divider = memo(() => (
  <div style={{
    width: '1px',
    height: '24px',
    backgroundColor: '#d1d5db',
    margin: '0 4px',
    flexShrink: 0,
  }} />
));
Divider.displayName = 'Divider';

// ==================== ToolbarDropdown Component ====================

function _ToolbarDropdown({ trigger, children, isOpen, onClose }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {trigger}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          zIndex: 50,
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb',
          padding: '8px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

const ToolbarDropdown = memo(_ToolbarDropdown, (prev, next) => {
  return prev.isOpen === next.isOpen && prev.children === next.children;
});
ToolbarDropdown.displayName = 'ToolbarDropdown';

// ==================== PaletteButton Component ====================
// Follows notesnook's PaletteButton pattern exactly

function _PaletteButton({ color, isSelected, onClick, icon, title }) {
  const [isHovered, setIsHovered] = useState(false);

  const bgColor = color || '#fff';
  const hoverBgColor = color ? darkenColor(color, 0.15) : '#f3f4f6';

  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title || color}
      style={{
        width: PALETTE_SIZE,
        height: PALETTE_SIZE,
        borderRadius: '50%',
        border: isSelected ? '2px solid #6366f1' : '2px solid transparent',
        backgroundColor: isHovered ? hoverBgColor : bgColor,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        padding: 0,
        margin: 0,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontSize: '12px',
        transition: 'background-color 0.1s',
      }}
    >
      {icon}
    </button>
  );
}

const PaletteButton = memo(_PaletteButton, (prev, next) => {
  return (
    prev.color === next.color &&
    prev.isSelected === next.isSelected &&
    prev.onClick === next.onClick
  );
});
PaletteButton.displayName = 'PaletteButton';

// ==================== ColorPicker Component ====================
// Follows notesnook's ColorPicker pattern with fixed grid layout

function _ColorPicker({ title, colors, currentColor, onSelect, onClose }) {
  // Memoize color buttons to prevent recreation
  const colorButtons = useMemo(() => {
    return colors.map((color) => (
      <PaletteButton
        key={color}
        color={color}
        isSelected={currentColor === color}
        onClick={() => onSelect(color)}
        title={color}
      />
    ));
  }, [colors, currentColor, onSelect]);

  return (
    <div style={{ width: `${(PALETTE_SIZE + 4) * 7 + 8}px` }}>
      {title && (
        <div style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#6b7280',
          padding: '0 8px 4px',
          marginBottom: '4px',
          borderBottom: '1px solid #f3f4f6',
        }}>
          {title}
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${PALETTE_SIZE}px)`,
        gap: '4px',
        padding: '4px',
      }}>
        {/* Clear color button */}
        <PaletteButton
          color={null}
          isSelected={false}
          onClick={() => onSelect(null)}
          icon="✕"
          title="Remove color"
        />
        {colorButtons}
      </div>
    </div>
  );
}

const ColorPicker = memo(_ColorPicker, (prev, next) => {
  return (
    prev.currentColor === next.currentColor &&
    prev.title === next.title &&
    prev.colors === next.colors
  );
});
ColorPicker.displayName = 'ColorPicker';

// ==================== LinkPopup Component ====================

function _LinkPopup({ editor, isOpen, onClose }) {
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const currentUrl = editor.getAttributes('link').href || '';
      setUrl(currentUrl);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, editor]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    onClose();
  }, [editor, url, onClose]);

  if (!isOpen) return null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', minWidth: '280px' }}>
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        style={{
          flex: 1,
          padding: '4px 8px',
          fontSize: '14px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '4px 12px',
          fontSize: '14px',
          backgroundColor: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {url ? 'Apply' : 'Remove'}
      </button>
    </form>
  );
}

const LinkPopup = memo(_LinkPopup);
LinkPopup.displayName = 'LinkPopup';

// ==================== TablePopup Component ====================

function _TablePopup({ editor, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    onClose();
  }, [editor, rows, cols, onClose]);

  return (
    <div style={{ padding: '8px', minWidth: '200px' }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
        Insert Table
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#6b7280' }}>Rows</label>
          <input
            type="number"
            min="1"
            max="10"
            value={rows}
            onChange={(e) => setRows(parseInt(e.target.value) || 1)}
            style={{
              width: '64px',
              padding: '4px 8px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#6b7280' }}>Cols</label>
          <input
            type="number"
            min="1"
            max="10"
            value={cols}
            onChange={(e) => setCols(parseInt(e.target.value) || 1)}
            style={{
              width: '64px',
              padding: '4px 8px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          insertTable();
        }}
        style={{
          width: '100%',
          padding: '6px 12px',
          fontSize: '14px',
          backgroundColor: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Insert Table
      </button>
    </div>
  );
}

const TablePopup = memo(_TablePopup);
TablePopup.displayName = 'TablePopup';

// ==================== TableOperations Component ====================

function _TableOperations({ editor, onClose }) {
  // Memoize operations array (following notesnook pattern)
  const operations = useMemo(() => [
    { label: 'Add Row Before', action: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Add Row After', action: () => editor.chain().focus().addRowAfter().run() },
    { label: 'Delete Row', action: () => editor.chain().focus().deleteRow().run() },
    { divider: true },
    { label: 'Add Column Before', action: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Add Column After', action: () => editor.chain().focus().addColumnAfter().run() },
    { label: 'Delete Column', action: () => editor.chain().focus().deleteColumn().run() },
    { divider: true },
    { label: 'Toggle Header Row', action: () => editor.chain().focus().toggleHeaderRow().run() },
    { label: 'Merge Cells', action: () => editor.chain().focus().mergeCells().run() },
    { label: 'Split Cell', action: () => editor.chain().focus().splitCell().run() },
    { divider: true },
    { label: 'Delete Table', action: () => editor.chain().focus().deleteTable().run(), danger: true },
  ], [editor]);

  return (
    <div style={{ minWidth: '160px' }}>
      {operations.map((op, idx) =>
        op.divider ? (
          <div key={idx} style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
        ) : (
          <button
            key={idx}
            onMouseDown={(e) => {
              e.preventDefault();
              op.action();
              onClose();
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              color: op.danger ? '#dc2626' : '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = op.danger ? '#fef2f2' : '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {op.label}
          </button>
        )
      )}
    </div>
  );
}

const TableOperations = memo(_TableOperations);
TableOperations.displayName = 'TableOperations';

// ==================== ImagePopup Component ====================

function _ImagePopup({ editor, onClose }) {
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    onClose();
  }, [editor, url, onClose]);

  return (
    <form onSubmit={handleSubmit} style={{ padding: '8px', minWidth: '280px' }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
        Insert Image
      </div>
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/image.jpg"
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: '14px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          marginBottom: '8px',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="submit"
        disabled={!url}
        style={{
          width: '100%',
          padding: '6px 12px',
          fontSize: '14px',
          backgroundColor: url ? '#4f46e5' : '#d1d5db',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: url ? 'pointer' : 'not-allowed',
        }}
      >
        Insert Image
      </button>
    </form>
  );
}

const ImagePopup = memo(_ImagePopup);
ImagePopup.displayName = 'ImagePopup';

// ==================== SVG Icons ====================
// Memoized to prevent recreation

const Icons = {
  bold: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h6a4 4 0 014 4 4 4 0 01-1.5 3.12A4.5 4.5 0 0115 14.5 4.5 4.5 0 0110.5 19H4a1 1 0 01-1-1V4zm4 5h2a2 2 0 100-4H7v4zm0 2v4h3.5a2.5 2.5 0 100-5H7z" /></svg>,
  italic: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M8 3a1 1 0 011-1h6a1 1 0 110 2h-2.268l-2 14H13a1 1 0 110 2H7a1 1 0 110-2h2.268l2-14H9a1 1 0 01-1-1z" /></svg>,
  underline: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a1 1 0 011 1v6a4 4 0 108 0V4a1 1 0 112 0v6a6 6 0 11-12 0V4a1 1 0 011-1z" /><path d="M4 17a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" /></svg>,
  strike: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M10 3a4 4 0 00-4 4h2a2 2 0 114 0 2 2 0 01-.586 1.414l-.707.707A4 4 0 006 13v1h2v-1a2 2 0 01.586-1.414l.707-.707A4 4 0 0010 3z" /></svg>,
  code: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  clear: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  bulletList: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" /></svg>,
  orderedList: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4.5a.5.5 0 01.5-.5H4a.5.5 0 01.5.5v2H5a.5.5 0 010 1H3a.5.5 0 010-1h.5v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5.5a.5.5 0 01.5-.5h1a1 1 0 010 2H4v.5a.5.5 0 01-1 0v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4 5.5a.5.5 0 01.5-.5h1a1 1 0 010 2H4v.5a.5.5 0 01-1 0v-2zm4-.5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" /></svg>,
  taskList: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  indent: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
  outdent: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>,
  link: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  textColor: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-14a2 2 0 10-4 0v1a2 2 0 104 0V2zm3 0a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2h-2z" clipRule="evenodd" /></svg>,
  highlight: <svg className="w-4 h-4" width="16" height="16" viewBox="0 0 20 20"><path fill="currentColor" fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /><rect x="2" y="14" width="16" height="4" rx="1" fill="#FEF08A" /></svg>,
  alignLeft: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  alignCenter: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-2 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  alignRight: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm4 4a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1zm-4 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm4 4a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  alignJustify: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  table: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  image: <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  quote: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h8a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm5 0a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  codeBlock: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  hr: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  undo: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
  redo: <svg className="w-4 h-4" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
};

// ==================== Main Toolbar Component ====================

function _EditorToolbar({ editor }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  // Force re-render when editor state changes (selection, formatting, etc.)
  // This is critical for showing active state on buttons (blue highlight)
  const [, forceUpdate] = useState(0);

  // Listen to editor events to trigger re-renders when state changes
  useEffect(() => {
    if (!editor) return;

    const updateHandler = () => forceUpdate(n => n + 1);

    // Listen to both selection and transaction updates
    editor.on('selectionUpdate', updateHandler);
    editor.on('transaction', updateHandler);

    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

  // Memoized callbacks (following notesnook's useCallback pattern)
  const closeDropdown = useCallback(() => setOpenDropdown(null), []);
  const toggleDropdown = useCallback((name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  }, []);

  // Memoized command handlers (prevents recreation on each render)
  const toggleBold = useCallback(() => editor.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor.chain().focus().toggleItalic().run(), [editor]);
  const toggleUnderline = useCallback(() => editor.chain().focus().toggleUnderline().run(), [editor]);
  const toggleStrike = useCallback(() => editor.chain().focus().toggleStrike().run(), [editor]);
  const toggleCode = useCallback(() => editor.chain().focus().toggleCode().run(), [editor]);
  const toggleSubscript = useCallback(() => editor.chain().focus().toggleSubscript().run(), [editor]);
  const toggleSuperscript = useCallback(() => editor.chain().focus().toggleSuperscript().run(), [editor]);
  const clearFormatting = useCallback(() => editor.chain().focus().unsetAllMarks().run(), [editor]);

  const toggleH1 = useCallback(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const toggleH2 = useCallback(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleH3 = useCallback(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);

  const toggleBulletList = useCallback(() => editor.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleTaskList = useCallback(() => editor.chain().focus().toggleTaskList().run(), [editor]);
  const sinkListItem = useCallback(() => editor.chain().focus().sinkListItem('listItem').run(), [editor]);
  const liftListItem = useCallback(() => editor.chain().focus().liftListItem('listItem').run(), [editor]);

  const alignLeft = useCallback(() => editor.chain().focus().setTextAlign('left').run(), [editor]);
  const alignCenter = useCallback(() => editor.chain().focus().setTextAlign('center').run(), [editor]);
  const alignRight = useCallback(() => editor.chain().focus().setTextAlign('right').run(), [editor]);
  const alignJustify = useCallback(() => editor.chain().focus().setTextAlign('justify').run(), [editor]);

  const toggleBlockquote = useCallback(() => editor.chain().focus().toggleBlockquote().run(), [editor]);
  const toggleCodeBlock = useCallback(() => editor.chain().focus().toggleCodeBlock().run(), [editor]);
  const setHorizontalRule = useCallback(() => editor.chain().focus().setHorizontalRule().run(), [editor]);

  const undo = useCallback(() => editor.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor.chain().focus().redo().run(), [editor]);

  // Color handlers with closeDropdown
  const handleTextColorSelect = useCallback((color) => {
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    closeDropdown();
  }, [editor, closeDropdown]);

  const handleHighlightSelect = useCallback((color) => {
    if (color) {
      editor.chain().focus().toggleHighlight({ color }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    closeDropdown();
  }, [editor, closeDropdown]);

  if (!editor) return null;

  const isInTable = editor.isActive('table');
  const canSink = editor.can().sinkListItem('listItem');
  const canLift = editor.can().liftListItem('listItem');
  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '8px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      {/* Text Formatting */}
      <ToolbarButton onClick={toggleBold} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)">{Icons.bold}</ToolbarButton>
      <ToolbarButton onClick={toggleItalic} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)">{Icons.italic}</ToolbarButton>
      <ToolbarButton onClick={toggleUnderline} isActive={editor.isActive('underline')} title="Underline (Ctrl+U)">{Icons.underline}</ToolbarButton>
      <ToolbarButton onClick={toggleStrike} isActive={editor.isActive('strike')} title="Strikethrough">{Icons.strike}</ToolbarButton>
      <ToolbarButton onClick={toggleCode} isActive={editor.isActive('code')} title="Inline Code">{Icons.code}</ToolbarButton>
      <ToolbarButton onClick={toggleSubscript} isActive={editor.isActive('subscript')} title="Subscript"><span style={{ fontSize: '11px', fontWeight: 500 }}>X<sub>2</sub></span></ToolbarButton>
      <ToolbarButton onClick={toggleSuperscript} isActive={editor.isActive('superscript')} title="Superscript"><span style={{ fontSize: '11px', fontWeight: 500 }}>X<sup>2</sup></span></ToolbarButton>
      <ToolbarButton onClick={clearFormatting} title="Clear Formatting">{Icons.clear}</ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton onClick={toggleH1} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1"><span style={{ fontSize: '11px', fontWeight: 700 }}>H1</span></ToolbarButton>
      <ToolbarButton onClick={toggleH2} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2"><span style={{ fontSize: '11px', fontWeight: 700 }}>H2</span></ToolbarButton>
      <ToolbarButton onClick={toggleH3} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3"><span style={{ fontSize: '11px', fontWeight: 700 }}>H3</span></ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton onClick={toggleBulletList} isActive={editor.isActive('bulletList')} title="Bullet List">{Icons.bulletList}</ToolbarButton>
      <ToolbarButton onClick={toggleOrderedList} isActive={editor.isActive('orderedList')} title="Numbered List">{Icons.orderedList}</ToolbarButton>
      <ToolbarButton onClick={toggleTaskList} isActive={editor.isActive('taskList')} title="Task List">{Icons.taskList}</ToolbarButton>
      <ToolbarButton onClick={sinkListItem} disabled={!canSink} title="Indent">{Icons.indent}</ToolbarButton>
      <ToolbarButton onClick={liftListItem} disabled={!canLift} title="Outdent">{Icons.outdent}</ToolbarButton>

      <Divider />

      {/* Link */}
      <ToolbarDropdown
        isOpen={openDropdown === 'link'}
        onClose={closeDropdown}
        trigger={
          <ToolbarButton onClick={() => toggleDropdown('link')} isActive={editor.isActive('link')} title="Insert Link">
            {Icons.link}
          </ToolbarButton>
        }
      >
        <LinkPopup editor={editor} isOpen={openDropdown === 'link'} onClose={closeDropdown} />
      </ToolbarDropdown>

      {/* Text Color */}
      <ToolbarDropdown
        isOpen={openDropdown === 'textColor'}
        onClose={closeDropdown}
        trigger={
          <ToolbarButton onClick={() => toggleDropdown('textColor')} isActive={!!editor.getAttributes('textStyle').color} title="Text Color">
            {Icons.textColor}
          </ToolbarButton>
        }
      >
        <ColorPicker
          title="Text Color"
          colors={TEXT_COLORS}
          currentColor={editor.getAttributes('textStyle').color}
          onSelect={handleTextColorSelect}
        />
      </ToolbarDropdown>

      {/* Highlight */}
      <ToolbarDropdown
        isOpen={openDropdown === 'highlight'}
        onClose={closeDropdown}
        trigger={
          <ToolbarButton onClick={() => toggleDropdown('highlight')} isActive={editor.isActive('highlight')} title="Highlight">
            {Icons.highlight}
          </ToolbarButton>
        }
      >
        <ColorPicker
          title="Highlight"
          colors={HIGHLIGHT_COLORS}
          currentColor={editor.getAttributes('highlight').color}
          onSelect={handleHighlightSelect}
        />
      </ToolbarDropdown>

      <Divider />

      {/* Alignment */}
      <ToolbarButton onClick={alignLeft} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">{Icons.alignLeft}</ToolbarButton>
      <ToolbarButton onClick={alignCenter} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">{Icons.alignCenter}</ToolbarButton>
      <ToolbarButton onClick={alignRight} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">{Icons.alignRight}</ToolbarButton>
      <ToolbarButton onClick={alignJustify} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify">{Icons.alignJustify}</ToolbarButton>

      <Divider />

      {/* Table */}
      <ToolbarDropdown
        isOpen={openDropdown === 'table'}
        onClose={closeDropdown}
        trigger={
          <ToolbarButton onClick={() => toggleDropdown('table')} isActive={isInTable} title="Table">
            {Icons.table}
          </ToolbarButton>
        }
      >
        {isInTable ? (
          <TableOperations editor={editor} onClose={closeDropdown} />
        ) : (
          <TablePopup editor={editor} onClose={closeDropdown} />
        )}
      </ToolbarDropdown>

      {/* Image */}
      <ToolbarDropdown
        isOpen={openDropdown === 'image'}
        onClose={closeDropdown}
        trigger={
          <ToolbarButton onClick={() => toggleDropdown('image')} title="Insert Image">
            {Icons.image}
          </ToolbarButton>
        }
      >
        <ImagePopup editor={editor} onClose={closeDropdown} />
      </ToolbarDropdown>

      <Divider />

      {/* Block Elements */}
      <ToolbarButton onClick={toggleBlockquote} isActive={editor.isActive('blockquote')} title="Quote">{Icons.quote}</ToolbarButton>
      <ToolbarButton onClick={toggleCodeBlock} isActive={editor.isActive('codeBlock')} title="Code Block">{Icons.codeBlock}</ToolbarButton>
      <ToolbarButton onClick={setHorizontalRule} title="Horizontal Rule">{Icons.hr}</ToolbarButton>

      {/* Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">{Icons.undo}</ToolbarButton>
        <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">{Icons.redo}</ToolbarButton>
      </div>
    </div>
  );
}

// Export with memo and custom comparison
const EditorToolbar = memo(_EditorToolbar, (prev, next) => {
  // Only re-render when editor instance changes
  return prev.editor === next.editor;
});
EditorToolbar.displayName = 'EditorToolbar';

export default EditorToolbar;
