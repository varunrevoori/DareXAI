import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateBotPage } from './pages/CreateBotPage';
import { EditBotPage } from './pages/EditBotPage';
import { ConversationPage } from './pages/ConversationPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ThemeProvider } from './components/ThemeContext';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bots/create"
              element={
                <ProtectedRoute>
                  <CreateBotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bots/:botId/edit"
              element={
                <ProtectedRoute>
                  <EditBotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bots/:botId/conversation"
              element={
                <ProtectedRoute>
                  <ConversationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bots/:botId/documents"
              element={
                <ProtectedRoute>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
