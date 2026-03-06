"""
Pydantic schemas for Work Agent API.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime

VALID_STATUSES = {"none", "todo", "in_progress", "review", "done", "delayed"}
VALID_PRIORITIES = {"none", "low", "medium", "high", "urgent"}


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""
    message: str = Field(..., description="User's message to the assistant")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")


class ChatResponse(BaseModel):
    """Response schema for chat endpoint."""
    response: str = Field(..., description="Assistant's response")
    session_id: Optional[str] = Field(None, description="Session ID")
    status: str = Field(default="success", description="Response status")


class TodoCreate(BaseModel):
    """Request schema for creating a todo."""
    title: str = Field(..., min_length=1, max_length=500, description="Todo title")
    description: Optional[str] = Field(None, description="Todo description")
    status: Optional[str] = Field("todo", description="Status: none, todo, in_progress, review, done, delayed")
    due_date: Optional[str] = Field(None, description="Due date (YYYY-MM-DD or YYYY-MM-DD HH:MM)")
    priority: Optional[str] = Field("none", description="Priority: none, low, medium, high, urgent")
    category: Optional[str] = Field(None, max_length=100, description="Category")

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority '{v}'. Must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


class TodoUpdate(BaseModel):
    """Request schema for updating a todo."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority '{v}'. Must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


class TodoResponse(BaseModel):
    """Response schema for todo operations."""
    id: int
    user_id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    category: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    ai_summary: Optional[List[str]] = None
    # AI prioritization fields
    ai_estimated_minutes: Optional[int] = None
    ai_suggested_order: Optional[int] = None
    ai_priority_reasoning: Optional[str] = None
    ai_last_analyzed: Optional[datetime] = None
    external_source: Optional[str] = None
    is_scheduled: bool = False
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    scheduled_calendar_event_id: Optional[str] = None

    class Config:
        from_attributes = True


class AttachmentResponse(BaseModel):
    """Response schema for task attachments."""
    id: int
    todo_id: Optional[int] = None
    filename: str
    original_filename: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: Optional[datetime] = None
    url: str

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    """Response schema for health check."""
    status: str
    service: str
    version: str = "1.0.0"


class TaskExtractRequest(BaseModel):
    """Request schema for extracting tasks from emails."""
    sources: List[str] = Field(
        default=["email"],
        description="Sources to extract from: email"
    )
    # New date range fields (ISO format: YYYY-MM-DD)
    email_start_date: Optional[str] = Field(None, description="Start date for emails (YYYY-MM-DD)")
    email_end_date: Optional[str] = Field(None, description="End date for emails (YYYY-MM-DD)")
    # Legacy fields (kept for backward compatibility, will be ignored if date fields are provided)
    email_days_back: int = Field(default=7, ge=1, le=90, description="Days back for emails (legacy)")
    max_emails: int = Field(default=50, ge=1, le=200, description="Max emails to analyze")
    email_account_ids: Optional[List[str]] = Field(None, description="Specific OAuth account IDs to extract from (null = all)")


class ExtractedTask(BaseModel):
    """Schema for an extracted task."""
    id: Optional[int] = Field(None, description="Database ID (for saved tasks)")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description/context")
    source_type: str = Field(..., description="Source: email or gtask")
    source_id: str = Field(..., description="ID of source email or Google Task")
    source_subject: Optional[str] = Field(None, description="Subject of source email or task list name")
    source_account: Optional[str] = Field(None, description="Account email this came from")
    source_date: Optional[str] = Field(None, description="Original date of source")
    priority: str = Field(default="none", description="Suggested priority")
    due_date: Optional[str] = Field(None, description="Suggested due date")
    confidence: float = Field(default=0.8, ge=0, le=1, description="Extraction confidence")
    ai_summary: Optional[list] = Field(default=None, description="LLM-generated summary bullets (pre-populated from extraction)")


class TaskExtractResponse(BaseModel):
    """Response schema for task extraction."""
    tasks: List[ExtractedTask] = Field(default_factory=list)
    sources_analyzed: dict = Field(default_factory=dict, description="Count of sources analyzed")
    extraction_time: float = Field(default=0, description="Time taken in seconds")
    accounts_missing_tasks_scope: List[str] = Field(default_factory=list, description="Accounts that need re-authorization for Google Tasks")
    # Filtering pipeline stats (3-stage: rule-based → classification → LLM)
    filter_stats: Optional[dict] = Field(default=None, description="Email filtering pipeline statistics")
    new_tasks_count: int = Field(default=0, description="Number of newly extracted tasks in this request")
    from_cache: bool = Field(default=False, description="Whether results are from cache (no new extraction)")
    extraction_in_progress: bool = Field(default=False, description="Whether background extraction is still running")
    # Pagination info - allows frontend to use extract result directly without extra API call
    total: int = Field(default=0, description="Total number of pending tasks")
    pending_count: int = Field(default=0, description="Number of pending (unprocessed) tasks")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=10, description="Items per page")
    total_pages: int = Field(default=1, description="Total number of pages")


