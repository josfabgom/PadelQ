import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import CourtsPage from './pages/Courts';
import ActivitiesPage from './pages/Activities';
import AdminSettingsPage from './pages/AdminSettings';
import MembershipsPage from './pages/Memberships';
import QrValidator from './pages/QrValidator';
import CtaCtePage from './pages/CtaCte';
import PaymentMethodsPage from './pages/PaymentMethods';
import ReportsPage from './pages/Reports';
import ProfilePage from './pages/Profile';





function App() {
  const isAuthenticated = !!localStorage.getItem('padelq_token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/users" 
          element={isAuthenticated ? <UsersPage /> : <Navigate to="/login" />} 
        />
         <Route 
          path="/courts" 
          element={isAuthenticated ? <CourtsPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/activities" 
          element={isAuthenticated ? <ActivitiesPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <AdminSettingsPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/memberships" 
          element={isAuthenticated ? <MembershipsPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/validate" 
          element={isAuthenticated ? <QrValidator /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/ctacte" 
          element={isAuthenticated ? <CtaCtePage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/payment-methods" 
          element={isAuthenticated ? <PaymentMethodsPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/reports" 
          element={isAuthenticated ? <ReportsPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/profile" 
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} 
        />




        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
