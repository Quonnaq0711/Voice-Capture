"""
JSON Schema definitions for resume analysis sections.

This module provides strict JSON Schemas for vLLM guided generation, ensuring
100% format compliance for all resume analysis sections. These schemas are used
with vLLM's structured output feature to guarantee valid JSON responses.

Design: Each section has a corresponding schema that precisely defines:
- Field types (string, number, array, object)
- Required fields
- Nested structures
- Array item constraints
- Additional properties control

Usage:
    from resume_analysis_schemas import get_section_schema

    schema = get_section_schema("professionalIdentity")
    # Use schema with vLLM guided generation
"""

from typing import Dict, Any


# ============================================================================
# Section JSON Schemas
# ============================================================================

PROFESSIONAL_IDENTITY_SCHEMA = {
    "type": "object",
    "properties": {
        "professionalIdentity": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Concise professional title capturing expertise and seniority"
                },
                "summary": {
                    "type": "string",
                    "description": "Comprehensive 2-3 sentence career summary"
                },
                "keyHighlights": {
                    "type": "array",
                    "description": "3-6 impressive achievements or skills with metrics",
                    "items": {
                        "type": "string"
                    },
                    "minItems": 3,
                    "maxItems": 6
                },
                "currentRole": {
                    "type": "string",
                    "description": "Exact job title from most recent position"
                },
                "currentIndustry": {
                    "type": "string",
                    "description": "Specific industry sector"
                },
                "currentCompany": {
                    "type": "string",
                    "description": "Exact company name from most recent position"
                },
                "location": {
                    "type": "string",
                    "description": "Current city and country/state"
                },
                "marketPosition": {
                    "type": "object",
                    "description": "Market position assessment integrated with professional identity",
                    "properties": {
                        "competitiveness": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Market competitiveness score 0-100"
                        },
                        "skillRelevance": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Skill relevance to current market 0-100"
                        },
                        "industryDemand": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Industry demand for this profile 0-100"
                        },
                        "careerPotential": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Overall career growth potential 0-100"
                        }
                    },
                    "required": ["competitiveness", "skillRelevance", "industryDemand", "careerPotential"],
                    "additionalProperties": False
                }
            },
            "required": ["title", "summary", "keyHighlights", "currentRole", "currentIndustry", "currentCompany", "location", "marketPosition"],
            "additionalProperties": False
        },
        "professionalIdentity_summary": {
            "type": "string",
            "description": "Dashboard summary: exactly 3 concise bullet points using • symbol. Each bullet must be 6-8 words maximum, specific and impactful. Format: '• Bullet 1\\n• Bullet 2\\n• Bullet 3'"
        }
    },
    "required": ["professionalIdentity", "professionalIdentity_summary"],
    "additionalProperties": False
}