class SyncStatusResponse(BaseModel):
    """Response schema for extraction sync status."""
    user_id: int
    last_extraction_at: Optional[datetime] = None
    total_cached_tasks: int = 0
    pending_tasks: int = 0
    processed_sources: dict = Field(default_factory=dict, description="Count of processed sources by type")
    needs_extraction: bool = Field(default=True, description="Whether new extraction is recommended")


# ==================== AI Task Prioritization Schemas ====================

class PrioritizationContext(BaseModel):
    """Context for AI task prioritization."""
    work_hours_per_day: int = Field(default=8, ge=1, le=16, description="Working hours per day")
    work_days: List[str] = Field(
        default=["mon", "tue", "wed", "thu", "fri"],
        description="Working days (mon, tue, wed, thu, fri, sat, sun)"
    )
    preferred_start_time: str = Field(default="09:00", description="Preferred work start time (HH:MM)")
    schedule_start_date: Optional[str] = Field(None, description="Start date for scheduling (YYYY-MM-DD)")
    schedule_days: int = Field(default=7, ge=1, le=30, description="Number of days to schedule")


class TaskPrioritizeRequest(BaseModel):
    """Request schema for AI task prioritization."""
    user_id: int = Field(..., description="User ID")
    task_ids: Optional[List[int]] = Field(None, description="Specific task IDs to analyze (null = all pending)")
    include_triage: bool = Field(default=False, description="Include extracted/triage tasks")
    context: Optional[PrioritizationContext] = Field(default=None, description="User work preferences")
    mode: str = Field(default="auto", description="Prioritization mode: 'fast' (heuristic only, instant), 'ai' (LLM with parallel batching), 'auto' (smart routing)")


class PrioritizedTask(BaseModel):
    """Schema for a prioritized task result."""
    task_id: int = Field(..., description="Task ID")
    task_type: str = Field(..., description="Task type: todo or extracted")
    title: str = Field(..., description="Task title")
    original_priority: str = Field(..., description="Original priority level")
    suggested_priority: str = Field(..., description="AI-suggested priority: urgent, high, medium, low")
    priority_score: float = Field(..., ge=0, le=1, description="Priority confidence score")
    reasoning: str = Field(..., description="Explanation for priority suggestion")
    estimated_minutes: int = Field(..., ge=0, description="AI-estimated duration in minutes")
    suggested_order: int = Field(..., ge=1, description="Suggested execution order")


class ScheduledTask(BaseModel):
    """Schema for a scheduled task slot."""
    task_id: int = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    suggested_start: str = Field(..., description="Suggested start time (HH:MM)")
    suggested_end: str = Field(..., description="Suggested end time (HH:MM)")
    estimated_minutes: int = Field(..., ge=0, description="Estimated duration")


class CalendarEvent(BaseModel):
    """Schema for existing calendar events (view only)."""
    date: str = Field(..., description="Event date (YYYY-MM-DD)")
    start: str = Field(..., description="Start time (HH:MM)")
    end: str = Field(..., description="End time (HH:MM)")
    title: str = Field(..., description="Event title")


class PrioritizationWarning(BaseModel):
    """Schema for prioritization warnings."""
    type: str = Field(..., description="Warning type: overdue, overload, conflict, deadline, info")
    task_id: Optional[int] = Field(None, description="Related task ID")
    date: Optional[str] = Field(None, description="Related date")
    message: str = Field(..., description="Warning message")


class PrioritizationSummary(BaseModel):
    """Summary statistics for prioritization results."""
    total_tasks: int = Field(..., description="Total tasks analyzed")
    urgent: int = Field(default=0, description="Count of urgent priority tasks")
    high: int = Field(default=0, description="Count of high priority tasks")
    medium: int = Field(default=0, description="Count of medium priority tasks")
    low: int = Field(default=0, description="Count of low priority tasks")
    none: int = Field(default=0, description="Count of unprioritized tasks")
    total_estimated_hours: float = Field(default=0, description="Total estimated work hours")
    scheduled_days: int = Field(default=0, description="Number of days with scheduled tasks")


