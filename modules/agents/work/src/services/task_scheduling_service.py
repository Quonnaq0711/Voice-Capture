"""
Task Scheduling Service

Generates optimal task schedules using LLM and creates Google Calendar events.
Computes free time slots from calendar events, then uses LLM to assign tasks.
Falls back to a deterministic greedy algorithm if LLM fails.
"""

import os
import sys
import re
import logging
import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

logger = logging.getLogger(__name__)

# vLLM Configuration
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

# Day name mapping
DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Minimum useful slot duration (minutes)
MIN_SLOT_MINUTES = 15
# Buffer between events/tasks (minutes)
BUFFER_MINUTES = 15
# Max single task block (minutes)
MAX_BLOCK_MINUTES = 120

# ------------------------------------------------------------------
# JSON Schemas for vLLM guided generation (strict: True)
# ------------------------------------------------------------------

SCHEDULING_CONSTRAINTS_SCHEMA = {
    "type": "object",
    "properties": {
        "blocked_ranges": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "string", "description": "Start time in HH:MM 24-hour format"},
                    "end": {"type": "string", "description": "End time in HH:MM 24-hour format"},
                },
                "required": ["start", "end"],
                "additionalProperties": False,
            },
            "description": "Time ranges to block every day",
        },
        "min_break_minutes": {
            "type": "integer",
            "description": "Minimum gap between consecutive tasks in minutes. 0 if not specified.",
        },
        "soft_preferences": {
            "type": "string",
            "description": "Remaining preferences that are not blocked ranges or break durations. Empty string if none.",
        },
    },
    "required": ["blocked_ranges", "min_break_minutes", "soft_preferences"],
    "additionalProperties": False,
}

SCHEDULE_SLOT_SCHEMA = {
    "type": "object",
    "properties": {
        "task_id": {"type": "integer"},
        "date": {"type": "string", "description": "YYYY-MM-DD"},
        "start_time": {"type": "string", "description": "HH:MM"},
        "end_time": {"type": "string", "description": "HH:MM"},
    },
    "required": ["task_id", "date", "start_time", "end_time"],
    "additionalProperties": False,
}

# Root must be "type": "object" for OpenAI-compatible structured outputs
SCHEDULE_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "slots": {
            "type": "array",
            "items": SCHEDULE_SLOT_SCHEMA,
        },
    },
    "required": ["slots"],
    "additionalProperties": False,
}


