"""LangChain workflow pipeline for resume analysis.

This module implements a workflow using LangGraph that analyzes different resume sections
sequentially through a pipeline of nodes and streams results to the frontend.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, AsyncGenerator, List, Callable, TypedDict
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from error_handler import AnalysisErrorHandler, RetryConfig, ErrorSeverity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkflowState(TypedDict):
    """State object for the workflow pipeline."""
    resume_content: str
    current_year: str
    current_section_index: int
    sections: List[Dict[str, Any]]
    results: Dict[str, Any]
    errors: List[Dict[str, Any]]
    progress: float
    status: str
    message: str

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
    """LangGraph-based workflow engine for resume analysis."""
    
    def __init__(self, chat_service, retry_config: Optional[RetryConfig] = None):
        """Initialize the workflow engine.
        
        Args:
            chat_service: ChatService instance for LLM interactions
            retry_config: Configuration for error handling and retries
        """
        self.chat_service = chat_service
        self.retry_config = retry_config
        self.sections = self._initialize_sections()
        self.progress_callback: Optional[Callable] = None
        self.error_handler = AnalysisErrorHandler(retry_config)
        self.max_section_failures = 3  # Maximum failed sections before stopping
        self.checkpointer = MemorySaver()
        self.workflow = self._build_workflow()
        
    def _initialize_sections(self) -> List[AnalysisSection]:
        """Initialize the analysis sections in order.
        
        Returns:
            List of AnalysisSection objects in processing order
        """
        return [
            AnalysisSection(
                name="professionalIdentity",
                display_name="Professional Identity",
                description="Analyzing professional title, summary, and key highlights"
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
            ),
            AnalysisSection(
                name="marketPosition",
                display_name="Market Position",
                description="Assessing competitiveness and industry standing"
            ) 
        ] 
    
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow pipeline.
        
        Returns:
            Compiled StateGraph workflow
        """
        workflow = StateGraph(WorkflowState)
        
        # Add workflow nodes
        workflow.add_node("initialize", self._initialize_workflow_node)
        workflow.add_node("section_start", self._section_start_node)
        workflow.add_node("analyze_section", self._analyze_section_node)
        workflow.add_node("check_completion", self._check_completion_node)
        workflow.add_node("finalize", self._finalize_workflow_node)
        
        # Define workflow edges
        workflow.set_entry_point("initialize")
        workflow.add_edge("initialize", "section_start")
        workflow.add_edge("section_start", "analyze_section")
        workflow.add_conditional_edges(
            "analyze_section",
            self._should_continue_analysis,
            {
                "continue": "check_completion",
                "error": "finalize",
                "complete": "finalize"
            }
        )
        workflow.add_conditional_edges(
            "check_completion",
            self._check_next_section,
            {
                "next_section": "section_start",
                "complete": "finalize"
            }
        )
        workflow.add_edge("finalize", END)
        
        return workflow.compile(checkpointer=self.checkpointer)
    
    def set_progress_callback(self, callback: Callable[[WorkflowProgress], None]):
        """Set callback function for progress updates.
        
        Args:
            callback: Function to call with progress updates
        """
        self.progress_callback = callback
    
    def _notify_progress(self, current_section: str, status: str, message: str):
        """Notify progress callback if set.
        
        Args:
            current_section: Name of current section being processed
            status: Current status of the workflow
            message: Progress message
        """
        if self.progress_callback:
            completed_sections = [s.name for s in self.sections if s.status == AnalysisStatus.COMPLETED]
            progress = WorkflowProgress(
                current_section=current_section,
                completed_sections=completed_sections,
                total_sections=len(self.sections),
                progress_percentage=(len(completed_sections) / len(self.sections)) * 100,
                status=status,
                message=message
            )
            self.progress_callback(progress)
    
    async def _initialize_workflow_node(self, state: WorkflowState) -> WorkflowState:
        """Initialize the workflow state.
        
        Args:
            state: Current workflow state
            
        Returns:
            Updated workflow state
        """
        logger.info("Initializing workflow pipeline")
        
        # Reset all sections to pending
        sections_data = []
        for section in self.sections:
            section.status = AnalysisStatus.PENDING
            section.result = None
            section.error = None
            section.start_time = None
            section.end_time = None
            
            sections_data.append({
                "name": section.name,
                "display_name": section.display_name,
                "description": section.description,
                "status": section.status.value
            })
        
        state["current_section_index"] = 0
        state["sections"] = sections_data
        state["results"] = {}
        state["errors"] = []
        state["progress"] = 0.0
        state["status"] = "initialized"
        state["message"] = "Workflow initialized successfully"
        
        return state
    
    async def _section_start_node(self, state: WorkflowState) -> WorkflowState:
        """Handle section start notification.
        
        Args:
            state: Current workflow state
            
        Returns:
            Updated workflow state with section start status
        """
        current_index = state["current_section_index"]
        
        if current_index >= len(self.sections):
            state["status"] = "complete"
            state["message"] = "All sections completed"
            return state
        
        section = self.sections[current_index]
        
        # Update section status
        section.status = AnalysisStatus.IN_PROGRESS
        section.start_time = datetime.now()
        
        # Set section start status for event formatting
        state["status"] = "section_start"
        state["message"] = f"🔄 Starting {section.display_name} analysis..."
        
        logger.info(f"Starting analysis for section: {section.name} - {section.display_name}")
        
        return state
    
    async def _analyze_section_node(self, state: WorkflowState) -> WorkflowState:
        """Analyze the current section.
        
        Args:
            state: Current workflow state
            
        Returns:
            Updated workflow state with analysis results
        """
        current_index = state["current_section_index"]
        
        if current_index >= len(self.sections):
            state["status"] = "complete"
            state["message"] = "All sections completed"
            return state
        
        section = self.sections[current_index]
        
        try:
            # Notify progress
            self._notify_progress(
                current_section=section.name,
                status="analyzing",
                message=f"Analyzing {section.display_name}..."
            )
            
            # Perform analysis
            logger.info(f"Analyzing section: {section.name}")
            section_result = await self._analyze_section(section, state["resume_content"], state["current_year"])
            
            # Update section status
            section.status = AnalysisStatus.COMPLETED
            section.result = section_result
            section.end_time = datetime.now()
            
            # Update state
            state["results"].update(section_result)
            state["progress"] = ((current_index + 1) / len(self.sections)) * 100
            state["status"] = "section_completed"
            state["message"] = f"✅ {section.display_name} analysis completed successfully! New insights are now available in your career profile."
            
            # Calculate execution time
            execution_time = (section.end_time - section.start_time).total_seconds()
            
            # Add detailed console output
            print(f"\n🎉 {section.display_name} Analysis Completed!")
            print(f"⏱️  Execution Time: {execution_time:.2f} seconds")
            print(f"📊 Progress: {((current_index + 1) / len(self.sections)) * 100:.1f}% ({current_index + 1}/{len(self.sections)})")
            print(f"📋 Data Size: {len(str(section_result))} characters")
            print("=" * 50)
            
            logger.info(f"Completed section: {section.name} in {execution_time:.2f}s")
            
        except Exception as e:
            # Handle section-specific errors
            section.status = AnalysisStatus.FAILED
            section.error = str(e)
            section.end_time = datetime.now()
            
            # Get error details from error handler
            error_info = self.error_handler.classify_error(e, section.name)
            
            logger.error(f"Failed to analyze section {section.name}: {str(e)} (Type: {error_info.error_type.value}, Severity: {error_info.severity.value})")
            
            # Add error to state
            state["errors"].append({
                "section": section.name,
                "error": str(e),
                "error_type": error_info.error_type.value,
                "severity": error_info.severity.value,
                "retry_count": error_info.retry_count
            })
            
            # Check if we should continue processing
            failed_sections = [s for s in self.sections if s.status == AnalysisStatus.FAILED]
            
            if len(failed_sections) >= self.max_section_failures:
                state["status"] = "error_limit_exceeded"
                state["message"] = f"Workflow stopped due to {len(failed_sections)} failed sections"
                return state
            
            if error_info.severity == ErrorSeverity.CRITICAL:
                state["status"] = "critical_error"
                state["message"] = f"Critical error in section {section.name}: {str(e)}"
                return state
            
            state["status"] = "section_error"
            state["message"] = f"Error in {section.display_name}: {str(e)}"
        
        return state
    
    async def _check_completion_node(self, state: WorkflowState) -> WorkflowState:
        """Check if workflow should continue to next section.
        
        Args:
            state: Current workflow state
            
        Returns:
            Updated workflow state
        """
        current_index = state["current_section_index"]
        
        # Move to next section
        state["current_section_index"] = current_index + 1
        
        if state["current_section_index"] >= len(self.sections):
            state["status"] = "all_sections_complete"
            state["message"] = "All sections have been processed"
        else:
            state["status"] = "ready_for_next_section"
            next_section = self.sections[state["current_section_index"]]
            state["message"] = f"Ready to analyze {next_section.display_name}"
        
        return state
    
    async def _finalize_workflow_node(self, state: WorkflowState) -> WorkflowState:
        """Finalize the workflow and prepare final results.
        
        Args:
            state: Current workflow state
            
        Returns:
            Final workflow state
        """
        completed_sections = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
        failed_sections = [s for s in self.sections if s.status == AnalysisStatus.FAILED]
        
        state["status"] = "workflow_complete"
        state["message"] = f"Workflow completed. {len(completed_sections)}/{len(self.sections)} sections successful"
        state["progress"] = 100.0
        
        logger.info(f"Workflow completed. {len(completed_sections)}/{len(self.sections)} sections successful")
        
        return state
    
    def _should_continue_analysis(self, state: WorkflowState) -> str:
        """Determine if analysis should continue based on current state.
        
        Args:
            state: Current workflow state
            
        Returns:
            Next edge to follow
        """
        status = state["status"]
        
        if status in ["error_limit_exceeded", "critical_error"]:
            return "error"
        elif status == "all_sections_complete":
            return "complete"
        else:
            return "continue"
    
    def _check_next_section(self, state: WorkflowState) -> str:
        """Check if there are more sections to process.
        
        Args:
            state: Current workflow state
            
        Returns:
            Next edge to follow
        """
        if state["current_section_index"] >= len(self.sections):
            return "complete"
        else:
            return "next_section"
    
    async def _analyze_section(self, section: AnalysisSection, resume_content: str, current_year: str) -> Dict[str, Any]:
        """Analyze a specific section of the resume with error handling and retries.
        
        Args:
            section: The section to analyze
            resume_content: The resume content
            current_year: Current year for date calculations
            
        Returns:
            Analysis result for the section
        """
        async def _perform_analysis():
            from prompts import get_section_analysis_prompt
            
            # Get section-specific prompt
            prompt = get_section_analysis_prompt(section.name, resume_content, current_year)
            
            # Add debug output for section start
            print(f"\n=== Starting Analysis: {section.display_name} ({section.name}) ===")
            logger.info(f"Starting analysis for section: {section.name} - {section.display_name}")
            
            # Generate response using chat service with timeout
            response = await asyncio.wait_for(
                self.chat_service.generate_response(prompt, f"section_{section.name}"),
                timeout=300.0  # 5 minutes timeout for local LLM
            )
            response_text = response.get("response", "")
            
            # Extract JSON from response with improved parsing
            json_start = response_text.find('{')
            json_end = response_text.rfind('}')
            
            if json_start >= 0 and json_end >= 0:
                json_str = response_text[json_start:json_end+1]
                try:
                    section_data = json.loads(json_str)
                    
                    # Validate that we have meaningful data
                    if not section_data or not isinstance(section_data, dict):
                        raise ValueError("Empty or invalid section data received")
                    
                    # Check if the section_data already contains the section name as a key
                    # If so, extract the nested data to avoid double-wrapping
                    if section.name in section_data:
                        result = {section.name: section_data[section.name]}
                    else:
                        result = {section.name: section_data}
                    
                    # Add debug output for section completion
                    print(f"✓ {section.display_name} Analysis Completed")
                    print(f"Result Summary: {len(str(section_data))} characters")
                    logger.info(f"Completed analysis for section: {section.name}")
                    
                    return result
                except json.JSONDecodeError as e:
                    # Try to clean up the JSON string
                    cleaned_json = self._clean_json_string(json_str)
                    section_data = json.loads(cleaned_json)
                    
                    # Check if the section_data already contains the section name as a key
                    # If so, extract the nested data to avoid double-wrapping
                    if section.name in section_data:
                        result = {section.name: section_data[section.name]}
                    else:
                        result = {section.name: section_data}
                    
                    # Add debug output for section completion
                    print(f"✓ {section.display_name} Analysis Completed (JSON Fixed)")
                    print(f"Result Summary: {len(str(section_data))} characters")
                    logger.info(f"Completed analysis for section: {section.name} (JSON cleaned)")
                    
                    return result
            else:
                raise ValueError("No JSON object found in LLM response")
        
        # Use error handler for retry logic
        return await self.error_handler.handle_error_with_retry(
            _perform_analysis,
            section=section.name
        )
    
    def _clean_json_string(self, json_str: str) -> str:
        """Clean and fix common JSON formatting issues.
        
        Args:
            json_str: Raw JSON string from LLM response
            
        Returns:
            Cleaned JSON string
        """
        # Remove common formatting issues
        json_str = json_str.strip()
        
        # Fix trailing commas
        import re
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        
        # Fix unescaped quotes in strings
        json_str = re.sub(r'"([^"]*?)"([^":,}\]]*?)"', r'"\1\\"\2"', json_str)
        
        return json_str
    
    async def analyze_resume_sequential(self, resume_content: str, current_year: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Analyze resume sections using LangGraph workflow pipeline.
        
        Args:
            resume_content: The resume content to analyze
            current_year: Current year for date calculations
            
        Yields:
            Dictionary containing section results and progress information
        """
        logger.info("Starting LangGraph workflow pipeline for resume analysis")
        
        try:
            # Initialize workflow state
            initial_state: WorkflowState = {
                "resume_content": resume_content,
                "current_year": current_year,
                "current_section_index": 0,
                "sections": [],
                "results": {},
                "errors": [],
                "progress": 0.0,
                "status": "starting",
                "message": "Initializing workflow..."
            }
            
            # Create a unique thread ID for this workflow execution
            thread_id = f"workflow_{datetime.now().timestamp()}"
            config = {"configurable": {"thread_id": thread_id}}
            
            # Execute workflow and stream results
            async for event in self.workflow.astream(initial_state, config=config):
                # Extract the current state from the event
                if isinstance(event, dict):
                    for node_name, node_state in event.items():
                        if isinstance(node_state, dict):
                            # Yield progress updates based on workflow state
                            yield await self._format_workflow_event(node_name, node_state)
            
            # Yield final completion event
            final_state = await self.workflow.aget_state(config)
            if final_state and final_state.values:
                state = final_state.values
                completed_sections = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
                failed_sections = [s for s in self.sections if s.status == AnalysisStatus.FAILED]
                
                yield {
                    "type": "workflow_complete",
                    "status": "completed",
                    "completed_sections": len(completed_sections),
                    "failed_sections": len(failed_sections),
                    "total_sections": len(self.sections),
                    "progress": 100,
                    "results": state.get("results", {}),
                    "errors": state.get("errors", [])
                }
        
        except Exception as e:
            logger.error(f"Workflow pipeline failed: {str(e)}")
            yield {
                "type": "workflow_error",
                "status": "failed",
                "error": str(e),
                "progress": 0
            }
    
    async def _format_workflow_event(self, node_name: str, node_state: Dict[str, Any]) -> Dict[str, Any]:
        """Format workflow events for streaming output.
        
        Args:
            node_name: Name of the workflow node
            node_state: Current state from the node
            
        Returns:
            Formatted event dictionary
        """
        status = node_state.get("status", "unknown")
        current_index = node_state.get("current_section_index", 0)
        
        # Handle different node types and statuses
        if node_name == "initialize":
            return {
                "type": "workflow_start",
                "status": "initialized",
                "message": node_state.get("message", "Workflow initialized"),
                "progress": 0
            }
        
        elif node_name == "section_start":
            current_index = node_state.get("current_section_index", 0)
            if current_index < len(self.sections):
                section = self.sections[current_index]
                return {
                    "type": "section_start",
                    "section": section.name,
                    "display_name": section.display_name,
                    "description": section.description,
                    "status": "starting",
                    "message": node_state.get("message", f"🔄 Starting {section.display_name} analysis..."),
                    "progress": node_state.get("progress", 0)
                }
        
        elif node_name == "analyze_section":
            if current_index < len(self.sections):
                section = self.sections[current_index]
                
                if status == "section_completed":
                    # Calculate execution time if available
                    execution_time = 0
                    if section.start_time and section.end_time:
                        execution_time = (section.end_time - section.start_time).total_seconds()
                    
                    return {
                        "type": "section_complete",
                        "section": section.name,
                        "display_name": section.display_name,
                        "status": "completed",
                        "message": node_state.get("message", f"✅ {section.display_name} analysis completed successfully! New insights are now available in your career profile."),
                        "data": section.result,
                        "progress": node_state.get("progress", 0),
                        "execution_time": execution_time
                    }
                
                elif status == "section_error":
                    errors = node_state.get("errors", [])
                    current_error = errors[-1] if errors else {}
                    
                    return {
                        "type": "section_error",
                        "section": section.name,
                        "display_name": section.display_name,
                        "status": "failed",
                        "error": current_error.get("error", "Unknown error"),
                        "error_type": current_error.get("error_type", "unknown"),
                        "error_severity": current_error.get("severity", "medium"),
                        "retry_count": current_error.get("retry_count", 0),
                        "progress": node_state.get("progress", 0),
                        "can_continue": status not in ["error_limit_exceeded", "critical_error"]
                    }
                
                elif status == "section_start":
                    # Section starting
                    return {
                        "type": "section_start",
                        "section": section.name,
                        "display_name": section.display_name,
                        "description": section.description,
                        "status": "starting",
                        "message": node_state.get("message", f"Starting {section.display_name} analysis..."),
                        "progress": node_state.get("progress", 0)
                    }
                
                else:
                    # Section in progress
                    return {
                        "type": "progress",
                        "section": section.name,
                        "display_name": section.display_name,
                        "description": section.description,
                        "status": "in_progress",
                        "progress": node_state.get("progress", 0)
                    }
        
        elif node_name == "finalize":
            return {
                "type": "workflow_complete",
                "status": "completed",
                "message": node_state.get("message", "Workflow completed"),
                "progress": 100
            }
        
        # Handle error states
        if status in ["error_limit_exceeded", "critical_error"]:
            return {
                "type": "workflow_error",
                "status": status,
                "error": node_state.get("message", "Workflow error occurred"),
                "progress": node_state.get("progress", 0)
            }
        
        # Default progress update
        return {
            "type": "progress",
            "status": status,
            "message": node_state.get("message", "Processing..."),
            "progress": node_state.get("progress", 0)
        }
    
    def get_workflow_status(self) -> Dict[str, Any]:
        """Get current workflow status with enhanced error information.
        
        Returns:
            Dictionary containing workflow status information
        """
        completed = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
        in_progress = [s for s in self.sections if s.status == AnalysisStatus.IN_PROGRESS]
        failed = [s for s in self.sections if s.status == AnalysisStatus.FAILED]
        
        # Get error summary from error handler
        error_summary = self.error_handler.get_error_summary()
        
        return {
            "total_sections": len(self.sections),
            "completed_sections": len(completed),
            "failed_sections": len(failed),
            "current_section": in_progress[0].name if in_progress else None,
            "progress_percentage": (len(completed) / len(self.sections)) * 100,
            "can_continue": len(failed) < self.max_section_failures,
            "error_summary": error_summary,
            "sections": [
                {
                    "name": s.name,
                    "display_name": s.display_name,
                    "status": s.status.value,
                    "error": s.error,
                    "start_time": s.start_time.isoformat() if s.start_time else None,
                    "end_time": s.end_time.isoformat() if s.end_time else None,
                    "duration": (s.end_time - s.start_time).total_seconds() if s.start_time and s.end_time else None,
                    "section_errors": len(self.error_handler.get_section_errors(s.name))
                }
                for s in self.sections
            ]
        }
    
    def get_error_details(self) -> Dict[str, Any]:
        """Get detailed error information for debugging.
        
        Returns:
            Dictionary containing detailed error information
        """
        return {
            "error_summary": self.error_handler.get_error_summary(),
            "section_errors": {
                section.name: [
                    {
                        "type": error.error_type.value,
                        "severity": error.severity.value,
                        "message": error.message,
                        "timestamp": error.timestamp.isoformat(),
                        "retry_count": error.retry_count
                    }
                    for error in self.error_handler.get_section_errors(section.name)
                ]
                for section in self.sections
                if self.error_handler.get_section_errors(section.name)
            }
        }
    
    def reset_error_handler(self):
        """Reset the error handler state."""
        self.error_handler.clear_error_history()
        logger.info("Error handler state reset")