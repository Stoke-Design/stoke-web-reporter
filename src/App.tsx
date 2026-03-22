import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import { initAuth, getCurrentUser, logout } from './auth';
import { setOnUnauthorized } from './authFetch';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    dataLayer: any[];
  }
}

// Auth context — shared across all admin pages
interface AuthContextType {
  user: any;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType>({ user: null, signOut: async () => {}, refreshUser: async () => {} });
export const useAuth = () => useContext(AuthContext);

function GTMLoader() {
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        const id = data.gtm_container_id;
        if (!id) return;
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

/** Wrapper that requires auth — redirects to /login if not signed in */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshUser = useCallback(async () => {
    const u = await getCurrentUser();
    setUser(u);
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(async (data) => {
        if (data.appwrite_endpoint && data.appwrite_project_id) {
          initAuth(data.appwrite_endpoint, data.appwrite_project_id);
          await refreshUser();
        }
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));
  }, []);

  const signOut = async () => {
    await logout();
    setUser(null);
  };

  // When authFetch receives a 401, clear user state so Login shows the form (not a redirect)
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
    });
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, signOut, refreshUser }}>
      <BrowserRouter>
        <GTMLoader />
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login />} />
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/admin/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/:slug" element={<ClientDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
