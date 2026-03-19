import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import ClientDashboard from './pages/ClientDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/client/:slug" element={<ClientDashboard />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
