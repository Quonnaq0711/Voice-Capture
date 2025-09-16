"""Prompt templates for resume analysis and career insights generation."""

RESUME_ANALYSIS_SYSTEM_PROMPT = """
You are an expert career analyst with deep knowledge of various industries, job roles, and professional skills.
Your task is to analyze the provided resume and extract structured information to generate comprehensive career insights.

You must return a valid JSON object that follows the exact structure provided in the example below.
Do not include any explanations or text outside the JSON structure.
"""

RESUME_ANALYSIS_PROMPT_TEMPLATE = """Please analyze the following resume and extract structured professional information. Return your response as a valid JSON object that matches the structure provided in the system prompt.

Resume Content:
{resume_content}

Current Year/Month: {current_year}

Please provide a comprehensive analysis in the exact JSON format specified in the system prompt. Ensure all fields are properly filled with relevant information extracted from the resume.
"""

# Section-specific analysis prompts
SECTION_ANALYSIS_PROMPTS = {
    "professionalIdentity": """
Analyze the professional identity section of this resume and extract key information with high precision.

IMPORTANT INSTRUCTIONS:
1. For "title": Create a concise, one-sentence professional title that captures the person's primary expertise and seniority level (e.g., "Senior Software Engineer specializing in full-stack web development" or "Marketing Manager with expertise in digital campaigns and brand strategy")
2. For "summary": Write a comprehensive 2-3 sentence career summary highlighting experience, skills, and value proposition
3. For "keyHighlights": Extract 3-6 most impressive achievements or skills, be specific with numbers/metrics when available
4. For "currentRole": Extract the exact job title from the most recent position
5. For "currentIndustry": Identify the specific industry sector (e.g., "Technology", "Healthcare", "Finance", "Education")
6. For "currentCompany": Extract the exact company name from the most recent position
7. For "location": Extract current city and country/state if mentioned

If any information is not clearly stated in the resume, use "Not specified" for that field.

Resume Content:
{resume_content}

Return ONLY valid JSON in this exact format:
{{
  "professionalIdentity": {{
    "title": "<one_sentence_professional_title>",
    "summary": "<2_3_sentence_career_summary>",
    "keyHighlights": ["<specific_achievement_1>", "<specific_achievement_2>", "<specific_achievement_3>"],
    "currentRole": "<exact_job_title>",
    "currentIndustry": "<industry_sector>",
    "currentCompany": "<company_name>",
    "location": "<city_country_or_state>"
  }}
}}
""",
    
    "workExperience": """
Analyze the work experience section of this resume with high precision for time calculations and career analytics.

IMPORTANT TIME CALCULATION RULES:
1. Extract EXACT start and end dates from resume (month and year)
2. Convert dates to YYYY.MM format (January=.01, February=.02, ..., December=.12)
3. Calculate duration as (endYear - startYear) rounded to ONE decimal place
4. For positions less than 1 year: still show as decimal (e.g., 0.5 for 6 months, 0.8 for 10 months)
5. For current positions: use {current_year} as endYear
6. Handle date ranges carefully: "Jan 2020 - Mar 2021" = 2020.01 to 2021.03 = 1.2 years

DATE CONVERSION EXAMPLES:
- "January 2020" = 2020.01
- "March 2021" = 2021.03
- "June 2022" = 2022.06
- "December 2023" = 2023.12
- "Present" or "Current" = {current_year}

DURATION CALCULATION EXAMPLES:
- Jan 2020 to Jun 2020 = 2020.06 - 2020.01 = 0.5 years
- Mar 2021 to Dec 2022 = 2022.12 - 2021.03 = 1.9 years
- Jun 2019 to Present = {current_year} - 2019.06

Resume Content:
{resume_content}

Current Year/Month: {current_year}

Return ONLY valid JSON in this exact format:
{{
  "workExperience": {{
    "totalYears": <calculated_total_experience_years_as_number>,
    "timelineStart": <earliest_start_year_as_number>,
    "timelineEnd": <latest_end_year_as_number>,
    "analytics": {{
      "workingYears": {{
        "years": "<total_years_with_one_decimal>",
        "period": "<start_year - end_year_or_Present>"
      }},
      "heldRoles": {{
        "count": "<total_number_of_roles>",
        "longest": "<longest_role_duration_with_unit>"
      }},
      "heldTitles": {{
        "count": "<total_number_of_unique_titles>",
        "shortest": "<shortest_role_duration_with_unit>"
      }},
      "companies": {{
        "count": "<total_number_of_companies>",
        "longest": "<longest_company_tenure_with_unit>"
      }},
      "insights": {{
        "gaps": "<total_career_gaps_in_years_with_one_decimal>",
        "shortestTenure": "<shortest_company_tenure>",
        "companySize": "<e.g._2_Small_/_1_Mid_/_3_Large>",
        "averageRoleDuration": "<average_duration_per_role>"
      }}
    }},
    "companies": [
      {{
        "company": "<exact_company_name>",
        "role": "<exact_job_title>",
        "startYear": <YYYY.MM_format_as_number>,
        "endYear": <YYYY.MM_format_as_number_or_current_year>,
        "duration": "<calculated_years_one_decimal>",
        "color": "<hex_color_code>",
        "bgColor": "<tailwind_bg_class>",
        "borderColor": "<tailwind_border_class>"
      }}
    ],
    "industries": [
      {{
        "name": "<industry_sector_name>",
        "value": <years_in_industry_as_number>,
        "color": "<hex_color_code>"
      }}
    ]
  }}
}}

CRITICAL REQUIREMENTS:
- ALL duration calculations must be precise to one decimal place
- Handle short tenures (< 1 year) correctly as decimals (e.g., 0.3, 0.7)
- Ensure startYear and endYear are in YYYY.MM format
- If exact month is not specified, use reasonable estimates (.01 for early year, .06 for mid-year, .12 for late year)
- For "Present" positions, use the provided {current_year} value
- Maintain consistent color schemes across similar companies/industries
""",
    
    "salaryAnalysis": """
Analyze salary information based on this resume. Focus on:
- Current salary estimation
- Historical salary progression from career start to present
- Market comparison and projections
- Salary optimization recommendations

CRITICAL REQUIREMENT: You MUST generate yearly salary estimates for EVERY SINGLE YEAR from timelineStart to timelineEnd.

For example:
- If timelineStart is 2021.06 and timelineEnd is 2025.08, you MUST generate entries for: 2021, 2022, 2023, 2024, 2025
- If timelineStart is 2019.03 and timelineEnd is 2024.12, you MUST generate entries for: 2019, 2020, 2021, 2022, 2023, 2024

For each year in the career timeline, estimate the salary based on:
1. Role progression and seniority increases
2. Industry standards for that time period
3. Company changes and their typical salary impacts
4. Economic factors and inflation adjustments
5. Skill development and experience accumulation

DO NOT skip any years in the timeline. Generate data for ALL years from start to end.

Resume Content:
{resume_content}

Return only the salaryAnalysis section as JSON, ensuring the structure matches the following:
{{
  "salaryAnalysis": {{
    "currentSalary": {{
      "amount": <number_current_salary_in_thousands>,
      "currency": "<currency_code_e.g._USD>",
      "confidence": <number_0_to_100_confidence_level>
    }},
    "historicalTrend": [
       {{ "year": <year_from_timelineStart_to_timelineEnd>, "salary": <estimated_salary_in_thousands_for_that_year>, "role": "<role_title_during_that_year>", "company": "<company_name_during_that_year>" }}
       // CRITICAL: Generate entries for EVERY SINGLE YEAR from career start to present, showing salary progression
       // Example: if timelineStart is 2015 and timelineEnd is 2024, generate entries for 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
       // Example: if timelineStart is 2021.06 and timelineEnd is 2025.08, generate entries for 2021, 2022, 2023, 2024, 2025
       // NEVER SKIP YEARS - complete timeline coverage is mandatory
       // Estimate realistic salary growth considering role changes, promotions, company switches, and market conditions
     ],
    "marketComparison": {{
      "industryAverage": <number_industry_average_salary_in_thousands>,
      "percentile": <number_0_to_100_where_user_stands_in_market>,
      "locationAdjustment": <number_location_multiplier_e.g._1.2_for_high_cost_areas>
    }},
    "projectedGrowth": [
       {{ "year": <int({current_year}) + 1>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
       {{ "year": <int({current_year}) + 2>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
       {{ "year": <int({current_year}) + 3>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
       {{ "year": <int({current_year}) + 4>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
       {{ "year": <int({current_year}) + 5>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }}
       // CRITICAL: Generate entries for NEXT 5 YEARS starting from current year (int part of {current_year})
       // Example: if {current_year} is 2025.08, generate entries for 2026, 2027, 2028, 2029, 2030
       // Consider different scenarios (conservative, moderate, optimistic) for realistic projections
       // Factor in career progression, skill development, market trends, and industry growth
    ],
    "salaryFactors": {{
      "experienceImpact": <number_0_to_100_how_much_experience_affects_salary>,
      "skillsImpact": <number_0_to_100_how_much_skills_affect_salary>,
      "locationImpact": <number_0_to_100_how_much_location_affects_salary>,
      "industryImpact": <number_0_to_100_how_much_industry_affects_salary>
    }},
    "recommendations": [
      {{ "strategy": "<salary_increase_strategy>", "impact": "<low_medium_high>", "timeframe": "<timeframe_to_see_results>", "description": "<detailed_description_of_strategy>" }}
    ]
  }}
}}
""",

    "skillsAnalysis": """
Analyze the skills section of this resume. Focus on extracting:
- Hard skills with proficiency levels
- Soft skills with current and target levels
- Core strengths with scores
- Development areas with priorities

Resume Content:
{resume_content}

Return only the skillsAnalysis section as JSON in the following exact format:
{{
  "skillsAnalysis": {{
    "hardSkills": [
      {{ "skill": "<skill_name>", "level": <number_0_to_100>, "category": "<category>" }},
      // Additional hard skills...
    ],
    "softSkills": [
      {{ "skill": "<skill_name>", "current": <number_1_to_5>, "target": <number_1_to_5> }},
      // Additional soft skills...
    ],
    "coreStrengths": [
      {{ "area": "<A key strength area identified from the resume, e.g., 'Technical Excellence'>", "description": "<A brief description of this strength, e.g., 'Strong foundation in full-stack development'>", "score": <number_0_to_100> }},
      {{ "area": "<Another strength area, e.g., 'Problem Solving'>", "description": "<Description of this strength, e.g., 'Demonstrated ability to analyze complex problems'>", "score": <number_0_to_100> }},
      {{ "area": "<Third strength area, e.g., 'Leadership'>", "description": "<Description of this strength, e.g., 'Experience in leading teams and projects'>", "score": <number_0_to_100> }},
      {{ "area": "<Fourth strength area, e.g., 'Communication'>", "description": "<Description of this strength, e.g., 'Strong written and verbal communication skills'>", "score": <number_0_to_100> }}
      // Generate at least 3-5 core strengths based on resume analysis
    ],
    "developmentAreas": [
      {{ "area": "<An area for development identified from the resume, e.g., 'System Architecture'>", "description": "<A brief description of this development area, e.g., 'Expand knowledge in large-scale system design'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Another development area, e.g., 'Data Science'>", "description": "<Description of this area, e.g., 'Strengthen skills in machine learning and analytics'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Third development area, e.g., 'Public Speaking'>", "description": "<Description of this area, e.g., 'Improve presentation and public speaking abilities'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Fourth development area, e.g., 'Strategic Planning'>", "description": "<Description of this area, e.g., 'Develop long-term strategic thinking skills'>", "priority": "<'high' or 'medium'>" }}
      // Generate at least 3-5 development areas based on resume analysis
    ]
  }}
}}
""",
    
    "marketPosition": """
Analyze the market position based on this resume. Focus on:
- Competitiveness in current market
- Skill relevance to industry trends
- Industry demand for this profile
- Overall career potential

Resume Content:
{resume_content}

Return only the marketPosition section as JSON:
{{
  "marketPosition": {{
    "competitiveness": <0-100>,
    "skillRelevance": <0-100>,
    "industryDemand": <0-100>,
    "careerPotential": <0-100>
  }}
}}
"""
}