class TaskSchedulingService:
    """
    AI-powered task scheduling service.

    1. Computes free time slots from calendar events + work hours
    2. Passes free slots + tasks to LLM for intelligent assignment
    3. Validates LLM output against free slots
    4. Falls back to greedy algorithm if LLM fails
    """

    def __init__(self):
        self.api_base = VLLM_API_BASE
        self.model = VLLM_MODEL
        self.client = httpx.AsyncClient(timeout=120.0)

    # ------------------------------------------------------------------
    # Core: compute free slots
    # ------------------------------------------------------------------

    def compute_free_slots(
        self,
        calendar_events: List[Dict[str, Any]],
        schedule_start_date: str,
        schedule_days: int,
        preferred_start_time: str = "09:00",
        preferred_end_time: str = "17:00",
        work_days: List[str] = None,
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Compute all free time slots within work hours, excluding calendar events.

        Args:
            now: Current datetime. If provided, slots on today before this time are excluded.

        Returns:
            List of free slots: [{date, start, end, duration_minutes}]
            sorted by date then start time.
        """
        if work_days is None:
            work_days = ["mon", "tue", "wed", "thu", "fri"]
        if now is None:
            now = datetime.now()

        today_str = now.strftime("%Y-%m-%d")
        now_minutes = now.hour * 60 + now.minute

        start_h, start_m = map(int, preferred_start_time.split(':'))
        end_h, end_m = map(int, preferred_end_time.split(':'))
        work_start_min = start_h * 60 + start_m
        work_end_min = end_h * 60 + end_m

        # Build busy periods per date (in minutes from midnight)
        busy_by_date: Dict[str, List[Tuple[int, int]]] = {}
        for evt in calendar_events:
            date = evt.get('date', '')
            if not date:
                continue
            try:
                bs = int(evt['start'].split(':')[0]) * 60 + int(evt['start'].split(':')[1])
                be = int(evt['end'].split(':')[0]) * 60 + int(evt['end'].split(':')[1])
            except (ValueError, IndexError):
                continue
            # All-day events block the entire work day
            if bs == 0 and be >= 23 * 60 + 59:
                busy_by_date.setdefault(date, []).append((work_start_min, work_end_min))
                continue
            # Skip events entirely outside work hours
            if be <= work_start_min or bs >= work_end_min:
                continue
            # Clamp to work hours
            bs = max(bs, work_start_min)
            be = min(be, work_end_min)
            busy_by_date.setdefault(date, []).append((bs, be))

        # Sort busy periods per date
        for date in busy_by_date:
            busy_by_date[date].sort()

        # Compute free slots per work day
        start_date = datetime.strptime(schedule_start_date, "%Y-%m-%d")
        free_slots = []

        for day_offset in range(schedule_days):
            d = start_date + timedelta(days=day_offset)
            day_name = DAY_NAMES[d.weekday()]
            if day_name not in work_days:
                continue

            date_str = d.strftime("%Y-%m-%d")
            # Skip past days entirely — never schedule into the past
            if date_str < today_str:
                continue
            busy = busy_by_date.get(date_str, [])

            # Merge overlapping busy periods
            merged = []
            for bs, be in busy:
                if merged and bs <= merged[-1][1]:
                    # Overlapping — extend
                    merged[-1] = (merged[-1][0], max(merged[-1][1], be))
                else:
                    merged.append((bs, be))

            # Walk through merged busy periods to find gaps
            # Buffer is only AFTER events (transition time after a meeting ends)
            # For today, start from current time (don't schedule in the past)
            cursor = work_start_min
            if date_str == today_str:
                cursor = max(cursor, now_minutes)
            for bs, be in merged:
                if bs > cursor and (bs - cursor) >= MIN_SLOT_MINUTES:
                    s_h, s_m = divmod(cursor, 60)
                    e_h, e_m = divmod(bs, 60)
                    free_slots.append({
                        "date": date_str,
                        "start": f"{s_h:02d}:{s_m:02d}",
                        "end": f"{e_h:02d}:{e_m:02d}",
                        "duration_minutes": bs - cursor,
                    })
                # Move cursor past busy period + buffer after event
                cursor = max(cursor, be + BUFFER_MINUTES)

            # Remaining time after last busy period
            if cursor < work_end_min and (work_end_min - cursor) >= MIN_SLOT_MINUTES:
                s_h, s_m = divmod(cursor, 60)
                e_h, e_m = divmod(work_end_min, 60)
                free_slots.append({
                    "date": date_str,
                    "start": f"{s_h:02d}:{s_m:02d}",
                    "end": f"{e_h:02d}:{e_m:02d}",
                    "duration_minutes": work_end_min - cursor,
                })

        return free_slots

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    # Max tasks per LLM batch (keeps prompt small for reliable 7B output)
    BATCH_SIZE = 5

    @staticmethod
    def _sort_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort tasks by priority (urgent first), status, then due date (earliest first)."""
        priority_order = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3, 'none': 4}
        status_order = {'in_progress': 0, 'todo': 1, 'review': 2, 'none': 3}
        return sorted(tasks, key=lambda t: (
            priority_order.get(t.get('priority', 'medium'), 2),
            status_order.get(t.get('status', 'none'), 3),
            t.get('due_date') or '9999-12-31',
        ))

    @staticmethod
    def _subtract_slots(
        free_slots: List[Dict[str, Any]],
        consumed: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Remove consumed time from free slots and return remaining free slots.

        Both inputs use {date, start/start_time, end/end_time} format.
        Returns new list in free-slot format: {date, start, end, duration_minutes}.
        """
        # Build consumed intervals per date (in minutes)
        consumed_by_date: Dict[str, List[Tuple[int, int]]] = {}
        for c in consumed:
            date = c['date']
            st = c.get('start_time', c.get('start', ''))
            et = c.get('end_time', c.get('end', ''))
            try:
                cs = int(st.split(':')[0]) * 60 + int(st.split(':')[1])
                ce = int(et.split(':')[0]) * 60 + int(et.split(':')[1])
            except (ValueError, IndexError):
                continue
            consumed_by_date.setdefault(date, []).append((cs, ce))
        # Sort consumed per date for sweep
        for date in consumed_by_date:
            consumed_by_date[date].sort()

        remaining = []
        for slot in free_slots:
            date = slot['date']
            fs = int(slot['start'].split(':')[0]) * 60 + int(slot['start'].split(':')[1])
            fe = int(slot['end'].split(':')[0]) * 60 + int(slot['end'].split(':')[1])

            # Carve out each consumed interval from [fs, fe)
            cursor = fs
            for cs, ce in consumed_by_date.get(date, []):
                if ce <= cursor or cs >= fe:
                    continue  # no overlap
                # Gap before this consumed block
                if cs > cursor:
                    gap = cs - cursor
                    if gap >= MIN_SLOT_MINUTES:
                        s_h, s_m = divmod(cursor, 60)
                        e_h, e_m = divmod(cs, 60)
                        remaining.append({
                            "date": date,
                            "start": f"{s_h:02d}:{s_m:02d}",
                            "end": f"{e_h:02d}:{e_m:02d}",
                            "duration_minutes": gap,
                        })
                cursor = max(cursor, ce)
            # Remaining gap after last consumed block
            if cursor < fe:
                gap = fe - cursor
                if gap >= MIN_SLOT_MINUTES:
                    s_h, s_m = divmod(cursor, 60)
                    e_h, e_m = divmod(fe, 60)
                    remaining.append({
                        "date": date,
                        "start": f"{s_h:02d}:{s_m:02d}",
                        "end": f"{e_h:02d}:{e_m:02d}",
                        "duration_minutes": gap,
                    })

        return remaining

    @staticmethod
    def _subtract_slots_with_break(
        free_slots: List[Dict[str, Any]],
        consumed: List[Dict[str, Any]],
        min_break_minutes: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Like _subtract_slots, but extends each consumed interval by
        min_break_minutes AFTER each slot before subtracting.

        This ensures break gaps (transition time) after tasks are reserved
        and not offered to subsequent scheduling batches.
        """
        if min_break_minutes <= 0:
            return TaskSchedulingService._subtract_slots(free_slots, consumed)

        # Build extended consumed slots
        extended = []
        for c in consumed:
            st = c.get('start_time', c.get('start', ''))
            et = c.get('end_time', c.get('end', ''))
            try:
                cs = int(st.split(':')[0]) * 60 + int(st.split(':')[1])
                ce = int(et.split(':')[0]) * 60 + int(et.split(':')[1])
            except (ValueError, IndexError):
                extended.append(c)
                continue
            # Break buffer only AFTER slot (transition time), consistent with fallback scheduler
            new_cs = cs
            new_ce = min(24 * 60, ce + min_break_minutes)
            s_h, s_m = divmod(new_cs, 60)
            e_h, e_m = divmod(new_ce, 60)
            extended.append({
                'date': c['date'],
                'start_time': f"{s_h:02d}:{s_m:02d}",
                'end_time': f"{e_h:02d}:{e_m:02d}",
            })
        return TaskSchedulingService._subtract_slots(free_slots, extended)

    MAX_RETRIES = 3

    @staticmethod
    def _detect_overlaps(
        slots: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], set]:
        """
        Detect overlapping slots at the SLOT level (not task level).

        Slots are assumed to be in priority order (earlier index = higher priority).
        Returns (clean_slots, evicted_slot_indices).
        """
        by_date: Dict[str, List[Tuple[int, int, int]]] = {}
        for idx, s in enumerate(slots):
            sm = int(s['start_time'].split(':')[0]) * 60 + int(s['start_time'].split(':')[1])
            em = int(s['end_time'].split(':')[0]) * 60 + int(s['end_time'].split(':')[1])
            by_date.setdefault(s['date'], []).append((sm, em, idx))

        evicted_indices: set = set()
        for date, entries in by_date.items():
            entries.sort(key=lambda x: x[2])  # priority order
            accepted: List[Tuple[int, int, int]] = []
            for sm, em, idx in entries:
                overlaps = any(sm < ae and em > as_ for as_, ae, _ in accepted)
                if overlaps:
                    evicted_indices.add(idx)
                else:
                    accepted.append((sm, em, idx))

        clean = [s for i, s in enumerate(slots) if i not in evicted_indices]
        if evicted_indices:
            evicted_tasks = {slots[i]['task_id'] for i in evicted_indices}
            logger.warning(f"Overlap detected: evicted {len(evicted_indices)} slots (task IDs {evicted_tasks})")
        return clean, evicted_indices

    def _final_resolve_overlaps(
        self,
        slots: List[Dict[str, Any]],
        free_slots: List[Dict[str, Any]],
        min_break_minutes: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Safety-net: guarantee zero overlaps in final output.

        1. Scan all slots, evict any that overlap with higher-priority ones
        2. Try to greedy-reschedule evicted slots into remaining free time
        3. Return clean, overlap-free slot list
        """
        if not slots:
            return slots

        clean, evicted_indices = TaskSchedulingService._detect_overlaps(slots)
        if not evicted_indices:
            return slots  # no overlaps — fast path

        logger.info(f"Final safety-net: resolving {len(evicted_indices)} overlapping slots")

        # Collect evicted slots as pseudo-tasks for greedy reschedule
        evicted_slots = [slots[i] for i in evicted_indices]
        # Group evicted minutes by task_id
        evicted_by_task: Dict[int, int] = {}
        for s in evicted_slots:
            sm = int(s['start_time'].split(':')[0]) * 60 + int(s['start_time'].split(':')[1])
            em = int(s['end_time'].split(':')[0]) * 60 + int(s['end_time'].split(':')[1])
            evicted_by_task[s['task_id']] = evicted_by_task.get(s['task_id'], 0) + (em - sm)

        # Compute remaining free time after clean slots (respecting break gaps)
        remaining = TaskSchedulingService._subtract_slots_with_break(free_slots, clean, min_break_minutes)
        if not remaining:
            return clean

        # Build pseudo-tasks from evicted slots and greedy-fill
        pseudo_tasks = [
            {'id': tid, 'estimated_minutes': mins, 'priority': 'low', 'status': 'none'}
            for tid, mins in evicted_by_task.items()
        ]
        rescued = self._fallback_schedule(pseudo_tasks, remaining, min_break_minutes=min_break_minutes)
        if rescued:
            logger.info(f"Safety-net rescued {len(rescued)} slots for {len(set(s['task_id'] for s in rescued))} tasks")
            clean.extend(rescued)

        return clean

    async def generate_schedule(
        self,
        tasks: List[Dict[str, Any]],
        calendar_events: List[Dict[str, Any]],
        schedule_start_date: str,
        schedule_days: int = 7,
        preferred_start_time: str = "09:00",
        preferred_end_time: str = "17:00",
        work_days: List[str] = None,
        now: Optional[datetime] = None,
        scheduling_instructions: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate optimal schedule for tasks in batches with overlap protection.

        1. Sort tasks by priority/status/due-date
        2. Schedule in batches of BATCH_SIZE via LLM
        3. After each batch, detect & resolve overlaps (keep higher-priority)
        4. Evicted tasks go back to the queue for retry (max MAX_RETRIES)
        5. Tasks that exhaust retries are scheduled via greedy fallback
        """
        if work_days is None:
            work_days = ["mon", "tue", "wed", "thu", "fri"]

        # Parse user instructions into structured constraints.
        constraints: Dict[str, Any] = {
            "blocked_ranges": [], "min_break_minutes": 0, "soft_preferences": None,
        }
        effective_events = list(calendar_events)
        if scheduling_instructions:
            try:
                constraints = await self._parse_scheduling_constraints(scheduling_instructions)
                # Inject blocked ranges as synthetic busy events
                if constraints["blocked_ranges"]:
                    start_date_dt = datetime.strptime(schedule_start_date, "%Y-%m-%d")
                    for day_offset in range(schedule_days):
                        d = start_date_dt + timedelta(days=day_offset)
                        date_str = d.strftime("%Y-%m-%d")
                        for bt in constraints["blocked_ranges"]:
                            effective_events.append({
                                "date": date_str,
                                "start": bt["start"],
                                "end": bt["end"],
                            })
                    logger.info(f"Injected {len(constraints['blocked_ranges'])} blocked ranges across {schedule_days} days")
            except Exception as e:
                logger.warning(f"Failed to parse scheduling instructions, continuing without: {e}")

        free_slots = self.compute_free_slots(
            effective_events, schedule_start_date, schedule_days,
            preferred_start_time, preferred_end_time, work_days, now=now
        )

        if not free_slots:
            logger.warning("No free slots available for scheduling")
            return []

        total_free = sum(s['duration_minutes'] for s in free_slots)
        logger.info(f"Computed {len(free_slots)} free slots, total {total_free} min available")

        # Sort tasks by importance; build lookup
        sorted_tasks = self._sort_tasks(tasks)
        task_by_id = {t['id']: t for t in sorted_tasks}
        retry_count: Dict[int, int] = {t['id']: 0 for t in sorted_tasks}

        # Queue: tasks waiting to be scheduled (in priority order)
        queue = list(sorted_tasks)
        all_slots: List[Dict[str, Any]] = []
        remaining_free = free_slots

        while queue and remaining_free:
            # Take next batch from the front of the queue
            batch = queue[:self.BATCH_SIZE]
            queue = queue[self.BATCH_SIZE:]

            batch_ids = [t['id'] for t in batch]
            logger.info(f"Scheduling batch: task IDs {batch_ids}, queue remaining: {len(queue)}")

            # --- LLM scheduling (fallback to greedy on exception) ---
            try:
                batch_slots = await self._llm_schedule(
                    batch, remaining_free, now=now,
                    scheduling_instructions=scheduling_instructions,
                    min_break_minutes=constraints["min_break_minutes"],
                )
            except Exception as e:
                logger.warning(f"LLM failed for batch {batch_ids}, using greedy: {e}")
                batch_slots = self._fallback_schedule(batch, remaining_free, min_break_minutes=constraints["min_break_minutes"])

            if not batch_slots:
                # LLM returned nothing — greedy fallback for entire batch
                batch_slots = self._fallback_schedule(batch, remaining_free, min_break_minutes=constraints["min_break_minutes"])

            # --- Overlap detection against ALL previously accepted slots ---
            num_existing = len(all_slots)
            combined = all_slots + batch_slots
            clean_slots, evicted_indices = self._detect_overlaps(combined)

            # Slot-level: determine which batch slots survived vs got evicted
            batch_evicted_indices = {i - num_existing for i in evicted_indices if i >= num_existing}
            accepted_batch = [s for i, s in enumerate(batch_slots) if i not in batch_evicted_indices]

            if accepted_batch:
                all_slots = clean_slots
                remaining_free = self._subtract_slots_with_break(free_slots, all_slots, constraints["min_break_minutes"])

            # --- Re-queue tasks that lost ALL their slots in this batch ---
            evicted_task_ids = {batch_slots[i]['task_id'] for i in batch_evicted_indices}
            accepted_task_ids = {s['task_id'] for s in accepted_batch}
            # Only re-queue tasks that have zero accepted slots in this batch
            fully_evicted = evicted_task_ids - accepted_task_ids
            for tid in fully_evicted:
                if tid in {t['id'] for t in batch}:
                    retry_count[tid] = retry_count.get(tid, 0) + 1
                    if retry_count[tid] <= self.MAX_RETRIES:
                        logger.info(f"Re-queuing evicted task {tid} (retry {retry_count[tid]}/{self.MAX_RETRIES})")
                        queue.append(task_by_id[tid])
                    else:
                        logger.warning(f"Task {tid} exceeded max retries, will use greedy")

            # --- Backfill: greedy for missed/under-scheduled tasks in this batch ---
            if remaining_free:
                scheduled_mins: Dict[int, int] = {}
                for s in accepted_batch:
                    tid = s['task_id']
                    sm = int(s['start_time'].split(':')[0]) * 60 + int(s['start_time'].split(':')[1])
                    em = int(s['end_time'].split(':')[0]) * 60 + int(s['end_time'].split(':')[1])
                    scheduled_mins[tid] = scheduled_mins.get(tid, 0) + (em - sm)

                missed = []
                for t in batch:
                    if t['id'] in fully_evicted:
                        continue  # already re-queued or will use greedy below
                    got = scheduled_mins.get(t['id'], 0)
                    need = t.get('estimated_minutes', 60)
                    if got < need:
                        missed.append({**t, 'estimated_minutes': need - got})

                if missed:
                    backfill = self._fallback_schedule(missed, remaining_free, min_break_minutes=constraints["min_break_minutes"])
                    if backfill:
                        all_slots.extend(backfill)
                        remaining_free = self._subtract_slots_with_break(remaining_free, backfill, constraints["min_break_minutes"])

        # --- Final greedy pass for tasks that exhausted retries ---
        exhausted = [task_by_id[tid] for tid, count in retry_count.items()
                     if count > self.MAX_RETRIES and tid not in {s['task_id'] for s in all_slots}]
        if exhausted and remaining_free:
            logger.info(f"Final greedy pass for {len(exhausted)} exhausted-retry tasks")
            final_slots = self._fallback_schedule(exhausted, remaining_free, min_break_minutes=constraints["min_break_minutes"])
            if final_slots:
                all_slots.extend(final_slots)

        # --- Safety-net: guarantee zero overlaps in final output ---
        all_slots = self._final_resolve_overlaps(all_slots, free_slots, min_break_minutes=constraints["min_break_minutes"])

        # --- Diagnostic: verify zero overlaps in final output ---
        if all_slots:
            by_date: Dict[str, List[Tuple[int, int, int]]] = {}
            for idx, s in enumerate(all_slots):
                sm = int(s['start_time'].split(':')[0]) * 60 + int(s['start_time'].split(':')[1])
                em = int(s['end_time'].split(':')[0]) * 60 + int(s['end_time'].split(':')[1])
                by_date.setdefault(s['date'], []).append((sm, em, s['task_id']))
            overlap_found = False
            for date, entries in by_date.items():
                entries.sort()
                for i in range(len(entries) - 1):
                    if entries[i][1] > entries[i + 1][0]:
                        overlap_found = True
                        logger.error(
                            f"OVERLAP IN FINAL OUTPUT on {date}: "
                            f"task {entries[i][2]} ends {entries[i][1]//60:02d}:{entries[i][1]%60:02d} "
                            f"> task {entries[i+1][2]} starts {entries[i+1][0]//60:02d}:{entries[i+1][0]%60:02d}"
                        )
            if not overlap_found:
                logger.info(f"Final output verified: {len(all_slots)} slots, ZERO overlaps")
            else:
                logger.error("BUG: overlaps detected in final output after safety-net!")

        return all_slots

    # ------------------------------------------------------------------
    # LLM scheduling
    # ------------------------------------------------------------------

    async def _llm_schedule(
        self,
        tasks: List[Dict[str, Any]],
        free_slots: List[Dict[str, Any]],
        now: Optional[datetime] = None,
        scheduling_instructions: str = None,
        min_break_minutes: int = 0,
    ) -> List[Dict[str, Any]]:
        """Use LLM to assign tasks to pre-computed free slots."""
        if now is None:
            now = datetime.now()

        current_date = now.strftime("%Y-%m-%d")
        current_time = now.strftime("%H:%M")

        # Build task descriptions
        task_lines = []
        for t in tasks:
            line = f"- Task ID {t['id']}: \"{t['title']}\" | Priority: {t.get('priority', 'medium')} | Duration: {t.get('estimated_minutes', 60)} min"
            if t.get('due_date'):
                line += f" | Due: {t['due_date']}"
            task_lines.append(line)

        # Build free slot descriptions
        slot_lines = []
        for s in free_slots:
            slot_lines.append(f"- {s['date']} {s['start']}-{s['end']} ({s['duration_minutes']} min available)")

        prompt = f"""Assign the following tasks into the available free time slots.

CURRENT DATE AND TIME: {current_date} {current_time} (user's local time)

TASKS TO SCHEDULE:
{chr(10).join(task_lines)}

AVAILABLE FREE SLOTS (you MUST only use time within these slots):
{chr(10).join(slot_lines)}

RULES:
1. You MUST place each task entirely within one of the free slots above. Do NOT use any time outside these slots.
2. CRITICAL: You MUST NOT schedule any task before {current_time} on {current_date}. The current time is {current_time} — all tasks on today must start AFTER this time.
3. Place urgent/high priority tasks earlier in the day and week.
4. If a task duration exceeds {MAX_BLOCK_MINUTES} min, split into multiple blocks (max {MAX_BLOCK_MINUTES} min each). Each block must fit within a free slot.
5. If a free slot is large enough for multiple tasks, you can place them sequentially within it.
6. Place tasks before their due dates when possible.
7. If a task cannot fit in any remaining free slot, omit it.
{f"8. IMPORTANT: Leave at least {min_break_minutes} minutes of FREE GAP between consecutive tasks. Do NOT schedule tasks back-to-back." if min_break_minutes > 0 else ""}{f"""

USER PREFERENCES (follow these when choosing between available slots):
{scheduling_instructions}
""" if scheduling_instructions else ""}
Respond with ONLY a JSON object containing a "slots" array. Each element in "slots":
{{"task_id": <int>, "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM"}}

Example: {{"slots": [{{"task_id": 1, "date": "2025-01-01", "start_time": "09:00", "end_time": "10:00"}}]}}"""

        response = await self._call_llm(
            prompt, max_tokens=2048, temperature=0.2,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "task_schedule",
                    "strict": True,
                    "schema": SCHEDULE_RESPONSE_SCHEMA,
                }
            },
        )
        parsed = self._parse_json_response(response)

        # Unwrap {"slots": [...]} wrapper or accept raw array for backward compat
        if isinstance(parsed, dict) and "slots" in parsed:
            result = parsed["slots"]
        elif isinstance(parsed, list):
            result = parsed
        else:
            raise Exception("LLM returned invalid schedule format")

        if not isinstance(result, list):
            raise Exception("LLM returned invalid schedule format")

        # Validate: each LLM slot must fit within a known free slot
        # Build a lookup of free intervals per date for fast validation
        free_by_date: Dict[str, List[Tuple[int, int]]] = {}
        for s in free_slots:
            s_min = int(s['start'].split(':')[0]) * 60 + int(s['start'].split(':')[1])
            e_min = int(s['end'].split(':')[0]) * 60 + int(s['end'].split(':')[1])
            free_by_date.setdefault(s['date'], []).append((s_min, e_min))

        valid_task_ids = {t['id'] for t in tasks}
        # Budget: max minutes per task (prevent LLM from over-scheduling)
        task_budget = {t['id']: t.get('estimated_minutes', 60) for t in tasks}
        task_scheduled = {t['id']: 0 for t in tasks}
        valid_slots = []
        # Track consumed portions of free slots to prevent double-booking
        consumed_by_date: Dict[str, List[Tuple[int, int]]] = {}

        # Hard constraint: reject any slot starting before current time on today
        now_date = current_date
        now_min = int(current_time.split(':')[0]) * 60 + int(current_time.split(':')[1])

        for slot in result:
            if not isinstance(slot, dict):
                continue
            task_id = slot.get('task_id')
            if task_id not in valid_task_ids:
                continue
            if not slot.get('date') or not slot.get('start_time') or not slot.get('end_time'):
                continue

            try:
                s_min = int(slot['start_time'].split(':')[0]) * 60 + int(slot['start_time'].split(':')[1])
                e_min = int(slot['end_time'].split(':')[0]) * 60 + int(slot['end_time'].split(':')[1])
                if e_min <= s_min:
                    continue
            except (ValueError, IndexError):
                continue

            date = slot['date']

            # Hard reject: no tasks before current time on today
            if date == now_date and s_min < now_min:
                logger.warning(f"LLM slot task {task_id} at {date} {slot['start_time']} is before current time {current_time}, skipping")
                continue

            # Check that this slot fits within a free slot
            fits_in_free = False
            for fs, fe in free_by_date.get(date, []):
                if s_min >= fs and e_min <= fe:
                    fits_in_free = True
                    break
            if not fits_in_free:
                logger.warning(f"LLM slot task {task_id} at {date} {slot['start_time']}-{slot['end_time']} outside free slots, skipping")
                continue

            # Check no overlap with already-accepted slots (including break buffer after each slot)
            has_conflict = False
            for cs, ce in consumed_by_date.get(date, []):
                # Break buffer only AFTER existing slot (transition time), consistent with fallback scheduler
                buffered_ce = ce + min_break_minutes
                if s_min < buffered_ce and e_min > cs:
                    has_conflict = True
                    break
            if has_conflict:
                logger.warning(f"LLM slot task {task_id} at {date} {slot['start_time']}-{slot['end_time']} conflicts with accepted slot (incl. {min_break_minutes}min break), skipping")
                continue

            # Enforce per-task time budget: don't exceed estimated_minutes
            slot_duration = e_min - s_min
            budget = task_budget.get(task_id, 60)
            already = task_scheduled.get(task_id, 0)
            if already >= budget:
                logger.warning(f"LLM slot task {task_id} already fully scheduled ({already}/{budget} min), skipping extra slot")
                continue
            # For tasks that fit in a single block, only accept one slot
            # (prevent LLM from unnecessarily splitting small tasks)
            if budget <= MAX_BLOCK_MINUTES and already > 0:
                logger.warning(f"LLM slot task {task_id} already has a slot ({already} min), rejecting split for ≤{MAX_BLOCK_MINUTES}min task")
                continue
            # Trim slot if it would exceed the budget
            if already + slot_duration > budget:
                slot_duration = budget - already
                if slot_duration < MIN_SLOT_MINUTES:
                    continue
                e_min = s_min + slot_duration

            s_h, s_m_r = divmod(s_min, 60)
            e_h, e_m_r = divmod(e_min, 60)
            valid_slots.append({
                'task_id': task_id,
                'date': date,
                'start_time': f"{s_h:02d}:{s_m_r:02d}",
                'end_time': f"{e_h:02d}:{e_m_r:02d}",
            })
            task_scheduled[task_id] = already + slot_duration
            consumed_by_date.setdefault(date, []).append((s_min, e_min))

        return valid_slots

    # ------------------------------------------------------------------
    # Fallback greedy scheduling
    # ------------------------------------------------------------------

    def _fallback_schedule(
        self,
        tasks: List[Dict[str, Any]],
        free_slots: List[Dict[str, Any]],
        min_break_minutes: int = 0,
    ) -> List[Dict[str, Any]]:
        """Greedy slot-filling algorithm using pre-computed free slots."""
        sorted_tasks = self._sort_tasks(tasks)

        # Convert free slots to mutable list of (date, start_min, end_min)
        available = []
        for s in free_slots:
            s_min = int(s['start'].split(':')[0]) * 60 + int(s['start'].split(':')[1])
            e_min = int(s['end'].split(':')[0]) * 60 + int(s['end'].split(':')[1])
            available.append([s['date'], s_min, e_min])

        scheduled = []

        for task in sorted_tasks:
            remaining = task.get('estimated_minutes', 60)

            for slot in available:
                if remaining <= 0:
                    break
                date_str, slot_start, slot_end = slot
                gap = slot_end - slot_start
                if gap < MIN_SLOT_MINUTES:
                    continue

                # Take up to MAX_BLOCK_MINUTES from this slot
                block = min(remaining, MAX_BLOCK_MINUTES, gap)
                if block < MIN_SLOT_MINUTES:
                    continue

                s_h, s_m = divmod(slot_start, 60)
                e_h, e_m = divmod(slot_start + block, 60)
                scheduled.append({
                    'task_id': task['id'],
                    'date': date_str,
                    'start_time': f"{s_h:02d}:{s_m:02d}",
                    'end_time': f"{e_h:02d}:{e_m:02d}",
                })
                remaining -= block
                # Shrink slot: consume task time + break buffer
                slot[1] = slot_start + block + min_break_minutes

        return scheduled

    # ------------------------------------------------------------------
    # Instruction parsing → structured scheduling constraints
    # ------------------------------------------------------------------

    async def _parse_scheduling_constraints(self, scheduling_instructions: str) -> Dict[str, Any]:
        """
        Parse natural-language scheduling instructions into structured constraints.

        Returns:
            {
                "blocked_ranges": [{"start": "HH:MM", "end": "HH:MM"}, ...],
                "min_break_minutes": int,       # 0 = no break required
                "soft_preferences": str | None  # free text for LLM prompt
            }
        """
        constraints: Dict[str, Any] = {
            "blocked_ranges": [],
            "min_break_minutes": 0,
            "soft_preferences": None,
        }

        # --- Fast regex pass for blocked time ranges ---
        constraints["blocked_ranges"].extend(self._regex_parse_blocked(scheduling_instructions))

        # --- Fast regex pass for break/gap durations ---
        break_match = re.search(
            r'(\d+)\s*-?\s*(?:min(?:ute)?s?|hours?)\s*(?:break|gap|rest|buffer|pause|between)',
            scheduling_instructions,
            re.IGNORECASE,
        )
        if not break_match:
            # Also match "break of 30 min" / "gap of 1 hour"
            break_match = re.search(
                r'(?:break|gap|rest|buffer|pause|between)[^0-9]*(\d+)\s*-?\s*(?:min(?:ute)?s?|hours?)',
                scheduling_instructions,
                re.IGNORECASE,
            )
        if break_match:
            val = int(break_match.group(1))
            # Convert hours to minutes
            if re.search(r'hours?', break_match.group(0), re.IGNORECASE):
                val *= 60
            constraints["min_break_minutes"] = val

        # --- LLM pass for comprehensive parsing ---
        try:
            prompt = f"""Parse these scheduling instructions into structured constraints.

INSTRUCTIONS:
{scheduling_instructions}

Return a JSON object with these fields:
1. "blocked_ranges": Array of time ranges to block. Each: {{"start": "HH:MM", "end": "HH:MM"}} in 24-hour format.
   Examples: "Skip 12-1 PM" → {{"start": "12:00", "end": "13:00"}}, "No tasks 6-8pm" → {{"start": "18:00", "end": "20:00"}}
   If none, use empty array [].

2. "min_break_minutes": Minimum break/gap between consecutive tasks in minutes.
   Examples: "30 min break between tasks" → 30, "1 hour gap" → 60
   If not specified, use 0.

3. "soft_preferences": Any remaining preferences that aren't blocked ranges or break durations, as a short string.
   Examples: "Deep work before noon", "Important tasks in the morning"
   If none, use empty string "".

Respond with ONLY a JSON object, no other text."""

            response = await self._call_llm(
                prompt, max_tokens=256, temperature=0.0,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "scheduling_constraints",
                        "strict": True,
                        "schema": SCHEDULING_CONSTRAINTS_SCHEMA,
                    }
                },
            )
            parsed = self._parse_json_response(response)

            if isinstance(parsed, dict):
                # Merge blocked ranges (deduplicated)
                for item in parsed.get("blocked_ranges", []):
                    if isinstance(item, dict) and 'start' in item and 'end' in item:
                        start = str(item['start']).strip()
                        end = str(item['end']).strip()
                        if re.match(r'^\d{1,2}:\d{2}$', start) and re.match(r'^\d{1,2}:\d{2}$', end):
                            start = start.zfill(5)
                            end = end.zfill(5)
                            s_min = int(start[:2]) * 60 + int(start[3:])
                            e_min = int(end[:2]) * 60 + int(end[3:])
                            if 0 <= s_min < 1440 and 0 < e_min <= 1440 and s_min < e_min:
                                if not any(b['start'] == start and b['end'] == end for b in constraints["blocked_ranges"]):
                                    constraints["blocked_ranges"].append({"start": start, "end": end})

                # Take LLM break minutes if regex didn't find one
                if constraints["min_break_minutes"] == 0:
                    llm_break = parsed.get("min_break_minutes", 0)
                    if isinstance(llm_break, (int, float)) and 0 < llm_break <= 120:
                        constraints["min_break_minutes"] = int(llm_break)

                # Soft preferences
                soft = parsed.get("soft_preferences")
                if isinstance(soft, str) and soft.strip():
                    constraints["soft_preferences"] = soft.strip()

        except Exception as e:
            logger.warning(f"LLM constraint parsing failed (regex results kept): {e}")

        logger.info(f"Parsed scheduling constraints: blocked_ranges={len(constraints['blocked_ranges'])}, "
                     f"min_break={constraints['min_break_minutes']}min, "
                     f"soft_preferences={'yes' if constraints['soft_preferences'] else 'none'}")
        return constraints

    @staticmethod
    def _regex_parse_blocked(text: str) -> List[Dict[str, str]]:
        """
        Fast regex extraction for common blocked-time patterns:
          - "skip 12-1 PM", "skip 12:00-1:00 PM", "no tasks 6-8pm"
          - "block 9-10 AM", "avoid 12-1pm"
        """
        results = []
        # Pattern: optional keywords + time range with optional AM/PM on start and/or end
        pattern = re.compile(
            r'(?:skip|block|no\s+\w+|avoid|break|off|free|lunch|dinner|breakfast)'
            r'[^0-9]*'
            r'(\d{1,2})(?::(\d{2}))?\s*'           # start hour[:min]
            r'(am|pm)?\s*'                            # optional AM/PM on start time
            r'(?:–|-|to)\s*'                          # separator (en-dash, hyphen, "to")
            r'(\d{1,2})(?::(\d{2}))?\s*'           # end hour[:min]
            r'(am|pm)?',                              # optional trailing AM/PM
            re.IGNORECASE,
        )
        for m in pattern.finditer(text):
            sh, sm = int(m.group(1)), int(m.group(2) or 0)
            start_ampm = (m.group(3) or '').lower()
            eh, em = int(m.group(4)), int(m.group(5) or 0)
            end_ampm = (m.group(6) or '').lower()
            # Use end AM/PM as primary; if only start AM/PM given, apply to both
            ampm = end_ampm or start_ampm

            # Convert 12-hour to 24-hour
            # Determine individual AM/PM for start and end
            s_ampm = start_ampm or ampm
            e_ampm = end_ampm or ampm

            if e_ampm == 'pm':
                if eh < 12:
                    eh += 12
            elif e_ampm == 'am':
                if eh == 12:
                    eh = 0

            if s_ampm == 'pm':
                if sh < 12:
                    if sh + 12 <= eh:
                        sh += 12
            elif s_ampm == 'am':
                if sh == 12:
                    sh = 0

            # No AM/PM: heuristic for common patterns
            if not ampm:
                if sh == 12 and eh < 12:
                    # "12-1" → noon to 1pm
                    eh += 12
                elif sh < 12 and eh <= sh:
                    # "6-5" doesn't make sense, assume pm wrap
                    eh += 12

            start_str = f"{sh:02d}:{sm:02d}"
            end_str = f"{eh:02d}:{em:02d}"

            # Sanity check
            s_min = sh * 60 + sm
            e_min = eh * 60 + em
            if 0 <= s_min < 1440 and 0 < e_min <= 1440 and s_min < e_min:
                results.append({"start": start_str, "end": end_str})

        return results

    # ------------------------------------------------------------------
    # LLM helpers
    # ------------------------------------------------------------------

    async def _call_llm(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.3,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Call vLLM for text generation with optional JSON schema enforcement."""
        try:
            body = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a productivity expert and scheduling optimizer. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if response_format:
                body["response_format"] = response_format

            response = await self.client.post(
                f"{self.api_base}/chat/completions",
                json=body,
                timeout=120.0
            )

            if response.status_code != 200:
                logger.error(f"vLLM API error: {response.status_code} - {response.text}")
                raise Exception(f"vLLM API error: {response.status_code}")

            result = response.json()
            choices = result.get("choices")
            if not choices or not isinstance(choices, list):
                logger.error(f"vLLM returned no choices: {str(result)[:200]}")
                raise Exception("AI returned an empty response")
            return choices[0].get("message", {}).get("content", "").strip()

        except httpx.TimeoutException:
            logger.error("vLLM request timed out")
            raise Exception("AI request timed out. Please try again.")
        except Exception as e:
            logger.error(f"vLLM call failed: {str(e)}")
            raise

    def _parse_json_response(self, response: str) -> Any:
        """Parse LLM response, handling markdown code blocks."""
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Raw response: {response}")
            return None


# Singleton instance
task_scheduling_service = TaskSchedulingService()
