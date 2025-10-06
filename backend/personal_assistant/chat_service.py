import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from langchain_ollama import OllamaLLM
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from typing import Dict, List, Optional
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
import httpx
import json
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models.resume import Resume
from models.chat import ChatMessage
from models.session import ChatSession
from models.user import User
from models.profile import UserProfile
from prompts import FOLLOW_UP_PROMPT, OPTIMIZE_QUERY_PROMPT

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatService:
    """
    Chat service that integrates with local Ollama LLM using Langchain.
    Provides conversational AI capabilities with memory management.
    """
    
    def __init__(self, model_name: str = "gemma3:latest", base_url: str = "http://localhost:11434"):
        """
        Initialize the chat service with Ollama LLM.
        
        Args:
            model_name: Name of the Ollama model to use
            base_url: Base URL of the Ollama server
        """
        self.model_name = model_name
        self.base_url = base_url
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.store = {}  # Session store for chat histories
        
        try:
            # Initialize Ollama LLM with new API
            self.llm = OllamaLLM(
                model=model_name,
                base_url=base_url,
                temperature=0.7,
                top_p=0.9,
                num_predict=2048,  # Max tokens to generate
                stop=["Human:", "Assistant:"]  # Stop sequences
            )
            
            # Create prompt template
            self.prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful AI assistant. Please provide helpful and accurate responses."),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{input}")
            ])
            
            # Create the runnable chain
            self.chain = self.prompt | self.llm
            
            # Create conversation chain with message history
            self.conversation = RunnableWithMessageHistory(
                self.chain,
                self.get_session_history,
                input_messages_key="input",
                history_messages_key="history",
            )
            
            logger.info(f"ChatService initialized with model: {model_name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChatService: {str(e)}")
            raise
    
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
        try:
            db = SessionLocal()
            # ``session_id`` is stored as Integer in the DB. Convert if needed.
            db_session_id = int(session_id) if isinstance(session_id, str) and session_id.isdigit() else session_id
            messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == db_session_id)
                .order_by(ChatMessage.id.asc())
                .all()
            )

            for msg in messages:
                # Distinguish between user and assistant messages.
                if msg.sender == "user":
                    history.add_message(HumanMessage(content=msg.message_text))
                else:
                    # Treat any non-user sender as assistant for robustness.
                    history.add_message(AIMessage(content=msg.message_text))
        except Exception as e:
            logger.error(f"Failed to load chat history from DB for session {session_id}: {str(e)}")
        finally:
            # Ensure DB session is closed even if an error occurs.
            try:
                db.close()
            except Exception:
                pass

        # Cache the reconstructed history for future calls.
        self.store[session_id] = history
        return history
    
    async def generate_response(self, user_message: str, session_id: Optional[str] = None, user_id: Optional[int] = None, db: Optional[Session] = None, cancellation_event: Optional[asyncio.Event] = None) -> Dict[str, str]:
        """
        Generate AI response for user message.
        
        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session
            cancellation_event: Optional event to signal cancellation
            
        Returns:
            Dictionary containing the AI response and metadata
        """
        try:
            logger.info(f"Generating response for message: {user_message[:50]}...")
            
            # Use default session if none provided
            if session_id is None:
                session_id = "default"
            
            # Check if request was cancelled before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled before processing")
            
            # Run the conversation in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get user profile data if user_id is provided
            profile_data = None
            if user_id and db:
                profile_data = await self.get_user_profile(user_id, db)
            
            # Create a task that can be cancelled
            task = loop.run_in_executor(
                self.executor,
                self._generate_sync_response,
                user_message,
                session_id,
                profile_data,
                cancellation_event
            )
            
            # Wait for either the task to complete or cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    
                    # Cancel any pending tasks to avoid "Task was destroyed but it is pending" errors
                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass
                    
                    # If cancellation event was set, cancel the task
                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        raise asyncio.CancelledError("Request was cancelled during processing")
                    
                    # Get the result from the completed task
                    response = await task
                finally:
                    # Ensure wait_task is cancelled if it wasn't already
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                response = await task
            
            # Generate follow-up questions after the main response
            follow_up_questions = await self.generate_follow_up_questions(
                user_message, response, session_id, profile_data, cancellation_event
            )
            
            return {
                "response": response,
                "follow_up_questions": follow_up_questions,
                "model": self.model_name,
                "session_id": session_id,
                "status": "success"
            }
            
        except asyncio.CancelledError:
            logger.info(f"Request cancelled for session: {session_id}")
            raise
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return {
                "response": "I apologize, but I'm having trouble processing your request right now. Please try again.",
                "model": self.model_name,
                "session_id": session_id,
                "status": "error",
                "error": str(e)
            }
    
    def _generate_sync_response(self, user_message: str, session_id: str = "default", profile_data: Optional[Dict[str, any]] = None, cancellation_event: Optional[asyncio.Event] = None) -> str:
        """
        Synchronous method to generate response using the conversation chain.
        
        Args:
            user_message: User's input message
            session_id: Session identifier for conversation context
            profile_data: Optional user profile data for personalized context
            cancellation_event: Optional event to check for cancellation
            
        Returns:
            AI-generated response string
        """
        try:
            # Check for cancellation before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")
            
            # Prepare input with profile context if available
            input_data = {"input": user_message}
            if profile_data:
                profile_context = self._format_profile_for_context(profile_data)
                # Add profile context to the input
                input_data["input"] = f"User Profile Context:\n{profile_context}\n\nUser Message: {user_message}"
            
            # Use the conversation chain to generate response with memory
            # Note: Unfortunately, we can't easily interrupt the LLM generation mid-stream
            # with the current langchain setup, but we can at least check before starting
            response = self.conversation.invoke(
                input_data,
                config={"configurable": {"session_id": session_id}}
            )
            
            # Check for cancellation after generation (in case it was a long operation)
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")
                
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error in sync response generation: {str(e)}")
            raise
    
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
                logger.info(f"Conversation memory cleared for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing memory: {str(e)}")
            return False
    
    async def remove_messages_after_index(self, session_id: str = "default", message_index: int = 0) -> bool:
        """
        Remove all messages after a specific index in the conversation history.
        
        Args:
            session_id: Session identifier
            message_index: Index after which to remove messages (0-based)
            
        Returns:
            True if messages were removed successfully
        """
        try:
            # Ensure we have the session history loaded; attempt to hydrate from the database
            if session_id not in self.store:
                try:
                    self.get_session_history(session_id)
                except Exception as e:
                    logger.error(f"Failed to hydrate history for session {session_id}: {str(e)}")
                    return True  # Cannot load history, treat as nothing to remove

            if session_id not in self.store:
                return True  # Still no messages to remove after hydration
            
            messages = self.store[session_id].messages
            if message_index < len(messages):
                # Keep only messages up to the specified index
                self.store[session_id].messages = messages[:message_index + 1]
                logger.info(f"Removed messages after index {message_index} for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error removing messages: {str(e)}")
            return False
    
    async def update_message_at_index(self, session_id: str = "default", message_index: int = 0, new_content: str = "") -> bool:
        """
        Update a specific message in the conversation history.
        
        Args:
            session_id: Session identifier
            message_index: Index of the message to update (0-based)
            new_content: New content for the message
            
        Returns:
            True if message was updated successfully
        """
        try:
            if session_id not in self.store:
                # Attempt to hydrate history so we can update correct messages
                try:
                    self.get_session_history(session_id)
                except Exception as e:
                    logger.error(f"Failed to hydrate history for session {session_id}: {str(e)}")
                    return True  # Cannot load history, treat as nothing to update

            if session_id not in self.store:
                return True  # Still no messages to update after hydration
                
            messages = self.store[session_id].messages
            if 0 <= message_index < len(messages):
                # Update the message content while preserving the message type
                if isinstance(messages[message_index], HumanMessage):
                    messages[message_index] = HumanMessage(content=new_content)
                elif isinstance(messages[message_index], AIMessage):
                    messages[message_index] = AIMessage(content=new_content)
                logger.info(f"Updated message at index {message_index} for session: {session_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating message: {str(e)}")
            return False
    
    async def get_conversation_history(self, session_id: str = "default") -> List[Dict[str, str]]:
        """
        Get the current conversation history for a specific session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of conversation messages
        """
        try:
            # Ensure the in-memory history exists; hydrate from DB if necessary
            if session_id not in self.store:
                # This call will load history from the persistent store into memory
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
                
                # Convert profile to dictionary, handling JSON fields
                profile_data = {
                    "current_job": profile.current_job,
                    "company": profile.company,
                    "industry": profile.industry,
                    "experience": profile.experience,
                    "work_style": profile.work_style,
                    "leadership_experience": profile.leadership_experience,
                    "skills": profile.skills,
                    "soft_skills": profile.soft_skills,
                    "certifications": profile.certifications,
                    "skill_gaps": profile.skill_gaps,
                    "short_term_goals": profile.short_term_goals,
                    "career_goals": profile.career_goals,
                    "career_path_preference": profile.career_path_preference,
                    "target_industries": profile.target_industries,
                    "work_life_balance_priority": profile.work_life_balance_priority,
                    "company_size_preference": profile.company_size_preference,
                    "career_risk_tolerance": profile.career_risk_tolerance,
                    "geographic_flexibility": profile.geographic_flexibility,
                    "work_values": profile.work_values,
                    "career_challenges": profile.career_challenges,
                    "professional_strengths": profile.professional_strengths,
                    "growth_areas": profile.growth_areas,
                    "learning_preferences": profile.learning_preferences,
                    "income_range": profile.income_range,
                    "financial_goals": profile.financial_goals,
                    "investment_experience": profile.investment_experience,
                    "risk_tolerance": profile.risk_tolerance,
                    "fitness_level": profile.fitness_level,
                    "health_goals": profile.health_goals,
                    "dietary_preferences": profile.dietary_preferences,
                    "exercise_preferences": profile.exercise_preferences,
                    "travel_style": profile.travel_style,
                    "preferred_destinations": profile.preferred_destinations,
                    "travel_budget": profile.travel_budget,
                    "travel_frequency": profile.travel_frequency,
                    "learning_style": profile.learning_style,
                    "personality_type": profile.personality_type,
                    "strengths": profile.strengths,
                    "areas_for_improvement": profile.areas_for_improvement,
                    "family_status": profile.family_status,
                    "relationship_goals": profile.relationship_goals,
                    "work_life_balance": profile.work_life_balance,
                    "hobbies": profile.hobbies,
                    "interests": profile.interests,
                    "creative_pursuits": profile.creative_pursuits,
                    "education_level": profile.education_level,
                    "learning_goals": profile.learning_goals,
                    "preferred_learning_methods": profile.preferred_learning_methods,
                    "spiritual_practices": profile.spiritual_practices,
                    "mindfulness_level": profile.mindfulness_level,
                    "stress_management": profile.stress_management
                }
                
                # Filter out None values to keep context clean
                profile_data = {k: v for k, v in profile_data.items() if v is not None}
                
                logger.info(f"Retrieved profile data for user_id: {user_id}")
                return profile_data
                
            finally:
                if should_close_db:
                    db.close()
                
        except Exception as e:
            logger.error(f"Error getting user profile: {str(e)}")
            return None
    
    def _format_profile_for_context(self, profile_data: Dict[str, any]) -> str:
        """
        Format user profile data into a readable context string for the LLM.
        
        Args:
            profile_data: Dictionary containing user profile information
            
        Returns:
            Formatted string containing user profile context
        """
        context_parts = []
        covered_keys = set()
        # Career Information
        career_info = []
        for key,label in [
            ("current_job","Current Job"),
            ("company","Company"),
            ("industry","Industry"),
            ("experience","Experience Level")]:
            if profile_data.get(key):
                career_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if career_info:
            context_parts.append("Career: " + ", ".join(career_info))
        # Skills and Competencies
        for key,label in [
            ("skills","Technical Skills"),
            ("soft_skills","Soft Skills"),
            ("certifications","Certifications"),
            ("skill_gaps","Skill Gaps"),
            ("professional_strengths","Professional Strengths"),
            ("growth_areas","Growth Areas")]:
            if profile_data.get(key):
                value = profile_data[key]
                value_str = ", ".join(value) if isinstance(value,list) else value
                context_parts.append(f"{label}: {value_str}")
                covered_keys.add(key)
        # Goals and Aspirations
        for key,label in [
            ("career_goals","Career Goals"),
            ("short_term_goals","Short-term Goals"),
            ("career_path_preference","Career Path Preference"),
            ("career_challenges","Career Challenges")]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        # Personal Information
        personal_info = []
        for key,label in [
            ("personality_type","Personality Type"),
            ("learning_style","Learning Style"),
            ("education_level","Education")]:
            if profile_data.get(key):
                personal_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if personal_info:
            context_parts.append("Personal: " + ", ".join(personal_info))
        # Interests and Hobbies
        for key,label in [
            ("hobbies","Hobbies"),
            ("interests","Interests"),
            ("creative_pursuits","Creative Pursuits")]:
            if profile_data.get(key):
                value = profile_data[key]
                value_str = ", ".join(value) if isinstance(value,list) else str(value)
                context_parts.append(f"{label}: {value_str}")
                covered_keys.add(key)
        # Lifestyle Preferences
        lifestyle_info = []
        for key,label in [
            ("fitness_level","Fitness Level"),
            ("health_goals","Health Goals"),
            ("dietary_preferences","Dietary Preferences"),
            ("exercise_preferences","Exercise Preferences"),
            ("travel_style","Travel Style"),
            ("preferred_destinations","Preferred Destinations"),
            ("travel_budget","Travel Budget"),
            ("travel_frequency","Travel Frequency"),
            ("family_status","Family Status"),
            ("work_life_balance","Work-Life Balance")]:
            if profile_data.get(key):
                lifestyle_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if lifestyle_info:
            context_parts.append("Lifestyle: " + ", ".join(lifestyle_info))
        # Financial Information
        for key,label in [
            ("income_range","Income Range"),
            ("financial_goals","Financial Goals"),
            ("investment_experience","Investment Experience"),
            ("risk_tolerance","Risk Tolerance")]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        # Work Preferences
        work_prefs = []
        for key,label in [
            ("work_style","Work Style"),
            ("leadership_experience","Leadership Experience"),
            ("work_life_balance_priority","Work-Life Balance Priority"),
            ("company_size_preference","Company Size Preference"),
            ("career_risk_tolerance","Career Risk Tolerance"),
            ("geographic_flexibility","Geographic Flexibility"),
            ("work_values","Work Values"),
            ("learning_preferences","Learning Preferences"),
            ("preferred_learning_methods","Preferred Learning Methods")]:
            if profile_data.get(key):
                work_prefs.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if work_prefs:
            context_parts.append("Work Preferences: " + ", ".join(work_prefs))
        # Spiritual / Mindfulness
        for key,label in [
            ("spiritual_practices","Spiritual Practices"),
            ("mindfulness_level","Mindfulness Level"),
            ("stress_management","Stress Management")]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        # Relationship Goals
        if profile_data.get("relationship_goals"):
            context_parts.append(f"Relationship Goals: {profile_data['relationship_goals']}")
            covered_keys.add("relationship_goals")
        # Append any remaining keys that were not explicitly covered
        for key,value in profile_data.items():
            if key not in covered_keys and value:
                value_str = ", ".join(value) if isinstance(value,list) else str(value)
                context_parts.append(f"{key.replace('_',' ').title()}: {value_str}")
        return "\n".join(context_parts) if context_parts else "No detailed profile information available."
    
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
            
            # Build the system prompt with user profile context
            system_content = "You are a helpful AI personal assistant. Please provide helpful, accurate, and personalized responses."
            
            print("profile_data=",profile_data)

            if profile_data:
                # Create a comprehensive profile summary for context
                profile_summary = self._format_profile_for_context(profile_data)
                system_content += f"\n\nUser Profile Context:\n{profile_summary}\n\nUse this profile information to provide personalized and relevant responses."
            
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
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    
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
                "Can you provide more details about this?",
                "What are the next steps I should take?",
                "Are there any alternatives I should consider?"
            ]
    
    async def optimize_query(self, user_query: str, cancellation_event: Optional[asyncio.Event] = None) -> Dict[str, str]:
        """
        Optimize user query to make it clearer and more structured for better AI understanding.
        
        Args:
            user_query: Original user query to optimize
            cancellation_event: Optional event to signal cancellation
            
        Returns:
            Dictionary containing the optimized query and metadata
        """
        try:
            logger.info(f"Optimizing query: {user_query[:50]}...")
            
            # Check if request was cancelled before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled before processing")
            
            # Format the optimization prompt
            optimization_prompt = OPTIMIZE_QUERY_PROMPT.format(user_query=user_query)
            
            # Run the optimization in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create a task that can be cancelled
            task = loop.run_in_executor(
                self.executor,
                self._optimize_sync_query,
                optimization_prompt,
                cancellation_event
            )
            
            # Wait for either the task to complete or cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    
                    # Cancel any pending tasks
                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass
                    
                    # If cancellation event was set, cancel the task
                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        raise asyncio.CancelledError("Request was cancelled during processing")
                    
                    # Get the result from the completed task
                    optimized_query = await task
                finally:
                    # Ensure wait_task is cancelled if it wasn't already
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                optimized_query = await task
            
            return {
                "original_query": user_query,
                "optimized_query": optimized_query,
                "model": self.model_name,
                "status": "success"
            }
            
        except asyncio.CancelledError:
            logger.info("Query optimization cancelled")
            raise
        except Exception as e:
            logger.error(f"Error optimizing query: {str(e)}")
            return {
                "original_query": user_query,
                "optimized_query": user_query,  # Return original on error
                "model": self.model_name,
                "status": "error",
                "error": str(e)
            }
    
    def _optimize_sync_query(self, optimization_prompt: str, cancellation_event: Optional[asyncio.Event] = None) -> str:
        """
        Synchronous method to optimize query using the LLM.
        
        Args:
            optimization_prompt: Formatted prompt for query optimization
            cancellation_event: Optional event to check for cancellation
            
        Returns:
            Optimized query string
        """
        try:
            # Check for cancellation before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")
            
            # Use the LLM directly for optimization (no conversation history needed)
            response = self.llm.invoke(optimization_prompt)
            
            # Check for cancellation after generation
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")
            
            # Clean up the response - remove any extra formatting
            optimized_query = response.strip()
            
            # Remove common prefixes that might be added by the LLM
            prefixes_to_remove = [
                "Optimized Query:",
                "Optimized:",
                "Here's the optimized query:",
                "The optimized query is:"
            ]
            
            for prefix in prefixes_to_remove:
                if optimized_query.startswith(prefix):
                    optimized_query = optimized_query[len(prefix):].strip()
                    break

            # Remove wrapping quotation marks that the LLM might add
            import re
            optimized_query = optimized_query.strip()
            optimized_query = re.sub(r'^[\"“\'`]+', '', optimized_query)
            optimized_query = re.sub(r'[\"”\'`]+$', '', optimized_query)

            return optimized_query
            
        except Exception as e:
            logger.error(f"Error in sync query optimization: {str(e)}")
            raise
    
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
    
    def _parse_follow_up_questions(self, questions_text: str) -> List[str]:
        """
        Parse the generated follow-up questions text into a list of questions.
        
        Args:
            questions_text: Raw text containing the generated questions
            
        Returns:
            List of parsed follow-up questions
        """
        try:
            questions = []
            lines = questions_text.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                # Look for numbered questions (1., 2., 3. or 1), 2), 3))
                if line and (line.startswith(('1.', '2.', '3.', '1)', '2)', '3)')) or 
                           any(line.startswith(f'{i}.') or line.startswith(f'{i})') for i in range(1, 4))):
                    # Remove the number and clean up the question
                    question = line
                    # Remove leading numbers and punctuation
                    for prefix in ['1.', '2.', '3.', '1)', '2)', '3)']:
                        if question.startswith(prefix):
                            question = question[len(prefix):].strip()
                            break
                    
                    if question and len(question) > 5:  # Ensure it's a meaningful question
                        questions.append(question)
            
            # If we couldn't parse exactly 3 questions, try a different approach
            if len(questions) != 3:
                # Split by common delimiters and try to extract questions
                all_text = questions_text.replace('\n', ' ').strip()
                # Look for question patterns
                import re
                question_patterns = re.findall(r'[1-3][.)][^1-3]*(?=[1-3][.)]|$)', all_text)
                
                if question_patterns:
                    questions = []
                    for pattern in question_patterns[:3]:  # Take only first 3
                        # Clean up the question
                        question = re.sub(r'^[1-3][.)]\s*', '', pattern).strip()
                        if question and len(question) > 5:
                            questions.append(question)
            
            # Ensure we have exactly 3 questions, pad with defaults if needed
            while len(questions) < 3:
                default_questions = [
                    "Can you explain this in more detail?",
                    "What should I do next?",
                    "Are there other options to consider?"
                ]
                questions.append(default_questions[len(questions)])
            
            # Limit to exactly 3 questions
            return questions[:3]
            
        except Exception as e:
            logger.error(f"Error parsing follow-up questions: {str(e)}")
            # Return default questions if parsing fails
            return [
                "Can you provide more details about this?",
                "What are the next steps I should take?",
                "Are there any alternatives I should consider?"
            ]
    
    async def health_check(self) -> Dict[str, str]:
        """
        Check if the LLM service is healthy and responsive.
        
        Returns:
            Health status information
        """
        try:
            # Test with a simple prompt to verify Ollama connection
            logger.info("Health check: Testing Ollama connection...")
            test_response = await self.generate_response("Hello")
            logger.info(f"Health check: Test response received: {test_response}")
            
            if test_response["status"] == "success":
                result = {
                    "status": "healthy",
                    "model": self.model_name,
                    "base_url": self.base_url
                }
                logger.info(f"Health check: Returning healthy status: {result}")
                return result
            else:
                result = {
                    "status": "unhealthy",
                    "model": self.model_name,
                    "base_url": self.base_url,
                    "error": test_response.get("error", "Unknown error")
                }
                logger.warning(f"Health check: Returning unhealthy status: {result}")
                return result
                
        except Exception as e:
            result = {
                "status": "unhealthy",
                "model": self.model_name,
                "base_url": self.base_url,
                "error": str(e)
            }
            logger.error(f"Health check: Exception occurred: {e}")
            logger.error(f"Health check: Returning error status: {result}")
            return result

# Global chat service instance
chat_service = None

def get_chat_service() -> ChatService:
    """
    Get or create the global chat service instance.
    
    Returns:
        ChatService instance
    """
    global chat_service
    if chat_service is None:
        chat_service = ChatService()
    return chat_service
