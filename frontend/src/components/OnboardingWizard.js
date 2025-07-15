import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profile as profileAPI } from '../services/api';
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  HeartIcon,
  MapPinIcon,
  AcademicCapIcon,
  HomeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center">
        {type === 'success' ? (
          <CheckIcon className="h-5 w-5 mr-2" />
        ) : (
          <XMarkIcon className="h-5 w-5 mr-2" />
        )}
        {message}
      </div>
    </div>
  );
};

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [profileData, setProfileData] = useState({
    // Career fields
    current_job: '',
    company: '',
    industry: '',
    experience: '',
    career_goals: '',
    skills: [],
    
    // Financial fields
    income_range: '',
    investment_experience: '',
    risk_tolerance: '',
    financial_goals: '',
    
    // Health fields
    fitness_level: '',
    health_goals: '',
    dietary_preferences: '',
    exercise_preferences: [],
    
    // Travel fields
    travel_style: '',
    preferred_destinations: [],
    travel_budget: '',
    travel_frequency: '',
    
    // Learning fields
    learning_style: '',
    education_level: '',
    learning_goals: [],
    
    // Personal fields
    personality_type: '',
    family_status: '',
    hobbies: [],
    interests: []
  });

  const steps = [
    {
      id: 'career',
      title: 'Career & Professional Life',
      icon: BriefcaseIcon,
      color: 'blue',
      description: 'Tell us about your professional background and goals'
    },
    {
      id: 'money',
      title: 'Financial Goals',
      icon: CurrencyDollarIcon,
      color: 'green',
      description: 'Share your financial situation and objectives'
    },
    {
      id: 'body',
      title: 'Health & Wellness',
      icon: HeartIcon,
      color: 'red',
      description: 'Let us know about your health and fitness preferences'
    },
    {
      id: 'travel',
      title: 'Travel & Adventure',
      icon: MapPinIcon,
      color: 'purple',
      description: 'Share your travel style and destination preferences'
    },
    {
      id: 'learning',
      title: 'Learning & Growth',
      icon: AcademicCapIcon,
      color: 'indigo',
      description: 'Tell us about your learning preferences and goals'
    }
  ];

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfileData(prev => ({ ...prev, [field]: array }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    navigate('/dashboard');
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      await profileAPI.updateProfile(profileData);
      showToast('Profile saved successfully!', 'success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Failed to save profile:', error);
      showToast('Failed to save profile. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = async () => {
    await saveProfile();
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'from-blue-500 to-blue-600 border-blue-200 bg-blue-50',
      green: 'from-green-500 to-green-600 border-green-200 bg-green-50',
      red: 'from-red-500 to-red-600 border-red-200 bg-red-50',
      purple: 'from-purple-500 to-purple-600 border-purple-200 bg-purple-50',
      indigo: 'from-indigo-500 to-indigo-600 border-indigo-200 bg-indigo-50'
    };
    return colorMap[color] || 'from-gray-500 to-gray-600 border-gray-200 bg-gray-50';
  };

  const renderStepContent = () => {
    const step = steps[currentStep];
    const colorClasses = getColorClasses(step.color);
    const Icon = step.icon;

    switch (step.id) {
      case 'career':
        return (
          <div className={`bg-gradient-to-r ${colorClasses} p-8 rounded-xl border`}>
            <div className="flex items-center mb-6">
              <Icon className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Job Title</label>
                <input
                  type="text"
                  value={profileData.current_job}
                  onChange={(e) => handleInputChange('current_job', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Software Engineer, Marketing Manager"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input
                  type="text"
                  value={profileData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Google, Microsoft, Startup Inc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={profileData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
                <select
                  value={profileData.experience}
                  onChange={(e) => handleInputChange('experience', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Experience</option>
                  <option value="Entry Level (0-2 years)">Entry Level (0-2 years)</option>
                  <option value="Mid Level (3-5 years)">Mid Level (3-5 years)</option>
                  <option value="Senior Level (6-10 years)">Senior Level (6-10 years)</option>
                  <option value="Lead/Principal (10+ years)">Lead/Principal (10+ years)</option>
                  <option value="Executive/C-Level">Executive/C-Level</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Key Skills (comma separated)</label>
              <input
                type="text"
                value={profileData.skills.join(', ')}
                onChange={(e) => handleArrayChange('skills', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g., JavaScript, Project Management, Data Analysis"
              />
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Career Goals</label>
              <textarea
                value={profileData.career_goals}
                onChange={(e) => handleInputChange('career_goals', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="What are your main career objectives and aspirations?"
              />
            </div>
          </div>
        );

      case 'money':
        return (
          <div className={`bg-gradient-to-r ${colorClasses} p-8 rounded-xl border`}>
            <div className="flex items-center mb-6">
              <Icon className="h-8 w-8 text-green-600 mr-4" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Income Range</label>
                <select
                  value={profileData.income_range}
                  onChange={(e) => handleInputChange('income_range', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Income Range</option>
                  <option value="Under $30k">Under $30k</option>
                  <option value="$30k-$50k">$30k-$50k</option>
                  <option value="$50k-$75k">$50k-$75k</option>
                  <option value="$75k-$100k">$75k-$100k</option>
                  <option value="$100k-$150k">$100k-$150k</option>
                  <option value="Over $150k">Over $150k</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Investment Experience</label>
                <select
                  value={profileData.investment_experience}
                  onChange={(e) => handleInputChange('investment_experience', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Experience</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Risk Tolerance</label>
                <select
                  value={profileData.risk_tolerance}
                  onChange={(e) => handleInputChange('risk_tolerance', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Risk Tolerance</option>
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Financial Goals</label>
              <textarea
                value={profileData.financial_goals}
                onChange={(e) => handleInputChange('financial_goals', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="What are your main financial objectives? (e.g., retirement planning, buying a house, debt reduction)"
              />
            </div>
          </div>
        );

      case 'body':
        return (
          <div className={`bg-gradient-to-r ${colorClasses} p-8 rounded-xl border`}>
            <div className="flex items-center mb-6">
              <Icon className="h-8 w-8 text-red-600 mr-4" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Fitness Level</label>
                <select
                  value={profileData.fitness_level}
                  onChange={(e) => handleInputChange('fitness_level', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Fitness Level</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Athlete">Athlete</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Preferences</label>
                <select
                  value={profileData.dietary_preferences}
                  onChange={(e) => handleInputChange('dietary_preferences', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Dietary Preference</option>
                  <option value="No restrictions">No restrictions</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Keto">Keto</option>
                  <option value="Paleo">Paleo</option>
                  <option value="Mediterranean">Mediterranean</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Exercise Preferences (comma separated)</label>
              <input
                type="text"
                value={profileData.exercise_preferences.join(', ')}
                onChange={(e) => handleArrayChange('exercise_preferences', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="e.g., Running, Yoga, Weight training, Swimming"
              />
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Health Goals</label>
              <textarea
                value={profileData.health_goals}
                onChange={(e) => handleInputChange('health_goals', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="What are your main health and wellness objectives?"
              />
            </div>
          </div>
        );

      case 'travel':
        return (
          <div className={`bg-gradient-to-r ${colorClasses} p-8 rounded-xl border`}>
            <div className="flex items-center mb-6">
              <Icon className="h-8 w-8 text-purple-600 mr-4" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Travel Style</label>
                <select
                  value={profileData.travel_style}
                  onChange={(e) => handleInputChange('travel_style', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Travel Style</option>
                  <option value="Budget">Budget</option>
                  <option value="Mid-range">Mid-range</option>
                  <option value="Luxury">Luxury</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Relaxation">Relaxation</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Travel Frequency</label>
                <select
                  value={profileData.travel_frequency}
                  onChange={(e) => handleInputChange('travel_frequency', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Frequency</option>
                  <option value="Rarely">Rarely</option>
                  <option value="1-2 times per year">1-2 times per year</option>
                  <option value="3-4 times per year">3-4 times per year</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Frequently">Frequently</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Travel Budget</label>
                <select
                  value={profileData.travel_budget}
                  onChange={(e) => handleInputChange('travel_budget', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Budget Range</option>
                  <option value="Under $1,000">Under $1,000</option>
                  <option value="$1,000-$3,000">$1,000-$3,000</option>
                  <option value="$3,000-$5,000">$3,000-$5,000</option>
                  <option value="$5,000-$10,000">$5,000-$10,000</option>
                  <option value="Over $10,000">Over $10,000</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Destinations (comma separated)</label>
              <input
                type="text"
                value={profileData.preferred_destinations.join(', ')}
                onChange={(e) => handleArrayChange('preferred_destinations', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="e.g., Europe, Asia, Beach destinations, Mountains"
              />
            </div>
          </div>
        );

      case 'learning':
        return (
          <div className={`bg-gradient-to-r ${colorClasses} p-8 rounded-xl border`}>
            <div className="flex items-center mb-6">
              <Icon className="h-8 w-8 text-indigo-600 mr-4" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Learning Style</label>
                <select
                  value={profileData.learning_style}
                  onChange={(e) => handleInputChange('learning_style', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Learning Style</option>
                  <option value="Visual">Visual</option>
                  <option value="Auditory">Auditory</option>
                  <option value="Kinesthetic">Kinesthetic</option>
                  <option value="Reading/Writing">Reading/Writing</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
                <select
                  value={profileData.education_level}
                  onChange={(e) => handleInputChange('education_level', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Education Level</option>
                  <option value="High School">High School</option>
                  <option value="Associate Degree">Associate Degree</option>
                  <option value="Bachelor's Degree">Bachelor's Degree</option>
                  <option value="Master's Degree">Master's Degree</option>
                  <option value="Doctorate">Doctorate</option>
                  <option value="Professional Certification">Professional Certification</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Learning Goals (comma separated)</label>
              <input
                type="text"
                value={profileData.learning_goals.join(', ')}
                onChange={(e) => handleArrayChange('learning_goals', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="e.g., Learn new programming language, Improve public speaking, Master data science"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Your AI Assistant!</h1>
          <p className="text-lg text-gray-600 mb-4">
            Let's personalize your experience by learning about you
          </p>
          <p className="text-sm text-gray-500">
            This will help us provide better recommendations and insights tailored to your needs
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Previous
              </button>
            )}
            
            <button
              onClick={skipOnboarding}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Skip for now
            </button>
          </div>

          <div className="flex space-x-4">
            {currentStep < steps.length - 1 ? (
              <button
                onClick={nextStep}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
              >
                Next
                <ArrowRightIcon className="h-5 w-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={finishOnboarding}
                disabled={loading}
                className="flex items-center px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-5 w-5 mr-2" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default OnboardingWizard;