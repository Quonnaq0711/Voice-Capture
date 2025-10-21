import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profile as profileAPI, sessions as sessionsAPI, auth, activities as activitiesAPI } from '../services/api';
import { getCareerInsights, hasCareerInsights, getCareerInsightsByResume } from '../services/chatApi';
import PersonalAssistant from './PersonalAssistant';
// Progress tracking is now handled in ChatDialog
// import ProgressTracker from './ProgressTracker';
import NotificationPanel from './NotificationPanel';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer, RadialBarChart, RadialBar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// Import Heroicons
import {
  BriefcaseIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  LightBulbIcon,
  AcademicCapIcon,
  TrophyIcon,
  ClockIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
  RocketLaunchIcon,
  ScaleIcon,
  ChartPieIcon,
  Bars3BottomLeftIcon,
  PresentationChartLineIcon,
  UsersIcon,
  CpuChipIcon,
  UserGroupIcon,
  // TargetIcon, // Not available in heroicons
  MapIcon,
  ArrowRightIcon,
  HeartIcon,
  CogIcon,
  MinusIcon,
  FaceSmileIcon,
  CalendarIcon,
  ChevronDownIcon,
  BellIcon,
  FlagIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  TrashIcon
} from '@heroicons/react/24/solid';
import { 
  Home, 
  Lightbulb, 
  Map, 
  Briefcase, 
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Star,
  Sun,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { selectAllAppliedNumericalValuesIncludingErrorValues } from 'recharts/types/state/selectors/axisSelectors';

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

// Document upload component
const DocumentUpload = ({ onUploadSuccess }) => {
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

      timersRef.current.completionTimeout = setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        showToast('Document uploaded successfully!', 'success');
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
      showToast('Failed to upload document: ' + error.message, 'error');
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
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Document</label>
      
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
          accept=".pdf,.docx,.txt"
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
                <div className="text-sm text-gray-600">Uploading document...</div>
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
                  PDF, DOCX, TXT up to 10MB
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

// Document list component
const DocumentList = ({ documents, loading, onPreview, onDelete, onAnalyze, formatDate, getFileIcon }) => {
  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Document History</label>
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
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Document History</label>
      
      {documents.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {documents.map((document) => (
            <div key={document.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
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
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onPreview(document)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <EyeIcon className="h-3 w-3 mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => onAnalyze(document)}
                    className="inline-flex items-center px-3 py-1 border border-green-300 shadow-sm text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    <ChartBarIcon className="h-3 w-3 mr-1" />
                    Analyze
                  </button>
                  <button
                    onClick={() => onDelete(document)}
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

// Document manager component that combines upload and list
const DocumentManager = ({ analysisProgress, setAnalysisProgress, setSectionStatus, setProfessionalData, addNotification, setLastAnalyzedDocumentId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const documentList = await auth.getResumes();
      setDocuments(documentList);
    } catch (error) {
      showToast('Failed to load documents: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadSuccess = () => {
    fetchDocuments(); // Refresh the list after successful upload
  };

  const handlePreview = (document) => {
    // Open document in new tab for preview
    // Use relative path (proxied through Nginx in production)
    const documentUrl = process.env.NODE_ENV === 'production'
      ? `/resumes/${document.user_id}/${document.filename}`
      : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/resumes/${document.user_id}/${document.filename}`;
    window.open(documentUrl, '_blank');
  };

  const handleAnalyze = async (document) => {
    if (analysisProgress.isAnalyzing) {
      console.log('Analysis already in progress, ignoring request');
      return;
    }

    try {
      // Track resume analysis activity
      await activitiesAPI.createActivity({
        activity_type: 'resume_analysis',
        activity_source: 'career',
        activity_title: 'Resume Analysis - Document History',
        activity_description: `Analyzed resume: ${document.original_filename}`,
        activity_metadata: {
          resume_filename: document.original_filename,
          document_id: document.id,
          source_type: 'document_history'
        }
      });
      // Reset analysis state
      setAnalysisProgress({
        isAnalyzing: true,
        currentSection: null,
        completedSections: [],
        totalSections: 7,
        progress: 0,
        error: null
      });

      setSectionStatus({
        professionalIdentity: 'pending',
        workExperience: 'pending',
        skillsAnalysis: 'pending',
        marketPosition: 'pending',
        careerTrajectory: 'pending',
        strengthsWeaknesses: 'pending',
        salaryAnalysis: 'pending'
      });

      // Clear existing professional data to prepare for new analysis
      setProfessionalData({
        professionalIdentity: { title: '', summary: '', keyHighlights: [], currentRole: '', currentIndustry: '', currentCompany: '', location: '' },
        workExperience: { totalYears: 0, timelineStart: null, timelineEnd: null, analytics: { workingYears: { years: '', period: '' }, heldRoles: { count: '', longest: '' }, heldTitles: { count: '', shortest: '' }, companies: { count: '', longest: '' }, insights: { gaps: '', shortestTenure: '', companyChanges: '', careerProgression: '' } } },
        skillsAnalysis: { hardSkills: [], softSkills: [], coreStrengths: [], developmentAreas: [] },
        marketPosition: { competitiveness: 0, skillRelevance: 0, industryDemand: 0, careerPotential: 0 },
        careerTrajectory: [],
        strengthsWeaknesses: { strengths: [], weaknesses: [] },
        salaryAnalysis: { currentSalary: null, historicalTrends: [], marketComparison: null, predictedGrowth: null, salaryFactors: [], recommendations: [] }
      });

      // Store the document ID for later retrieval of analysis results
      setLastAnalyzedDocumentId(document.id);
      
      addNotification({
        type: 'progress',
        title: 'Resume Analysis Started',
        message: `Starting comprehensive analysis of ${document.original_filename}`,
        details: 'This may take a few minutes. You will see real-time updates as each section completes.'
      });
      
      // Call the streaming API with the specific document ID
      // Use relative path in production (proxied through Nginx), localhost in development
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/career/analyze_resume_streaming'
        : (process.env.REACT_APP_CAREER_URL || 'http://localhost:6002') + '/api/career/analyze_resume_streaming';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          user_id: String(document.user_id),
          resume_id: String(document.id)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Received streaming data:', data);
              
              // Handle different types of streaming responses
              if (data.type === 'section_progress') {
                // Update state directly for immediate UI feedback
                setAnalysisProgress(prev => ({
                  ...prev,
                  currentSection: data.section,
                  progress: data.progress || prev.progress,
                  totalSections: data.total_sections || 7,
                  isAnalyzing: true
                }));
                
                setSectionStatus(prev => ({
                  ...prev,
                  [data.section]: 'analyzing'
                }));
                
                // Add progress notification
                const sectionName = data.section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                addNotification({
                  type: 'progress',
                  title: 'Analysis in Progress',
                  message: `Analyzing ${sectionName}...`,
                  current_section: sectionName,
                  progress: data.progress || 0,
                  details: `Processing section ${data.progress ? Math.ceil(data.progress / (100 / (data.total_sections || 7))) : 1} of ${data.total_sections || 7}`
                });
                
                // Also dispatch event for compatibility
                const progressEvent = new CustomEvent('analysisProgress', {
                  detail: {
                    section: data.section,
                    status: 'analyzing',
                    progress: data.progress,
                    totalSections: data.total_sections || 7
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(progressEvent);
              } else if (data.type === 'section_complete') {
                console.log('Section completed:', data.section, data.data);
                
                // Update state directly for immediate UI feedback
                if (data.data) {
                  // Update professional data with the new section data
                  const sectionData = data.data[data.section] || data.data;
                  setProfessionalData(prev => {
                    const newData = {
                      ...prev,
                      [data.section]: sectionData
                    };
                    console.log(`Updated professional data for section ${data.section}:`, newData);
                    return newData;
                  });
                }
                
                // Update section status
                setSectionStatus(prev => {
                  const newStatus = { ...prev, [data.section]: 'completed' };
                  console.log('Updated section status:', newStatus);
                  return newStatus;
                });
                
                // Update analysis progress
                setAnalysisProgress(prev => {
                  const newCompletedSections = [...prev.completedSections, data.section];
                  const newProgress = Math.round((newCompletedSections.length / prev.totalSections) * 100);
                  return {
                    ...prev,
                    completedSections: newCompletedSections,
                    progress: newProgress,
                    currentSection: null
                  };
                });

                // Add section completion notification
                const sectionName = data.section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                addNotification({
                  type: 'complete',
                  title: `✅ ${sectionName} Complete`,
                  message: `${sectionName} analysis completed successfully! New insights are now available in your career profile.`,
                  timestamp: Date.now()
                });

                // Also dispatch event for compatibility
                const completeEvent = new CustomEvent('sectionComplete', {
                  detail: {
                    section: data.section,
                    data: data.data,
                    error: data.error
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(completeEvent);
              } else if (data.type === 'analysis_complete') {
                console.log('Analysis completed:', data);
                
                // Update state directly for immediate UI feedback
                setAnalysisProgress(prev => ({
                  ...prev,
                  isAnalyzing: false,
                  currentSection: null,
                  progress: data.success ? 100 : prev.progress,
                  error: data.error || null
                }));
                
                // If backend returns complete data, merge it with existing professionalData
                if (data.professional_data) {
                  const finalData = data.professional_data;
                  setProfessionalData(prev => ({
                    ...prev,
                    ...finalData
                  }));
                }
                
                // Add completion notification
                if (data.success) {
                  addNotification({
                    type: 'complete',
                    title: 'Analysis Complete!',
                    message: 'Your comprehensive career analysis is now ready',
                    details: 'All sections have been analyzed. Explore your insights to discover new opportunities.'
                  });
                } else if (data.error) {
                  addNotification({
                    type: 'error',
                    title: 'Analysis Failed',
                    message: 'There was an error completing your career analysis',
                    details: data.error
                  });
                }
                
                // Also dispatch event for compatibility
                const analysisCompleteEvent = new CustomEvent('analysisComplete', {
                  detail: {
                    success: data.success,
                    error: data.error,
                    professional_data: data.professional_data
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(analysisCompleteEvent);
                break;
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing document:', error);
      setAnalysisProgress(prev => ({
        ...prev,
        isAnalyzing: false,
        error: `Failed to analyze resume: ${error.message}`
      }));
      
      addNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: `Failed to analyze ${document.original_filename}`,
        details: error.message || 'An unexpected error occurred during analysis'
      });
    }
  };

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, document: null });

  const handleDelete = (document) => {
    setConfirmDialog({ isOpen: true, document });
  };

  const confirmDelete = async () => {
    try {
      await auth.deleteResume(confirmDialog.document.id);
      showToast('Document deleted successfully', 'success');
      fetchDocuments(); // Refresh the list
    } catch (error) {
      showToast('Failed to delete document: ' + error.message, 'error');
    } finally {
      setConfirmDialog({ isOpen: false, document: null });
    }
  };

  const cancelDelete = () => {
    setConfirmDialog({ isOpen: false, document: null });
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
      <DocumentUpload onUploadSuccess={handleUploadSuccess} />
      <DocumentList 
        documents={documents} 
        loading={loading} 
        onPreview={handlePreview}
        onDelete={handleDelete}
        onAnalyze={handleAnalyze}
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
        title="Delete Document"
        message={`Are you sure you want to delete "${confirmDialog.document?.original_filename}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

/**
 * Career Agent component - Provides personalized career guidance and insights
 * Based on the system architecture for specialized domain agents
 */
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, payload }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  const value = payload.value || payload.years; // Handle both industry and company data
  const name = payload.name;

  return (
    <g>
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
        {value}
      </text>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#999" fill="none" />
      <circle cx={sx} cy={sy} r={2} fill="#999" stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">
        {name}
      </text>
    </g>
  );
};

const renderCustomLegend = (props) => {
    const { payload, total, dataKey } = props;
    return (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-sm">
            {(payload || []).map((entry, index) => {
                const { value, color } = entry;
                const itemValue = entry.payload[dataKey];
                const percentage = total > 0 ? ((itemValue / total) * 100).toFixed(0) : 0;
                return (
                    <div key={`item-${index}`} className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                        <span className="font-medium text-gray-700">{value}:</span>
                        <span className="text-gray-500">{`${itemValue}yrs (${percentage}%)`}</span>
                    </div>
                );
            })}
        </div>
    );
};

const professionalData = {
  workExperience: {
    totalYears: 25,
    companies: [
      { name: 'Google', role: 'Software Engineer', years: 10 },
      { name: 'Facebook', role: 'Senior Software Engineer', years: 8 },
      { name: 'Amazon', role: 'Principal Engineer', years: 7 },
    ],
    industries: [
      { name: 'Technology', value: 15, color: '#4285F4' },
      { name: 'Finance', value: 5, color: '#34A853' },
      { name: 'Healthcare', value: 5, color: '#FFB300' },
    ],
  },
  skillsAnalysis: {
    hardSkills: [
      { skill: 'Python', level: 90 },
      { skill: 'JavaScript', level: 85 },
      { skill: 'React', level: 88 },
      { skill: 'Node.js', level: 82 },
      { skill: 'SQL', level: 78 },
    ],
    softSkills: [
      { skill: 'Communication', current: 8, target: 10 },
      { skill: 'Leadership', current: 9, target: 10 },
      { skill: 'Teamwork', current: 7, target: 10 },
    ],
  },
};



const CareerAgent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState({ first_name: '', email: '' });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isImgError, setImgError] = useState(false);
  const [isAssistantDialogOpen, setIsAssistantDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('insights');
  const [insightsTab, setInsightsTab] = useState('identity');
  const [showDashboardSubTabs, setShowDashboardSubTabs] = useState(true);
  const [showInsightsSubTabs, setShowInsightsSubTabs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [careerData, setCareerData] = useState({
    experience: '5+ years',
    industry: 'Technology',
    skills: ['JavaScript', 'React', 'Python', 'Node.js', 'AWS'],
    goals: ['Senior Engineer', 'Tech Lead', 'Product Manager']
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeDashboardTab, setActiveDashboardTab] = useState('insights');
  
  
   // Professional data for visualizations
  const [professionalData, setProfessionalData] = useState({
    professionalIdentity: {
      title: '',
      summary: '',
      keyHighlights: [],
      currentRole: '',
      currentIndustry: '',
      currentCompany: '',
      location: ''
    },
    workExperience: {
      totalYears: 0,
      timelineStart: null,
      timelineEnd: null,
      analytics: {
        workingYears: {
          years: '',
          period: ''
        },
        heldRoles: {
          count: '',
          longest: ''
        },
        heldTitles: {
          count: '',
          shortest: ''
        },
        companies: {
          count: '',
          longest: ''
        },
        insights: {
          gaps: '',
          shortestTenure: '',
          companySize: '',
          averageRoleDuration: ''
        }
      },
      companies: [],
      industries: []
    },
    skillsAnalysis: {
      hardSkills: [],
      softSkills: [],
      coreStrengths: [],
      developmentAreas: []
    },
    marketPosition: {
      competitiveness: 0,
      skillRelevance: 0,
      industryDemand: 0,
      careerPotential: 0
    },
    careerTrajectory: [],
    strengthsWeaknesses: {
      strengths: [],
      weaknesses: []
    },
    salaryAnalysis: {
      currentSalary: null,
      historicalTrends: [],
      marketComparison: null,
      predictedGrowth: null,
      salaryFactors: [],
      recommendations: []
    }
  });

  // Analysis progress state for streaming workflow
  const [analysisProgress, setAnalysisProgress] = useState({
    isAnalyzing: false,
    currentSection: null,
    completedSections: [],
    totalSections: 7,
    progress: 0,
    error: null
  });

  // Section completion status
  const [sectionStatus, setSectionStatus] = useState({
    professionalIdentity: 'pending',
    workExperience: 'pending',
    skillsAnalysis: 'pending',
    marketPosition: 'pending',
    careerTrajectory: 'pending',
    strengthsWeaknesses: 'pending',
    salaryAnalysis: 'pending'
  });

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [hasLoadedStoredInsights, setHasLoadedStoredInsights] = useState(false);
  const [notificationCounter, setNotificationCounter] = useState(0);

  // Track whether we're loading stored data vs receiving new analysis data
  const [isLoadingStoredData, setIsLoadingStoredData] = useState(false);

  // Track the last analyzed document to load its specific insights
  const [lastAnalyzedDocumentId, setLastAnalyzedDocumentId] = useState(null);

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');

    if (tabParam) {
      // Map tab parameter to valid insightsTab values
      const validTabs = ['identity', 'work', 'skills', 'market', 'salary'];
      if (validTabs.includes(tabParam)) {
        setActiveTab('insights'); // Switch to insights tab
        setInsightsTab(tabParam); // Set the specific insights tab
      }
    }
  }, [location.search]);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
    fetchAvatar();
    fetchUnreadCount();
    
    // Event handler for complete career insights data (legacy support)
    const handleCareerInsightsReceived = (event) => {
      const { professionalData: newProfessionalData } = event.detail;
      if (newProfessionalData) {
        console.log('Received complete career insights data:', newProfessionalData);
        
        // Only update professional data if this is from a new analysis (not loading stored data)
        // AND only if the new data has meaningful content (not empty or just default structure)
        if (!isLoadingStoredData) {
          // Check if the new data has actual content beyond empty objects
          const hasActualData = Object.keys(newProfessionalData).some(key => {
            const sectionData = newProfessionalData[key];
            return sectionData && typeof sectionData === 'object' && Object.keys(sectionData).length > 0;
          });
          
          if (hasActualData) {
              // Merge instead of replace to avoid losing existing section data
              setProfessionalData(prev => ({
                ...prev,
                ...newProfessionalData
              }));
            // Automatically switch to insights tab when new data is received
            setActiveTab('insights');
            console.log('Updated professional data with new complete analysis');
          } else {
            console.log('Skipping complete data update - received data appears to be empty or incomplete');
          }
        } else {
          console.log('Skipping complete data update - currently loading stored data');
        }
      }
    };

    // Event handler for streaming analysis progress
    const handleAnalysisProgress = (event) => {
      const { section, status, progress, totalSections } = event.detail;
      console.log('Analysis progress update:', { section, status, progress });
      
      // If new analysis is starting, clear stored data flag and reset professional data
      if (status === 'starting' || (status === 'analyzing' && !analysisProgress.isAnalyzing)) {
        setIsLoadingStoredData(false);
        console.log('New analysis started - clearing stored data to prepare for fresh results');
      }
      
      setAnalysisProgress(prev => ({
        ...prev,
        currentSection: status === 'analyzing' ? section : null,
        progress: progress || prev.progress,
        totalSections: totalSections || prev.totalSections,
        isAnalyzing: status === 'analyzing' || status === 'starting'
      }));

      setSectionStatus(prev => {
        // Prevent resetting completed sections unless it's a new analysis starting
        const currentStatus = prev[section];
        if (currentStatus === 'completed' && status !== 'analyzing' && status !== 'starting') {
          console.log(`Preserving completed status for section ${section}, ignoring status change to ${status}`);
          return prev;
        }
        return {
          ...prev,
          [section]: status
        };
      });

      // Add notification for progress updates
      if (status === 'analyzing') {
        const sectionName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        addNotification({
          type: 'progress',
          title: 'Analysis in Progress',
          message: `Analyzing ${sectionName}...`,
          current_section: sectionName,
          progress: progress || 0,
          details: `Processing section ${progress ? Math.ceil(progress / (100 / totalSections)) : 1} of ${totalSections}`
        });
      }
    };

    // Event handler for section completion with data
    const handleSectionComplete = (event) => {
      const { section, data, error } = event.detail;
      console.log('Section completed:', { section, hasData: !!data, error });
      console.log('Section data received:', data);
      
      if (error) {
        setAnalysisProgress(prev => ({
          ...prev,
          error: `Error analyzing ${section}: ${error}`,
          isAnalyzing: false
        }));
        setSectionStatus(prev => ({ ...prev, [section]: 'error' }));
        return;
      }

      if (data) {
        // Only update professional data if this is from a new analysis (not loading stored data)
        // Allow updates during active analysis OR when completing the final section
        if (!isLoadingStoredData) {
          // Update professional data with the new section data
          // Handle nested data structure - if data contains the section name as a key, use that value
          const sectionData = data[section] || data;
          setProfessionalData(prev => {
            const newData = {
              ...prev,
              [section]: sectionData
            };
            console.log('Updated professional data with new analysis:', newData);
            console.log(`Section ${section} data:`, sectionData);
            return newData;
          });
        } else {
          console.log('Skipping data update - currently loading stored data');
        }

        // Update section status and progress
        setSectionStatus(prev => {
          const newStatus = { ...prev, [section]: 'completed' };
          console.log('Updated section status:', newStatus);
          return newStatus;
        });
        setAnalysisProgress(prev => {
          const newCompletedSections = [...prev.completedSections, section];
          const newProgress = Math.round((newCompletedSections.length / prev.totalSections) * 100);
          const isAnalysisComplete = newCompletedSections.length >= prev.totalSections;
          
          if (isAnalysisComplete) {
            console.log('Analysis fully completed - preserving all data and section statuses');
          }
          
          return {
            ...prev,
            completedSections: newCompletedSections,
            progress: newProgress,
            currentSection: null,
            isAnalyzing: !isAnalysisComplete
          };
        });

        // Switch to insights tab when first section completes
        if (activeTab !== 'insights') {
          setActiveTab('insights');
        }

        // Add completion notification
        const sectionName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        addNotification({
          type: 'complete',
          title: `✅ ${sectionName} Complete`,
          message: `${sectionName} analysis completed successfully! New insights are now available in your career profile.`,
          timestamp: Date.now()
        });
      }
    };

    // Event handler for analysis completion
    const handleAnalysisComplete = (event) => {
      const { success, error } = event.detail;
      console.log('Analysis workflow completed:', { success, error });
      
      setAnalysisProgress(prev => ({
        ...prev,
        isAnalyzing: false,
        currentSection: null,
        progress: success ? 100 : prev.progress,
        error: error || null
      }));

      // If backend returns complete data, merge it with existing professionalData
      if (event.detail.professional_data) {
        const finalData = event.detail.professional_data;
        const hasActualData = Object.keys(finalData).some(key => {
          const sectionData = finalData[key];
          return sectionData && typeof sectionData === 'object' && Object.keys(sectionData).length > 0;
        });
        if (hasActualData) {
          setProfessionalData(prev => ({
            ...prev,
            ...finalData
          }));
        }
      }

      // Add completion notification
      if (success) {
        addNotification({
          type: 'complete',
          title: 'Analysis Complete!',
          message: 'Your comprehensive career analysis is now ready',
          details: 'All sections have been analyzed. Explore your insights to discover new opportunities.'
        });
      } else if (error) {
        addNotification({
          type: 'error',
          title: 'Analysis Failed',
          message: 'There was an error completing your career analysis',
          details: error
        });
      }
    };
    
    // Add event listeners to the component element
    const element = document.querySelector('[data-agent-type="career"]');
    if (element) {
      element.addEventListener('careerInsightsReceived', handleCareerInsightsReceived);
      element.addEventListener('analysisProgress', handleAnalysisProgress);
      element.addEventListener('sectionComplete', handleSectionComplete);
      element.addEventListener('analysisComplete', handleAnalysisComplete);
    }
    
    // Clean up event listeners on component unmount
    return () => {
      if (element) {
        element.removeEventListener('careerInsightsReceived', handleCareerInsightsReceived);
        element.removeEventListener('analysisProgress', handleAnalysisProgress);
        element.removeEventListener('sectionComplete', handleSectionComplete);
        element.removeEventListener('analysisComplete', handleAnalysisComplete);
      }
    };
  }, []);

  // Load stored career insights when user is available
  useEffect(() => {
    if (user?.id && !hasLoadedStoredInsights) {
      loadStoredCareerInsights();
    }
  }, [user?.id, hasLoadedStoredInsights]);

  const fetchUserData = async () => {
    try {
      const data = await profileAPI.getCurrentUser();
      setUserData({
        first_name: data.first_name,
        email: data.email
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
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

  const fetchUnreadCount = async () => {
    try {
      const data = await sessionsAPI.getUnreadSessionsCount();
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0); // Set to 0 on error
    }
  };

  // Load stored career insights from database on component mount
  const loadStoredCareerInsights = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available, skipping career insights load');
        return;
      }

      // Don't load stored data if we're currently analyzing or have fresh analysis data
      if (analysisProgress.isAnalyzing) {
        console.log('Analysis in progress, skipping stored data load to avoid overwriting fresh data');
        return;
      }

      // Check if we already have professional data (from recent analysis)
      const hasCurrentData = Object.values(professionalData).some(sectionData => {
        const isPopulated = (data) => {
          if (Array.isArray(data)) return data.length > 0;
          if (data && typeof data === 'object') {
            return Object.values(data).some(v => isPopulated(v));
          }
          if (typeof data === 'number') return data !== 0;
          return Boolean(data); // Handle non-empty strings etc.
        };
        return isPopulated(sectionData);
      });
      
      if (hasCurrentData) {
        console.log('Already have professional data, skipping stored data load to preserve current analysis');
        return;
      }

      if (hasLoadedStoredInsights) {
        console.log('Stored insights have already been loaded. Skipping notification.');
        return;
      }

      setIsLoadingStoredData(true); // Set flag to indicate we're loading stored data
      
      let response;
      
      // Try to load insights for the last analyzed document first
      if (lastAnalyzedDocumentId) {
        console.log('Loading career insights for last analyzed document:', lastAnalyzedDocumentId);
        try {
          response = await getCareerInsightsByResume(lastAnalyzedDocumentId, user.id);
          if (response.success && response.has_data) {
            console.log('Found insights for last analyzed document');
          } else {
            console.log('No insights found for last analyzed document, falling back to latest insights');
            response = await getCareerInsights(user.id);
          }
        } catch (error) {
          console.log('Error loading insights for specific document, falling back to latest:', error);
          response = await getCareerInsights(user.id);
        }
      } else {
        console.log('No last analyzed document tracked, loading latest career insights for user:', user.id);
        response = await getCareerInsights(user.id);
      }
      
      if (response.success && response.has_data && response.professional_data) {
        console.log('Found stored career insights:', response.professional_data);
        const rawData = response.professional_data;
        const unnestedData = { ...rawData };
        for (const key in unnestedData) {
            if (unnestedData[key] && typeof unnestedData[key] === 'object' && !Array.isArray(unnestedData[key]) && unnestedData[key][key]) {
                console.log(`Un-nesting ${key} data from DB.`);
                unnestedData[key] = unnestedData[key][key];
            }
        }
        setProfessionalData(unnestedData);
        
        // Switch to insights tab if we have stored data
        setActiveTab('insights');
        
        // Add notification about loaded data
        const documentInfo = lastAnalyzedDocumentId ? 'for your last analyzed document' : 'from your most recent analysis';
        addNotification({
          id: 'career-insights-loaded', // Add fixed ID to prevent duplicate notifications
          type: 'info',
          title: 'Career Insights Loaded',
          message: `Your previous analysis results ${documentInfo} have been restored`,
          details: 'All your career insights are now available for review'
        });
        setHasLoadedStoredInsights(true);
      } else {
        console.log('No stored career insights found or data is empty');
      }
    } catch (error) {
      console.error('Error loading stored career insights:', error);
      // Don't show error notification as this is not critical for user experience
    } finally {
      setIsLoadingStoredData(false); // Reset flag after loading is complete
    }
  };

  // Notification management functions
  const addNotification = (notification) => {
    const newNotification = {
      id: notification.id || `notification-${notificationCounter}`,
      timestamp: Date.now(),
      ...notification
    };
    
    // Only check for duplicates if a custom ID is provided
    // This allows section completion notifications to accumulate while preventing specific duplicates
    setNotifications(prev => {
      if (notification.id) {
        const existingIndex = prev.findIndex(n => n.id === newNotification.id);
        if (existingIndex !== -1) {
          // Update existing notification instead of adding duplicate
          const updated = [...prev];
          updated[existingIndex] = newNotification;
          return updated;
        }
      }
      return [...prev, newNotification];
    });
    setNotificationCounter(prev => prev + 1);
  };

  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Handler for Resume Analysis
  const handleAnalyzeResume = async () => {
    if (!user?.id) {
      addNotification({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please log in to analyze your resume',
        details: 'User authentication is required for resume analysis'
      });
      return;
    }

    if (analysisProgress.isAnalyzing) {
      console.log('Analysis already in progress, ignoring request');
      return;
    }

    try {
      // Get the most recent document to include filename in activity tracking
      let mostRecentFilename = null;
      try {
        const documentList = await auth.getResumes();
        if (documentList && documentList.length > 0) {
          // Documents are typically sorted by upload date, get the most recent
          const mostRecentDoc = documentList[0];
          mostRecentFilename = mostRecentDoc.original_filename;
        }
      } catch (error) {
        console.warn('Could not fetch documents for activity tracking:', error);
      }

      // Track resume analysis activity
      const activityDescription = mostRecentFilename
        ? `Analyzed most recent resume: ${mostRecentFilename}`
        : 'Analyzed most recent resume';

      await activitiesAPI.createActivity({
        activity_type: 'resume_analysis',
        activity_source: 'career',
        activity_title: 'Resume Analysis - Recent Resume',
        activity_description: activityDescription,
        activity_metadata: {
          source_type: 'analyze_recent_resume',
          user_id: user.id,
          resume_filename: mostRecentFilename
        }
      });
      // Reset analysis state
      setAnalysisProgress({
        isAnalyzing: true,
        currentSection: null,
        completedSections: [],
        totalSections: 7,
        progress: 0,
        error: null
      });

      setSectionStatus({
        professionalIdentity: 'pending',
        workExperience: 'pending',
        skillsAnalysis: 'pending',
        marketPosition: 'pending',
        careerTrajectory: 'pending',
        strengthsWeaknesses: 'pending',
        salaryAnalysis: 'pending'
      });

      // Clear existing professional data to prepare for new analysis
      setProfessionalData({
        professionalIdentity: { title: '', summary: '', keyHighlights: [], currentRole: '', currentIndustry: '', currentCompany: '', location: '' },
        workExperience: { totalYears: 0, timelineStart: null, timelineEnd: null, analytics: { workingYears: { years: '', period: '' }, heldRoles: { count: '', longest: '' }, heldTitles: { count: '', shortest: '' }, companies: { count: '', longest: '' }, insights: { gaps: '', shortestTenure: '', companySize: '', averageRoleDuration: '' } }, companies: [], industries: [] },
        skillsAnalysis: { hardSkills: [], softSkills: [], coreStrengths: [], developmentAreas: [] },
        marketPosition: { competitiveness: 0, skillRelevance: 0, industryDemand: 0, careerPotential: 0 },
        careerTrajectory: [],
        strengthsWeaknesses: { strengths: [], weaknesses: [] },
        salaryAnalysis: { currentSalary: null, historicalTrends: [], marketComparison: null, predictedGrowth: null, salaryFactors: [], recommendations: [] }
      });

      addNotification({
        type: 'progress',
        title: 'Resume Analysis Started',
        message: 'Starting comprehensive analysis of your recent resume',
        details: 'This may take a few minutes. You will see real-time updates as each section completes.'
      });

      // Call the backend streaming endpoint
      // Use relative path in production (proxied through Nginx), localhost in development
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/career/analyze_resume_streaming'
        : (process.env.REACT_APP_CAREER_URL || 'http://localhost:6002') + '/api/career/analyze_resume_streaming';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming token-based auth
        },
        body: JSON.stringify({ user_id: String(user.id) })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different types of streaming responses
              if (data.type === 'error') {
                // Handle error from streaming response
                console.error('Streaming analysis error:', data.message);
                setAnalysisProgress(prev => ({
                  ...prev,
                  isAnalyzing: false,
                  error: data.message
                }));

                addNotification({
                  type: 'error',
                  title: 'Analysis Error',
                  message: data.message || 'An error occurred during analysis',
                  details: data.error_details ? JSON.stringify(data.error_details) : ''
                });
                break; // Stop processing further chunks
              } else if (data.type === 'status') {
                // Handle status updates
                console.log('Analysis status:', data.message, 'Progress:', data.progress);
                setAnalysisProgress(prev => ({
                  ...prev,
                  progress: data.progress || prev.progress,
                  currentSection: data.message
                }));
              } else if (data.type === 'section_progress') {
                // Dispatch section progress event
                const progressEvent = new CustomEvent('analysisProgress', {
                  detail: {
                    section: data.section,
                    status: 'analyzing',
                    progress: data.progress,
                    totalSections: data.total_sections || 7
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(progressEvent);
              } else if (data.type === 'section_complete') {
                console.log('Section completed:', data.section, data.data);
                
                // Update state directly for immediate UI feedback
                if (data.data) {
                  // Update professional data with the new section data
                  const sectionData = data.data[data.section] || data.data;
                  setProfessionalData(prev => {
                    const newData = {
                      ...prev,
                      [data.section]: sectionData
                    };
                    console.log(`Updated professional data for section ${data.section}:`, newData);
                    return newData;
                  });
                }
                
                // Update section status
                setSectionStatus(prev => {
                  const newStatus = { ...prev, [data.section]: 'completed' };
                  console.log('Updated section status:', newStatus);
                  return newStatus;
                });
                
                // Dispatch section completion event
                const completeEvent = new CustomEvent('sectionComplete', {
                  detail: {
                    section: data.section,
                    data: data.data,
                    error: data.error
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(completeEvent);
              } else if (data.type === 'analysis_complete') {
                // Dispatch analysis completion event
                const analysisCompleteEvent = new CustomEvent('analysisComplete', {
                  detail: {
                    success: data.success,
                    error: data.error,
                    professional_data: data.professional_data
                  }
                });
                document.querySelector('[data-agent-type="career"]')?.dispatchEvent(analysisCompleteEvent);
                break;
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing resume:', error);
      setAnalysisProgress(prev => ({
        ...prev,
        isAnalyzing: false,
        error: `Failed to analyze resume: ${error.message}`
      }));
      
      addNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: 'Failed to analyze your resume',
        details: error.message || 'An unexpected error occurred during analysis'
      });
    }
  };

  // Track activity when user interacts with components
  const trackActivity = async (activityType, activitySource, title, description = null, metadata = {}) => {
    try {
      await activitiesAPI.createActivity({
        activity_type: activityType,
        activity_source: activitySource,
        activity_title: title,
        activity_description: description,
        activity_metadata: metadata
      });
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  // Handler for Personal Assistant dialog
  const handlePersonalAssistant = () => {
    setIsAssistantDialogOpen(true);
    // Note: Chat activity is now tracked when messages are actually sent in ChatDialog
  };

  // Navigation handlers
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const handleAccount = () => {
    navigate('/profile');
  };

  // Enhanced career insights data with comprehensive analysis
  const colorPaletteForCompanies = ['#FF6B35', '#4285F4', '#34A853', '#9C27B0', '#FFB300', '#6366F1', '#EC4899', '#10B981'];

// Convert duration string like "2 years 10 months" or "6 months" to numeric years
const parseDurationToYears = (duration) => {
  if (!duration || typeof duration !== 'string') return 0;
  const s = duration.toLowerCase();
  let years = 0;
  const yearMatch = s.match(/(\d+(?:\.\d+)?)\s*year/);
  if (yearMatch) years += parseFloat(yearMatch[1]);
  const monthMatch = s.match(/(\d+(?:\.\d+)?)\s*month/);
  if (monthMatch) years += parseFloat(monthMatch[1]) / 12;
  if (!yearMatch && !monthMatch) {
    const y = s.match(/(\d+(?:\.\d+)?)\s*y/);
    const m = s.match(/(\d+(?:\.\d+)?)\s*m/);
    if (y) years += parseFloat(y[1]);
    if (m) years += parseFloat(m[1]) / 12;
  }
  return Number.isFinite(years) ? parseFloat(years.toFixed(2)) : 0;
};

// Color palette matching Career Experience Blocks
const chartColorPalette = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#8B5CF6', // purple-500
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#EF4444', // red-500
  '#EAB308', // yellow-500
  '#06B6D4'  // cyan-500
];

// Build company experience dataset from LLM analysis (professionalData.workExperience.companies)
const companyExperienceData = (professionalData.workExperience?.companies || []).map((c, idx) => ({
  name: c.company || c.name || `Company ${idx + 1}`,
  years: parseFloat(c.duration) || parseDurationToYears(c.duration) || (c.startYear && c.endYear ? Math.max(0, parseFloat((c.endYear - c.startYear).toFixed(2))) : 0),
  color: chartColorPalette[idx % chartColorPalette.length],
}));

const careerInsights = {
    professionalIdentity: {
      title: 'Mid-level Backend Engineer with 5+ Years Experience',
      summary: 'Dynamic and accomplished career trajectory across diverse industries including entertainment, financial services, healthcare, and technology. Demonstrates adaptability, strategic thinking, and ability to create value in varying contexts.',
      keyHighlights: [
        'Earned multiple promotions over the years',
        'At or near the Director level in current company',
        'Demonstrates leadership and executive-oriented mindset'
      ]
    },
    skillsAnalysis: {
      coreStrengths: [
        { area: 'Technical Excellence', description: 'Strong foundation in full-stack development', score: 85 },
        { area: 'Cross-Industry Adaptability', description: 'Successfully transitioned across multiple sectors', score: 90 },
        { area: 'Strategic Innovation', description: 'Ability to drive innovation and create business value', score: 80 },
        { area: 'Leadership Potential', description: 'Natural progression toward leadership roles', score: 75 }
      ],
      developmentAreas: [
        { area: 'System Architecture', description: 'Expand knowledge in large-scale system design', priority: 'high' },
        { area: 'Team Leadership', description: 'Develop formal leadership and management skills', priority: 'high' },
        { area: 'Strategic Planning', description: 'Enhance long-term strategic thinking capabilities', priority: 'medium' }
      ]
    },
    careerTrajectoryInsights: {
      currentPhase: 'Mid-Level Professional',
      growthPattern: 'Accelerated Growth',
      nextMilestone: 'Senior Engineer / Tech Lead',
      timeframe: '12-18 months',
      keyFactors: [
        'Technical depth in system design',
        'Leadership experience through project management',
        'Cross-functional collaboration skills'
      ]
    },
    marketPosition: {
      competitiveness: 85,
      skillRelevance: 92,
      industryDemand: 78,
      careerPotential: 88
    },
    workLifeBalance: {
      balanceScore: 7.2,
      stressLevel: 60,
      flexibility: 80,
      jobSatisfaction: 85,
      timeAllocation: {
        work: 65,
        personal: 35
      }
    },
    careerSatisfaction: {
      overall: 8.4,
      metrics: [
        { metric: 'Role Fulfillment', score: 8.5 },
        { metric: 'Growth Opportunities', score: 7.8 },
        { metric: 'Compensation', score: 8.2 },
        { metric: 'Team Dynamics', score: 9.1 },
        { metric: 'Company Culture', score: 8.7 },
        { metric: 'Work Environment', score: 8.9 }
      ]
    },
    professionalNetwork: {
      linkedinConnections: 1247,
      industryContacts: 89,
      mentorshipRelations: 23,
      influenceScore: 7.8,
      networkBreakdown: [
        { category: 'Senior Leadership', connections: 15, influence: 8.5 },
        { category: 'Peers', connections: 45, influence: 7.2 },
        { category: 'Junior Colleagues', connections: 28, influence: 9.1 },
        { category: 'External Partners', connections: 22, influence: 6.8 },
        { category: 'Industry Experts', connections: 12, influence: 8.9 }
      ]
    },
    learningDevelopment: {
      currentGoals: [
        { skill: 'System Architecture', progress: 75, target: 'Q2 2024' },
        { skill: 'Leadership Skills', progress: 60, target: 'Q3 2024' },
        { skill: 'Cloud Technologies', progress: 85, target: 'Q1 2024' },
        { skill: 'Data Science', progress: 40, target: 'Q4 2024' }
      ],
      activityTimeline: [
        { month: 'Jan', courses: 2, certifications: 0, hours: 25 },
        { month: 'Feb', courses: 1, certifications: 1, hours: 35 },
        { month: 'Mar', courses: 3, certifications: 0, hours: 45 },
        { month: 'Apr', courses: 2, certifications: 1, hours: 30 },
        { month: 'May', courses: 1, certifications: 0, hours: 20 },
        { month: 'Jun', courses: 2, certifications: 1, hours: 40 }
      ]
    },
    careerPlanning: {
      careerOptions: [
         {
           title: 'Senior Software Engineer',
           match: 'high',
           description: 'Lead technical initiatives and mentor junior developers',
           salaryRange: '$120K - $160K',
           growthPotential: 'High',
           timeline: '6-12 months',
           riskLevel: 'Low',
           category: 'Same role in same company'
         },
         {
           title: 'Technical Lead',
           match: 'high',
           description: 'Guide technical decisions and architecture for development teams',
           salaryRange: '$140K - $180K',
           growthPotential: 'Very High',
           timeline: '12-18 months',
           riskLevel: 'Medium',
           category: 'New role in same company'
         },
         {
           title: 'Engineering Manager',
           match: 'medium',
           description: 'Manage engineering teams and drive product development',
           salaryRange: '$150K - $200K',
           growthPotential: 'High',
           timeline: '18-24 months',
           riskLevel: 'Medium',
           category: 'New role in same industry'
         },
         {
           title: 'Product Manager',
           match: 'medium',
           description: 'Drive product strategy and work with cross-functional teams',
           salaryRange: '$130K - $170K',
           growthPotential: 'High',
           timeline: '12-18 months',
           riskLevel: 'High',
           category: 'New role in same company'
         },
         {
           title: 'Tech Startup Founder',
           match: 'low',
           description: 'Start your own technology company',
           salaryRange: '$0 - $500K+',
           growthPotential: 'Very High',
           timeline: '6-24 months',
           riskLevel: 'Very High',
           category: 'Transition to self-employment/startup'
         },
         {
           title: 'Freelance Consultant',
           match: 'medium',
           description: 'Provide technical consulting services to multiple clients',
           salaryRange: '$80K - $200K',
           growthPotential: 'Medium',
           timeline: '3-6 months',
           riskLevel: 'High',
           category: 'Transition to self-employment'
         }
       ],
       evaluationMatrix: [
         {
           title: 'Senior Software Engineer',
           marketDemand: 8,
           valuesAlignment: 8,
           lifestyleFit: 8,
           overallScore: 8.0
         },
         {
           title: 'Technical Lead',
           marketDemand: 7,
           valuesAlignment: 9,
           lifestyleFit: 6,
           overallScore: 7.3
         },
         {
           title: 'Engineering Manager',
           marketDemand: 7,
           valuesAlignment: 7,
           lifestyleFit: 6,
           overallScore: 6.7
         },
         {
           title: 'Product Manager',
           marketDemand: 8,
           valuesAlignment: 8,
           lifestyleFit: 6,
           overallScore: 7.3
         },
         {
           title: 'Tech Startup Founder',
           marketDemand: 5,
           valuesAlignment: 9,
           lifestyleFit: 4,
           overallScore: 6.0
         },
         {
           title: 'Freelance Consultant',
           marketDemand: 6,
           valuesAlignment: 7,
           lifestyleFit: 9,
           overallScore: 7.3
         }
       ],
       nextSteps: [
         {
           strategy: 'Job Switching Strategy',
           priority: 'high',
           description: 'Prepare for senior-level positions in current or new companies',
           timeline: '3-6 months',
           actions: [
             'Update resume with recent achievements',
             'Build portfolio showcasing system design skills',
             'Network with senior engineers and hiring managers',
             'Practice technical interviews and system design'
           ]
         },
         {
           strategy: 'Role Redesign (Current Company)',
           priority: 'medium',
           description: 'Expand current role responsibilities and visibility',
           timeline: '2-4 months',
           actions: [
             'Propose leading a cross-team initiative',
             'Volunteer for architecture decisions',
             'Mentor junior developers',
             'Present technical solutions to leadership'
           ]
         },
         {
           strategy: 'Industry Pivot Planning',
           priority: 'low',
           description: 'Explore opportunities in adjacent industries',
           timeline: '6-12 months',
           actions: [
             'Research target industries (fintech, healthtech)',
             'Attend industry-specific conferences',
             'Build relevant domain knowledge',
             'Connect with professionals in target industries'
           ]
         },
         {
           strategy: 'Self-Branding & Online Presence',
           priority: 'high',
           description: 'Establish thought leadership and professional visibility',
           timeline: '1-3 months',
           actions: [
             'Create technical blog and write regularly',
             'Contribute to open source projects',
             'Speak at local meetups or conferences',
             'Optimize LinkedIn profile and engage actively'
           ]
         }
       ],
      skillsGapAnalysis: [
         { 
           skill: 'System Design', 
           current: 60, 
           required: 85,
           bridgingPlan: [
             { method: 'Complete "Designing Data-Intensive Applications" course', timeline: '2-3 months', effort: 'High' },
             { method: 'Design and implement 2 scalable systems', timeline: '3-4 months', effort: 'High' },
             { method: 'Present system design to senior engineers', timeline: '1 month', effort: 'Medium' }
           ]
         },
         { 
           skill: 'Leadership', 
           current: 45, 
           required: 80,
           bridgingPlan: [
             { method: 'Lead cross-functional project team', timeline: '4-6 months', effort: 'High' },
             { method: 'Complete leadership training program', timeline: '2-3 months', effort: 'Medium' },
             { method: 'Mentor 2-3 junior developers', timeline: '6+ months', effort: 'Medium' }
           ]
         },
         { 
           skill: 'Architecture', 
           current: 55, 
           required: 90,
           bridgingPlan: [
             { method: 'Obtain AWS Solutions Architect certification', timeline: '3-4 months', effort: 'High' },
             { method: 'Design microservices architecture for current project', timeline: '2-3 months', effort: 'High' },
             { method: 'Study enterprise architecture patterns', timeline: '2-3 months', effort: 'Medium' }
           ]
         },
         { 
           skill: 'Mentoring', 
           current: 40, 
           required: 75,
           bridgingPlan: [
             { method: 'Formally mentor junior team members', timeline: '6+ months', effort: 'Medium' },
             { method: 'Develop mentoring skills workshop', timeline: '1-2 months', effort: 'Low' },
             { method: 'Create technical learning resources', timeline: '2-3 months', effort: 'Medium' }
           ]
         },
         { 
           skill: 'Strategy', 
           current: 50, 
           required: 85,
           bridgingPlan: [
             { method: 'Complete strategic thinking course', timeline: '2-3 months', effort: 'Medium' },
             { method: 'Participate in product roadmap planning', timeline: '3-6 months', effort: 'Medium' },
             { method: 'Analyze competitor technologies and trends', timeline: '1-2 months', effort: 'Low' }
           ]
         }
       ],
      bridgingPlan: [
         {
           skill: 'System Design',
           priority: 'high',
           description: 'Master advanced system design patterns and scalability concepts',
           timeline: '3-6 months',
           gapSize: 45,
           resources: [
             { type: 'Course', name: 'Designing Data-Intensive Applications', effort: 'High' },
             { type: 'Project', name: 'Design scalable microservices architecture', effort: 'High' },
             { type: 'Practice', name: 'System design interview preparation', effort: 'Medium' }
           ]
         },
         {
           skill: 'Leadership',
           priority: 'high',
           description: 'Develop team leadership and project management capabilities',
           timeline: '6-12 months',
           gapSize: 35,
           resources: [
             { type: 'Training', name: 'Leadership fundamentals program', effort: 'Medium' },
             { type: 'Experience', name: 'Lead cross-functional project', effort: 'High' },
             { type: 'Mentoring', name: 'Mentor 2-3 junior developers', effort: 'Medium' }
           ]
         },
         {
           skill: 'Cloud Architecture',
           priority: 'medium',
           description: 'Gain expertise in cloud-native architecture and deployment',
           timeline: '4-8 months',
           gapSize: 25,
           resources: [
             { type: 'Certification', name: 'AWS Solutions Architect Professional', effort: 'High' },
             { type: 'Project', name: 'Migrate legacy system to cloud', effort: 'High' },
             { type: 'Study', name: 'Cloud design patterns and best practices', effort: 'Medium' }
           ]
         }
       ],
      developmentPlan: [
        {
          skill: 'System Design',
          priority: 'high',
          description: 'Complete advanced system design course and practice with real projects',
          timeline: '3-6 months',
          method: 'Online courses + hands-on projects'
        },
        {
          skill: 'Leadership',
          priority: 'high',
          description: 'Lead cross-functional projects and mentor junior developers',
          timeline: '6-12 months',
          method: 'Project leadership + mentoring'
        },
        {
          skill: 'Cloud Architecture',
          priority: 'medium',
          description: 'Obtain AWS Solutions Architect certification',
          timeline: '4-8 months',
          method: 'Certification + practical experience'
        }
      ],
      timeline: [
        {
          title: 'Complete System Design Mastery',
          timeframe: 'Next 6 months',
          status: 'current',
          description: 'Focus on advanced system design patterns and scalability',
          keyMilestones: ['Complete course', 'Design 2 systems', 'Present to team']
        },
        {
          title: 'Lead Major Project',
          timeframe: '6-12 months',
          status: 'planned',
          description: 'Take ownership of a cross-team initiative',
          keyMilestones: ['Project kickoff', 'Team coordination', 'Successful delivery']
        },
        {
          title: 'Senior Engineer Promotion',
          timeframe: '12-18 months',
          status: 'planned',
          description: 'Achieve promotion to Senior Software Engineer',
          keyMilestones: ['Performance review', 'Technical assessment', 'Promotion']
        }
      ],
      marketTrends: [
        { year: '2022', demand: 15 },
        { year: '2023', demand: 25 },
        { year: '2024', demand: 35 },
        { year: '2025', demand: 45 },
        { year: '2026', demand: 55 }
      ],
      networkingOpportunities: [
        {
          type: 'Tech Conferences',
          description: 'Attend industry conferences to build network and learn trends',
          timeline: 'Quarterly',
          effort: 'Medium',
          impact: 'High'
        },
        {
          type: 'Internal Mentorship',
          description: 'Mentor junior developers to build leadership skills',
          timeline: 'Ongoing',
          effort: 'Low',
          impact: 'High'
        },
        {
          type: 'Open Source Contribution',
          description: 'Contribute to popular open source projects',
          timeline: 'Monthly',
          effort: 'Medium',
          impact: 'Medium'
        }
       ],
       alignmentAnalysis: [
         {
           category: 'Personal Life Phase',
           factors: [
             { name: 'Family Commitments', score: 75 },
             { name: 'Financial Stability', score: 85 },
             { name: 'Geographic Flexibility', score: 60 },
             { name: 'Work-Life Balance', score: 70 }
           ]
         },
         {
           category: 'Purpose & Fulfillment',
           factors: [
             { name: 'Technical Impact', score: 90 },
             { name: 'Team Leadership', score: 65 },
             { name: 'Innovation Opportunity', score: 80 },
             { name: 'Learning & Growth', score: 85 }
           ]
         },
         {
           category: 'Energy & Mental Health',
           factors: [
             { name: 'Stress Management', score: 70 },
             { name: 'Work Engagement', score: 85 },
             { name: 'Career Satisfaction', score: 75 },
             { name: 'Burnout Risk', score: 60 }
           ]
         }
       ],
       scenarios: [
         {
           title: 'What if you stay?',
           pros: [
             'Stable income and benefits',
             'Known team and processes',
             'Potential for internal promotion',
             'Low risk and stress'
           ],
           cons: [
             'Limited salary growth potential',
             'Fewer learning opportunities',
             'Possible career stagnation',
             'Less market exposure'
           ],
           score: 6.5,
           successProbability: 85,
           timeline: '6-12 months'
         },
         {
           title: 'What if you change jobs?',
           pros: [
             'Higher salary potential',
             'New technologies and challenges',
             'Expanded professional network',
             'Fresh perspective and growth'
           ],
           cons: [
             'Uncertainty and adaptation period',
             'Loss of current relationships',
             'Potential culture mismatch',
             'Interview and transition stress'
           ],
           score: 7.5,
           successProbability: 75,
           timeline: '3-6 months'
         },
         {
           title: 'What if you switch industries?',
           pros: [
             'Diverse experience and skills',
             'Potentially higher compensation',
             'New professional challenges',
             'Broader career opportunities'
           ],
           cons: [
             'Steep learning curve',
             'Industry knowledge gap',
             'Network rebuilding required',
             'Higher risk of failure'
           ],
           score: 6.0,
           successProbability: 60,
           timeline: '12-18 months'
         }
       ],
       readinessAssessment: [
         { aspect: 'Confidence Level', level: 'high', score: 75, description: 'Strong belief in ability to succeed in new role' },
         { aspect: 'Career Clarity', level: 'high', score: 80, description: 'Clear understanding of career goals and direction' },
         { aspect: 'Risk Tolerance', level: 'medium', score: 65, description: 'Moderate comfort with career change uncertainty' },
         { aspect: 'Financial Readiness', level: 'high', score: 85, description: 'Solid financial foundation for career transition' },
         { aspect: 'Skill Confidence', level: 'medium', score: 70, description: 'Good technical skills with room for growth' },
         { aspect: 'Network Strength', level: 'medium', score: 60, description: 'Developing professional network and connections' }
       ],
       coachingReflections: [
         {
           question: 'Fear of Failure?',
           insight: 'Moderate concern about not meeting expectations in a senior role. Focus on building confidence through incremental challenges.',
           priority: 'medium',
           actionItem: 'Start with smaller leadership responsibilities and gradually increase scope'
         },
         {
           question: 'Fear of Irrelevance?',
           insight: 'Strong awareness of need to stay current with technology trends. Actively learning new skills.',
           priority: 'low',
           actionItem: 'Continue current learning plan and join tech communities for knowledge sharing'
         },
         {
           question: 'Burnout Recovery Time?',
           insight: 'Currently managing workload well but should monitor stress levels during career transition.',
           priority: 'medium',
           actionItem: 'Establish stress monitoring routine and prepare contingency plans for high-pressure periods'
         },
         {
           question: 'Imposter Syndrome?',
           insight: 'Occasional self-doubt about technical abilities. Building portfolio and seeking feedback will help.',
           priority: 'high',
           actionItem: 'Create a technical portfolio showcasing achievements and seek regular feedback from peers'
         }
       ]
     }
   };

  // Sample career planning data
  const careerPlanning = {
    currentPhase: 'Mid-Level Professional',
    nextMilestone: 'Senior Engineer',
    timeToGoal: '12-18 months',
    progressPercentage: 65,
    keyActions: [
      {
        id: 1,
        title: 'Complete System Design Course',
        status: 'in-progress',
        deadline: '2024-03-15',
        priority: 'high'
      },
      {
        id: 2,
        title: 'Lead Cross-Team Project',
        status: 'planned',
        deadline: '2024-04-30',
        priority: 'high'
      },
      {
        id: 3,
        title: 'Obtain AWS Solutions Architect Certification',
        status: 'not-started',
        deadline: '2024-06-01',
        priority: 'medium'
      }
    ],
    skillGaps: [
      { skill: 'System Design', currentLevel: 3, targetLevel: 5 },
      { skill: 'Team Leadership', currentLevel: 2, targetLevel: 4 },
      { skill: 'Cloud Architecture', currentLevel: 3, targetLevel: 5 }
    ]
  };

  const dashboardTabs = [
    {
      id: 'insights',
      name: 'AI Insights',
      icon: Lightbulb,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'achievements',
      name: 'Achievements',
      icon: Star,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      disabled: true
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      icon: Sun,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      preview: true
    }
  ];

  const tabs = [
    { id: 'planning', name: 'Career Planning', icon: Map, disabled: true },
    { id: 'job-search', name: 'Job Search', icon: Briefcase, disabled: true },
    { id: 'resume-builder', name: 'Resume Builder', icon: FileText, disabled: true },
    { id: 'documents', name: 'Documents', icon: FileText, disabled: false }
  ];

  const insightsSubTabs = [
    { id: 'identity', label: 'Professional Identity', section: 'professionalIdentity' },
    { id: 'work', label: 'Work Experience Analysis', section: 'workExperience' },
    { id: 'salary', label: 'Salary Analysis', section: 'salaryAnalysis' },
    { id: 'skills', label: 'Skills Analysis', section: 'skillsAnalysis' },
    { id: 'market', label: 'Market Position Analysis', section: 'marketPosition' }
  ];

  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  const handleDashboardToggle = () => {
    setActiveTab('welcome');
    setShowDashboardSubTabs(!showDashboardSubTabs);
  };

  const handleInsightsToggle = () => {
    setActiveTab('insights');
    setShowInsightsSubTabs(!showInsightsSubTabs); // FIXED: Now uses correct state variable
  };

  const handleDashboardTabChange = (tabId) => {
    setActiveDashboardTab(tabId);
    setActiveTab('welcome');
  };

  const handleInsightsSubTabChange = (subTabId) => {
    setInsightsTab(subTabId);
    setActiveTab('insights');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };


  // Tab content renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case 'job-search':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center">
                  <BriefcaseIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Job Search & Opportunities</h2>
                  <p className="text-gray-600">Find and track job opportunities that match your career goals</p>
                </div>
              </div>
              <div className="text-center py-12">
                <BriefcaseIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Job Search Coming Soon</h3>
                <p className="text-gray-600">Advanced job matching and application tracking features are in development.</p>
              </div>
             </div>

            {/* Work-Life Balance & Career Satisfaction */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Work-Life Balance */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <ScaleIcon className="h-6 w-6 text-green-600" />
                  <h3 className="text-xl font-semibold text-gray-900">Work-Life Balance Analysis</h3>
                </div>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Work', value: careerInsights.workLifeBalance.timeAllocation.work, fill: '#EF4444' },
                              { name: 'Personal', value: careerInsights.workLifeBalance.timeAllocation.personal, fill: '#10B981' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={60}
                            dataKey="value"
                          >
                          </Pie>
                          <Tooltip formatter={(value) => [`${value}%`, 'Time Allocation']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600 mb-1">{careerInsights.workLifeBalance.balanceScore}/10</div>
                      <p className="text-sm text-gray-600">Balance Score</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Stress Level</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{width: `${careerInsights.workLifeBalance.stressLevel}%`}}></div>
                        </div>
                        <span className="text-sm font-medium">Moderate</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Flexibility</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: `${careerInsights.workLifeBalance.flexibility}%`}}></div>
                        </div>
                        <span className="text-sm font-medium">High</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Job Satisfaction</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{width: `${careerInsights.workLifeBalance.jobSatisfaction}%`}}></div>
                        </div>
                        <span className="text-sm font-medium">Very High</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Career Satisfaction Metrics */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <HeartIcon className="h-6 w-6 text-red-600" />
                  <h3 className="text-xl font-semibold text-gray-900">Career Satisfaction Metrics</h3>
                </div>
                <div className="space-y-6">
                  {(careerInsights.careerSatisfaction?.metrics || []).map((item, index) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 w-32">{item.metric}</span>
                        <div className="flex-1 mx-4">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`${colors[index % colors.length]} h-3 rounded-full transition-all duration-500`}
                              style={{ width: `${(item.score / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-8">{item.score}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">{careerInsights.careerSatisfaction.overall}/10</div>
                    <p className="text-sm text-gray-600">Overall Career Satisfaction</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Network & Influence */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-6">
                <UsersIcon className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">Professional Network & Influence</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{careerInsights.professionalNetwork.linkedinConnections.toLocaleString()}</div>
                  <p className="text-sm text-gray-600">LinkedIn Connections</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
                  <div className="text-3xl font-bold text-green-600 mb-2">{careerInsights.professionalNetwork.industryContacts}</div>
                  <p className="text-sm text-gray-600">Industry Contacts</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{careerInsights.professionalNetwork.mentorshipRelations}</div>
                  <p className="text-sm text-gray-600">Mentorship Relations</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">{careerInsights.professionalNetwork.influenceScore}</div>
                  <p className="text-sm text-gray-600">Influence Score</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={careerInsights.professionalNetwork.networkBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="connections" fill="#3B82F6" name="Connections" />
                    <Bar yAxisId="right" dataKey="influence" fill="#10B981" name="Influence Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Learning & Development Tracking */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-6">
                <AcademicCapIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold text-gray-900">Learning & Development Progress</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Current Learning Goals</h4>
                  <div className="space-y-4">
                    {(careerInsights.learningDevelopment?.currentGoals || []).map((goal, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">{goal.skill}</span>
                          <span className="text-sm text-gray-600">Target: {goal.target}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-sm font-medium text-indigo-600">{goal.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Learning Activity Timeline</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={careerInsights.learningDevelopment.activityTimeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="hours" stroke="#8B5CF6" strokeWidth={2} name="Learning Hours" />
                        <Line type="monotone" dataKey="courses" stroke="#10B981" strokeWidth={2} name="Courses Completed" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
            </div>
         );

      case 'resume-builder':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <DocumentTextIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Resume Builder</h2>
                  <p className="text-gray-600">Create and optimize your professional resume</p>
                </div>
              </div>
              <div className="text-center py-12">
                <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Resume Builder Coming Soon</h3>
                <p className="text-gray-600">AI-powered resume creation and optimization tools are in development.</p>
              </div>
            </div>
          </div>
        );

      case 'documents':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                  <DocumentTextIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Career Documents</h2>
                  <p className="text-gray-600">Manage your professional documents and certifications</p>
                </div>
              </div>
              <DocumentManager 
                  analysisProgress={analysisProgress}
                  setAnalysisProgress={setAnalysisProgress}
                  setSectionStatus={setSectionStatus}
                  setProfessionalData={setProfessionalData}
                  addNotification={addNotification}
                  setLastAnalyzedDocumentId={setLastAnalyzedDocumentId}
                />
            </div>
          </div>
        );

       case 'planning':
         return (
           <div className="space-y-8">

             {/* 1. Career Options Exploration */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <MapIcon className="h-6 w-6 text-blue-600" />
                 <h3 className="text-xl font-semibold text-gray-900">1. Career Options Exploration</h3>
               </div>
               <p className="text-gray-600 mb-6">Identify all feasible career paths based on personal data, skillset, and aspirations.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                 {(careerInsights.careerPlanning?.careerOptions || []).map((option, index) => (
                   <div key={index} className={`rounded-xl p-6 border-2 hover:shadow-lg transition-all duration-300 ${
                     option.match === 'high' ? 'border-green-300 bg-green-50' :
                     option.match === 'medium' ? 'border-blue-300 bg-blue-50' :
                     'border-yellow-300 bg-yellow-50'
                   }`}>
                     <div className="flex justify-between items-start mb-4">
                       <h4 className="text-lg font-semibold text-gray-900">{option.title}</h4>
                       <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                         option.match === 'high' ? 'bg-green-100 text-green-700' :
                         option.match === 'medium' ? 'bg-blue-100 text-blue-700' :
                         'bg-yellow-100 text-yellow-700'
                       }`}>
                         {option.match} match
                       </span>
                     </div>
                     <p className="text-sm text-gray-600 mb-4">{option.description}</p>
                     <div className="space-y-2">
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-600">Category:</span>
                         <span className="font-medium text-gray-900">{option.category}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-600">Risk Level:</span>
                         <span className={`font-medium ${
                           option.riskLevel === 'low' ? 'text-green-600' :
                           option.riskLevel === 'medium' ? 'text-yellow-600' :
                           'text-red-600'
                         }`}>{option.riskLevel}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-600">Timeline:</span>
                         <span className="font-medium text-gray-900">{option.timeline}</span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* 2. Option Evaluation & Tradeoff Analysis */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <ScaleIcon className="h-6 w-6 text-purple-600" />
                 <h3 className="text-xl font-semibold text-gray-900">2. Option Evaluation & Tradeoff Analysis</h3>
               </div>
               <p className="text-gray-600 mb-6">Benefits, risks, and opportunity cost of each path aligned with market demand and personal values.</p>
               
               <div className="overflow-x-auto">
                 <table className="w-full border-collapse">
                   <thead>
                     <tr className="bg-gray-50">
                       <th className="text-left p-4 font-semibold text-gray-900">Career Option</th>
                       <th className="text-left p-4 font-semibold text-gray-900">Market Demand</th>
                       <th className="text-left p-4 font-semibold text-gray-900">Values Alignment</th>
                       <th className="text-left p-4 font-semibold text-gray-900">Lifestyle Fit</th>
                       <th className="text-left p-4 font-semibold text-gray-900">Overall Score</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(careerInsights.careerPlanning?.evaluationMatrix || []).map((item, index) => (
                       <tr key={index} className="border-t hover:bg-gray-50">
                         <td className="p-4 font-medium text-gray-900">{item.option}</td>
                         <td className="p-4">
                           <div className="flex items-center space-x-2">
                             <div className={`w-3 h-3 rounded-full ${
                               item.marketDemand >= 8 ? 'bg-green-500' :
                               item.marketDemand >= 6 ? 'bg-yellow-500' :
                               'bg-red-500'
                             }`}></div>
                             <span className="text-sm text-gray-600">{item.marketDemand}/10</span>
                           </div>
                         </td>
                         <td className="p-4">
                           <div className="flex items-center space-x-2">
                             <div className={`w-3 h-3 rounded-full ${
                               item.valuesAlignment >= 8 ? 'bg-green-500' :
                               item.valuesAlignment >= 6 ? 'bg-yellow-500' :
                               'bg-red-500'
                             }`}></div>
                             <span className="text-sm text-gray-600">{item.valuesAlignment}/10</span>
                           </div>
                         </td>
                         <td className="p-4">
                           <div className="flex items-center space-x-2">
                             <div className={`w-3 h-3 rounded-full ${
                               item.lifestyleFit >= 8 ? 'bg-green-500' :
                               item.lifestyleFit >= 6 ? 'bg-yellow-500' :
                               'bg-red-500'
                             }`}></div>
                             <span className="text-sm text-gray-600">{item.lifestyleFit}/10</span>
                           </div>
                         </td>
                         <td className="p-4">
                           <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                             item.overallScore >= 8 ? 'bg-green-100 text-green-700' :
                             item.overallScore >= 6 ? 'bg-yellow-100 text-yellow-700' :
                             'bg-red-100 text-red-700'
                           }`}>
                             {item.overallScore}/10
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* 3. Next Step Recommendations */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <ArrowRightIcon className="h-6 w-6 text-green-600" />
                 <h3 className="text-xl font-semibold text-gray-900">3. Next Step Recommendations</h3>
               </div>
               <p className="text-gray-600 mb-6">Tactical guidance for immediate action across different career strategies.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {(careerInsights.careerPlanning?.nextSteps || []).map((step, index) => (
                   <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                     <div className="flex items-start space-x-3 mb-4">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                         step.priority === 'high' ? 'bg-red-500' :
                         step.priority === 'medium' ? 'bg-yellow-500' :
                         'bg-green-500'
                       }`}>
                         {index + 1}
                       </div>
                       <div className="flex-1">
                         <h4 className="font-semibold text-gray-900 mb-2">{step.strategy}</h4>
                         <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                         <div className="space-y-2">
                           {(step.actions || []).map((action, actionIndex) => (
                             <div key={actionIndex} className="flex items-center space-x-2">
                               <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                               <span className="text-sm text-gray-700">{action}</span>
                             </div>
                           ))}
                         </div>
                         <div className="mt-4 flex justify-between text-xs text-gray-500">
                           <span>Timeline: {step.timeline}</span>
                           <span className={`px-2 py-1 rounded-full ${
                             step.priority === 'high' ? 'bg-red-100 text-red-700' :
                             step.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-green-100 text-green-700'
                           }`}>
                             {step.priority} priority
                           </span>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* 4. Skill Gap Bridging Plan */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <AcademicCapIcon className="h-6 w-6 text-blue-600" />
                 <h3 className="text-xl font-semibold text-gray-900">4. Skill Gap Bridging Plan</h3>
               </div>
               <p className="text-gray-600 mb-6">Identify critical gaps in hard/soft skills for target roles with specific learning recommendations.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Skills Gap Visualization */}
                 <div>
                   <h4 className="font-semibold text-gray-900 mb-4">Current vs Required Skills</h4>
                   <div className="h-80">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={careerInsights.careerPlanning.skillsGapAnalysis}>
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis dataKey="skill" angle={-45} textAnchor="end" height={80} />
                         <YAxis domain={[0, 100]} />
                         <Tooltip formatter={(value, name) => [`${value}%`, name === 'current' ? 'Current Level' : 'Required Level']} />
                         <Bar dataKey="current" fill="#3B82F6" name="current" radius={[2, 2, 0, 0]} />
                         <Bar dataKey="required" fill="#EF4444" name="required" radius={[2, 2, 0, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
                 
                 {/* Bridging Plan */}
                 <div>
                   <h4 className="font-semibold text-gray-900 mb-4">Learning Roadmap</h4>
                   <div className="space-y-4">
                     {(careerInsights.careerPlanning?.bridgingPlan || []).map((item, index) => (
                       <div key={index} className={`border-l-4 pl-4 py-3 rounded-r-lg ${
                         item.priority === 'high' ? 'border-red-500 bg-red-50' :
                         item.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                         'border-green-500 bg-green-50'
                       }`}>
                         <div className="flex justify-between items-start mb-2">
                           <h5 className="font-semibold text-gray-900">{item.skill}</h5>
                           <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                             item.priority === 'high' ? 'bg-red-100 text-red-700' :
                             item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-green-100 text-green-700'
                           }`}>
                             {item.priority}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                         <div className="space-y-1">
                           {(item.resources || []).map((resource, resIndex) => (
                             <div key={resIndex} className="text-xs text-gray-500 flex justify-between items-center">
                               <span>• {resource.name}</span>
                               <div className="flex items-center space-x-2">
                                 <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{resource.type}</span>
                                 <span className={`px-2 py-1 rounded text-xs ${
                                   resource.effort === 'High' ? 'bg-red-100 text-red-600' :
                                   resource.effort === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                                   'bg-green-100 text-green-600'
                                 }`}>{resource.effort}</span>
                               </div>
                             </div>
                           ))}
                         </div>
                         <div className="flex justify-between text-xs text-gray-500 mt-2">
                           <span>Timeline: {item.timeline}</span>
                           <span>Gap: {item.gapSize}%</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>

             {/* 5. Optionality Building Strategy */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <RocketLaunchIcon className="h-6 w-6 text-indigo-600" />
                 <h3 className="text-xl font-semibold text-gray-900">5. Optionality Building Strategy</h3>
               </div>
               <p className="text-gray-600 mb-6">Expand career flexibility through portfolio building and multi-industry exposure.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                   <div className="flex items-center space-x-3 mb-4">
                     <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                     <h4 className="font-semibold text-gray-900">Portfolio Building</h4>
                   </div>
                   <ul className="space-y-2 text-sm text-gray-600">
                     <li>• Side projects in emerging technologies</li>
                     <li>• Technical writing and thought leadership</li>
                     <li>• Speaking at industry conferences</li>
                     <li>• Open source contributions</li>
                   </ul>
                 </div>
                 
                 <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
                   <div className="flex items-center space-x-3 mb-4">
                     <BuildingOfficeIcon className="h-6 w-6 text-green-600" />
                     <h4 className="font-semibold text-gray-900">Multi-Industry Exposure</h4>
                   </div>
                   <ul className="space-y-2 text-sm text-gray-600">
                     <li>• Cross-functional project participation</li>
                     <li>• Industry meetups and networking</li>
                     <li>• Consulting or freelance work</li>
                     <li>• Advisory roles in startups</li>
                   </ul>
                 </div>
                 
                 <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                   <div className="flex items-center space-x-3 mb-4">
                     <TrophyIcon className="h-6 w-6 text-purple-600" />
                     <h4 className="font-semibold text-gray-900">Reputation Capital</h4>
                   </div>
                   <ul className="space-y-2 text-sm text-gray-600">
                     <li>• Professional certifications</li>
                     <li>• Industry awards and recognition</li>
                     <li>• Mentoring junior professionals</li>
                     <li>• Building personal brand online</li>
                   </ul>
                 </div>
               </div>
             </div>

             {/* 6. Timeline & Milestones Planning */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <CalendarIcon className="h-6 w-6 text-indigo-600" />
                 <h3 className="text-xl font-semibold text-gray-900">6. Timeline & Milestones Planning</h3>
               </div>
               <p className="text-gray-600 mb-6">Construct a roadmap with short-term, mid-term, and long-term goals including checkpoints and fallback strategies.</p>
               
               <div className="relative">
                 <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500"></div>
                 
                 <div className="space-y-8">
                   {(careerInsights.careerPlanning?.timeline || []).map((milestone, index) => (
                     <div key={index} className="relative flex items-center space-x-4">
                       <div className={`w-4 h-4 rounded-full border-4 border-white shadow-lg z-10 ${
                         milestone.status === 'completed' ? 'bg-green-500' :
                         milestone.status === 'current' ? 'bg-blue-500' :
                         milestone.status === 'planned' ? 'bg-yellow-500' :
                         'bg-gray-400'
                       }`}></div>
                       <div className="flex-1 bg-gray-50 rounded-lg p-4">
                         <div className="flex justify-between items-start mb-2">
                           <div>
                             <h4 className="font-semibold text-gray-900">{milestone.title}</h4>
                             <p className="text-sm text-gray-600">{milestone.timeframe}</p>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                             milestone.status === 'completed' ? 'bg-green-100 text-green-700' :
                             milestone.status === 'current' ? 'bg-blue-100 text-blue-700' :
                             milestone.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-gray-100 text-gray-700'
                           }`}>
                             {milestone.status}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600 mb-3">{milestone.description}</p>
                         <div className="flex flex-wrap gap-2">
                           {(milestone.keyMilestones || []).map((key, keyIndex) => (
                             <span key={keyIndex} className="text-xs bg-white px-2 py-1 rounded border">
                               {key}
                             </span>
                           ))}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>

             {/* 7. Work-Life-Purpose Alignment */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <HeartIcon className="h-6 w-6 text-pink-600" />
                 <h3 className="text-xl font-semibold text-gray-900">7. Work-Life-Purpose Alignment</h3>
               </div>
               <p className="text-gray-600 mb-6">Evaluate how career choices align with personal life phase, purpose, and well-being.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {(careerInsights.careerPlanning?.alignmentAnalysis || []).map((area, index) => (
                   <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                     <h4 className="font-semibold text-gray-900 mb-4">{area.category}</h4>
                     <div className="space-y-3">
                       {(area.factors || []).map((factor, factorIndex) => (
                         <div key={factorIndex} className="flex justify-between items-center">
                           <span className="text-sm text-gray-600">{factor.aspect}</span>
                           <div className="flex items-center space-x-2">
                             <div className={`w-3 h-3 rounded-full ${
                               factor.score >= 8 ? 'bg-green-500' :
                               factor.score >= 6 ? 'bg-yellow-500' :
                               'bg-red-500'
                             }`}></div>
                             <span className="text-sm font-medium text-gray-900">{factor.score}/10</span>
                           </div>
                         </div>
                       ))}
                     </div>
                     <div className="mt-4 pt-4 border-t border-gray-200">
                       <div className="flex justify-between items-center">
                         <span className="font-medium text-gray-900">Overall Alignment</span>
                         <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                           area.overallScore >= 8 ? 'bg-green-100 text-green-700' :
                           area.overallScore >= 6 ? 'bg-yellow-100 text-yellow-700' :
                           'bg-red-100 text-red-700'
                         }`}>
                           {area.overallScore}/10
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* 8. Decision Support and Scenario Simulation */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <CogIcon className="h-6 w-6 text-gray-600" />
                 <h3 className="text-xl font-semibold text-gray-900">8. Decision Support & Scenario Simulation</h3>
               </div>
               <p className="text-gray-600 mb-6">"What if" simulation with visual comparative views of different career scenarios.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {(careerInsights.careerPlanning?.scenarios || []).map((scenario, index) => (
                   <div key={index} className={`rounded-xl p-6 border-2 ${
                     scenario.recommendation === 'highly recommended' ? 'border-green-300 bg-green-50' :
                     scenario.recommendation === 'recommended' ? 'border-blue-300 bg-blue-50' :
                     scenario.recommendation === 'consider carefully' ? 'border-yellow-300 bg-yellow-50' :
                     'border-red-300 bg-red-50'
                   }`}>
                     <div className="flex justify-between items-start mb-4">
                       <h4 className="font-semibold text-gray-900">{scenario.scenario}</h4>
                       <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                         scenario.recommendation === 'highly recommended' ? 'bg-green-100 text-green-700' :
                         scenario.recommendation === 'recommended' ? 'bg-blue-100 text-blue-700' :
                         scenario.recommendation === 'consider carefully' ? 'bg-yellow-100 text-yellow-700' :
                         'bg-red-100 text-red-700'
                       }`}>
                         {scenario.recommendation}
                       </span>
                     </div>
                     
                     <div className="space-y-3">
                       <div>
                         <h5 className="text-sm font-medium text-gray-900 mb-2">Pros:</h5>
                         <ul className="text-sm text-gray-600 space-y-1">
                           {(scenario.pros || []).map((pro, proIndex) => (
                             <li key={proIndex} className="flex items-start space-x-2">
                               <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                               <span>{pro}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                       
                       <div>
                         <h5 className="text-sm font-medium text-gray-900 mb-2">Cons:</h5>
                         <ul className="text-sm text-gray-600 space-y-1">
                           {(scenario.cons || []).map((con, conIndex) => (
                             <li key={conIndex} className="flex items-start space-x-2">
                               <MinusIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                               <span>{con}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                       
                       <div className="pt-3 border-t border-gray-200">
                         <div className="flex justify-between text-sm">
                           <span className="text-gray-600">Success Probability:</span>
                           <span className="font-medium text-gray-900">{scenario.successProbability}%</span>
                         </div>
                         <div className="flex justify-between text-sm">
                           <span className="text-gray-600">Timeline:</span>
                           <span className="font-medium text-gray-900">{scenario.timeline}</span>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* 9. Emotional & Psychological Readiness */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <FaceSmileIcon className="h-6 w-6 text-yellow-600" />
                 <h3 className="text-xl font-semibold text-gray-900">9. Emotional & Psychological Readiness</h3>
               </div>
               <p className="text-gray-600 mb-6">Evaluate confidence, clarity, and emotional blockers with coaching-type reflections.</p>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Readiness Assessment */}
                 <div>
                   <h4 className="font-semibold text-gray-900 mb-4">Readiness Assessment</h4>
                   <div className="space-y-4">
                     {(careerInsights.careerPlanning?.readinessAssessment || []).map((assessment, index) => (
                       <div key={index} className="bg-gray-50 rounded-lg p-4">
                         <div className="flex justify-between items-center mb-2">
                           <h5 className="font-medium text-gray-900">{assessment.aspect}</h5>
                           <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                             assessment.level === 'high' ? 'bg-green-100 text-green-700' :
                             assessment.level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-red-100 text-red-700'
                           }`}>
                             {assessment.level}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600 mb-2">{assessment.description}</p>
                         {assessment.recommendations && (
                           <div className="text-xs text-gray-500">
                             <strong>Recommendation:</strong> {assessment.recommendations}
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
                 
                 {/* Coaching Reflections */}
                 <div>
                   <h4 className="font-semibold text-gray-900 mb-4">Coaching Reflections</h4>
                   <div className="space-y-4">
                     {(careerInsights.careerPlanning?.coachingReflections || []).map((reflection, index) => (
                       <div key={index} className="border border-gray-200 rounded-lg p-4">
                         <h5 className="font-medium text-gray-900 mb-2">{reflection.question}</h5>
                         <p className="text-sm text-gray-600 mb-3">{reflection.insight}</p>
                         <div className="bg-blue-50 rounded-lg p-3">
                           <p className="text-sm text-blue-800">
                             <strong>Action:</strong> {reflection.actionItem}
                           </p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>

             {/* 10. Continuous Replanning Capability */}
             <div className="bg-white rounded-2xl shadow-lg p-8">
               <div className="flex items-center space-x-3 mb-6">
                 <ArrowTrendingUpIcon className="h-6 w-6 text-indigo-600" />
                 <h3 className="text-xl font-semibold text-gray-900">10. Continuous Replanning Capability</h3>
               </div>
               <p className="text-gray-600 mb-6">Allow the plan to evolve with life changes, new opportunities, and updated skill levels.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center">
                   <CalendarIcon className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                   <h4 className="font-semibold text-gray-900 mb-2">Quarterly Reviews</h4>
                   <p className="text-sm text-gray-600">Regular assessment of progress and goal adjustment</p>
                 </div>
                 
                 <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-center">
                   <RocketLaunchIcon className="h-8 w-8 text-green-600 mx-auto mb-3" />
                   <h4 className="font-semibold text-gray-900 mb-2">Opportunity Tracking</h4>
                   <p className="text-sm text-gray-600">Monitor new opportunities and market changes</p>
                 </div>
                 
                 <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 text-center">
                   <AcademicCapIcon className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                   <h4 className="font-semibold text-gray-900 mb-2">Skill Evolution</h4>
                   <p className="text-sm text-gray-600">Update skill assessments and learning paths</p>
                 </div>
                 
                 <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 text-center">
                   <HeartIcon className="h-8 w-8 text-yellow-600 mx-auto mb-3" />
                   <h4 className="font-semibold text-gray-900 mb-2">Life Integration</h4>
                   <p className="text-sm text-gray-600">Adapt plans to personal life changes</p>
                 </div>
               </div>
               
               <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6">
                 <div className="flex items-center space-x-3 mb-4">
                   <InformationCircleIcon className="h-6 w-6 text-indigo-600" />
                   <h4 className="font-semibold text-gray-900">Next Review Scheduled</h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                   <div>
                     <span className="text-gray-600">Date:</span>
                     <span className="ml-2 font-medium text-gray-900">March 15, 2024</span>
                   </div>
                   <div>
                     <span className="text-gray-600">Focus Areas:</span>
                     <span className="ml-2 font-medium text-gray-900">Skills, Market Trends</span>
                   </div>
                   <div>
                     <span className="text-gray-600">Status:</span>
                     <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">On Track</span>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         );

      case 'insights':
        return (
          <div className="space-y-8">
            {insightsTab === 'identity' && ( /* Professional Identity Summary */
            <div className="bg-white rounded-2xl shadow-lg p-8">
              
              {/* Professional Identity Section */}
              {professionalData.professionalIdentity && Object.keys(professionalData.professionalIdentity).length > 0 ? (
                <div className="space-y-6">
                  {/* Main Professional Identity Card */}
                  <div className="bg-gradient-to-br from-indigo-50 via-white to-cyan-50 border border-indigo-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="flex items-start space-x-4 mb-6">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <BriefcaseIcon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">
                          {professionalData.professionalIdentity?.title || 'Professional Title'}
                        </h3>
                        <p className="text-gray-700 text-lg leading-relaxed">
                          {professionalData.professionalIdentity?.summary || 'Professional summary not available'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Key Highlights */}
                    {(professionalData.professionalIdentity?.keyHighlights || professionalData.professionalIdentity?.key_highlights || []).length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                          <CheckCircleIcon className="h-5 w-5 text-emerald-500 mr-2" />
                          Key Highlights
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(professionalData.professionalIdentity?.keyHighlights || professionalData.professionalIdentity?.key_highlights || []).map((highlight, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-indigo-300 transition-colors duration-200">
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"></div>
                                </div>
                                <span className="text-gray-700 text-sm leading-relaxed">{highlight}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Professional Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <BriefcaseIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">Current Role</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 leading-tight">
                        {professionalData.professionalIdentity?.currentRole || professionalData.professionalIdentity?.current_role || 'Not specified'}
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <ClockIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">Current Industry</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 leading-tight">
                        {professionalData.professionalIdentity?.currentIndustry || professionalData.professionalIdentity?.current_industry || 'Not specified'}
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">Current Company</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 leading-tight">
                        {professionalData.professionalIdentity?.currentCompany || professionalData.professionalIdentity?.current_company || 'Not specified'}
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-red-300 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <MapPinIcon className="h-5 w-5 text-red-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">Current Location</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 leading-tight">
                        {professionalData.professionalIdentity?.location || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 text-center border border-gray-200">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                      <BriefcaseIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-700 mb-2">Professional Identity Analysis</h3>
                      <p className="text-gray-500">
                        {analysisProgress.isAnalyzing && (analysisProgress.currentSection === 'professionalIdentity' || sectionStatus.professionalIdentity === 'analyzing')
                          ? 'Analyzing your professional identity...'
                          : 'Upload your resume to begin professional identity analysis'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            )}
            {/* Industry Experience & Work History Section */}
            {insightsTab === 'work' && (
            <div className="space-y-8">
              {/* Section Header */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Industry Experience & Work History</h2>
                <p className="text-gray-600 max-w-2xl mx-auto">Comprehensive analysis of professional journey, career progression, and industry expertise</p>
              </div>

              {/* Key Metrics Overview */}
              <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl shadow-xl p-8 border border-indigo-100">
                <div className="flex items-center justify-center space-x-3 mb-8">
                  <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full">
                    <BuildingOfficeIcon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Career Analytics Dashboard</h3>
                </div>
                
                {/* Enhanced Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-100 hover:border-blue-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Experience</span>
                      </div>
                      <div className="text-3xl font-bold text-blue-600 mb-1">{professionalData.workExperience?.analytics?.workingYears?.years || 'N/A'}</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Working Years</div>
                      <div className="text-xs text-blue-500">{professionalData.workExperience?.analytics?.workingYears?.period || ''}</div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-green-100 hover:border-green-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Roles</span>
                      </div>
                      <div className="text-3xl font-bold text-green-600 mb-1">{professionalData.workExperience?.analytics?.heldRoles?.count || 'N/A'}</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Held Roles</div>
                      <div className="text-xs text-green-500">Longest: {professionalData.workExperience?.analytics?.heldRoles?.longest || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 hover:border-purple-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Titles</span>
                      </div>
                      <div className="text-3xl font-bold text-purple-600 mb-1">{professionalData.workExperience?.analytics?.heldTitles?.count || 'N/A'}</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Held Titles</div>
                      <div className="text-xs text-purple-500">Shortest: {professionalData.workExperience?.analytics?.heldTitles?.shortest || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-orange-100 hover:border-orange-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-orange-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Companies</span>
                      </div>
                      <div className="text-3xl font-bold text-orange-600 mb-1">{professionalData.workExperience?.analytics?.companies?.count || 'N/A'}</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Companies</div>
                      <div className="text-xs text-orange-500">Longest: {professionalData.workExperience?.analytics?.companies?.longest || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Career Insights */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Career Intelligence Insights</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Career Gaps Analysis</div>
                        <div className="text-sm text-gray-600">{professionalData.workExperience?.analytics?.insights?.gaps || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Shortest Tenure</div>
                        <div className="text-sm text-gray-600">{professionalData.workExperience?.analytics?.insights?.shortestTenure || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl">
                      <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Company Size Preference</div>
                        <div className="text-sm text-gray-600">{professionalData.workExperience?.analytics?.insights?.companySize || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                      <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Average Role Duration</div>
                        <div className="text-sm text-gray-600">{professionalData.workExperience?.analytics?.insights?.averageRoleDuration || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Career Timeline Section */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">

                <div className="flex items-center justify-center space-x-4 mb-10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                    <div className="relative p-4 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-full shadow-xl">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Professional Career Timeline</h3>
                    <p className="text-gray-600 text-sm font-medium">Visualize your professional journey through time</p>
                  </div>
                </div>
                
                {/* Enhanced Career Timeline Visualization */}
                <div className="space-y-6">
                  
                  {/* Enhanced Timeline Container */}
                  <div className="relative pb-8 px-8">
                    {/* Main Timeline */}
                    <div className="relative w-full h-40">
                      {/* Enhanced Timeline Base Line with Glow Effect */}
                      <div className="absolute top-16 left-0 right-0 h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 rounded-full shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-300 via-indigo-400 to-purple-400 rounded-full blur-sm opacity-60"></div>
                      </div>
                      {/* Timeline Decorative Elements */}
                      <div className="absolute top-15 left-0 w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg border-2 border-white"></div>
                      <div className="absolute top-15 right-0 w-4 h-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg border-2 border-white"></div>
                      
                      {/* Enhanced Year Markers */}
                      <div className="absolute top-0 left-0 right-0 text-sm text-gray-600 font-semibold">
                        {(() => {
                          const timelineStart = professionalData.workExperience?.timelineStart || 2008;
                          const timelineEnd = professionalData.workExperience?.timelineEnd || 2024;
                          const toMonthIndex = (val) => { const y=Math.floor(val); const m=Math.round((val-y)*100); return y*12+(m-1);} ;
                           const timelineStartMonths = toMonthIndex(timelineStart);
                           const timelineEndMonths = toMonthIndex(timelineEnd);
                           const totalMonths = timelineEndMonths - timelineStartMonths;
                           const monthStep = Math.max(1, Math.ceil(totalMonths / 12)); // about 12 markers (≈1/yr)
                           const monthsArr = [];
                           for (let m = timelineStartMonths; m <= timelineEndMonths; m += monthStep) { monthsArr.push(m);} 
                           if (monthsArr[monthsArr.length-1] !== timelineEndMonths){ monthsArr.push(timelineEndMonths);} 
                           const labelFromMonths = (idx)=>{ const y=Math.floor(idx/12); const m=(idx%12)+1; return `${y}.${String(m).padStart(2,'0')}`; };
                           return monthsArr.map((mIdx) => {
                            // Position based on month index relative to overall timeline
                            const leftPercent = ((mIdx - timelineStartMonths) / totalMonths) * 100;
                            const label = labelFromMonths(mIdx);
                            
                            return (
                              <div
                                key={label}
                                className="absolute flex flex-col items-center transform -translate-x-1/2"
                                style={{ left: `${leftPercent}%` }}
                              >
                                <div className="bg-white px-3 py-1 rounded-full shadow-md border border-gray-200 mb-2">
                                  <span className="text-gray-700 font-bold text-xs">{label}</span>
                                </div>
                                <div className="w-0.5 h-6 bg-gradient-to-b from-gray-400 to-gray-300 rounded-full shadow-sm"></div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* Enhanced Career Experience Blocks */}
                      <div className="absolute top-16 left-0 right-0">
                        {(professionalData.workExperience?.companies || []).map((job, index) => {
                          // Calculate position and width based on timeline (2008-2024 = 16 years total)
                          // Helper converts YYYY.MM numeric to continuous month index
                          const toMonthIndex = (val) => {
                            const year = Math.floor(val);
                            const month = Math.round((val - year) * 100); // 1-12
                            return year * 12 + (month - 1);
                          };

                          // Format numeric YYYY.MM to string "YYYY.MM"
                          const formatYearMonth = (val) => {
                            const year = Math.floor(val);
                            const month = Math.round((val - year) * 100);
                            return `${year}.${String(month).padStart(2,'0')}`;
                          };

                          const timelineStartRaw = professionalData.workExperience.timelineStart || 2008;
                          const timelineEndRaw = professionalData.workExperience.timelineEnd || 2024;
                          const timelineStartMonths = toMonthIndex(timelineStartRaw);
                          const timelineEndMonths = toMonthIndex(timelineEndRaw);
                          const totalMonths = timelineEndMonths - timelineStartMonths;

                          const jobStartMonths = toMonthIndex(job.startYear);
                          const jobEndMonths = toMonthIndex(job.endYear);
                          const leftPercent = ((jobStartMonths - timelineStartMonths) / totalMonths) * 100;
                          const widthPercent = ((jobEndMonths - jobStartMonths) / totalMonths) * 100;
                          
                          // Adaptive color assignment system
                          const colorPalette = [
                            { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', border: 'border-blue-400', glow: 'from-blue-500/20 to-blue-600/20' },
                            { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', border: 'border-emerald-400', glow: 'from-emerald-500/20 to-emerald-600/20' },
                            { bg: 'bg-gradient-to-r from-purple-500 to-purple-600', border: 'border-purple-400', glow: 'from-purple-500/20 to-purple-600/20' },
                            { bg: 'bg-gradient-to-r from-orange-500 to-orange-600', border: 'border-orange-400', glow: 'from-orange-500/20 to-orange-600/20' },
                            { bg: 'bg-gradient-to-r from-pink-500 to-pink-600', border: 'border-pink-400', glow: 'from-pink-500/20 to-pink-600/20' },
                            { bg: 'bg-gradient-to-r from-indigo-500 to-indigo-600', border: 'border-indigo-400', glow: 'from-indigo-500/20 to-indigo-600/20' },
                            { bg: 'bg-gradient-to-r from-teal-500 to-teal-600', border: 'border-teal-400', glow: 'from-teal-500/20 to-teal-600/20' },
                            { bg: 'bg-gradient-to-r from-red-500 to-red-600', border: 'border-red-400', glow: 'from-red-500/20 to-red-600/20' },
                            { bg: 'bg-gradient-to-r from-yellow-500 to-yellow-600', border: 'border-yellow-400', glow: 'from-yellow-500/20 to-yellow-600/20' },
                            { bg: 'bg-gradient-to-r from-cyan-500 to-cyan-600', border: 'border-cyan-400', glow: 'from-cyan-500/20 to-cyan-600/20' }
                          ];
                          const assignedColor = colorPalette[index % colorPalette.length];
                          
                          return (
                            <div 
                              key={index}
                              className={`absolute group cursor-pointer transition-all duration-300 hover:scale-105 hover:z-10 transform -translate-y-1/2`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                
                              }}
                            >
                              {/* Connection Line to Timeline */}
                              <div 
                                className="hidden"
                                style={{
                                  left: '50%',
                                  top: index % 2 === 0 ? '100%' : '-20px',
                                  height: '20px'
                                }}
                              ></div>
                              
                              {/* Enhanced Experience Card */}
                              <div className={`${assignedColor.bg} ${assignedColor.border} border-3 rounded-xl p-3 shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:scale-110 relative overflow-hidden`}>
                                {/* Shimmer Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                {/* Work Duration Display */}
                                <div className="relative z-10 flex items-center justify-center h-6">
                                  <div className="text-white font-bold text-sm drop-shadow-lg">
                                    {(() => {
                                      const duration = job.endYear - job.startYear;
                                      return duration >= 1 ? `${duration.toFixed(1)}y` : `${Math.round(duration * 12)}m`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Enhanced Dark Theme Tooltip */}
                              <div 
                                className="absolute top-full mt-4 px-6 py-5 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white text-sm rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 pointer-events-none whitespace-normal z-50 shadow-2xl border-2 border-blue-400/30 backdrop-blur-sm ring-4 ring-blue-500/20"
                                style={{
                                  left: (() => {
                                    // Boundary detection and adaptive positioning
                                    const tooltipWidth = 320; // minWidth
                                    const centerPercent = leftPercent + widthPercent / 2;
                                    
                                    // If tooltip center position is too far left (would exceed left boundary)
                                    if (centerPercent < 25) {
                                      return '0%';
                                    }
                                    // If tooltip center position is too far right (would exceed right boundary)
                                    else if (centerPercent > 75) {
                                      return '100%';
                                    }
                                    // Normal case: center display
                                    else {
                                      return '50%';
                                    }
                                  })(),
                                  transform: (() => {
                                    const centerPercent = leftPercent + widthPercent / 2;
                                    
                                    // Adjust transform based on position
                                    if (centerPercent < 25) {
                                      return 'translateX(0%)';
                                    }
                                    else if (centerPercent > 75) {
                                      return 'translateX(-100%)';
                                    }
                                    else {
                                      return 'translateX(-50%)';
                                    }
                                  })(),
                                  minWidth: '320px',
                                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.2)'
                                }}
                              >
                                {/* Tooltip Content with Dark Theme Styling */}
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full shadow-lg animate-pulse"></div>
                                    <div className="font-bold text-xl text-white">{job.company}</div>
                                  </div>
                                  <div className="flex items-center space-x-3 ml-6">
                                    <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
                                    <div className="text-gray-200 font-semibold text-base">{job.role}</div>
                                  </div>
                                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-600">
                                    <div className="text-sm text-gray-300 font-medium bg-gray-700/50 px-3 py-1 rounded-full">
                                      {formatYearMonth(job.startYear)} - {job.endYear === 2024.6 ? 'Present' : formatYearMonth(job.endYear)}
                                    </div>
                                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                                      {job.duration} years
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Enhanced Dark Theme Tooltip Arrow */}
                                <div 
                                  className="absolute -top-3"
                                  style={{
                                     left: (() => {
                                       const centerPercent = leftPercent + widthPercent / 2;
                                       
                                       // Adjust arrow position based on tooltip position
                                       if (centerPercent < 25) {
                                         // When tooltip is left-aligned, arrow should point to Career Experience Block center
                                         return `${centerPercent}%`;
                                       }
                                       else if (centerPercent > 75) {
                                         // When tooltip is right-aligned, arrow should point to Career Experience Block center
                                         return `${centerPercent - 75}%`;
                                       }
                                       else {
                                         // When tooltip is centered, arrow is in the middle
                                         return '50%';
                                       }
                                     })(),
                                     transform: 'translateX(-50%)'
                                   }}
                                >
                                  <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900 drop-shadow-lg"></div>
                                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-b-6 border-transparent border-b-slate-800"></div>
                                </div>
                                
                                {/* Enhanced Glow Effect for Dark Theme */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${assignedColor.glow} rounded-2xl -z-10 blur-2xl`}></div>
                                <div className={`absolute -inset-2 bg-gradient-to-r ${assignedColor.glow} rounded-3xl -z-20 blur-3xl animate-pulse`}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Experience Distribution Charts */}
              <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-3xl shadow-xl p-8 border border-slate-100">
                <div className="flex items-center justify-center space-x-3 mb-10">
                  <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full">
                    <ChartPieIcon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Professional Experience Distribution</h3>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  {/* Industry Sectors Chart */}
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-full mb-2">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">Industry Sectors</h4>
                      </div>
                      <p className="text-sm text-gray-600">Years of experience across different industries</p>
                    </div>
                    <div className="h-[28rem] relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 rounded-xl -z-10"></div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={professionalData.workExperience?.industries || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={90}
                            outerRadius={190}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontWeight: 'bold', fontSize: '13px', textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
                                    {value}y
                                </text>
                              );
                            }}
                            labelLine={false}
                            stroke="#fff"
                            strokeWidth={2}
                          >
                            {(professionalData.workExperience?.industries || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={chartColorPalette[index % chartColorPalette.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => {
                              const total = (professionalData.workExperience?.industries || []).reduce((sum, item) => sum + item.value, 0);
                              const percent = ((value / total) * 100).toFixed(1);
                              return [`${value} years (${percent}%)`, name];
                            }}
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                              fontSize: '13px'
                            }}
                          />

                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Company Experience Chart */}
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 rounded-full mb-2">
                        <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">Company Experience</h4>
                      </div>
                      <p className="text-sm text-gray-600">Years spent at different organizations</p>
                    </div>
                    <div className="h-[28rem] relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-teal-50/30 rounded-xl -z-10"></div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={companyExperienceData || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={90}
                            outerRadius={190}
                            fill="#8884d8"
                            dataKey="years"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontWeight: 'bold', fontSize: '13px', textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
                                    {value}y
                                </text>
                              );
                            }}
                            labelLine={false}
                            stroke="#fff"
                            strokeWidth={2}
                          >
                            {(companyExperienceData || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => {
                              const total = (companyExperienceData || []).reduce((sum, item) => sum + item.years, 0);
                              const percent = ((value / total) * 100).toFixed(1);
                              return [`${value} years (${percent}%)`, name];
                            }}
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                              fontSize: '13px'
                            }}
                          />

                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            )}

              {insightsTab === 'salary' && (/* Salary Analysis Section */
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-6">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">Salary Analysis & Trends</h3>
              </div>

              {/* Current Salary Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    ${professionalData.salaryAnalysis?.currentSalary?.amount || 'N/A'}K
                  </div>
                  <p className="text-sm text-green-700 font-medium">Current Salary</p>
                  <p className="text-xs text-green-600 mt-1">
                    {professionalData.salaryAnalysis?.currentSalary?.confidence || 0}% confidence
                  </p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    ${professionalData.salaryAnalysis?.marketComparison?.industryAverage || 'N/A'}K
                  </div>
                  <p className="text-sm text-blue-700 font-medium">Industry Average</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {professionalData.salaryAnalysis?.marketComparison?.percentile || 0}th percentile
                  </p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {((professionalData.salaryAnalysis?.currentSalary?.amount || 0) / (professionalData.salaryAnalysis?.marketComparison?.industryAverage || 1) * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-purple-700 font-medium">vs Industry</p>
                  <p className="text-xs text-purple-600 mt-1">
                    {(professionalData.salaryAnalysis?.currentSalary?.amount || 0) > (professionalData.salaryAnalysis?.marketComparison?.industryAverage || 0) ? 'Above' : 'Below'} average
                  </p>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {professionalData.salaryAnalysis?.marketComparison?.locationAdjustment || 1.0}x
                  </div>
                  <p className="text-sm text-orange-700 font-medium">Location Factor</p>
                  <p className="text-xs text-orange-600 mt-1">Cost adjustment</p>
                </div>
              </div>

              {/* Salary Trends Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Historical Salary Trend */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 mr-2" />
                    Historical Salary Progression ({professionalData.workExperience?.timelineStart || 'Start'} - {professionalData.workExperience?.timelineEnd || 'Present'})
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        const historicalData = professionalData.salaryAnalysis?.historicalTrend || [];
                        const timelineStart = professionalData.workExperience?.timelineStart;
                        const timelineEnd = professionalData.workExperience?.timelineEnd;

                        // Ensure data covers the complete timeline
                        if (historicalData.length > 0 && timelineStart && timelineEnd) {
                          // Create a copy and sort data by year to ensure proper chronological order
                          return [...historicalData].sort((a, b) => a.year - b.year);
                        }
                        return historicalData;
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="year"
                          stroke="#666"
                          fontSize={12}
                          domain={[
                            Math.floor(professionalData.workExperience?.timelineStart || 2020),
                            Math.floor(professionalData.workExperience?.timelineEnd || new Date().getFullYear())
                          ]}
                          type="number"
                          scale="linear"
                        />
                        <YAxis
                          stroke="#666"
                          fontSize={12}
                          tickFormatter={(value) => `$${value}K`}
                        />
                        <Tooltip
                          formatter={(value, name) => [`$${value}K`, 'Salary']}
                          labelFormatter={(label) => `Year: ${label}`}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-semibold text-gray-800">{`Year: ${label}`}</p>
                                  <p className="text-green-600 font-medium">{`Salary: $${payload[0].value}K`}</p>
                                  {data.role && <p className="text-sm text-gray-600">{`Role: ${data.role}`}</p>}
                                  {data.company && <p className="text-sm text-gray-600">{`Company: ${data.company}`}</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="salary"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Projected Growth */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <RocketLaunchIcon className="h-5 w-5 text-blue-600 mr-2" />
                    Salary Projections (Next 5 Years)
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        const projectedData = professionalData.salaryAnalysis?.projectedGrowth || [];

                        // Ensure data covers the next 5 years starting from current year
                        if (projectedData.length > 0) {
                          // Create a copy and sort data by year to ensure proper chronological order
                          return [...projectedData].sort((a, b) => a.year - b.year);
                        }
                        return projectedData;
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="year"
                          stroke="#666"
                          fontSize={12}
                          domain={['dataMin', 'dataMax']}
                          type="number"
                          scale="linear"
                        />
                        <YAxis
                          stroke="#666"
                          fontSize={12}
                          tickFormatter={(value) => `$${value}K`}
                        />
                        <Tooltip
                          formatter={(value, name) => [`$${value}K`, 'Projected Salary']}
                          labelFormatter={(label) => `Year: ${label}`}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-semibold text-gray-800">{`Year: ${label}`}</p>
                                  <p className="text-blue-600 font-medium">{`Projected Salary: $${payload[0].value}K`}</p>
                                  {data.scenario && <p className="text-sm text-gray-600">{`Scenario: ${data.scenario}`}</p>}
                                  {data.role && <p className="text-sm text-gray-600">{`Projected Role: ${data.role}`}</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="salary"
                          stroke="#3B82F6"
                          strokeWidth={3}
                          strokeDasharray={(professionalData.salaryAnalysis?.projectedGrowth || []).some(item => item.scenario === 'conservative') ? "5 5" : "0"}
                          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Salary Factors Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Salary Impact Factors */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <ScaleIcon className="h-5 w-5 text-purple-600 mr-2" />
                    Salary Impact Factors
                  </h4>
                  <div className="space-y-4">
                    {[
                      { name: 'Experience', value: professionalData.salaryAnalysis?.salaryFactors?.experienceImpact || 0, color: '#10B981' },
                      { name: 'Skills', value: professionalData.salaryAnalysis?.salaryFactors?.skillsImpact || 0, color: '#3B82F6' },
                      { name: 'Location', value: professionalData.salaryAnalysis?.salaryFactors?.locationImpact || 0, color: '#F59E0B' },
                      { name: 'Industry', value: professionalData.salaryAnalysis?.salaryFactors?.industryImpact || 0, color: '#EC4899' }
                    ].map((factor, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 w-20">{factor.name}</span>
                        <div className="flex-1 mx-4">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="h-3 rounded-full transition-all duration-500"
                              style={{
                                width: `${factor.value}%`,
                                backgroundColor: factor.color
                              }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">{factor.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Salary Optimization Recommendations */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <LightBulbIcon className="h-5 w-5 text-yellow-600 mr-2" />
                    Salary Optimization Strategies
                  </h4>
                  <div className="space-y-3">
                    {(professionalData.salaryAnalysis?.recommendations || []).map((rec, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{rec.strategy}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            rec.impact === 'high' ? 'bg-green-100 text-green-800' :
                            rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {rec.impact} impact
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <ClockIcon className="h-3 w-3 mr-1" />
                          {rec.timeframe}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            )}
              {/* Skills Analysis - Full Width */}
              {insightsTab === 'skills' && (
            <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center space-x-3 mb-6">
                <CpuChipIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">Skills Analysis</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Technical Skills Radar Chart */}
                <div className="h-[32rem] bg-gradient-to-br from-white to-indigo-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 text-center mb-4 flex items-center justify-center">
                    <CpuChipIcon className="h-5 w-5 text-indigo-600 mr-2" />
                    Technical Skills
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={(professionalData.skillsAnalysis?.hardSkills || []).map(s => ({ subject: s.skill, A: s.level, fullMark: 100 }))}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={(props) => {
                        const { x, y, textAnchor, payload } = props;
                        const formatTick = (value) => {
                          const words = value.split(' ');
                          if (words.length > 1) {
                              return words;
                          }
                          if (value.length > 10) {
                              const mid = Math.ceil(value.length / 2);
                              return [value.slice(0, mid) + '-', value.slice(mid)];
                          }
                          return [value];
                         };
                        const words = formatTick(payload.value);
                        const yOffset = words.length > 1 ? -(words.length - 1) * 6 : 0;
                        return (
                          <g transform={`translate(${x},${y + yOffset})`}>
                            <text textAnchor={textAnchor || 'middle'} fill="#4b5563" fontSize={12} fontWeight="600">
                              {(words || []).map((word, i) => (
                                <tspan x={0} dy={i > 0 ? '1.2em' : 0} key={i}>
                                  {word}
                                </tspan>
                              ))}
                            </text>
                          </g>
                        );
                      }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Radar 
                        name="Proficiency" 
                        dataKey="A" 
                        stroke="#4f46e5" 
                        fill="#4f46e5" 
                        fillOpacity={0.4}
                        strokeWidth={2} 
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          padding: '8px 12px'
                        }}
                        formatter={(value) => [`${value}%`, 'Proficiency']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Soft Skills Radar Chart */}
                <div className="h-[32rem] bg-gradient-to-br from-white to-emerald-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 text-center mb-4 flex items-center justify-center">
                    <UserGroupIcon className="h-5 w-5 text-emerald-600 mr-2" />
                    Soft Skills
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={(professionalData.skillsAnalysis?.softSkills || []).map(s => ({ subject: s.skill, A: (s.current / s.target) * 100, fullMark: 100 }))}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={(props) => {
                        const { x, y, textAnchor, payload } = props;
                        const formatTick = (value) => {
                          const words = value.split(' ');
                          if (words.length > 1) {
                              return words;
                          }
                          if (value.length > 10) {
                              const mid = Math.ceil(value.length / 2);
                              return [value.slice(0, mid) + '-', value.slice(mid)];
                          }
                          return [value];
                         };
                        const words = formatTick(payload.value);
                        const yOffset = words.length > 1 ? -(words.length - 1) * 6 : 0;
                        return (
                          <g transform={`translate(${x},${y + yOffset})`}>
                            <text textAnchor={textAnchor || 'middle'} fill="#4b5563" fontSize={12} fontWeight="600">
                              {(words || []).map((word, i) => (
                                <tspan x={0} dy={i > 0 ? '1.2em' : 0} key={i}>
                                  {word}
                                </tspan>
                              ))}
                            </text>
                          </g>
                        );
                      }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Radar 
                        name="Level" 
                        dataKey="A" 
                        stroke="#059669" 
                        fill="#059669" 
                        fillOpacity={0.4}
                        strokeWidth={2} 
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          padding: '8px 12px'
                        }}
                        formatter={(value) => [`${value}%`, 'Level']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            )}

            {insightsTab === 'skills' && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Core Strengths */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <StarIcon className="h-8 w-8 text-yellow-500 animate-pulse" />
                    <h3 className="text-2xl font-bold text-gray-800 tracking-wide">Core Strengths</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="30%" 
                          outerRadius="100%" 
                          data={(professionalData.skillsAnalysis?.coreStrengths || []).map((s, index) => ({ ...s, fill: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#6366F1'][index % 5] }))}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <RadialBar
                            minAngle={15}
                            background
                            clockWise
                            dataKey="score"
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(255, 255, 255, 0.9)',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.75rem',
                              padding: '8px 12px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                              backdropFilter: 'blur(4px)',
                            }}
                            formatter={(value, name, props) => [`${value}/100`, props.payload.area]}
                            cursor={{ fill: 'transparent' }}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4 pr-4">
                      {(professionalData.skillsAnalysis?.coreStrengths || []).map((strength, index) => (
                        <div key={index} className="flex items-start p-4 rounded-lg bg-gray-50 transition-shadow duration-300 hover:shadow-md">
                          <span className="flex-shrink-0 h-3 w-3 rounded-full mt-1.5 mr-3" style={{ backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#6366F1'][index % 5] }}></span>
                          <div className="flex-grow">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-gray-800">{strength.area}</h4>
                              <span className="font-bold text-sm text-gray-700">{strength.score}<span className="text-xs text-gray-500">/100</span></span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{strength.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Development Areas */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <AcademicCapIcon className="h-8 w-8 text-indigo-500" />
                    <h3 className="text-2xl font-bold text-gray-800 tracking-wide">Development Areas</h3>
                  </div>
                  <div className="space-y-6">
                    {(professionalData.skillsAnalysis?.developmentAreas || []).map((area, index) => (
                      <div key={index} className={`p-5 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg ${
                        area.priority === 'high' 
                          ? 'bg-red-50 border-l-4 border-red-500' 
                          : 'bg-yellow-50 border-l-4 border-yellow-500'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-lg text-gray-800">{area.area}</h4>
                            <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            area.priority === 'high' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {area.priority} priority
                          </span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-start space-x-4">
                          <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200">
                            <BellIcon className="h-5 w-5" />
                            <span>Set Reminders</span>
                          </button>
                          <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200">
                            <FlagIcon className="h-5 w-5" />
                            <span>Create Goal</span>
                          </button>
                          <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200">
                            <ChartBarIcon className="h-5 w-5" />
                            <span>Track Progress</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}
              {insightsTab === 'market' && (/* Market Position & Competitiveness */
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-6">
                <ScaleIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold text-gray-900">Market Position & Competitiveness</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{professionalData.marketPosition?.competitiveness || 'N/A'}%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Market Competitiveness</h4>
                  <p className="text-sm text-gray-600">{(professionalData.marketPosition?.competitiveness || 0) >= 80 ? 'Above industry average' : (professionalData.marketPosition?.competitiveness || 0) >= 60 ? 'Industry average' : 'Below industry average'}</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{professionalData.marketPosition?.skillRelevance || 'N/A'}%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Skill Relevance</h4>
                  <p className="text-sm text-gray-600">{(professionalData.marketPosition?.skillRelevance || 0) >= 90 ? 'Highly relevant skills' : (professionalData.marketPosition?.skillRelevance || 0) >= 70 ? 'Relevant skills' : 'Skills need updating'}</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{professionalData.marketPosition?.industryDemand || 'N/A'}%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Industry Demand</h4>
                  <p className="text-sm text-gray-600">{(professionalData.marketPosition?.industryDemand || 0) >= 75 ? 'High demand sector' : (professionalData.marketPosition?.industryDemand || 0) >= 50 ? 'Moderate demand' : 'Low demand sector'}</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{professionalData.marketPosition?.careerPotential || 'N/A'}%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Career Potential</h4>
                  <p className="text-sm text-gray-600">{(professionalData.marketPosition?.careerPotential || 0) >= 85 ? 'Strong growth potential' : (professionalData.marketPosition?.careerPotential || 0) >= 65 ? 'Moderate growth potential' : 'Limited growth potential'}</p>
                </div>
              </div>
            </div>
            )}
          </div>
        );

      case 'planning':
        return (
          <div className="space-y-6">
            {/* Career Roadmap */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center">
                  <ArrowTrendingUpIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Personalized Career Roadmap</h2>
                  <p className="text-gray-600">Your path to {careerPlanning.nextMilestone}</p>
                </div>
              </div>

              {/* Progress Overview */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Current Progress</h3>
                    <p className="text-gray-600">From {careerPlanning.currentPhase} to {careerPlanning.nextMilestone}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{careerPlanning.progressPercentage}%</div>
                    <div className="text-sm text-gray-500">{careerPlanning.timeToGoal}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${careerPlanning.progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Key Actions */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Actions & Milestones</h3>
                <div className="space-y-4">
                  {(careerPlanning?.keyActions || []).map((action) => {
                    const getStatusIcon = (status) => {
                      switch (status) {
                        case 'in-progress':
                          return <ClockIcon className="h-5 w-5 text-yellow-500" />;
                        case 'planned':
                          return <CalendarDaysIcon className="h-5 w-5 text-blue-500" />;
                        case 'not-started':
                          return <InformationCircleIcon className="h-5 w-5 text-gray-400" />;
                        default:
                          return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
                      }
                    };

                    const getStatusColor = (status) => {
                      switch (status) {
                        case 'in-progress':
                          return 'border-yellow-200 bg-yellow-50';
                        case 'planned':
                          return 'border-blue-200 bg-blue-50';
                        case 'not-started':
                          return 'border-gray-200 bg-gray-50';
                        default:
                          return 'border-green-200 bg-green-50';
                      }
                    };

                    return (
                      <div key={action.id} className={`border-2 rounded-xl p-4 ${getStatusColor(action.status)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {getStatusIcon(action.status)}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">{action.title}</h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span>Due: {new Date(action.deadline).toLocaleDateString()}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  action.priority === 'high' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {action.priority} priority
                                </span>
                              </div>
                            </div>
                          </div>
                          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skill Gap Analysis */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Development Plan</h3>
                <div className="space-y-4">
                  {(careerPlanning?.skillGaps || []).map((skill, index) => {
                    const progressPercentage = (skill.currentLevel / skill.targetLevel) * 100;
                    return (
                      <div key={index} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{skill.skill}</span>
                          <span className="text-sm text-gray-600">
                            Level {skill.currentLevel} → {skill.targetLevel}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Career Trajectory Visualization */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-6">
                <PresentationChartLineIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-xl font-semibold text-gray-900">Career Trajectory & Salary Growth</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={professionalData.careerTrajectory || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" orientation="left" domain={[0, 6]} />
                    <YAxis yAxisId="right" orientation="right" domain={[50, 150]} />
                    <Tooltip formatter={(value, name) => [
                      name === 'level' ? `Level ${value}` : `$${value}k`,
                      name === 'level' ? 'Career Level' : 'Salary'
                    ]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="level" stroke="#8B5CF6" strokeWidth={3} name="level" />
                    <Line yAxisId="right" type="monotone" dataKey="salary" stroke="#10B981" strokeWidth={3} name="salary" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strengths vs Weaknesses Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Strengths */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <StarIcon className="h-6 w-6 text-green-600" />
                  <h3 className="text-xl font-semibold text-gray-900">Core Strengths</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={professionalData.strengthsWeaknesses?.strengths || []}>
                      <RadialBar dataKey="score" cornerRadius={10} fill="#10B981" />
                      <Tooltip formatter={(value) => [`${value}%`, 'Strength Level']} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Areas for Improvement */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
                  <h3 className="text-xl font-semibold text-gray-900">Development Areas</h3>
                </div>
                <div className="space-y-4">
                  {(professionalData.strengthsWeaknesses?.weaknesses || []).map((weakness, index) => {
                    const progressPercentage = weakness.score;
                    return (
                      <div key={index}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">{weakness.area}</span>
                          <span className="text-sm text-gray-600">{weakness.score}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-center py-12">
                <LightBulbIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Career Tool</h3>
                <p className="text-gray-600">Choose from the sidebar to access different career development tools.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex" data-agent-type="career">
      {/* Sidebar */}
      return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex">
      <div className={`bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300 relative ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}>
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-300 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md z-50"
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarExpanded ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {!sidebarExpanded ? (
            <div className="space-y-2">
              <button
                onClick={handleDashboardToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Dashboard"
              >
                <Home className="h-5 w-5" />
              </button>

              <button
                onClick={handleInsightsToggle}
                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Career Insights"
              >
                <Lightbulb className="h-5 w-5" />
              </button>

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;
                const tabTitle = isDisabled ? `${tab.name} - Coming Soon` : tab.name;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={tabTitle}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={handleDashboardToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'welcome'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Home className={`h-5 w-5 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Dashboard</span>
                </div>
                {showDashboardSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'welcome' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {showDashboardSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {dashboardTabs.map((dashTab) => {
                    const DashIconComponent = dashTab.icon;
                    const isDashDisabled = dashTab.disabled;
                    const isPreview = dashTab.preview;

                    return (
                      <button
                        key={dashTab.id}
                        onClick={() => !isDashDisabled && handleDashboardTabChange(dashTab.id)}
                        disabled={isDashDisabled}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-all duration-200 text-sm ${
                          isDashDisabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome'
                            ? `${dashTab.bgColor} ${dashTab.color} border border-current`
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <DashIconComponent className={`h-4 w-4 flex-shrink-0 ${
                          isDashDisabled 
                            ? 'text-gray-300' 
                            : activeDashboardTab === dashTab.id && activeTab === 'welcome' 
                            ? dashTab.color 
                            : 'text-gray-500'
                        }`} />
                        <span className="font-medium text-left flex-1">{dashTab.name}</span>
                        {isDashDisabled && (
                          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                        {isPreview && !isDashDisabled && (
                          <span className="ml-auto text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                            Preview Only
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleInsightsToggle}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeTab === 'insights'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Lightbulb className={`h-5 w-5 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className="font-medium">Career Insights</span>
                </div>
                {showInsightsSubTabs ? (
                  <ChevronUp className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${
                    activeTab === 'insights' ? 'text-white' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {/* FIXED: Removed activeTab check for better UX */}
              {showInsightsSubTabs && (
                <div className="ml-3 pl-3 border-l border-gray-200 space-y-1 py-1">
                  {insightsSubTabs.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleInsightsSubTabChange(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center ${
                        insightsTab === item.id 
                          ? 'bg-orange-100 text-orange-600 font-semibold' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {sectionStatus[item.section] === 'completed' ? (
                        <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : analysisProgress.isAnalyzing ? (
                        <svg className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = tab.disabled;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className={`h-5 w-5 ${
                      isDisabled
                        ? 'text-gray-300'
                        : activeTab === tab.id ? 'text-white' : 'text-gray-500'
                    }`} />
                    <span className="font-medium">{tab.name}</span>
                    {isDisabled && (
                      <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className={`p-4 border-t border-gray-200 ${!sidebarExpanded ? 'px-2' : ''}`}>
          {sidebarExpanded ? (
            <div className="text-xs text-gray-500 text-center">
              © 2025 Idii
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Clean Top Navigation Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          {/* Simplified Top Navigation */}
          <div className="flex items-center justify-between px-8 py-4">
            {/* <div className="flex items-center">
              {/* Elegantly Positioned Back to Dashboard Button 
              <button
                onClick={handleBackToDashboard}
                className="group flex items-center space-x-3 px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl transition-all duration-300 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-all duration-300 group-hover:-translate-x-0.5" />
                <span className="font-semibold tracking-wide">Back to Dashboard</span>
              </button>
            </div> */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleAnalyzeResume}
                className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
                disabled={analysisProgress.isAnalyzing}
              >
                <DocumentTextIcon className="h-5 w-5" />
                <span>{analysisProgress.isAnalyzing ? 'Analyzing...' : 'Analyze Recent Resume'}</span>
              </button>
              <button
                onClick={handlePersonalAssistant}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
              >
                Ask Career Agent
              </button>
              
              {/* Notification Bell - moved from bottom to top navigation */}
              <NotificationPanel 
                notifications={notifications}
                onDismiss={dismissNotification}
                maxVisible={5}
              />
              
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                {avatarUrl && !isImgError? (
                  <img
                    src={avatarUrl}
                    alt="User Avatar"
                    onError={()=> setImgError(true)}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <UserCircleIcon className="h-6 w-6 text-gray-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress tracking is now handled in ChatDialog personal assistant */}
        {/* Enhanced Progress Tracker component removed - progress messages now appear in personal assistant chat */}

        {/* Tab Content */}
        <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-purple-50">
          {renderTabContent()}
        </div>

        {/* Notification Panel moved to top navigation bar */}

        {/* Personal Assistant Section */}
        <PersonalAssistant 
          user={userData} 
          isDialogOpen={isAssistantDialogOpen}
          setIsDialogOpen={setIsAssistantDialogOpen}
          onDialogClose={fetchUnreadCount}
          onUnreadCountChange={fetchUnreadCount}
        />
      </div>
      </div>
      </div>
  );
};

export default CareerAgent;