import { useState, useEffect, useRef } from 'react';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  TrashIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';
import { Search, Filter, X, FileText, FileType, File } from 'lucide-react';
import { activities as activitiesAPI, auth as authAPI } from '../../services/api';
import { formatDate } from '../../utils/timeFormatter';

export default function Documents({
  onUploadClick // Optional callback when upload is initiated
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, document: null });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // 'all', 'pdf', 'docx', 'txt'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const fileInputRef = useRef(null);
  const timersRef = useRef({ progressInterval: null, completionTimeout: null });
  const hasTrackedInitialView = useRef(false); // Prevent duplicate "Viewed Documents" tracking

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
  const fetchDocuments = async (trackActivity = true) => {
    try {
      setLoading(true);
      const documentList = await authAPI.getResumes();
      setDocuments(documentList);

      // Track activity only on initial view (not on refresh after upload)
      // Use ref to prevent duplicate tracking in React StrictMode
      if (trackActivity && !hasTrackedInitialView.current) {
        hasTrackedInitialView.current = true;
        await activitiesAPI.createActivity({
          activity_type: 'view',
          activity_source: 'documents',
          activity_title: 'Viewed Documents',
          activity_description: `Viewed document library with ${documentList.length} documents`,
          activity_metadata: { document_count: documentList.length }
        });
      }
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

      await authAPI.uploadResume(file);
      
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

  // Handle document delete
  const handleDelete = (document) => {
    setConfirmDialog({ isOpen: true, document });
  };

  const confirmDelete = async () => {
    try {
      await authAPI.deleteResume(confirmDialog.document.id);
      
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

  // Format date - using centralized timezone-aware formatter

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

  // Filter documents by search query and document type
  const getFilteredDocuments = () => {
    let filtered = [...documents];

    // Apply document type filter
    if (docTypeFilter !== 'all') {
      filtered = filtered.filter(doc =>
        doc.file_type?.toLowerCase() === docTypeFilter.toLowerCase()
      );
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc =>
        doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  // Get paginated documents
  const getPaginatedDocuments = () => {
    const filtered = getFilteredDocuments();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const getTotalPages = () => {
    const filtered = getFilteredDocuments();
    return Math.ceil(filtered.length / itemsPerPage);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Handle search change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Search Bar and Filters */}
        {documents.length > 0 && (
          <div className="p-3 sm:p-4 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
            <div className="space-y-3">
              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filters Section */}
              <div className="space-y-3">
                {/* Filter Header with Active Count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">Filters</span>
                    {(docTypeFilter !== 'all' || searchQuery) && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                        {(docTypeFilter !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0)} active
                      </span>
                    )}
                  </div>
                  {(docTypeFilter !== 'all' || searchQuery) && (
                    <button
                      onClick={() => {
                        setDocTypeFilter('all');
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                {/* Document Type Filter - Chip Style with Icons */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileType className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">Document Type</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all', label: 'All', icon: null, color: 'gray' },
                      { value: 'pdf', label: 'PDF', icon: FileText, color: 'red' },
                      { value: 'docx', label: 'DOCX', icon: File, color: 'blue' },
                      { value: 'txt', label: 'TXT', icon: File, color: 'green' }
                    ].map((filter) => {
                      const isActive = docTypeFilter === filter.value;
                      const IconComponent = filter.icon;
                      const colorClasses = {
                        gray: isActive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                        red: isActive ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:border-red-300',
                        blue: isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300',
                        green: isActive ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-200 hover:border-green-300'
                      };
                      return (
                        <button
                          key={filter.value}
                          onClick={() => {
                            setDocTypeFilter(filter.value);
                            setCurrentPage(1);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${colorClasses[filter.color]}`}
                        >
                          {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document List */}
        <div className="p-3 sm:p-4">
          {loading ? (
            // Loading skeleton
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-3"></div>
              <p className="text-sm text-gray-500">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <DocumentIcon className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No documents yet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">Upload a document to get started</p>
            </div>
          ) : getFilteredDocuments().length === 0 ? (
            // No search/filter results
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No matching documents</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                {searchQuery || docTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Try a different search term'}
              </p>
              {(searchQuery || docTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDocTypeFilter('all');
                    setCurrentPage(1);
                  }}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Document Cards */}
              <div className="space-y-2 mb-4">
                {getPaginatedDocuments().map((document) => (
                  <div
                    key={document.id}
                    className="relative bg-white border border-gray-200 rounded-lg p-3 hover:border-orange-300 hover:shadow-md transition-all duration-200 group hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getFileIcon(document.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {document.original_filename}
                          </p>
                          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                            <div className="flex items-center">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              <span>{formatDate(document.created_at)}</span>
                            </div>
                            <span className="uppercase font-medium">{document.file_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handlePreview(document)}
                          className="inline-flex items-center px-2 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <EyeIcon className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                        <button
                          onClick={() => handleDelete(document)}
                          className="inline-flex items-center px-2 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
                        >
                          <TrashIcon className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {getTotalPages() > 1 && (
                <div className="flex items-center justify-center space-x-2 pt-4 border-t border-gray-100">
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Previous
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((pageNum) => {
                      const showPage =
                        pageNum === 1 ||
                        pageNum === getTotalPages() ||
                        Math.abs(pageNum - currentPage) <= 1;

                      if (!showPage) {
                        if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                          return <span key={pageNum} className="text-gray-400 px-2">...</span>;
                        }
                        return null;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === getTotalPages()}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === getTotalPages()
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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