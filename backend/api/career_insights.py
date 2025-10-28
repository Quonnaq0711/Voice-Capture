"""
Career Insights API endpoints for retrieving career analysis summaries
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from backend.models.career_insight import CareerInsight
from backend.models.user import User
from backend.api.auth import get_current_user
from backend.db.database import get_db

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

def _generate_basic_fallback_summaries(professional_data: Dict[str, Any]) -> Dict[str, str]:
    """Generate basic fallback summaries when Career Agent is unavailable"""
    summaries = {}

    # Professional Identity fallback
    if professional_data.get('professionalIdentity'):
        identity = professional_data['professionalIdentity']
        role = identity.get('currentRole', 'Professional')
        industry = identity.get('currentIndustry', 'various industries')
        summaries['professional_identity'] = f"Experienced {role} specializing in {industry}"

    # Work Experience fallback
    if professional_data.get('workExperience'):
        work_exp = professional_data['workExperience']
        years = work_exp.get('totalYears', 0)
        summaries['work_experience'] = f"{years} years of progressive experience with proven track record"

    # Skills Analysis fallback
    if professional_data.get('skillsAnalysis'):
        skills = professional_data['skillsAnalysis']
        hard_skills_count = len(skills.get('hardSkills', []))
        summaries['skills_analysis'] = f"Strong technical foundation with {hard_skills_count} core competencies"

    # Market Position fallback
    if professional_data.get('marketPosition'):
        market = professional_data['marketPosition']
        competitiveness = market.get('competitiveness', 0)
        summaries['market_position'] = f"{competitiveness}% market competitiveness with high industry relevance"

    # Salary Analysis fallback
    if professional_data.get('salaryAnalysis'):
        salary = professional_data['salaryAnalysis']
        current = salary.get('currentSalary', {}).get('amount', 0)
        summaries['salary_analysis'] = f"${current}K current compensation with competitive positioning"

    return summaries

@router.get("/career-insights/summary")
async def get_career_insights_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the latest career insights summary for dashboard display
    Returns insights in the format expected by the Dashboard AI Insights component
    """
    try:
        # Get the most recent career insight for the user
        latest_insight = db.query(CareerInsight).filter(
            CareerInsight.user_id == current_user.id
        ).order_by(desc(CareerInsight.created_at)).first()

        if not latest_insight:
            return {
                "status": "no_analysis",
                "message": "No career analysis available yet. Upload your resume to get started.",
                "insights": []
            }

        # Extract professional data
        professional_data = latest_insight.get_professional_data()
        if not professional_data:
            return {
                "status": "error",
                "message": "Career analysis data is corrupted.",
                "insights": []
            }

        # Get stored dashboard summaries or generate fallback
        dashboard_summaries = latest_insight.get_dashboard_summaries()

        # Use fallback summaries if no summaries are stored
        if not dashboard_summaries:
            dashboard_summaries = _generate_basic_fallback_summaries(professional_data)

        # Create summary insights in the format expected by Dashboard
        insights = []

        # Professional Identity Insight
        if professional_data.get('professionalIdentity'):
            identity = professional_data['professionalIdentity']
            description = dashboard_summaries.get('professional_identity',
                f"Current role: {identity.get('currentRole', 'Not specified')} in {identity.get('currentIndustry', 'various industries')}")

            insights.append({
                "id": "professional_identity",
                "title": "Professional Identity",
                "description": description,
                "type": "career",
                "priority": "high",
                "icon": "BriefcaseIcon",
                "color": "bg-blue-500",
                "action": "View Career Analysis",
                "details": {
                    "title": identity.get('title', ''),
                    "summary": identity.get('summary', ''),
                    "keyHighlights": identity.get('keyHighlights', []),
                    "currentRole": identity.get('currentRole', ''),
                    "currentIndustry": identity.get('currentIndustry', ''),
                    "currentCompany": identity.get('currentCompany', ''),
                    "location": identity.get('location', '')
                }
            })

        # Work Experience Analysis Insight
        if professional_data.get('workExperience'):
            work_exp = professional_data['workExperience']
            total_years = work_exp.get('totalYears', 0)
            analytics = work_exp.get('analytics', {})
            description = dashboard_summaries.get('work_experience',
                f"{total_years} years of experience across {analytics.get('companies', {}).get('count', 'multiple')} companies")

            insights.append({
                "id": "work_experience",
                "title": "Work Experience Analysis",
                "description": description,
                "type": "career",
                "priority": "medium",
                "icon": "ClockIcon",
                "color": "bg-green-500",
                "action": "View Experience Timeline",
                "details": {
                    "totalYears": total_years,
                    "analytics": analytics,
                    "timelineStart": work_exp.get('timelineStart'),
                    "timelineEnd": work_exp.get('timelineEnd')
                }
            })

        # Salary Analysis Insight (moved to 3rd position to match Career Agent sidebar)
        if professional_data.get('salaryAnalysis'):
            salary = professional_data['salaryAnalysis']

            # Handle nested data structure (same as other sections)
            if 'salaryAnalysis' in salary:
                salary = salary['salaryAnalysis']

            current_salary = salary.get('currentSalary', {})
            market_comparison = salary.get('marketComparison', {})

            # Get dashboard summary or create fallback description
            description = dashboard_summaries.get('salary_analysis')

            if not description:
                # Create fallback description based on available data
                current_amount = current_salary.get('amount', 0) if current_salary else 0
                market_avg = market_comparison.get('industryAverage', 0) if market_comparison else 0

                if current_amount > 0 and market_avg > 0:
                    vs_market = round((current_amount / market_avg) * 100)
                    description = f"${current_amount}K current salary ({vs_market}% vs industry average)"
                elif current_amount > 0:
                    description = f"${current_amount}K current compensation with market analysis available"
                else:
                    description = "Salary analysis and compensation insights available"

            insights.append({
                "id": "salary_analysis",
                "title": "Salary Analysis",
                "description": description,
                "type": "career",
                "priority": "medium",
                "icon": "CurrencyDollarIcon",
                "color": "bg-green-600",
                "action": "View Salary Insights",
                "details": {
                    "currentSalary": current_salary,
                    "marketComparison": market_comparison,
                    "historicalTrend": salary.get('historicalTrend', []),
                    "projectedGrowth": salary.get('projectedGrowth', [])
                }
            })

        # Skills Analysis Insight (moved to 4th position to match Career Agent sidebar)
        if professional_data.get('skillsAnalysis'):
            skills = professional_data['skillsAnalysis']
            hard_skills_count = len(skills.get('hardSkills', []))
            soft_skills_count = len(skills.get('softSkills', []))
            description = dashboard_summaries.get('skills_analysis',
                f"{hard_skills_count} technical skills and {soft_skills_count} soft skills identified")

            insights.append({
                "id": "skills_analysis",
                "title": "Skills Analysis",
                "description": description,
                "type": "career",
                "priority": "medium",
                "icon": "CpuChipIcon",
                "color": "bg-purple-500",
                "action": "View Skills Breakdown",
                "details": {
                    "hardSkills": skills.get('hardSkills', []),
                    "softSkills": skills.get('softSkills', []),
                    "coreStrengths": skills.get('coreStrengths', []),
                    "developmentAreas": skills.get('developmentAreas', [])
                }
            })

        # Market Position Analysis Insight (remains in 5th position)
        if professional_data.get('marketPosition'):
            market_pos = professional_data['marketPosition']
            competitiveness = market_pos.get('competitiveness', 0)
            description = dashboard_summaries.get('market_position',
                f"{competitiveness}% market competitiveness with {market_pos.get('industryDemand', 0)}% industry demand")

            insights.append({
                "id": "market_position",
                "title": "Market Position Analysis",
                "description": description,
                "type": "career",
                "priority": "high",
                "icon": "ArrowTrendingUpIcon",
                "color": "bg-orange-500",
                "action": "View Market Analysis",
                "details": {
                    "competitiveness": competitiveness,
                    "skillRelevance": market_pos.get('skillRelevance', 0),
                    "industryDemand": market_pos.get('industryDemand', 0),
                    "careerPotential": market_pos.get('careerPotential', 0)
                }
            })

        return {
            "status": "success",
            "message": f"Latest career analysis from {latest_insight.created_at.strftime('%B %d, %Y')}",
            "insights": insights,
            "analysis_date": latest_insight.created_at.isoformat(),
            "resume_id": latest_insight.resume_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving career insights: {str(e)}"
        )

