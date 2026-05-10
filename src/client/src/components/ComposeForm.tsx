import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function ComposeForm({ onMessageSent }: { onMessageSent: () => void }) {
  const { worker } = useAppStore();
  const [toUser, setToUser] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) return;
    setStatus('Looking up recipient...');
    setProgress(0);
    
    try {
        // Groups Fetcher (mock for V6 tests)
        if (toUser.startsWith('group:')) {
            const groupId = toUser.split(':')[1];
            setStatus('Encrypting group message...');
            // In a real app we'd fetch the group's pre-distributed SenderKey. 
            // For now, we mock symmetric encryption.
            const symKey = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"; // 32 bytes hex
            const msgId = "encg-" + Date.now();
            const doEncryptGroup = () => new Promise<any>((resolve, reject) => {
              const handler = (ev: MessageEvent) => {
                if (ev.data.id === msgId) {
                  worker.removeEventListener('message', handler);
                  ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
                }
              };
              worker.addEventListener('message', handler);
              worker.postMessage({ type: 'ENCRYPT_GROUP_PAYLOAD', id: msgId, payload: {
                plaintext: bodyText,
                senderKeyHex: symKey
              }});
            });
            
            const msgPayload = await doEncryptGroup();
            const formDataJson = {
                groupId: groupId,
                ephemeralPubKey: symKey, // We use this field to pass the symkey id in V6 group messaging
                ciphertext: msgPayload.ciphertext,
                iv: msgPayload.iv,
                tag: msgPayload.tag
            };
            setStatus('Sending to group...');
            await apiFetch(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(formDataJson) });
            setStatus('Message sent successfully!');
            setBodyText('');
            return;
        }

      const recipient = await apiFetch(`/keys/bundle/${toUser}`).catch(() => apiFetch(`/users/${toUser}`));
      let recipientIdForDb = recipient.id || recipient.identityKey;
      if (!recipientIdForDb) {
        // Fallback fetch to /users to get ID
        const rawUser = await apiFetch(`/users/${toUser}`);
        recipientIdForDb = rawUser.id;
      }
      console.log('Recipient fetched:', recipient);
      
      const targetPubKey = recipient.preKey || recipient.identityKey || recipient.publicKey;
      if (!targetPubKey) {
        throw new Error("Could not find a valid public key for recipient: " + JSON.stringify(recipient));
      }
      
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
          recipientPubKeyHex: targetPubKey
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
            recipientPubKeyHex: targetPubKey,
            existingEPrivHex: msgPayload.ePrivHex,
            existingEPubHex: msgPayload.ephemeralPubKey,
            infoStr: "sde-file-v1"
          }});
      });
      
      const filePayload = await doEncryptFileChunked();
      if (!filePayload) throw new Error("File payload is undefined from worker");
      if (!filePayload.rawEncryptedBlob) throw new Error("rawEncryptedBlob is undefined from worker");
        const encryptedFile = new File([filePayload.rawEncryptedBlob], file.name, { type: file.type });
        
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
          recipientId: recipientIdForDb,
          ephemeralPubKey: msgPayload.ephemeralPubKey,
          ciphertext: msgPayload.ciphertext,
          iv: msgPayload.iv,
          tag: msgPayload.tag,
          signature: msgPayload.signature,
          fileIv: filePayload.iv,
          fileTag: filePayload.tag,
          storagePath: urlData.fileId,
          filename: file.name,
          fileSize: encryptedFile.size.toString(),
          contentType: file.type,
          preKeyId: recipient.preKeyId // NEW in v6
        };

        setStatus('Sending metadata...');
        await apiFetch('/messages', { method: 'POST', body: JSON.stringify(formDataJson) });
      } else {
        const formDataJson = {
          recipientId: recipientIdForDb,
          ephemeralPubKey: msgPayload.ephemeralPubKey,
          ciphertext: msgPayload.ciphertext,
          iv: msgPayload.iv,
          tag: msgPayload.tag,
          signature: msgPayload.signature,
          preKeyId: recipient.preKeyId // NEW in v6
        };
        setStatus('Sending...');
        await apiFetch('/messages', { method: 'POST', body: JSON.stringify(formDataJson) });
      }
      
      setStatus('Message sent successfully!');
      setBodyText('');
      setFile(null);
      setProgress(0);
      onMessageSent();
      
    } catch (err: any) {
      console.error(err);
      setStatus('Error: ' + (err.message || err.toString() || 'Unknown error'));
      setProgress(0);
    }
  };

  return (
    <div className="w-1/3">
      <h3 className="text-xl font-bold mb-4">Compose</h3>
      <form onSubmit={handleCompose} className="bg-white p-4 rounded shadow">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Recipient Username</label>
          <input type="text" id="compose-to" value={toUser} onChange={e => setToUser(e.target.value)} className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500" required />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Message</label>
          <textarea id="compose-body" value={bodyText} onChange={e => setBodyText(e.target.value)} className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500" rows={4} required></textarea>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Attachment (Up to 1GB chunked)</label>
          <input type="file" id="compose-file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 transition">Send Encrypted</button>
        {status && (
          <div className="mt-4">
            <div className="text-sm font-medium text-blue-600 mb-1">{status}</div>
            {progress > 0 && progress < 100 && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}