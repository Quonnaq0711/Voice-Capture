"""
Shared File Readers

Extracts text from PDF, DOCX, and plain text files.
Used by solver tools, and available to any module that needs file content.
"""

import logging

logger = logging.getLogger(__name__)

# Max characters to read from a single file (prevents OOM on huge files)
MAX_RAW_READ = 50_000

# File types that are treated as plain text
TEXT_TYPES = frozenset(('txt', 'text', 'md', 'csv', 'json', 'log'))

# All supported types (for error messages / validation)
SUPPORTED_TYPES = frozenset({'pdf', 'docx'} | TEXT_TYPES)


def read_file(file_path: str, file_type: str) -> str:
    """
    Read text content from a file.

    Args:
        file_path: Absolute path to the file on disk.
        file_type: Lowercase extension without dot (e.g. 'pdf', 'docx', 'txt').

    Returns:
        Extracted text content.

    Raises:
        ValueError: If file_type is unsupported.
        Exception: On read failure (IO errors, corrupt files, etc.).
    """
    file_type = (file_type or '').lower().strip('.')

    if file_type == 'pdf':
        return _read_pdf(file_path)
    elif file_type == 'docx':
        return _read_docx(file_path)
    elif file_type in TEXT_TYPES:
        return _read_text(file_path)
    else:
        raise ValueError(
            f"Unsupported file type '{file_type}'. Supported: {', '.join(sorted(SUPPORTED_TYPES))}"
        )


def _read_pdf(file_path: str) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(file_path)
    pages = []
    total_len = 0
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
            total_len += len(text)
            if total_len > MAX_RAW_READ:
                break
    return "\n\n".join(pages) if pages else "(No text content found in PDF)"


def _read_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    paragraphs = []
    total_len = 0
    for p in doc.paragraphs:
        if p.text.strip():
            paragraphs.append(p.text)
            total_len += len(p.text)
            if total_len > MAX_RAW_READ:
                break
    return "\n\n".join(paragraphs) if paragraphs else "(No text content found in DOCX)"


def _read_text(file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read(MAX_RAW_READ)
