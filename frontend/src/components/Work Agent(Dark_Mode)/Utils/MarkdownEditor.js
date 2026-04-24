import { useState } from "react";
import ReactMarkdown from 'react-markdown';

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


export default function MarkdownEditor({ textareaRef, value, onValueChange, rows, placeholder }) {
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