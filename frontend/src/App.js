import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AutoLogoutProvider from './contexts/AutoLogoutProvider';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import OnboardingWizard from './components/OnboardingWizard';
import ResetPasswordRequest from './components/ResetPasswordRequest';
import VerifyPasswordOTP from './components/VerifyPasswordOTP';
import VerifyRegistration from './components/VerifyRegistration';


// Placeholder components for agent routes
const AgentPage = ({ agentName }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">{agentName} Agent</h1>
    <p className="mt-4">This is a placeholder page for the {agentName} agent. Functionality will be implemented here.</p>
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <AutoLogoutProvider>
          <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
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
            {/* OTP Routes */}
            <Route path="/request-password" element={<ResetPasswordRequest />} />
            <Route path="/confirm-password" element={<VerifyPasswordOTP />} />
            <Route path="/confirm-registration" element={<VerifyRegistration />} /> 



          {/* Agent Routes */}
          <Route path="/agents/career" element={<PrivateRoute><AgentPage agentName="Career" /></PrivateRoute>} />
          <Route path="/agents/money" element={<PrivateRoute><AgentPage agentName="Money" /></PrivateRoute>} />
          <Route path="/agents/mind" element={<PrivateRoute><AgentPage agentName="Mind" /></PrivateRoute>} />
          <Route path="/agents/travel" element={<PrivateRoute><AgentPage agentName="Travel" /></PrivateRoute>} />
          <Route path="/agents/body" element={<PrivateRoute><AgentPage agentName="Body" /></PrivateRoute>} />
          <Route path="/agents/family-life" element={<PrivateRoute><AgentPage agentName="Family Life" /></PrivateRoute>} />
          <Route path="/agents/hobby" element={<PrivateRoute><AgentPage agentName="Hobby" /></PrivateRoute>} />
          <Route path="/agents/knowledge" element={<PrivateRoute><AgentPage agentName="Knowledge" /></PrivateRoute>} />
          <Route path="/agents/personal-dev" element={<PrivateRoute><AgentPage agentName="Personal Development" /></PrivateRoute>} />
          <Route path="/agents/spiritual" element={<PrivateRoute><AgentPage agentName="Spiritual" /></PrivateRoute>} />
          </Routes>
        </AutoLogoutProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;