@router.get("/career-insights/latest")
async def get_latest_career_insight(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the complete latest career insight data
    """
    try:
        latest_insight = db.query(CareerInsight).filter(
            CareerInsight.user_id == current_user.id
        ).order_by(desc(CareerInsight.created_at)).first()

        if not latest_insight:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No career insights found"
            )

        return latest_insight.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving career insight: {str(e)}"
        )

@router.get("/career-insights/all")
async def get_all_career_insights(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all career insights for the user (with limit)
    """
    try:
        insights = db.query(CareerInsight).filter(
            CareerInsight.user_id == current_user.id
        ).order_by(desc(CareerInsight.created_at)).limit(limit).all()

        return [insight.to_dict() for insight in insights]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving career insights: {str(e)}"
        )

@router.post("/career-insights/{insight_id}/generate-summaries")
async def generate_insight_summaries(
    insight_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate LLM-powered summaries for a specific career insight
    This endpoint should be called after resume analysis is complete
    """
    try:
        # Get the specific career insight
        insight = db.query(CareerInsight).filter(
            CareerInsight.id == insight_id,
            CareerInsight.user_id == current_user.id
        ).first()

        if not insight:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Career insight not found"
            )

        professional_data = insight.get_professional_data()
        if not professional_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No professional data available for summary generation"
            )

        # Generate summaries by calling Career Agent directly
        try:
            # Import the Career Agent's ResumeAnalyzer to use its summary generation
            import sys
            import os
            career_src_path = os.path.abspath(os.path.join(
                os.path.dirname(__file__), '..', '..', 'modules', 'agents', 'career', 'src'
            ))
            sys.path.insert(0, career_src_path)

            from resume_analyzer import ResumeAnalyzer
            from chat_service import ChatService

            # Create analyzer with ChatService
            chat_service = ChatService()
            analyzer = ResumeAnalyzer(chat_service)

            # Generate summaries using Career Agent's method
            summaries = await analyzer._generate_dashboard_summaries(professional_data)

            if summaries:
                # Store the generated summaries
                insight.set_dashboard_summaries(summaries)
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to save dashboard summaries: {str(e)}"
                    )
            else:
                raise Exception("No summaries generated")

        except Exception as llm_error:
            logger.error(f"Summary generation failed: {llm_error}")
            # Generate basic fallback summaries
            summaries = _generate_basic_fallback_summaries(professional_data)
            insight.set_dashboard_summaries(summaries)
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to save fallback summaries: {str(e)}"
                )

        return {
            "status": "success",
            "message": "Dashboard summaries generated successfully",
            "summaries": summaries,
            "generated_at": insight.summaries_generated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating summaries: {str(e)}"
        )