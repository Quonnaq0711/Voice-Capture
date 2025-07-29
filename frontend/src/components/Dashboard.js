import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profile as profileAPI } from '../services/api';
import PersonalAssistant from './PersonalAssistant';
import CircularAgents from './CircularAgents';

// Import Heroicons
import { BriefcaseIcon, CurrencyDollarIcon, HeartIcon, GlobeAltIcon, UserCircleIcon, SparklesIcon, HomeIcon, BookOpenIcon, AcademicCapIcon, FireIcon, SunIcon, ChatBubbleLeftRightIcon, CommandLineIcon, LightBulbIcon, ArrowTrendingUpIcon, ClockIcon, StarIcon } from '@heroicons/react/24/outline';

/**
 * Dashboard component - The main view after a user logs in.
 * It displays the core features of the Sadaora AI Assistant platform.
 */
const Dashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userData, setUserData] = useState({ username: '', email: '' });
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [isAssistantDialogOpen, setIsAssistantDialogOpen] = useState(false);
  const [personalizedInsights, setPersonalizedInsights] = useState([]);
  const [recommendedAgents, setRecommendedAgents] = useState([]);
  const [isImgError, setImgError] = useState(false);

  // Fetch user data and avatar on component mount
  useEffect(() => {
    fetchUserData();
    fetchAvatar();
    generatePersonalizedInsights();
  }, []);

  // Trigger animation when user data is loaded
  useEffect(() => {
    if (userData.username && user) {
      // Delay animation slightly to ensure component is fully rendered
      const timer = setTimeout(() => {
        setTriggerAnimation(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userData.username, user]);

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      setUserData({
        username: data.username,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Generate personalized insights based on user data
  const generatePersonalizedInsights = () => {
    // Mock personalized insights - in real app, this would come from AI analysis
    const insights = [
      {
        id: 1,
        title: "Career Growth Opportunity",
        description: "Based on your profile, consider exploring leadership roles in your field.",
        type: "career",
        priority: "high",
        icon: ArrowTrendingUpIcon,
        color: "bg-blue-500",
        action: "Explore Career Agent"
      },
      {
        id: 2,
        title: "Financial Planning Insight",
        description: "Your spending patterns suggest potential for 15% savings optimization.",
        type: "money",
        priority: "medium",
        icon: CurrencyDollarIcon,
        color: "bg-green-500",
        action: "Check Money Agent"
      },
      {
        id: 3,
        title: "Wellness Recommendation",
        description: "Consider incorporating mindfulness practices into your daily routine.",
        type: "mind",
        priority: "medium",
        icon: HeartIcon,
        color: "bg-pink-500",
        action: "Visit Mind Agent"
      }
    ];
    setPersonalizedInsights(insights);
    
    // Generate recommended agents based on user activity and profile
    const recommended = [
      { name: 'Career Agent', priority: 1, reason: 'Most relevant to your goals' },
      { name: 'Money Agent', priority: 2, reason: 'High potential impact' },
      { name: 'Mind Agent', priority: 3, reason: 'Trending in your network' }
    ];
    setRecommendedAgents(recommended);
  };

  // Get agent by name for recommendations
  const getAgentByName = (name) => {
    return agentModules.find(agent => agent.name === name);
  };

  // Sort agents based on recommendations
  const getSortedAgents = () => {
    const agentsCopy = [...agentModules];
    const recommendedNames = recommendedAgents.map(r => r.name);
    
    return agentsCopy.sort((a, b) => {
      const aIndex = recommendedNames.indexOf(a.name);
      const bIndex = recommendedNames.indexOf(b.name);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
  };

  const fetchAvatar = async () => {
    try {
      const data = await profileAPI.getAvatarUrl();
      setAvatarUrl(data.url);
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  };

  // Handlers for navigation
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAccount = () => {
    navigate('/profile');
  };

  // Handler for Personal Assistant dialog
  const handlePersonalAssistant = () => {
    setIsAssistantDialogOpen(true);
    // Reset assistant position to bottom right corner
    if (window.resetAssistantPosition) {
      window.resetAssistantPosition();
    }
  };

  // Agent modules available in the dashboard
  const agentModules = [
    {
      name: 'Career Agent',
      description: 'Get personalized career advice, resume analysis, and job recommendations.',
      icon: BriefcaseIcon,
      color: 'text-blue-500',
      path: '/agents/career',
    },
    {
      name: 'Money Agent',
      description: 'Receive insights on financial planning, budgeting, and investment strategies.',
      icon: CurrencyDollarIcon,
      color: 'text-green-500',
      path: '/agents/money',
    },
    {
      name: 'Mind Agent',
      description: 'Support for mental well-being, stress management, and mindfulness.',
      icon: HeartIcon,
      color: 'text-pink-500',
      path: '/agents/mind',
    },
    {
      name: 'Travel Agent',
      description: 'Plan your next trip with personalized recommendations and itineraries.',
      icon: GlobeAltIcon,
      color: 'text-indigo-500',
      path: '/agents/travel',
    },
    {
      name: 'Body Agent',
      description: 'Personalized health and fitness guidance for your physical well-being.',
      icon: SparklesIcon,
      color: 'text-purple-500',
      path: '/agents/body',
    },
    {
      name: 'Family Life Agent',
      description: 'Support and advice for maintaining healthy family relationships and work-life balance.',
      icon: HomeIcon,
      color: 'text-yellow-500',
      path: '/agents/family-life',
    },
    {
      name: 'Hobby Agent',
      description: 'Discover and develop new interests, skills, and recreational activities.',
      icon: BookOpenIcon,
      color: 'text-orange-500',
      path: '/agents/hobby',
    },
    {
      name: 'Knowledge Agent',
      description: 'Enhance your learning journey with personalized knowledge management strategies.',
      icon: AcademicCapIcon,
      color: 'text-cyan-500',
      path: '/agents/knowledge',
    },
    {
      name: 'Personal Development Agent',
      description: 'Achieve personal growth through goal setting and skill development.',
      icon: FireIcon,
      color: 'text-red-500',
      path: '/agents/personal-dev',
    },
    {
      name: 'Spiritual Agent',
      description: 'Guidance for spiritual growth, meditation, and inner peace.',
      icon: SunIcon,
      color: 'text-amber-500',
      path: '/agents/spiritual',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Sadaora AI</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* User Profile Section - Clickable */}
              <button
                onClick={handleAccount}
                className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex-shrink-0">
                  {avatarUrl && !isImgError? (
                    <img
                      src={avatarUrl}
                      alt="User Avatar"
                      onError={() => setImgError(true)}
                      className="h-8 w-8 rounded-full object-cover border-2 border-blue-200"
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {userData.username || user?.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {userData.email || user?.email || ''}
                  </p>
                </div>
                <UserCircleIcon className="h-4 w-4 text-gray-400 hidden sm:block" />
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-8 shadow-lg">
                <SparklesIcon className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Welcome to Your
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                  Personal AI Assistant
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Discover personalized guidance across all aspects of your life. From career growth to wellness, 
                your AI companion is here to help you achieve your goals.
              </p>
              
              {/* Personal Assistant Quick Access */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                <button
                  onClick={handlePersonalAssistant}
                  className="group relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 flex items-center space-x-3 min-w-[280px]"
                >
                  <div className="flex items-center justify-center w-10 h-10 bg-white bg-opacity-20 rounded-full">
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Talk to Your AI Assistant</div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>
              
              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
                <div className="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <SparklesIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Intelligent Coordination</h3>
                  <p className="text-sm text-gray-600">Seamlessly connects all your AI agents for unified guidance</p>
                </div>
                
                <div className="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChatBubbleLeftRightIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Natural Conversation</h3>
                  <p className="text-sm text-gray-600">Chat naturally about any aspect of your life and goals</p>
                </div>
                
                <div className="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserCircleIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Personalized Insights</h3>
                  <p className="text-sm text-gray-600">Tailored recommendations based on your unique profile</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute top-40 right-20 w-24 h-24 bg-purple-200 rounded-full opacity-20 animate-pulse delay-1000"></div>
            <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-pink-200 rounded-full opacity-20 animate-pulse delay-2000"></div>
          </div>
        </div>

        <div className="text-center mb-24">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-6">
              <CommandLineIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Your AI 
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> Agent Network</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore specialized AI agents designed to support every aspect of your life journey.
            </p>
        </div>

        {/* AI Agents Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Circular Agents Layout */}
          <div className="mb-16 mt-16">
            <CircularAgents 
              agents={getSortedAgents()} 
              avatarUrl={avatarUrl}
              user={userData}
              triggerAnimation={triggerAnimation} 
            />
          </div>
        </div>

        {/* Personalized Insights Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mb-6">
                <LightBulbIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Your Personalized 
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> AI Insights</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-4xl mx-auto">
                Discover tailored recommendations and insights based on your unique profile and goals.
              </p>
            </div>

            {/* Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {personalizedInsights.map((insight) => {
              const IconComponent = insight.icon;
              return (
                <div key={insight.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 ${insight.color} rounded-xl flex items-center justify-center`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex items-center space-x-1">
                        {insight.priority === 'high' && (
                          <>
                            <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">High Priority</span>
                          </>
                        )}
                        {insight.priority === 'medium' && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Recommended</span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{insight.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">{insight.description}</p>
                    <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 group-hover:bg-blue-50 group-hover:text-blue-700">
                      {insight.action}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
            
            {/* Recent Activity Summary */}
            <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <ClockIcon className="h-6 w-6 text-gray-500" />
                  <h3 className="text-xl font-semibold text-gray-900">Recent AI Insights</h3>
                </div>
                <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Career progression analysis completed</p>
                    <p className="text-xs text-gray-500 mt-1">2 hours ago • Based on your recent profile updates</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Financial optimization suggestions ready</p>
                    <p className="text-xs text-gray-500 mt-1">1 day ago • Potential savings identified</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Wellness routine recommendations updated</p>
                    <p className="text-xs text-gray-500 mt-1">3 days ago • Personalized for your lifestyle</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Achievements & Goal Progress */}
          <div className="mt-12 bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mb-6">
                <StarIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your 
                <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent"> Achievements & Progress</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Track your personal growth journey and celebrate your milestones.
              </p>
            </div>

            {/* Achievement Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <FireIcon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">7 Day Streak</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Daily Engagement</h3>
                <p className="text-sm text-gray-600 mb-3">Consistent daily AI interactions</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{width: '70%'}}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">7/10 days to next level</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <BriefcaseIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">In Progress</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Career Goals</h3>
                <p className="text-sm text-gray-600 mb-3">Professional development milestones</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{width: '65%'}}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">3/5 objectives completed</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <HeartIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Excellent</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Wellness Score</h3>
                <p className="text-sm text-gray-600 mb-3">Overall health and mindfulness</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">85/100 wellness points</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <AcademicCapIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">Learning</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Knowledge Growth</h3>
                <p className="text-sm text-gray-600 mb-3">Skills and learning progress</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{width: '72%'}}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">12/15 learning modules</p>
              </div>
            </div>

            {/* Monthly Goals Overview */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
                Monthly Goals Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Career Development</span>
                    <span className="text-sm font-bold text-blue-600">80%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{width: '80%'}}></div>
                  </div>
                  <p className="text-xs text-gray-500">4/5 milestones achieved</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Financial Planning</span>
                    <span className="text-sm font-bold text-green-600">60%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{width: '60%'}}></div>
                  </div>
                  <p className="text-xs text-gray-500">3/5 targets completed</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Personal Wellness</span>
                    <span className="text-sm font-bold text-purple-600">90%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{width: '90%'}}></div>
                  </div>
                  <p className="text-xs text-gray-500">9/10 wellness goals met</p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily AI Recommendations */}
          <div className="mt-12 bg-gradient-to-r from-orange-50 to-pink-50 rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full mb-6">
                <SunIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Today's 
                <span className="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent"> AI Recommendations</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Personalized daily guidance to help you stay on track with your goals.
              </p>
            </div>

            {/* Daily Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-blue-500">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <BriefcaseIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Career Focus</h3>
                    <p className="text-sm text-gray-600 mb-3">Review your LinkedIn profile and update your skills section. Consider adding your recent project achievements.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">15 min task</span>
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Start Now →</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-green-500">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <HeartIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Wellness Boost</h3>
                    <p className="text-sm text-gray-600 mb-3">Take a 10-minute mindfulness break. Your stress levels seem elevated today - try the breathing exercise.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">10 min break</span>
                      <button className="text-xs text-green-600 hover:text-green-700 font-medium">Begin →</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-purple-500">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AcademicCapIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Learning Opportunity</h3>
                    <p className="text-sm text-gray-600 mb-3">Complete the next module in your data analysis course. You're 80% through - keep the momentum!</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">30 min study</span>
                      <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">Continue →</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Action for Today */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-orange-200">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <StarIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Priority Action for Today</h3>
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">HIGH IMPACT</span>
                  </div>
                  <p className="text-gray-600 mb-4">Based on your goals and recent activity, focus on completing your quarterly review presentation. This aligns with your career advancement objectives and has a deadline approaching.</p>
                  <div className="flex items-center space-x-4">
                    <button className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
                      Get Started
                    </button>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <ClockIcon className="h-4 w-4" />
                      <span>Estimated: 2 hours</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <StarIcon className="h-4 w-4" />
                      <span>Impact: Career Goal +20%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Assistant Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PersonalAssistant 
            user={userData} 
            isDialogOpen={isAssistantDialogOpen}
            setIsDialogOpen={setIsAssistantDialogOpen}
          />
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="max-w-6xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Life?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Start your journey with personalized AI assistance tailored to your unique goals and aspirations.
            </p>
            <button 
              onClick={handleAccount}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transform hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Customize Your Profile
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Terms Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Terms</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Cookie Policy
                    </a>
                  </li>
                </ul>
              </div>

              {/* Supports Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Support</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Feedback
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Docs
                    </a>
                  </li>
                </ul>
              </div>

              {/* Engage Section */}
              <div>
                <h3 className="text-white font-semibold mb-4">Engage</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Discord
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      Twitter X
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company Info */}
              <div>
                <h3 className="text-white font-semibold mb-4">Sadaora AI</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Empowering lives through personalized AI assistance across all aspects of personal and professional growth.
                </p>
              </div>
            </div>

            {/* Copyright */}
            <div className="border-t border-gray-800 mt-8 pt-8 text-center">
              <p className="text-gray-400 text-sm">
                Copyright © 2025. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;