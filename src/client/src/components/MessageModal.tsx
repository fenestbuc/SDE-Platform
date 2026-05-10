import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function MessageModal({ activeMessage, decryptedBody, onClose }: { activeMessage: any, decryptedBody: string, onClose: () => void }) {
  const { worker } = useAppStore();
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const downloadFile = async (activeMessage: any) => {
    if (!worker || !activeMessage?.attachment) return;
    try {
      
      const fileUrlData = await apiFetch(`/messages/${activeMessage.id}/attachment`);
      let blob: Blob;
      if (fileUrlData.url.startsWith('/api')) {
        blob = await apiFetch(fileUrlData.url.replace('/api', ''));
      } else {
        const fileRes = await fetch(fileUrlData.url);
        blob = await fileRes.blob();
      }
      
      const msgId = "decf-" + Date.now();
      
      let decryptedBlob;
      
      if (activeMessage.groupId) {
        throw new Error("Group file decryption requires streaming symmetric decipher implementation in v6.");
      } else {
        const doDecryptFileChunked = () => new Promise<Blob>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            if (ev.data.id === msgId) {
              if (ev.data.type === 'PROGRESS') {
                setProgress(ev.data.payload.progress);
              } else {
                worker.removeEventListener('message', handler);
                ev.data.success ? resolve(ev.data.result.decryptedBlob) : reject(ev.data.error);
              }
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type: 'DECRYPT_FILE_CHUNKED', id: msgId, payload: {
            encryptedFileBlob: blob,
            ePubHex: activeMessage.ephemeralPubKey,
            infoStr: "sde-file-v1"
          }});
        });
        
        decryptedBlob = await doDecryptFileChunked();
      }

      const fileBlob = new Blob([decryptedBlob], { type: activeMessage.attachment.contentType });
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeMessage.attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download error: ' + e.message);
      setStatus('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-1/2 max-w-2xl animate-fade-in-up">
        <h3 className="text-2xl font-bold mb-4 text-gray-800">Secure Message</h3>
        <div className="p-4 bg-gray-50 border rounded text-gray-700 mb-6 whitespace-pre-wrap min-h-[100px]">{decryptedBody}</div>
        
        {activeMessage.attachment && (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6">
            <div className="flex items-center text-blue-800 mb-2 sm:mb-0">
              <span className="mr-2 text-xl">📎</span>
              <span className="font-semibold">{activeMessage.attachment.filename}</span>
              <span className="ml-2 text-sm opacity-80">({Math.round(activeMessage.attachment.fileSize / 1024)} KB)</span>
            </div>
            <button onClick={() => downloadFile(activeMessage)} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded transition shadow">Download Attachment</button>
          </div>
        )}

        {status && (
          <div className="mb-4">
            <div className="text-sm font-medium text-blue-600 mb-1">{status}</div>
            {progress > 0 && progress < 100 && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-900 text-white font-bold px-6 py-2 rounded transition shadow">Close</button>
        </div>
      </div>
    </div>
  );
}