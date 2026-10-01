// src/App.jsx
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import GlobalMonitorIndicator from "./components/GlobalMonitorIndicator.jsx";
import HomeButton from "./components/HomeButton.jsx";
import MoodChat from "./components/MoodChat.jsx";
import ReminderPopup from "./components/ReminderPopup.jsx";
import { auth } from "./config/firebase";
import { GlobalAIMonitorProvider } from "./context/GlobalAIMonitorContext.jsx";
import { ReminderProvider } from "./context/ReminderContext.jsx";
import AiTips from "./pages/AiTips.jsx";
import AiTutor from "./pages/AiTutor.jsx";
import AiVoiceTutor from "./pages/AiVoiceTutor.jsx";
import AiTwin from "./pages/AiTwin.jsx";
import AiTwinArena from "./pages/AiTwinArena.jsx";
import Analytics from "./pages/Analytics.jsx";
import CoachingWindow from "./pages/CoachingWindow.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Help from "./pages/Help.jsx";
import Login from "./pages/Login.jsx";
import Rewards from "./pages/Rewards.jsx";
import Settings from "./pages/Settings.jsx";
import Signup from "./pages/Signup.jsx";
import Tasks from "./pages/Tasks.jsx";
import Training from "./pages/Training.jsx";

// Loading component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#666'
  }}>
    Loading...
  </div>
);

// Protected Route component with Firebase auth check
const RequireAuth = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in with Firebase
        setIsAuthenticated(true);
      } else {
        // Check fallback token storage (for backward compatibility)
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        setIsAuthenticated(!!token);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? (
    <>
      {children}
      <MoodChat />
    </>
  ) : <Navigate to="/" replace />;
};

function App() {
  console.log("App rendered");

  return (
    <Router>
      <ReminderProvider>
        <GlobalAIMonitorProvider>
          <HomeButton />
          <GlobalMonitorIndicator />
          <ReminderPopup />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/training"
              element={
                <RequireAuth>
                  <Training />
                </RequireAuth>
              }
            />
            <Route
              path="/tasks"
              element={
                <RequireAuth>
                  <Tasks />
                </RequireAuth>
              }
            />
            <Route
              path="/analytics"
              element={
                <RequireAuth>
                  <Analytics />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-tips"
              element={
                <RequireAuth>
                  <AiTips />
                </RequireAuth>
              }
            />
            <Route
              path="/coaching"
              element={
                <RequireAuth>
                  <CoachingWindow />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-twin"
              element={
                <RequireAuth>
                  <AiTwin />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-twin-arena"
              element={
                <RequireAuth>
                  <AiTwinArena />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-tutor"
              element={
                <RequireAuth>
                  <AiTutor />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-voice-tutor"
              element={
                <RequireAuth>
                  <AiVoiceTutor />
                </RequireAuth>
              }
            />
            <Route
              path="/rewards"
              element={
                <RequireAuth>
                  <Rewards />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/help"
              element={
                <RequireAuth>
                  <Help />
                </RequireAuth>
              }
            />
          </Routes>
        </GlobalAIMonitorProvider>
      </ReminderProvider>
    </Router>
  );
}

export default App;