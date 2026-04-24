// DOM-based HTML sanitizer: whitelist-only tags and attributes (no regex edge cases)
const ALLOWED_TAGS = new Set(['B','I','EM','STRONG','U','BR','P','UL','OL','LI','A','SPAN','DIV','BLOCKQUOTE','H1','H2','H3','H4','H5','H6']);
const SAFE_URI_RE = /^(?:https?|mailto):/i;


export default function SanitizeDescriptionHtml(html) {
  if (!html) return '';
  // Check if content has any HTML tags at all — if plain text, escape & return
  if (!/[<&]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (parent) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 3) continue; // text nodes are safe
      if (node.nodeType !== 1) { node.remove(); continue; } // remove comments, etc.
      // Depth-first: clean children BEFORE unwrapping, so promoted children are already safe
      clean(node);
      if (!ALLOWED_TAGS.has(node.tagName)) {
        // Unwrap: keep (already-cleaned) children, drop the tag
        node.replaceWith(...node.childNodes);
        continue;
      }
      // Strip all attributes except href on <a>
      for (const attr of [...node.attributes]) {
        if (node.tagName === 'A' && attr.name === 'href') {
          if (!SAFE_URI_RE.test(attr.value.trim())) {
            node.removeAttribute('href');
          }
        } else {
          node.removeAttribute(attr.name);
        }
      }
      // Force links to open safely in new tab
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
};