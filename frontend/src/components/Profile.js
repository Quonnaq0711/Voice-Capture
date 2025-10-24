import React, { useState, useEffect, useRef } from 'react';
// import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePasswordCountDown } from '../contexts/PasswordReset';
import { profile as profileAPI, auth } from '../services/api';
import {
  UserCircleIcon,
  KeyIcon,
  PhotoIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  HeartIcon,
  MapPinIcon,
  AcademicCapIcon,
  HomeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon
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

// Confirmation dialog component
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onCancel}></div>
        
        {/* Dialog panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onConfirm}
            >
              Delete
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Usage Analytics Component
const UsageAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    weeklyUsage: [],
    agentStats: [],
    totalSessions: 0,
    totalMessages: 0,
    mostUsedAgent: '',
    loading: true
  });

  const agentTabs = [
    { id: 'career', name: 'Career', icon: BriefcaseIcon, color: 'blue' },
    { id: 'money', name: 'Money', icon: CurrencyDollarIcon, color: 'green' },
    { id: 'body', name: 'Body', icon: HeartIcon, color: 'red' },
    { id: 'travel', name: 'Travel', icon: MapPinIcon, color: 'purple' },
    { id: 'mind', name: 'Mind', icon: AcademicCapIcon, color: 'indigo' },
    { id: 'family', name: 'Family', icon: HomeIcon, color: 'orange' },
    { id: 'hobby', name: 'Hobby', icon: PuzzlePieceIcon, color: 'pink' },
    { id: 'knowledge', name: 'Knowledge', icon: BookOpenIcon, color: 'teal' },
    { id: 'spiritual', name: 'Spiritual', icon: SparklesIcon, color: 'yellow' }
  ];

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Simulate API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data for demonstration
      const mockData = {
        weeklyUsage: [
          { day: 'Mon', career: 12, money: 8, body: 5, travel: 3, mind: 15, family: 7, hobby: 4, knowledge: 10, spiritual: 2 },
          { day: 'Tue', career: 15, money: 12, body: 8, travel: 6, mind: 18, family: 9, hobby: 6, knowledge: 14, spiritual: 4 },
          { day: 'Wed', career: 18, money: 15, body: 12, travel: 8, mind: 22, family: 11, hobby: 8, knowledge: 16, spiritual: 6 },
          { day: 'Thu', career: 22, money: 18, body: 15, travel: 12, mind: 25, family: 14, hobby: 10, knowledge: 20, spiritual: 8 },
          { day: 'Fri', career: 25, money: 20, body: 18, travel: 15, mind: 28, family: 16, hobby: 12, knowledge: 22, spiritual: 10 },
          { day: 'Sat', career: 20, money: 16, body: 14, travel: 18, mind: 24, family: 20, hobby: 15, knowledge: 18, spiritual: 12 },
          { day: 'Sun', career: 16, money: 12, body: 10, travel: 14, mind: 20, family: 18, hobby: 14, knowledge: 16, spiritual: 15 }
        ],
        agentStats: [
          { agent: 'mind', usage: 162, sessions: 45, avgDuration: '8.5 min', trend: '+12%', satisfaction: 4.8, efficiency: 92 },
          { agent: 'career', usage: 128, sessions: 38, avgDuration: '12.3 min', trend: '+8%', satisfaction: 4.6, efficiency: 88 },
          { agent: 'knowledge', usage: 116, sessions: 35, avgDuration: '10.2 min', trend: '+15%', satisfaction: 4.7, efficiency: 90 },
          { agent: 'money', usage: 101, sessions: 32, avgDuration: '9.8 min', trend: '+5%', satisfaction: 4.5, efficiency: 85 },
          { agent: 'family', usage: 95, sessions: 28, avgDuration: '11.5 min', trend: '+18%', satisfaction: 4.9, efficiency: 94 },
          { agent: 'body', usage: 82, sessions: 25, avgDuration: '7.2 min', trend: '+3%', satisfaction: 4.4, efficiency: 82 },
          { agent: 'travel', usage: 76, sessions: 22, avgDuration: '13.1 min', trend: '+22%', satisfaction: 4.8, efficiency: 91 },
          { agent: 'hobby', usage: 69, sessions: 20, avgDuration: '6.8 min', trend: '+7%', satisfaction: 4.3, efficiency: 79 },
          { agent: 'spiritual', usage: 57, sessions: 18, avgDuration: '14.2 min', trend: '+25%', satisfaction: 4.9, efficiency: 95 }
        ],
        totalSessions: 263,
        totalMessages: 886,
        mostUsedAgent: 'mind',
        timeDistribution: {
          morning: { sessions: 78, percentage: 29.7, peak: '9:00 AM' },
          afternoon: { sessions: 102, percentage: 38.8, peak: '2:30 PM' },
          evening: { sessions: 68, percentage: 25.9, peak: '7:00 PM' },
          night: { sessions: 15, percentage: 5.7, peak: '11:30 PM' }
        },
        usagePatterns: {
          averageSessionLength: '10.2 min',
          longestSession: '45 min',
          shortestSession: '2 min',
          peakUsageDay: 'Friday',
          quietestDay: 'Sunday',
          streakDays: 12,
          weeklyGrowth: '+15.3%'
        },
        productivityMetrics: {
          taskCompletionRate: 87.5,
          averageResponseTime: '2.3s',
          userSatisfactionScore: 4.6,
          goalAchievementRate: 73.2,
          knowledgeRetentionScore: 82.1
        },
        monthlyComparison: [
          { month: 'Jan', sessions: 180, messages: 620, satisfaction: 4.2 },
          { month: 'Feb', sessions: 195, messages: 685, satisfaction: 4.3 },
          { month: 'Mar', sessions: 220, messages: 750, satisfaction: 4.5 },
          { month: 'Apr', sessions: 245, messages: 820, satisfaction: 4.6 },
          { month: 'May', sessions: 263, messages: 886, satisfaction: 4.6 }
        ],
        insights: [
          {
            type: 'peak_performance',
            title: 'Peak Performance Time',
            description: 'You are most productive between 2-4 PM with 38.8% of your sessions.',
            recommendation: 'Schedule important tasks during afternoon hours for optimal results.',
            impact: 'high'
          },
          {
            type: 'agent_preference',
            title: 'Learning Focus',
            description: 'Mind and Career agents account for 55% of your usage, showing strong focus on personal development.',
            recommendation: 'Consider exploring Body and Travel agents for a more balanced lifestyle approach.',
            impact: 'medium'
          },
          {
            type: 'consistency',
            title: 'Consistent Usage',
            description: 'You have maintained a 12-day streak, showing excellent engagement.',
            recommendation: 'Keep up the momentum! Set daily reminders to maintain your streak.',
            impact: 'high'
          },
          {
            type: 'efficiency',
            title: 'Session Efficiency',
            description: 'Your average session length of 10.2 minutes indicates focused, productive interactions.',
            recommendation: 'Continue with current session patterns for optimal learning outcomes.',
            impact: 'medium'
          }
        ]
      };
      
      setAnalyticsData({ ...mockData, loading: false });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setAnalyticsData(prev => ({ ...prev, loading: false }));
    }
  };

  const getAgentInfo = (agentId) => {
    return agentTabs.find(tab => tab.id === agentId) || { name: agentId, icon: ChartBarIcon, color: 'gray' };
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-500 text-blue-100 border-blue-400',
      green: 'bg-green-500 text-green-100 border-green-400',
      red: 'bg-red-500 text-red-100 border-red-400',
      purple: 'bg-purple-500 text-purple-100 border-purple-400',
      indigo: 'bg-indigo-500 text-indigo-100 border-indigo-400',
      orange: 'bg-orange-500 text-orange-100 border-orange-400',
      pink: 'bg-pink-500 text-pink-100 border-pink-400',
      teal: 'bg-teal-500 text-teal-100 border-teal-400',
      yellow: 'bg-yellow-500 text-yellow-100 border-yellow-400'
    };
    return colorMap[color] || 'bg-gray-500 text-gray-100 border-gray-400';
  };

  const SimpleLineChart = ({ data }) => {
    const maxValue = Math.max(...data.map(d => 
      Math.max(...agentTabs.map(agent => d[agent.id] || 0))
    ));
    
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-blue-600" />
          Weekly Usage Trends
        </h3>
        <div className="relative h-64">
          <svg className="w-full h-full" viewBox="0 0 700 200">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <line
                key={i}
                x1="50"
                y1={40 + i * 32}
                x2="650"
                y2={40 + i * 32}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
            ))}
            
            {/* Agent lines */}
            {agentTabs.slice(0, 5).map((agent, agentIndex) => {
              const points = data.map((d, i) => {
                const x = 50 + (i * 100);
                const y = 168 - ((d[agent.id] || 0) / maxValue) * 128;
                return `${x},${y}`;
              }).join(' ');
              
              const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'];
              
              return (
                <polyline
                  key={agent.id}
                  fill="none"
                  stroke={colors[agentIndex]}
                  strokeWidth="3"
                  points={points}
                  className="drop-shadow-sm"
                />
              );
            })}
            
            {/* Data points */}
            {agentTabs.slice(0, 5).map((agent, agentIndex) => {
              const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'];
              return data.map((d, i) => {
                const x = 50 + (i * 100);
                const y = 168 - ((d[agent.id] || 0) / maxValue) * 128;
                return (
                  <circle
                    key={`${agent.id}-${i}`}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={colors[agentIndex]}
                    className="drop-shadow-sm"
                  />
                );
              });
            })}
            
            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={i}
                x={50 + (i * 100)}
                y="190"
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {d.day}
              </text>
            ))}
          </svg>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            {agentTabs.slice(0, 5).map((agent, index) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-yellow-500'];
              return (
                <div key={agent.id} className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${colors[index]} mr-2`}></div>
                  <span className="text-sm text-gray-600">{agent.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (analyticsData.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
          <ChartBarIcon className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Usage Analytics</h2>
        <p className="text-gray-600">Track your AI assistant usage patterns and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Sessions</p>
              <p className="text-2xl font-bold text-blue-900">{analyticsData.totalSessions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Messages</p>
              <p className="text-2xl font-bold text-green-900">{analyticsData.totalMessages}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Most Used Agent</p>
              <p className="text-2xl font-bold text-purple-900 capitalize">{getAgentInfo(analyticsData.mostUsedAgent).name}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <FireIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Avg Session Time</p>
              <p className="text-2xl font-bold text-orange-900">9.8 min</p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Weekly Usage Chart */}
         <SimpleLineChart data={analyticsData.weeklyUsage} />
         
         {/* Agent Statistics */}
         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
           <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
             <FireIcon className="h-5 w-5 mr-2 text-orange-600" />
             Agent Performance
           </h3>
           <div className="space-y-3 max-h-64 overflow-y-auto">
             {analyticsData.agentStats.map((stat, index) => {
               const agentInfo = getAgentInfo(stat.agent);
               const Icon = agentInfo.icon;
               
               return (
                 <div key={stat.agent} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                   <div className="flex items-center space-x-3">
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(agentInfo.color)}`}>
                       <Icon className="h-4 w-4" />
                     </div>
                     <div>
                       <p className="font-medium text-gray-900 capitalize">{agentInfo.name}</p>
                       <p className="text-sm text-gray-600">{stat.sessions} sessions</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="font-bold text-gray-900">{stat.usage}</p>
                     <p className="text-sm text-green-600">{stat.trend}</p>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       </div>

       {/* Time Distribution Analysis */}
       <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
         <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
           <ClockIcon className="h-5 w-5 mr-2 text-purple-600" />
           Time Distribution Analysis
         </h3>
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {Object.entries(analyticsData.timeDistribution).map(([period, data]) => {
             const periodColors = {
               morning: 'from-yellow-400 to-orange-500',
               afternoon: 'from-blue-400 to-blue-600',
               evening: 'from-purple-400 to-purple-600',
               night: 'from-indigo-400 to-indigo-600'
             };
             
             return (
               <div key={period} className={`bg-gradient-to-br ${periodColors[period]} p-4 rounded-lg text-white`}>
                 <div className="text-center">
                   <h4 className="font-semibold capitalize mb-2">{period}</h4>
                   <p className="text-2xl font-bold">{data.sessions}</p>
                   <p className="text-sm opacity-90">{data.percentage}%</p>
                   <p className="text-xs opacity-75 mt-1">Peak: {data.peak}</p>
                 </div>
               </div>
             );
           })}
         </div>
       </div>

       {/* Usage Patterns & Productivity Metrics */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Usage Patterns */}
         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
           <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
             <ChartBarIcon className="h-5 w-5 mr-2 text-green-600" />
             Usage Patterns
           </h3>
           <div className="space-y-4">
             <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
               <span className="text-gray-700">Average Session</span>
               <span className="font-semibold text-gray-900">{analyticsData.usagePatterns.averageSessionLength}</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
               <span className="text-gray-700">Longest Session</span>
               <span className="font-semibold text-gray-900">{analyticsData.usagePatterns.longestSession}</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
               <span className="text-gray-700">Peak Usage Day</span>
               <span className="font-semibold text-gray-900">{analyticsData.usagePatterns.peakUsageDay}</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
               <span className="text-green-700">Current Streak</span>
               <span className="font-bold text-green-900">{analyticsData.usagePatterns.streakDays} days</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
               <span className="text-blue-700">Weekly Growth</span>
               <span className="font-bold text-blue-900">{analyticsData.usagePatterns.weeklyGrowth}</span>
             </div>
           </div>
         </div>

         {/* Productivity Metrics */}
         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
           <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
             <FireIcon className="h-5 w-5 mr-2 text-red-600" />
             Productivity Metrics
           </h3>
           <div className="space-y-4">
             {[
               { label: 'Task Completion', value: analyticsData.productivityMetrics.taskCompletionRate, unit: '%', color: 'blue' },
               { label: 'User Satisfaction', value: analyticsData.productivityMetrics.userSatisfactionScore, unit: '/5', color: 'green' },
               { label: 'Goal Achievement', value: analyticsData.productivityMetrics.goalAchievementRate, unit: '%', color: 'purple' },
               { label: 'Knowledge Retention', value: analyticsData.productivityMetrics.knowledgeRetentionScore, unit: '%', color: 'orange' }
             ].map((metric, index) => {
               const percentage = metric.unit === '%' ? metric.value : (metric.value / 5) * 100;
               const colorClasses = {
                 blue: 'bg-blue-500',
                 green: 'bg-green-500',
                 purple: 'bg-purple-500',
                 orange: 'bg-orange-500'
               };
               
               return (
                 <div key={index} className="space-y-2">
                   <div className="flex justify-between items-center">
                     <span className="text-gray-700">{metric.label}</span>
                     <span className="font-semibold text-gray-900">{metric.value}{metric.unit}</span>
                   </div>
                   <div className="w-full bg-gray-200 rounded-full h-2">
                     <div 
                       className={`h-2 rounded-full ${colorClasses[metric.color]} transition-all duration-500`}
                       style={{ width: `${percentage}%` }}
                     ></div>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       </div>

       {/* Monthly Comparison Chart */}
       <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
         <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
           <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600" />
           Monthly Progress Comparison
         </h3>
         <div className="relative h-64">
           <svg className="w-full h-full" viewBox="0 0 600 200">
             {/* Grid lines */}
             {[0, 1, 2, 3, 4].map(i => (
               <line
                 key={i}
                 x1="50"
                 y1={30 + i * 35}
                 x2="550"
                 y2={30 + i * 35}
                 stroke="#f3f4f6"
                 strokeWidth="1"
               />
             ))}
             
             {/* Sessions line */}
             <polyline
               fill="none"
               stroke="#3b82f6"
               strokeWidth="3"
               points={analyticsData.monthlyComparison.map((d, i) => {
                 const x = 50 + (i * 100);
                 const y = 170 - ((d.sessions / 300) * 140);
                 return `${x},${y}`;
               }).join(' ')}
               className="drop-shadow-sm"
             />
             
             {/* Messages line */}
             <polyline
               fill="none"
               stroke="#10b981"
               strokeWidth="3"
               points={analyticsData.monthlyComparison.map((d, i) => {
                 const x = 50 + (i * 100);
                 const y = 170 - ((d.messages / 1000) * 140);
                 return `${x},${y}`;
               }).join(' ')}
               className="drop-shadow-sm"
             />
             
             {/* Data points */}
             {analyticsData.monthlyComparison.map((d, i) => {
               const x = 50 + (i * 100);
               const sessionsY = 170 - ((d.sessions / 300) * 140);
               const messagesY = 170 - ((d.messages / 1000) * 140);
               return (
                 <g key={i}>
                   <circle cx={x} cy={sessionsY} r="4" fill="#3b82f6" className="drop-shadow-sm" />
                   <circle cx={x} cy={messagesY} r="4" fill="#10b981" className="drop-shadow-sm" />
                 </g>
               );
             })}
             
             {/* X-axis labels */}
             {analyticsData.monthlyComparison.map((d, i) => (
               <text
                 key={i}
                 x={50 + (i * 100)}
                 y="190"
                 textAnchor="middle"
                 className="text-xs fill-gray-600"
               >
                 {d.month}
               </text>
             ))}
           </svg>
           
           {/* Legend */}
           <div className="flex gap-6 mt-4">
             <div className="flex items-center">
               <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
               <span className="text-sm text-gray-600">Sessions</span>
             </div>
             <div className="flex items-center">
               <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
               <span className="text-sm text-gray-600">Messages</span>
             </div>
           </div>
         </div>
       </div>

       {/* AI-Powered Insights */}
       <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
         <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
           <SparklesIcon className="h-5 w-5 mr-2 text-yellow-600" />
           AI-Powered Insights & Recommendations
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {analyticsData.insights.map((insight, index) => {
             const impactColors = {
               high: 'border-red-200 bg-red-50',
               medium: 'border-yellow-200 bg-yellow-50',
               low: 'border-green-200 bg-green-50'
             };
             
             const impactIcons = {
               high: '🔥',
               medium: '⚡',
               low: '💡'
             };
             
             return (
               <div key={index} className={`p-4 rounded-lg border-2 ${impactColors[insight.impact]} hover:shadow-md transition-shadow`}>
                 <div className="flex items-start space-x-3">
                   <span className="text-2xl">{impactIcons[insight.impact]}</span>
                   <div className="flex-1">
                     <h4 className="font-semibold text-gray-900 mb-2">{insight.title}</h4>
                     <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
                     <div className="bg-white p-3 rounded border border-gray-200">
                       <p className="text-xs font-medium text-gray-600 mb-1">💡 Recommendation:</p>
                       <p className="text-sm text-gray-800">{insight.recommendation}</p>
                     </div>
                     <div className="mt-2">
                       <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                         insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                         insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                         'bg-green-100 text-green-800'
                       }`}>
                         {insight.impact.toUpperCase()} IMPACT
                       </span>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })}
         </div>
       </div>

      {/* Detailed Statistics */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-indigo-600" />
          Detailed Agent Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Agent</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Total Usage</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Sessions</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Avg Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Growth</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.agentStats.map((stat, index) => {
                const agentInfo = getAgentInfo(stat.agent);
                const Icon = agentInfo.icon;
                
                return (
                  <tr key={stat.agent} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(agentInfo.color)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-900 capitalize">{agentInfo.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{stat.usage}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.sessions}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.avgDuration}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {stat.trend}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Resume management component that combines upload and list
const ResumeManager = () => {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const resumeList = await auth.getResumes();
      setResumes(resumeList);
    } catch (error) {
      showToast('Failed to load resumes: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleUploadSuccess = () => {
    fetchResumes(); // Refresh the list after successful upload
  };

  const handlePreview = (resume) => {
    // Open resume in new tab for preview
    // Use relative path that works in both development and production
    const resumeUrl = `/resumes/${resume.user_id}/${resume.filename}`;
    window.open(resumeUrl, '_blank');
  };

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, resume: null });

  const handleDelete = (resume) => {
    setConfirmDialog({ isOpen: true, resume });
  };

  const confirmDelete = async () => {
    try {
      await auth.deleteResume(confirmDialog.resume.id);
      showToast('Resume deleted successfully', 'success');
      fetchResumes(); // Refresh the list
    } catch (error) {
      showToast('Failed to delete resume: ' + error.message, 'error');
    } finally {
      setConfirmDialog({ isOpen: false, resume: null });
    }
  };

  const cancelDelete = () => {
    setConfirmDialog({ isOpen: false, resume: null });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType) => {
    return <DocumentIcon className="h-5 w-5 text-red-500" />;
  };

  return (
    <>
      <ResumeUpload onUploadSuccess={handleUploadSuccess} />
      <ResumeList 
        resumes={resumes} 
        loading={loading} 
        onPreview={handlePreview}
        onDelete={handleDelete}
        formatDate={formatDate}
        getFileIcon={getFileIcon}
      />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Resume"
        message={`Are you sure you want to delete "${confirmDialog.resume?.original_filename}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

// Resume list component
const ResumeList = ({ resumes, loading, onPreview, onDelete, formatDate, getFileIcon }) => {

  if (loading) {
    return (
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-2">Resume History</label>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-300 h-10 w-10"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">Resume History</label>
      
      {resumes.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">No resumes uploaded yet</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {resumes.map((resume) => (
            <div key={resume.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(resume.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {resume.original_filename}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      <span>{formatDate(resume.created_at)}</span>
                      <span className="mx-2">•</span>
                      <span className="uppercase">{resume.file_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onPreview(resume)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <EyeIcon className="h-3 w-3 mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => onDelete(resume)}
                    className="inline-flex items-center px-3 py-1 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <TrashIcon className="h-3 w-3 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Resume upload component
const ResumeUpload = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const timersRef = useRef({ progressInterval: null, completionTimeout: null });

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (timersRef.current.progressInterval) {
        clearInterval(timersRef.current.progressInterval);
      }
      if (timersRef.current.completionTimeout) {
        clearTimeout(timersRef.current.completionTimeout);
      }
    };
  }, []);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please upload a PDF, DOC, or DOCX file', 'error');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      timersRef.current.progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(timersRef.current.progressInterval);
            timersRef.current.progressInterval = null;
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await auth.uploadResume(file);
      
      if (timersRef.current.progressInterval) {
        clearInterval(timersRef.current.progressInterval);
        timersRef.current.progressInterval = null;
      }
      setUploadProgress(100);

      timersRef.current.completionTimeout = setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        showToast('Resume uploaded successfully!', 'success');
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        timersRef.current.completionTimeout = null;
      }, 500);
    } catch (error) {
      if (timersRef.current.progressInterval) {
        clearInterval(timersRef.current.progressInterval);
        timersRef.current.progressInterval = null;
      }
      if (timersRef.current.completionTimeout) {
        clearTimeout(timersRef.current.completionTimeout);
        timersRef.current.completionTimeout = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
      showToast('Failed to upload resume: ' + error.message, 'error');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">Resume</label>
      
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="text-center">
          {isUploading ? (
            <div className="space-y-4">
              <div className="animate-spin mx-auto h-8 w-8 text-blue-600">
                <CloudArrowUpIcon className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Uploading resume...</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">{uploadProgress}%</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">
                  Click to upload or drag and drop
                </div>
                <div className="text-sm text-gray-500">
                  PDF, DOC, DOCX up to 10MB
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
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

// Individual Agent Profile Components
const CareerProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Handle comma-separated input by storing as string during editing
  const handleArrayInputChange = (field, value) => {
    // Store the raw string value directly without processing
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Convert string to array when input loses focus
  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  // Helper to get display value for array fields
  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      {/* Basic Career Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
        <div className="flex items-center mb-4">
          <BriefcaseIcon className="h-6 w-6 text-blue-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Basic Career Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResumeManager />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Job</label>
            <input
              type="text"
              value={profile.current_job || ''}
              onChange={(e) => handleInputChange('current_job', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Software Engineer"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
            <input
              type="text"
              value={profile.company || ''}
              onChange={(e) => handleInputChange('company', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Google, Microsoft"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
            <select
              value={profile.industry || ''}
              onChange={(e) => handleInputChange('industry', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Industry</option>
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Education">Education</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Retail">Retail</option>
              <option value="Consulting">Consulting</option>
              <option value="Media & Entertainment">Media & Entertainment</option>
              <option value="Government">Government</option>
              <option value="Non-profit">Non-profit</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
            <select
              value={profile.experience || ''}
              onChange={(e) => handleInputChange('experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Experience</option>
              <option value="Entry Level (0-2 years)">Entry Level (0-2 years)</option>
              <option value="Mid Level (3-5 years)">Mid Level (3-5 years)</option>
              <option value="Senior Level (6-10 years)">Senior Level (6-10 years)</option>
              <option value="Lead/Principal (10+ years)">Lead/Principal (10+ years)</option>
              <option value="Executive/C-Level">Executive/C-Level</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Style Preference</label>
            <select
              value={profile.work_style || ''}
              onChange={(e) => handleInputChange('work_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Work Style</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leadership Experience</label>
            <select
              value={profile.leadership_experience || ''}
              onChange={(e) => handleInputChange('leadership_experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Leadership Level</option>
              <option value="No leadership experience">No leadership experience</option>
              <option value="Team lead (2-5 people)">Team lead (2-5 people)</option>
              <option value="Manager (5-15 people)">Manager (5-15 people)</option>
              <option value="Senior Manager (15+ people)">Senior Manager (15+ people)</option>
              <option value="Director/VP">Director/VP</option>
              <option value="C-Level Executive">C-Level Executive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills & Competencies */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-100">
        <div className="flex items-center mb-4">
          <AcademicCapIcon className="h-6 w-6 text-purple-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Skills & Competencies</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Technical Skills (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('skills')}
              onChange={(e) => handleArrayInputChange('skills', e.target.value)}
              onBlur={(e) => handleArrayBlur('skills', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., JavaScript, Python, Project Management, Data Analysis"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Soft Skills (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('soft_skills')}
              onChange={(e) => handleArrayInputChange('soft_skills', e.target.value)}
              onBlur={(e) => handleArrayBlur('soft_skills', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Communication, Leadership, Problem Solving, Teamwork"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Certifications & Achievements (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('certifications')}
              onChange={(e) => handleArrayInputChange('certifications', e.target.value)}
              onBlur={(e) => handleArrayBlur('certifications', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., PMP, AWS Certified, MBA, Published Research"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Skill Development (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('skill_gaps')}
              onChange={(e) => handleArrayInputChange('skill_gaps', e.target.value)}
              onBlur={(e) => handleArrayBlur('skill_gaps', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Machine Learning, Public Speaking, Strategic Planning"
            />
          </div>
        </div>
      </div>

      {/* Career Goals & Aspirations */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-xl border border-green-100">
        <div className="flex items-center mb-4">
          <SparklesIcon className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Career Goals & Aspirations</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Short-term Goals (1-2 years)</label>
            <textarea
              value={profile.short_term_goals || ''}
              onChange={(e) => handleInputChange('short_term_goals', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="What do you want to achieve in the next 1-2 years?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Long-term Career Vision (5-10 years)</label>
            <textarea
              value={profile.career_goals || ''}
              onChange={(e) => handleInputChange('career_goals', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="Describe your long-term career aspirations and vision..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Career Path</label>
            <select
              value={profile.career_path_preference || ''}
              onChange={(e) => handleInputChange('career_path_preference', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="">Select Career Path</option>
              <option value="Individual Contributor">Individual Contributor</option>
              <option value="People Management">People Management</option>
              <option value="Technical Leadership">Technical Leadership</option>
              <option value="Entrepreneurship">Entrepreneurship</option>
              <option value="Consulting">Consulting</option>
              <option value="Academia/Research">Academia/Research</option>
              <option value="Cross-functional">Cross-functional</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industries of Interest (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('target_industries')}
              onChange={(e) => handleArrayInputChange('target_industries', e.target.value)}
              onBlur={(e) => handleArrayBlur('target_industries', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="e.g., FinTech, HealthTech, AI/ML, Sustainability"
            />
          </div>
        </div>
      </div>

      {/* Work Preferences & Values */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-100">
        <div className="flex items-center mb-4">
          <HeartIcon className="h-6 w-6 text-orange-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Work Preferences & Values</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work-Life Balance Priority</label>
            <select
              value={profile.work_life_balance_priority || ''}
              onChange={(e) => handleInputChange('work_life_balance_priority', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Priority</option>
              <option value="Work-focused">Work-focused</option>
              <option value="Balanced">Balanced</option>
              <option value="Life-focused">Life-focused</option>
              <option value="Flexible/Seasonal">Flexible/Seasonal</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Size Preference</label>
            <select
              value={profile.company_size_preference || ''}
              onChange={(e) => handleInputChange('company_size_preference', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Company Size</option>
              <option value="Startup (1-50)">Startup (1-50)</option>
              <option value="Small (51-200)">Small (51-200)</option>
              <option value="Medium (201-1000)">Medium (201-1000)</option>
              <option value="Large (1000+)">Large (1000+)</option>
              <option value="No preference">No preference</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Tolerance in Career</label>
            <select
              value={profile.career_risk_tolerance || ''}
              onChange={(e) => handleInputChange('career_risk_tolerance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Risk Tolerance</option>
              <option value="Conservative">Conservative (Stable, established companies)</option>
              <option value="Moderate">Moderate (Mix of stability and growth)</option>
              <option value="Aggressive">Aggressive (High-growth, high-risk opportunities)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Geographic Flexibility</label>
            <select
              value={profile.geographic_flexibility || ''}
              onChange={(e) => handleInputChange('geographic_flexibility', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Flexibility</option>
              <option value="Local only">Local only</option>
              <option value="Regional">Regional</option>
              <option value="National">National</option>
              <option value="International">International</option>
              <option value="Fully remote">Fully remote</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Core Work Values (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('work_values')}
              onChange={(e) => handleArrayInputChange('work_values', e.target.value)}
              onBlur={(e) => handleArrayBlur('work_values', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="e.g., Innovation, Impact, Autonomy, Collaboration, Growth"
          />
        </div>
      </div>

      {/* Career Challenges & Development */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-center mb-4">
          <PuzzlePieceIcon className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Career Challenges & Development</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Career Challenges</label>
            <textarea
              value={profile.career_challenges || ''}
              onChange={(e) => handleInputChange('career_challenges', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What challenges are you currently facing in your career?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Professional Strengths (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('professional_strengths')}
              onChange={(e) => handleArrayInputChange('professional_strengths', e.target.value)}
              onBlur={(e) => handleArrayBlur('professional_strengths', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Strategic thinking, Team building, Technical expertise"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Professional Growth (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('growth_areas')}
              onChange={(e) => handleArrayInputChange('growth_areas', e.target.value)}
              onBlur={(e) => handleArrayBlur('growth_areas', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Executive presence, Cross-cultural communication, Data science"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Learning & Development Methods (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('learning_preferences')}
              onChange={(e) => handleArrayInputChange('learning_preferences', e.target.value)}
              onBlur={(e) => handleArrayBlur('learning_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Mentoring, Online courses, Conferences, On-the-job training"
            />
          </div>
        </div>
      </div>
        
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Career Profile'}
        </button>
      </div>
    </div>
  );
};

const MoneyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
        <div className="flex items-center mb-4">
          <CurrencyDollarIcon className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Financial Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Income Range</label>
            <select
              value={profile.income_range || ''}
              onChange={(e) => handleInputChange('income_range', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
              value={profile.investment_experience || ''}
              onChange={(e) => handleInputChange('investment_experience', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
              value={profile.risk_tolerance || ''}
              onChange={(e) => handleInputChange('risk_tolerance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
            value={profile.financial_goals || ''}
            onChange={(e) => handleInputChange('financial_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            placeholder="Describe your financial goals and objectives..."
          />
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Financial Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BodyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-100">
        <div className="flex items-center mb-4">
          <HeartIcon className="h-6 w-6 text-red-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Health & Fitness</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fitness Level</label>
            <select
              value={profile.fitness_level || ''}
              onChange={(e) => handleInputChange('fitness_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
              value={profile.dietary_preferences || ''}
              onChange={(e) => handleInputChange('dietary_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            >
              <option value="">Select Dietary Preference</option>
              <option value="No Restrictions">No Restrictions</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Keto">Keto</option>
              <option value="Paleo">Paleo</option>
              <option value="Mediterranean">Mediterranean</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Exercise Preferences (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('exercise_preferences')}
              onChange={(e) => handleArrayInputChange('exercise_preferences', e.target.value)}
              onBlur={(e) => handleArrayBlur('exercise_preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="e.g., Running, Weight Training, Yoga"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Health Goals</label>
          <textarea
            value={profile.health_goals || ''}
            onChange={(e) => handleInputChange('health_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            placeholder="Describe your health and fitness goals..."
          />
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Health Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TravelProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-100">
        <div className="flex items-center mb-4">
          <MapPinIcon className="h-6 w-6 text-purple-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Travel Preferences</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Style</label>
            <select
              value={profile.travel_style || ''}
              onChange={(e) => handleInputChange('travel_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Budget</label>
            <select
              value={profile.travel_budget || ''}
              onChange={(e) => handleInputChange('travel_budget', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="">Select Budget Range</option>
              <option value="Under $1000">Under $1000</option>
              <option value="$1000-$3000">$1000-$3000</option>
              <option value="$3000-$5000">$3000-$5000</option>
              <option value="$5000-$10000">$5000-$10000</option>
              <option value="Over $10000">Over $10000</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Frequency</label>
            <select
              value={profile.travel_frequency || ''}
              onChange={(e) => handleInputChange('travel_frequency', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="">Select Frequency</option>
              <option value="Rarely">Rarely</option>
              <option value="Once a year">Once a year</option>
              <option value="2-3 times a year">2-3 times a year</option>
              <option value="Monthly">Monthly</option>
              <option value="Frequently">Frequently</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Destinations (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('preferred_destinations')}
              onChange={(e) => handleArrayInputChange('preferred_destinations', e.target.value)}
              onBlur={(e) => handleArrayBlur('preferred_destinations', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="e.g., Europe, Asia, Beach destinations"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Travel Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MindProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-center mb-4">
          <AcademicCapIcon className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Personal Development</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learning Style</label>
            <select
              value={profile.learning_style || ''}
              onChange={(e) => handleInputChange('learning_style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">Select Learning Style</option>
              <option value="Visual">Visual</option>
              <option value="Auditory">Auditory</option>
              <option value="Kinesthetic">Kinesthetic</option>
              <option value="Reading/Writing">Reading/Writing</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Personality Type</label>
            <input
              type="text"
              value={profile.personality_type || ''}
              onChange={(e) => handleInputChange('personality_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., INTJ, ENFP (Myers-Briggs)"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Strengths (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('strengths')}
              onChange={(e) => handleArrayInputChange('strengths', e.target.value)}
              onBlur={(e) => handleArrayBlur('strengths', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Communication, Problem-solving, Leadership"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas for Improvement (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('areas_for_improvement')}
              onChange={(e) => handleArrayInputChange('areas_for_improvement', e.target.value)}
              onBlur={(e) => handleArrayBlur('areas_for_improvement', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Time management, Public speaking"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Mind Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FamilyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
        <div className="flex items-center mb-4">
          <HomeIcon className="h-6 w-6 text-orange-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Family & Lifestyle</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Family Status</label>
            <select
              value={profile.family_status || ''}
              onChange={(e) => handleInputChange('family_status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Family Status</option>
              <option value="Single">Single</option>
              <option value="In a relationship">In a relationship</option>
              <option value="Married">Married</option>
              <option value="Married with children">Married with children</option>
              <option value="Single parent">Single parent</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work-Life Balance</label>
            <select
              value={profile.work_life_balance || ''}
              onChange={(e) => handleInputChange('work_life_balance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Select Balance Level</option>
              <option value="Work-focused">Work-focused</option>
              <option value="Balanced">Balanced</option>
              <option value="Life-focused">Life-focused</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Goals</label>
          <textarea
            value={profile.relationship_goals || ''}
            onChange={(e) => handleInputChange('relationship_goals', e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="Describe your relationship and family goals..."
          />
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Family Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const HobbyProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-6 rounded-xl border border-pink-100">
        <div className="flex items-center mb-4">
          <PuzzlePieceIcon className="h-6 w-6 text-pink-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Hobbies & Interests</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hobbies (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('hobbies')}
              onChange={(e) => handleArrayInputChange('hobbies', e.target.value)}
              onBlur={(e) => handleArrayBlur('hobbies', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Reading, Photography, Cooking, Gaming"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('interests')}
              onChange={(e) => handleArrayInputChange('interests', e.target.value)}
              onBlur={(e) => handleArrayBlur('interests', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Technology, Art, Music, Sports"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Creative Pursuits (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('creative_pursuits')}
              onChange={(e) => handleArrayInputChange('creative_pursuits', e.target.value)}
              onBlur={(e) => handleArrayBlur('creative_pursuits', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="e.g., Writing, Painting, Music composition, Crafting"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Hobby Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const KnowledgeProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-xl border border-teal-100">
        <div className="flex items-center mb-4">
          <BookOpenIcon className="h-6 w-6 text-teal-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Education & Learning</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
            <select
              value={profile.education_level || ''}
              onChange={(e) => handleInputChange('education_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Learning Methods (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('preferred_learning_methods')}
              onChange={(e) => handleArrayInputChange('preferred_learning_methods', e.target.value)}
              onBlur={(e) => handleArrayBlur('preferred_learning_methods', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="e.g., Online courses, Books, Workshops, Mentoring"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Learning Goals (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('learning_goals')}
              onChange={(e) => handleArrayInputChange('learning_goals', e.target.value)}
              onBlur={(e) => handleArrayBlur('learning_goals', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            placeholder="e.g., Learn new programming language, Improve communication skills"
          />
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Knowledge Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SpiritualProfile = ({ profile, setProfile, onSave, loading }) => {
  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayBlur = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setProfile(prev => ({ ...prev, [field]: array }));
  };

  const getArrayDisplayValue = (field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-100">
        <div className="flex items-center mb-4">
          <SparklesIcon className="h-6 w-6 text-yellow-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Spiritual & Mindfulness</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mindfulness Level</label>
            <select
              value={profile.mindfulness_level || ''}
              onChange={(e) => handleInputChange('mindfulness_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
            >
              <option value="">Select Mindfulness Level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Spiritual Practices (comma separated)</label>
            <input
              type="text"
              value={getArrayDisplayValue('spiritual_practices')}
              onChange={(e) => handleArrayInputChange('spiritual_practices', e.target.value)}
              onBlur={(e) => handleArrayBlur('spiritual_practices', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
              placeholder="e.g., Meditation, Prayer, Yoga, Journaling"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Stress Management Techniques (comma separated)</label>
          <input
            type="text"
            value={getArrayDisplayValue('stress_management')}
              onChange={(e) => handleArrayInputChange('stress_management', e.target.value)}
              onBlur={(e) => handleArrayBlur('stress_management', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
            placeholder="e.g., Deep breathing, Exercise, Music, Nature walks"
          />
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Spiritual Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Profile Component
const Profile = () => {
  // const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [activeAgentTab, setActiveAgentTab] = useState('career');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { banner, daysLeft, closeBanner } = usePasswordCountDown();
  
  // User data state
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(null);
  // const [avatarFile, setAvatarFile] = useState(null);
  const [isImgError, setImgError] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({
    // Career fields
    current_job: '',
    industry: '',
    experience: '',
    career_goals: '',
    skills: [],
    
    // Money fields
    income_range: '',
    financial_goals: '',
    investment_experience: '',
    risk_tolerance: '',
    
    // Body fields
    fitness_level: '',
    health_goals: '',
    dietary_preferences: '',
    exercise_preferences: [],
    
    // Travel fields
    travel_style: '',
    preferred_destinations: [],
    travel_budget: '',
    travel_frequency: '',
    
    // Mind fields
    learning_style: '',
    personality_type: '',
    strengths: [],
    areas_for_improvement: [],
    
    // Family Life fields
    family_status: '',
    relationship_goals: '',
    work_life_balance: '',
    
    // Hobby fields
    hobbies: [],
    interests: [],
    creative_pursuits: [],
    
    // Knowledge fields
    education_level: '',
    learning_goals: [],
    preferred_learning_methods: [],
    
    // Spiritual fields
    spiritual_practices: [],
    mindfulness_level: '',
    stress_management: []
  });

  useEffect(() => {
    fetchUserData();
    fetchUserProfile();
    fetchAvatar();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      setUserData({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const data = await profileAPI.getProfile();
      setProfile(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchAvatar = async () => {
    try {
      const data = await profileAPI.getAvatarUrl();
      // In development mode, prepend backend URL to relative avatar paths
      let url = data.url;
      if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        url = backendUrl + url;
      }

      // Add timestamp to force cache refresh
      const timestamp = new Date().getTime();
      const urlWithTimestamp = url.includes('?')
        ? `${url}&t=${timestamp}`
        : `${url}?t=${timestamp}`;

      setAvatarUrl(urlWithTimestamp);
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      await profileAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setMessage('Password updated successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setShowPasswordChange(false);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      e.target.value = ''; // Reset file input
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      e.target.value = ''; // Reset file input
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await profileAPI.uploadAvatar(file);

      // Add cache-busting timestamp to force browser to reload the image
      const timestamp = new Date().getTime();
      let url = data.url;

      // In development mode, prepend backend URL to relative avatar paths
      if (process.env.NODE_ENV !== 'production' && url && url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        url = backendUrl + url;
      }

      // Add cache-busting parameter
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}t=${timestamp}`;

      // Reset image error state before setting new avatar
      setImgError(false);
      setAvatarUrl(url);
      setMessage('Avatar updated successfully');
    } catch (error) {
      // Handle specific error cases
      let errorMessage = 'Failed to upload avatar';
      if (error.response) {
        if (error.response.status === 413) {
          errorMessage = 'Image is too large. Maximum size is 5MB.';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.status === 400) {
          errorMessage = 'Invalid image format. Please upload JPG, PNG, or GIF files only.';
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input for next upload
    }
  };

  const handleAvatarDelete = async () => {
    setLoading(true);
    setImgError(true);
    setMessage('');
    
    try {
      await profileAPI.deleteAvatar();
      setAvatarUrl(null);
      setMessage('Avatar deleted successfully');
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      await profileAPI.saveProfile(profile);
      setMessage('Profile saved successfully');
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const agentTabs = [
    { id: 'career', name: 'Career', icon: BriefcaseIcon, color: 'blue' },
    { id: 'money', name: 'Money', icon: CurrencyDollarIcon, color: 'green' },
    { id: 'body', name: 'Body', icon: HeartIcon, color: 'red' },
    { id: 'travel', name: 'Travel', icon: MapPinIcon, color: 'purple' },
    { id: 'mind', name: 'Mind', icon: AcademicCapIcon, color: 'indigo' },
    { id: 'family', name: 'Family', icon: HomeIcon, color: 'orange' },
    { id: 'hobby', name: 'Hobby', icon: PuzzlePieceIcon, color: 'pink' },
    { id: 'knowledge', name: 'Knowledge', icon: BookOpenIcon, color: 'teal' },
    { id: 'spiritual', name: 'Spiritual', icon: SparklesIcon, color: 'yellow' }
  ];

  const renderAgentProfile = () => {
    switch (activeAgentTab) {
      case 'career':
        return <CareerProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'money':
        return <MoneyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'body':
        return <BodyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'travel':
        return <TravelProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'mind':
        return <MindProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'family':
        return <FamilyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'hobby':
        return <HobbyProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'knowledge':
        return <KnowledgeProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      case 'spiritual':
        return <SpiritualProfile profile={profile} setProfile={setProfile} onSave={handleProfileSave} loading={loading} />;
      default:
        return <div className="text-center py-8 text-gray-500">Coming Soon...</div>;
    }
  };

   return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and personal profile</p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckIcon className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800">{message}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <XMarkIcon className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
         )}
         
        {banner && (
          <div className="relative bg-yellow-200 text-yellow-900 px-4 py-3 border border-black flex items-center justify-between rounded-md">
            <p className="text-sm sm:text-base">
              ⚠️ Your password needs to be updated in {daysLeft} day {daysLeft !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={closeBanner}
              className="absolute right-4 top-3 bg-transparent border-0 text-yellow-900 hover:text-yellow-950 cursor-pointer text-lg leading-none"
              aria-label="Close banner"
            >
              ×
            </button>
          </div>
        )}                            

        {/* Main Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden top-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('account')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'account'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircleIcon className="h-5 w-5 inline mr-2" />
                Account Settings
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircleIcon className="h-5 w-5 inline mr-2" />
                Personal Profile
              </button>
              <button
                disabled
                className="py-4 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-300 cursor-not-allowed relative group"
              >
                <ChartBarIcon className="h-5 w-5 inline mr-2 opacity-50" />
                <span className="opacity-50">Usage Analytics</span>
                <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded">Coming Soon</span>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'account' && (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Welcome Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                    <UserCircleIcon className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h2>
                  <p className="text-gray-600">Manage your personal assistant profile and preferences</p>
                </div>

                {/* User Profile Card */}
                <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {avatarUrl && !isImgError? (
                          <img
                            src={avatarUrl}
                            alt="Profile"
                            onError={()=> setImgError(true)}
                            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-blue-100"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-4 border-white shadow-lg ring-4 ring-blue-100">
                            <UserCircleIcon className="h-14 w-14 text-white" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{userData.first_name || 'User'}</h3>
                        <p className="text-gray-600">{userData.email}</p>
                        <div className="flex items-center mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm text-green-600 font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <label className="cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                        <PhotoIcon className="h-5 w-5 inline mr-2" />
                        Upload Avatar
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500 text-center px-2">
                        JPG, PNG, GIF, or WebP up to 5MB
                      </p>
                      {avatarUrl &&  (
                        <button
                          onClick={handleAvatarDelete}
                          className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <TrashIcon className="h-5 w-5 inline mr-2" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Information Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center mr-4">
                        <UserCircleIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                        <p className="text-sm text-gray-600">Your account details</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">First Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={userData.first_name}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Last Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={userData.last_name || ''}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>


                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            value={userData.email}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                        <KeyIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Security</h3>
                        <p className="text-sm text-gray-600">Password and security settings</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                          <div>
                             <p className="font-semibold text-gray-900">Password Protection</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowPasswordChange(!showPasswordChange)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <KeyIcon className="h-4 w-4 inline mr-2" />
                          Change Password
                        </button>
                      </div>
                      
                      {showPasswordChange && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 mt-6">
                          <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                              <input
                                type="password"
                                value={passwordData.current_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Enter current password"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                              <input
                                type="password"
                                value={passwordData.new_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Enter new password"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                              <input
                                type="password"
                                value={passwordData.confirm_password}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Confirm new password"
                                required
                              />
                            </div>
                            <div className="flex space-x-4 pt-4">
                              <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                {loading ? 'Updating...' : 'Update Password'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPasswordChange(false)}
                                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>


              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                {/* Agent Tabs */}
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-1 overflow-x-auto">
                      {agentTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeAgentTab === tab.id;
                        
                        // Define color classes for each tab
                        const getTabClasses = () => {
                          if (!isActive) {
                            return 'text-gray-500 hover:text-gray-700 hover:bg-gray-50';
                          }
                          
                          switch (tab.color) {
                            case 'blue':
                              return 'bg-blue-50 text-blue-700 border-b-2 border-blue-500';
                            case 'green':
                              return 'bg-green-50 text-green-700 border-b-2 border-green-500';
                            case 'red':
                              return 'bg-red-50 text-red-700 border-b-2 border-red-500';
                            case 'purple':
                              return 'bg-purple-50 text-purple-700 border-b-2 border-purple-500';
                            case 'indigo':
                              return 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500';
                            case 'orange':
                              return 'bg-orange-50 text-orange-700 border-b-2 border-orange-500';
                            case 'pink':
                              return 'bg-pink-50 text-pink-700 border-b-2 border-pink-500';
                            case 'teal':
                              return 'bg-teal-50 text-teal-700 border-b-2 border-teal-500';
                            case 'yellow':
                              return 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500';
                            default:
                              return 'bg-gray-50 text-gray-700 border-b-2 border-gray-500';
                          }
                        };
                        
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveAgentTab(tab.id)}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${getTabClasses()}`}
                          >
                            <Icon className="h-4 w-4 mr-2" />
                            {tab.name}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>

                {/* Agent Profile Content */}
                <div>
                  {renderAgentProfile()}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <UsageAnalytics />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;