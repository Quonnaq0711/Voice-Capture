import React, { useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';

const NotificationPanel = ({ notifications = [], onDismiss }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getNotificationIcon = (type, size = 'h-5 w-5', color = null) => {
    const iconColor = color || (() => {
      switch (type) {
        case 'success':
        case 'complete':
          return 'text-green-600';
        case 'error':
          return 'text-red-600';
        case 'progress':
        case 'info':
        default:
          return 'text-blue-600';
      }
    })();

    switch (type) {
      case 'success':
      case 'complete':
        return <CheckCircleIcon className={`${size} ${iconColor}`} />;
      case 'error':
        return <ExclamationCircleIcon className={`${size} ${iconColor}`} />;
      case 'progress':
      case 'info':
      default:
        return <InformationCircleIcon className={`${size} ${iconColor}`} />;
    }
  };


  const getDropdownItemStyles = (type) => {
    switch (type) {
      case 'success':
      case 'complete':
        return 'border-l-green-400';
      case 'error':
        return 'border-l-red-400';
      case 'progress':
      case 'info':
      default:
        return 'border-l-blue-400';
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Notification Bell Icon */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {unreadCount > 0 ? (
            <BellIconSolid className="h-6 w-6" />
          ) : (
            <BellIcon className="h-6 w-6" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                 <button
                   onClick={() => setIsDropdownOpen(false)}
                   className="text-gray-400 hover:text-gray-600 transition-colors"
                 >
                   <XMarkIcon className="h-5 w-5" />
                 </button>
               </div>
               {notifications.length > 0 && (
                 <p className="text-sm text-gray-500 mt-1">
                   {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
                 </p>
               )}
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                   <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                   <p className="text-gray-500 text-sm">No notifications</p>
                 </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.slice().reverse().map((notification, index) => (
                    <div
                      key={notification.id || index}
                      className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${
                        getDropdownItemStyles(notification.type)
                      } ${!notification.read ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type, 'h-5 w-5')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {notification.title && (
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {notification.title}
                                </p>
                              )}
                              <p className="text-sm text-gray-700 leading-relaxed">
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
                                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                                  {notification.details}
                                </div>
                              )}
                            </div>
                            
                            <button
                              onClick={() => handleDismiss(notification.id)}
                              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp || Date.now())}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <button
                   onClick={() => {
                     notifications.forEach(n => handleDismiss(n.id));
                     setIsDropdownOpen(false);
                   }}
                   className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors font-medium"
                 >
                   Clear all notifications
                 </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        ></div>
      )}
    </>
  );
};

export default NotificationPanel;