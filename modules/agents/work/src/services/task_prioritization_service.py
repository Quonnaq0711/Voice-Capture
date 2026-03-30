"""
Task Prioritization Service

Provides AI-powered task prioritization and scheduling:
- Analyze tasks and suggest priorities
- Generate optimal execution schedules
- Estimate task durations
- Detect conflicts and warnings
"""

import os
import sys
import logging
import asyncio
import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

logger = logging.getLogger(__name__)

# vLLM Configuration
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")


class TaskPrioritizationService:
    """
    AI-powered task prioritization and scheduling service using vLLM.

    Features:
    - Prioritize tasks based on due dates, descriptions, and context
    - Estimate task durations
    - Generate daily schedules
    - Detect conflicts with existing calendar events
    """

    VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']

    def __init__(self):
        self.api_base = VLLM_API_BASE
        self.model = VLLM_MODEL
        self.client = httpx.AsyncClient(timeout=120.0)

    async def _call_llm(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.3) -> str:
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
                        {"role": "system", "content": "You are a productivity expert and project manager. Always respond with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=120.0
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

    async def prioritize_tasks(
        self,
        todos: List[Dict[str, Any]],
        extracted_tasks: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
        calendar_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Prioritize tasks and generate a schedule.

        Args:
            todos: List of Todo items (from database)
            extracted_tasks: Optional list of extracted tasks from Triage
            context: User preferences (work hours, days, start time, etc.)
            calendar_events: Existing calendar events to avoid conflicts

        Returns:
            Dict containing:
            - prioritized_tasks: List of tasks with suggested priorities and order
            - schedule: Daily schedule mapping
            - warnings: List of warnings (overdue, conflicts, overload)
            - summary: Statistics about the analysis
        """
        # Default context
        if context is None:
            context = {}

        work_hours_per_day = context.get('work_hours_per_day', 8)
        work_days = context.get('work_days', ['mon', 'tue', 'wed', 'thu', 'fri'])
        preferred_start_time = context.get('preferred_start_time', '09:00')
        schedule_start_date = context.get('schedule_start_date', datetime.now().strftime('%Y-%m-%d'))
        schedule_days = context.get('schedule_days', 7)

        # Prepare tasks for LLM
        all_tasks = []

        # Add todos
        for todo in todos:
            all_tasks.append({
                'id': todo.get('id'),
                'type': 'todo',
                'title': todo.get('title', ''),
                'description': todo.get('description', ''),
                'current_priority': todo.get('priority', 'none'),
                'due_date': todo.get('due_date'),
                'status': todo.get('status', 'todo'),
                'category': todo.get('category', '')
            })

        # Add extracted tasks if included
        if extracted_tasks:
            for task in extracted_tasks:
                all_tasks.append({
                    'id': task.get('id'),
                    'type': 'extracted',
                    'title': task.get('title', ''),
                    'description': task.get('description', ''),
                    'current_priority': task.get('priority', 'none'),
                    'due_date': task.get('due_date'),
                    'source_type': task.get('source_type', ''),
                    'confidence': task.get('confidence', 0.8)
                })

        if not all_tasks:
            return {
                'prioritized_tasks': [],
                'schedule': {},
                'calendar_events': calendar_events or [],
                'warnings': [],
                'summary': {
                    'total_tasks': 0,
                    'urgent': 0,
                    'high': 0,
                    'medium': 0,
                    'low': 0,
                    'total_estimated_hours': 0,
                    'scheduled_days': 0
                }
            }

        # Prepare calendar events for context
        calendar_context = ""
        if calendar_events:
            calendar_context = "\n\nExisting Calendar Events (avoid scheduling conflicts):\n"
            for event in calendar_events[:20]:  # Limit to 20 events
                calendar_context += f"- {event.get('date', '')}: {event.get('start', '')} - {event.get('end', '')} - {event.get('title', '')}\n"

        # Build LLM prompt
        prompt = self._build_prioritization_prompt(
            tasks=all_tasks,
            work_hours_per_day=work_hours_per_day,
            work_days=work_days,
            preferred_start_time=preferred_start_time,
            schedule_start_date=schedule_start_date,
            schedule_days=schedule_days,
            calendar_context=calendar_context
        )

        try:
            response = await self._call_llm(prompt, max_tokens=3000, temperature=0.0)
            result = self._parse_llm_response(response, all_tasks)

            # Add calendar events to result
            result['calendar_events'] = calendar_events or []

            return result

        except Exception as e:
            logger.error(f"Task prioritization failed: {str(e)}")
            # Return fallback response
            return self._generate_fallback_response(all_tasks)

    async def prioritize_incremental(
        self,
        new_tasks: List[Dict[str, Any]],
        existing_tasks: List[Dict[str, Any]],
        calendar_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Incremental prioritization: only send new tasks to LLM with existing task summary.

        Args:
            new_tasks: Tasks that need LLM analysis (full details)
            existing_tasks: Already-analyzed tasks (compact summary)
            calendar_events: Existing calendar events

        Returns:
            Complete prioritization result merging new + existing tasks
        """
        if not new_tasks:
            return self._generate_fallback_response([])

        # Build compact existing tasks summary
        existing_summary = ""
        if existing_tasks:
            existing_summary = "Existing prioritized tasks (already analyzed, in current order):\n"
            for t in existing_tasks:
                due_str = ""
                if t.get('due_date'):
                    due_str = f", due: {str(t['due_date'])[:10]}"
                existing_summary += (
                    f"  {t.get('ai_suggested_order', '?')}. [ID:{t['id']}] \"{t['title']}\" "
                    f"({t.get('priority', 'medium')}{due_str}, ~{t.get('ai_estimated_minutes', 60)}min)\n"
                )

        # Build new tasks details
        new_tasks_formatted = []
        for t in new_tasks:
            new_tasks_formatted.append({
                'id': t.get('id'),
                'type': t.get('type', 'todo'),
                'title': t.get('title', ''),
                'description': t.get('description', ''),
                'current_priority': t.get('priority', 'none'),
                'due_date': t.get('due_date'),
                'category': t.get('category', '')
            })

        new_tasks_json = json.dumps(new_tasks_formatted, indent=2, default=str)

        # Fix 7: Build calendar context for LLM
        calendar_context = ""
        if calendar_events:
            cal_lines = []
            for e in calendar_events[:20]:
                cal_lines.append(f"- {e.get('date', '')} {e.get('start', '')}-{e.get('end', '')} {e.get('title', '')}")
            if cal_lines:
                calendar_context = "\nUpcoming Calendar Events (consider for scheduling conflicts and urgency):\n" + "\n".join(cal_lines)

        prompt = f"""You are a productivity expert. Some tasks have already been prioritized.
New tasks need to be analyzed and inserted into the existing order.

Current Date: {datetime.now().strftime('%Y-%m-%d')}

{existing_summary}
{calendar_context}

NEW tasks to analyze and insert into the order:
{new_tasks_json}

For each NEW task, provide:
1. suggested_priority (urgent/high/medium/low) — based on deadline, impact, and effort
2. estimated_minutes
3. reasoning (1-2 sentences covering deadline urgency, business impact, effort)
4. where it should be inserted in the existing order

Respond with valid JSON:
{{
    "new_task_analyses": [
        {{
            "task_id": <id>,
            "task_type": "todo",
            "title": "<title>",
            "original_priority": "<current>",
            "suggested_priority": "urgent|high|medium|low",
            "priority_score": <0.0-1.0>,
            "reasoning": "<1-2 sentences: deadline urgency + business impact + effort>",
            "estimated_minutes": <number>,
            "insert_after": <task_id or 0 for first position>
        }}
    ]
}}

Priority (consider ALL factors, not just deadline):
- URGENT: Due within 24h OR critical blocker OR explicitly urgent
- HIGH: Due within 3d OR high business impact OR blocks others
- MEDIUM: Due within 1-2 weeks, regular work, moderate impact
- LOW: No deadline, nice-to-have, deferrable

Duration: trivial(forward/sign)=5-10min, quick reply/approve=15min, admin/setup=20min, review/short meeting=30min, research/test/docs=45min, writing/planning/meeting/small fix=60min, medium dev(implement/build)=120min, large dev(design/refactor)=180min, complex=240min+"""

        # Dynamic max_tokens based on number of new tasks
        max_tokens = min(200 * len(new_tasks) + 200, 2048)

        try:
            response = await self._call_llm(prompt, max_tokens=max_tokens, temperature=0.0)
            new_analyses = self._parse_incremental_response(response, new_tasks_formatted)

            # If parse returned fewer results than new tasks, generate fallback for missing ones
            analyzed_ids = {a['task_id'] for a in new_analyses}
            for t in new_tasks_formatted:
                if t['id'] not in analyzed_ids:
                    logger.warning(f"LLM missed task {t['id']}, using fallback analysis")
                    new_analyses.append({
                        'task_id': t['id'],
                        'task_type': t.get('type', 'todo'),
                        'title': t.get('title', ''),
                        'original_priority': t.get('current_priority', 'none'),
                        'suggested_priority': t.get('current_priority', 'medium') if t.get('current_priority') not in (None, 'none') else 'medium',
                        'priority_score': 0.5,
                        'reasoning': 'Fallback: LLM did not analyze this task',
                        'estimated_minutes': 60,
                        'insert_after': 0
                    })

            # Merge new analyses into existing order
            return self._merge_incremental_results(
                new_analyses, existing_tasks, calendar_events
            )

        except Exception as e:
            logger.error(f"Incremental prioritization failed: {str(e)}")
            # Fallback: use heuristic for new tasks and merge
            all_tasks = []
            for t in existing_tasks:
                all_tasks.append({
                    'id': t['id'], 'type': 'todo', 'title': t['title'],
                    'current_priority': t.get('priority', 'none'),
                    'due_date': t.get('due_date')
                })
            for t in new_tasks:
                all_tasks.append({
                    'id': t.get('id'), 'type': t.get('type', 'todo'), 'title': t.get('title', ''),
                    'current_priority': t.get('priority', 'none'),
                    'due_date': t.get('due_date')
                })
            return self._generate_fallback_response(all_tasks)

    def _parse_incremental_response(
        self, response: str, new_tasks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Parse incremental LLM response for new task analyses."""
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()

            result = json.loads(json_str)
            analyses = result.get("new_task_analyses", [])

            # Validate each analysis
            task_lookup = {t['id']: t for t in new_tasks}
            validated = []
            for a in analyses:
                task_id = a.get('task_id')
                if task_id not in task_lookup and len(new_tasks) > 0:
                    # Try to match by title
                    title = a.get('title', '').lower().strip()
                    for t in new_tasks:
                        if t.get('title', '').lower().strip() == title:
                            task_id = t['id']
                            break

                if a.get('suggested_priority') not in self.VALID_PRIORITIES:
                    orig = a.get('original_priority', 'medium')
                    a['suggested_priority'] = orig if orig in self.VALID_PRIORITIES else 'medium'
                if not isinstance(a.get('estimated_minutes'), (int, float)) or a['estimated_minutes'] < 0:
                    a['estimated_minutes'] = 60

                a['task_id'] = task_id
                a.setdefault('task_type', 'todo')
                a.setdefault('priority_score', 0.5)
                a.setdefault('reasoning', 'AI-analyzed priority')

                # Ensure required fields have defaults (LLM may omit them)
                if task_id in task_lookup:
                    source = task_lookup[task_id]
                    a.setdefault('title', source.get('title', 'Unknown Task'))
                    a.setdefault('original_priority', source.get('current_priority', 'none'))
                else:
                    a.setdefault('title', 'Unknown Task')
                    a.setdefault('original_priority', 'none')

                # Skip entries where we couldn't resolve task_id
                if a['task_id'] is not None:
                    validated.append(a)
                else:
                    logger.warning(f"Skipping unresolved task in incremental response: {a.get('title', 'unknown')}")

            return validated

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Failed to parse incremental response: {e}")
            # Return heuristic fallback for new tasks
            return []

    PRIORITY_RANK = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3, 'none': 4}
    PRIORITY_SCORE_MAP = {'urgent': 0.9, 'high': 0.75, 'medium': 0.5, 'low': 0.25, 'none': 0.5}

    def _compute_due_days(self, due_date) -> Optional[int]:
        """Compute days until due date from a date string or datetime, or None."""
        if not due_date:
            return None
        try:
            if isinstance(due_date, str):
                due = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            else:
                due = due_date
            now = datetime.now(due.tzinfo) if due.tzinfo else datetime.now()
            return (due - now).days
        except (ValueError, TypeError):
            return None

    def _merge_incremental_results(
        self,
        new_analyses: List[Dict[str, Any]],
        existing_tasks: List[Dict[str, Any]],
        calendar_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Merge new task analyses into existing prioritized order."""

        # Build ordered list from existing tasks
        ordered = []
        for t in sorted(existing_tasks, key=lambda x: x.get('ai_suggested_order', 999)):
            p = t.get('priority', 'medium') if t.get('priority') not in (None, 'none') else 'medium'
            ordered.append({
                'task_id': t['id'],
                'task_type': 'todo',
                'title': t['title'],
                'original_priority': t.get('priority', 'none'),
                'suggested_priority': p,
                'priority_score': self.PRIORITY_SCORE_MAP.get(p, 0.5),
                'reasoning': 'Previously analyzed',
                'estimated_minutes': t.get('ai_estimated_minutes', 60),
                'suggested_order': 0,
                '_due_days': self._compute_due_days(t.get('due_date')),
            })

        # Insert new analyses at appropriate positions
        for analysis in new_analyses:
            insert_after = analysis.get('insert_after', 0)
            inserted = False

            if insert_after:
                # Find position after the specified task
                for i, task in enumerate(ordered):
                    if task['task_id'] == insert_after:
                        ordered.insert(i + 1, analysis)
                        inserted = True
                        break

            if not inserted:
                # Insert by priority rank; within same rank, by due_days (earlier first)
                new_rank = self.PRIORITY_RANK.get(analysis.get('suggested_priority', 'medium'), 2)
                # Compute due_days for the new analysis if not already present
                new_due_days = analysis.get('_due_days')
                if new_due_days is None and analysis.get('due_date'):
                    new_due_days = self._compute_due_days(analysis.get('due_date'))
                new_due = new_due_days if new_due_days is not None else 9999

                insert_idx = len(ordered)
                for i, task in enumerate(ordered):
                    task_rank = self.PRIORITY_RANK.get(task.get('suggested_priority', 'medium'), 2)
                    if new_rank < task_rank:
                        insert_idx = i
                        break
                    elif new_rank == task_rank:
                        task_due = task.get('_due_days')
                        task_due = task_due if task_due is not None else 9999
                        if new_due < task_due:
                            insert_idx = i
                            break
                ordered.insert(insert_idx, analysis)

        # Re-number suggested_order and clean up internal fields
        for i, task in enumerate(ordered):
            task['suggested_order'] = i + 1
            task.pop('_due_days', None)

        return {
            'prioritized_tasks': ordered,
            'schedule': {},
            'calendar_events': calendar_events or [],
            'warnings': [],
            'summary': self._calculate_summary(ordered)
        }

    async def prioritize_batch_parallel(
        self,
        todos: List[Dict[str, Any]],
        calendar_events: Optional[List[Dict[str, Any]]] = None,
        batch_size: int = 8
    ) -> Dict[str, Any]:
        """
        Parallel batch prioritization: split tasks into batches, call LLM in parallel.

        ~5-8x faster than single-call for 30+ tasks.
        Uses compact prompt (no description, no schedule generation).
        """
        if not todos:
            return self._generate_fallback_response([])

        # Prepare compact task list (truncated description for context)
        all_tasks = []
        for t in todos:
            task = {
                'id': t.get('id'),
                'type': t.get('type', 'todo'),
                'title': t.get('title', ''),
                'description': (t.get('description') or '')[:120],
                'priority': t.get('priority', 'medium'),
                'due_date': t.get('due_date'),
                'category': t.get('category', ''),
            }
            all_tasks.append(task)

        # Split into batches
        batches = [all_tasks[i:i + batch_size] for i in range(0, len(all_tasks), batch_size)]
        logger.info(f"Parallel batch: {len(all_tasks)} tasks → {len(batches)} batches of ≤{batch_size}")

        # Calendar context (compact, shared across batches)
        cal_ctx = ""
        if calendar_events:
            cal_ctx = "\nCalendar (avoid conflicts): " + "; ".join(
                f"{e.get('date','')} {e.get('start','')}-{e.get('end','')} {e.get('title','')}"
                for e in calendar_events[:15]
            )

        async def process_batch(batch: list, batch_idx: int) -> list:
            """Process one batch of tasks."""
            def _fmt(t):
                line = f"[{t['id']}] \"{t['title']}\" (priority:{t['priority']}, due:{t.get('due_date') or 'none'}, cat:{t.get('category') or 'none'})"
                desc = t.get('description', '').strip()
                if desc:
                    # Collapse newlines/bullets into single line to preserve one-task-per-line format
                    desc = desc.replace('\n', '; ').replace('• ', '').replace('  ', ' ')
                    line += f" — {desc}"
                return line
            tasks_compact = "\n".join(_fmt(t) for t in batch)

            prompt = f"""Prioritize these tasks. Current date: {datetime.now().strftime('%Y-%m-%d')}
{cal_ctx}

Tasks:
{tasks_compact}

For each task respond with JSON array:
[{{"task_id":<id>,"suggested_priority":"urgent|high|medium|low","priority_score":<0.0-1.0>,"estimated_minutes":<int>,"reasoning":"<1-2 sentences: deadline urgency + business impact + effort>"}}]

Priority (consider ALL factors, not just deadline):
- urgent: due≤24h OR critical blocker OR explicitly urgent
- high: due≤3d OR high business impact OR blocks others
- medium: due≤2wk, regular work, moderate impact
- low: no deadline, nice-to-have, deferrable
Duration guidelines:
- Trivial (forward/sign/rsvp): 5-10min
- Quick response (reply/approve/confirm): 15min
- Admin (schedule/setup/configure): 20min
- Review/check/short meeting (standup/sync): 30min
- Research/testing/documentation: 45min
- Writing/planning/standard meeting/small dev fix: 60min
- Medium dev (implement/build/integrate): 120min
- Large dev (design/refactor/migrate/optimize): 180min
- Complex multi-day project: 240min+
Adjust up 25% for tasks with long descriptions (complex context)."""

            max_tokens = min(180 * len(batch) + 100, 2048)

            try:
                response = await self._call_llm(prompt, max_tokens=max_tokens, temperature=0.0)

                # Parse response
                json_str = response
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0].strip()
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0].strip()
                # Handle both array and object formats
                parsed = json.loads(json_str)
                if isinstance(parsed, dict):
                    parsed = parsed.get("tasks", parsed.get("prioritized_tasks", [parsed]))
                if not isinstance(parsed, list):
                    parsed = [parsed]

                # Validate and enrich results
                task_lookup = {t['id']: t for t in batch}
                results = []
                for a in parsed:
                    tid = a.get('task_id')
                    if tid not in task_lookup:
                        # Try title match
                        title = a.get('title', '').lower().strip()
                        for t in batch:
                            if t['title'].lower().strip() == title:
                                tid = t['id']
                                break
                    if tid is None or tid not in task_lookup:
                        continue

                    src = task_lookup[tid]
                    if a.get('suggested_priority') not in self.VALID_PRIORITIES:
                        src_priority = src.get('priority', 'medium')
                        a['suggested_priority'] = src_priority if src_priority in self.VALID_PRIORITIES else 'medium'
                    if not isinstance(a.get('estimated_minutes'), (int, float)) or a.get('estimated_minutes', 0) < 0:
                        a['estimated_minutes'] = 60

                    results.append({
                        'task_id': tid,
                        'task_type': src.get('type', 'todo'),
                        'title': src['title'],
                        'original_priority': src.get('priority', 'none'),
                        'suggested_priority': a['suggested_priority'],
                        'priority_score': float(a.get('priority_score', 0.5)),
                        'reasoning': a.get('reasoning', 'AI-analyzed'),
                        'estimated_minutes': int(a.get('estimated_minutes', 60)),
                        'suggested_order': 0,  # Will be re-numbered
                    })
                return results

            except Exception as e:
                logger.warning(f"Batch {batch_idx} failed: {e}, using fallback")
                # Fallback for this batch
                return [{
                    'task_id': t['id'],
                    'task_type': t.get('type', 'todo'),
                    'title': t['title'],
                    'original_priority': t.get('priority', 'none'),
                    'suggested_priority': t.get('priority', 'medium') if t.get('priority') not in (None, 'none') else 'medium',
                    'priority_score': 0.5,
                    'reasoning': 'Fallback (batch LLM failed)',
                    'estimated_minutes': 60,
                    'suggested_order': 0,
                } for t in batch]

        # Run all batches in parallel
        batch_results = await asyncio.gather(
            *[process_batch(b, i) for i, b in enumerate(batches)],
            return_exceptions=True
        )

        # Merge results
        all_results = []
        for i, r in enumerate(batch_results):
            if isinstance(r, list):
                all_results.extend(r)
            elif isinstance(r, Exception):
                logger.error(f"Batch {i} exception: {r}")
                # Use fallback for this batch
                for t in batches[i]:
                    all_results.append({
                        'task_id': t['id'],
                        'task_type': t.get('type', 'todo'),
                        'title': t['title'],
                        'original_priority': t.get('priority', 'none'),
                        'suggested_priority': t.get('priority', 'medium') if t.get('priority') not in (None, 'none') else 'medium',
                        'priority_score': 0.5,
                        'reasoning': 'Fallback (batch exception)',
                        'estimated_minutes': 60,
                        'suggested_order': 0,
                    })

        # Ensure all tasks are represented
        result_ids = {r['task_id'] for r in all_results}
        for t in all_tasks:
            if t['id'] not in result_ids:
                all_results.append({
                    'task_id': t['id'],
                    'task_type': t.get('type', 'todo'),
                    'title': t['title'],
                    'original_priority': t.get('priority', 'none'),
                    'suggested_priority': t.get('priority', 'medium') if t.get('priority') not in (None, 'none') else 'medium',
                    'priority_score': 0.5,
                    'reasoning': 'Fallback (missing from batch results)',
                    'estimated_minutes': 60,
                    'suggested_order': 0,
                })

        # Sort by priority rank, then by score descending
        all_results.sort(key=lambda x: (
            self.PRIORITY_RANK.get(x['suggested_priority'], 2),
            -x.get('priority_score', 0.5)
        ))

        # Assign suggested_order
        for i, task in enumerate(all_results):
            task['suggested_order'] = i + 1

        return {
            'prioritized_tasks': all_results,
            'schedule': {},
            'calendar_events': calendar_events or [],
            'warnings': [],
            'summary': self._calculate_summary(all_results)
        }

    def _build_prioritization_prompt(
        self,
        tasks: List[Dict[str, Any]],
        work_hours_per_day: int,
        work_days: List[str],
        preferred_start_time: str,
        schedule_start_date: str,
        schedule_days: int,
        calendar_context: str
    ) -> str:
        """Build the LLM prompt for task prioritization."""

        tasks_json = json.dumps(tasks, indent=2, default=str)

        # Calculate schedule end date
        start_date = datetime.strptime(schedule_start_date, '%Y-%m-%d')
        end_date = start_date + timedelta(days=schedule_days)

        prompt = f"""Analyze the following tasks and provide:
1. Priority recommendations (urgent/high/medium/low) with reasoning
2. Estimated duration for each task (in minutes)
3. A suggested daily schedule for the next {schedule_days} days
4. Any warnings about overdue tasks, conflicts, or workload issues

Current Date: {datetime.now().strftime('%Y-%m-%d')}
Schedule Period: {schedule_start_date} to {end_date.strftime('%Y-%m-%d')}

User Work Preferences:
- Work hours per day: {work_hours_per_day}
- Work days: {', '.join(work_days)}
- Preferred start time: {preferred_start_time}
{calendar_context}

Tasks to Analyze:
{tasks_json}

Respond with valid JSON in this exact format:
{{
    "prioritized_tasks": [
        {{
            "task_id": <id>,
            "task_type": "todo" or "extracted",
            "title": "<task title>",
            "original_priority": "<current priority>",
            "suggested_priority": "urgent|high|medium|low",
            "priority_score": <0.0-1.0>,
            "reasoning": "<1-2 sentence analysis covering: deadline urgency, business impact, and effort required>",
            "estimated_minutes": <number>,
            "suggested_order": <1-based order number>
        }}
    ],
    "schedule": {{
        "YYYY-MM-DD": [
            {{
                "task_id": <id>,
                "title": "<task title>",
                "suggested_start": "HH:MM",
                "suggested_end": "HH:MM",
                "estimated_minutes": <number>
            }}
        ]
    }},
    "warnings": [
        {{
            "type": "overdue|overload|conflict|deadline",
            "task_id": <id or null>,
            "date": "<date or null>",
            "message": "<warning message>"
        }}
    ],
    "summary": {{
        "total_tasks": <number>,
        "urgent": <count>,
        "high": <count>,
        "medium": <count>,
        "low": <count>,
        "total_estimated_hours": <number>,
        "scheduled_days": <number>
    }}
}}

Priority Guidelines (evaluate ALL factors, not just deadlines):
- URGENT: Due within 24h OR critical blocker for other work OR explicitly urgent
- HIGH: Due within 3 days OR high business impact OR blocks team members
- MEDIUM: Due within 1-2 weeks, regular work with moderate impact
- LOW: No deadline, nice-to-have, minimal impact if deferred

Factors to consider for EACH task (in reasoning):
1. Deadline proximity — how soon is it due? Is it overdue?
2. Business impact — does it affect team, customers, or key deliverables?
3. Effort vs value — is it a quick win or a large investment? Is the payoff worth it?

Duration Estimation Guidelines:
- Trivial actions (forward, sign, rsvp, archive): 5-10 minutes
- Quick responses (reply, approve, confirm): 15 minutes
- Admin tasks (schedule, setup, configure, install): 20 minutes
- Reviews, short meetings (standup, sync, 1:1): 30 minutes
- Research, testing, debugging, documentation: 45 minutes
- Writing, planning, standard meetings, small dev fixes: 60 minutes
- Medium development (implement, build, integrate, create feature): 120 minutes
- Large development (design, refactor, migrate, optimize): 180 minutes
- Complex multi-day projects: 240+ minutes (break into smaller blocks)
- Adjust up ~25% for tasks with detailed/lengthy descriptions (indicates complexity)

Schedule only tasks with status 'none', 'todo', or 'in_progress'. Skip 'done' or 'delayed' tasks."""

        return prompt

    def _parse_llm_response(self, response: str, original_tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Parse and validate the LLM response."""
        try:
            # Extract JSON from response
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()

            result = json.loads(json_str)

            # Create a lookup map for original tasks by title (for matching)
            task_lookup_by_title = {t['title'].lower().strip(): t for t in original_tasks}
            task_lookup_by_id = {t['id']: t for t in original_tasks}

            # Validate and normalize prioritized_tasks
            if 'prioritized_tasks' in result:
                for i, task in enumerate(result['prioritized_tasks']):
                    # Ensure task_id is present - this is critical
                    if 'task_id' not in task or task['task_id'] is None:
                        # Try to find matching task by title
                        task_title = task.get('title', '').lower().strip()
                        if task_title in task_lookup_by_title:
                            original = task_lookup_by_title[task_title]
                            task['task_id'] = original['id']
                            task['task_type'] = original['type']
                        elif i < len(original_tasks):
                            # Fallback: use original task order
                            task['task_id'] = original_tasks[i]['id']
                            task['task_type'] = original_tasks[i]['type']
                        else:
                            # Last resort: assign a placeholder (will be filtered later)
                            logger.warning(f"Could not find task_id for task: {task.get('title', 'unknown')}")
                            task['task_id'] = 0
                            task['task_type'] = 'todo'

                    # Ensure task_type is present
                    if 'task_type' not in task:
                        task_id = task.get('task_id')
                        if task_id in task_lookup_by_id:
                            task['task_type'] = task_lookup_by_id[task_id]['type']
                        else:
                            task['task_type'] = 'todo'

                    # Ensure suggested_priority is valid
                    if task.get('suggested_priority') not in self.VALID_PRIORITIES:
                        orig = task.get('original_priority', 'medium')
                        task['suggested_priority'] = orig if orig in self.VALID_PRIORITIES else 'medium'
                    # Ensure estimated_minutes is a positive number
                    if not isinstance(task.get('estimated_minutes'), (int, float)) or task['estimated_minutes'] < 0:
                        task['estimated_minutes'] = 60  # Default 1 hour
                    # Ensure all other required fields
                    if 'title' not in task:
                        task['title'] = 'Unknown Task'
                    if 'original_priority' not in task:
                        task['original_priority'] = 'none'
                    if 'priority_score' not in task:
                        task['priority_score'] = 0.5
                    if 'reasoning' not in task:
                        task['reasoning'] = 'AI-analyzed priority'
                    if 'suggested_order' not in task:
                        task['suggested_order'] = i + 1

                # Filter out tasks with task_id = 0 (unmatched)
                result['prioritized_tasks'] = [t for t in result['prioritized_tasks'] if t.get('task_id', 0) != 0]

            # Ensure all required keys exist
            if 'schedule' not in result:
                result['schedule'] = {}
            if 'warnings' not in result:
                result['warnings'] = []
            if 'summary' not in result:
                result['summary'] = self._calculate_summary(result.get('prioritized_tasks', []))

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return self._generate_fallback_response(original_tasks)
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return self._generate_fallback_response(original_tasks)

    def _generate_fallback_response(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate a fallback response when LLM fails."""
        prioritized_tasks = []

        for i, task in enumerate(tasks):
            # Simple heuristic-based prioritization
            priority = task.get('current_priority', 'medium')
            if priority == 'none':
                priority = 'medium'
            due_date = task.get('due_date')

            # Upgrade priority if due soon
            if due_date:
                try:
                    if isinstance(due_date, str):
                        due = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                    else:
                        due = due_date
                    days_until_due = (due - datetime.now(due.tzinfo if due.tzinfo else None)).days

                    if days_until_due < 0:
                        priority = 'urgent'
                    elif days_until_due <= 1:
                        priority = 'urgent'
                    elif days_until_due <= 3:
                        priority = 'high' if priority not in ['urgent'] else priority
                except:
                    pass

            # Build descriptive fallback reasoning
            if due_date and priority == 'urgent':
                fb_reason = "Fallback: overdue or due very soon, needs immediate attention"
            elif due_date and priority == 'high':
                fb_reason = "Fallback: approaching deadline within 3 days"
            else:
                fb_reason = 'Fallback: basic prioritization (AI unavailable)'

            prioritized_tasks.append({
                'task_id': task['id'],
                'task_type': task['type'],
                'title': task['title'],
                'original_priority': task.get('current_priority', 'none'),
                'suggested_priority': priority,
                'priority_score': 0.5,
                'reasoning': fb_reason,
                'estimated_minutes': 60,
                'suggested_order': i + 1
            })

        return {
            'prioritized_tasks': prioritized_tasks,
            'schedule': {},
            'calendar_events': [],
            'warnings': [{
                'type': 'info',
                'task_id': None,
                'date': None,
                'message': 'AI analysis unavailable. Using basic prioritization.'
            }],
            'summary': self._calculate_summary(prioritized_tasks)
        }

    def _calculate_summary(self, prioritized_tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics from prioritized tasks."""
        summary = {
            'total_tasks': len(prioritized_tasks),
            'urgent': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'none': 0,
            'total_estimated_hours': 0,
            'scheduled_days': 0
        }

        total_minutes = 0
        for task in prioritized_tasks:
            priority = task.get('suggested_priority', 'medium')
            if priority in summary:
                summary[priority] += 1
            total_minutes += task.get('estimated_minutes', 60)

        summary['total_estimated_hours'] = round(total_minutes / 60, 1)

        return summary

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
task_prioritization_service = TaskPrioritizationService()
