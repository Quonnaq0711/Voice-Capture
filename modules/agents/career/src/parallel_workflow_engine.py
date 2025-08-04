#!/usr/bin/env python3
"""
Parallel workflow engine for resume analysis optimization.

This module provides enhanced workflow processing with parallel execution
for independent analysis sections to improve performance.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Callable, Any, AsyncGenerator, Set
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from workflow_engine import (
    AnalysisStatus, AnalysisSection, WorkflowProgress, 
    ResumeAnalysisWorkflow
)
from error_handler import AnalysisErrorHandler, RetryConfig, ErrorSeverity
from chat_service import ChatService

# Configure logging
logger = logging.getLogger(__name__)

class ParallelStrategy(Enum):
    """Strategies for parallel processing."""
    SEQUENTIAL = "sequential"  # Original sequential processing
    BATCH_PARALLEL = "batch_parallel"  # Process sections in batches
    DEPENDENCY_AWARE = "dependency_aware"  # Respect section dependencies
    FULL_PARALLEL = "full_parallel"  # Process all sections simultaneously

@dataclass
class SectionDependency:
    """Represents dependencies between analysis sections."""
    section: str
    depends_on: List[str]
    can_run_parallel_with: List[str]

@dataclass
class ParallelConfig:
    """Configuration for parallel processing."""
    strategy: ParallelStrategy = ParallelStrategy.BATCH_PARALLEL
    max_concurrent_sections: int = 3
    batch_size: int = 2
    enable_section_caching: bool = True
    timeout_per_section: float = 300.0  # 5 minutes for local LLM processing
    
class ParallelResumeAnalysisWorkflow(ResumeAnalysisWorkflow):
    """Enhanced workflow engine with parallel processing capabilities."""
    
    def __init__(self, chat_service: ChatService, 
                 retry_config: Optional[RetryConfig] = None,
                 parallel_config: Optional[ParallelConfig] = None):
        """Initialize the parallel workflow engine.
        
        Args:
            chat_service: ChatService instance for LLM interactions
            retry_config: Configuration for error handling and retries
            parallel_config: Configuration for parallel processing
        """
        super().__init__(chat_service, retry_config)
        self.parallel_config = parallel_config or ParallelConfig()
        self.section_dependencies = self._initialize_dependencies()
        self.section_cache: Dict[str, Any] = {}
        self.executor = ThreadPoolExecutor(max_workers=self.parallel_config.max_concurrent_sections)
        
    def _initialize_dependencies(self) -> Dict[str, SectionDependency]:
        """Initialize section dependencies for parallel processing.
        
        Returns:
            Dictionary mapping section names to their dependencies
        """
        dependencies = {
            "professionalIdentity": SectionDependency(
                section="professionalIdentity",
                depends_on=[],
                can_run_parallel_with=["skillsAnalysis", "salaryAnalysis"]
            ),
            "workExperience": SectionDependency(
                section="workExperience",
                depends_on=[],
                can_run_parallel_with=["skillsAnalysis", "salaryAnalysis"]
            ),
            "skillsAnalysis": SectionDependency(
                section="skillsAnalysis",
                depends_on=[],
                can_run_parallel_with=["professionalIdentity", "workExperience", "salaryAnalysis"]
            ),
            "marketPosition": SectionDependency(
                section="marketPosition",
                depends_on=["professionalIdentity", "workExperience"],
                can_run_parallel_with=["careerTrajectory"]
            ),
            "careerTrajectory": SectionDependency(
                section="careerTrajectory",
                depends_on=["workExperience"],
                can_run_parallel_with=["marketPosition", "strengthsWeaknesses"]
            ),
            "strengthsWeaknesses": SectionDependency(
                section="strengthsWeaknesses",
                depends_on=["professionalIdentity", "skillsAnalysis"],
                can_run_parallel_with=["careerTrajectory"]
            ),
            "salaryAnalysis": SectionDependency(
                section="salaryAnalysis",
                depends_on=[],
                can_run_parallel_with=["professionalIdentity", "workExperience", "skillsAnalysis"]
            )
        }
        return dependencies
    
    def _get_ready_sections(self, completed_sections: Set[str]) -> List[AnalysisSection]:
        """Get sections that are ready to be processed based on dependencies.
        
        Args:
            completed_sections: Set of already completed section names
            
        Returns:
            List of sections ready for processing
        """
        ready_sections = []
        
        for section in self.sections:
            if (section.status == AnalysisStatus.PENDING and 
                section.name not in completed_sections):
                
                # Check if all dependencies are satisfied
                dependency = self.section_dependencies.get(section.name)
                if dependency:
                    dependencies_met = all(
                        dep in completed_sections 
                        for dep in dependency.depends_on
                    )
                    if dependencies_met:
                        ready_sections.append(section)
                else:
                    # No dependencies, can run immediately
                    ready_sections.append(section)
        
        return ready_sections
    
    def _can_run_parallel(self, section1: str, section2: str) -> bool:
        """Check if two sections can run in parallel.
        
        Args:
            section1: Name of first section
            section2: Name of second section
            
        Returns:
            True if sections can run in parallel
        """
        dep1 = self.section_dependencies.get(section1)
        dep2 = self.section_dependencies.get(section2)
        
        if not dep1 or not dep2:
            return True  # No dependency info, assume parallel is safe
        
        return (section2 in dep1.can_run_parallel_with and 
                section1 in dep2.can_run_parallel_with)
    
    async def _analyze_section_with_timeout(self, section: AnalysisSection, 
                                          resume_content: str, 
                                          current_year: int) -> Any:
        """Analyze a section with timeout protection and retry logic.
        
        Args:
            section: Section to analyze
            resume_content: Resume content
            current_year: Current year
            
        Returns:
            Analysis result
        """
        async def _perform_analysis_with_timeout():
            try:
                return await asyncio.wait_for(
                    self._analyze_section(section, resume_content, current_year),
                    timeout=self.parallel_config.timeout_per_section
                )
            except asyncio.TimeoutError:
                raise TimeoutError(f"Section {section.name} analysis timed out after {self.parallel_config.timeout_per_section}s")
        
        # Use error handler for retry logic
        return await self.error_handler.handle_error_with_retry(
            _perform_analysis_with_timeout,
            section=section.name
        )
    
    async def analyze_resume_parallel(self, resume_content: str, 
                                    current_year: int) -> AsyncGenerator[Dict[str, Any], None]:
        """Analyze resume using parallel processing strategy.
        
        Args:
            resume_content: The resume content to analyze
            current_year: Current year for analysis context
            
        Yields:
            Progress updates and section results
        """
        logger.info(f"Starting parallel resume analysis with strategy: {self.parallel_config.strategy.value}")
        
        # Initialize all sections
        for section in self.sections:
            section.status = AnalysisStatus.PENDING
            section.start_time = None
            section.end_time = None
            section.result = None
            section.error = None
        
        completed_sections: Set[str] = set()
        failed_sections: Set[str] = set()
        running_tasks: Dict[str, asyncio.Task] = {}
        
        try:
            # Initial progress notification
            yield {
                "type": "workflow_start",
                "message": "Starting parallel resume analysis",
                "total_sections": len(self.sections),
                "strategy": self.parallel_config.strategy.value
            }
            
            while len(completed_sections) + len(failed_sections) < len(self.sections):
                # Get sections ready to run
                ready_sections = self._get_ready_sections(completed_sections)
                
                # Filter out sections that are already running or failed
                available_sections = [
                    s for s in ready_sections 
                    if s.name not in running_tasks and s.name not in failed_sections
                ]
                
                # Start new tasks based on strategy
                if self.parallel_config.strategy == ParallelStrategy.BATCH_PARALLEL:
                    # Start up to batch_size sections
                    sections_to_start = available_sections[:self.parallel_config.batch_size]
                elif self.parallel_config.strategy == ParallelStrategy.FULL_PARALLEL:
                    # Start all available sections
                    sections_to_start = available_sections
                elif self.parallel_config.strategy == ParallelStrategy.DEPENDENCY_AWARE:
                    # Start sections that can run in parallel
                    sections_to_start = self._select_parallel_sections(
                        available_sections, list(running_tasks.keys())
                    )
                else:
                    # Sequential fallback
                    sections_to_start = available_sections[:1]
                
                # Limit concurrent tasks
                max_new_tasks = self.parallel_config.max_concurrent_sections - len(running_tasks)
                sections_to_start = sections_to_start[:max_new_tasks]
                
                # Start new analysis tasks
                for section in sections_to_start:
                    section.status = AnalysisStatus.IN_PROGRESS
                    section.start_time = datetime.now()
                    
                    task = asyncio.create_task(
                        self._analyze_section_with_timeout(section, resume_content, current_year)
                    )
                    running_tasks[section.name] = task
                    
                    logger.info(f"Started parallel analysis for section: {section.name}")
                    
                    # Notify section start
                    yield {
                        "type": "section_start",
                        "section": section.name,
                        "display_name": section.display_name,
                        "status": "in_progress",
                        "progress": (len(completed_sections) / len(self.sections)) * 100
                    }
                
                # Wait for at least one task to complete
                if running_tasks:
                    done, pending = await asyncio.wait(
                        running_tasks.values(),
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    
                    # Process completed tasks
                    for task in done:
                        # Find which section this task belongs to
                        section_name = None
                        for name, t in running_tasks.items():
                            if t == task:
                                section_name = name
                                break
                        
                        if section_name:
                            section = next(s for s in self.sections if s.name == section_name)
                            
                            try:
                                # Get task result
                                result = await task
                                
                                # Mark section as completed
                                section.status = AnalysisStatus.COMPLETED
                                section.result = result
                                section.end_time = datetime.now()
                                completed_sections.add(section_name)
                                
                                # Cache result if enabled
                                if self.parallel_config.enable_section_caching:
                                    self.section_cache[section_name] = result
                                
                                logger.info(f"Completed parallel analysis for section: {section_name}")
                                
                                # Yield section result
                                yield {
                                    "type": "section_result",
                                    "section": section_name,
                                    "display_name": section.display_name,
                                    "status": "completed",
                                    "data": result,
                                    "progress": (len(completed_sections) / len(self.sections)) * 100,
                                    "execution_time": (section.end_time - section.start_time).total_seconds()
                                }
                                
                            except Exception as e:
                                # Handle section failure
                                section.status = AnalysisStatus.FAILED
                                section.error = str(e)
                                section.end_time = datetime.now()
                                failed_sections.add(section_name)
                                
                                # Get error details
                                error_info = self.error_handler.classify_error(e, section_name)
                                
                                logger.error(f"Failed parallel analysis for section {section_name}: {str(e)}")
                                
                                # Yield error result
                                yield {
                                    "type": "section_error",
                                    "section": section_name,
                                    "display_name": section.display_name,
                                    "status": "failed",
                                    "error": str(e),
                                    "error_type": error_info.error_type.value,
                                    "error_severity": error_info.severity.value,
                                    "progress": (len(completed_sections) / len(self.sections)) * 100
                                }
                                
                                # Check if we should stop due to critical errors
                                if (error_info.severity == ErrorSeverity.CRITICAL or 
                                    len(failed_sections) >= self.max_section_failures):
                                    
                                    # Cancel remaining tasks
                                    for remaining_task in pending:
                                        remaining_task.cancel()
                                    
                                    yield {
                                        "type": "workflow_error",
                                        "message": f"Workflow stopped due to critical errors: {len(failed_sections)} sections failed",
                                        "failed_sections": list(failed_sections),
                                        "completed_sections": list(completed_sections)
                                    }
                                    return
                            
                            # Remove completed task
                            del running_tasks[section_name]
                
                # Small delay to prevent busy waiting
                if not running_tasks and not available_sections:
                    await asyncio.sleep(0.1)
            
            # Final workflow completion
            total_time = sum(
                (s.end_time - s.start_time).total_seconds() 
                for s in self.sections 
                if s.start_time and s.end_time
            )
            
            yield {
                "type": "workflow_complete",
                "message": "Parallel resume analysis completed",
                "completed_sections": len(completed_sections),
                "failed_sections": len(failed_sections),
                "total_sections": len(self.sections),
                "total_execution_time": total_time,
                "strategy_used": self.parallel_config.strategy.value
            }
            
        except Exception as e:
            logger.error(f"Critical error in parallel workflow: {str(e)}")
            
            # Cancel all running tasks
            for task in running_tasks.values():
                task.cancel()
            
            yield {
                "type": "workflow_error",
                "message": f"Critical error in parallel workflow: {str(e)}",
                "error": str(e)
            }
    
    def _select_parallel_sections(self, available_sections: List[AnalysisSection], 
                                running_sections: List[str]) -> List[AnalysisSection]:
        """Select sections that can run in parallel with currently running sections.
        
        Args:
            available_sections: Sections available to start
            running_sections: Names of currently running sections
            
        Returns:
            List of sections that can run in parallel
        """
        if not running_sections:
            return available_sections[:1]  # Start first section
        
        parallel_sections = []
        for section in available_sections:
            can_run = all(
                self._can_run_parallel(section.name, running_section)
                for running_section in running_sections
            )
            if can_run:
                parallel_sections.append(section)
        
        return parallel_sections
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for the parallel workflow.
        
        Returns:
            Dictionary containing performance metrics
        """
        completed_sections = [s for s in self.sections if s.status == AnalysisStatus.COMPLETED]
        
        if not completed_sections:
            return {"message": "No completed sections to analyze"}
        
        execution_times = [
            (s.end_time - s.start_time).total_seconds()
            for s in completed_sections
            if s.start_time and s.end_time
        ]
        
        total_time = sum(execution_times)
        avg_time = total_time / len(execution_times) if execution_times else 0
        
        return {
            "total_sections": len(self.sections),
            "completed_sections": len(completed_sections),
            "total_execution_time": total_time,
            "average_section_time": avg_time,
            "fastest_section_time": min(execution_times) if execution_times else 0,
            "slowest_section_time": max(execution_times) if execution_times else 0,
            "strategy_used": self.parallel_config.strategy.value,
            "max_concurrent_sections": self.parallel_config.max_concurrent_sections,
            "cache_enabled": self.parallel_config.enable_section_caching,
            "cached_sections": list(self.section_cache.keys())
        }
    
    def clear_cache(self):
        """Clear the section result cache."""
        self.section_cache.clear()
        logger.info("Section cache cleared")
    
    def __del__(self):
        """Cleanup resources."""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)