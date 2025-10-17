import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const AgentDesignModal = ({ isOpen, onClose, imageSrc, title }) => {
  // Handle escape key press to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-7xl max-h-[95vh] w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image container with scroll */}
        <div className="overflow-auto max-h-[calc(95vh-80px)] bg-gray-50">
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-auto"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Footer info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 text-white text-sm">
          <p className="text-center">Press ESC or click outside to close</p>
        </div>
      </div>
    </div>
  );
};

export default AgentDesignModal;
