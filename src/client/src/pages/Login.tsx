import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, initWorker, worker } = useAppStore();

  useEffect(() => {
    initWorker();
  }, [initWorker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { accessToken } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      
      const profile = await apiFetch("/users/me", {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      
      // Store key in worker
      if (worker) {
        worker.postMessage({
          type: "STORE_KEY",
          id: "login",
          payload: {
            encryptedB64: profile.encryptedPrivKey,
            saltB64: profile.salt,
            ivB64: profile.iv,
            password
          }
        });
      }
      
      login(accessToken, profile.username, profile.role === 'admin');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="mb-6 text-2xl font-bold text-center">Login</h2>
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div className="mb-6">
            <label className="block mb-1 text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <button type="submit" className="w-full py-2 text-white bg-blue-600 rounded hover:bg-blue-700">Login</button>
        </form>
        <p className="mt-4 text-sm text-center">No account? <Link to="/register" className="text-blue-600">Register</Link></p>
      </div>
    </div>
  );
}
