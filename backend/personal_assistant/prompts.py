# d:\projects\Product\backend\personal_assistant\prompts.py

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

Now optimize the following user query while preserving its original meaning and intent:

Original Query: {user_query}

Optimized Query:"""