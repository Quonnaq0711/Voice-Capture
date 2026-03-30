"""
Meeting Prep Service

Provides AI-powered meeting preparation using vLLM:
- Generate discussion points based on meeting topic and attendees
- Analyze recent email context with attendees
- Find related documents and attachments
- Retrieve meeting history with same attendees
"""

import os
import sys
import logging
import httpx
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

logger = logging.getLogger(__name__)

# vLLM Configuration
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")


class MeetingPrepService:
    """
    AI-powered meeting preparation service.

    Features:
    - Generate AI discussion points based on meeting topic
    - Find recent emails with attendees
    - Identify related documents
    - Retrieve meeting history with same attendees
    """

    def __init__(self):
        self.api_base = VLLM_API_BASE
        self.model = VLLM_MODEL
        self.client = httpx.AsyncClient(timeout=60.0)

    async def _call_llm(self, prompt: str, max_tokens: int = 1024, temperature: float = 0.5) -> str:
        """Call vLLM for text generation."""
        try:
            response = await self.client.post(
                f"{self.api_base}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are an AI assistant helping to prepare for meetings. Be concise and practical."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )

            if response.status_code == 200:
                data = response.json()
                choices = data.get("choices")
                if not choices or not isinstance(choices, list) or len(choices) == 0:
                    logger.error(f"vLLM returned empty/invalid choices: {str(data)[:200]}")
                    return ""
                content = choices[0].get("message", {}).get("content")
                if not content or not isinstance(content, str):
                    logger.error(f"vLLM response missing content: {str(data)[:200]}")
                    return ""
                return content
            else:
                logger.error(f"vLLM API error: {response.status_code} - {response.text[:200]}")
                return ""

        except Exception as e:
            logger.error(f"Error calling vLLM: {e}")
            return ""

    async def generate_discussion_points(
        self,
        meeting_title: str,
        meeting_description: Optional[str],
        attendees: List[str],
        email_context: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        Generate AI discussion points for a meeting.

        Args:
            meeting_title: Title of the meeting
            meeting_description: Optional description/agenda
            attendees: List of attendee emails
            email_context: Optional recent email snippets for context

        Returns:
            List of discussion points with title and context
        """
        attendee_list = ", ".join(attendees[:5])  # Limit to 5 attendees

        prompt = f"""Based on the following meeting information, generate 3-5 practical discussion points.

Meeting Title: {meeting_title}
Attendees: {attendee_list}
{"Description: " + meeting_description if meeting_description else ""}
{"Recent email context: " + email_context[:500] if email_context else ""}

Generate discussion points in JSON format:
[
  {{"title": "point title", "context": "brief context or reason"}},
  ...
]

Only return the JSON array, no other text."""

        try:
            response = await self._call_llm(prompt, max_tokens=512, temperature=0.5)

            # Try to parse JSON from response
            # Handle cases where LLM might add extra text
            json_match = response.strip()
            if json_match.startswith("```"):
                # Remove markdown code blocks
                json_match = json_match.split("```")[1]
                if json_match.startswith("json"):
                    json_match = json_match[4:]

            # Find JSON array in response
            start_idx = json_match.find("[")
            end_idx = json_match.rfind("]")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = json_match[start_idx:end_idx + 1]
                points = json.loads(json_str)
                if not isinstance(points, list):
                    logger.warning(f"Expected list from LLM, got {type(points).__name__}")
                    return []
                # Validate each point has at least a 'title' field
                validated = [p for p in points if isinstance(p, dict) and "title" in p]
                return validated[:5]  # Limit to 5 points

            logger.warning(f"Could not parse discussion points JSON: {response[:200]}")
            return []

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error generating discussion points: {e}")
            return []

    async def generate_meeting_summary(
        self,
        meeting_title: str,
        attendees: List[str],
        email_count: int = 0,
        has_history: bool = False
    ) -> str:
        """
        Generate a brief AI summary for the meeting.

        Args:
            meeting_title: Title of the meeting
            attendees: List of attendee emails
            email_count: Number of recent emails found
            has_history: Whether there's meeting history

        Returns:
            Brief AI summary string
        """
        attendee_count = len(attendees)

        prompt = f"""Write a brief (1-2 sentences) meeting prep summary for:

Meeting: {meeting_title}
Attendees: {attendee_count} people
Recent emails: {email_count} found
Previous meetings: {"Yes" if has_history else "No"}

Focus on what the user should be aware of or prepare for. Be concise and actionable."""

        try:
            response = await self._call_llm(prompt, max_tokens=100, temperature=0.5)
            return response.strip()
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return ""

    def format_email_for_display(self, email: Dict[str, Any]) -> Dict[str, str]:
        """Format raw email data for display in the prep panel."""
        return {
            "subject": email.get("subject", "(No subject)"),
            "from": email.get("from", "Unknown"),
            "to": email.get("to", "Unknown"),
            "date": email.get("date", ""),
            "snippet": email.get("snippet", "")[:200],
        }

    def format_meeting_for_display(self, event: Dict[str, Any]) -> Dict[str, str]:
        """Format raw calendar event for display in meeting history."""
        start = event.get("start", "")
        if start:
            try:
                dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                date_str = dt.strftime("%b %d, %Y")
            except:
                date_str = start[:10]
        else:
            date_str = ""

        return {
            "title": event.get("summary", "(No title)"),
            "date": date_str,
            "summary": event.get("description", "")[:200] if event.get("description") else "",
        }

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
_meeting_prep_service: Optional[MeetingPrepService] = None


def get_meeting_prep_service() -> MeetingPrepService:
    """Get or create the meeting prep service singleton."""
    global _meeting_prep_service
    if _meeting_prep_service is None:
        _meeting_prep_service = MeetingPrepService()
    return _meeting_prep_service
