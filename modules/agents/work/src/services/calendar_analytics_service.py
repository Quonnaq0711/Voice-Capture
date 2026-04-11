"""
Calendar Analytics Service

Analyzes calendar events to provide insights on:
- Meeting vs focus time ratio
- Top meeting partners
- Meeting density trends
- Work rhythm health score
- AI-powered recommendations
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
import os

logger = logging.getLogger(__name__)


class CalendarAnalyticsService:
    """Analyzes calendar events and generates productivity insights."""

    def __init__(self):
        self.work_start_hour = 9  # 9 AM
        self.work_end_hour = 18   # 6 PM
        self.work_hours_per_day = 8
        self.work_days = [0, 1, 2, 3, 4]  # Monday to Friday

    def analyze(
        self,
        events: List[Dict],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Main analysis entry point.

        Args:
            events: List of calendar events from CalendarService
            start_date: Analysis period start
            end_date: Analysis period end

        Returns:
            Complete analytics data including metrics and health score
        """
        # Filter out cancelled events and all-day events for time analysis
        timed_events = [
            e for e in events
            if e.get('status') != 'cancelled'
            and not e.get('is_all_day', False)
            and e.get('start') and e.get('end')
        ]

        # Calculate total work days in period
        total_work_days = self._count_work_days(start_date, end_date)
        total_work_hours = total_work_days * self.work_hours_per_day

        # Core metrics
        meeting_metrics = self._calculate_meeting_metrics(timed_events)
        partner_stats = self._calculate_partner_stats(timed_events)
        daily_trends = self._calculate_daily_trends(timed_events, start_date, end_date)
        health_score = self._calculate_health_score(
            timed_events, meeting_metrics, total_work_hours, start_date, end_date
        )

        # Meeting vs Focus breakdown
        meeting_hours = meeting_metrics['total_hours']
        focus_hours = max(0, total_work_hours - meeting_hours)

        meeting_percentage = (meeting_hours / total_work_hours * 100) if total_work_hours > 0 else 0
        focus_percentage = 100 - meeting_percentage

        return {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days,
                'work_days': total_work_days
            },
            'summary': {
                'total_meetings': meeting_metrics['total_count'],
                'meeting_hours': round(meeting_hours, 1),
                'focus_hours': round(focus_hours, 1),
                'avg_meeting_duration': round(meeting_metrics['avg_duration'], 1),
                'total_work_hours': total_work_hours
            },
            'meeting_vs_focus': {
                'meeting_hours': round(meeting_hours, 1),
                'meeting_percentage': round(meeting_percentage, 1),
                'focus_hours': round(focus_hours, 1),
                'focus_percentage': round(focus_percentage, 1)
            },
            'top_partners': partner_stats[:10],  # Top 10 partners
            'daily_trends': daily_trends,
            'health_score': health_score
        }

    def _count_work_days(self, start: datetime, end: datetime) -> int:
        """Count business days (Mon-Fri) between two dates."""
        count = 0
        current = start
        while current <= end:
            if current.weekday() in self.work_days:
                count += 1
            current += timedelta(days=1)
        return count

    def _parse_event_times(self, event: Dict) -> tuple:
        """Parse event start and end times (returns naive datetimes)."""
        try:
            start_str = event.get('start', '')
            end_str = event.get('end', '')

            start = self._parse_iso(start_str) if isinstance(start_str, str) else start_str
            end = self._parse_iso(end_str) if isinstance(end_str, str) else end_str

            return start, end
        except Exception as e:
            logger.warning(f"Failed to parse event times: {e}")
            return None, None

    @staticmethod
    def _parse_iso(s: str) -> datetime:
        """Parse ISO 8601 string to naive datetime (strip timezone for local comparison)."""
        # datetime.fromisoformat handles 'Z' suffix from Python 3.11+
        s = s.replace('Z', '+00:00')
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=None)

    def _calculate_meeting_metrics(self, events: List[Dict]) -> Dict:
        """Calculate basic meeting metrics."""
        total_hours = 0
        durations = []

        for event in events:
            start, end = self._parse_event_times(event)
            if start and end:
                duration = (end - start).total_seconds() / 3600  # Hours
                if 0 < duration < 24:  # Sanity check
                    total_hours += duration
                    durations.append(duration)

        return {
            'total_count': len(events),
            'total_hours': total_hours,
            'avg_duration': sum(durations) / len(durations) if durations else 0
        }

    def _calculate_partner_stats(self, events: List[Dict]) -> List[Dict]:
        """Calculate meeting statistics per attendee."""
        partner_data = defaultdict(lambda: {
            'meeting_count': 0,
            'total_hours': 0,
            'email': '',
            'name': ''
        })

        for event in events:
            start, end = self._parse_event_times(event)
            if not start or not end:
                continue

            duration = (end - start).total_seconds() / 3600
            if duration <= 0 or duration >= 24:
                continue

            attendees = event.get('attendees', [])
            for attendee in attendees:
                # Skip self
                if attendee.get('is_self', False):
                    continue

                email = attendee.get('email', '').lower()
                if not email:
                    continue

                name = attendee.get('name', email.split('@')[0])

                partner_data[email]['meeting_count'] += 1
                partner_data[email]['total_hours'] += duration
                partner_data[email]['email'] = email
                partner_data[email]['name'] = name

        # Convert to list and sort by meeting count
        partners = [
            {
                'email': data['email'],
                'name': data['name'],
                'meeting_count': data['meeting_count'],
                'total_hours': round(data['total_hours'], 1)
            }
            for data in partner_data.values()
        ]
        partners.sort(key=lambda x: x['meeting_count'], reverse=True)

        return partners

    def _calculate_daily_trends(
        self,
        events: List[Dict],
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Calculate meeting trends by day."""
        daily_data = defaultdict(lambda: {'meeting_count': 0, 'meeting_hours': 0})

        for event in events:
            start, end = self._parse_event_times(event)
            if not start or not end:
                continue

            duration = (end - start).total_seconds() / 3600
            if duration <= 0 or duration >= 24:
                continue

            date_key = start.strftime('%Y-%m-%d')
            daily_data[date_key]['meeting_count'] += 1
            daily_data[date_key]['meeting_hours'] += duration

        # Fill in all dates in range
        trends = []
        current = start_date
        while current <= end_date:
            date_key = current.strftime('%Y-%m-%d')
            is_workday = current.weekday() in self.work_days

            trends.append({
                'date': date_key,
                'day_name': current.strftime('%a'),
                'meeting_count': daily_data[date_key]['meeting_count'],
                'meeting_hours': round(daily_data[date_key]['meeting_hours'], 1),
                'is_workday': is_workday
            })
            current += timedelta(days=1)

        return trends

    def _calculate_health_score(
        self,
        events: List[Dict],
        metrics: Dict,
        total_work_hours: float,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """
        Calculate work rhythm health score (0-100).

        Factors considered:
        - Meeting load percentage
        - Back-to-back meetings
        - Long meetings
        - Early/late meetings
        - Meeting-free days
        """
        score = 100
        factors = []

        # Factor 1: Meeting load
        meeting_load = (metrics['total_hours'] / total_work_hours * 100) if total_work_hours > 0 else 0
        if meeting_load > 70:
            deduction = 30
            score -= deduction
            factors.append({
                'name': 'High meeting load',
                'impact': -deduction,
                'detail': f'{meeting_load:.0f}% of time in meetings'
            })
        elif meeting_load > 50:
            deduction = 15
            score -= deduction
            factors.append({
                'name': 'Elevated meeting load',
                'impact': -deduction,
                'detail': f'{meeting_load:.0f}% of time in meetings'
            })
        else:
            factors.append({
                'name': 'Healthy meeting load',
                'impact': 0,
                'detail': f'{meeting_load:.0f}% of time in meetings'
            })

        # Factor 2: Back-to-back meetings
        back_to_back = self._count_back_to_back(events)
        if back_to_back > 5:
            deduction = min(20, back_to_back * 2)
            score -= deduction
            factors.append({
                'name': 'Back-to-back meetings',
                'impact': -deduction,
                'detail': f'{back_to_back} instances detected'
            })

        # Factor 3: Long meetings (>2 hours)
        long_meetings = self._count_long_meetings(events)
        if long_meetings > 3:
            deduction = min(15, long_meetings * 3)
            score -= deduction
            factors.append({
                'name': 'Long meetings',
                'impact': -deduction,
                'detail': f'{long_meetings} meetings over 2 hours'
            })

        # Factor 4: Outside hours meetings
        outside_hours = self._count_outside_hours(events)
        if outside_hours > 5:
            deduction = min(10, outside_hours * 2)
            score -= deduction
            factors.append({
                'name': 'Outside work hours',
                'impact': -deduction,
                'detail': f'{outside_hours} meetings before 9am or after 6pm'
            })

        # Factor 5: Meeting-free days (bonus)
        meeting_free_days = self._count_meeting_free_days(events, start_date, end_date)
        if meeting_free_days >= 2:
            bonus = min(10, meeting_free_days * 3)
            score += bonus
            factors.append({
                'name': 'Meeting-free days',
                'impact': bonus,
                'detail': f'{meeting_free_days} days with no meetings'
            })

        # Clamp score
        score = max(0, min(100, score))

        # Determine status
        if score >= 70:
            status = 'healthy'
            status_label = 'Healthy'
        elif score >= 50:
            status = 'moderate'
            status_label = 'Needs Attention'
        else:
            status = 'poor'
            status_label = 'Unhealthy'

        return {
            'score': score,
            'status': status,
            'status_label': status_label,
            'factors': factors
        }

    def _count_back_to_back(self, events: List[Dict]) -> int:
        """Count back-to-back meeting occurrences (< 15 min gap)."""
        if len(events) < 2:
            return 0

        # Sort by start time
        sorted_events = []
        for event in events:
            start, end = self._parse_event_times(event)
            if start and end:
                sorted_events.append((start, end))
        sorted_events.sort(key=lambda x: x[0])

        count = 0
        for i in range(len(sorted_events) - 1):
            gap = (sorted_events[i + 1][0] - sorted_events[i][1]).total_seconds() / 60
            if 0 <= gap < 15:  # Less than 15 minutes gap
                count += 1

        return count

    def _count_long_meetings(self, events: List[Dict]) -> int:
        """Count meetings longer than 2 hours."""
        count = 0
        for event in events:
            start, end = self._parse_event_times(event)
            if start and end:
                duration = (end - start).total_seconds() / 3600
                if duration > 2:
                    count += 1
        return count

    def _count_outside_hours(self, events: List[Dict]) -> int:
        """Count meetings outside 9am-6pm."""
        count = 0
        for event in events:
            start, end = self._parse_event_times(event)
            if start:
                hour = start.hour
                if hour < self.work_start_hour or hour >= self.work_end_hour:
                    count += 1
        return count

    def _count_meeting_free_days(
        self,
        events: List[Dict],
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """Count work days with no meetings."""
        meeting_days = set()
        for event in events:
            start, _ = self._parse_event_times(event)
            if start:
                meeting_days.add(start.strftime('%Y-%m-%d'))

        count = 0
        current = start_date
        while current <= end_date:
            if current.weekday() in self.work_days:
                date_key = current.strftime('%Y-%m-%d')
                if date_key not in meeting_days:
                    count += 1
            current += timedelta(days=1)

        return count


async def generate_calendar_recommendations(
    analytics_data: Dict,
    llm_client: Any = None
) -> List[Dict]:
    """
    Generate AI-powered recommendations based on calendar analytics.

    Args:
        analytics_data: Output from CalendarAnalyticsService.analyze()
        llm_client: Optional LLM client for AI generation

    Returns:
        List of recommendation dictionaries
    """
    summary = analytics_data.get('summary', {})
    health = analytics_data.get('health_score', {})
    meeting_vs_focus = analytics_data.get('meeting_vs_focus', {})
    top_partners = analytics_data.get('top_partners', [])[:5]

    # Build context for AI
    context = f"""Calendar Analytics Summary:
- Total meetings: {summary.get('total_meetings', 0)}
- Meeting hours: {summary.get('meeting_hours', 0)}h
- Focus hours: {summary.get('focus_hours', 0)}h
- Meeting load: {meeting_vs_focus.get('meeting_percentage', 0):.0f}%
- Health score: {health.get('score', 0)}/100 ({health.get('status_label', 'Unknown')})
- Average meeting duration: {summary.get('avg_meeting_duration', 0):.1f}h

Top meeting partners:
{chr(10).join([f"- {p['name']}: {p['meeting_count']} meetings" for p in top_partners]) if top_partners else '- No frequent partners'}

Health factors:
{chr(10).join([f"- {f['name']}: {f['detail']}" for f in health.get('factors', [])])}
"""

    prompt = f"""You are a productivity expert. Based on the calendar analytics below, generate 3-5 specific, actionable recommendations to improve work-life balance and productivity.

{context}

Return recommendations as a JSON array with this structure:
[
  {{
    "title": "Brief action title (3-5 words)",
    "description": "Detailed explanation and specific actions to take (1-2 sentences)",
    "priority": "high|medium|low",
    "impact": "time_saved|focus_improved|balance_improved|stress_reduced"
  }}
]

Focus on practical, implementable suggestions. Only return the JSON array."""

    # Try AI generation if client available
    if llm_client:
        try:
            from langchain_openai import ChatOpenAI
            from langchain.schema import HumanMessage, SystemMessage

            messages = [
                SystemMessage(content="You are a productivity expert who provides actionable calendar management advice."),
                HumanMessage(content=prompt)
            ]

            response = await llm_client.ainvoke(messages)
            content = response.content.strip()

            # Parse JSON from response
            import json
            # Handle markdown code blocks
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]

            # Find JSON array
            start = content.find('[')
            end = content.rfind(']') + 1
            if start >= 0 and end > start:
                recommendations = json.loads(content[start:end])
                return recommendations

        except Exception as e:
            logger.warning(f"AI recommendation generation failed: {e}")

    # Fallback: Generate rule-based recommendations
    return _generate_fallback_recommendations(analytics_data)


def _generate_fallback_recommendations(analytics_data: Dict) -> List[Dict]:
    """Generate rule-based recommendations when AI is unavailable."""
    recommendations = []

    summary = analytics_data.get('summary', {})
    health = analytics_data.get('health_score', {})
    meeting_vs_focus = analytics_data.get('meeting_vs_focus', {})

    meeting_percentage = meeting_vs_focus.get('meeting_percentage', 0)
    health_score = health.get('score', 100)
    factors = health.get('factors', [])

    # High meeting load
    if meeting_percentage > 50:
        recommendations.append({
            'title': 'Reduce Meeting Load',
            'description': f'Your meeting load is {meeting_percentage:.0f}%. Consider declining non-essential meetings or suggesting async alternatives for status updates.',
            'priority': 'high' if meeting_percentage > 70 else 'medium',
            'impact': 'focus_improved'
        })

    # Back-to-back meetings
    for factor in factors:
        if 'back-to-back' in factor.get('name', '').lower() and factor.get('impact', 0) < 0:
            recommendations.append({
                'title': 'Add Meeting Buffers',
                'description': 'Schedule 5-10 minute buffers between meetings. This prevents fatigue and allows time for notes and preparation.',
                'priority': 'medium',
                'impact': 'stress_reduced'
            })
            break

    # Long meetings
    for factor in factors:
        if 'long meeting' in factor.get('name', '').lower() and factor.get('impact', 0) < 0:
            recommendations.append({
                'title': 'Shorten Long Meetings',
                'description': 'Consider breaking meetings over 2 hours into shorter sessions. Research shows attention drops significantly after 90 minutes.',
                'priority': 'medium',
                'impact': 'time_saved'
            })
            break

    # Outside hours
    for factor in factors:
        if 'outside' in factor.get('name', '').lower() and factor.get('impact', 0) < 0:
            recommendations.append({
                'title': 'Protect Work Hours',
                'description': 'You have meetings scheduled outside core hours (9am-6pm). Consider setting calendar boundaries or blocking personal time.',
                'priority': 'medium',
                'impact': 'balance_improved'
            })
            break

    # Low health score - general advice
    if health_score < 60 and len(recommendations) < 3:
        recommendations.append({
            'title': 'Schedule Focus Blocks',
            'description': 'Block 2-hour focus time slots on your calendar to protect time for deep work. Mark them as busy to prevent meeting requests.',
            'priority': 'high',
            'impact': 'focus_improved'
        })

    # Always add if few recommendations
    if len(recommendations) < 3:
        recommendations.append({
            'title': 'Weekly Calendar Review',
            'description': 'Spend 10 minutes each Friday reviewing next week\'s calendar. Identify meetings that could be shorter, combined, or cancelled.',
            'priority': 'low',
            'impact': 'time_saved'
        })

    return recommendations[:5]


# Singleton instance
_analytics_service = None

def get_analytics_service() -> CalendarAnalyticsService:
    """Get or create analytics service singleton."""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = CalendarAnalyticsService()
    return _analytics_service
