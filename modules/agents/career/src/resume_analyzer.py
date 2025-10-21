"""Resume analysis service using LLM."""

import os
import sys
import logging
from typing import Dict, Any, Optional, List
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from backend.services.document_parser_service import DocumentParserService
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
        db = None
        try:
            db = SessionLocal()
            latest_resume = (
                db.query(Resume)
                .filter(Resume.user_id == user_id)
                .order_by(Resume.created_at.desc())
                .first()
            )

            if latest_resume:
                logger.info(f"✅ Found latest resume for user_id={user_id}: {latest_resume.original_filename}")
            else:
                logger.warning(f"⚠️ No resume found for user_id={user_id}")

            return latest_resume
        except Exception as e:
            logger.error(f"❌ Error getting latest resume for user_id={user_id}: {str(e)}", exc_info=True)
            return None
        finally:
            if db is not None:
                db.close()
    
    async def get_resume_by_id(self, user_id: int, resume_id: int) -> Optional[Resume]:
        """Get a specific resume by ID for a user.
        
        Args:
            user_id: The user's ID
            resume_id: The specific resume ID
            
        Returns:
            The Resume object or None if not found
        """
        try:
            db = SessionLocal()
            resume = (
                db.query(Resume)
                .filter(Resume.user_id == user_id, Resume.id == resume_id)
                .first()
            )
            return resume
        except Exception as e:
            logger.error(f"Error getting resume by ID {resume_id}: {str(e)}")
            return None
        finally:
            db.close()
    
    async def read_resume_content(self, resume: Resume) -> Optional[str]:
        """Read the content of a resume file using unified document parser.
        Supports PDF, DOC, DOCX, and TXT formats.

        Args:
            resume: The Resume object

        Returns:
            The content of the resume as a string, or None if error
        """
        try:
            if not resume or not resume.file_path:
                logger.error("Resume or file path is missing")
                return None

            file_path = resume.file_path

            # Check if file exists
            if not os.path.exists(file_path):
                logger.error(f"Resume file not found: {file_path}")
                return None

            # Check if format is supported
            if not DocumentParserService.is_supported_format(file_path):
                logger.warning(f"Unsupported file format: {file_path}")
                return None

            # Parse document using unified parser
            content = DocumentParserService.parse_document(file_path)

            if content:
                logger.info(f"Successfully read resume content from {file_path} ({len(content)} characters)")
                return content
            else:
                logger.warning(f"No content extracted from resume: {file_path}")
                return None

        except FileNotFoundError as e:
            logger.error(f"File not found: {str(e)}")
            return None
        except ValueError as e:
            logger.error(f"Invalid file format: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error reading resume content: {str(e)}", exc_info=True)
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

            # Generate dashboard summaries using the same ChatService
            try:
                summaries = await self._generate_dashboard_summaries(professional_data)
                if summaries:
                    career_insight.set_dashboard_summaries(summaries)
                    db.commit()
                    logger.info(f"Generated and stored dashboard summaries for insight {career_insight.id}")
                else:
                    logger.warning(f"No summaries generated for insight {career_insight.id}")
            except Exception as summary_error:
                logger.warning(f"Failed to generate dashboard summaries: {summary_error}")
                # Don't fail the main operation if summary generation fails

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

    async def get_career_insight_by_resume(self, user_id: int, resume_id: int) -> Optional[Dict[str, Any]]:
        """Get career insight for a specific resume.
        
        Args:
            user_id: The user's ID (for ownership verification)
            resume_id: The resume's ID
            
        Returns:
            The professional data from the career insight for the specified resume, or None if not found
        """
        try:
            db = SessionLocal()
            career_insight = (
                db.query(CareerInsight)
                .filter(CareerInsight.user_id == user_id, CareerInsight.resume_id == resume_id)
                .order_by(CareerInsight.created_at.desc())
                .first()
            )
            
            if career_insight:
                return career_insight.get_professional_data()
            return None
            
        except Exception as e:
            logger.error(f"Error getting career insight for resume {resume_id}: {str(e)}")
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

    async def _generate_dashboard_summaries(self, professional_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Generate dashboard summaries for career insights using Career Agent's ChatService.
        This method is called internally after resume analysis to create concise summaries.

        Args:
            professional_data: The complete career analysis data

        Returns:
            Dictionary with summaries for each section
        """
        try:
            summaries = {}

            # Generate summaries for each section using the same ChatService
            summary_prompts = {
                'professional_identity': self._create_professional_identity_prompt,
                'work_experience': self._create_work_experience_prompt,
                'skills_analysis': self._create_skills_analysis_prompt,
                'market_position': self._create_market_position_prompt,
                'salary_analysis': self._create_salary_analysis_prompt
            }

            for section_key, prompt_creator in summary_prompts.items():
                mapped_key = self._get_section_mapping(section_key)
                section_data = professional_data.get(mapped_key)

                # Handle nested data structure - extract the inner data
                if section_data and isinstance(section_data, dict):
                    # If the data is nested (like {'professionalIdentity': {'professionalIdentity': {...}}})
                    if mapped_key in section_data:
                        section_data = section_data[mapped_key]

                if section_data:
                    try:
                        prompt = prompt_creator(section_data)
                        summary = await self._generate_section_summary(prompt)
                        if summary:
                            summaries[section_key] = summary
                        else:
                            # Fallback summary
                            summaries[section_key] = self._get_fallback_summary(section_key, section_data)
                    except Exception as e:
                        logger.warning(f"Failed to generate summary for {section_key}: {e}")
                        summaries[section_key] = self._get_fallback_summary(section_key, section_data)

            logger.info(f"Generated dashboard summaries for {len(summaries)} sections")
            return summaries

        except Exception as e:
            logger.error(f"Error generating dashboard summaries: {e}")
            return self._get_fallback_summaries(professional_data)

    def _get_section_mapping(self, section_key: str) -> str:
        """Map summary section keys to professional data keys"""
        mapping = {
            'professional_identity': 'professionalIdentity',
            'work_experience': 'workExperience',
            'skills_analysis': 'skillsAnalysis',
            'market_position': 'marketPosition',
            'salary_analysis': 'salaryAnalysis'
        }
        return mapping.get(section_key, section_key)

    async def _generate_section_summary(self, prompt: str) -> Optional[str]:
        """Generate a summary for a single section using ChatService"""
        try:
            system_prompt = "You are a professional career advisor. Generate exactly 3 bullet points using • symbol. Each bullet should be 6-8 words maximum. Be specific, direct, and impactful. No generic advice. Follow the exact format requested."

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]

            formatted_prompt = self.chat_service._format_messages_for_ollama(messages)
            response = await self.chat_service.generate_response(formatted_prompt, "insight_summary")
            summary = response.get("response", "").strip()

            if summary:
                return self._clean_summary_response(summary)

            return None

        except Exception as e:
            logger.error(f"Error generating section summary: {e}")
            return None

    def _clean_summary_response(self, summary: str) -> str:
        """Clean and format the LLM response to ensure exactly 3 bullet points"""
        try:
            # Remove common wrapper formatting
            summary = summary.strip('"').strip("'")
            summary = summary.replace('**', '').replace('*', '')

            # Remove introductory phrases more comprehensively
            # First, handle complex patterns with "based on" + something + "here are"
            complex_patterns = [
                r'based on.*?here are.*?:',
                r'here are.*?bullet points.*?:',
                r'the following are.*?:',
                r'three bullet points.*?:'
            ]

            import re
            for pattern in complex_patterns:
                summary = re.sub(pattern, '', summary, flags=re.IGNORECASE | re.DOTALL).strip()

            # Remove simple prefixes
            prefixes_to_remove = [
                'AI:', 'AI ', 'Here is ', 'Here\'s ', 'Summary: ', 'Answer: ', 'Response:', 'Result:',
                'Here are three bullet points', 'Here are 3 bullet points', 'The three bullet points are',
                'Below are three bullet points', 'Based on the data', 'Here are the bullet points',
                'Three bullet points summarizing', 'Here are three detailed bullet points',
                'The following are three bullet points', 'I\'ll provide three bullet points',
                'Here are three professional insights', 'Three key insights include',
                ', here are the bullet points:', 'here are the bullet points:'
            ]
            for prefix in prefixes_to_remove:
                if summary.lower().startswith(prefix.lower()):
                    summary = summary[len(prefix):].strip()

            # Clean up any remaining intro patterns with colons
            intro_patterns = [
                'summarizing the professional\'s profile:',
                'about this professional:',
                'for this candidate:',
                'regarding the professional:',
                'about their experience:',
                'for their profile:'
            ]
            for pattern in intro_patterns:
                if pattern in summary.lower():
                    # Split on the pattern and take everything after it
                    parts = summary.lower().split(pattern)
                    if len(parts) > 1:
                        # Reconstruct from original case but skip the intro part
                        original_parts = summary.split(pattern, 1)
                        if len(original_parts) > 1:
                            summary = original_parts[1].strip()

            # Clean up whitespace while preserving line breaks for bullets
            lines = summary.split('\n')
            cleaned_lines = []

            for line in lines:
                line = line.strip()
                if line and not line.lower().startswith('ai'):  # Skip AI: lines entirely
                    # Normalize bullet symbols to consistent format
                    if line.startswith('- '):
                        line = '• ' + line[2:]
                    elif line.startswith('* '):
                        line = '• ' + line[2:]
                    elif line.startswith('•'):
                        # Ensure space after bullet
                        if not line.startswith('• '):
                            line = '• ' + line[1:].strip()
                    else:
                        # Add bullet if line doesn't have one
                        line = '• ' + line

                    # Only add non-empty content lines
                    if len(line) > 2:  # More than just "• "
                        cleaned_lines.append(line)

            # Ensure exactly 3 bullet points
            if len(cleaned_lines) > 3:
                cleaned_lines = cleaned_lines[:3]
            elif len(cleaned_lines) < 3 and cleaned_lines:
                # If we have fewer than 3, try to split the content
                if len(cleaned_lines) == 1:
                    # Try to split single bullet into multiple
                    content = cleaned_lines[0][2:]  # Remove bullet
                    sentences = [s.strip() for s in content.split('.') if s.strip()]
                    if len(sentences) >= 3:
                        cleaned_lines = [f'• {sentences[i]}' for i in range(3)]
                    elif len(sentences) == 2:
                        # Add a generic third point
                        cleaned_lines = [f'• {sentences[0]}', f'• {sentences[1]}', '• Professional expertise in relevant domain']
                elif len(cleaned_lines) == 2:
                    # Add a generic third point
                    cleaned_lines.append('• Strong professional background and capabilities')

            # Join lines back together (exactly 3 bullets)
            if cleaned_lines:
                summary = '\n'.join(cleaned_lines[:3])
            else:
                # Fallback if no valid content found
                summary = '• Professional experience and expertise\n• Industry knowledge and skills\n• Strong career foundation'

            return summary

        except Exception as e:
            logger.error(f"Error cleaning summary response: {e}")
            return '• Professional experience and expertise\n• Industry knowledge and skills\n• Strong career foundation'

    def _create_professional_identity_prompt(self, identity_data: Dict[str, Any]) -> str:
        """Create prompt for professional identity summary"""
        title = identity_data.get('title', '')
        role = identity_data.get('currentRole', '')
        industry = identity_data.get('currentIndustry', '')
        company = identity_data.get('currentCompany', '')
        highlights = identity_data.get('keyHighlights', [])

        return f"""
        Based on this professional data, write exactly 3 bullet points (start each with •):

        Title: {title}
        Role: {role}
        Industry: {industry}
        Company: {company}
        Achievements: {'; '.join(highlights[:2]) if highlights else 'Professional experience'}

        Output format - ONLY the 3 bullet points, no introduction or explanation:
        • [Detailed sentence about current role, seniority level, and years of experience]
        • [Detailed sentence about industry specialization, domain expertise, and key areas]
        • [Detailed sentence about major achievements, impact, or unique value proposition]

        IMPORTANT: Your response must start immediately with the first bullet point. Do not include any introductory text.
        """

    def _create_work_experience_prompt(self, work_exp_data: Dict[str, Any]) -> str:
        """Create prompt for work experience summary"""
        total_years = work_exp_data.get('totalYears', 0)
        analytics = work_exp_data.get('analytics', {})
        companies = work_exp_data.get('companies', [])
        industries = work_exp_data.get('industries', [])

        # Get company names
        company_names = [comp.get('name', '') for comp in companies[:3]] if companies and isinstance(companies, list) else []
        # Safe handling of industries
        try:
            industry_names = list(set(str(ind) for ind in industries[:3])) if industries and isinstance(industries, list) else []
        except (TypeError, AttributeError):
            industry_names = []

        return f"""
        Based on this work experience data, write exactly 3 bullet points (start each with •):

        Experience: {total_years} years
        Companies: {', '.join(company_names[:2]) if company_names else 'Multiple firms'}
        Industries: {', '.join(industry_names[:2]) if industry_names else 'Various sectors'}

        Output format - ONLY the 3 bullet points, no introduction or explanation:
        • [Detailed sentence about {total_years} years of progressive experience, career growth, and advancement]
        • [Detailed sentence about company diversity, organizational types, or stability patterns across roles]
        • [Detailed sentence about industry breadth, sector expertise, or cross-functional capabilities developed]

        IMPORTANT: Your response must start immediately with the first bullet point. Do not include any introductory text.
        """

    def _create_skills_analysis_prompt(self, skills_data: Dict[str, Any]) -> str:
        """Create prompt for skills analysis summary"""
        hard_skills = skills_data.get('hardSkills', [])
        soft_skills = skills_data.get('softSkills', [])
        core_strengths = skills_data.get('coreStrengths', [])

        # Get top skills by level
        top_hard_skills = sorted(hard_skills, key=lambda x: x.get('level', 0), reverse=True)[:3]
        top_skills_names = [f"{skill.get('skill', '')} ({skill.get('level', 0)}%)" for skill in top_hard_skills]

        # Get core strength areas
        strength_areas = [strength.get('area', '') for strength in core_strengths[:2]]

        return f"""
        Based on this skills data, write exactly 3 bullet points (start each with •):

        Top Skills: {', '.join([skill.split('(')[0].strip() for skill in top_skills_names[:3]])}
        Expertise Areas: {', '.join(strength_areas[:2]) if strength_areas else 'Technical competencies'}
        Total Skills: {len(hard_skills)}

        Output format - ONLY the 3 bullet points, no introduction or explanation:
        • [Detailed sentence about top technical skills, proficiency levels, and practical application experience]
        • [Detailed sentence about specialized expertise areas, domain knowledge, and advanced capabilities]
        • [Detailed sentence about skill portfolio breadth, learning agility, and adaptability across technologies]

        IMPORTANT: Your response must start immediately with the first bullet point. Do not include any introductory text.
        """

    def _create_market_position_prompt(self, market_data: Dict[str, Any]) -> str:
        """Create prompt for market position summary"""
        competitiveness = market_data.get('competitiveness', 0)
        skill_relevance = market_data.get('skillRelevance', 0)
        industry_demand = market_data.get('industryDemand', 0)
        career_potential = market_data.get('careerPotential', 0)

        return f"""
        Based on this market position data, write exactly 3 bullet points (start each with •):

        Competitiveness: {competitiveness}%
        Skill Relevance: {skill_relevance}%
        Industry Demand: {industry_demand}%
        Career Potential: {career_potential}%

        Output format - ONLY the 3 bullet points, no introduction or explanation:
        • [Detailed sentence about {competitiveness}% market competitiveness, ranking vs peers, and competitive advantages]
        • [Detailed sentence about {skill_relevance}% skill relevance, current market demands, and expertise alignment]
        • [Detailed sentence about {career_potential}% growth potential, advancement opportunities, and future market trends]

        IMPORTANT: Your response must start immediately with the first bullet point. Do not include any introductory text.
        """
    def _create_salary_analysis_prompt(self, salary_data: Dict[str, Any]) -> str:
        """Create prompt for salary analysis summary"""
        current_salary = salary_data.get('currentSalary', {})
        market_comparison = salary_data.get('marketComparison', {})
        current_amount = current_salary.get('amount', 0)
        industry_avg = market_comparison.get('industryAverage', 0)
        percentile = market_comparison.get('percentile', 0)

        if industry_avg > 0:
            vs_market_pct = round((current_amount / industry_avg) * 100)
            position = "above" if vs_market_pct > 100 else "below" if vs_market_pct < 100 else "at"
        else:
            position = "aligned with"

        return f"""
        Based on this salary data, write exactly 3 bullet points (start each with •):

        Current: ${current_amount}K
        Market Average: ${industry_avg}K
        Percentile: {percentile}th
        Position: {position} market rate

        Output format - ONLY the 3 bullet points, no introduction or explanation:
        • [Detailed sentence about ${current_amount}K current salary, market positioning, and compensation competitive advantage]
        • [Detailed sentence about {percentile}th percentile ranking, comparison to ${industry_avg}K industry average, and peer performance]
        • [Detailed sentence about earning growth potential, advancement opportunities, and future compensation trajectory]

        IMPORTANT: Your response must start immediately with the first bullet point. Do not include any introductory text.
        """

    def _get_fallback_summary(self, section_key: str, section_data: Dict[str, Any]) -> str:
        """Generate fallback summary for a specific section"""
        fallback_generators = {
            'professional_identity': lambda data: f"• {data.get('currentRole', 'Professional')} in {data.get('currentIndustry', 'industry')}\n• Experienced industry professional\n• Strong professional background",
            'work_experience': lambda data: f"• {data.get('totalYears', 0)} years progressive experience\n• Proven career advancement\n• Strong professional track record",
            'skills_analysis': lambda data: f"• Strong technical foundation\n• {len(data.get('hardSkills', []))} core competencies\n• Diverse skill portfolio",
            'market_position': lambda data: f"• {data.get('competitiveness', 0)}% market competitiveness\n• Strong industry positioning\n• Competitive professional profile",
            'salary_analysis': lambda data: f"• ${data.get('currentSalary', {}).get('amount', 0)}K current compensation\n• Competitive market positioning\n• Strong earning potential"
        }

        generator = fallback_generators.get(section_key)
        if generator:
            return generator(section_data)
        return "Professional insights available in detailed analysis"

    def _get_fallback_summaries(self, professional_data: Dict[str, Any]) -> Dict[str, str]:
        """Generate all fallback summaries when LLM is unavailable"""
        summaries = {}

        for section_key in ['professional_identity', 'work_experience', 'skills_analysis', 'market_position', 'salary_analysis']:
            section_data = professional_data.get(self._get_section_mapping(section_key))
            if section_data:
                summaries[section_key] = self._get_fallback_summary(section_key, section_data)

        return summaries