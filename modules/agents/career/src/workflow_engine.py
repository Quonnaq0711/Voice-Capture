"""LangChain-based sequential workflow pipeline for resume analysis.

This module implements a streaming workflow using LangChain's RunnableGenerator
pattern - the industry-standard approach for producing multiple outputs from
a single chain execution.

Architecture:
- Uses RunnableGenerator for streaming progress events (LangChain best practice)
- Sequential execution with deterministic ordering
- Designed for vector database and tools integration (future)

Reference:
- https://python.langchain.com/docs/expression_language/streaming
- https://python.langchain.com/docs/expression_language/primitives/generators
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, AsyncGenerator, List, Callable, AsyncIterator
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from langchain_core.runnables import RunnableLambda
from error_handler import AnalysisErrorHandler, RetryConfig, ErrorSeverity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AnalysisStatus(Enum):
    """Status of analysis sections."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AnalysisSection:
    """Represents a section of resume analysis."""
    name: str
    display_name: str
    description: str
    status: AnalysisStatus = AnalysisStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


@dataclass
class WorkflowProgress:
    """Represents the current progress of the workflow."""
    current_section: str
    completed_sections: List[str]
    total_sections: int
    progress_percentage: float
    status: str
    message: str


class ResumeAnalysisWorkflow:
    """LangChain-based workflow engine using RunnableGenerator pattern.

    This is the industry-standard approach for streaming multiple events
    from a single LangChain execution. Unlike callbacks (which have timing
    issues with LCEL pipelines), generators provide deterministic ordering
    and explicit control over event emission.

    Key patterns used:
    1. RunnableGenerator - For streaming multiple outputs
    2. RunnableLambda - For wrapping async functions
    3. astream() - For consuming streamed events
    """

    def __init__(self, resume_analyzer, retry_config: Optional[RetryConfig] = None,
                 cancellation_check: Optional[Callable[[], bool]] = None):
        """Initialize the workflow engine.

        Args:
            resume_analyzer: BaseResumeAnalyzer instance for LLM calls
            retry_config: Configuration for error handling and retries
            cancellation_check: Optional callback that returns True if analysis should be cancelled
        """
        self.resume_analyzer = resume_analyzer
        self.retry_config = retry_config
        self.sections = self._initialize_sections()
        self.progress_callback: Optional[Callable] = None
        self.error_handler = AnalysisErrorHandler(retry_config)
        self.max_section_failures = 3
        self.cancellation_check = cancellation_check

        # Future extensibility
        self.vector_store = None
        self.tools = []

        # Build the streaming chain
        self._chain = self._build_streaming_chain()

    def _initialize_sections(self) -> List[AnalysisSection]:
        """Initialize analysis sections in processing order."""
        return [
            AnalysisSection(
                name="professionalIdentity",
                display_name="Professional Identity",
                description="Analyzing professional title, summary, and market position"
            ),
            AnalysisSection(
                name="educationBackground",
                display_name="Education Background",
                description="Extracting educational qualifications and certifications"
            ),
            AnalysisSection(
                name="workExperience",
                display_name="Work Experience",
                description="Processing career timeline, companies, and roles"
            ),
            AnalysisSection(
                name="salaryAnalysis",
                display_name="Salary Analysis",
                description="Analyzing compensation trends and projections"
            ),
            AnalysisSection(
                name="skillsAnalysis",
                display_name="Skills Analysis",
                description="Evaluating technical and soft skills"
            )
        ]

    def _build_streaming_chain(self) -> RunnableLambda:
        """Build a streaming chain using RunnableGenerator pattern.

        This is the LangChain-recommended way to produce multiple outputs
        from a single chain execution with guaranteed ordering.

        Returns:
            RunnableLambda wrapping an async generator
        """
        async def streaming_analysis(input_data: Dict[str, Any]) -> AsyncIterator[Dict[str, Any]]:
            """Async generator that yields progress events for each section.

            This pattern is recommended by LangChain for streaming scenarios:
            - Each yield produces one event
            - Order is deterministic (follows loop order)
            - No callback timing issues
            """
            resume_content = input_data.get("resume_content", "")
            current_year = input_data.get("current_year", "")

            # Reset sections at start
            for section in self.sections:
                section.status = AnalysisStatus.PENDING
                section.result = None
                section.error = None
                section.start_time = None
                section.end_time = None

            # Yield workflow start
            yield {
                "type": "workflow_start",
                "status": "initialized",
                "message": "Starting resume analysis...",
                "progress": 0,
                "total_sections": len(self.sections)
            }

            all_results = {}
            all_errors = []
            failed_count = 0

            # Process sections sequentially with guaranteed order
            for index, section in enumerate(self.sections):
                # Check for cancellation before starting each section
                if self.cancellation_check and self.cancellation_check():
                    logger.info("Analysis cancelled by user")
                    yield {
                        "type": "cancelled",
                        "message": "Analysis cancelled by user",
                        "sections_completed": index,
                        "progress": (index / len(self.sections)) * 100
                    }
                    return

                if failed_count >= self.max_section_failures:
                    logger.error(f"Stopping: {failed_count} failures reached")
                    break

                # Mark section as in progress
                section.status = AnalysisStatus.IN_PROGRESS
                section.start_time = datetime.now()

                # Yield section start event
                yield {
                    "type": "section_start",
                    "section": section.name,
                    "display_name": section.display_name,
                    "description": section.description,
                    "status": "starting",
                    "message": f"🔄 Starting {section.display_name} analysis...",
                    "progress": (index / len(self.sections)) * 100,
                    "section_index": index,
                    "total_sections": len(self.sections)
                }

                try:
                    # Perform analysis
                    section_result = await self._analyze_section_impl(
                        section, resume_content, current_year
                    )

                    # Update section status
                    section.status = AnalysisStatus.COMPLETED
                    section.result = section_result
                    section.end_time = datetime.now()

                    # Calculate metrics
                    execution_time = (section.end_time - section.start_time).total_seconds()
                    all_results.update(section_result)
                    progress = ((index + 1) / len(self.sections)) * 100

                    # Yield section complete event
                    yield {
                        "type": "section_complete",
                        "section": section.name,
                        "display_name": section.display_name,
                        "status": "completed",
                        "message": f"✅ {section.display_name} analysis completed!",
                        "data": section_result,
                        "progress": progress,
                        "execution_time": execution_time,
                        "section_index": index,
                        "total_sections": len(self.sections)
                    }

                except Exception as e:
                    # Handle section failure
                    section.status = AnalysisStatus.FAILED
                    section.error = str(e)
                    section.end_time = datetime.now()
                    failed_count += 1

                    error_info = self.error_handler.classify_error(e, section.name)
                    all_errors.append({
                        "section": section.name,
                        "error": str(e),
                        "error_type": error_info.error_type.value,
                        "severity": error_info.severity.value
                    })

                    logger.error(f"Section {section.name} failed: {e}")

                    # Yield section error event
                    yield {
                        "type": "section_error",
                        "section": section.name,
                        "display_name": section.display_name,
                        "status": "failed",
                        "error": str(e),
                        "error_type": error_info.error_type.value,
                        "progress": ((index + 1) / len(self.sections)) * 100,
                        "can_continue": failed_count < self.max_section_failures
                    }

                    # Stop on critical errors
                    if error_info.severity == ErrorSeverity.CRITICAL:
                        break

            # Final statistics
            completed = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
            failed = [s for s in self.sections if s.status == AnalysisStatus.FAILED]

            logger.info(f"Analysis complete: {len(completed)}/{len(self.sections)} sections, {len(failed)} failed")

            # Yield workflow complete event
            yield {
                "type": "workflow_complete",
                "status": "completed",
                "message": f"Completed {len(completed)}/{len(self.sections)} sections",
                "completed_sections": len(completed),
                "failed_sections": len(failed),
                "total_sections": len(self.sections),
                "progress": 100,
                "results": all_results,
                "errors": all_errors
            }

        # Wrap generator in RunnableLambda for LCEL compatibility
        # This allows: chain.astream(input) to iterate over yielded events
        return RunnableLambda(streaming_analysis)

    async def _analyze_section_impl(
        self,
        section: AnalysisSection,
        resume_content: str,
        current_year: str
    ) -> Dict[str, Any]:
        """Core section analysis implementation with retry logic."""

        async def _perform_analysis():
            from prompts import get_section_analysis_prompt

            prompt = get_section_analysis_prompt(section.name, resume_content, current_year)
            logger.info(f"Starting analysis: {section.name}")

            messages = [{"role": "user", "content": prompt}]
            response_text = await asyncio.wait_for(
                self.resume_analyzer._generate_llm_response(messages, f"section_{section.name}"),
                timeout=300.0
            )

            # Parse JSON response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}')

            if json_start >= 0 and json_end >= 0:
                json_str = response_text[json_start:json_end+1]
                try:
                    section_data = json.loads(json_str)
                except json.JSONDecodeError:
                    section_data = json.loads(self._clean_json(json_str))

                if not section_data or not isinstance(section_data, dict):
                    raise ValueError("Invalid section data")

                result = self._extract_section_with_summary(section_data, section.name)
                logger.info(f"Completed: {section.name}")
                return result
            else:
                raise ValueError("No JSON in response")

        return await self.error_handler.handle_error_with_retry(
            _perform_analysis,
            section=section.name
        )

    def _extract_section_with_summary(self, section_data: Dict[str, Any], section_name: str) -> Dict[str, Any]:
        """Extract section data and summary from LLM response."""
        if section_name in section_data:
            result = {section_name: section_data[section_name]}
            summary_key = f"{section_name}_summary"
            if summary_key in section_data:
                result[summary_key] = section_data[summary_key]
        else:
            result = {section_name: section_data}
        return result

    def _clean_json(self, json_str: str) -> str:
        """Clean common JSON formatting issues."""
        import re
        json_str = json_str.strip()
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        return json_str

    # ========== Future Extensibility ==========

    def set_vector_store(self, vector_store):
        """Set vector store for RAG integration (future)."""
        self.vector_store = vector_store
        logger.info(f"Vector store configured: {type(vector_store).__name__}")

    def add_tool(self, tool):
        """Add external tool for agent capabilities (future)."""
        self.tools.append(tool)
        logger.info(f"Tool added: {tool.name}")

    def set_progress_callback(self, callback: Callable[[WorkflowProgress], None]):
        """Set callback for progress updates."""
        self.progress_callback = callback

    # ========== Main Entry Point ==========

    async def analyze_resume_sequential(
        self,
        resume_content: str,
        current_year: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Analyze resume using LangChain's streaming pattern.

        This method uses the RunnableGenerator's astream() method to iterate
        over yielded events - the LangChain-recommended approach for streaming.

        Args:
            resume_content: The resume content to analyze
            current_year: Current year for date calculations

        Yields:
            Progress events as they occur (deterministic order guaranteed)
        """
        logger.info("Starting LangChain streaming resume analysis")

        input_data = {
            "resume_content": resume_content,
            "current_year": current_year
        }

        # Use astream to iterate over generator outputs
        # This is the standard LangChain pattern for streaming
        async for event in self._chain.astream(input_data):
            yield event

    def get_workflow_status(self) -> Dict[str, Any]:
        """Get current workflow status."""
        completed = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
        in_progress = [s for s in self.sections if s.status == AnalysisStatus.IN_PROGRESS]
        failed = [s for s in self.sections if s.status == AnalysisStatus.FAILED]

        return {
            "total_sections": len(self.sections),
            "completed_sections": len(completed),
            "failed_sections": len(failed),
            "current_section": in_progress[0].name if in_progress else None,
            "progress_percentage": (len(completed) / len(self.sections)) * 100,
            "sections": [
                {
                    "name": s.name,
                    "display_name": s.display_name,
                    "status": s.status.value,
                    "error": s.error,
                    "duration": (s.end_time - s.start_time).total_seconds()
                              if s.start_time and s.end_time else None
                }
                for s in self.sections
            ]
        }

    def get_error_details(self) -> Dict[str, Any]:
        """Get detailed error information."""
        return {
            "error_summary": self.error_handler.get_error_summary(),
            "section_errors": {
                s.name: s.error for s in self.sections if s.error
            }
        }

    def reset_error_handler(self):
        """Reset the error handler state."""
        self.error_handler.clear_error_history()