class TaskPrioritizeResponse(BaseModel):
    """Response schema for AI task prioritization."""
    prioritized_tasks: List[PrioritizedTask] = Field(default_factory=list)
    schedule: dict = Field(default_factory=dict, description="Daily schedule: {date: [ScheduledTask]}")
    calendar_events: List[CalendarEvent] = Field(default_factory=list, description="Existing calendar events")
    warnings: List[PrioritizationWarning] = Field(default_factory=list)
    summary: PrioritizationSummary
    method: str = Field(default="full_llm", description="Prioritization method used: cached, heuristic, incremental_llm, full_llm")


class TaskPriorityUpdate(BaseModel):
    """Schema for a single task priority update."""
    task_id: int = Field(..., description="Task ID to update")
    task_type: str = Field(default="todo", description="Task type: todo or extracted")
    priority: str = Field(..., description="New priority: urgent, high, medium, low")
    estimated_minutes: Optional[int] = Field(None, ge=0, description="AI-estimated duration")


class ApplyPrioritiesRequest(BaseModel):
    """Request schema for applying AI priority suggestions."""
    user_id: int = Field(..., description="User ID")
    updates: List[TaskPriorityUpdate] = Field(..., description="List of priority updates to apply")


class ApplyPrioritiesResponse(BaseModel):
    """Response schema for applying priorities."""
    success: bool = Field(..., description="Whether updates were successful")
    updated_count: int = Field(..., description="Number of tasks updated")


class ReorderItem(BaseModel):
    """Schema for a single reorder entry."""
    task_id: int = Field(..., description="Task ID")
    suggested_order: int = Field(..., ge=1, description="New suggested order (1-based)")


class ReorderRequest(BaseModel):
    """Request schema for manual task reordering."""
    user_id: int = Field(..., description="User ID")
    order: List[ReorderItem] = Field(..., min_length=1, description="List of task reorder entries")


# ==================== Todo Comment Schemas ====================

class ConversationMessage(BaseModel):
    """A single message in the AI solver conversation."""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class TaskSolverChatRequest(BaseModel):
    """Request schema for AI task solver chat."""
    message: str = Field(..., min_length=1, max_length=5000, description="User message")
    conversation_history: List[ConversationMessage] = Field(default=[], description="Previous conversation messages")
    quick_action: Optional[str] = Field(None, description="Quick action type: suggest_approach, break_down, estimate_time, identify_blockers")
    session_id: Optional[int] = Field(None, description="Solver session ID for persistence")


class CommentCreate(BaseModel):
    """Request schema for creating a comment."""
    content: str = Field(..., min_length=1, max_length=2000, description="Comment text")


class CommentResponse(BaseModel):
    """Response schema for a comment."""
    id: int
    todo_id: int
    user_id: int
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== AI Solver Session Schemas ====================

class SolverSessionResponse(BaseModel):
    """Response schema for a solver session."""
    id: int
    todo_id: int
    title: str
    message_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SolverMessageResponse(BaseModel):
    """Response schema for a solver message."""
    id: int
    session_id: int
    role: str
    content: str
    quick_action: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SolverSessionDetail(BaseModel):
    """Solver session with messages."""
    id: int
    todo_id: int
    title: str
    message_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    messages: List[SolverMessageResponse] = []

    class Config:
        from_attributes = True


class SolverSessionCreate(BaseModel):
    """Request schema for creating a solver session."""
    title: Optional[str] = Field(None, max_length=200, description="Session title (auto-generated if omitted)")


class SolverSessionRename(BaseModel):
    """Request schema for renaming a solver session."""
    title: str = Field(..., min_length=1, max_length=200, description="New session title")


# ==================== Task Scheduling Schemas ====================

class TaskScheduleRequest(BaseModel):
    """Request schema for AI task scheduling to Google Calendar."""
    user_id: int = Field(..., description="User ID")
    task_ids: Optional[List[int]] = Field(None, description="Specific task IDs to schedule (null = all pending)")
    account_id: int = Field(..., description="OAuth account ID for Google Calendar")
    schedule_start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD), default: today")
    schedule_days: int = Field(default=7, ge=1, le=30, description="Number of days to schedule across")
    preferred_start_time: str = Field(default="09:00", description="Preferred work start time (HH:MM)")
    preferred_end_time: str = Field(default="17:00", description="Preferred work end time (HH:MM)")
    work_days: List[str] = Field(
        default=["mon", "tue", "wed", "thu", "fri"],
        description="Working days (mon, tue, wed, thu, fri, sat, sun)"
    )
    user_timezone: Optional[str] = Field(None, description="Browser timezone (IANA, e.g. 'Asia/Shanghai')")
    scheduling_instructions: Optional[str] = Field(None, max_length=500, description="Natural language scheduling preferences")


