/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import Layout from './components/Layout';
import FarmerHome from './views/FarmerHome';
import ExecutiveDashboard from './views/ExecutiveDashboard';
import LogisticsTracking from './views/LogisticsTracking';
import FactoryIntake from './views/FactoryIntake';
import UserSelection from './views/UserSelection';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole: string }) {
  const { role } = useUser();
  
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  
  if (role !== allowedRole) {
    // Redirect to their own home if they try to access other roles' pages
    const rolePaths: Record<string, string> = {
      farmer: '/',
      executive: '/dashboard',
      logistics: '/logistics',
      factory: '/factory'
    };
    return <Navigate to={rolePaths[role]} replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { role } = useUser();

  return (
    <Routes>
      <Route path="/login" element={<UserSelection />} />
      
      <Route path="/" element={<Layout />}>
        <Route index element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerHome />
          </ProtectedRoute>
        } />
        <Route path="dashboard" element={
          <ProtectedRoute allowedRole="executive">
            <ExecutiveDashboard />
          </ProtectedRoute>
        } />
        <Route path="logistics" element={
          <ProtectedRoute allowedRole="logistics">
            <LogisticsTracking />
          </ProtectedRoute>
        } />
        <Route path="factory" element={
          <ProtectedRoute allowedRole="factory">
            <FactoryIntake />
          </ProtectedRoute>
        } />
        
        {/* Fallback routes for demo purposes */}
        <Route path="announcements" element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerHome />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerHome />
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </UserProvider>
  );
}
