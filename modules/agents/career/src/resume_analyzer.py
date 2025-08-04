"""Resume analysis service using LLM."""

import os
import sys
import logging
from typing import Dict, Any, Optional, List
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

import PyPDF2
from backend.db.database import SessionLocal
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from prompts import RESUME_ANALYSIS_SYSTEM_PROMPT, RESUME_ANALYSIS_PROMPT_TEMPLATE, INTENT_DETECTION_PROMPT
from chat_service import ChatService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ResumeAnalyzer:
    """Service for analyzing resumes and generating career insights using LLM."""
    
    def __init__(self, chat_service: Optional[ChatService] = None):
        """Initialize the resume analyzer service.
        
        Args:
            chat_service: Optional ChatService instance to use for LLM interactions
        """
        self.chat_service = chat_service or ChatService()
    
    async def detect_intent(self, user_message: str) -> str:
        """Detect if the user is requesting career insights.
        
        Args:
            user_message: The user's message
            
        Returns:
            'CAREER_INSIGHTS' or 'NORMAL_CONVERSATION'
        """
        try:
            prompt = INTENT_DETECTION_PROMPT.format(user_message=user_message)
            response = await self.chat_service.generate_response(prompt, "intent_detection")
            intent = response.get("response", "").strip()
            
            # Normalize the response
            if "CAREER_INSIGHTS" in intent:
                return "CAREER_INSIGHTS"
            return "NORMAL_CONVERSATION"
        except Exception as e:
            logger.error(f"Error detecting intent: {str(e)}")
            return "NORMAL_CONVERSATION"  # Default to normal conversation on error
    
    async def get_latest_resume(self, user_id: int) -> Optional[Resume]:
        """Get the most recently uploaded resume for a user.
        
        Args:
            user_id: The user's ID
            
        Returns:
            The most recent Resume object or None if not found
        """
        try:
            db = SessionLocal()
            latest_resume = (
                db.query(Resume)
                .filter(Resume.user_id == user_id)
                .order_by(Resume.created_at.desc())
                .first()
            )
            return latest_resume
        except Exception as e:
            logger.error(f"Error getting latest resume: {str(e)}")
            return None
        finally:
            db.close()
    
    async def read_resume_content(self, resume: Resume) -> Optional[str]:
        """Read the content of a resume file.
        
        Args:
            resume: The Resume object
            
        Returns:
            The content of the resume as a string, or None if error
        """
        try:
            if not resume or not resume.file_path:
                return None
                
            file_path = resume.file_path
            
            # For PDF files, use a PDF parser (simplified for this example)
            if file_path.lower().endswith('.pdf'):
                try:
                    with open(file_path, 'rb') as file:
                        reader = PyPDF2.PdfReader(file)
                        content = ""
                        for page in reader.pages:
                            content += page.extract_text() or ""
                    return content
                except Exception as e:
                    logger.error(f"Error parsing PDF file {file_path}: {str(e)}")
                    return None            
            # For text files, read directly
            elif file_path.lower().endswith('.txt'):
                with open(file_path, 'r', encoding='utf-8') as file:
                    return file.read()
            
            # For other file types
            else:
                logger.warning(f"Unsupported file type: {file_path}")
                return f"[UNSUPPORTED FILE TYPE: {file_path}]"
                
        except Exception as e:
            logger.error(f"Error reading resume content: {str(e)}")
            return None
    
    async def analyze_resume(self, resume_content: str) -> Optional[Dict[str, Any]]:
        """Analyze resume content using LLM and extract structured information.
        
        Args:
            resume_content: The content of the resume
            
        Returns:
            A dictionary containing structured professional data or None if error
        """
        try:
            if not resume_content:
                return None
            
            import datetime

            # Prepare the prompt with the resume content
            system_prompt = RESUME_ANALYSIS_SYSTEM_PROMPT
            
            current_date = datetime.datetime.now()
            current_year_month = f"{current_date.year}.{current_date.month:02d}"

            print("current_year_month=", current_year_month)
            
            prompt = RESUME_ANALYSIS_PROMPT_TEMPLATE.format(
                resume_content=resume_content,
                current_year=current_year_month
            )
            
            # Use the chat service to generate a response
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            # Format messages for Ollama
            formatted_prompt = self.chat_service._format_messages_for_ollama(messages)

            print("formatted_prompt=", formatted_prompt)
            
            # Generate response
            response = await self.chat_service.generate_response(formatted_prompt, "resume_analysis")
            response_text = response.get("response", "")
            print("response_text=", response_text)
            
            # Extract JSON from response
            try:
                # Find JSON content (it might be wrapped in ```json ... ``` or other markers)
                json_start = response_text.find('{')
                json_end = response_text.rfind('}')
                
                if json_start >= 0 and json_end >= 0:
                    json_str = response_text[json_start:json_end+1]
                    professional_data = json.loads(json_str)
                    return professional_data
                else:
                    logger.error("No JSON object found in LLM response")
                    return None
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing JSON from LLM response: {str(e)}")
                return None
                
        except Exception as e:
            logger.error(f"Error analyzing resume: {str(e)}")
            return None
    
    async def store_career_insight(self, user_id: int, resume_id: int, professional_data: Dict[str, Any]) -> Optional[CareerInsight]:
        """Store the generated career insight in the database.
        
        Args:
            user_id: The user's ID
            resume_id: The resume's ID
            professional_data: The structured professional data
            
        Returns:
            The created CareerInsight object or None if error
        """
        try:
            db = SessionLocal()
            
            # Create a new career insight
            career_insight = CareerInsight(
                user_id=user_id,
                resume_id=resume_id
            )
            career_insight.set_professional_data(professional_data)
            
            # Add to database and commit
            db.add(career_insight)
            db.commit()
            db.refresh(career_insight)
            
            logger.info(f"Stored career insight for user {user_id}, resume {resume_id}")
            return career_insight
            
        except Exception as e:
            logger.error(f"Error storing career insight: {str(e)}")
            if db:
                db.rollback()
            return None
        finally:
            if db:
                db.close()
    
    async def get_latest_career_insight(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get the most recent career insight for a user.
        
        Args:
            user_id: The user's ID
            
        Returns:
            The professional data from the most recent career insight, or None if not found
        """
        try:
            db = SessionLocal()
            latest_insight = (
                db.query(CareerInsight)
                .filter(CareerInsight.user_id == user_id)
                .order_by(CareerInsight.created_at.desc())
                .first()
            )
            
            if latest_insight:
                return latest_insight.get_professional_data()
            return None
            
        except Exception as e:
            logger.error(f"Error getting latest career insight: {str(e)}")
            return None
        finally:
            db.close()
    
    async def process_user_message(self, user_message: str, user_id: int) -> Dict[str, Any]:
        """Process a user message and generate career insights if requested.
        
        Args:
            user_message: The user's message
            user_id: The user's ID
            
        Returns:
            A dictionary containing the response type and data
        """
        try:
            # Detect if the user is requesting career insights
            intent = await self.detect_intent(user_message)
            print("intent=", intent)
            
            if intent == "CAREER_INSIGHTS":
                # Get the latest resume
                latest_resume = await self.get_latest_resume(user_id)
                
                if not latest_resume:
                    return {
                        "type": "normal_response",
                        "message": "I couldn't find any uploaded resumes. Please upload your resume first."
                    }
                
                # Read the resume content
                resume_content = await self.read_resume_content(latest_resume)

                print("resume_content=", resume_content)
                
                if not resume_content:
                    return {
                        "type": "normal_response",
                        "message": "I had trouble reading your resume. Please try uploading it again."
                    }
                
                # Analyze the resume
                professional_data = await self.analyze_resume(resume_content)
                
                if not professional_data:
                    return {
                        "type": "normal_response",
                        "message": "I encountered an issue analyzing your resume. Please try again later."
                    }
                
                # Store the career insight
                await self.store_career_insight(user_id, latest_resume.id, professional_data)
                
                # Return the professional data for display
                return {
                    "type": "career_insights",
                    "professional_data": professional_data,
                    "message": "I've analyzed your resume and generated career insights. You can view them in the Career Agent dashboard."
                }
            else:
                # For normal conversation, return None to indicate no special handling
                return {
                    "type": "normal_response",
                    "message": None  # Let the regular chat flow handle this
                }
                
        except Exception as e:
            logger.error(f"Error processing user message: {str(e)}")
            return {
                "type": "normal_response",
                "message": "I encountered an unexpected error. Please try again later."
            }