/**
 * TemplateSelector - Modal for selecting note templates
 */
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  UsersIcon,
  CalendarDaysIcon,
  FolderIcon,
  LightBulbIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const iconMap = {
  'users': UsersIcon,
  'calendar-days': CalendarDaysIcon,
  'folder': FolderIcon,
  'light-bulb': LightBulbIcon,
  'document': DocumentTextIcon,
};

const TemplateSelector = ({
  isOpen,
  templates = [],
  onSelect,
  onClose,
  loading = false,
}) => {
  if (!isOpen) return null;

  const getIcon = (iconName) => {
    const Icon = iconMap[iconName] || DocumentTextIcon;
    return <Icon className="w-8 h-8" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Choose a Template</h2>
            <p className="text-sm text-gray-500">Start with a pre-built structure</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No templates available
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors group text-left"
                >
                  <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mb-3 text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                    {getIcon(template.icon)}
                  </div>
                  <h3 className="font-medium text-gray-900 text-center">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-500 text-center mt-1 line-clamp-2">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => onSelect(null)}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Start with a blank note
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
