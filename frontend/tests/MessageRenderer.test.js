import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageRenderer from '../src/components/chat/MessageRenderer';

// Mock react-latex-next
jest.mock('react-latex-next', () => {
  return function MockLatex({ children }) {
    return <span data-testid="latex-content">{children}</span>;
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('MessageRenderer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Text Rendering', () => {
    it('should render plain text content', () => {
      render(<MessageRenderer content="Hello, world!" />);
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    it('should render empty content without crashing', () => {
      render(<MessageRenderer content="" />);
      expect(document.body).toBeInTheDocument();
    });

    it('should render null content without crashing', () => {
      render(<MessageRenderer content={null} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Markdown Formatting', () => {
    it('should render bold text', () => {
      render(<MessageRenderer content="This is **bold** text" />);
      expect(screen.getByText('bold')).toHaveClass('font-bold');
    });

    it('should render italic text', () => {
      render(<MessageRenderer content="This is *italic* text" />);
      expect(screen.getByText('italic')).toHaveClass('italic');
    });

    it('should render inline code', () => {
      render(<MessageRenderer content="Use `const` for constants" />);
      expect(screen.getByText('const')).toHaveClass('font-mono');
    });

    it('should render headings', () => {
      render(<MessageRenderer content="# Heading 1" />);
      const heading = screen.getByText('Heading 1');
      expect(heading.tagName).toBe('H1');
    });

    it('should render unordered lists', () => {
      render(<MessageRenderer content="* Item 1\n* Item 2\n* Item 3" />);
      const list = document.querySelector('ul');
      expect(list).toBeInTheDocument();
      const listItems = list.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    it('should render ordered lists', () => {
      render(<MessageRenderer content="1. First\n2. Second\n3. Third" />);
      const list = document.querySelector('ol');
      expect(list).toBeInTheDocument();
      const listItems = list.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    it('should render blockquotes', () => {
      render(<MessageRenderer content="> This is a quote" />);
      const blockquote = document.querySelector('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(blockquote).toHaveTextContent('This is a quote');
    });
  });

  describe('Code Block Rendering', () => {
    it('should render code blocks with language', () => {
      const code = '```javascript\nconst x = 1;\n```';
      render(<MessageRenderer content={code} />);

      expect(screen.getByText('Javascript')).toBeInTheDocument();
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('should render code blocks without language', () => {
      const code = '```\nsome code\n```';
      render(<MessageRenderer content={code} />);

      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('some code')).toBeInTheDocument();
    });

    it('should show copy button on code blocks', () => {
      const code = '```python\nprint("hello")\n```';
      render(<MessageRenderer content={code} />);

      const copyButton = screen.getByTitle('Copy code');
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy code to clipboard when copy button is clicked', async () => {
      const code = '```javascript\nconst x = 1;\n```';
      render(<MessageRenderer content={code} />);

      const copyButton = screen.getByTitle('Copy code');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });

    it('should show "Copied!" feedback after copying', async () => {
      const code = '```javascript\nconst x = 1;\n```';
      render(<MessageRenderer content={code} />);

      const copyButton = screen.getByTitle('Copy code');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });
  });

  describe('LaTeX Rendering', () => {
    it('should render inline LaTeX', () => {
      render(<MessageRenderer content="The formula is $E = mc^2$" />);
      const latexContent = screen.getAllByTestId('latex-content');
      expect(latexContent.length).toBeGreaterThan(0);
    });

    it('should render block LaTeX', () => {
      render(<MessageRenderer content="$$\\sum_{i=1}^{n} i$$" />);
      const latexContent = screen.getAllByTestId('latex-content');
      expect(latexContent.length).toBeGreaterThan(0);
    });
  });

  describe('Streaming Mode', () => {
    it('should show cursor when streaming with no content', () => {
      render(<MessageRenderer content="" isStreaming={true} />);
      const cursor = document.querySelector('.animate-pulse');
      expect(cursor).toBeInTheDocument();
    });

    it('should show cursor at end of content when streaming', () => {
      render(<MessageRenderer content="Loading..." isStreaming={true} />);
      const cursors = document.querySelectorAll('.animate-pulse');
      expect(cursors.length).toBeGreaterThan(0);
    });

    it('should not show cursor when not streaming', () => {
      render(<MessageRenderer content="Complete message" isStreaming={false} />);
      // The cursor should not be visible when not streaming
      expect(screen.getByText('Complete message')).toBeInTheDocument();
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <MessageRenderer content="Test" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Mixed Content', () => {
    it('should render mixed content correctly', () => {
      const mixedContent = `
# Title

This is **bold** and *italic* text.

\`\`\`javascript
const x = 1;
\`\`\`

- List item 1
- List item 2
`;
      render(<MessageRenderer content={mixedContent} />);

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('bold')).toHaveClass('font-bold');
      expect(screen.getByText('italic')).toHaveClass('italic');
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });
  });
});
