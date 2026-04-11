"""
Solver Tools — tools available to the AI Task Solver for progressive disclosure.

Level 0 (always preloaded): task metadata, comments, attachment metadata
Level 1 (LLM calls on demand): ReadAttachment, SearchRelatedTasks, GetTaskDetails, GetTaskComments
"""
from modules.tools.solver.read_attachment import read_attachment
from modules.tools.solver.get_task_comments import get_task_comments
from modules.tools.solver.search_related_tasks import search_related_tasks
from modules.tools.solver.get_task_details import get_task_details

SOLVER_TOOLS = [read_attachment, get_task_comments, search_related_tasks, get_task_details]