WORK_EXPERIENCE_SCHEMA = {
    "type": "object",
    "properties": {
        "workExperience": {
            "type": "object",
            "properties": {
                "totalYears": {
                    "type": "number",
                    "description": "Total years of professional experience"
                },
                "timelineStart": {
                    "type": "number",
                    "description": "Earliest start year in YYYY format"
                },
                "timelineEnd": {
                    "type": "number",
                    "description": "Latest end year in YYYY format or current year"
                },
                "analytics": {
                    "type": "object",
                    "properties": {
                        "workingYears": {
                            "type": "object",
                            "properties": {
                                "years": {"type": "string"},
                                "period": {"type": "string"}
                            },
                            "required": ["years", "period"],
                            "additionalProperties": False
                        },
                        "heldRoles": {
                            "type": "object",
                            "properties": {
                                "count": {"type": "string"},
                                "longest": {"type": "string"}
                            },
                            "required": ["count", "longest"],
                            "additionalProperties": False
                        },
                        "heldTitles": {
                            "type": "object",
                            "properties": {
                                "count": {"type": "string"},
                                "shortest": {"type": "string"}
                            },
                            "required": ["count", "shortest"],
                            "additionalProperties": False
                        },
                        "companies": {
                            "type": "object",
                            "properties": {
                                "count": {"type": "string"},
                                "longest": {"type": "string"}
                            },
                            "required": ["count", "longest"],
                            "additionalProperties": False
                        },
                        "insights": {
                            "type": "object",
                            "properties": {
                                "gaps": {"type": "string"},
                                "shortestTenure": {"type": "string"},
                                "companySize": {"type": "string"},
                                "averageRoleDuration": {"type": "string"}
                            },
                            "required": ["gaps", "shortestTenure", "companySize", "averageRoleDuration"],
                            "additionalProperties": False
                        }
                    },
                    "required": ["workingYears", "heldRoles", "heldTitles", "companies", "insights"],
                    "additionalProperties": False
                },
                "companies": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "company": {"type": "string"},
                            "role": {"type": "string"},
                            "startYear": {"type": "number"},
                            "endYear": {"type": "number"},
                            "duration": {"type": "string"},
                            "color": {"type": "string"},
                            "bgColor": {"type": "string"},
                            "borderColor": {"type": "string"}
                        },
                        "required": ["company", "role", "startYear", "endYear", "duration", "color", "bgColor", "borderColor"],
                        "additionalProperties": False
                    }
                },
                "industries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "value": {"type": "number"},
                            "color": {"type": "string"}
                        },
                        "required": ["name", "value", "color"],
                        "additionalProperties": False
                    }
                }
            },
            "required": ["totalYears", "timelineStart", "timelineEnd", "analytics", "companies", "industries"],
            "additionalProperties": False
        },
        "workExperience_summary": {
            "type": "string",
            "description": "Dashboard summary: exactly 3 concise bullet points using • symbol. Each bullet must be 6-8 words maximum. Format: '• Bullet 1\\n• Bullet 2\\n• Bullet 3'"
        }
    },
    "required": ["workExperience", "workExperience_summary"],
    "additionalProperties": False
}


SALARY_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "salaryAnalysis": {
            "type": "object",
            "properties": {
                "currentSalary": {
                    "type": "object",
                    "properties": {
                        "amount": {"type": "number"},
                        "currency": {"type": "string"},
                        "confidence": {"type": "number"}
                    },
                    "required": ["amount", "currency", "confidence"],
                    "additionalProperties": False
                },
                "historicalTrend": {
                    "type": "array",
                    "description": "MUST include entry for EVERY year from timelineStart to timelineEnd",
                    "items": {
                        "type": "object",
                        "properties": {
                            "year": {"type": "number"},
                            "salary": {"type": "number"},
                            "role": {"type": "string"},
                            "company": {"type": "string"}
                        },
                        "required": ["year", "salary", "role", "company"],
                        "additionalProperties": False
                    },
                    "minItems": 1
                },
                "marketComparison": {
                    "type": "object",
                    "properties": {
                        "industryAverage": {"type": "number"},
                        "percentile": {"type": "number"},
                        "locationAdjustment": {"type": "number"}
                    },
                    "required": ["industryAverage", "percentile", "locationAdjustment"],
                    "additionalProperties": False
                },
                "projectedGrowth": {
                    "type": "array",
                    "description": "MUST include exactly 5 years of projections",
                    "items": {
                        "type": "object",
                        "properties": {
                            "year": {"type": "number"},
                            "salary": {"type": "number"},
                            "scenario": {"type": "string"},
                            "role": {"type": "string"}
                        },
                        "required": ["year", "salary", "scenario", "role"],
                        "additionalProperties": False
                    },
                    "minItems": 5,
                    "maxItems": 5
                },
                "salaryFactors": {
                    "type": "object",
                    "properties": {
                        "experienceImpact": {"type": "number"},
                        "skillsImpact": {"type": "number"},
                        "locationImpact": {"type": "number"},
                        "industryImpact": {"type": "number"}
                    },
                    "required": ["experienceImpact", "skillsImpact", "locationImpact", "industryImpact"],
                    "additionalProperties": False
                },
                "recommendations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "strategy": {"type": "string"},
                            "impact": {"type": "string"},
                            "timeframe": {"type": "string"},
                            "description": {"type": "string"}
                        },
                        "required": ["strategy", "impact", "timeframe", "description"],
                        "additionalProperties": False
                    },
                    "minItems": 1
                }
            },
            "required": ["currentSalary", "historicalTrend", "marketComparison", "projectedGrowth", "salaryFactors", "recommendations"],
            "additionalProperties": False
        },
        "salaryAnalysis_summary": {
            "type": "string",
            "description": "Dashboard summary: exactly 3 concise bullet points using • symbol. Each bullet must be 6-8 words maximum. Format: '• Bullet 1\\n• Bullet 2\\n• Bullet 3'"
        }
    },
    "required": ["salaryAnalysis", "salaryAnalysis_summary"],
    "additionalProperties": False
}


