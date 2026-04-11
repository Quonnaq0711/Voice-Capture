"""
Content Compressor for AI Task Solver

Replaces hard truncation with intelligent LLM summarization.
Uses a tiered strategy:
  - Short content (≤ DIRECT_THRESHOLD): return as-is
  - Medium content (≤ MAP_REDUCE_THRESHOLD): single-pass LLM summary
  - Long content (> MAP_REDUCE_THRESHOLD): Map-Reduce (chunk → summarize each → merge)

Summaries are cached in the database (Resume.ai_content_summary) so subsequent
reads of the same file are instant.
"""

import os
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# Thresholds (in characters)
DIRECT_THRESHOLD = 3000       # ≤ this: return raw content, no summarization needed
MAP_REDUCE_THRESHOLD = 8000   # ≤ this: single-pass summary; > this: map-reduce
CHUNK_SIZE = 4000             # characters per chunk for map-reduce
MAX_SUMMARY_OUTPUT = 3500     # safety cap on final summary length (prevents context overflow)

# Reuse the same vLLM backend as the solver
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

# Lightweight LLM for summarization — low temperature, moderate tokens
_summarizer_llm = ChatOpenAI(
    model=VLLM_MODEL,
    openai_api_base=VLLM_API_BASE,
    openai_api_key="EMPTY",
    temperature=0.1,
    max_tokens=1024,
    streaming=False,
    request_timeout=60.0,
)

SUMMARIZE_PROMPT = """\
Summarize the following document content concisely. Preserve:
- Key facts, numbers, dates, and names
- Action items and decisions
- Important conclusions and recommendations
- Document structure (sections/headings) where relevant

Be concise but do NOT lose critical information. Output the summary directly, no preamble."""

MERGE_PROMPT = """\
Below are summaries of different sections of the same document.
Merge them into a single coherent summary. Remove redundancy while preserving all key information.
Output the merged summary directly, no preamble."""


def compress_content(content: str, filename: str = "") -> str:
    """
    Compress long content using LLM summarization.

    Args:
        content: Raw text content from the file
        filename: Original filename (for context in the summary header)

    Returns:
        Original content if short enough, or LLM-generated summary
    """
    if not content or len(content) <= DIRECT_THRESHOLD:
        return content

    try:
        if len(content) <= MAP_REDUCE_THRESHOLD:
            summary = _single_pass_summary(content)
        else:
            summary = _map_reduce_summary(content)

        # Safety cap: prevent overly long summaries from blowing up solver context
        if len(summary) > MAX_SUMMARY_OUTPUT:
            summary = summary[:MAX_SUMMARY_OUTPUT] + "\n[... summary truncated]"

        char_count = len(content)
        header = f"[AI Summary of {char_count:,} chars"
        if filename:
            header += f" from '{filename}'"
        header += "]\n"

        return header + summary

    except Exception as e:
        logger.error(f"Content compression failed: {e}, falling back to truncation")
        return content[:DIRECT_THRESHOLD] + "\n[... truncated — summarization failed]"


def _single_pass_summary(content: str) -> str:
    """Summarize content in a single LLM call (for medium-length content)."""
    messages = [
        SystemMessage(content=SUMMARIZE_PROMPT),
        HumanMessage(content=content),
    ]
    response = _summarizer_llm.invoke(messages)
    return response.content.strip()


def _summarize_chunk(args: tuple) -> tuple:
    """Summarize a single chunk. Returns (index, summary) for ordered reassembly."""
    i, total, chunk = args
    messages = [
        SystemMessage(content=SUMMARIZE_PROMPT),
        HumanMessage(content=f"[Section {i + 1}/{total}]\n{chunk}"),
    ]
    response = _summarizer_llm.invoke(messages)
    return (i, response.content.strip())


def _map_reduce_summary(content: str) -> str:
    """
    Map-Reduce summarization for long documents.

    Map phase: Split into chunks, summarize each in parallel (vLLM handles concurrency).
    Reduce phase: Merge all chunk summaries into one coherent summary.
    """
    chunks = _split_into_chunks(content, CHUNK_SIZE)
    num_chunks = len(chunks)
    logger.info(f"Map-Reduce: processing {num_chunks} chunks in parallel")

    # Map phase: parallel chunk summarization
    # Cap workers to avoid overwhelming vLLM; 4 concurrent is safe for most setups
    max_workers = min(num_chunks, 4)
    work_items = [(i, num_chunks, chunk) for i, chunk in enumerate(chunks)]

    chunk_summaries = [None] * num_chunks
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_summarize_chunk, item): item[0] for item in work_items}
        for future in as_completed(futures):
            try:
                idx, summary = future.result()
                chunk_summaries[idx] = summary
            except Exception as e:
                # Log and skip failed chunks — merge the rest
                chunk_idx = futures[future]
                logger.warning(f"Chunk {chunk_idx + 1}/{num_chunks} summarization failed: {e}")

    # Filter out failed chunks (None entries)
    chunk_summaries = [s for s in chunk_summaries if s]

    if not chunk_summaries:
        raise RuntimeError("All chunks failed to summarize")

    if len(chunk_summaries) == 1:
        return chunk_summaries[0]

    # Reduce phase: merge all chunk summaries
    merged_input = "\n\n---\n\n".join(
        f"Section {i + 1}:\n{s}" for i, s in enumerate(chunk_summaries)
    )
    messages = [
        SystemMessage(content=MERGE_PROMPT),
        HumanMessage(content=merged_input),
    ]
    response = _summarizer_llm.invoke(messages)
    return response.content.strip()


def _split_into_chunks(text: str, chunk_size: int) -> list:
    """
    Split text into chunks, preferring paragraph boundaries.
    Falls back to hard split if no paragraph breaks found.
    """
    chunks = []
    remaining = text

    while remaining:
        if len(remaining) <= chunk_size:
            chunks.append(remaining)
            break

        # Try to split at a paragraph boundary (double newline)
        split_pos = remaining.rfind('\n\n', 0, chunk_size)
        if split_pos < chunk_size // 2:
            # No good paragraph break found, try single newline
            split_pos = remaining.rfind('\n', 0, chunk_size)
        if split_pos < chunk_size // 2:
            # No good break at all, hard split
            split_pos = chunk_size

        chunks.append(remaining[:split_pos])
        remaining = remaining[split_pos:].lstrip()

    return chunks


def get_or_create_summary(db, attachment, content: str) -> str:
    """
    Get cached summary from DB, or create and cache a new one.

    Args:
        db: SQLAlchemy session
        attachment: Resume model instance
        content: Raw text content from the file

    Returns:
        Summary string (from cache or freshly generated)
    """
    # Return raw content if short enough — no summary needed
    if len(content) <= DIRECT_THRESHOLD:
        return content

    # Check cache: use cached summary if file hasn't been updated since
    if attachment.ai_content_summary and attachment.ai_summary_updated_at:
        file_mtime = attachment.updated_at or attachment.created_at
        if file_mtime and attachment.ai_summary_updated_at >= file_mtime:
            logger.info(f"Using cached summary for attachment {attachment.id}")
            return attachment.ai_content_summary

    # Generate new summary
    logger.info(f"Generating summary for attachment {attachment.id} ({len(content):,} chars)")
    summary = compress_content(content, attachment.original_filename)

    # Cache in DB
    try:
        attachment.ai_content_summary = summary
        attachment.ai_summary_updated_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Cached summary for attachment {attachment.id}")
    except Exception as e:
        logger.error(f"Failed to cache summary: {e}")
        db.rollback()

    return summary
