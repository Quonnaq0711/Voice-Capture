"""
Daily Recommendation Generation Service
"""
import logging
import json
import httpx
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models.daily_recommendation import DailyRecommendation
from models.user import User
from models.profile import UserProfile
from models.career_insight import CareerInsight

# Configure logging
logger = logging.getLogger(__name__)

class RecommendationService:
    """Service for generating daily AI recommendations"""

    def __init__(self, llm_base_url: str = "http://localhost:8002"):
        self.llm_base_url = llm_base_url
        # Set very long timeout for local LLM - can be very slow
        self.client = httpx.AsyncClient(timeout=600.0)  # 10 minutes for local LLM

    async def generate_daily_recommendations(
        self,
        db: Session,
        user_id: int,
        target_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate 3 daily recommendations for a user using LLM
        """
        if target_date is None:
            target_date = datetime.now(timezone.utc)

        try:
            # Get user context data
            context_data = await self._get_user_context(db, user_id)

            if not context_data:
                logger.warning(f"No context data available for user {user_id}")
                fallback_result = self._generate_fallback_recommendations({})

                # Store fallback recommendations in database
                daily_rec = DailyRecommendation(
                    user_id=user_id,
                    date=target_date,
                    recommendations=fallback_result["recommendations"],
                    context_data={},
                    generation_status="fallback_no_context"
                )
                db.add(daily_rec)
                db.commit()
                db.refresh(daily_rec)

                return {
                    "status": "fallback",
                    "recommendations": fallback_result["recommendations"],
                    "generated_at": target_date.isoformat(),
                    "context_used": False
                }

            # Generate recommendations using LLM
            recommendations = await self._generate_llm_recommendations(context_data)

            if not recommendations:
                logger.warning(f"LLM failed to generate recommendations for user {user_id}")
                fallback_result = self._generate_fallback_recommendations(context_data)

                # Store fallback recommendations in database
                daily_rec = DailyRecommendation(
                    user_id=user_id,
                    date=target_date,
                    recommendations=fallback_result["recommendations"],
                    context_data=context_data,
                    generation_status="fallback_llm_failed"
                )
                db.add(daily_rec)
                db.commit()
                db.refresh(daily_rec)

                return {
                    "status": "fallback",
                    "recommendations": fallback_result["recommendations"],
                    "generated_at": target_date.isoformat(),
                    "context_used": bool(context_data)
                }

            # Store recommendations in database
            daily_rec = DailyRecommendation(
                user_id=user_id,
                date=target_date,
                recommendations=recommendations,
                context_data=context_data,
                generation_status="generated"
            )

            db.add(daily_rec)
            db.commit()
            db.refresh(daily_rec)

            logger.info(f"Successfully generated and saved new recommendations for user {user_id}")

            return {
                "status": "success",
                "recommendations": recommendations,
                "generated_at": target_date.isoformat(),
                "context_used": bool(context_data)
            }

        except Exception as e:
            logger.error(f"Error generating recommendations for user {user_id}: {e}")

            # Try to get context for fallback, but handle errors gracefully
            try:
                context_data = await self._get_user_context(db, user_id)
            except:
                context_data = {}

            fallback_result = self._generate_fallback_recommendations(context_data)

            # Store error fallback recommendations in database
            try:
                daily_rec = DailyRecommendation(
                    user_id=user_id,
                    date=target_date,
                    recommendations=fallback_result["recommendations"],
                    context_data={"error": str(e)},
                    generation_status="error"
                )
                db.add(daily_rec)
                db.commit()
                db.refresh(daily_rec)
            except Exception as db_error:
                logger.error(f"Failed to save error fallback to database: {db_error}")

            return {
                "status": "error",
                "recommendations": fallback_result["recommendations"],
                "generated_at": target_date.isoformat(),
                "context_used": False,
                "error": str(e)
            }

    async def get_daily_recommendations(
        self,
        db: Session,
        user_id: int,
        target_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get daily recommendations for a user. Generate if not exists or expired.
        """
        if target_date is None:
            target_date = datetime.now(timezone.utc)

        # Check if recommendations already exist for today
        existing_rec = DailyRecommendation.get_for_user_and_date(db, user_id, target_date)

        if existing_rec:
            if self._is_recommendations_fresh(existing_rec, target_date):
                logger.info(f"Returning cached recommendations for user {user_id}")
                return {
                    "status": "cached",
                    "recommendations": existing_rec.get_recommendations(),
                    "generated_at": existing_rec.created_at.isoformat(),
                    "from_cache": True
                }
            else:
                logger.info(f"Existing recommendations expired, generating new ones for user {user_id}")
        else:
            logger.info(f"No existing recommendations found for user {user_id}, generating new ones")

        # Generate new recommendations
        return await self.generate_daily_recommendations(db, user_id, target_date)

    async def _get_user_context(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get user context data for recommendation generation"""
        context = {"user_id": user_id}

        try:
            # Get user profile
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                context["username"] = user.username

            # Get user profile data
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if profile:
                context["profile"] = {
                    "current_job": profile.current_job,
                    "company": profile.company,
                    "industry": profile.industry,
                    "experience": profile.experience,
                    "skills": profile.skills,
                    "career_challenges": profile.career_challenges
                }

            # Get latest career insight
            latest_insight = db.query(CareerInsight).filter(
                CareerInsight.user_id == user_id
            ).order_by(CareerInsight.created_at.desc()).first()

            if latest_insight:
                professional_data = latest_insight.get_professional_data()
                if professional_data:
                    context["career_analysis"] = {
                        "professional_identity": professional_data.get("professionalIdentity", {}),
                        "work_experience": professional_data.get("workExperience", {}),
                        "skills_analysis": professional_data.get("skillsAnalysis", {}),
                        "market_position": professional_data.get("marketPosition", {}),
                        "salary_analysis": professional_data.get("salaryAnalysis", {}),
                        "analysis_date": latest_insight.created_at.isoformat()
                    }

            return context

        except Exception as e:
            logger.error(f"Error getting user context for {user_id}: {e}")
            return {"user_id": user_id}

    async def _generate_llm_recommendations(self, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate recommendations using LLM service"""
        try:
            # Prepare prompt for LLM
            prompt = self._build_recommendation_prompt(context_data)
            logger.info(f"Calling LLM service for recommendation generation")

            # Call LLM API using the same endpoint as career agent
            response = await self.client.post(
                f"{self.llm_base_url}/api/chat/message",
                json={
                    "message": prompt
                },
                timeout=600.0  # 10 minutes for local LLM processing
            )

            if response.status_code == 200:
                llm_response = response.json()

                # Try different response field names that might be used by the LLM service
                recommendations_text = (
                    llm_response.get("response", "") or
                    llm_response.get("message", "") or
                    llm_response.get("content", "")
                )

                # Parse LLM response as JSON
                try:
                    # If response is already a list/dict, use it directly
                    if isinstance(recommendations_text, (list, dict)):
                        recommendations = recommendations_text
                    else:
                        # Try to find JSON in the text response
                        # Look for JSON array pattern
                        import re
                        json_match = re.search(r'\[.*\]', recommendations_text, re.DOTALL)
                        if json_match:
                            recommendations = json.loads(json_match.group())
                        else:
                            # Try parsing the entire response
                            recommendations = json.loads(recommendations_text)

                    if isinstance(recommendations, list) and len(recommendations) >= 3:
                        logger.info(f"Successfully generated {len(recommendations)} recommendations from LLM")
                        return recommendations[:3]  # Return first 3 recommendations
                    elif isinstance(recommendations, list) and len(recommendations) > 0:
                        logger.info(f"Generated {len(recommendations)} recommendations from LLM (partial)")
                        return recommendations  # Return whatever we have
                    else:
                        logger.warning(f"LLM returned invalid recommendations format")

                except (json.JSONDecodeError, AttributeError) as e:
                    logger.warning(f"Failed to parse LLM response as JSON: {e}")

            else:
                logger.warning(f"LLM service returned status: {response.status_code}")

            return []

        except httpx.TimeoutException as e:
            logger.error(f"LLM service timeout (600s): {e}")
            return []
        except httpx.ConnectError as e:
            logger.error(f"Cannot connect to LLM service: {e}")
            return []
        except Exception as e:
            logger.error(f"Error calling LLM service: {e}")
            return []

    def _build_recommendation_prompt(self, context_data: Dict[str, Any]) -> str:
        """Build prompt for LLM recommendation generation"""
        prompt = """Generate exactly 3 daily career recommendations as a JSON array.

Each recommendation needs these fields:
- id: unique identifier
- title: short title (2-4 words)
- description: detailed but concise actionable description (80-120 characters). Include specific benefits and clear next steps.
- category: "career" or "learning" or "networking"
- priority: "high" or "medium" or "low"
- estimated_time: "15 min" or "30 min" or "1 hour"
- action_type: "review" or "explore" or "connect"
- color: "blue" or "green" or "purple"
- icon: "BriefcaseIcon" or "AcademicCapIcon" or "UserGroupIcon"

Description guidelines:
- Be specific and actionable (not generic)
- Include WHY it's beneficial
- Mention concrete steps or outcomes
- Use engaging, motivational language
- Keep between 80-120 characters

Return only the JSON array, no other text:

[
  {"id": "rec1", "title": "Profile Refresh", "description": "Update your LinkedIn profile with recent achievements and trending keywords to boost visibility by 40%", "category": "career", "priority": "high", "estimated_time": "25 min", "action_type": "review", "color": "blue", "icon": "BriefcaseIcon"},
  {"id": "rec2", "title": "Skill Mapping", "description": "Research 3 emerging skills in your industry and create a learning roadmap to stay competitive", "category": "learning", "priority": "high", "estimated_time": "20 min", "action_type": "explore", "color": "purple", "icon": "AcademicCapIcon"},
  {"id": "rec3", "title": "Strategic Connect", "description": "Identify and reach out to 2 professionals at target companies with personalized messages", "category": "networking", "priority": "medium", "estimated_time": "30 min", "action_type": "connect", "color": "green", "icon": "UserGroupIcon"}
]"""

        return prompt

    def _generate_fallback_recommendations(self, context_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate smart fallback recommendations based on available context"""
        profile_info = context_data.get("profile", {}) if context_data else {}
        career_info = context_data.get("career_analysis", {}) if context_data else {}

        # Base recommendations
        recommendations = []

        # Customize first recommendation based on profile
        if profile_info.get("current_job"):
            recommendations.append({
                "id": "career_profile_review",
                "title": "Profile Polish",
                "description": f"Enhance your {profile_info.get('current_job', 'professional')} profile with quantified achievements and industry keywords to boost visibility",
                "category": "career",
                "priority": "high",
                "estimated_time": "25 min",
                "action_type": "review",
                "color": "blue",
                "icon": "BriefcaseIcon"
            })
        else:
            recommendations.append({
                "id": "career_profile_review",
                "title": "Profile Boost",
                "description": "Optimize your LinkedIn profile with compelling headlines, achievements, and keywords to attract opportunities",
                "category": "career",
                "priority": "high",
                "estimated_time": "25 min",
                "action_type": "review",
                "color": "blue",
                "icon": "BriefcaseIcon"
            })

        # Customize second recommendation based on industry/skills
        if profile_info.get("industry"):
            recommendations.append({
                "id": "industry_skill_development",
                "title": "Skill Advancement",
                "description": f"Research and prioritize 3 emerging skills in {profile_info.get('industry')} to stay ahead of industry trends",
                "category": "learning",
                "priority": "high",
                "estimated_time": "30 min",
                "action_type": "explore",
                "color": "purple",
                "icon": "AcademicCapIcon"
            })
        else:
            recommendations.append({
                "id": "skill_assessment",
                "title": "Market Analysis",
                "description": "Identify 3 high-demand skills in your target market and create a strategic learning roadmap",
                "category": "learning",
                "priority": "high",
                "estimated_time": "25 min",
                "action_type": "explore",
                "color": "purple",
                "icon": "AcademicCapIcon"
            })

        # Customize third recommendation based on company/networking
        if profile_info.get("company"):
            recommendations.append({
                "id": "industry_networking",
                "title": "Strategic Network",
                "description": "Identify and connect with 2-3 senior professionals at target companies using personalized outreach messages",
                "category": "networking",
                "priority": "medium",
                "estimated_time": "35 min",
                "action_type": "connect",
                "color": "green",
                "icon": "UserGroupIcon"
            })
        else:
            recommendations.append({
                "id": "industry_networking",
                "title": "Industry Connect",
                "description": "Research and reach out to 3 industry leaders with thoughtful messages to expand your professional circle",
                "category": "networking",
                "priority": "medium",
                "estimated_time": "35 min",
                "action_type": "connect",
                "color": "green",
                "icon": "UserGroupIcon"
            })

        return {
            "status": "fallback",
            "recommendations": recommendations
        }

    def _is_recommendations_fresh(self, existing_rec: DailyRecommendation, target_date: datetime) -> bool:
        """Check if existing recommendations are still fresh (within 24 hours)"""
        if not existing_rec or not existing_rec.date:
            return False

        # Check if the existing recommendation is for today
        today = target_date.date()
        rec_date = existing_rec.date.date()

        return rec_date == today

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()