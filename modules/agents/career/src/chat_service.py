import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
import logging
from typing import Optional, List, Dict
import httpx
import json
from datetime import datetime
from sqlalchemy.orm import Session
from backend.db.database import SessionLocal
from backend.models.profile import UserProfile
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, model_name: str = "gemma3:latest", base_url: str = "http://localhost:11435"):
        self.model_name = model_name
        self.base_url = base_url
        self.store = {}

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
                
            # Check if this is a career insights request
            if user_id and db:
                # Create resume analyzer instance
                resume_analyzer = ResumeAnalyzer(self)
                
                # Detect intent
                intent = await resume_analyzer.detect_intent(user_message)
                
                # If requesting career insights, use streaming workflow
                if intent == "CAREER_INSIGHTS":
                    logger.info("Career insights request detected, using streaming workflow...")
                    streaming_analyzer = StreamingResumeAnalyzer(self)
                    
                    # Yield initial response
                    yield {
                        "type": "message",
                        "content": "I'll analyze your resume step by step and show you the results as each section completes. This will give you real-time insights into your professional profile.",
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    # Stream the analysis results
                    async for result in streaming_analyzer.analyze_resume_streaming(user_id):
                        yield result
                    
                    return
            
            # Get conversation history for context
            history = await self.get_conversation_history(session_id)
            
            # Get user profile data for personalized context
            profile_data = None
            if user_id and db:
                profile_data = await self.get_user_profile(user_id, db)
            
            # Build the system prompt with user profile context
            system_content = "You are a specialized career agent. Provide expert advice on career-related topics."
            
            print("profile_data=",profile_data)

            if profile_data:
                # Create a comprehensive profile summary for context
                profile_summary = self._format_profile_for_context(profile_data)
                system_content += f"\n\nUser Profile Context:\n{profile_summary}\n\nUse this profile information to provide personalized and relevant career advice."
            
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
                                    yield {
                                        "type": "complete",
                                        "content": full_response
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
                
                # Convert profile to dictionary, focusing on career-related fields
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
                    "education_level": profile.education_level,
                    "learning_goals": profile.learning_goals,
                    "preferred_learning_methods": profile.preferred_learning_methods
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
        Format user profile data into a readable context string for the LLM, focusing on career-related information.
        
        Args:
            profile_data: Dictionary containing user profile information
            
        Returns:
            Formatted string containing user profile context
        """
        context_parts = []
        covered_keys = set()
        
        # Career Information
        career_info = []
        for key, label in [
            ("current_job", "Current Job"),
            ("company", "Company"),
            ("industry", "Industry"),
            ("experience", "Experience Level")
        ]:
            if profile_data.get(key):
                career_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if career_info:
            context_parts.append("Career: " + ", ".join(career_info))
        
        # Skills and Competencies
        for key, label in [
            ("skills", "Technical Skills"),
            ("soft_skills", "Soft Skills"),
            ("certifications", "Certifications"),
            ("skill_gaps", "Skill Gaps"),
            ("professional_strengths", "Professional Strengths"),
            ("growth_areas", "Growth Areas")
        ]:
            if profile_data.get(key):
                value = profile_data[key]
                value_str = ", ".join(value) if isinstance(value, list) else value
                context_parts.append(f"{label}: {value_str}")
                covered_keys.add(key)
        
        # Goals and Aspirations
        for key, label in [
            ("career_goals", "Career Goals"),
            ("short_term_goals", "Short-term Goals"),
            ("career_path_preference", "Career Path Preference"),
            ("career_challenges", "Career Challenges")
        ]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        
        # Work Preferences
        work_prefs = []
        for key, label in [
            ("work_style", "Work Style"),
            ("leadership_experience", "Leadership Experience"),
            ("work_life_balance_priority", "Work-Life Balance Priority"),
            ("company_size_preference", "Company Size Preference"),
            ("career_risk_tolerance", "Career Risk Tolerance"),
            ("geographic_flexibility", "Geographic Flexibility"),
            ("work_values", "Work Values"),
            ("learning_preferences", "Learning Preferences"),
            ("preferred_learning_methods", "Preferred Learning Methods")
        ]:
            if profile_data.get(key):
                work_prefs.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if work_prefs:
            context_parts.append("Work Preferences: " + ", ".join(work_prefs))
        
        # Education and Learning
        for key, label in [
            ("education_level", "Education Level"),
            ("learning_goals", "Learning Goals")
        ]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        
        # Target Industries
        if profile_data.get("target_industries"):
            value = profile_data["target_industries"]
            value_str = ", ".join(value) if isinstance(value, list) else str(value)
            context_parts.append(f"Target Industries: {value_str}")
            covered_keys.add("target_industries")
        
        # Append any remaining keys that were not explicitly covered
        for key, value in profile_data.items():
            if key not in covered_keys and value:
                value_str = ", ".join(value) if isinstance(value, list) else str(value)
                context_parts.append(f"{key.replace('_', ' ').title()}: {value_str}")
        
        return "\n".join(context_parts) if context_parts else "No detailed profile information available."

_chat_service = None

def get_chat_service():
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service