def get_section_analysis_prompt(section_name: str, resume_content: str, current_year: str) -> str:
    """Get section-specific analysis prompt.
    
    Args:
        section_name: Name of the section to analyze
        resume_content: The resume content
        current_year: Current year for date calculations
        
    Returns:
        Formatted prompt for the specific section
    """
    if section_name not in SECTION_ANALYSIS_PROMPTS:
        raise ValueError(f"Unknown section: {section_name}")
    
    prompt_template = SECTION_ANALYSIS_PROMPTS[section_name]
    return prompt_template.format(
        resume_content=resume_content,
        current_year=current_year
    )

ORIGINAL_RESUME_ANALYSIS_PROMPT_TEMPLATE = """
Analyze the following resume and extract structured information to generate comprehensive career insights.
Return a valid JSON object that follows the exact structure of the example provided.

Resume Content:
{resume_content}

Generate a JSON object with the following structure:

```json
{{
  "professionalIdentity": {{
    "title": "<A concise, professional title summarizing the user's experience level and primary role>",
    "summary": "<A detailed professional summary of approximately 300 characters. It should eloquently narrate the user's career progression, core competencies, and professional ethos, weaving in their most significant accomplishments to create a compelling career story.>",
    "keyHighlights": [
      "<A key achievement or highlight from the resume. Focus on impact and quantify results where possible (e.g., 'Led a project that increased revenue by 15%').>",
      "<Another key achievement or highlight, showcasing a different skill or accomplishment. Be specific and results-oriented.>",
      "<A third key achievement that demonstrates growth, leadership, or a unique contribution.>"
    ],
    "currentRole": "<The user's most recent or current job title>",
    "location": "<The user's current location (e.g., city, state)>"
  }},
  "workExperience": {{
    "totalYears": <number>,
    "timelineStart": <The earliest start year from the work experience section of the resume e.g. 2008>,
    "timelineEnd": <The latest end year from the work experience section of the resume e.g. 2024>,
    "analytics": {{
      "workingYears": {{
        "years": "<Total years of experience>",
        "period": "<e.g. 1999 - Present>"
      }},
      "heldRoles": {{
        "count": "<Total number of roles held>",
        "longest": "<e.g. 9 mos>"
      }},
      "heldTitles": {{
        "count": "<Total number of titles held>",
        "shortest": "<e.g. 4.5 years>"
      }},
      "companies": {{
        "count": "<Total number of companies worked for>",
        "longest": "<e.g. 9 mos>"
      }},
      "insights": {{
        "gaps": "<e.g. 2.5 years total career gaps>",
        "shortestTenure": "<e.g. 5.5 years at current role>",
        "companySize": "<e.g. 2 Small / 1 Mid / 3 Large>",
        "averageRoleDuration": "<e.g. 4.8 years>"
      }}
    }},
    "companies": [
      // - startYear: The start year of employment. Extract the year and month, formatted as YYYY.MM. For example, July 2021 should be 2021.07.
      // - endYear: The end year of employment. Extract the year and month, formatted as YYYY.MM. If the resume indicates 'Present' or a similar term for the end date, use the current year and month provided in the placeholder {current_year} as the end year.
      // - duration: The total duration of employment in years, calculated as (endYear - startYear). Provide the result with one decimal place.
      {{ "company": "<company_name>", "role": "<job_title>", "startYear": <number e.g. 2021.07>, "endYear": <number e.g. 2023.05 or {current_year}>, "duration": "<number>", "color": "<hex_color e.g. #FF6B35>", "bgColor": "<tailwind_bg_color e.g. bg-orange-100>", "borderColor": "<tailwind_border_color e.g. border-orange-300>" }},
      // Additional companies...
    ],
    "industries": [
      {{ "name": "<industry_name>", "value": <number_of_years_spent_in_this_industry>, "color": "<hex_color>" }},
      // value is the number of years spent in this industry (not percentage).
      // Additional industries...
    ]
  }},
  "skillsAnalysis": {{
    "hardSkills": [
      {{ "skill": "<skill_name>", "level": <number_0_to_100>, "category": "<category>" }},
      // Additional hard skills...
    ],
    "softSkills": [
      {{ "skill": "<skill_name>", "current": <number_1_to_5>, "target": <number_1_to_5> }},
      // Additional soft skills...
    ],
    "coreStrengths": [
      {{ "area": "<A key strength area identified from the resume, e.g., 'Technical Excellence'>", "description": "<A brief description of this strength, e.g., 'Strong foundation in full-stack development'>", "score": <number_0_to_100> }},
      {{ "area": "<Another strength area, e.g., 'Problem Solving'>", "description": "<Description of this strength, e.g., 'Demonstrated ability to analyze complex problems'>", "score": <number_0_to_100> }},
      {{ "area": "<Third strength area, e.g., 'Leadership'>", "description": "<Description of this strength, e.g., 'Experience in leading teams and projects'>", "score": <number_0_to_100> }},
      {{ "area": "<Fourth strength area, e.g., 'Communication'>", "description": "<Description of this strength, e.g., 'Strong written and verbal communication skills'>", "score": <number_0_to_100> }}
      // Generate at least 3-5 core strengths based on resume analysis
    ],
    "developmentAreas": [
      {{ "area": "<An area for development identified from the resume, e.g., 'System Architecture'>", "description": "<A brief description of this development area, e.g., 'Expand knowledge in large-scale system design'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Another development area, e.g., 'Data Science'>", "description": "<Description of this area, e.g., 'Strengthen skills in machine learning and analytics'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Third development area, e.g., 'Public Speaking'>", "description": "<Description of this area, e.g., 'Improve presentation and public speaking abilities'>", "priority": "<'high' or 'medium'>" }},
      {{ "area": "<Fourth development area, e.g., 'Strategic Planning'>", "description": "<Description of this area, e.g., 'Develop long-term strategic thinking skills'>", "priority": "<'high' or 'medium'>" }}
      // Generate at least 3-5 development areas based on resume analysis
    ]
  }},
  "marketPosition": {{
    "competitiveness": <number_0_to_100>,
    "skillRelevance": <number_0_to_100>,
    "industryDemand": <number_0_to_100>,
    "careerPotential": <number_0_to_100>
  }},
  "careerTrajectory": [
    {{ "year": "<year>", "role": "<role>", "level": <number>, "salary": <number_in_thousands> }},
    // Additional career trajectory points...
  ],
  "strengthsWeaknesses": {{
    "strengths": [
      {{ "area": "<strength_area>", "score": <number_0_to_100> }},
      // Additional strengths...
    ],
    "weaknesses": [
      {{ "area": "<weakness_area>", "score": <number_0_to_100> }},
      // Additional weaknesses...
    ]
  }},
  "salaryAnalysis": {{
    "currentSalary": {{
      "amount": <number_current_salary_in_thousands>,
      "currency": "<currency_code_e.g._USD>",
      "confidence": <number_0_to_100_confidence_level>
    }},
    "historicalTrend": [
      {{ "year": <year_from_timelineStart_to_timelineEnd>, "salary": <estimated_salary_in_thousands_for_that_year>, "role": "<role_title_during_that_year>", "company": "<company_name_during_that_year>" }},
      // MANDATORY: Generate entries for EVERY SINGLE YEAR from career start (timelineStart) to present (timelineEnd)
      // Example: if timelineStart is 2015 and timelineEnd is 2024, generate entries for 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
      // Example: if timelineStart is 2021.06 and timelineEnd is 2025.08, generate entries for 2021, 2022, 2023, 2024, 2025
      // DO NOT SKIP ANY YEARS - this is critical for timeline visualization
      // Estimate realistic salary growth considering role changes, promotions, company switches, and market conditions
    ],
    "marketComparison": {{
      "industryAverage": <number_industry_average_salary_in_thousands>,
      "percentile": <number_0_to_100_where_user_stands_in_market>,
      "locationAdjustment": <number_location_multiplier_e.g._1.2_for_high_cost_areas>
    }},
    "projectedGrowth": [
        {{ "year": <int({current_year}) + 1>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
         {{ "year": <int({current_year}) + 2>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
         {{ "year": <int({current_year}) + 3>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
         {{ "year": <int({current_year}) + 4>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }},
         {{ "year": <int({current_year}) + 5>, "salary": <projected_salary_in_thousands>, "scenario": "<conservative_moderate_or_optimistic>", "role": "<projected_role>" }}
         // MANDATORY: Generate entries for NEXT 5 YEARS starting from current year (int part of {current_year})
         // Example: if {current_year} is 2025.08, generate entries for 2026, 2027, 2028, 2029, 2030
         // Use different scenarios to show range of possibilities based on career trajectory
         // Consider role progression, skill development, market conditions, and industry trends
     ],
    "salaryFactors": {{
      "experienceImpact": <number_0_to_100_how_much_experience_affects_salary>,
      "skillsImpact": <number_0_to_100_how_much_skills_affect_salary>,
      "locationImpact": <number_0_to_100_how_much_location_affects_salary>,
      "industryImpact": <number_0_to_100_how_much_industry_affects_salary>
    }},
    "recommendations": [
      {{ "strategy": "<salary_increase_strategy>", "impact": "<low_medium_high>", "timeframe": "<timeframe_to_see_results>", "description": "<detailed_description_of_strategy>" }},
      // Additional salary optimization recommendations...
    ]
  }}
}}
```

Ensure that:
1. All numeric values are appropriate for their context (e.g., skill levels between 0-100, years of experience as realistic numbers)
2. Color values for industries are valid hex colors (e.g., #4285F4, #34A853)
3. The structure exactly matches the example provided
4. The data is realistic and consistent with the resume content

Return only the JSON object without any additional text or explanations.
"""

