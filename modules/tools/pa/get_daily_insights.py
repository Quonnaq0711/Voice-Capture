"""
Get Daily Insights Tool for Personal Assistant

Retrieves the user's most recent AI-generated daily recommendations.
"""
import os
import sys
import logging
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.daily_recommendation import DailyRecommendation

logger = logging.getLogger(__name__)


class GetDailyInsightsInput(BaseModel):
    """Input schema for getting daily insights"""
    pass  # No user-facing parameters — user_id is injected server-side


@tool("GetDailyInsights", args_schema=GetDailyInsightsInput)
def get_daily_insights(user_id: Optional[int] = None) -> str:
    """Get the user's most recent AI-generated daily recommendations and insights."""
    db = SessionLocal()
    try:
        rec = DailyRecommendation.get_latest_for_user(db, user_id or 1)

        if not rec:
            return "No daily insights available yet."

        date_str = rec.date.strftime('%Y-%m-%d') if rec.date else "unknown"
        items = rec.get_recommendations()

        if not items:
            return f"Daily insights for {date_str}: (empty)"

        lines = [f"Daily Insights ({date_str}):\n"]
        for i, item in enumerate(items, 1):
            if isinstance(item, dict):
                title = item.get('title', item.get('recommendation', ''))
                desc = item.get('description', item.get('details', ''))
                lines.append(f"  {i}. {title}")
                if desc:
                    lines.append(f"     {desc[:200]}")
            else:
                lines.append(f"  {i}. {str(item)[:200]}")

        return "\n".join(lines)

    except Exception as e:
        return f"Error getting daily insights: {str(e)}"
    finally:
        db.close()
