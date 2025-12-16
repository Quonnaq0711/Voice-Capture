/**
 * Shared utility for daily recommendations
 * Provides static fallback recommendations when API is unavailable
 */

/**
 * Get static fallback recommendations
 * Used when the API fails or returns empty results
 * @returns {Array} Array of recommendation objects
 */
export const getStaticFallbackRecommendations = () => [
  {
    id: "career_profile_review",
    title: "Profile Boost",
    description: "Optimize your LinkedIn profile with compelling headlines, achievements, and keywords to attract opportunities",
    category: "career",
    priority: "high",
    estimated_time: "25 min",
    action_type: "review",
    color: "blue",
    icon: "BriefcaseIcon"
  },
  {
    id: "skill_assessment",
    title: "Market Analysis",
    description: "Identify 3 high-demand skills in your target market and create a strategic learning roadmap",
    category: "learning",
    priority: "high",
    estimated_time: "25 min",
    action_type: "explore",
    color: "purple",
    icon: "AcademicCapIcon"
  },
  {
    id: "industry_networking",
    title: "Industry Connect",
    description: "Research and reach out to 3 industry leaders with thoughtful messages to expand your professional circle",
    category: "networking",
    priority: "medium",
    estimated_time: "35 min",
    action_type: "connect",
    color: "green",
    icon: "UserGroupIcon"
  }
];
