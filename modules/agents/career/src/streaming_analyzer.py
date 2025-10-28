"""Streaming resume analyzer with real-time progress updates.

This module provides streaming analysis capabilities that process resume sections
sequentially and provide real-time updates to the frontend.
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, AsyncGenerator, Callable
from datetime import datetime, timedelta
import httpx

from workflow_engine import ResumeAnalysisWorkflow, WorkflowProgress
from parallel_workflow_engine import ParallelResumeAnalysisWorkflow, ParallelConfig, ParallelStrategy
from resume_analyzer import ResumeAnalyzer
from chat_service import get_chat_service, ChatService
from error_handler import RetryConfig, ErrorSeverity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamingResumeAnalyzer:
    """Streaming resume analyzer with real-time progress updates."""
    
    def __init__(self, chat_service: Optional[ChatService] = None,
                 notification_service_url: Optional[str] = None,
                 retry_config: Optional[RetryConfig] = None,
                 parallel_config: Optional[ParallelConfig] = None,
                 enable_parallel: bool = False):
        """Initialize the streaming analyzer.

        Args:
            chat_service: Optional ChatService instance
            notification_service_url: URL of the personal assistant notification service
            retry_config: Configuration for error handling and retries
            parallel_config: Configuration for parallel processing
            enable_parallel: Whether to use parallel processing
        """
        self.chat_service = chat_service or ChatService()

        # Get notification service URL from environment variable or use default
        if notification_service_url is None:
            notification_service_url = os.getenv("PA_NOTIFICATION_SERVICE_URL", "http://localhost:8001")
        
        # Configure retry settings for analysis (optimized for local LLM)
        if retry_config is None:
            retry_config = RetryConfig(
                max_retries=3,  # Reduced retries for longer timeouts
                base_delay=2.0,  # Slightly longer delay between retries
                max_delay=30.0,  # Increased max delay
                exponential_backoff=True,
                jitter=True,
                timeout=300.0  # 5 minutes for local LLM processing
            )
        
        # Configure parallel processing (optimized for local LLM)
        if parallel_config is None:
            parallel_config = ParallelConfig(
                strategy=ParallelStrategy.BATCH_PARALLEL,
                max_concurrent_sections=2,  # Reduced concurrency for local LLM
                batch_size=1,  # Process one section at a time in each batch
                enable_section_caching=True,
                timeout_per_section=300.0  # 5 minutes for local LLM processing
            )
        
        # Choose workflow engine based on parallel setting
        if enable_parallel:
            self.workflow = ParallelResumeAnalysisWorkflow(
                self.chat_service, retry_config, parallel_config
            )
            logger.info(f"Initialized with parallel workflow: {parallel_config.strategy.value}")
        else:
            self.workflow = ResumeAnalysisWorkflow(self.chat_service, retry_config)
            logger.info("Initialized with sequential workflow")
        
        self.resume_analyzer = ResumeAnalyzer(self.chat_service)
        self.notification_service_url = notification_service_url
        self.retry_config = retry_config
        self.parallel_config = parallel_config
        self.enable_parallel = enable_parallel
        
    async def _send_notification(self, user_id: int, notification_type: str, **kwargs):
        """Send notification to the personal assistant notification service.
        
        Args:
            user_id: Target user ID
            notification_type: Type of notification (progress, complete, error)
            **kwargs: Additional notification data
        """
        try:
            async with httpx.AsyncClient() as client:
                if notification_type == "progress":
                    url = f"{self.notification_service_url}/api/notifications/career-progress"
                    data = {
                        "user_id": user_id,
                        "session_id": kwargs.get("session_id"),
                        "current_section": kwargs.get("current_section"),
                        "progress": kwargs.get("progress"),
                        "total_sections": kwargs.get("total_sections"),
                        "status": kwargs.get("status", "analyzing")
                    }
                elif notification_type == "complete":
                    url = f"{self.notification_service_url}/api/notifications/career-complete"
                    data = {
                        "user_id": user_id,
                        "session_id": kwargs.get("session_id"),
                        "sections_completed": kwargs.get("sections_completed")
                    }
                elif notification_type == "error":
                    url = f"{self.notification_service_url}/api/notifications/career-error"
                    data = {
                        "user_id": user_id,
                        "session_id": kwargs.get("session_id"),
                        "error_message": kwargs.get("error_message"),
                        "current_section": kwargs.get("current_section")
                    }
                else:
                    logger.warning(f"Unknown notification type: {notification_type}")
                    return
                
                # Send notification via direct service call instead of HTTP
                # This is more efficient for internal communication
                try:
                    from personal_assistant.notification_service import notification_service
                    
                    if notification_type == "progress":
                        await notification_service.send_career_analysis_progress(
                            user_id=user_id,
                            session_id=kwargs.get("session_id"),
                            current_section=kwargs.get("current_section"),
                            progress=kwargs.get("progress"),
                            total_sections=kwargs.get("total_sections"),
                            status=kwargs.get("status", "analyzing")
                        )
                    elif notification_type == "complete":
                        await notification_service.send_career_analysis_complete(
                            user_id=user_id,
                            session_id=kwargs.get("session_id"),
                            sections_completed=kwargs.get("sections_completed")
                        )
                    elif notification_type == "error":
                        await notification_service.send_career_analysis_error(
                            user_id=user_id,
                            session_id=kwargs.get("session_id"),
                            error_message=kwargs.get("error_message"),
                            current_section=kwargs.get("current_section")
                        )
                    
                    logger.info(f"Notification sent: {notification_type} for user {user_id}")
                    
                except ImportError:
                    # Fallback to HTTP if direct import fails
                    logger.warning("Direct notification service import failed, using HTTP fallback")
                    response = await client.post(url, json=data, timeout=5.0)
                    if response.status_code == 200:
                        logger.info(f"Notification sent via HTTP: {notification_type} for user {user_id}")
                    else:
                        logger.error(f"Failed to send notification via HTTP: {response.status_code}")
                        
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            # Don't raise the exception to avoid breaking the analysis flow
        
    async def analyze_resume_streaming(self, user_id: int, resume_id: Optional[int] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """Analyze resume with streaming progress updates.
        
        Args:
            user_id: The user's ID
            resume_id: Optional specific resume ID to analyze. If None, analyzes the latest resume.
            
        Yields:
            Streaming analysis results and progress updates
        """
        session_id = f"analysis_{user_id}_{int(datetime.now().timestamp())}"
        
        try:
            logger.info(f"Starting streaming analysis for user {user_id}")
            
            # Send initial progress notification
            await self._send_notification(
                user_id=user_id,
                notification_type="progress",
                session_id=session_id,
                current_section="initialization",
                progress=0,
                total_sections=8,
                status="starting"
            )
            
            # Initial status
            yield {
                "type": "status",
                "message": "Initializing analysis...",
                "progress": 0,
                "timestamp": datetime.now().isoformat()
            }
            
            # Get the specified resume or the latest one
            if resume_id:
                target_resume = await self.resume_analyzer.get_resume_by_id(user_id, resume_id)
                if not target_resume:
                    yield {
                        "type": "error",
                        "message": f"Resume with ID {resume_id} not found.",
                        "timestamp": datetime.now().isoformat()
                    }
                    return
            else:
                target_resume = await self.resume_analyzer.get_latest_resume(user_id)
                if not target_resume:
                    yield {
                        "type": "error",
                        "message": "No resume found. Please upload your resume first.",
                        "timestamp": datetime.now().isoformat()
                    }
                    return
            
            # Read resume content
            yield {
                "type": "status",
                "message": "Reading resume content...",
                "progress": 5,
                "timestamp": datetime.now().isoformat()
            }
            
            resume_content = await self.resume_analyzer.read_resume_content(target_resume)
            if not resume_content:
                error_message = "Failed to read resume content. The file may be empty, corrupted, or in an unsupported format. Please try uploading again."

                # Send error notification
                await self._send_notification(
                    user_id=user_id,
                    notification_type="error",
                    session_id=session_id,
                    error_message=error_message,
                    current_section="document_parsing"
                )

                yield {
                    "type": "error",
                    "message": error_message,
                    "timestamp": datetime.now().isoformat()
                }
                return
            
            # Prepare current year for analysis
            current_date = datetime.now()
            current_year = f"{current_date.year}.{current_date.month:02d}"
            
            # Determine analysis method based on configuration
            if self.enable_parallel and hasattr(self.workflow, 'analyze_resume_parallel'):
                analysis_message = f"Starting parallel analysis with {self.parallel_config.strategy.value}..."
                analysis_method = self.workflow.analyze_resume_parallel
            else:
                analysis_message = "Starting sequential analysis..."
                analysis_method = self.workflow.analyze_resume_sequential
            
            yield {
                "type": "status",
                "message": analysis_message,
                "progress": 10,
                "timestamp": datetime.now().isoformat()
            }
            
            # Store all section results for final compilation
            all_results = {}
            
            # Process sections using selected workflow engine
            section_count = 0
            total_sections = 8  # Based on workflow sections
            
            async for result in analysis_method(resume_content, current_year):
                # Add timestamp to all results
                result["timestamp"] = datetime.now().isoformat()
                
                # Handle progress updates and send notifications
                if result.get("type") == "progress":
                    progress_data = result.get("data", {})
                    current_section = progress_data.get("current_section", "unknown")
                    progress_percentage = progress_data.get("progress_percentage", 0)
                    
                    # Send progress notification
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="progress",
                        session_id=session_id,
                        current_section=current_section,
                        progress=progress_percentage,
                        total_sections=total_sections,
                        status="analyzing"
                    )
                elif result.get("type") == "workflow_start":
                    # Handle workflow start notifications for parallel processing
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="progress",
                        session_id=session_id,
                        current_section="workflow_start",
                        progress=10,
                        total_sections=total_sections,
                        status=result.get("message", "Starting analysis")
                    )
                elif result.get("type") == "section_start":
                    # Handle section start notifications
                    section_name = result.get("section", "unknown")
                    progress_percentage = result.get("progress", 0)
                    
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="progress",
                        session_id=session_id,
                        current_section=section_name,
                        progress=progress_percentage,
                        total_sections=total_sections,
                        status="starting"
                    )
                
                # Store section results for final compilation
                if result.get("type") == "section_complete":
                    section_data = result.get("data", {})
                    section_name = result.get("section", "unknown")
                    all_results[section_name] = section_data
                    section_count += 1
                    
                    # Send section completion notification
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="progress",
                        session_id=session_id,
                        current_section=section_name,
                        progress=int((section_count / total_sections) * 90),  # Reserve 10% for saving
                        total_sections=total_sections,
                        status="section_completed"
                    )
                elif result.get("type") == "section_error":
                    # Handle section-level errors
                    section_name = result.get("section", "unknown")
                    error_message = result.get("error", "Unknown error")
                    
                    logger.warning(f"Section {section_name} failed: {error_message}")
                    
                    # Send error notification
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="error",
                        session_id=session_id,
                        current_section=section_name,
                        error_message=f"Section {section_name} failed: {error_message}",
                        progress=int((section_count / total_sections) * 90)
                    )
                elif result.get("type") == "workflow_error":
                    # Handle workflow-level errors (critical)
                    error_message = result.get("message", "Workflow error occurred")
                    failed_sections = result.get("failed_sections", [])
                    
                    logger.error(f"Workflow error: {error_message}")
                    
                    # Send critical error notification
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="error",
                        session_id=session_id,
                        current_section="workflow",
                        error_message=error_message,
                        failed_sections=failed_sections
                    )
                    
                    # Yield error and break the loop for critical errors
                    yield result
                    return
                
                # Yield the result to frontend
                yield result
                
                # Add small delay to prevent overwhelming the frontend
                await asyncio.sleep(0.1)
            
            # Store the complete analysis in database
            if all_results:
                try:
                    yield {
                        "type": "status",
                        "message": "Saving analysis results...",
                        "progress": 95,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    await self.resume_analyzer.store_career_insight(
                        user_id, 
                        target_resume.id, 
                        all_results
                    )
                    
                    # Get performance metrics if available
                    performance_metrics = {}
                    if hasattr(self.workflow, 'get_performance_metrics'):
                        performance_metrics = self.workflow.get_performance_metrics()
                    
                    # Send completion notification with performance data
                    await self._send_notification(
                        user_id=user_id,
                        notification_type="complete",
                        session_id=session_id,
                        sections_completed=len(all_results.keys())  # Send count, not list
                    )
                    
                    # Yield a success event without professional data to prevent overwriting the UI
                    yield {
                        "type": "analysis_complete",
                        "success": True,
                        "progress": 100,
                        "performance_metrics": performance_metrics,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                except Exception as e:
                    logger.error(f"Error storing career insight: {str(e)}")
                    # Get performance metrics even on save failure
                    performance_metrics = {}
                    if hasattr(self.workflow, 'get_performance_metrics'):
                        performance_metrics = self.workflow.get_performance_metrics()
                    
                    yield {
                        "type": "warning",
                        "message": "Analysis completed but failed to save. Results are still available.",
                        "progress": 100,
                        "professional_data": all_results,
                        "performance_metrics": performance_metrics,
                        "timestamp": datetime.now().isoformat()
                    }
            
            logger.info(f"Completed streaming analysis for user {user_id}")
            
        except Exception as e:
            logger.error(f"Streaming analysis failed for user {user_id}: {str(e)}")
            
            # Get detailed error information
            error_details = self.get_error_details()
            
            # Determine error severity and message
            error_message = "Error occurred during analysis"
            if error_details.get('total_errors', 0) > 0:
                critical_errors = error_details.get('critical_errors', 0)
                if critical_errors > 0:
                    error_message = f"{critical_errors} critical errors occurred during analysis, unable to continue"
                else:
                    error_message = f"{error_details['total_errors']} errors occurred during analysis"
            
            # Send error notification
            await self._send_notification(
                user_id=user_id,
                notification_type="error",
                session_id=session_id,
                error_message=error_message,
                current_section="unknown"
            )
            
            yield {
                "type": "error",
                "message": error_message,
                "error_details": error_details,
                "original_error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_analysis_status(self) -> Dict[str, Any]:
        """Get current analysis status.
        
        Returns:
            Current workflow status
        """
        return self.workflow.get_workflow_status()
    
    def set_progress_callback(self, callback):
        """Set progress callback for workflow updates.
        
        Args:
            callback: Function to call with progress updates
        """
        self.workflow.set_progress_callback(callback)
    
    def get_error_details(self) -> Dict[str, Any]:
        """Get detailed error information from the workflow.
        
        Returns:
            Dictionary containing error details and statistics
        """
        return self.workflow.get_error_details()
    
    def reset_error_state(self):
        """Reset error handler state for a fresh analysis."""
        self.workflow.reset_error_handler()
        logger.info("Error state reset for streaming analyzer")
    
    def get_retry_config(self) -> RetryConfig:
        """Get current retry configuration.
        
        Returns:
            Current RetryConfig object
        """
        return self.retry_config
    
    def update_retry_config(self, retry_config: RetryConfig):
        """Update retry configuration.
        
        Args:
            retry_config: New retry configuration
        """
        self.retry_config = retry_config
        self.workflow.error_handler.retry_config = retry_config
        logger.info(f"Updated retry config: max_retries={retry_config.max_retries}, timeout={retry_config.timeout}")
    
    def get_parallel_config(self) -> Optional[ParallelConfig]:
        """Get current parallel processing configuration.
        
        Returns:
            Current ParallelConfig object or None if parallel processing is disabled
        """
        return self.parallel_config if self.enable_parallel else None
    
    def update_parallel_config(self, parallel_config: ParallelConfig):
        """Update parallel processing configuration.
        
        Args:
            parallel_config: New parallel configuration
        """
        if not self.enable_parallel:
            logger.warning("Cannot update parallel config: parallel processing is disabled")
            return
        
        self.parallel_config = parallel_config
        
        # Recreate workflow with new config if it's a parallel workflow
        if hasattr(self.workflow, 'parallel_config'):
            self.workflow = ParallelResumeAnalysisWorkflow(
                self.chat_service, self.retry_config, parallel_config
            )
            logger.info(f"Updated parallel config: strategy={parallel_config.strategy.value}, max_concurrent={parallel_config.max_concurrent_sections}")
    
    def switch_to_parallel(self, parallel_config: Optional[ParallelConfig] = None):
        """Switch from sequential to parallel processing.
        
        Args:
            parallel_config: Optional parallel configuration
        """
        if self.enable_parallel:
            logger.info("Already using parallel processing")
            return
        
        if parallel_config:
            self.parallel_config = parallel_config
        elif not self.parallel_config:
            self.parallel_config = ParallelConfig()
        
        self.workflow = ParallelResumeAnalysisWorkflow(
            self.chat_service, self.retry_config, self.parallel_config
        )
        self.enable_parallel = True
        logger.info(f"Switched to parallel processing: {self.parallel_config.strategy.value}")
    
    def switch_to_sequential(self):
        """Switch from parallel to sequential processing."""
        if not self.enable_parallel:
            logger.info("Already using sequential processing")
            return
        
        self.workflow = ResumeAnalysisWorkflow(self.chat_service, self.retry_config)
        self.enable_parallel = False
        logger.info("Switched to sequential processing")
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics from the workflow.
        
        Returns:
            Dictionary containing performance metrics
        """
        if hasattr(self.workflow, 'get_performance_metrics'):
            return self.workflow.get_performance_metrics()
        else:
            return {"message": "Performance metrics not available for sequential workflow"}
    
    def clear_section_cache(self):
        """Clear section result cache if using parallel processing."""
        if hasattr(self.workflow, 'clear_cache'):
            self.workflow.clear_cache()
            logger.info("Section cache cleared")
        else:
            logger.info("No cache to clear (sequential workflow)")
    
    def get_workflow_info(self) -> Dict[str, Any]:
        """Get information about the current workflow configuration.
        
        Returns:
            Dictionary containing workflow information
        """
        info = {
            "workflow_type": "parallel" if self.enable_parallel else "sequential",
            "retry_config": {
                "max_retries": self.retry_config.max_retries,
                "base_delay": self.retry_config.base_delay,
                "timeout": self.retry_config.timeout
            }
        }
        
        if self.enable_parallel and self.parallel_config:
            info["strategy"] = self.parallel_config.strategy.value
            info["parallel_config"] = {
                "strategy": self.parallel_config.strategy.value,
                "max_concurrent_sections": self.parallel_config.max_concurrent_sections,
                "batch_size": self.parallel_config.batch_size,
                "caching_enabled": self.parallel_config.enable_section_caching,
                "timeout_per_section": self.parallel_config.timeout_per_section
            }
        else:
            info["strategy"] = "sequential"
        
        return info

