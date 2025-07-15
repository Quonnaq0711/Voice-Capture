import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircleIcon } from '@heroicons/react/24/outline';

// Add CSS animation styles
const animationStyles = `
  @keyframes spinSlow {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('circular-agents-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'circular-agents-styles';
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}

const CircularAgents = ({ agents, avatarUrl, user, triggerAnimation = false }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(280);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const updateRadius = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        // Set radius to be a fraction of the container width, with min/max values
        const newRadius = Math.min(380, Math.max(220, width / 2.2));
        setRadius(newRadius);
      }
    };

    updateRadius();
    window.addEventListener('resize', updateRadius);

    return () => window.removeEventListener('resize', updateRadius);
  }, []);

  // Animation trigger effect
  useEffect(() => {
    if (triggerAnimation && user) {
      setIsAnimating(true);
      // Stop animation after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [triggerAnimation, user]);

  const gradients = [
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-purple-500',
    'from-purple-500 to-pink-500',
    'from-yellow-500 to-orange-500',
    'from-orange-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-red-500 to-pink-500',
    'from-amber-500 to-yellow-500'
  ];

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-[500px] md:h-[600px] mt-8">
      {/* Center Avatar */}
      <div className="absolute z-10 flex flex-col items-center" style={{ transform: 'translateY(-30px)' }}>
        <div className="h-36 w-36 md:h-40 md:w-40 rounded-full bg-gray-200 flex items-center justify-center">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="h-full w-full rounded-full object-cover border-4 border-white shadow-lg"
            />
          )}
        </div>
        <p className="mt-4 text-lg font-semibold text-gray-800">{user?.username || 'User'}</p>
      </div>

      {/* Agents in a Circle */}
      <div className="relative w-full h-full flex items-center justify-center transition-transform duration-[3000ms] ease-out"
      style={{
        animation: isAnimating ? 'spinSlow 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : 'none',
        transformOrigin: '50% calc(50% - 30px)'
      }}>
        {agents.map((agent, index) => {
          const angle = (index / agents.length) * 2 * Math.PI;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div
              key={agent.name}
              className="absolute group"
              style={{
                transform: `translate(${x}px, ${y - 30}px)`,
              }}
            >
              <button
                onClick={() => navigate(agent.path)}
                aria-label={`Explore ${agent.name}`}
                className="relative transform transition-transform duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 rounded-full"
              >
                <div className={`w-32 h-32 md:w-36 md:h-36 bg-gradient-to-br ${gradients[index % gradients.length]} rounded-full flex flex-col items-center justify-center shadow-lg cursor-pointer transition-all duration-300 group-hover:shadow-2xl`}>
                  <agent.icon className="h-10 w-10 md:h-12 md:w-12 text-white mb-2" />
                  <span className="text-white text-sm md:text-base font-bold text-center px-2 leading-tight">{agent.name}</span>
                </div>
              </button>
              <div
                role="tooltip"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-28 w-48 p-4 bg-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 pointer-events-none z-20"
              >
                <h4 className="font-bold text-gray-800 text-sm mb-1">{agent.name}</h4>
                <p className="text-gray-600 text-xs">{agent.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CircularAgents;