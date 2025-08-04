import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  InformationCircleIcon,
  XMarkIcon,
  BellIcon
} from '@heroicons/react/24/outline';

const NotificationPanel = ({ notifications = [], onDismiss, maxVisible = 5 }) => {
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Show only the most recent notifications
    const recent = notifications.slice(-maxVisible);
    setVisibleNotifications(recent);
  }, [notifications, maxVisible]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
      case 'complete':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
      case 'progress':
      case 'info':
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
      case 'complete':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'progress':
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleDismiss = (notificationId) => {
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      {/* Notification Header */}
      <div className="bg-white rounded-t-lg shadow-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">
              Notifications ({notifications.length})
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className={`bg-white rounded-b-lg shadow-lg border-l border-r border-b border-gray-200 max-h-96 overflow-y-auto transition-all duration-200 ${
        isExpanded ? 'block' : 'hidden'
      }`}>
        {visibleNotifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No recent notifications
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleNotifications.map((notification, index) => (
              <div
                key={notification.id || index}
                className={`p-4 transition-all duration-200 hover:bg-gray-50 ${
                  getNotificationColor(notification.type)
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {notification.title && (
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {notification.title}
                          </p>
                        )}
                        <p className="text-sm text-gray-700">
                          {notification.message}
                        </p>
                        
                        {/* Progress Information */}
                        {notification.type === 'progress' && notification.progress !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{notification.current_section || 'Processing'}</span>
                              <span>{notification.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                style={{ width: `${notification.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Additional Details */}
                        {notification.details && (
                          <div className="mt-2 text-xs text-gray-600">
                            {notification.details}
                          </div>
                        )}
                      </div>
                      
                      {/* Dismiss Button */}
                      <button
                        onClick={() => handleDismiss(notification.id)}
                        className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="mt-2 text-xs text-gray-500">
                      {formatTimestamp(notification.timestamp || Date.now())}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Show More Button */}
        {notifications.length > maxVisible && (
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all {notifications.length} notifications
            </button>
          </div>
        )}
      </div>
      
      {/* Compact View (when collapsed) */}
      {!isExpanded && notifications.length > 0 && (
        <div className="bg-white rounded-b-lg shadow-lg border-l border-r border-b border-gray-200">
          <div className="p-3">
            <div className="flex items-center space-x-2">
              {getNotificationIcon(notifications[notifications.length - 1].type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">
                  {notifications[notifications.length - 1].message}
                </p>
                <p className="text-xs text-gray-500">
                  {formatTimestamp(notifications[notifications.length - 1].timestamp || Date.now())}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;