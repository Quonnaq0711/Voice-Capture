import { useEffect } from "react";
import { careerInsights } from "../../services/api";
// Generate personalized insights based on user data
export default function RecentInsights(
    const []


    useEffect(() => {
        generatePersonalizedInsights()
    }, []);


    const generatePersonalizedInsights = async () => {
    try {
        setCareerInsightsStatus('loading');

        // Fetch career insights from API
        const careerInsightsResponse = await careerInsightsAPI.getSummary();

        let insights = [];

        if (careerInsightsResponse.status === 'success') {
            // Use real career insights data
            insights = careerInsightsResponse.insights.map(insight => ({
                id: insight.id,
                title: insight.title,
                description: insight.description,
                type: insight.type,
                priority: insight.priority,
                icon: getIconComponent(insight.icon),
                color: insight.color,
                action: insight.action,
                details: insight.details
            }));

            setCareerInsightsStatus('success');
        } else if (careerInsightsResponse.status === 'no_analysis') {
            // Show default message when no analysis available
            insights = [
                {
                    id: 'no_career_analysis',
                    title: "Upload Your Resume",
                    description: "Get personalized career insights by uploading your resume to the Career Agent.",
                    type: "career",
                    priority: "high",
                    icon: BriefcaseIcon,
                    color: "bg-blue-500",
                    action: "Go to Career Agent"
                }
            ];
            setCareerInsightsStatus('no_analysis');
        } else {
            setCareerInsightsStatus('error');
        }

        // Add some general insights if we have fewer than 3
        if (insights.length < 3) {
            const generalInsights = [
                {
                    id: 'financial_planning',
                    title: "Financial Planning Insight",
                    description: "Track your expenses and explore investment opportunities with the Money Agent.",
                    type: "money",
                    priority: "medium",
                    icon: CurrencyDollarIcon,
                    color: "bg-green-500",
                    action: "Check Money Agent"
                },
                {
                    id: 'wellness_recommendation',
                    title: "Wellness Recommendation",
                    description: "Consider incorporating mindfulness practices into your daily routine.",
                    type: "mind",
                    priority: "medium",
                    icon: HeartIcon,
                    color: "bg-pink-500",
                    action: "Visit Mind Agent"
                }
            ];

            // Add general insights to fill up to 3 total
            const remainingSlots = 3 - insights.length;
            insights = [...insights, ...generalInsights.slice(0, remainingSlots)];
        }

        setPersonalizedInsights(insights);

    } catch (error) {
        console.error('Error fetching career insights:', error);
        setCareerInsightsStatus('error');

        // Fallback to default insights if API fails
        const fallbackInsights = [
            {
                id: 'career_growth',
                title: "Career Growth Opportunity",
                description: "Upload your resume to get personalized career recommendations.",
                type: "career",
                priority: "high",
                icon: ArrowTrendingUpIcon,
                color: "bg-blue-500",
                action: "Explore Career Agent"
            },
            {
                id: 'financial_planning',
                title: "Financial Planning Insight",
                description: "Track your expenses and explore investment opportunities.",
                type: "money",
                priority: "medium",
                icon: CurrencyDollarIcon,
                color: "bg-green-500",
                action: "Check Money Agent"
            },
            {
                id: 'wellness_recommendation',
                title: "Wellness Recommendation",
                description: "Consider incorporating mindfulness practices into your daily routine.",
                type: "mind",
                priority: "medium",
                icon: HeartIcon,
                color: "bg-pink-500",
                action: "Visit Mind Agent"
            }
        ];
        setPersonalizedInsights(fallbackInsights);
    }
}
);