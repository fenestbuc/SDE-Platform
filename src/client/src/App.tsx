import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { useAppStore } from './store/useAppStore';
import { apiFetch } from './lib/api';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        setSwRegistered(true);
      }).catch(err => {
        console.error('Service Worker registration failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!swRegistered) return;
    const subscribeToPush = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BKP5wLmeSJCnTIcFdIYXym7Eb8kKvOeQltQSKYXb7RaQC6RaWd0f5tKt7F7OvW_O5m4gtHOTlGawA6WEYTkyoAw'
        });
        
        await apiFetch('/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify({ subscription })
        });
      } catch (err) {
        console.error('Push subscription failed:', err);
      }
    };
    
    // Check auth status here
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      subscribeToPush();
      useAppStore.getState().connectWs();
    }
  }, [swRegistered]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
