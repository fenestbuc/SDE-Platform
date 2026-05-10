import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export default function Dashboard() {
  const { username, logout, worker } = useAppStore();
  const [tab, setTab] = useState<'inbox'|'sent'>('inbox');
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  
  const [toUser, setToUser] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [activeMessage, setActiveMessage] = useState<any>(null);
  const [decryptedBody, setDecryptedBody] = useState<string>('');

  useEffect(() => {
    loadMessages();

    const handleNewMessage = () => {
      // Reload messages if the active tab is inbox
      if (tab === 'inbox') {
        loadMessages();
      }
    };
    window.addEventListener('ws:new_message', handleNewMessage);
    return () => window.removeEventListener('ws:new_message', handleNewMessage);
  }, [tab]);

  const loadMessages = async () => {
    try {
      const msgs = await apiFetch(`/messages/${tab}`);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) return;
    setStatus('Looking up recipient...');
    setProgress(0);
    
    try {
      const recipient = await apiFetch(`/users/${toUser}`);
      setStatus('Encrypting message...');
      
      const msgId = "enc-" + Date.now();
      
      // Step 1: Encrypt text
      const doEncryptText = () => new Promise<any>((resolve, reject) => {
        const handler = (ev: MessageEvent) => {
          if (ev.data.id === msgId) {
            worker.removeEventListener('message', handler);
            ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'ENCRYPT_PAYLOAD', id: msgId, payload: {
          plaintext: bodyText,
          recipientPubKeyHex: recipient.publicKey
        }});
      });
      
      const msgPayload = await doEncryptText();
      
      // Step 2: Encrypt file if present
      if (file) {
        setStatus('Encrypting file (chunked)...');
        const fileId = "encf-" + Date.now();
        
        const doEncryptFileChunked = () => new Promise<any>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            if (ev.data.id === fileId) {
              if (ev.data.type === 'PROGRESS') {
                setProgress(ev.data.payload.progress);
              } else {
                worker.removeEventListener('message', handler);
                ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
              }
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type: 'ENCRYPT_FILE_CHUNKED', id: fileId, payload: {
            fileBlob: file,
            recipientPubKeyHex: recipient.publicKey,
            existingEPrivHex: msgPayload.ePrivHex,
            existingEPubHex: msgPayload.ephemeralPubKey,
            infoStr: "sde-file-v1"
          }});
        });
        
        const filePayload = await doEncryptFileChunked();
        
        const encryptedFile = new File([filePayload.rawEncryptedBlob], file.name, { type: file.type });
        
        // --- V5 DIRECT S3 STREAMING / UPLOAD ---
        setStatus('Requesting direct upload URL...');
        const urlData = await apiFetch('/messages/upload-url', { 
          method: 'POST', 
          body: JSON.stringify({ filename: file.name, contentType: file.type })
        });

        setStatus('Uploading to S3 directly...');
        const uploadRes = await fetch(urlData.url, {
          method: 'PUT',
          body: encryptedFile,
          headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error('Upload failed: ' + uploadRes.status + ' ' + text);
        }

        const formDataJson: any = {
          recipientId: recipient.id,
          ephemeralPubKey: msgPayload.ephemeralPubKey,
          ciphertext: msgPayload.ciphertext,
          iv: msgPayload.iv,
          tag: msgPayload.tag,
          fileIv: filePayload.iv,
          fileTag: filePayload.tag,
          storagePath: urlData.fileId,
          filename: file.name,
          fileSize: encryptedFile.size.toString(),
          contentType: file.type
        };

        setStatus('Sending metadata...');
        await apiFetch('/messages', { method: 'POST', body: JSON.stringify(formDataJson) });
      } else {
        const formDataJson = {
          recipientId: recipient.id,
          ephemeralPubKey: msgPayload.ephemeralPubKey,
          ciphertext: msgPayload.ciphertext,
          iv: msgPayload.iv,
          tag: msgPayload.tag
        };
        setStatus('Sending...');
        await apiFetch('/messages', { method: 'POST', body: JSON.stringify(formDataJson) });
      }
      
      setStatus('Message sent successfully!');
      setBodyText('');
      setFile(null);
      setProgress(0);
      if (tab === 'sent') loadMessages();
      
    } catch (err: any) {
      setStatus('Error: ' + err.message);
      setProgress(0);
    }
  };

  const openMessage = async (id: string) => {
    if (!worker) return;
    try {
      setDecryptedBody('Decrypting...');
      const m = await apiFetch(`/messages/${id}`);
      setActiveMessage(m);
      
      const msgId = "dec-" + Date.now();
      const doDecryptText = () => new Promise<string>((resolve, reject) => {
        const handler = (ev: MessageEvent) => {
          if (ev.data.id === msgId) {
            worker.removeEventListener('message', handler);
            ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'DECRYPT_PAYLOAD', id: msgId, payload: {
          ciphertextB64: m.ciphertext,
          ivB64: m.iv,
          tagB64: m.tag,
          ePubHex: m.ephemeralPubKey,
          isString: true
        }});
      });
      
      const text = await doDecryptText();
      setDecryptedBody(text);
      console.log('Decrypted body set:', text);
      
      if (m.recipientId === sessionStorage.getItem('userId')) {
        await apiFetch(`/messages/${id}/read`, { method: 'POST' });
      }
    } catch (e: any) {
      setDecryptedBody('Error: ' + e.message);
    }
  };

  const downloadFile = async () => {
    if (!worker || !activeMessage?.attachment) return;
    try {
      setStatus('Downloading encrypted file...');
      
      const fileUrlData = await apiFetch(`/messages/${activeMessage.id}/attachment`);
      const fileRes = await fetch(fileUrlData.url);
      const blob = await fileRes.blob();
      
      setStatus('Decrypting file (chunked)...');
      setProgress(0);
      const msgId = "decf-" + Date.now();
      
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
      
      const decryptedBlob = await doDecryptFileChunked();
      const fileBlob = new Blob([decryptedBlob], { type: activeMessage.attachment.contentType });
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeMessage.attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('');
      setProgress(0);
    } catch (e: any) {
      alert('Download error: ' + e.message);
      setStatus('');
      setProgress(0);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <nav className="bg-blue-600 text-white p-4 flex justify-between">
        <div className="font-bold">SDE Dashboard</div>
        <div>
          <span className="mr-4">Welcome, {username}</span>
          <button onClick={logout} className="underline">Logout</button>
        </div>
      </nav>
      
      <div className="container mx-auto mt-8 flex space-x-8 px-4">
        <div className="w-1/3">
          <h3 className="text-xl font-bold mb-4">Compose</h3>
          <form onSubmit={handleCompose} className="bg-white p-4 rounded shadow">
            <div className="mb-4">
              <label className="block text-sm">Recipient Username</label>
              <input type="text" id="compose-to" value={toUser} onChange={e => setToUser(e.target.value)} className="w-full border p-2 rounded" required />
            </div>
            <div className="mb-4">
              <label className="block text-sm">Message</label>
              <textarea id="compose-body" value={bodyText} onChange={e => setBodyText(e.target.value)} className="w-full border p-2 rounded" rows={4} required></textarea>
            </div>
            <div className="mb-4">
              <label className="block text-sm">Attachment (Up to 1GB chunked)</label>
              <input type="file" id="compose-file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Send Encrypted</button>
            {status && (
              <div className="mt-4">
                <div className="text-sm text-blue-600 mb-1">{status}</div>
                {progress > 0 && progress < 100 && (
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
        
        <div className="w-2/3">
          <div className="flex border-b mb-4">
            <button onClick={() => setTab('inbox')} className={`px-4 py-2 font-bold ${tab === 'inbox' ? 'border-b-2 border-blue-600' : 'text-gray-500'}`}>Inbox</button>
            <button onClick={() => setTab('sent')} className={`px-4 py-2 font-bold ${tab === 'sent' ? 'border-b-2 border-blue-600' : 'text-gray-500'}`}>Sent</button>
          </div>
          <div className="space-y-4">
            {messages.length === 0 ? <p className="text-gray-500">No messages found.</p> : 
              messages.map(m => {
                const otherPartyField = tab === 'inbox' ? 'sender' : 'recipient';
                const otherName = m[otherPartyField].displayName || m[otherPartyField].username;
                return (
                  <div key={m.id} onClick={() => openMessage(m.id)} className="bg-white p-4 rounded shadow cursor-pointer hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div className="font-bold">{tab === 'inbox' ? 'From' : 'To'}: {otherName} {!m.readAt && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded ml-2">NEW</span>} {m.hasAttachment && " 📎"}</div>
                      <div className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      {activeMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-1/2">
            <h3 className="text-xl font-bold mb-2">Message</h3>
            <div className="p-4 bg-gray-100 rounded mb-4 whitespace-pre-wrap">{decryptedBody}</div>
            {activeMessage.attachment && (
              <div className="mb-4">
                <button onClick={downloadFile} className="bg-green-600 text-white px-4 py-2 rounded">Download Attachment</button>
              </div>
            )}
            <button onClick={() => { setActiveMessage(null); loadMessages(); }} className="bg-gray-800 text-white px-4 py-2 rounded">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