SKILLS_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "skillsAnalysis": {
            "type": "object",
            "properties": {
                "hardSkills": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "skill": {"type": "string"},
                            "level": {"type": "number"},
                            "category": {"type": "string"}
                        },
                        "required": ["skill", "level", "category"],
                        "additionalProperties": False
                    },
                    "minItems": 1
                },
                "softSkills": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "skill": {"type": "string"},
                            "current": {"type": "number"},
                            "target": {"type": "number"}
                        },
                        "required": ["skill", "current", "target"],
                        "additionalProperties": False
                    },
                    "minItems": 1
                },
                "coreStrengths": {
                    "type": "array",
                    "description": "Generate at least 3-5 core strengths",
                    "items": {
                        "type": "object",
                        "properties": {
                            "area": {"type": "string"},
                            "description": {"type": "string"},
                            "score": {"type": "number"}
                        },
                        "required": ["area", "description", "score"],
                        "additionalProperties": False
                    },
                    "minItems": 3,
                    "maxItems": 5
                },
                "developmentAreas": {
                    "type": "array",
                    "description": "Generate at least 3-5 development areas",
                    "items": {
                        "type": "object",
                        "properties": {
                            "area": {"type": "string"},
                            "description": {"type": "string"},
                            "priority": {"type": "string", "enum": ["high", "medium"]}
                        },
                        "required": ["area", "description", "priority"],
                        "additionalProperties": False
                    },
                    "minItems": 3,
                    "maxItems": 5
                }
            },
            "required": ["hardSkills", "softSkills", "coreStrengths", "developmentAreas"],
            "additionalProperties": False
        },
        "skillsAnalysis_summary": {
            "type": "string",
            "description": "Dashboard summary: exactly 3 concise bullet points using • symbol. Each bullet must be 6-8 words maximum. Format: '• Bullet 1\\n• Bullet 2\\n• Bullet 3'"
        }
    },
    "required": ["skillsAnalysis", "skillsAnalysis_summary"],
    "additionalProperties": False
}


