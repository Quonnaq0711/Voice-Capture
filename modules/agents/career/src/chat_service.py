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
import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from backend.db.database import SessionLocal
from backend.models.profile import UserProfile
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from prompts import FOLLOW_UP_PROMPT

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get Ollama URL from environment variable, fallback to localhost for local development
DEFAULT_CAREER_OLLAMA_URL = os.getenv("CAREER_OLLAMA_URL", "http://ollama2-staging:11434")

class ChatService:
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
                db = SessionLocal()
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

    def _format_career_insights_for_context(self, insights_data: Dict[str, any]) -> str:
        """
        Format career insights data into a readable context string for the LLM.
        
        Args:
            insights_data: Dictionary containing career insights from resume analysis
            
        Returns:
            Formatted string containing career insights context
        """
        context_parts = []
        
        try:
            # Professional Identity - handle nested structure
            prof_identity = insights_data.get('professionalIdentity')
            if prof_identity:
                # Check if it's nested (professionalIdentity.professionalIdentity)
                if isinstance(prof_identity, dict) and 'professionalIdentity' in prof_identity:
                    identity = prof_identity['professionalIdentity']
                else:
                    identity = prof_identity
                
                if isinstance(identity, dict):
                    if identity.get('title'):
                        context_parts.append(f"Professional Identity: {identity['title']}")
                    if identity.get('summary'):
                        context_parts.append(f"Career Summary: {identity['summary']}")
                    if identity.get('currentRole'):
                        context_parts.append(f"Current Role: {identity['currentRole']}")
                    if identity.get('currentCompany'):
                        context_parts.append(f"Current Company: {identity['currentCompany']}")
            
            # Work Experience - handle nested structure
            work_exp_data = insights_data.get('workExperience')
            if work_exp_data:
                # Check if it's nested (workExperience.workExperience)
                if isinstance(work_exp_data, dict) and 'workExperience' in work_exp_data:
                    work_exp = work_exp_data['workExperience']
                else:
                    work_exp = work_exp_data
                
                if isinstance(work_exp, dict):
                    if work_exp.get('totalYears'):
                        context_parts.append(f"Total Experience: {work_exp['totalYears']} years")
                    
                    # Extract companies information
                    if work_exp.get('companies') and isinstance(work_exp['companies'], list):
                        companies = [comp.get('company', comp.get('name', '')) for comp in work_exp['companies'][:3]]
                        if companies:
                            context_parts.append(f"Recent Companies: {', '.join(filter(None, companies))}")
                        
                        # Extract current role from most recent company
                        if work_exp['companies'] and work_exp['companies'][0].get('role'):
                            context_parts.append(f"Current Role: {work_exp['companies'][0]['role']}")
                    
                    # Extract analytics insights
                    if work_exp.get('analytics') and isinstance(work_exp['analytics'], dict):
                        analytics = work_exp['analytics']
                        
                        # Add role insights
                        if analytics.get('heldRoles') and isinstance(analytics['heldRoles'], dict):
                            roles = analytics['heldRoles']
                            if roles.get('count'):
                                context_parts.append(f"Roles Held: {roles['count']}")
                        
                        # Add tenure insights
                        if analytics.get('insights') and isinstance(analytics['insights'], dict):
                            insights = analytics['insights']
                            if insights.get('averageRoleDuration'):
                                context_parts.append(f"Average Role Duration: {insights['averageRoleDuration']}")
                    
                    # Extract industries information
                    if work_exp.get('industries') and isinstance(work_exp['industries'], list) and work_exp['industries']:
                        industries = [ind.get('name', '') for ind in work_exp['industries']]
                        if industries:
                            context_parts.append(f"Industries: {', '.join(filter(None, industries))}")
            
            # Salary Analysis - handle nested structure
            salary_data = insights_data.get('salaryAnalysis')
            if salary_data:
                # Check if it's nested (salaryAnalysis.salaryAnalysis)
                if isinstance(salary_data, dict) and 'salaryAnalysis' in salary_data:
                    salary_analysis = salary_data['salaryAnalysis']
                else:
                    salary_analysis = salary_data
                
                if isinstance(salary_analysis, dict):
                    # Extract current salary
                    current_salary = salary_analysis.get('currentSalary')
                    if current_salary and isinstance(current_salary, dict):
                        amount = current_salary.get('amount')
                        currency = current_salary.get('currency', 'USD')
                        confidence = current_salary.get('confidence')
                        if amount:
                            salary_str = f"Current Salary: {amount}k {currency}"
                            if confidence:
                                salary_str += f" (Confidence: {confidence}%)"
                            context_parts.append(salary_str)
                    
                    # Extract market comparison
                    market_comp = salary_analysis.get('marketComparison')
                    if market_comp and isinstance(market_comp, dict):
                        industry_avg = market_comp.get('industryAverage')
                        percentile = market_comp.get('percentile')
                        if industry_avg:
                            context_parts.append(f"Industry Average Salary: {industry_avg}k {currency}")
                        if percentile:
                            context_parts.append(f"Salary Percentile: {percentile}th percentile")
                    
                    # Extract salary growth trend
                    historical = salary_analysis.get('historicalTrend')
                    if historical and isinstance(historical, list) and len(historical) >= 2:
                        first_year = historical[0]
                        last_year = historical[-1]
                        if first_year.get('salary') and last_year.get('salary') and first_year.get('year') and last_year.get('year'):
                            years_diff = last_year['year'] - first_year['year']
                            if years_diff > 0:
                                growth_rate = ((last_year['salary'] / first_year['salary']) ** (1/years_diff) - 1) * 100
                                context_parts.append(f"Historical Salary Growth: {growth_rate:.1f}% annually over {years_diff} years")
                    
                    # Extract future projections
                    projections = salary_analysis.get('projectedGrowth')
                    if projections and isinstance(projections, list) and projections:
                        last_projection = projections[-1]
                        if last_projection.get('salary') and last_projection.get('year') and last_projection.get('role'):
                            context_parts.append(f"Projected Salary ({last_projection['year']}): {last_projection['salary']}k as {last_projection['role']}")
                    
                    # Extract top recommendation
                    recommendations = salary_analysis.get('recommendations')
                    if recommendations and isinstance(recommendations, list) and recommendations:
                        top_rec = recommendations[0]
                        if top_rec.get('strategy'):
                            context_parts.append(f"Salary Growth Recommendation: {top_rec['strategy']}")
            
            # Skills Analysis - handle nested structure
            skills_data = insights_data.get('skillsAnalysis')
            if skills_data:
                # Check if it's nested (skillsAnalysis.skillsAnalysis)
                if isinstance(skills_data, dict) and 'skillsAnalysis' in skills_data:
                    skills = skills_data['skillsAnalysis']
                else:
                    skills = skills_data
                
                if isinstance(skills, dict):
                    # Core Strengths
                    if skills.get('coreStrengths') and isinstance(skills['coreStrengths'], list):
                        # Extract top strengths with scores if available
                        strengths = []
                        for strength in skills['coreStrengths'][:5]:
                            if isinstance(strength, dict):
                                area = strength.get('area')
                                score = strength.get('score')
                                if area:
                                    if score:
                                        strengths.append(f"{area} ({score}/100)")
                                    else:
                                        strengths.append(area)
                            elif strength:
                                strengths.append(strength)
                        
                        if strengths:
                            context_parts.append(f"Core Strengths: {', '.join(filter(None, strengths))}")
                    
                    # Hard Skills
                    if skills.get('hardSkills') and isinstance(skills['hardSkills'], list):
                        # Extract top hard skills with levels if available
                        hard_skills = []
                        for skill in skills['hardSkills'][:5]:
                            if isinstance(skill, dict):
                                skill_name = skill.get('skill')
                                level = skill.get('level')
                                category = skill.get('category')
                                if skill_name:
                                    if level:
                                        hard_skills.append(f"{skill_name} ({level}/100)")
                                    else:
                                        hard_skills.append(skill_name)
                            elif skill:
                                hard_skills.append(skill)
                        
                        if hard_skills:
                            context_parts.append(f"Technical Skills: {', '.join(filter(None, hard_skills))}")
                    
                    # Soft Skills
                    if skills.get('softSkills') and isinstance(skills['softSkills'], list):
                        # Extract top soft skills with current levels
                        soft_skills = []
                        for skill in skills['softSkills'][:5]:
                            if isinstance(skill, dict):
                                skill_name = skill.get('skill')
                                current = skill.get('current')
                                target = skill.get('target')
                                if skill_name:
                                    if current is not None:
                                        soft_skills.append(f"{skill_name} (Current: {current})")
                                    else:
                                        soft_skills.append(skill_name)
                            elif skill:
                                soft_skills.append(skill)
                        
                        if soft_skills:
                            context_parts.append(f"Soft Skills: {', '.join(filter(None, soft_skills))}")
                    
                    # Development Areas
                    if skills.get('developmentAreas') and isinstance(skills['developmentAreas'], list):
                        # Extract development areas with priorities if available
                        dev_areas = []
                        for area in skills['developmentAreas'][:3]:
                            if isinstance(area, dict):
                                area_name = area.get('area')
                                priority = area.get('priority')
                                if area_name:
                                    if priority:
                                        dev_areas.append(f"{area_name} ({priority} priority)")
                                    else:
                                        dev_areas.append(area_name)
                            elif area:
                                dev_areas.append(area)
                        
                        if dev_areas:
                            context_parts.append(f"Development Areas: {', '.join(filter(None, dev_areas))}")
            
            # Market Position - handle nested structure
            market_data = insights_data.get('marketPosition')
            if market_data:
                # Check if it's nested (marketPosition.marketPosition)
                if isinstance(market_data, dict) and 'marketPosition' in market_data:
                    market_pos = market_data['marketPosition']
                else:
                    market_pos = market_data
                
                if isinstance(market_pos, dict):
                    market_info = []
                    if market_pos.get('competitiveness'):
                        market_info.append(f"Competitiveness: {market_pos['competitiveness']}%")
                    if market_pos.get('skillRelevance'):
                        market_info.append(f"Skill Relevance: {market_pos['skillRelevance']}%")
                    if market_pos.get('industryDemand'):
                        market_info.append(f"Industry Demand: {market_pos['industryDemand']}%")
                    if market_pos.get('careerPotential'):
                        market_info.append(f"Career Potential: {market_pos['careerPotential']}%")
                    
                    if market_info:
                        context_parts.append(f"Market Position: {', '.join(market_info)}")
            
            return "\n".join(context_parts) if context_parts else "No career insights available from recent resume analysis."
            
        except Exception as e:
            logger.error(f"Error formatting career insights: {str(e)}")
            return "Error processing career insights data."

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
                # Split by lines and look for any line that looks like a question
                questions = []
                for line in lines:
                    line = line.strip()
                    if line and ('?' in line or line.endswith('?')):
                        # Clean up common prefixes
                        for prefix in ['1.', '2.', '3.', '1)', '2)', '3)', '-', '*']:
                            if line.startswith(prefix):
                                line = line[len(prefix):].strip()
                                break
                        if line and len(line) > 5:
                            questions.append(line)
                            if len(questions) >= 3:
                                break
            
            # Ensure we have exactly 3 questions, pad with defaults if needed
            while len(questions) < 3:
                default_questions = [
                    "Can you provide more details about this career advice?",
                    "What are the next steps I should take in my career?",
                    "Are there any alternative career paths I should consider?"
                ]
                questions.append(default_questions[len(questions)])
            
            # Return only the first 3 questions
            return questions[:3]
            
        except Exception as e:
            logger.error(f"Error parsing follow-up questions: {str(e)}")
            # Return default questions if parsing fails
            return [
                "Can you provide more details about this career advice?",
                "What are the next steps I should take in my career?",
                "Are there any alternative career paths I should consider?"
            ]

_chat_service = None

def get_chat_service():
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service