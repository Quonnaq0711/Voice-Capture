import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import '../../styles/MessageRenderer.css';

// Parse content outside component to avoid recreation
const parseContent = (text) => {
  if (!text) return [];
  const parts = [];
  let currentIndex = 0;
  const contentRegex = /```(\w+)?\n([\s\S]*?)```|(\$\$[\s\S]*?\$\$)/g;
  let match;

  while ((match = contentRegex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push({ type: 'text', content: text.slice(currentIndex, match.index) });
    }
    if (match[1] !== undefined || match[2] !== undefined) {
      parts.push({ type: 'codeblock', language: match[1] || 'code', content: match[2] });
    } else if (match[3] !== undefined) {
      parts.push({ type: 'latex-block', content: match[3] });
    }
    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(currentIndex) });
  }
  return parts;
};

const MessageRenderer = ({ content, className, isStreaming }) => {
  // Use array instead of Set for serializable state (DevTools compatible)
  const [copiedBlocks, setCopiedBlocks] = useState([]);
  const timersRef = useRef(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const copyToClipboard = useCallback(async (text, blockIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      // Add to array if not already present
      setCopiedBlocks(prev => prev.includes(blockIndex) ? prev : [...prev, blockIndex]);

      // Clear existing timer for this block
      if (timersRef.current.has(blockIndex)) {
        clearTimeout(timersRef.current.get(blockIndex));
      }

      const timerId = setTimeout(() => {
        // Remove from array
        setCopiedBlocks(prev => prev.filter(idx => idx !== blockIndex));
        timersRef.current.delete(blockIndex);
      }, 2000);

      timersRef.current.set(blockIndex, timerId);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, []);

  // Memoize parsed content
  const parsedParts = useMemo(() => parseContent(content), [content]);

  if (isStreaming && !content) {
    return <span className="inline-block w-2 h-5 bg-gray-600 animate-pulse"></span>;
  }
  
  // Render text with inline formatting
   const renderText = (text) => {
     if (!text) return '';

     const parts = [];
     let currentText = text;

     // Process different inline formats in order
     // Use match.index for stable keys across re-renders
     const formatters = [
       {
         name: 'code',
         regex: /`([^`]+)`/g,
         render: (match, content, matchIndex) => (
           <code key={`code-${matchIndex}`} className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono">
             {content}
           </code>
         )
       },
       {
         name: 'latex',
         regex: /\$([^\$]+?)\$/g,
         render: (match, content, matchIndex) => {
           try {
        return (
          <span key={`latex-${matchIndex}`} className="katex-inline" style={{ display: 'inline-block' }}>
            <Latex>{`$${content}$`}</Latex>
          </span>
        );
      } catch (error) {
        console.error('LaTeX rendering error:', error);
        return <span key={`latex-err-${matchIndex}`} className="text-red-500">{`$${content}$`}</span>
      }
         }
       },
       {
         name: 'bold',
         regex: /\*\*([^*]+)\*\*/g,
         render: (match, content, matchIndex) => (
           <strong key={`bold-${matchIndex}`} className="font-bold">
             {content}
           </strong>
         )
       },
       {
         name: 'italic',
         regex: /\*([^*]+)\*/g,
         render: (match, content, matchIndex) => (
           <em key={`italic-${matchIndex}`} className="italic">
             {content}
           </em>
         )
       }
     ];
     
     // Apply all formatters
     let processedParts = [currentText];
     
     formatters.forEach(formatter => {
       const newParts = [];
       
       processedParts.forEach(part => {
         if (typeof part === 'string') {
           const subParts = [];
           let lastIndex = 0;
           let match;
           
           formatter.regex.lastIndex = 0; // Reset regex
           while ((match = formatter.regex.exec(part)) !== null) {
             // Add text before match
             if (match.index > lastIndex) {
               const beforeText = part.slice(lastIndex, match.index);
               if (beforeText) subParts.push(beforeText);
             }
             
             // Add formatted element - use match.index for stable key
             subParts.push(formatter.render(match[0], match[1], match.index));
             
             lastIndex = match.index + match[0].length;
           }
           
           // Add remaining text
           if (lastIndex < part.length) {
             const remainingText = part.slice(lastIndex);
             if (remainingText) subParts.push(remainingText);
           }
           
           newParts.push(...(subParts.length > 0 ? subParts : [part]));
         } else {
           newParts.push(part);
         }
       });
       
       processedParts = newParts;
     });
     
     return processedParts.length > 1 ? processedParts : processedParts[0] || text;
   };

  // Render formatted text with cursor at the end
  const renderFormattedTextWithCursor = (text) => {
    const elements = renderFormattedText(text);
    
    // If elements is an array, add cursor to the last element
    if (Array.isArray(elements) && elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      
      // Special handling for <br> tags - they can't have children
      if (lastElement.type === 'br') {
        return [
          ...elements,
          <span key="cursor" className="inline-block w-2 h-5 bg-gray-600 ml-1 animate-pulse"></span>
        ];
      }
      
      // Clone the last element and add cursor
      const lastElementWithCursor = React.cloneElement(lastElement, {
        key: lastElement.key,
        children: [
          lastElement.props.children,
          <span key="cursor" className="inline-block w-2 h-5 bg-gray-600 ml-1 animate-pulse"></span>
        ]
      });
      
      return [
        ...elements.slice(0, -1),
        lastElementWithCursor
      ];
    }
    
    // If it's a single element or string, wrap it with cursor
    return (
      <span>
        {elements}
        <span className="inline-block w-2 h-5 bg-gray-600 ml-1 animate-pulse"></span>
      </span>
    );
  };
  
  // Render formatted text with line breaks and block elements
   const renderFormattedText = (text) => {
     const lines = text.split('\n');
     const elements = [];
     let currentList = null;
     let currentListType = null;
     
     lines.forEach((line, index) => {
       const trimmedLine = line.trim();
       
       // Handle unordered lists
       if (trimmedLine.match(/^[*+-]\s+/)) {
         const content = trimmedLine.replace(/^[*+-]\s+/, '');
         if (currentListType !== 'ul') {
           if (currentList) {
             elements.push(currentList);
           }
           currentList = {
             type: 'ul',
             items: [],
             key: `list-${index}`
           };
           currentListType = 'ul';
         }
         currentList.items.push({ content: renderText(content), key: `item-${index}` });
       }
       // Handle ordered lists
       else if (trimmedLine.match(/^\d+\.\s+/)) {
         const content = trimmedLine.replace(/^\d+\.\s+/, '');
         if (currentListType !== 'ol') {
           if (currentList) {
             elements.push(currentList);
           }
           currentList = {
             type: 'ol',
             items: [],
             key: `list-${index}`
           };
           currentListType = 'ol';
         }
         currentList.items.push({ content: renderText(content), key: `item-${index}` });
       }
       // Handle blockquotes
       else if (trimmedLine.startsWith('> ')) {
         if (currentList) {
           elements.push(currentList);
           currentList = null;
           currentListType = null;
         }
         const content = trimmedLine.replace(/^>\s*/, '');
         elements.push({
           type: 'blockquote',
           content: renderText(content),
           key: `quote-${index}`
         });
       }
       // Handle headings
       else if (trimmedLine.match(/^#{1,6}\s+/)) {
         if (currentList) {
           elements.push(currentList);
           currentList = null;
           currentListType = null;
         }
         const level = trimmedLine.match(/^(#{1,6})/)[1].length;
         const content = trimmedLine.replace(/^#{1,6}\s+/, '');
         elements.push({
           type: 'heading',
           level,
           content: renderText(content),
           key: `heading-${index}`
         });
       }
       // Handle regular text
       else {
         if (currentList) {
           elements.push(currentList);
           currentList = null;
           currentListType = null;
         }
         if (trimmedLine || index === 0) {
           elements.push({
             type: 'text',
             content: renderText(line),
             key: `text-${index}`,
             isEmpty: !trimmedLine
           });
         }
       }
     });
     
     // Add any remaining list
     if (currentList) {
       elements.push(currentList);
     }
     
     return elements.map(element => {
       switch (element.type) {
         case 'ul':
           return (
             <ul key={element.key} className="list-disc list-inside mb-2 space-y-1 ml-4">
               {element.items.map(item => (
                 <li key={item.key} className="text-sm">{item.content}</li>
               ))}
             </ul>
           );
         case 'ol':
           return (
             <ol key={element.key} className="list-decimal list-inside mb-2 space-y-1 ml-4">
               {element.items.map(item => (
                 <li key={item.key} className="text-sm">{item.content}</li>
               ))}
             </ol>
           );
         case 'blockquote':
           return (
             <blockquote key={element.key} className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2 bg-gray-50 py-2 rounded-r">
               {element.content}
             </blockquote>
           );
         case 'heading':
           const HeadingTag = `h${Math.min(element.level, 6)}`;
           const headingClasses = {
             1: 'text-xl font-bold mb-3 mt-4',
             2: 'text-lg font-bold mb-2 mt-3',
             3: 'text-base font-bold mb-2 mt-2',
             4: 'text-sm font-bold mb-1 mt-2',
             5: 'text-sm font-semibold mb-1 mt-1',
             6: 'text-xs font-semibold mb-1 mt-1'
           };
           return React.createElement(
             HeadingTag,
             {
               key: element.key,
               className: headingClasses[element.level] || headingClasses[3]
             },
             element.content
           );
         case 'text':
         default:
           return element.isEmpty ? (
             <br key={element.key} />
           ) : (
             <div key={element.key} className="mb-1 last:mb-0">
               {element.content}
             </div>
           );
       }
     });
   };
  
  return (
    <div className={className}>
      {parsedParts.map((part, index) => {
         if (part.type === 'codeblock') {
           const isCopied = copiedBlocks.includes(index);
           return (
             <div key={index} className="my-4 group">
               <div className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-medium rounded-t-lg border-b border-gray-600 flex justify-between items-center">
                 <span>{part.language.charAt(0).toUpperCase() + part.language.slice(1)}</span>
                 <button
                   onClick={() => copyToClipboard(part.content, index)}
                   className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-700 rounded flex items-center space-x-1"
                   title="Copy code"
                 >
                   {isCopied ? (
                     <>
                       <CheckIcon className="w-4 h-4 text-green-400" />
                       <span className="text-green-400 text-xs">Copied!</span>
                     </>
                   ) : (
                     <>
                       <DocumentDuplicateIcon className="w-4 h-4" />
                       <span className="text-xs">Copy</span>
                     </>
                   )}
                 </button>
               </div>
               <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto border border-gray-700 border-t-0 relative">
                 <code className="font-mono text-sm leading-relaxed whitespace-pre block">
                   {part.content}{isStreaming && index === parsedParts.length - 1 && (
                     <span className="inline-block w-2 h-5 bg-gray-300 animate-pulse"></span>
                   )}
                 </code>
               </pre>
             </div>
           );
         } else if (part.type === 'latex-block') {
           try {
             return (
               <div key={index} className="my-2 katex-container" style={{ display: 'block', overflow: 'auto' }}>
                 <Latex>{part.content}</Latex>
               </div>
             );
           } catch (error) {
             console.error('LaTeX block rendering error:', error);
             return <div key={index} className="my-2 text-red-500">{part.content}</div>;
           }
         } else {
           return (
             <div key={index}>
               {isStreaming && index === parsedParts.length - 1 ?
                 renderFormattedTextWithCursor(part.content) : 
                 renderFormattedText(part.content)
               }
             </div>
           );
         }
       })}
    </div>
  );
};

export default MessageRenderer;