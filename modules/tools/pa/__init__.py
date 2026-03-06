"""
Personal Assistant Tools

Read-only tools for querying user data. The PA is a consulting assistant —
it can read tasks, documents, notes, and insights but does not modify data.
"""
from modules.tools.todo.get_todos import get_todos
from modules.tools.pa.get_user_documents import get_user_documents
from modules.tools.pa.read_document import read_document
from modules.tools.pa.search_notes import search_notes
from modules.tools.pa.get_daily_insights import get_daily_insights

PA_TOOLS = [
    get_todos,
    get_user_documents,
    read_document,
    search_notes,
    get_daily_insights,
]
