"""Enhanced error handling and retry mechanisms for resume analysis.

This module provides comprehensive error handling, retry logic, and recovery
strategies for the resume analysis workflow.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, Callable, List, Type
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ErrorType(Enum):
    """Types of errors that can occur during analysis."""
    NETWORK = "network"
    TIMEOUT = "timeout"
    PARSING = "parsing"
    LLM = "llm"
    VALIDATION = "validation"
    RESOURCE = "resource"
    UNKNOWN = "unknown"

class ErrorSeverity(Enum):
    """Severity levels for errors."""
    LOW = "low"          # Recoverable, continue with degraded functionality
    MEDIUM = "medium"    # Retry recommended, may affect quality
    HIGH = "high"        # Retry required, significant impact
    CRITICAL = "critical" # Stop processing, manual intervention needed

@dataclass
class ErrorInfo:
    """Information about an error occurrence."""
    error_type: ErrorType
    severity: ErrorSeverity
    message: str
    section: Optional[str] = None
    timestamp: datetime = None
    traceback: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_backoff: bool = True
    jitter: bool = True
    timeout: float = 300.0  # 5 minutes for local LLM processing

class AnalysisErrorHandler:
    """Enhanced error handler with retry mechanisms."""
    
    def __init__(self, retry_config: Optional[RetryConfig] = None):
        """Initialize the error handler.
        
        Args:
            retry_config: Configuration for retry behavior
        """
        self.retry_config = retry_config or RetryConfig()
        self.error_history: List[ErrorInfo] = []
        self.section_errors: Dict[str, List[ErrorInfo]] = {}
        self.recovery_strategies: Dict[ErrorType, Callable] = {
            ErrorType.NETWORK: self._handle_network_error,
            ErrorType.TIMEOUT: self._handle_timeout_error,
            ErrorType.PARSING: self._handle_parsing_error,
            ErrorType.LLM: self._handle_llm_error,
            ErrorType.VALIDATION: self._handle_validation_error,
            ErrorType.RESOURCE: self._handle_resource_error,
        }
    
    def record_error(self, error: Exception, context: str = "") -> ErrorInfo:
        """Record an error for tracking and analysis.
        
        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred
            
        Returns:
            ErrorInfo object containing error details
        """
        error_info = self.classify_error(error, context)
        
        # Add to error history
        self.error_history.append(error_info)
        
        # Add to section errors if context provided
        if context:
            if context not in self.section_errors:
                self.section_errors[context] = []
            self.section_errors[context].append(error_info)
        
        logger.error(f"Recorded error: {error_info.error_type.value} in {context or 'unknown'}: {error_info.message}")
        return error_info
    
    def classify_error(self, exception: Exception, section: Optional[str] = None) -> ErrorInfo:
        """Classify an exception into an ErrorInfo object.
        
        Args:
            exception: The exception to classify
            section: The section where the error occurred
            
        Returns:
            ErrorInfo object with classified error details
        """
        error_message = str(exception)
        error_traceback = traceback.format_exc()
        
        # Classify error type based on exception type and message
        if isinstance(exception, (ConnectionError, OSError)):
            error_type = ErrorType.NETWORK
            severity = ErrorSeverity.MEDIUM
        elif isinstance(exception, asyncio.TimeoutError):
            error_type = ErrorType.TIMEOUT
            severity = ErrorSeverity.MEDIUM
        elif isinstance(exception, (json.JSONDecodeError, ValueError)) and "JSON" in error_message:
            error_type = ErrorType.PARSING
            severity = ErrorSeverity.LOW
        elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
            error_type = ErrorType.LLM
            severity = ErrorSeverity.HIGH
        elif isinstance(exception, (KeyError, AttributeError, TypeError)):
            error_type = ErrorType.VALIDATION
            severity = ErrorSeverity.MEDIUM
        elif "memory" in error_message.lower() or "resource" in error_message.lower():
            error_type = ErrorType.RESOURCE
            severity = ErrorSeverity.HIGH
        else:
            error_type = ErrorType.UNKNOWN
            severity = ErrorSeverity.MEDIUM
        
        return ErrorInfo(
            error_type=error_type,
            severity=severity,
            message=error_message,
            section=section,
            traceback=error_traceback
        )
    
    async def handle_error_with_retry(self, 
                                    func: Callable,
                                    *args,
                                    section: Optional[str] = None,
                                    **kwargs) -> Any:
        """Execute a function with error handling and retry logic.
        
        Args:
            func: The function to execute
            *args: Positional arguments for the function
            section: The section being processed (for error tracking)
            **kwargs: Keyword arguments for the function
            
        Returns:
            The result of the function execution
            
        Raises:
            Exception: If all retry attempts fail
        """
        last_error = None
        
        for attempt in range(self.retry_config.max_retries + 1):
            try:
                # Set timeout for the operation
                if asyncio.iscoroutinefunction(func):
                    result = await asyncio.wait_for(
                        func(*args, **kwargs),
                        timeout=self.retry_config.timeout
                    )
                else:
                    result = func(*args, **kwargs)
                
                # Success - clear any previous errors for this section
                if section and section in self.section_errors:
                    self.section_errors[section] = []
                
                return result
                
            except Exception as e:
                last_error = e
                error_info = self.classify_error(e, section)
                error_info.retry_count = attempt
                
                # Log the error
                logger.warning(f"Attempt {attempt + 1}/{self.retry_config.max_retries + 1} failed for section {section}: {error_info.message}")
                
                # Store error in history
                self.error_history.append(error_info)
                if section:
                    if section not in self.section_errors:
                        self.section_errors[section] = []
                    self.section_errors[section].append(error_info)
                
                # Check if we should retry
                if attempt >= self.retry_config.max_retries:
                    logger.error(f"All retry attempts failed for section {section}")
                    break
                
                # Apply recovery strategy
                if error_info.error_type in self.recovery_strategies:
                    try:
                        await self.recovery_strategies[error_info.error_type](error_info)
                    except Exception as recovery_error:
                        logger.error(f"Recovery strategy failed: {recovery_error}")
                
                # Calculate delay before retry
                delay = self._calculate_retry_delay(attempt)
                logger.info(f"Retrying in {delay:.2f} seconds...")
                await asyncio.sleep(delay)
        
        # All retries failed
        raise last_error
    
    def _calculate_retry_delay(self, attempt: int) -> float:
        """Calculate delay before retry attempt.
        
        Args:
            attempt: Current attempt number (0-based)
            
        Returns:
            Delay in seconds
        """
        if self.retry_config.exponential_backoff:
            delay = self.retry_config.base_delay * (2 ** attempt)
        else:
            delay = self.retry_config.base_delay
        
        # Apply maximum delay limit
        delay = min(delay, self.retry_config.max_delay)
        
        # Add jitter to prevent thundering herd
        if self.retry_config.jitter:
            import random
            delay *= (0.5 + random.random() * 0.5)
        
        return delay
    
    async def _handle_network_error(self, error_info: ErrorInfo):
        """Handle network-related errors."""
        logger.info("Applying network error recovery strategy")
        # Wait a bit longer for network issues
        await asyncio.sleep(2.0)
    
    async def _handle_timeout_error(self, error_info: ErrorInfo):
        """Handle timeout errors."""
        logger.info("Applying timeout error recovery strategy")
        # Increase timeout for next attempt
        self.retry_config.timeout = min(self.retry_config.timeout * 1.5, 120.0)
    
    async def _handle_parsing_error(self, error_info: ErrorInfo):
        """Handle JSON parsing errors."""
        logger.info("Applying parsing error recovery strategy")
        # These are often recoverable with retry
        pass
    
    async def _handle_llm_error(self, error_info: ErrorInfo):
        """Handle LLM service errors."""
        logger.info("Applying LLM error recovery strategy")
        # Wait longer for rate limit issues
        if "rate limit" in error_info.message.lower():
            await asyncio.sleep(10.0)
    
    async def _handle_validation_error(self, error_info: ErrorInfo):
        """Handle validation errors."""
        logger.info("Applying validation error recovery strategy")
        # Log detailed information for debugging
        logger.debug(f"Validation error details: {error_info.traceback}")
    
    async def _handle_resource_error(self, error_info: ErrorInfo):
        """Handle resource-related errors."""
        logger.info("Applying resource error recovery strategy")
        # Wait for resources to be available
        await asyncio.sleep(5.0)
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get a summary of all errors encountered.
        
        Returns:
            Dictionary containing error statistics and details
        """
        total_errors = len(self.error_history)
        if total_errors == 0:
            return {"total_errors": 0, "error_rate": 0.0}
        
        # Count errors by type
        error_counts = {}
        for error in self.error_history:
            error_type = error.error_type.value
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        # Count errors by severity
        severity_counts = {}
        for error in self.error_history:
            severity = error.severity.value
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Recent errors (last hour)
        recent_cutoff = datetime.now() - timedelta(hours=1)
        recent_errors = [e for e in self.error_history if e.timestamp > recent_cutoff]
        
        return {
            "total_errors": total_errors,
            "error_counts_by_type": error_counts,
            "error_counts_by_severity": severity_counts,
            "recent_errors_count": len(recent_errors),
            "sections_with_errors": list(self.section_errors.keys()),
            "most_recent_error": {
                "type": self.error_history[-1].error_type.value,
                "message": self.error_history[-1].message,
                "timestamp": self.error_history[-1].timestamp.isoformat()
            } if self.error_history else None
        }
    
    def get_section_errors(self, section: str) -> List[ErrorInfo]:
        """Get all errors for a specific section.
        
        Args:
            section: Section name
            
        Returns:
            List of ErrorInfo objects for the section
        """
        return self.section_errors.get(section, [])
    
    def clear_error_history(self):
        """Clear all error history."""
        self.error_history.clear()
        self.section_errors.clear()
        logger.info("Error history cleared")
    
    def should_continue_processing(self, section: str) -> bool:
        """Determine if processing should continue after errors.
        
        Args:
            section: Section name
            
        Returns:
            True if processing should continue, False otherwise
        """
        section_errors = self.get_section_errors(section)
        if not section_errors:
            return True
        
        # Check for critical errors
        critical_errors = [e for e in section_errors if e.severity == ErrorSeverity.CRITICAL]
        if critical_errors:
            return False
        
        # Check error rate
        recent_errors = [e for e in section_errors if e.timestamp > datetime.now() - timedelta(minutes=5)]
        if len(recent_errors) > 5:  # Too many recent errors
            return False
        
        return True