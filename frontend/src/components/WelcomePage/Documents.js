import { useState, useEffect, useRef } from 'react';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  TrashIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';
import activitiesAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function Documents({ 
  analysisProgress, 
  setAnalysisProgress, 
  setSectionStatus, 
  setProfessionalData, 
  addNotification, 
  setLastAnalyzedDocumentId,
  onUploadClick // Optional callback when upload is initiated
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, document: null });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const timersRef = useRef({ progressInterval: null, completionTimeout: null });
  const auth = useAuth();

  // Toast notification component
  const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }, [onClose]);

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
        <div className="flex items-center space-x-2">
          {type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      </div>
    );
  };

  // Confirmation dialog component
  const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

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

  // Fetch documents from API
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const documentList = await auth.getResumes();
      setDocuments(documentList);
      
      // Track activity
      await activitiesAPI.createActivity({
        activity_type: 'view',
        activity_source: 'documents',
        activity_title: 'Viewed Documents',
        activity_description: `Viewed document library with ${documentList.length} documents`,
        activity_metadata: { document_count: documentList.length }
      });
    } catch (error) {
      console.error('Failed to load documents:', error);
      showToast('Failed to load documents: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type - Support PDF, DOCX, and TXT
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please upload a PDF, DOCX, or TXT file', 'error');
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

      // Track upload activity
      await activitiesAPI.createActivity({
        activity_type: 'upload',
        activity_source: 'documents',
        activity_title: `Uploaded ${file.name}`,
        activity_description: 'Document uploaded successfully',
        activity_metadata: {
          filename: file.name,
          size: `${(file.size / 1024).toFixed(0)}KB`,
          file_type: file.type
        }
      });

      timersRef.current.completionTimeout = setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        showToast('Document uploaded successfully!', 'success');
        fetchDocuments(); // Refresh the list
        if (onUploadClick) {
          onUploadClick();
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
      showToast('Failed to upload document: ' + error.message, 'error');
    }
  };

  // Drag and drop handlers
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

  // Handle document preview
  const handlePreview = async (document) => {
    // Track preview activity
    await activitiesAPI.createActivity({
      activity_type: 'view',
      activity_source: 'documents',
      activity_title: `Previewed ${document.original_filename}`,
      activity_description: 'Opened document preview',
      activity_metadata: { document_id: document.id, filename: document.original_filename }
    });

    // Open document in new tab for preview
    const documentUrl = process.env.NODE_ENV === 'production'
      ? `/resumes/${document.user_id}/${document.filename}`
      : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/resumes/${document.user_id}/${document.filename}`;
    window.open(documentUrl, '_blank');
  };

  // Handle document analysis
  const handleAnalyze = async (document) => {
    if (analysisProgress?.isAnalyzing) {
      console.log('Analysis already in progress, ignoring request');
      return;
    }

    try {
      // Track resume analysis activity
      await activitiesAPI.createActivity({
        activity_type: 'analysis',
        activity_source: 'documents',
        activity_title: `Analyzing ${document.original_filename}`,
        activity_description: 'Started resume analysis',
        activity_metadata: {
          resume_filename: document.original_filename,
          document_id: document.id,
          source_type: 'document_history'
        }
      });

      // Reset analysis state
      if (setAnalysisProgress) {
        setAnalysisProgress({
          isAnalyzing: true,
          currentSection: null,
          completedSections: [],
          totalSections: 7,
          progress: 0,
          error: null
        });
      }

      if (setLastAnalyzedDocumentId) {
        setLastAnalyzedDocumentId(document.id);
      }

      showToast('Starting document analysis...', 'success');
      // Add your analysis logic here
    } catch (error) {
      console.error('Analysis failed:', error);
      showToast('Failed to analyze document: ' + error.message, 'error');
    }
  };

  // Handle document delete
  const handleDelete = (document) => {
    setConfirmDialog({ isOpen: true, document });
  };

  const confirmDelete = async () => {
    try {
      await auth.deleteResume(confirmDialog.document.id);
      
      // Track delete activity
      await activitiesAPI.createActivity({
        activity_type: 'delete',
        activity_source: 'documents',
        activity_title: `Deleted ${confirmDialog.document.original_filename}`,
        activity_description: 'Document deleted from library',
        activity_metadata: { document_id: confirmDialog.document.id }
      });

      showToast('Document deleted successfully', 'success');
      fetchDocuments(); // Refresh the list
      setConfirmDialog({ isOpen: false, document: null });
    } catch (error) {
      showToast('Failed to delete document: ' + error.message, 'error');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get file icon based on type
  const getFileIcon = (fileType) => {
    const iconClass = "h-8 w-8 text-gray-400";
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return <DocumentTextIcon className={iconClass + " text-red-500"} />;
      case 'docx':
        return <DocumentIcon className={iconClass + " text-blue-500"} />;
      case 'txt':
        return <DocumentIcon className={iconClass} />;
      default:
        return <DocumentIcon className={iconClass} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Documents</h1>
        <p className="text-gray-600">Manage your resumes and career documents</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-4">Upload Document</label>
        
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 ${
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
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="text-center">
            {isUploading ? (
              <div className="space-y-4">
                <div className="animate-spin mx-auto h-12 w-12 text-blue-600">
                  <CloudArrowUpIcon className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Uploading document...</div>
                  <div className="max-w-xs mx-auto w-full bg-gray-200 rounded-full h-2">
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
                <DocumentArrowUpIcon className="mx-auto h-16 w-16 text-gray-400" />
                <div className="space-y-2">
                  <div className="text-base font-medium text-gray-900">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-sm text-gray-500">
                    PDF, DOCX, TXT up to 10MB
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document List Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-4">Document History</label>
        
        {loading ? (
          // Loading skeleton
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex space-x-4">
                  <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : documents.length === 0 ? (
          // Empty state
          <div className="border border-gray-200 rounded-lg p-12 text-center">
            <DocumentIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-base mb-4">No documents uploaded yet</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Upload Your First Document
            </button>
          </div>
        ) : (
          // Document list
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {documents.map((document) => (
              <div key={document.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(document.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {document.original_filename}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        <span>{formatDate(document.created_at)}</span>
                        <span className="mx-2">•</span>
                        <span className="uppercase">{document.file_type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handlePreview(document)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <EyeIcon className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                    <button
                      onClick={() => handleAnalyze(document)}
                      disabled={analysisProgress?.isAnalyzing}
                      className="inline-flex items-center px-3 py-1.5 border border-green-300 shadow-sm text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChartBarIcon className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Analyze</span>
                    </button>
                    <button
                      onClick={() => handleDelete(document)}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Document"
        message={`Are you sure you want to delete "${confirmDialog.document?.original_filename}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, document: null })}
      />
    </div>
  );
}