import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import ClientDashboard from './pages/ClientDashboard';

declare global {
  interface Window {
    dataLayer: any[];
  }
}

function GTMLoader() {
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        const id = data.gtm_container_id;
        if (!id) return;
        // Prevent double-injection
        if (document.querySelector(`script[data-gtm="${id}"]`)) return;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
        script.setAttribute('data-gtm', id);
        document.head.appendChild(script);
      })
      .catch(() => {});
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <GTMLoader />
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/:slug" element={<ClientDashboard />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
