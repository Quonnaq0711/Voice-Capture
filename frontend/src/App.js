import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AutoLogoutProvider from "./contexts/AutoLogoutProvider";
import memoryMonitor from "./utils/memoryMonitor";

// Auth components
import {
  Login,
  Register,
  PrivateRoute,
  VerifyRegistration,
  ResetPasswordRequest,
  VerifyPasswordOTP,
} from "./components/auth";

// Feature components
import { Profile } from "./components/profile";
import { OnboardingWizard } from "./components/onboarding";
// import { UnifiedSidebar } from "./components/dashboard";
import { CareerAgent, TravelAgent, BodyAgent, WorkAgent } from "./components/agents";
import { NewLandingPage } from "./components/landing";
import { ErrorBoundary } from "./components/ui";
import WorkPage from "./components/work/WorkPage";

import { LegalPage } from './components/legal';

// Toast notifications
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Placeholder components for agent routes
const AgentPage = ({ agentName }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">{agentName} Agent</h1>
    <p className="mt-4">
      This is a placeholder page for the {agentName} agent. Functionality will
      be implemented here.
    </p>
  </div>
);

function App() {
  // Set up global memory monitoring and cleanup
  useEffect(() => {
    // Global cleanup function for when the app unmounts
    const handleBeforeUnload = () => {
      memoryMonitor.cleanup();
    };

    // Listen for page unload to cleanup resources
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function for component unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      memoryMonitor.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AutoLogoutProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/welcome" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/welcome" element={<NewLandingPage />} />
              <Route
                path="/onboarding"
                element={
                  <PrivateRoute>
                    <OnboardingWizard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  // <PrivateRoute>
                    <WorkAgent />
                   // </PrivateRoute> */}
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/work"
                element={
                  // <PrivateRoute>
                    <WorkPage />
                  // </PrivateRoute>            
                }
              />
              {/* Legal Routes */}
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/privacy" element={<LegalPage />} />
              <Route path="/terms" element={<LegalPage />} />

              {/* OTP Routes */}
              <Route
                path="/request-password"
                element={<ResetPasswordRequest />}
              />
              <Route path="/confirm-password" element={<VerifyPasswordOTP />} />
              <Route
                path="/confirm-registration"
                element={<VerifyRegistration />}
              />

              {/* Agent Routes */}
              <Route path="/agents/career" element={<PrivateRoute><CareerAgent /></PrivateRoute>} />
              <Route path="/agents/money" element={<PrivateRoute><AgentPage agentName="Money" /></PrivateRoute>} />
              <Route path="/agents/mind" element={<PrivateRoute><AgentPage agentName="Mind" /></PrivateRoute>} />
              <Route path="/agents/travel" element={<PrivateRoute><TravelAgent /></PrivateRoute>} />
              <Route path="/agents/body" element={<PrivateRoute><BodyAgent /></PrivateRoute>} />
              <Route path="/agents/family-life" element={<PrivateRoute><AgentPage agentName="Family Life" /></PrivateRoute>} />
              <Route path="/agents/hobby" element={<PrivateRoute><AgentPage agentName="Hobby" /></PrivateRoute>} />
              <Route path="/agents/knowledge" element={<PrivateRoute><AgentPage agentName="Knowledge" /></PrivateRoute>} />
              <Route path="/agents/personal-dev" element={<PrivateRoute><AgentPage agentName="Personal Development" /></PrivateRoute>} />
              <Route path="/agents/spiritual" element={<PrivateRoute><AgentPage agentName="Spiritual" /></PrivateRoute>} />
            </Routes>
          </AutoLogoutProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
