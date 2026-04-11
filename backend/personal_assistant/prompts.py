# d:\projects\Product\backend\personal_assistant\prompts.py
import re


def sanitize_prompt_input(text: str, max_length: int = 5000) -> str:
    """Sanitize user input to prevent prompt injection attacks.

    Args:
        text: The user input to sanitize
        max_length: Maximum allowed length (default 5000 chars)

    Returns:
        Sanitized string safe for prompt inclusion
    """
    if not text:
        return ""

    # Truncate to max length
    text = text[:max_length]

    # Remove common prompt injection patterns
    # Pattern 1: "Ignore previous instructions" variants
    injection_patterns = [
        r'(?i)ignore\s+(all\s+)?previous\s+(instructions?|prompts?|context)',
        r'(?i)disregard\s+(all\s+)?previous',
        r'(?i)forget\s+(everything|all)',
        r'(?i)new\s+instructions?:',
        r'(?i)system\s*:',
        r'(?i)assistant\s*:',
        r'(?i)user\s*:',
        r'(?i)\[INST\]',
        r'(?i)\[\/INST\]',
        r'(?i)<\|.*?\|>',  # Special tokens like <|endoftext|>
    ]

    for pattern in injection_patterns:
        text = re.sub(pattern, '[FILTERED]', text)

    # Escape potential delimiter characters that could break prompt structure
    # Replace triple backticks which could escape code blocks
    text = text.replace('```', '` ` `')

    # Replace sequences that look like role markers
    text = re.sub(r'^(Human|Assistant|System):', r'\1:', text, flags=re.MULTILINE | re.IGNORECASE)

    return text.strip()


def format_follow_up_prompt(user_message: str, ai_response: str, profile_context: str = "") -> str:
    """Format the follow-up prompt with sanitized inputs."""
    return FOLLOW_UP_PROMPT.format(
        user_message=sanitize_prompt_input(user_message, 2000),
        ai_response=sanitize_prompt_input(ai_response, 3000),
        profile_context=sanitize_prompt_input(profile_context, 1000)
    )


def format_optimize_prompt(user_query: str) -> str:
    """Format the query optimization prompt with sanitized input."""
    return OPTIMIZE_QUERY_PROMPT.format(
        user_query=sanitize_prompt_input(user_query, 2000)
    )


FOLLOW_UP_PROMPT = """
Based on the following conversation and user profile, generate exactly 3 simple, practical follow-up questions that the USER is most likely to ask next. These should be questions from the USER's perspective.

User Profile Context: {profile_context}

The questions should be:
1. Simple and easy to understand (avoid complex terminology)
2. Directly related to the original question and response
3. Practical and actionable for the USER
4. Personalized based on the user's background when relevant
5. Questions the USER would naturally want to know next

Example 1:
User Profile: Software Engineer at Google, Healthcare industry
User Question: "How do I improve my Python skills?"
AI Response: "Focus on practice, read documentation, and work on projects."
Good Follow-up Questions:
1. What kind of projects should I work on?
2. Are there Python libraries useful for healthcare applications?
3. How much time should I spend practicing each day?

Example 2:
User Profile: Marketing Manager, 5 years experience
User Question: "How can I transition to data science?"
AI Response: "Learn Python, statistics, and SQL. Build a portfolio with real projects."
Good Follow-up Questions:
1. Which should I learn first - Python or SQL?
2. What kind of projects would show my marketing background?
3. How long does this transition usually take?

Now generate follow-up questions for this conversation:

Original User Question: {user_message}

AI Response: {ai_response}

Generate exactly 3 simple, practical follow-up questions that the USER would naturally want to ask next:
1. [First question]
2. [Second question]
3. [Third question]

Only return the numbered questions, nothing else.
"""

OPTIMIZE_QUERY_PROMPT = """
You are an expert query optimizer. Your task is to improve user queries to make them clearer, more grammatically correct, and better structured for AI understanding.

Optimization Guidelines:
1. Fix grammar and spelling errors
2. Make the query more specific and clear
3. Improve sentence structure and flow
4. Add context where helpful but keep it concise
5. Maintain the original intent and meaning
6. Use professional but natural language
7. Remove redundancy and improve clarity
8. Ensure the query is well-organized and logical

Examples:

Original: "how do i get better at coding python stuff"
Optimized: "How can I improve my Python programming skills and become more proficient in software development?"

Original: "tell me about machine learning and ai and how to learn it"
Optimized: "What is machine learning and artificial intelligence, and what are the best approaches to learn these technologies?"

Original: "i want to know about career change from marketing to tech but dont know where start"
Optimized: "I'm interested in transitioning from a marketing career to the technology industry. What steps should I take to make this career change successfully?"

Now optimize the following user query while preserving its original meaning and intent.
IMPORTANT: Output ONLY the optimized query text itself. Do NOT include any preamble, explanation, labels, or quotation marks.

Original Query: {user_query}

Optimized Query:"""