import { useState, useEffect } from 'react'

// Basic setup to ensure the Web Worker and basic React functionality work
function App() {
  const [workerStatus, setWorkerStatus] = useState('Initializing...');

  useEffect(() => {
    const worker = new Worker(new URL('./workers/crypto.worker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      console.log("Message from worker:", e.data);
    };

    setWorkerStatus('Worker ready (Check Console)');

    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">SDE-Platform v3 (React)</h1>
      <p className="text-xl mb-4">Web Worker Status: {workerStatus}</p>
      <p className="text-gray-600">The frontend has been migrated to React with Vite. Crypto operations are now isolated in a Web Worker.</p>
    </div>
  )
}

export default App
