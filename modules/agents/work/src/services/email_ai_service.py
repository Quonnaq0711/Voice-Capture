"""
Email AI Service

Provides AI-powered email analysis using vLLM:
- Email summarization with key points and sentiment
- Email translation to multiple languages
"""

import os
import sys
import logging
import httpx
import json
import re
from typing import Dict, Any, Optional, List, AsyncIterator

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

# LangChain imports for optimized streaming (same as personal assistant chat)
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# vLLM Configuration
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")


class EmailAIService:
    """
    AI-powered email analysis service using vLLM.
    
    Features:
    - Email summarization (1-2 sentences + 3-5 key points + sentiment)
    - Email translation (multiple languages)
    
    Uses LangChain's ChatOpenAI for optimized streaming performance,
    matching the personal assistant chat implementation.
    """
    
    # Supported languages for translation
    SUPPORTED_LANGUAGES = {
        "en": "English",
        "zh": "Chinese (Simplified)",
        "zh-TW": "Chinese (Traditional)",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "ja": "Japanese",
        "ko": "Korean",
        "pt": "Portuguese",
        "ru": "Russian",
        "ar": "Arabic",
        "it": "Italian",
        "nl": "Dutch",
        "vi": "Vietnamese",
        "th": "Thai",
    }
    
    def __init__(self):
        self.api_base = VLLM_API_BASE
        self.model = VLLM_MODEL
        self.client = httpx.AsyncClient(timeout=60.0)
        
        # Initialize LangChain ChatOpenAI for streaming (same pattern as personal assistant)
        self.llm = ChatOpenAI(
            model=self.model,
            openai_api_base=self.api_base,
            openai_api_key="EMPTY",  # vLLM doesn't require API key
            temperature=0.3,
            max_tokens=512,
            streaming=True,
            request_timeout=60.0
        )
    
    async def _call_llm(self, prompt: str, max_tokens: int = 1024, temperature: float = 0.3) -> str:
        """
        Call vLLM for text generation.
        
        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (lower = more focused)
            
        Returns:
            Generated text response
        """
        try:
            response = await self.client.post(
                f"{self.api_base}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                logger.error(f"vLLM API error: {response.status_code} - {response.text}")
                raise Exception(f"vLLM API error: {response.status_code}")
            
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()
            
        except httpx.TimeoutException:
            logger.error("vLLM request timed out")
            raise Exception("AI request timed out. Please try again.")
        except Exception as e:
            logger.error(f"vLLM call failed: {str(e)}")
            raise
    
    # NOTE: _call_llm_stream is kept for backwards compatibility but currently unused.
    # All streaming operations use self.llm.astream() from LangChain for better performance.
    async def _call_llm_stream(self, prompt: str, max_tokens: int = 1024, temperature: float = 0.3) -> AsyncIterator[str]:
        """
        Call vLLM for streaming text generation (legacy method - consider using llm.astream instead).
        
        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (lower = more focused)
            
        Yields:
            Generated text tokens as they arrive
        """
        try:
            async with self.client.stream(
                "POST",
                f"{self.api_base}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True,
                },
                timeout=60.0
            ) as response:
                if response.status_code != 200:
                    text = await response.aread()
                    logger.error(f"vLLM API error: {response.status_code} - {text}")
                    raise Exception(f"vLLM API error: {response.status_code}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
                            
        except httpx.TimeoutException:
            logger.error("vLLM streaming request timed out")
            raise Exception("AI request timed out. Please try again.")
        except Exception as e:
            logger.error(f"vLLM streaming call failed: {str(e)}")
            raise
    
    async def summarize_email_stream(self, email_content: str, sender: str = "", subject: str = "") -> AsyncIterator[Dict[str, Any]]:
        """
        Summarize an email with streaming response for real-time UI updates.
        Uses readable text format (not JSON) so users see meaningful content during streaming.
        
        Args:
            email_content: The email body text
            sender: Email sender name/address
            subject: Email subject line
            
        Yields:
            Dict with type 'token' for streaming tokens, or 'complete' for final result
        """
        # Build context
        context_parts = []
        if sender:
            context_parts.append(f"From: {sender}")
        if subject:
            context_parts.append(f"Subject: {subject}")
        context = "\n".join(context_parts)
        
        # Clean email content
        cleaned_content = self._clean_email_content(email_content)
        
        # Limit content length
        max_content_length = 4000
        if len(cleaned_content) > max_content_length:
            cleaned_content = cleaned_content[:max_content_length] + "..."
        
        # Use readable text format prompt (not JSON) for better streaming UX
        prompt = f"""Analyze this email and provide a concise analysis.

{context}

Email Content:
{cleaned_content}

Please provide your analysis in the following format:

**Summary:**
(Write a brief 1-2 sentence summary of the email)

**Key Points:**
• [Action] (any action items or requests)
• [Deadline] (any deadlines or time-sensitive items)
• [Info] (important information)
(List 3-5 key points, each on its own line starting with •)

**Sentiment:** (professional/friendly/urgent/neutral/frustrated)

Keep your response concise and focused."""

        try:
            full_response = ""
            # Use LangChain's native astream() for optimized streaming (same as personal assistant)
            messages = [HumanMessage(content=prompt)]
            
            # Streaming with look-ahead buffering to hide metadata from live stream
            visible_streamed_len = 0
            hidden_marker = "**Sentiment:**"
            
            async for chunk in self.llm.astream(messages):
                chunk_content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                
                if chunk_content:
                    full_response += chunk_content
                    
                    # Check if marker exists
                    marker_idx = full_response.find(hidden_marker)
                    
                    if marker_idx != -1:
                        # Marker found. Yield everything before it, then stop visible streaming.
                        if visible_streamed_len < marker_idx:
                            to_yield = full_response[visible_streamed_len:marker_idx]
                            if to_yield:
                                yield {"type": "token", "content": to_yield}
                                visible_streamed_len = marker_idx
                    else:
                        # Marker not found yet. Buffering to prevent partial marker leak.
                        safe_len = len(full_response) - len(hidden_marker)
                        if safe_len > visible_streamed_len:
                            to_yield = full_response[visible_streamed_len:safe_len]
                            if to_yield:
                                yield {"type": "token", "content": to_yield}
                                visible_streamed_len = safe_len
            
            # Final flush if marker was never found
            if full_response.find(hidden_marker) == -1 and visible_streamed_len < len(full_response):
                 yield {"type": "token", "content": full_response[visible_streamed_len:]}
            
            # Parse the readable text response to extract structured data
            parsed = self._parse_readable_summary(full_response)
            
            yield {
                "type": "complete",
                "summary": parsed.get("summary", "Unable to summarize email."),
                "key_points": parsed.get("key_points", []),
                "sentiment": self._normalize_sentiment(parsed.get("sentiment", "neutral"))
            }
                
        except Exception as e:
            logger.error(f"Email summarization streaming failed: {str(e)}")
            yield {
                "type": "error",
                "content": str(e)
            }
    
    def _parse_readable_summary(self, text: str) -> Dict[str, Any]:
        """
        Parse readable text format summary into structured data.
        
        Args:
            text: The readable text response from LLM
            
        Returns:
            Dict with summary, key_points, and sentiment
        """
        result = {
            "summary": "",
            "key_points": [],
            "sentiment": "neutral"
        }
        
        try:
            # Extract summary section
            summary_match = re.search(r'\*\*Summary:\*\*\s*\n?(.*?)(?=\*\*Key Points:\*\*|\*\*Sentiment:\*\*|$)', text, re.DOTALL | re.IGNORECASE)
            if summary_match:
                result["summary"] = summary_match.group(1).strip()
            
            # Extract key points section
            key_points_match = re.search(r'\*\*Key Points:\*\*\s*\n?(.*?)(?=\*\*Sentiment:\*\*|$)', text, re.DOTALL | re.IGNORECASE)
            if key_points_match:
                points_text = key_points_match.group(1).strip()
                # Parse bullet points
                for line in points_text.split('\n'):
                    line = line.strip()
                    if line.startswith('•') or line.startswith('-') or line.startswith('*'):
                        point_text = line.lstrip('•-* ').strip()
                        if point_text:
                            # Detect type from brackets like [Action], [Deadline], [Info]
                            point_type = "info"
                            type_match = re.match(r'\[(\w+)\]\s*(.*)', point_text)
                            if type_match:
                                type_label = type_match.group(1).lower()
                                point_text = type_match.group(2).strip()
                                if type_label in ['action', 'request', 'task']:
                                    point_type = "action"
                                elif type_label in ['deadline', 'date', 'time', 'urgent']:
                                    point_type = "deadline"
                            result["key_points"].append({
                                "type": point_type,
                                "text": point_text
                            })
            
            # Extract sentiment
            sentiment_match = re.search(r'\*\*Sentiment:\*\*\s*(\w+)', text, re.IGNORECASE)
            if sentiment_match:
                result["sentiment"] = sentiment_match.group(1).strip().lower()
        
        except Exception as e:
            logger.error(f"Error parsing readable summary: {e}")
        
        return result
    
    async def summarize_email(self, email_content: str, sender: str = "", subject: str = "") -> Dict[str, Any]:
        """
        Summarize an email with key points and sentiment analysis.
        
        Args:
            email_content: The email body text
            sender: Email sender name/address
            subject: Email subject line
            
        Returns:
            Dict containing:
            - summary: 1-2 sentence summary
            - key_points: List of 3-5 key points
            - sentiment: Sender's sentiment (professional, friendly, urgent, neutral, frustrated)
        """
        # Build context
        context_parts = []
        if sender:
            context_parts.append(f"From: {sender}")
        if subject:
            context_parts.append(f"Subject: {subject}")
        context = "\n".join(context_parts)
        
        # Clean email content (remove excessive whitespace, signatures, etc.)
        cleaned_content = self._clean_email_content(email_content)
        
        # Limit content length to avoid token limits
        max_content_length = 4000
        if len(cleaned_content) > max_content_length:
            cleaned_content = cleaned_content[:max_content_length] + "..."
        
        prompt = f"""Analyze this email and provide:
1. A brief summary (1-2 sentences maximum)
2. 3-5 key points (actionable items, deadlines, important information)
3. The sender's sentiment/tone

{context}

Email Content:
{cleaned_content}

Respond in this exact JSON format:
{{
    "summary": "Brief 1-2 sentence summary here",
    "key_points": [
        {{"type": "action", "text": "Action item or request"}},
        {{"type": "deadline", "text": "Any deadline or time-sensitive item"}},
        {{"type": "info", "text": "Important information"}}
    ],
    "sentiment": "professional|friendly|urgent|neutral|frustrated"
}}

Use these types for key_points:
- "action": Action items, requests, or tasks
- "deadline": Deadlines, dates, or time-sensitive items
- "info": General important information

Choose one sentiment that best describes the sender's tone."""

        try:
            response = await self._call_llm(prompt, max_tokens=512, temperature=0.2)
            
            # Parse JSON response
            # Extract JSON from response (handle markdown code blocks)
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            
            result = json.loads(json_str)
            
            # Validate and normalize response
            return {
                "summary": result.get("summary", "Unable to summarize email."),
                "key_points": result.get("key_points", [])[:5],  # Limit to 5 points
                "sentiment": self._normalize_sentiment(result.get("sentiment", "neutral"))
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            # Return a fallback response
            return {
                "summary": "This email contains information that requires your attention.",
                "key_points": [{"type": "info", "text": "Unable to extract key points automatically."}],
                "sentiment": "neutral"
            }
        except Exception as e:
            logger.error(f"Email summarization failed: {str(e)}")
            raise
    
    async def translate_email(self, email_content: str, target_language: str, subject: str = "") -> Dict[str, Any]:
        """
        Translate an email to a target language.
        
        Args:
            email_content: The email body text
            target_language: Target language code (e.g., 'zh', 'es', 'fr')
            subject: Email subject line (optional, will be translated too)
            
        Returns:
            Dict containing:
            - translated_content: Translated email body
            - translated_subject: Translated subject (if provided)
            - detected_language: Detected source language
            - target_language: Target language name
        """
        if target_language not in self.SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {target_language}")
        
        target_lang_name = self.SUPPORTED_LANGUAGES[target_language]
        
        # Clean and limit content
        cleaned_content = self._clean_email_content(email_content)
        max_content_length = 4000
        if len(cleaned_content) > max_content_length:
            cleaned_content = cleaned_content[:max_content_length] + "..."
        
        prompt = f"""Translate the following email to {target_lang_name}.
Preserve the original formatting and tone of the email.
Only translate the content, do not add any commentary.

{f"Subject: {subject}" if subject else ""}

Email Content:
{cleaned_content}

Respond in this exact JSON format:
{{
    "detected_language": "detected source language name",
    "translated_subject": "translated subject line or empty string if no subject",
    "translated_content": "the full translated email content"
}}"""

        try:
            response = await self._call_llm(prompt, max_tokens=2048, temperature=0.1)
            
            # Parse JSON response
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            
            result = json.loads(json_str)
            
            return {
                "translated_content": result.get("translated_content", "Translation failed."),
                "translated_subject": result.get("translated_subject", ""),
                "detected_language": result.get("detected_language", "Unknown"),
                "target_language": target_lang_name
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse translation response as JSON: {e}")
            logger.debug(f"Raw response: {response}")
            
            # Try regex fallback to extract fields
            # Helper to extract value by key
            def extract_field(key):
                # Match "key": "value" or "key": 'value', handling multiline
                pattern = fr'"{key}"\s*:\s*"(.*?)(?<!\\)"'
                match = re.search(pattern, response, re.DOTALL)
                if match:
                    return match.group(1).replace('\\"', '"').replace('\\n', '\n')
                return None

            content = extract_field("translated_content")
            if content:
                subject = extract_field("translated_subject") or ""
                detected_lang = extract_field("detected_language") or "Unknown"
                
                return {
                    "translated_content": content,
                    "translated_subject": subject,
                    "detected_language": detected_lang,
                    "target_language": target_lang_name
                }
            
            # If regex also fails, return raw response as fallback
            return {
                "translated_content": response,
                "translated_subject": "",
                "detected_language": "Unknown",
                "target_language": target_lang_name
            }
        except Exception as e:
            logger.error(f"Email translation failed: {str(e)}")
            raise
    
    # Patterns that indicate the start of a quoted reply chain.
    # Order matters: more specific patterns first.
    _REPLY_SEPARATOR_PATTERNS = [
        # "On <date> <name> <email> wrote:" — Gmail / Apple Mail style (may span 2 lines)
        re.compile(r'^On .+wrote:\s*$', re.IGNORECASE),
        # Outlook-style separator lines
        re.compile(r'^-{3,}\s*Original Message\s*-{3,}', re.IGNORECASE),
        re.compile(r'^_{3,}\s*$'),  # ___ line used by some Outlook clients
        # Note: Outlook "From: / Sent:" header block is handled via two-line check below
        # Forwarded message marker
        re.compile(r'^-{5,}\s*Forwarded message\s*-{5,}', re.IGNORECASE),
        # Date + sender header block (some clients)
        re.compile(r'^\d{1,2}/\d{1,2}/\d{2,4},?\s.+<.+@.+>\s*:?\s*$'),
        # "Sent from my iPhone" / "Sent from Outlook" (treat as signature, stop here)
        re.compile(r'^Sent from (?:my |Mail for |Outlook)', re.IGNORECASE),
    ]

    def _extract_latest_reply(self, content: str) -> str:
        """
        Extract only the most recent reply from an email thread.

        Scans line-by-line and stops at the first recognised reply separator
        so that only the newest message is kept.
        """
        lines = content.split('\n')
        result_lines: list[str] = []

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # Skip already-quoted lines (> prefix)
            if stripped.startswith('>'):
                i += 1
                continue

            # Check single-line separator patterns
            matched = False
            for pat in self._REPLY_SEPARATOR_PATTERNS:
                if pat.search(stripped):
                    matched = True
                    break

            # Two-line "On ...\n... wrote:" pattern (Gmail wraps long lines)
            if not matched and stripped.lower().startswith('on ') and i + 1 < len(lines):
                next_stripped = lines[i + 1].strip()
                if next_stripped.endswith('wrote:') or next_stripped.endswith('wrote: '):
                    matched = True

            # Outlook "From: <email>\nSent: <date>" forwarded header
            if not matched and re.match(r'^From:\s+.+@', stripped, re.IGNORECASE) and i + 1 < len(lines):
                next_stripped = lines[i + 1].strip()
                if re.match(r'^(Sent|Date):\s+', next_stripped, re.IGNORECASE):
                    matched = True

            if matched:
                break

            result_lines.append(line)
            i += 1

        return '\n'.join(result_lines)

    def _clean_email_content(self, content: str) -> str:
        """
        Clean email content for better LLM processing.

        - Strips HTML tags
        - Extracts only the latest reply (removes quoted history)
        - Removes email signatures
        - Removes excessive whitespace
        """
        # Remove HTML tags if present
        content = re.sub(r'<[^>]+>', ' ', content)
        # Decode common HTML entities
        content = content.replace('&nbsp;', ' ').replace('&amp;', '&')
        content = content.replace('&lt;', '<').replace('&gt;', '>')
        content = content.replace('&#39;', "'").replace('&quot;', '"')

        # Remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        content = re.sub(r' +', ' ', content)

        # Extract only the latest reply (core fix for long threads)
        content = self._extract_latest_reply(content)

        # Remove common signature patterns
        # "-- " is a standard email signature delimiter
        if '\n-- \n' in content:
            content = content.split('\n-- \n')[0]

        # Truncate to stay within LLM context limits (~3000 chars ≈ ~750 tokens)
        # Leaves room for system prompt, instructions, and response generation
        MAX_CONTENT_CHARS = 3000
        if len(content) > MAX_CONTENT_CHARS:
            content = content[:MAX_CONTENT_CHARS] + "\n\n[... email truncated for length ...]"

        return content.strip()
    
    def _normalize_sentiment(self, sentiment: str) -> str:
        """Normalize sentiment to one of the supported values."""
        sentiment = sentiment.lower().strip()
        valid_sentiments = ['professional', 'friendly', 'urgent', 'neutral', 'frustrated']
        
        # Map common variations
        sentiment_map = {
            'formal': 'professional',
            'business': 'professional',
            'casual': 'friendly',
            'warm': 'friendly',
            'positive': 'friendly',
            'critical': 'frustrated',
            'angry': 'frustrated',
            'annoyed': 'frustrated',
            'concerned': 'urgent',
            'important': 'urgent',
            'time-sensitive': 'urgent',
        }
        
        if sentiment in valid_sentiments:
            return sentiment
        elif sentiment in sentiment_map:
            return sentiment_map[sentiment]
        else:
            return 'neutral'
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Return dict of supported language codes and names."""
        return self.SUPPORTED_LANGUAGES.copy()
    
    # Buffer size for detecting AI preambles in streaming responses
    PREAMBLE_BUFFER_SIZE = 60
    
    # Common AI preamble patterns that LLMs often add despite instructions
    AI_PREAMBLE_PATTERNS = [
        "Certainly! Here is the polished version:",
        "Certainly! Here is the improved version:",
        "Certainly! Here's the polished version:",
        "Certainly! Here's the improved version:",
        "Certainly! Here is the email:",
        "Certainly! Here's the email:",
        "Certainly! Here is the text:",
        "Certainly! Here's the text:",
        "Here is the polished version:",
        "Here is the improved version:",
        "Here's the polished version:",
        "Here's the improved version:",
        "Here is the revised email:",
        "Here's the revised email:",
        "Here is the email:",
        "Here's the email:",
        "Here is the draft:",
        "Here's the draft:",
        "Here is the text:",
        "Here's the text:",
        "Certainly!",
        "Sure!",
        "Of course!",
        "Absolutely!",
        "I'd be happy to help!",
    ]
    
    def _strip_ai_preamble(self, text: str) -> str:
        """
        Strip common AI conversational preambles from the beginning of a response.
        
        Many LLMs add phrases like "Certainly! Here is the polished version:" even when
        explicitly instructed not to. This function removes such patterns.
        
        Args:
            text: The AI-generated text to clean
            
        Returns:
            Text with preamble removed, if any was detected
        """
        cleaned = text.strip()
        
        # Check exact pattern matches first
        for pattern in self.AI_PREAMBLE_PATTERNS:
            if cleaned.startswith(pattern):
                cleaned = cleaned[len(pattern):].lstrip()
                logger.debug(f"Stripped AI preamble: '{pattern}'")
                return cleaned
        
        # Use regex for more flexible matching
        # Match: "Certainly/Sure/etc!" optionally followed by "Here is/Here's the X version/email:"
        preamble_regex = r'^(Certainly!?|Sure!?|Of course!?|Absolutely!?)\s*(Here(?:\'s| is) (?:the )?(?:polished|improved|revised|updated|draft|email).*?:)?\s*'
        match = re.match(preamble_regex, cleaned, re.IGNORECASE)
        if match and match.group(0).strip():
            cleaned = cleaned[match.end():].lstrip()
            logger.debug(f"Stripped AI preamble (regex): '{match.group(0)}'")
        
        return cleaned
    
    # Common AI-added signature patterns that should be stripped from polished text
    # These patterns match signatures that AI adds but were not in the original text
    AI_SIGNATURE_PATTERNS = [
        # Patterns with name placeholders
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Your Name\]$',
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Your name\]$',
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Name\]$',
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Sender\]$',
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Sender Name\]$',
        # Standalone closings without names
        r'\n\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*$',
        # Single newline variants
        r'\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Your Name\]$',
        r'\n(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*\n\[Name\]$',
    ]
    
    def _strip_ai_additions(self, text: str, original_text: str = "") -> str:
        """
        Strip common AI additions from polished text.
        
        This includes:
        - Preambles at the start ("Certainly! Here is...")
        - Auto-added signatures at the end ("Best regards, [Your Name]")
        
        Args:
            text: The AI-generated text to clean
            original_text: The original text before AI modification (used to detect additions)
            
        Returns:
            Cleaned text without AI additions
        """
        # First strip preambles
        cleaned = self._strip_ai_preamble(text)
        
        # Check if original text had a signature - if not, strip any AI-added signature
        original_has_signature = False
        if original_text:
            # Check if original ends with a signature-like pattern
            sig_check = r'(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best|Thanks|Thank you|Cheers),?\s*$'
            original_has_signature = bool(re.search(sig_check, original_text.strip(), re.IGNORECASE))
        
        # If original didn't have a signature, strip any AI-added ones
        if not original_has_signature:
            for pattern in self.AI_SIGNATURE_PATTERNS:
                cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.MULTILINE)
        
        return cleaned.strip()
    
    async def translate_email_stream(self, email_content: str, target_language: str, subject: str = "") -> AsyncIterator[Dict[str, Any]]:
        """
        Translate an email with streaming response for real-time UI updates.
        Uses readable text format (not JSON) so users see meaningful content during streaming.
        
        Args:
            email_content: The email body text
            target_language: Target language code
            subject: Email subject line
            
        Yields:
            Dict with type 'token' for streaming tokens, or 'complete' for final result
        """
        if target_language not in self.SUPPORTED_LANGUAGES:
             yield { "type": "error", "content": f"Unsupported language: {target_language}" }
             return

        target_lang_name = self.SUPPORTED_LANGUAGES[target_language]
        
        # Clean and limit content
        cleaned_content = self._clean_email_content(email_content)
        max_content_length = 4000
        if len(cleaned_content) > max_content_length:
            cleaned_content = cleaned_content[:max_content_length] + "..."
            
        prompt = f"""Translate the following email to {target_lang_name}.
Please provide the translation in the following exact format:

**Subject:** [Translated Subject]
**Translation:**
[Translated Body]

**Detected Language:** [Language Name]

Original Subject: {subject}

Email Content:
{cleaned_content}
"""

        try:
            full_response = ""
            messages = [HumanMessage(content=prompt)]
            
            # Streaming with look-ahead buffering to hide metadata from live stream
            visible_streamed_len = 0
            hidden_marker = "**Detected Language:**"
            
            async for chunk in self.llm.astream(messages):
                chunk_content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                
                if chunk_content:
                    full_response += chunk_content
                    
                    # Check if marker exists
                    marker_idx = full_response.find(hidden_marker)
                    
                    if marker_idx != -1:
                        # Marker found. Yield everything before it, then stop visible streaming.
                        if visible_streamed_len < marker_idx:
                            to_yield = full_response[visible_streamed_len:marker_idx]
                            if to_yield:
                                yield {"type": "token", "content": to_yield}
                                visible_streamed_len = marker_idx
                    else:
                        # Marker not found yet. But it might be partially forming at the end.
                        # Keep a buffer of len(marker) characters.
                        safe_len = len(full_response) - len(hidden_marker)
                        if safe_len > visible_streamed_len:
                            to_yield = full_response[visible_streamed_len:safe_len]
                            if to_yield:
                                yield {"type": "token", "content": to_yield}
                                visible_streamed_len = safe_len
            
            # Final flush if marker was never found (fallback)
            if full_response.find(hidden_marker) == -1 and visible_streamed_len < len(full_response):
                 yield {"type": "token", "content": full_response[visible_streamed_len:]}
            
            # Parse the readable text response
            parsed = self._parse_readable_translation(full_response, target_lang_name)
            
            yield {
                "type": "complete",
                "translated_content": parsed.get("translated_content", "Translation failed."),
                "translated_subject": parsed.get("translated_subject", ""),
                "detected_language": parsed.get("detected_language", "Unknown"),
                "target_language": target_lang_name
            }
                
        except Exception as e:
            logger.error(f"Email translation streaming failed: {str(e)}")
            yield {
                "type": "error",
                "content": str(e)
            }

    def _parse_readable_translation(self, text: str, target_lang_name: str) -> Dict[str, Any]:
        """
        Parse readable text format translation into structured data.
        """
        
        result = {
            "translated_content": "",
            "translated_subject": "",
            "detected_language": "Unknown"
        }
        
        try:
            # Extract Detected Language - usually at the end now
            lang_match = re.search(r'\*\*Detected Language:\*\*\s*(.*)', text, re.IGNORECASE)
            if lang_match:
                result["detected_language"] = lang_match.group(1).strip()
            
            # Extract Subject - at the start
            subject_match = re.search(r'\*\*Subject:\*\*\s*(.*?)(?=\*\*Translation:\*\*|$)', text, re.DOTALL | re.IGNORECASE)
            if subject_match:
                result["translated_subject"] = subject_match.group(1).strip()
            
            # Extract Translation Content - between Translation and Detected Language
            content_match = re.search(r'\*\*Translation:\*\*\s*(.*?)(?=\*\*Detected Language:\*\*|$)', text, re.DOTALL | re.IGNORECASE)
            if content_match:
                result["translated_content"] = content_match.group(1).strip()
            else:
                # Fallback
                if not result["translated_subject"] and not result["detected_language"]:
                    result["translated_content"] = text.strip()
        
        except Exception as e:
            logger.error(f"Error parsing readable translation: {e}")
            result["translated_content"] = text # Fallback
        
        return result

    async def draft_email_stream(self, instructions: str, context: Optional[str] = None, sender_name: Optional[str] = None, recipient_name: Optional[str] = None) -> AsyncIterator[Dict[str, Any]]:
        """
        Draft an email based on instructions, streaming the response.
        
        Args:
            instructions: User instructions for the email
            context: Original email content (if replying)
            sender_name: Name of the sender (user)
            recipient_name: Name of the recipient
            
        Yields:
            Streaming tokens
        """
        prompt_parts = [
            "You are a professional email assistant. Draft an email body based on the instructions below."
        ]
        
        if sender_name:
            prompt_parts.append(f"Sender Name: {sender_name}")
        if recipient_name:
            prompt_parts.append(f"Recipient Name: {recipient_name}")
            
        prompt_parts.append(f"Instructions: {instructions}")
        
        if context:
            prompt_parts.append(f"\nOriginal Email Context (for reference):\n{self._clean_email_content(context)}")
            
        prompt_parts.append("""
CRITICAL RULES - FOLLOW EXACTLY:
1. Output ONLY the email body text itself
2. Do NOT include ANY preamble like "Certainly!", "Here is the email:", "Sure!", etc.
3. Do NOT include a Subject line
4. Use the provided Sender/Recipient names - Do NOT use placeholders like [Your Name] or [Recipient's Name]
5. Start DIRECTLY with the salutation (e.g. "Hi Name,") - this must be the first text
6. End with the signature - nothing after
""")
        prompt = "\n".join(prompt_parts)

        try:
            full_response = ""
            messages = [HumanMessage(content=prompt)]
            
            # Buffer to detect preamble at start of response
            preamble_stripped = False
            yield_buffer = ""
            
            async for chunk in self.llm.astream(messages):
                chunk_content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                if chunk_content:
                    full_response += chunk_content
                    
                    # If we haven't checked for preamble yet, buffer the content
                    if not preamble_stripped:
                        yield_buffer += chunk_content
                        
                        # Check if buffer is long enough to detect preamble
                        if len(yield_buffer) > self.PREAMBLE_BUFFER_SIZE:
                            cleaned_buffer = self._strip_ai_preamble(yield_buffer)
                            preamble_stripped = True
                            if cleaned_buffer:
                                yield {
                                    "type": "token",
                                    "content": cleaned_buffer
                                }
                    else:
                        # Already processed preamble, yield directly
                        yield {
                            "type": "token",
                            "content": chunk_content
                        }
            
            # Handle case where response was shorter than buffer threshold
            if not preamble_stripped and yield_buffer:
                cleaned_buffer = self._strip_ai_preamble(yield_buffer)
                if cleaned_buffer:
                    yield {
                        "type": "token", 
                        "content": cleaned_buffer
                    }
            
            # Clean the final response - strip both preamble and any AI-added signatures
            final_content = self._strip_ai_additions(full_response, "")
                    
            yield {
                "type": "complete",
                "content": final_content
            }

        except Exception as e:
            logger.error(f"Email drafting streaming failed: {str(e)}")
            yield {
                "type": "error",
                "content": str(e)
            }

    async def generate_reply_subjects(
        self, 
        email_content: str, 
        original_subject: str = "",
        intent: str = "Response",
        tone: str = "professional",
        count: int = 3
    ) -> List[str]:
        """
        Generate suitable subject lines for a reply based on context and user preferences.
        
        Args:
            email_content: The content of the email being replied to
            original_subject: The original email's subject line
            intent: The intent of the response (e.g., 'Response', 'Request', 'Follow-up', etc.)
            tone: The desired tone (e.g., 'professional', 'friendly', 'urgent', etc.)
            count: Number of subjects to generate
            
        Returns:
            List of subject line strings
        """
        cleaned_content = self._clean_email_content(email_content)
        # Limit content
        if len(cleaned_content) > 3000:
            cleaned_content = cleaned_content[:3000] + "..."
        
        # Build context info
        context_parts = []
        if original_subject:
            context_parts.append(f"Original Subject: {original_subject}")
        context_parts.append(f"Response Intent: {intent}")
        context_parts.append(f"Desired Tone: {tone}")
        context_info = "\n".join(context_parts)
            
        prompt = f"""Generate {count} subject lines for an email reply.

{context_info}

Original Email Content:
{cleaned_content}

Requirements:
1. Each subject should match the "{intent}" intent and "{tone}" tone
2. Keep subjects concise (under 60 characters if possible)
3. Make subjects specific and relevant to the email context
4. Consider using "Re: [modified original subject]" format when appropriate
5. For follow-ups or reminders, consider adding urgency indicators

Output only the subject lines, one per line. Do not number them or add bullets. Do not include quotes around them."""

        try:
            response = await self._call_llm(prompt, max_tokens=150, temperature=0.7)
            # Parse response - filter empty lines and clean up
            subjects = []
            for line in response.split('\n'):
                line = line.strip()
                # Remove common prefixes like "1.", "- ", "* ", quotes
                line = re.sub(r'^[\d]+[\.\)]\s*', '', line)
                line = re.sub(r'^[-\*•]\s*', '', line)
                line = line.strip('"\'')
                if line:
                    subjects.append(line)
            return subjects[:count]
        except Exception as e:
            logger.error(f"Subject generation failed: {str(e)}")
            # Fallback: use original subject with "Re:" prefix
            if original_subject:
                if original_subject.lower().startswith('re:'):
                    return [original_subject]
                return [f"Re: {original_subject}"]
            return ["Re: Your email"]

    async def polish_email_stream(self, content: str, tone: str = "professional", instruction: str = "") -> AsyncIterator[Dict[str, Any]]:
        """
        Polish and refine an email draft with streaming response.
        
        Args:
            content: The draft content to polish
            tone: Desired tone (professional, friendly, etc.)
            instruction: Specific instruction (e.g. "fix grammar", "make it shorter")
            
        Yields:
            Streaming tokens
        """
        # Store original content for comparison
        original_content = content
        
        prompt = f"""You are a professional email editor. Your task is to improve the following text.

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:
1. Output ONLY the improved version of the given text
2. Do NOT add ANY content that was not in the original text
3. Do NOT add greetings, signatures, or closings unless they were in the original
4. Do NOT include ANY preamble like "Certainly!", "Here is...", "Sure!", etc.
5. Do NOT include ANY commentary or explanations
6. Keep the same structure - if it's a partial text (no greeting/signature), keep it partial
7. Start DIRECTLY with the improved text content

Improvements to make:
- Fix any grammar and spelling errors
- Adjust the tone to be {tone}
- {instruction if instruction else "Ensure clarity and flow"}

Original Text:
---
{content}
---

Output the improved text only (no additions, no preamble):"""

        try:
            full_response = ""
            messages = [HumanMessage(content=prompt)]
            
            # Buffer to detect preamble at start of response
            preamble_stripped = False
            yield_buffer = ""
            
            async for chunk in self.llm.astream(messages):
                chunk_content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                if chunk_content:
                    full_response += chunk_content
                    
                    # If we haven't checked for preamble yet, buffer the content
                    if not preamble_stripped:
                        yield_buffer += chunk_content
                        
                        # Check if buffer is long enough to detect preamble
                        if len(yield_buffer) > self.PREAMBLE_BUFFER_SIZE:
                            cleaned_buffer = self._strip_ai_preamble(yield_buffer)
                            preamble_stripped = True
                            if cleaned_buffer:
                                yield {
                                    "type": "token",
                                    "content": cleaned_buffer
                                }
                    else:
                        # Already processed preamble, yield directly
                        yield {
                            "type": "token",
                            "content": chunk_content
                        }
            
            # Handle case where response was shorter than buffer threshold
            if not preamble_stripped and yield_buffer:
                cleaned_buffer = self._strip_ai_preamble(yield_buffer)
                if cleaned_buffer:
                    yield {
                        "type": "token", 
                        "content": cleaned_buffer
                    }
            
            # Clean the final response - strip both preamble and AI-added signatures
            final_content = self._strip_ai_additions(full_response, original_content)
                    
            yield {
                "type": "complete",
                "content": final_content
            }

        except Exception as e:
            logger.error(f"Email polishing streaming failed: {str(e)}")
            yield {
                "type": "error",
                "content": str(e)
            }

    async def generate_task_from_description(self, description: str, current_status: str = "todo") -> Dict[str, Any]:
        """
        Generate a structured task from a natural-language description.

        Returns a dict with: title, description, priority, due_date, category, estimated_minutes.
        """
        from datetime import date
        today = date.today().isoformat()

        prompt = f"""You are a task-planning assistant. Today's date is {today}.
Given the user's description, produce a structured JSON task object.

Rules:
- "title": concise imperative phrase (max 10 words)
- "description": 2-4 actionable bullet points (use "- " prefix)
- "priority": one of "urgent", "high", "medium", "low"
- "due_date": YYYY-MM-DD string or null if no deadline implied
- "category": one of "work", "personal", "meeting_prep", "health", "finance", "learning", "errands"
- "estimated_minutes": integer estimate (15, 30, 60, 120, etc.)

Respond with ONLY valid JSON, no markdown fences, no explanation.

User description: {description}
Current status column: {current_status}"""

        try:
            raw = await self._call_llm(prompt, max_tokens=512, temperature=0.4)
            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)
            result = json.loads(cleaned)
            # Validate required keys
            for key in ("title", "description", "priority"):
                if key not in result:
                    raise ValueError(f"Missing required field: {key}")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Task generation returned invalid JSON: {raw[:200]}")
            raise Exception(f"AI returned invalid JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Task generation failed: {str(e)}")
            raise

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
email_ai_service = EmailAIService()
