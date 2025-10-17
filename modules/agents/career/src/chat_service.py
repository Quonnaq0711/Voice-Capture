import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
import logging
from typing import Optional, List, Dict, Any
import httpx
import json
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from backend.db.database import SessionLocal
from backend.utils.db_session import get_db_session
from backend.models.profile import UserProfile
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from prompts import FOLLOW_UP_PROMPT
from base_chat_service import BaseChatService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get Ollama URL from environment variable, fallback to localhost for local development
DEFAULT_CAREER_OLLAMA_URL = os.getenv("CAREER_OLLAMA_URL", "http://ollama2-staging:11434")

class ChatService(BaseChatService):
    def __init__(self, model_name: str = "gemma3:latest", base_url: str = DEFAULT_CAREER_OLLAMA_URL):
        self.model_name = model_name
        self.base_url = base_url
        self.store = {}
        self.executor = ThreadPoolExecutor(max_workers=4)

        try:
            self.llm = OllamaLLM(
                model=model_name,
                base_url=base_url,
                temperature=0.7,
                top_p=0.9,
                num_predict=2048,  # Max tokens to generate
                stop=["Human:", "Assistant:"]  # Stop sequences
            )

            self.prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a specialized career agent. Provide expert advice on career-related topics."),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{input}"),
            ])

            self.chain = self.prompt | self.llm

            self.conversation = RunnableWithMessageHistory(
                self.chain,
                self.get_session_history,
                input_messages_key="input",
                history_messages_key="history",
            )
            logger.info(f"Career ChatService initialized with model: {model_name} at {base_url}")
        except Exception as e:
            logger.error(f"Failed to initialize Career ChatService: {e}")
            raise

    def shutdown(self):
        """
        Gracefully shutdown the chat service and release all resources.

        This method should be called when the application is shutting down to ensure
        all resources (ThreadPoolExecutor) are properly released.
        """
        try:
            if self.executor:
                logger.info("Shutting down Career Agent ThreadPoolExecutor...")
                self.executor.shutdown(wait=True, cancel_futures=True)
                logger.info("Career Agent ThreadPoolExecutor shut down successfully")
        except Exception as e:
            logger.error(f"Error during Career ChatService shutdown: {str(e)}", exc_info=True)

    def get_session_history(self, session_id: str) -> BaseChatMessageHistory:
        """Return chat history for a given session.

        If the session does not exist in memory, attempt to hydrate it from the
        persistent store (``chat_messages`` table). This prevents loss of
        conversation context after an application restart.

        Args:
            session_id: The identifier of the chat session received from the
                client. This is stored as an ``Integer`` in the database, but is
                often passed around as a ``str`` in the application layer.

        Returns:
            An ``InMemoryChatMessageHistory`` instance containing the full
            conversation history for ``session_id``.
        """
        # Return cached history if we already have it in memory.
        if session_id in self.store:
            return self.store[session_id]

        # Create a new in-memory history object – we'll populate it below.
        history = InMemoryChatMessageHistory()

        # Attempt to pull historical messages from the database so that we can
        # reconstruct the context when the application restarts.
        # Only load from DB for numeric session IDs (actual user chat sessions).
        # Skip for workflow session IDs like "section_professionalIdentity".
        should_load_from_db = False
        db_session_id = None

        if isinstance(session_id, int):
            should_load_from_db = True
            db_session_id = session_id
        elif isinstance(session_id, str) and session_id.isdigit():
            should_load_from_db = True
            db_session_id = int(session_id)

        if should_load_from_db:
            try:
                # Use context manager for automatic session cleanup
                with get_db_session() as db:
                    messages = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.session_id == db_session_id)
                        .order_by(ChatMessage.id.asc())
                        .all()
                    )

                    # Populate in-memory history from database records
                    for msg in messages:
                        # Distinguish between user and assistant messages
                        if msg.sender == "user":
                            history.add_message(HumanMessage(content=msg.message_text))
                        else:
                            # Treat any non-user sender as assistant for robustness
                            history.add_message(AIMessage(content=msg.message_text))
            except Exception as e:
                logger.error(f"Failed to load chat history from DB for session {session_id}: {str(e)}")
                # Continue with empty history

        # Cache the reconstructed history for future calls.
        self.store[session_id] = history
        return history

    async def generate_response(self, user_message: str, session_id: str):
        logger.info(f"Generating response for message: {user_message[:50]}...")
        config = {"configurable": {"session_id": session_id}}
        response = await self.conversation.ainvoke({"input": user_message}, config=config)
        return {"response": response, "session_id": session_id}

    async def generate_streaming_response(self, user_message: str, session_id: Optional[str] = None, user_id: Optional[int] = None, db: Optional[Session] = None):
        """
        Generate streaming AI response for user message using Ollama's streaming API.
        
        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID to fetch profile data for personalized responses
            db: Optional database session
            
        Yields:
            Streaming response chunks from the AI model
        """
        # Import here to avoid circular imports
        from resume_analyzer import ResumeAnalyzer
        from streaming_analyzer import StreamingResumeAnalyzer
        try:
            logger.info(f"Generating streaming response for message: {user_message[:50]}...")

            print("session_id=", session_id)
            
            # Use default session if none provided
            if session_id is None:
                session_id = "default"
            
            # Get conversation history for context
            history = await self.get_conversation_history(session_id)
            
            # Get user profile data for personalized context
            profile_data = None
            if user_id and db:
                profile_data = await self.get_user_profile(user_id, db)

            # Get latest career insights for context
            career_insights = None
            if user_id and db:
                career_insights = await self.get_latest_career_insights(user_id, db)
            
            # Build the system prompt with user profile context
            system_content = "You are a specialized career agent. Provide expert advice on career-related topics."

            if profile_data:
                # Create a comprehensive profile summary for context
                profile_summary = self._format_profile_for_context(profile_data)
                system_content += f"\n\nUser Profile Context:\n{profile_summary}\n\nUse this profile information to provide personalized and relevant career advice."
            
            if career_insights:
                # Add career insights context from recent resume analysis
                insights_summary = self._format_career_insights_for_context(career_insights)
                system_content += f"\n\nLatest Career Insights from Resume Analysis:\n{insights_summary}\n\nUse these insights to provide informed advice about the user's career development, skills, and opportunities based on their latest resume analysis."
            
            # Build the prompt with conversation history
            messages = []
            messages.append({
                "role": "system",
                "content": system_content
            })
            
            # Add conversation history
            for msg in history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            # Add the current user message only if it is not already the latest entry
            if not history or history[-1]["role"] != "user" or history[-1]["content"] != user_message:
                messages.append({
                    "role": "user",
                    "content": user_message
                })
                # Persist the user message immediately so that it remains in history even if the
                # streaming process is cancelled before completion.
                self.get_session_history(session_id).add_user_message(user_message)

            print("messages=",messages)
            
            # Prepare the request payload for Ollama's generate API
            payload = {
                "model": self.model_name,
                "prompt": self._format_messages_for_ollama(messages),
                "stream": True,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 2048
                }
            }
            
            # Make streaming request to Ollama
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response.raise_for_status()
                    
                    full_response = ""
                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                chunk_data = json.loads(line)
                                if "response" in chunk_data:
                                    token = chunk_data["response"]
                                    full_response += token
                                    yield {
                                        "type": "token",
                                        "content": token
                                    }
                                
                                # Check if this is the final chunk
                                if chunk_data.get("done", False):
                                    # Add the complete response to conversation history
                                    self._add_to_history(session_id, user_message, full_response)
                                    
                                    # Generate follow-up questions
                                    follow_up_questions = await self.generate_follow_up_questions(user_message, full_response, session_id, profile_data)
                                    
                                    yield {
                                        "type": "complete",
                                        "content": full_response,
                                        "follow_up_questions": follow_up_questions
                                    }
                                    break
                                    
                            except json.JSONDecodeError as e:
                                logger.warning(f"Failed to parse JSON chunk: {line}, error: {e}")
                                continue
                                
        except Exception as e:
            logger.error(f"Error in streaming response: {str(e)}")
            yield {
                "type": "error",
                "content": f"Error generating response: {str(e)}"
            }
    
    def _format_messages_for_ollama(self, messages: List[Dict[str, str]]) -> str:
        """
        Format conversation messages into a single prompt for Ollama.
        
        Args:
            messages: List of conversation messages
            
        Returns:
            Formatted prompt string
        """
        prompt_parts = []
        
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"Human: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        
        prompt_parts.append("Assistant:")
        return "\n\n".join(prompt_parts)
    
    def _add_to_history(self, session_id: str, user_message: str, ai_response: str):
        """
        Add user message and AI response to conversation history.
        
        Args:
            session_id: Session identifier
            user_message: User's message
            ai_response: AI's response
        """
        try:
            history = self.get_session_history(session_id)

            # Ensure the latest entry is the corresponding user message to avoid duplicates.
            if not history.messages or not isinstance(history.messages[-1], HumanMessage) or history.messages[-1].content != user_message:
                history.add_user_message(user_message)

            # Always append the assistant response.
            history.add_ai_message(ai_response)
        except Exception as e:
            logger.error(f"Error adding to history: {str(e)}")

    async def get_conversation_history(self, session_id: str = "default") -> List[Dict[str, str]]:
        """
        Get conversation history for the specified session, formatted as a list.
        """
        try:
            if session_id not in self.store:
                # Ensure memory history exists
                self.get_session_history(session_id)
            messages = self.store[session_id].messages
            history = []
            for message in messages:
                if isinstance(message, HumanMessage):
                    history.append({"role": "user", "content": message.content})
                elif isinstance(message, AIMessage):
                    history.append({"role": "assistant", "content": message.content})
            return history
        except Exception as e:
            logger.error(f"Error getting conversation history: {str(e)}")
            return []

    async def get_user_profile(self, user_id: int, db: Optional[Session] = None) -> Optional[Dict[str, any]]:
        """
        Get user profile data from database to provide personalized context.
        
        Args:
            user_id: User ID to fetch profile for
            db: Optional database session to use
            
        Returns:
            Dictionary containing user profile data or None if not found
        """
        try:
            # Use provided db session or create a new one
            should_close_db = False
            if db is None:
                db = SessionLocal()
                should_close_db = True
            
            try:
                profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
                if not profile:
                    logger.info(f"No profile found for user_id: {user_id}")
                    return None

                # Convert profile to dictionary, including ALL fields for comprehensive context
                profile_data = {
                    # Career Information
                    "current_job": profile.current_job,
                    "company": profile.company,
                    "industry": profile.industry,
                    "experience": profile.experience,
                    "work_style": profile.work_style,
                    "leadership_experience": profile.leadership_experience,

                    # Skills and Competencies
                    "skills": profile.skills,
                    "soft_skills": profile.soft_skills,
                    "certifications": profile.certifications,
                    "skill_gaps": profile.skill_gaps,
                    "professional_strengths": profile.professional_strengths,
                    "growth_areas": profile.growth_areas,

                    # Goals and Aspirations
                    "short_term_goals": profile.short_term_goals,
                    "career_goals": profile.career_goals,
                    "career_path_preference": profile.career_path_preference,
                    "career_challenges": profile.career_challenges,
                    "target_industries": profile.target_industries,

                    # Work Preferences
                    "work_life_balance_priority": profile.work_life_balance_priority,
                    "company_size_preference": profile.company_size_preference,
                    "career_risk_tolerance": profile.career_risk_tolerance,
                    "geographic_flexibility": profile.geographic_flexibility,
                    "work_values": profile.work_values,
                    "learning_preferences": profile.learning_preferences,
                    "preferred_learning_methods": profile.preferred_learning_methods,

                    # Education
                    "education_level": profile.education_level,
                    "learning_goals": profile.learning_goals,

                    # Personal Information
                    "learning_style": profile.learning_style,
                    "personality_type": profile.personality_type,
                    "strengths": profile.strengths,
                    "areas_for_improvement": profile.areas_for_improvement,

                    # Lifestyle Preferences
                    "fitness_level": profile.fitness_level,
                    "health_goals": profile.health_goals,
                    "dietary_preferences": profile.dietary_preferences,
                    "exercise_preferences": profile.exercise_preferences,
                    "travel_style": profile.travel_style,
                    "preferred_destinations": profile.preferred_destinations,
                    "travel_budget": profile.travel_budget,
                    "travel_frequency": profile.travel_frequency,
                    "family_status": profile.family_status,
                    "work_life_balance": profile.work_life_balance,

                    # Interests and Hobbies
                    "hobbies": profile.hobbies,
                    "interests": profile.interests,
                    "creative_pursuits": profile.creative_pursuits,

                    # Financial Information
                    "income_range": profile.income_range,
                    "financial_goals": profile.financial_goals,
                    "investment_experience": profile.investment_experience,
                    "risk_tolerance": profile.risk_tolerance,

                    # Spiritual/Mindfulness
                    "spiritual_practices": profile.spiritual_practices,
                    "mindfulness_level": profile.mindfulness_level,
                    "stress_management": profile.stress_management,

                    # Relationship
                    "relationship_goals": profile.relationship_goals
                }

                # Filter out None values to keep context clean
                profile_data = {k: v for k, v in profile_data.items() if v is not None}

                logger.info(f"Retrieved comprehensive profile data for user_id: {user_id} ({len(profile_data)} fields)")
                return profile_data
                
            finally:
                if should_close_db:
                    db.close()
                
        except Exception as e:
            logger.error(f"Error getting user profile: {str(e)}")
            return None

    async def get_latest_career_insights(self, user_id: int, db: Optional[Session] = None) -> Optional[Dict[str, any]]:
        """
        Get the latest career insights from database to provide context about recent resume analysis.
        
        Args:
            user_id: User ID to fetch career insights for
            db: Optional database session to use
            
        Returns:
            Dictionary containing latest career insights data or None if not found
        """
        try:
            # Use provided db session or create a new one
            should_close_db = False
            if db is None:
                db = SessionLocal()
                should_close_db = True
            
            try:
                # Get the most recent career insight for the user
                latest_insight = (
                    db.query(CareerInsight)
                    .filter(CareerInsight.user_id == user_id)
                    .order_by(CareerInsight.created_at.desc())
                    .first()
                )
                
                if not latest_insight:
                    logger.info(f"No career insights found for user_id: {user_id}")
                    return None
                
                # Get the professional data from the career insight
                professional_data = latest_insight.get_professional_data()
                
                if professional_data:
                    logger.info(f"Retrieved latest career insights for user_id: {user_id}")
                    return professional_data
                else:
                    logger.info(f"Career insight found but no professional data for user_id: {user_id}")
                    return None
                
            finally:
                if should_close_db:
                    db.close()
                
        except Exception as e:
            logger.error(f"Error getting latest career insights: {str(e)}")
            return None

    async def generate_follow_up_questions(self, user_message: str, ai_response: str, session_id: str = "default", profile_data: Optional[Dict[str, any]] = None, cancellation_event: Optional[asyncio.Event] = None) -> List[str]:
        """
        Generate 3 follow-up questions based on the user's original message and AI response.
        
        Args:
            user_message: The original user message
            ai_response: The AI's response to the user message
            session_id: Session identifier for conversation context
            profile_data: Optional user profile data for personalized context
            cancellation_event: Optional event to check for cancellation
            
        Returns:
            List of 3 follow-up questions that users are most likely to ask
        """
        try:
            # Check for cancellation before starting
            if cancellation_event and cancellation_event.is_set():
                return []
            
            # Format profile context
            profile_context = ""
            if profile_data:
                profile_context = self._format_profile_for_context(profile_data)
            
            # Create a specialized prompt for generating follow-up questions
            follow_up_prompt = FOLLOW_UP_PROMPT.format(
                user_message=user_message, 
                ai_response=ai_response,
                profile_context=profile_context
            )
            
            print("follow_up_prompt=",follow_up_prompt)

            # Generate follow-up questions using the LLM
            loop = asyncio.get_event_loop()
            task = loop.run_in_executor(
                self.executor,
                self._generate_follow_up_sync,
                follow_up_prompt,
                cancellation_event
            )
            
            # Handle cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED,
                        timeout=120.0  # 2 minute timeout for follow-up generation
                    )

                    # Handle timeout
                    if not done:
                        logger.warning("[Ollama Career] Follow-up generation timed out after 120 seconds")
                        for pending_task in [task, wait_task]:
                            pending_task.cancel()
                        raise asyncio.TimeoutError("Follow-up generation timed out after 120 seconds")

                    # Cancel any pending tasks
                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass
                    
                    # If cancellation event was set, return empty list
                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        return []
                    
                    # Get the result from the completed task
                    questions_text = await task
                finally:
                    # Ensure wait_task is cancelled if it wasn't already
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                questions_text = await task
            
            # Parse the generated questions
            questions = self._parse_follow_up_questions(questions_text)
            
            logger.info(f"Generated {len(questions)} follow-up questions for session: {session_id}")
            return questions
            
        except Exception as e:
            logger.error(f"Error generating follow-up questions: {str(e)}")
            # Return default questions if generation fails
            return [
                "Can you provide more details about this career advice?",
                "What are the next steps I should take in my career?",
                "Are there any alternative career paths I should consider?"
            ]

    def _generate_follow_up_sync(self, prompt: str, cancellation_event: Optional[asyncio.Event] = None) -> str:
        """
        Synchronous method to generate follow-up questions using the LLM.
        
        Args:
            prompt: The prompt for generating follow-up questions
            cancellation_event: Optional event to check for cancellation
            
        Returns:
            Generated follow-up questions as text
        """
        try:
            # Check for cancellation before starting
            if cancellation_event and cancellation_event.is_set():
                return ""
            
            # Use the LLM directly for follow-up question generation
            response = self.llm.invoke(prompt)
            
            # Check for cancellation after generation
            if cancellation_event and cancellation_event.is_set():
                return ""
                
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error in sync follow-up generation: {str(e)}")
            raise

    async def health_check(self) -> Dict[str, str]:
        """
        Check if the Ollama service is healthy and responsive.

        Returns:
            Dictionary containing health status information
        """
        try:
            logger.info("[Career Ollama] Health check: Testing Ollama connection...")

            # Test with a simple prompt
            test_response = await self.generate_response("Hello", "health_check_session")

            if test_response.get("response"):
                result = {
                    "status": "healthy",
                    "model": self.model_name,
                    "base_url": self.base_url
                }
                logger.info(f"[Career Ollama] Health check: Returning healthy status: {result}")
                return result
            else:
                result = {
                    "status": "unhealthy",
                    "model": self.model_name,
                    "base_url": self.base_url,
                    "error": "No response from Ollama"
                }
                logger.warning(f"[Career Ollama] Health check: Returning unhealthy status: {result}")
                return result

        except Exception as e:
            result = {
                "status": "unhealthy",
                "model": self.model_name,
                "base_url": self.base_url,
                "error": str(e)
            }
            logger.error(f"[Career Ollama] Health check: Exception occurred: {e}")
            return result

    async def clear_memory(self, session_id: str = "default") -> bool:
        """
        Clear the conversation memory for a specific session.

        Args:
            session_id: Session identifier to clear

        Returns:
            True if memory was cleared successfully
        """
        try:
            if session_id in self.store:
                self.store[session_id].clear()
                logger.info(f"[Career Ollama] Conversation memory cleared for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"[Career Ollama] Error clearing memory: {str(e)}")
            return False

_chat_service = None

def get_chat_service():
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service