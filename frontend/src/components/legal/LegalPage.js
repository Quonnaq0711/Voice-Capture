import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LegalDocument from './LegalDocument';
import { PRIVACY_POLICY, TERMS_OF_USE } from './legalContent';

const TABS = [
  { key: 'privacy', label: 'Privacy Policy', document: PRIVACY_POLICY },
  { key: 'terms', label: 'Terms of Use', document: TERMS_OF_USE },
];

const PATH_TAB_MAP = { '/privacy': 'privacy', '/terms': 'terms' };

function getTabFromPath(pathname) {
  return PATH_TAB_MAP[pathname] || 'privacy';
}

export default function LegalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleBack = () => {
    navigate(-1);
  };

  const activeDocument = TABS.find((t) => t.key === activeTab);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <nav className="mb-6">
          <button
            onClick={handleBack}
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </nav>

        <div className="flex border-b border-gray-200 mb-6" role="tablist" aria-label="Legal documents">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeDocument && <LegalDocument document={activeDocument.document} />}
        </div>
      </div>
    </main>
  );
}
