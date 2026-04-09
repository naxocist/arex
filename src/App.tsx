/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import AppLoadingOverlay from './components/AppLoadingOverlay';
import Layout from './components/Layout';
import FarmerHome from './views/FarmerHome';
import FarmerRewards from './views/FarmerRewards';
import ExecutiveDashboard from './views/ExecutiveDashboard';
import ExecutiveSettings from './views/ExecutiveSettings';
import LogisticsTracking from './views/LogisticsTracking';
import FactoryIntake from './views/FactoryIntake';
import FactorySettings from './views/FactorySettings';
import WarehouseApproval from './views/WarehouseApproval';
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
      factory: '/factory',
      warehouse: '/warehouse'
    };
    return <Navigate to={rolePaths[role]} replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<UserSelection />} />
      
      <Route path="/" element={<Layout />}>
        <Route index element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerHome />
          </ProtectedRoute>
        } />
        <Route path="farmer-rewards" element={
          <ProtectedRoute allowedRole="farmer">
            <FarmerRewards />
          </ProtectedRoute>
        } />
        <Route path="dashboard" element={
          <ProtectedRoute allowedRole="executive">
            <ExecutiveDashboard />
          </ProtectedRoute>
        } />
        <Route path="executive-settings" element={
          <ProtectedRoute allowedRole="executive">
            <ExecutiveSettings />
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
        <Route path="factory/settings" element={
          <ProtectedRoute allowedRole="factory">
            <FactorySettings />
          </ProtectedRoute>
        } />
        <Route path="warehouse" element={
          <ProtectedRoute allowedRole="warehouse">
            <WarehouseApproval />
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
        <AppLoadingOverlay />
      </BrowserRouter>
    </UserProvider>
  );
}
