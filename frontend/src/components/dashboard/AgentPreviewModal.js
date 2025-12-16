import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function AgentPreviewModal({ isOpen, selectedAgent, onClose }) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when selectedAgent changes
  useEffect(() => {
    setImageError(false);
  }, [selectedAgent?.imageSrc]);

  if (!isOpen || !selectedAgent) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate pr-2">
            {selectedAgent.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-3 sm:p-6 overflow-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
          {imageError ? (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
              Preview image not found
            </div>
          ) : (
            <img
              src={selectedAgent.imageSrc}
              alt={selectedAgent.title}
              className="w-full h-auto rounded-lg shadow-sm"
              onError={() => setImageError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}