import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { worker, initWorker } = useAppStore();

  React.useEffect(() => {
    initWorker();
  }, [initWorker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) {
      setError("Worker not initialized");
      return;
    }

    setStatus("Generating keys...");
    setError('');

    const msgId = "reg-" + Date.now();
    const handleMessage = async (e: MessageEvent) => {
      if (e.data.id === msgId) {
        worker.removeEventListener('message', handleMessage);
        if (!e.data.success) {
          setError(e.data.error);
          setStatus('');
          return;
        }

        setStatus("Registering on server...");
        try {
          await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({
              email, username, password,
              publicKey: e.data.result.pubKeyHex,
              encryptedPrivKey: e.data.result.encryptedPrivKey,
              salt: e.data.result.salt,
              iv: e.data.result.iv
            })
          });
          setStatus("Success! Redirecting to login...");
          setTimeout(() => navigate('/login'), 1000);
        } catch (err: any) {
          setError(err.message || "Registration failed");
          setStatus('');
        }
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type: "GENERATE_AND_ENCRYPT_KEY", id: msgId, payload: { password } });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="mb-6 text-2xl font-bold text-center">Register</h2>
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        {status && <p className="mb-4 text-sm text-blue-500">{status}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 border rounded" required minLength={3} />
          </div>
          <div className="mb-6">
            <label className="block mb-1 text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded" required minLength={8} />
          </div>
          <button type="submit" className="w-full py-2 text-white bg-gray-800 rounded hover:bg-gray-900" disabled={!!status && status !== "Success! Redirecting to login..."}>Register</button>
        </form>
        <p className="mt-4 text-sm text-center">Already have an account? <Link to="/login" className="text-blue-600">Login</Link></p>
      </div>
    </div>
  );
}