class ProgressNotificationService:
    """Service for managing progress notifications."""
    
    def __init__(self):
        """Initialize the notification service."""
        self.active_sessions = {}
        
    def register_session(self, session_id: str, user_id: int):
        """Register a new analysis session.
        
        Args:
            session_id: Unique session identifier
            user_id: User ID for the session
        """
        self.active_sessions[session_id] = {
            "user_id": user_id,
            "start_time": datetime.now(),
            "status": "active"
        }
        logger.info(f"Registered analysis session {session_id} for user {user_id}")
    
    def update_session_progress(self, session_id: str, progress: WorkflowProgress):
        """Update progress for a session.
        
        Args:
            session_id: Session identifier
            progress: Progress information
        """
        if session_id in self.active_sessions:
            self.active_sessions[session_id]["last_progress"] = progress
            self.active_sessions[session_id]["last_update"] = datetime.now()
    
    def complete_session(self, session_id: str):
        """Mark a session as completed.
        
        Args:
            session_id: Session identifier
        """
        if session_id in self.active_sessions:
            self.active_sessions[session_id]["status"] = "completed"
            self.active_sessions[session_id]["end_time"] = datetime.now()
            logger.info(f"Completed analysis session {session_id}")
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get status for a specific session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session status information or None if not found
        """
        return self.active_sessions.get(session_id)
    
    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old sessions.
        
        Args:
            max_age_hours: Maximum age of sessions to keep
        """
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        sessions_to_remove = []
        
        for session_id, session_data in self.active_sessions.items():
            if session_data["start_time"] < cutoff_time:
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            del self.active_sessions[session_id]
            logger.info(f"Cleaned up old session {session_id}")

# Global notification service instance
notification_service = ProgressNotificationService()