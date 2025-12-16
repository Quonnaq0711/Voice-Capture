"""
Base Chat Service Abstract Class for Career Agent

This module defines the abstract base class for Career Agent chat services, providing
a unified interface for different LLM implementations (Ollama, vLLM, OpenAI, etc.).

Design Pattern: Abstract Factory Pattern
SOLID Principles: Dependency Inversion Principle
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, AsyncIterator, Any
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class BaseChatService(ABC):
    """
    Abstract base class for Career Agent chat services.

    This class defines the interface that all chat service implementations must follow.
    It ensures consistency across different LLM providers (Ollama, vLLM, OpenAI, etc.)
    and enables easy switching between implementations at runtime.

    Key Methods:
    - generate_response: Generate a standard AI response
    - generate_streaming_response: Generate streaming AI response (SSE)
    - generate_follow_up_questions: Generate contextual follow-up questions
    - health_check: Check service health status
    - clear_memory: Clear conversation history
    - get_conversation_history: Retrieve conversation history
    - get_user_profile: Retrieve user profile data
    - get_latest_career_insights: Retrieve career insights from resume analysis (Career-specific)
    """

    @abstractmethod
    async def generate_response(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> Dict[str, Any]:
        """
        Generate AI response for user message.

        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session for profile queries
            cancellation_event: Optional event to signal cancellation

        Returns:
            Dictionary containing:
            - response: AI-generated response text
            - follow_up_questions: List of suggested follow-up questions
            - model: Model name used for generation
            - session_id: Session identifier
            - status: "success" or "error"
            - error: Optional error message

        Raises:
            asyncio.CancelledError: If request is cancelled
            Exception: For other errors
        """
        pass

    @abstractmethod
    async def generate_streaming_response(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Generate streaming AI response for user message using Server-Sent Events.

        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session for profile queries

        Yields:
            Dictionary chunks with:
            - type: "token", "complete", or "error"
            - content: Token text or full response
            - follow_up_questions: List of questions (only in "complete" type)

        Raises:
            Exception: For streaming errors
        """
        pass

    @abstractmethod
    async def generate_follow_up_questions(
        self,
        user_message: str,
        ai_response: str,
        session_id: str = "default",
        profile_data: Optional[Dict[str, Any]] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> List[str]:
        """
        Generate contextual follow-up questions based on conversation.

        Args:
            user_message: Original user message
            ai_response: AI's response to the user message
            session_id: Session identifier
            profile_data: Optional user profile data for personalization
            cancellation_event: Optional event to check for cancellation

        Returns:
            List of 3 follow-up questions

        Raises:
            Exception: For generation errors
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, str]:
        """
        Check if the LLM service is healthy and responsive.

        Returns:
            Dictionary containing:
            - status: "healthy" or "unhealthy"
            - model: Model name
            - base_url: Service base URL
            - error: Optional error message (if unhealthy)

        Raises:
            Exception: For health check errors
        """
        pass

    @abstractmethod
    async def clear_memory(self, session_id: str = "default") -> bool:
        """
        Clear the conversation memory for a specific session.

        Args:
            session_id: Session identifier to clear

        Returns:
            True if memory was cleared successfully

        Raises:
            Exception: For clearing errors
        """
        pass

    @abstractmethod
    async def get_conversation_history(
        self,
        session_id: str = "default"
    ) -> List[Dict[str, str]]:
        """
        Get the current conversation history for a specific session.

        Args:
            session_id: Session identifier

        Returns:
            List of conversation messages with:
            - role: "user" or "assistant"
            - content: Message content

        Raises:
            Exception: For history retrieval errors
        """
        pass

    @abstractmethod
    async def get_user_profile(
        self,
        user_id: int,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get user profile data from database for personalized context.

        Args:
            user_id: User ID to fetch profile for
            db: Optional database session to use

        Returns:
            Dictionary containing user profile data or None if not found

        Raises:
            Exception: For profile retrieval errors
        """
        pass

    @abstractmethod
    async def get_latest_career_insights(
        self,
        user_id: int,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the latest career insights from database (Career Agent specific).

        Args:
            user_id: User ID to fetch career insights for
            db: Optional database session to use

        Returns:
            Dictionary containing latest career insights data or None if not found

        Raises:
            Exception: For insights retrieval errors
        """
        pass

    # Common utility method (can be overridden but has default implementation)
    def _format_profile_for_context(self, profile_data: Dict[str, Any]) -> str:
        """
        Format user profile data into a readable context string for the LLM.

        This method can be overridden by subclasses but provides a sensible default
        focused on career-related information.

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

        # Append any remaining keys
        for key, value in profile_data.items():
            if key not in covered_keys and value:
                value_str = ", ".join(value) if isinstance(value, list) else str(value)
                context_parts.append(f"{key.replace('_', ' ').title()}: {value_str}")

        return "\n".join(context_parts) if context_parts else "No detailed profile information available."

    def _format_career_insights_for_context(self, insights_data: Dict[str, Any]) -> str:
        """
        Format career insights data into a readable context string for the LLM.

        This method can be overridden by subclasses but provides a sensible default
        for formatting career insights from resume analysis.

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

                    # Extract nested market position data (new structure)
                    market_pos = identity.get('marketPosition')
                    if market_pos and isinstance(market_pos, dict):
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

            # Education Background - handle nested structure
            edu_data = insights_data.get('educationBackground')
            if edu_data:
                # Check if it's nested (educationBackground.educationBackground)
                if isinstance(edu_data, dict) and 'educationBackground' in edu_data:
                    education = edu_data['educationBackground']
                else:
                    education = edu_data

                if isinstance(education, dict):
                    # Highest degree and total years
                    if education.get('highestDegree'):
                        edu_str = f"Education: {education['highestDegree']}"
                        if education.get('totalYearsOfEducation'):
                            edu_str += f" ({education['totalYearsOfEducation']} years)"
                        context_parts.append(edu_str)

                    # Education timeline - extract key institutions
                    if education.get('educationTimeline') and isinstance(education['educationTimeline'], list):
                        institutions = []
                        for edu_entry in education['educationTimeline'][:3]:  # Top 3
                            if isinstance(edu_entry, dict):
                                institution = edu_entry.get('institution')
                                degree = edu_entry.get('degree')
                                major = edu_entry.get('major')
                                if institution:
                                    if degree and major:
                                        institutions.append(f"{institution} ({degree} in {major})")
                                    elif degree:
                                        institutions.append(f"{institution} ({degree})")
                                    else:
                                        institutions.append(institution)

                        if institutions:
                            context_parts.append(f"Education History: {'; '.join(filter(None, institutions))}")

                    # Certifications
                    if education.get('certifications') and isinstance(education['certifications'], list):
                        certs = []
                        for cert in education['certifications'][:5]:  # Top 5
                            if isinstance(cert, dict):
                                cert_name = cert.get('name')
                                if cert_name:
                                    certs.append(cert_name)
                            elif cert:
                                certs.append(cert)

                        if certs:
                            context_parts.append(f"Certifications: {', '.join(filter(None, certs))}")

                    # Academic achievements
                    if education.get('academicAchievements') and isinstance(education['academicAchievements'], list):
                        achievements = []
                        for achievement in education['academicAchievements'][:3]:  # Top 3
                            if isinstance(achievement, dict):
                                ach_name = achievement.get('achievement')
                                if ach_name:
                                    achievements.append(ach_name)
                            elif achievement:
                                achievements.append(achievement)

                        if achievements:
                            context_parts.append(f"Academic Achievements: {', '.join(filter(None, achievements))}")

            return "\n".join(context_parts) if context_parts else "No career insights available from recent resume analysis."

        except Exception as e:
            logger.error(f"Error formatting career insights: {str(e)}")
            return "Error processing career insights data."

    def _parse_follow_up_questions(self, questions_text: str) -> List[str]:
        """
        Parse generated follow-up questions text into a list.

        This method can be overridden by subclasses but provides a sensible default
        for parsing follow-up questions from LLM output.

        Args:
            questions_text: Raw text containing generated questions

        Returns:
            List of parsed follow-up questions (exactly 3)
        """
        try:
            import re
            questions = []
            lines = questions_text.strip().split('\n')

            for line in lines:
                line = line.strip()
                # Look for numbered questions (1., 2., 3. or 1), 2), 3))
                if line and (line.startswith(('1.', '2.', '3.', '1)', '2)', '3)')) or
                           any(line.startswith(f'{i}.') or line.startswith(f'{i})') for i in range(1, 4))):
                    # Remove number and clean up
                    question = line
                    for prefix in ['1.', '2.', '3.', '1)', '2)', '3)']:
                        if question.startswith(prefix):
                            question = question[len(prefix):].strip()
                            break

                    if question and len(question) > 5:
                        questions.append(question)

            # If parsing failed, try regex approach
            if len(questions) != 3:
                all_text = questions_text.replace('\n', ' ').strip()
                question_patterns = re.findall(r'[1-3][.)][^1-3]*(?=[1-3][.)]|$)', all_text)

                if question_patterns:
                    questions = []
                    for pattern in question_patterns[:3]:
                        question = re.sub(r'^[1-3][.)]\s*', '', pattern).strip()
                        if question and len(question) > 5:
                            questions.append(question)

            # If still not 3 questions, try finding questions with '?'
            if len(questions) != 3:
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

            # Ensure exactly 3 questions with defaults if needed
            while len(questions) < 3:
                default_questions = [
                    "Can you explain this in more detail?",
                    "What should I do next?",
                    "Are there other options to consider?"
                ]
                questions.append(default_questions[len(questions)])

            return questions[:3]

        except Exception as e:
            logger.error(f"Error parsing follow-up questions: {str(e)}")
            return [
                "Can you provide more details about this?",
                "What are the next steps I should take?",
                "Are there any alternatives I should consider?"
            ]