class ScheduledEventResult(BaseModel):
    """Schema for a single scheduled calendar event result."""
    task_id: int = Field(..., description="Task ID that was scheduled")
    task_title: str = Field(..., description="Task title")
    calendar_event_id: str = Field(..., description="Created Google Calendar event ID")
    start: str = Field(..., description="Event start time (ISO datetime)")
    end: str = Field(..., description="Event end time (ISO datetime)")
    estimated_minutes: int = Field(..., description="Estimated duration in minutes")


class TaskScheduleResponse(BaseModel):
    """Response schema for task scheduling (confirm step)."""
    success: bool = Field(..., description="Whether scheduling was successful")
    scheduled_events: List[ScheduledEventResult] = Field(default_factory=list)
    skipped_tasks: List[dict] = Field(default_factory=list, description="Tasks that couldn't fit in schedule")
    warnings: List[str] = Field(default_factory=list, description="Scheduling warnings")


class ScheduleSlot(BaseModel):
    """A single proposed schedule slot from AI preview."""
    task_id: int = Field(..., description="Task ID")
    task_title: str = Field(..., description="Task title")
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    start_time: str = Field(..., description="Start time (HH:MM)")
    end_time: str = Field(..., description="End time (HH:MM)")
    estimated_minutes: int = Field(default=60, description="Estimated duration in minutes")
    priority: str = Field(default="medium", description="Task priority")


class TaskSchedulePreviewResponse(BaseModel):
    """Response schema for schedule preview (no events created)."""
    success: bool = Field(..., description="Whether preview generation was successful")
    scheduled_slots: List[ScheduleSlot] = Field(default_factory=list)
    skipped_tasks: List[dict] = Field(default_factory=list, description="Tasks that couldn't fit in schedule")
    warnings: List[str] = Field(default_factory=list, description="Scheduling warnings")


class TaskScheduleAcceptRequest(BaseModel):
    """Request schema for accepting schedule slots locally (no Google Calendar)."""
    user_id: int = Field(..., description="User ID")
    slots: List[ScheduleSlot] = Field(..., description="Schedule slots to accept locally")
    user_timezone: Optional[str] = Field(None, description="Browser timezone (IANA)")


class TaskScheduleAcceptResponse(BaseModel):
    """Response schema for accepting schedule slots locally."""
    success: bool = Field(..., description="Whether accept was successful")
    accepted_count: int = Field(default=0, description="Number of tasks accepted")
    warnings: List[str] = Field(default_factory=list, description="Warnings")


class TaskSchedulePushRequest(BaseModel):
    """Request schema for pushing accepted tasks to Google Calendar."""
    user_id: int = Field(..., description="User ID")
    account_id: int = Field(..., description="OAuth account ID for Google Calendar")
    task_ids: List[int] = Field(..., description="Task IDs to push to Google Calendar")
    user_timezone: Optional[str] = Field(None, description="Browser timezone (IANA)")


class TaskScheduleUnacceptRequest(BaseModel):
    """Request schema for removing local scheduling from a task."""
    user_id: int = Field(..., description="User ID")
    task_id: int = Field(..., description="Task ID to unschedule locally")


class ScheduledTaskEvent(BaseModel):
    """Schema for a locally-scheduled task event (calendar view)."""
    task_id: int = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    date: str = Field(..., description="Scheduled date (YYYY-MM-DD)")
    start_time: str = Field(..., description="Start time (HH:MM)")
    end_time: str = Field(..., description="End time (HH:MM)")
    priority: str = Field(default="medium", description="Task priority")
    has_calendar_event: bool = Field(default=False, description="Whether pushed to Google Calendar")


class TaskUnscheduleRequest(BaseModel):
    """Request schema for removing an AI-scheduled event from Google Calendar."""
    user_id: int = Field(..., description="User ID")
    account_id: int = Field(..., description="OAuth account ID for Google Calendar")
    calendar_event_id: str = Field(..., description="Google Calendar event ID to delete")
    task_id: int = Field(..., description="Task ID to reset as unscheduled")