EDUCATION_BACKGROUND_SCHEMA = {
    "type": "object",
    "properties": {
        "educationBackground": {
            "type": "object",
            "properties": {
                "highestDegree": {
                    "type": "string",
                    "description": "Highest degree achieved (e.g., Bachelor's, Master's, PhD, High School)"
                },
                "totalYearsOfEducation": {
                    "type": "number",
                    "description": "Total years spent in higher education"
                },
                "educationTimeline": {
                    "type": "array",
                    "description": "Educational institutions and degrees in reverse chronological order (most recent first)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "institution": {
                                "type": "string",
                                "description": "Name of educational institution"
                            },
                            "degree": {
                                "type": "string",
                                "description": "Degree type (e.g., Bachelor of Science, Master of Arts)"
                            },
                            "major": {
                                "type": "string",
                                "description": "Field of study or major"
                            },
                            "startYear": {
                                "type": "number",
                                "description": "Start year in YYYY.MM format"
                            },
                            "endYear": {
                                "type": "number",
                                "description": "End year in YYYY.MM format or current year if ongoing"
                            },
                            "gpa": {
                                "type": "string",
                                "description": "GPA if mentioned (e.g., '3.8/4.0' or 'Not specified')"
                            },
                            "honors": {
                                "type": "string",
                                "description": "Academic honors if any (e.g., 'Summa Cum Laude', 'Dean's List' or 'None')"
                            },
                            "relevantCoursework": {
                                "type": "array",
                                "description": "List of relevant courses (3-5 courses maximum)",
                                "items": {
                                    "type": "string"
                                },
                                "maxItems": 5
                            },
                            "color": {
                                "type": "string",
                                "description": "Hex color code for visualization"
                            },
                            "bgColor": {
                                "type": "string",
                                "description": "Tailwind background color class (e.g., 'bg-blue-50')"
                            }
                        },
                        "required": ["institution", "degree", "major", "startYear", "endYear", "gpa", "honors", "color", "bgColor"],
                        "additionalProperties": False
                    },
                    "minItems": 1
                },
                "certifications": {
                    "type": "array",
                    "description": "Professional certifications and licenses",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Certification name"
                            },
                            "issuer": {
                                "type": "string",
                                "description": "Issuing organization"
                            },
                            "year": {
                                "type": "number",
                                "description": "Year obtained"
                            },
                            "status": {
                                "type": "string",
                                "enum": ["active", "expired"],
                                "description": "Current status of certification"
                            }
                        },
                        "required": ["name", "issuer", "year", "status"],
                        "additionalProperties": False
                    }
                },
                "academicAchievements": {
                    "type": "array",
                    "description": "Notable academic achievements (publications, awards, scholarships)",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": ["highestDegree", "totalYearsOfEducation", "educationTimeline"],
            "additionalProperties": False
        },
        "educationBackground_summary": {
            "type": "string",
            "description": "Dashboard summary: exactly 3 concise bullet points using • symbol. Each bullet must be 6-8 words maximum, specific and impactful. Format: '• Bullet 1\\n• Bullet 2\\n• Bullet 3'"
        }
    },
    "required": ["educationBackground", "educationBackground_summary"],
    "additionalProperties": False
}


# ============================================================================
# Schema Registry
# ============================================================================

SECTION_SCHEMAS = {
    "professionalIdentity": PROFESSIONAL_IDENTITY_SCHEMA,
    "educationBackground": EDUCATION_BACKGROUND_SCHEMA,
    "workExperience": WORK_EXPERIENCE_SCHEMA,
    "salaryAnalysis": SALARY_ANALYSIS_SCHEMA,
    "skillsAnalysis": SKILLS_ANALYSIS_SCHEMA
}


# ============================================================================
# Public API
# ============================================================================

def get_section_schema(section_name: str) -> Dict[str, Any]:
    """
    Get JSON Schema for a specific resume analysis section.

    This schema is used with vLLM's guided generation to ensure 100% format compliance.
    The LLM is constrained to generate only JSON that matches this schema exactly.

    Args:
        section_name: Name of the section (e.g., "professionalIdentity")

    Returns:
        JSON Schema dictionary

    Raises:
        ValueError: If section_name is not recognized

    Example:
        >>> schema = get_section_schema("professionalIdentity")
        >>> # Use with vLLM ChatOpenAI:
        >>> ChatOpenAI(
        ...     model_kwargs={
        ...         "response_format": {
        ...             "type": "json_schema",
        ...             "json_schema": {
        ...                 "name": "resume_professional_identity",
        ...                 "strict": True,
        ...                 "schema": schema
        ...             }
        ...         }
        ...     }
        ... )
    """
    if section_name not in SECTION_SCHEMAS:
        raise ValueError(
            f"Unknown section: {section_name}. "
            f"Valid sections: {', '.join(SECTION_SCHEMAS.keys())}"
        )

    return SECTION_SCHEMAS[section_name]


def get_all_section_names() -> list[str]:
    """
    Get list of all available section names.

    Returns:
        List of section names
    """
    return list(SECTION_SCHEMAS.keys())


def validate_section_data(section_name: str, data: Dict[str, Any]) -> bool:
    """
    Validate section data against its schema (for testing/debugging).

    Args:
        section_name: Name of the section
        data: Data to validate

    Returns:
        True if valid, False otherwise

    Note:
        This is a simple validation. For production use, consider using
        jsonschema library for comprehensive validation.
    """
    try:
        schema = get_section_schema(section_name)
        # Basic validation: check required fields exist
        if section_name in data:
            section_data = data[section_name]
            required_fields = schema["properties"][section_name].get("required", [])
            return all(field in section_data for field in required_fields)
        return False
    except Exception:
        return False