INTENT_DETECTION_PROMPT = """
Determine if the user's message is requesting career insights or resume analysis.
Return "CAREER_INSIGHTS" if the user is asking for career insights, resume analysis, or professional evaluation.
Return "NORMAL_CONVERSATION" for any other type of request.

User message: {user_message}

Response (only CAREER_INSIGHTS or NORMAL_CONVERSATION):
"""

# Follow-up questions prompt for career conversations
FOLLOW_UP_PROMPT = """
Based on the following career conversation and user profile, generate exactly 3 simple, practical follow-up questions that the USER is most likely to ask next. These should be questions from the USER's perspective focused on career development.

User Profile Context: {profile_context}

The questions should be:
1. Simple and easy to understand (avoid complex terminology)
2. Directly related to the original career question and response
3. Practical and actionable for career development
4. Personalized based on the user's professional background when relevant
5. Questions the USER would naturally want to know next about their career

Example 1:
User Profile: Software Engineer at Google, 3 years experience
User Question: "How do I transition to a senior role?"
AI Response: "Focus on technical leadership, mentoring junior developers, and driving architectural decisions."
Good Follow-up Questions:
1. What specific technical leadership opportunities should I look for?
2. How can I start mentoring effectively without formal authority?
3. What architectural decisions would demonstrate senior-level thinking?

Example 2:
User Profile: Marketing Manager, 5 years experience, interested in tech
User Question: "How can I transition to product management?"
AI Response: "Leverage your marketing background, learn product analytics, and gain experience with product roadmaps."
Good Follow-up Questions:
1. Which product analytics tools should I learn first?
2. How can I get hands-on experience with product roadmaps in my current role?
3. What's the typical timeline for a marketing to product management transition?

Now generate follow-up questions for this career conversation:

Original User Question: {user_message}

AI Response: {ai_response}

Generate exactly 3 simple, practical follow-up questions that the USER would naturally want to ask next:
1. [First question]
2. [Second question]
3. [Third question]

Only return the numbered questions, nothing else.
"""